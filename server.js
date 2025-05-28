import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Low, Memory } from 'lowdb';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const AUTH_KEY = process.env.AUTH_KEY || 'default-secret-key';

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
    activeBots: [],
    settings: {
      authKey: AUTH_KEY,
      maxBots: 50
    }
  };
  await db.write();
}

await initializeDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Authentication middleware
const authenticate = (req, res, next) => {
  const authKey = req.headers['x-auth-key'] || req.query.authKey;
  if (authKey === db.data.settings.authKey) return next();
  res.status(401).json({ success: false, message: 'Unauthorized' });
};

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Admin connected:', socket.id);
  
  // Send initial data
  socket.emit('init', db.data);
  
  socket.on('disconnect', () => {
    console.log('Admin disconnected:', socket.id);
  });
});

// API Endpoints

// Bot requests permission
app.post('/api/request', async (req, res) => {
  const { botName, owner, authKey } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'];
  
  if (authKey !== db.data.settings.authKey) {
    return res.status(401).json({ success: false, message: 'Invalid auth key' });
  }

  // Check if already exists
  const existing = db.data.requests.find(r => r.ip === ip);
  if (existing) {
    return res.json({
      success: true,
      requestId: existing.id,
      message: 'Existing request found'
    });
  }

  const requestId = uuidv4();
  const newRequest = {
    id: requestId,
    botName,
    owner,
    ip,
    status: 'pending',
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };

  db.data.requests.push(newRequest);
  await db.write();

  io.emit('new-request', newRequest);
  res.json({ success: true, requestId });
});

// Admin approves request
app.post('/api/approve', authenticate, async (req, res) => {
  const { requestId } = req.body;
  
  const request = db.data.requests.find(r => r.id === requestId);
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  request.status = 'approved';
  request.approvedAt = new Date().toISOString();
  
  db.data.approved.push(request);
  db.data.requests = db.data.requests.filter(r => r.id !== requestId);
  
  // Add to active bots
  db.data.activeBots.push({
    id: requestId,
    botName: request.botName,
    ip: request.ip,
    lastActive: new Date().toISOString()
  });

  await db.write();

  io.emit('request-approved', request);
  io.emit('active-bots', db.data.activeBots);
  res.json({ success: true });
});

// Admin rejects request
app.post('/api/reject', authenticate, async (req, res) => {
  const { requestId } = req.body;
  
  const request = db.data.requests.find(r => r.id === requestId);
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  request.status = 'rejected';
  request.rejectedAt = new Date().toISOString();
  
  db.data.rejected.push(request);
  db.data.requests = db.data.requests.filter(r => r.id !== requestId);
  await db.write();

  io.emit('request-rejected', request);
  res.json({ success: true });
});

// Bot checks permission
app.get('/api/check', async (req, res) => {
  const { ip, authKey } = req.query;
  
  if (authKey !== db.data.settings.authKey) {
    return res.json({ valid: false, message: 'Invalid auth key' });
  }

  const isApproved = db.data.activeBots.some(bot => bot.ip === ip);
  
  if (isApproved) {
    // Update last active time
    const bot = db.data.activeBots.find(b => b.ip === ip);
    if (bot) {
      bot.lastActive = new Date().toISOString();
      await db.write();
      io.emit('active-bots', db.data.activeBots);
    }
  }

  res.json({ valid: isApproved });
});

// Get all data
app.get('/api/data', authenticate, (req, res) => {
  res.json(db.data);
});

// Bot sends heartbeat
app.post('/api/heartbeat', async (req, res) => {
  const { ip, authKey } = req.body;
  
  if (authKey !== db.data.settings.authKey) {
    return res.status(401).json({ success: false });
  }

  const bot = db.data.activeBots.find(b => b.ip === ip);
  if (bot) {
    bot.lastActive = new Date().toISOString();
    await db.write();
    io.emit('active-bots', db.data.activeBots);
  }

  res.json({ success: true });
});

// Cleanup inactive bots
setInterval(async () => {
  const now = new Date();
  const inactiveBots = db.data.activeBots.filter(bot => {
    const lastActive = new Date(bot.lastActive);
    return (now - lastActive) > 5 * 60 * 1000; // 5 minutes inactive
  });

  if (inactiveBots.length > 0) {
    db.data.activeBots = db.data.activeBots.filter(bot => {
      return !inactiveBots.some(b => b.id === bot.id);
    });
    
    await db.write();
    io.emit('active-bots', db.data.activeBots);
    console.log(`Cleaned up ${inactiveBots.length} inactive bots`);
  }
}, 60 * 1000); // Check every minute

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile('admin.html', { root: 'public' });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});