const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html']
}));

// API Endpoints
app.post('/api/request-permission', (req, res) => {
  const { botName, owner } = req.body;
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  // Simpan ke database (dalam contoh ini kita simpan di memory)
  const requestId = `req-${Date.now()}`;
  const newRequest = {
    id: requestId,
    botName,
    owner,
    time: new Date().toISOString(),
    ip: clientIp,
    status: 'pending'
  };
  
  // Di sini seharusnya disimpan ke database
  // ...
  
  res.json({
    success: true,
    requestId,
    message: 'Permintaan izin telah diterima'
  });
});

app.post('/api/approve-request', (req, res) => {
  const { requestId } = req.body;
  
  // Di sini seharusnya update status di database
  // ...
  
  res.json({
    success: true,
    message: 'Permintaan telah disetujui'
  });
});

app.post('/api/reject-request', (req, res) => {
  const { requestId } = req.body;
  
  // Di sini seharusnya update status di database
  // ...
  
  res.json({
    success: true,
    message: 'Permintaan telah ditolak'
  });
});

app.post('/api/send-message', (req, res) => {
  const { requestId, message } = req.body;
  
  // Di sini seharusnya kirim pesan ke bot melalui mekanisme tertentu
  // ...
  
  res.json({
    success: true,
    message: 'Pesan telah dikirim ke bot'
  });
});

// Middleware khusus untuk menangani permintaan tanpa ekstensi .html
app.use((req, res, next) => {
  if (path.extname(req.path) === '') {
    const htmlPath = path.join(__dirname, 'public', req.path + '.html');
    
    fs.access(htmlPath, fs.constants.F_OK, (err) => {
      if (!err) {
        res.sendFile(htmlPath);
      } else {
        next();
      }
    });
  } else {
    next();
  }
});

// Handle all other routes by serving the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});