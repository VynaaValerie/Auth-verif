const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const { Low, JSONFile } = require('lowdb');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');

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
const file = path.join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);

// Initialize database
async function initializeDB() {
  await db.read();
  db.data ||= { requests: [], approved: [], rejected: [], messages: [] };
  await db.write();
}

initializeDB();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html']
}));

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Send current data to new client
  socket.emit('initial-data', db.data);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// API Endpoints
app.post('/api/request-permission', async (req, res) => {
  const { botName, owner } = req.body;
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

app.post('/api/approve-request', async (req, res) => {
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

app.post('/api/reject-request', async (req, res) => {
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

app.post('/api/send-message', async (req, res) => {
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
  const { ip } = req.query;
  
  const isApproved = db.data.approved.some(request => request.ip === ip);
  
  res.json({
    valid: isApproved,
    message: isApproved ? 'Permission granted' : 'Permission denied'
  });
});

app.get('/api/get-requests', async (req, res) => {
  res.json(db.data);
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Handle all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});