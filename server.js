import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { Low, Memory } from 'lowdb';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import bodyParser from 'body-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 3000;

// Database setup
const adapter = new Memory();
const db = new Low(adapter);

// Initialize database
async function initializeDB() {
  db.data = {
    requests: [],
    approved: [],
    rejected: [],
    messages: [],
    settings: {
      authKey: process.env.AUTH_KEY || 'default-secret-key'
    }
  };
  await db.write();
}

await initializeDB();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html']
}));

// Authentication middleware
const authenticate = (req, res, next) => {
  const authKey = req.headers['x-auth-key'];
  if (authKey && authKey === db.data.settings.authKey) {
    return next();
  }
  res.status(401).json({ success: false, message: 'Unauthorized' });
};

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New admin client connected:', socket.id);
  
  // Send current data to new client
  socket.emit('initial-data', db.data);
  
  socket.on('disconnect', () => {
    console.log('Admin client disconnected:', socket.id);
  });
});

// API Endpoints
app.post('/api/request-permission', async (req, res) => {
  const { botName, owner, authKey } = req.body;
  
  // Verify auth key
  if (authKey !== db.data.settings.authKey) {
    return res.status(401).json({ success: false, message: 'Invalid auth key' });
  }

  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  const requestId = uuidv4();
  const newRequest = {
    id: requestId,
    botName,
    owner,
    time: new Date().toISOString(),
    ip: clientIp,
    status: 'pending',
    lastUpdated: new Date().toISOString()
  };
  
  db.data.requests.push(newRequest);
  await db.write();
  
  // Broadcast to all admin clients
  io.emit('new-request', newRequest);
  
  res.json({
    success: true,
    requestId,
    message: 'Permission request received'
  });
});

app.post('/api/approve-request', authenticate, async (req, res) => {
  const { requestId } = req.body;
  
  const request = db.data.requests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  
  request.status = 'approved';
  request.lastUpdated = new Date().toISOString();
  
  // Move to approved list
  db.data.approved.push(request);
  db.data.requests = db.data.requests.filter(r => r.id !== requestId);
  await db.write();
  
  // Broadcast update
  io.emit('request-approved', request);
  io.emit('request-updated', db.data);
  
  res.json({
    success: true,
    message: 'Request approved'
  });
});

app.post('/api/reject-request', authenticate, async (req, res) => {
  const { requestId } = req.body;
  
  const request = db.data.requests.find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  
  request.status = 'rejected';
  request.lastUpdated = new Date().toISOString();
  
  // Move to rejected list
  db.data.rejected.push(request);
  db.data.requests = db.data.requests.filter(r => r.id !== requestId);
  await db.write();
  
  // Broadcast update
  io.emit('request-rejected', request);
  io.emit('request-updated', db.data);
  
  res.json({
    success: true,
    message: 'Request rejected'
  });
});

app.post('/api/send-message', authenticate, async (req, res) => {
  const { requestId, message } = req.body;
  
  const request = [...db.data.requests, ...db.data.approved, ...db.data.rejected].find(r => r.id === requestId);
  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }
  
  const newMessage = {
    id: uuidv4(),
    requestId,
    message,
    time: new Date().toISOString(),
    admin: true
  };
  
  db.data.messages.push(newMessage);
  await db.write();
  
  // Broadcast new message
  io.emit('new-message', { requestId, message: newMessage });
  
  res.json({
    success: true,
    message: 'Message sent to bot'
  });
});

app.get('/api/verify-permission', async (req, res) => {
  const { ip, authKey } = req.query;
  
  // Verify auth key
  if (authKey !== db.data.settings.authKey) {
    return res.status(401).json({ valid: false, message: 'Invalid auth key' });
  }

  const isApproved = db.data.approved.some(request => request.ip === ip);
  
  res.json({
    valid: isApproved,
    message: isApproved ? 'Permission granted' : 'Permission denied'
  });
});

app.get('/api/get-requests', authenticate, async (req, res) => {
  res.json(db.data);
});

// Admin panel routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

server.listen(port, () => {
  console.log(`Authorization server running on port ${port}`);
  console.log(`Admin panel: http://localhost:${port}/admin`);
});