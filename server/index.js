const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'SecureGate API' });
});

// Placeholder route imports (to be implemented)
// const authRoutes = require('./routes/auth');
// const visitorRoutes = require('./routes/visitors');
// const notificationRoutes = require('./routes/notifications');
// const analyticsRoutes = require('./routes/analytics');

// app.use('/api/auth', authRoutes);
// app.use('/api/visitors', visitorRoutes);
// app.use('/api/notifications', notificationRoutes);
// app.use('/api/analytics', analyticsRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Join room based on role
  socket.on('join:room', (room) => {
    socket.join(room);
    console.log(`${socket.id} joined room: ${room}`);
  });

  // Visitor approval events
  socket.on('visitor:approve', (data) => {
    io.to(`guard:${data.gate}`).emit('visitor:approved', data);
  });

  socket.on('visitor:reject', (data) => {
    io.to(`guard:${data.gate}`).emit('visitor:rejected', data);
  });

  // Chat messages
  socket.on('chat:message', (data) => {
    io.to(`visit:${data.visitorId}`).emit('chat:message', data);
  });

  // Emergency alert
  socket.on('emergency:alert', (data) => {
    io.emit('emergency:alert', data);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`SecureGate API running on port ${PORT}`);
});
