// D.A.K MVP v3 - API Server
// Lean MVP Specification v1.4 FINAL

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

// Route imports
const authRoutes = require('./routes/auth');
const communityRoutes = require('./routes/communities');
const accessRoutes = require('./routes/access');
const eventRoutes = require('./routes/events');
const streamRoutes = require('./routes/streams');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const waitingListRoutes = require('./routes/waitingList');
const supportsRoutes = require('./routes/supports');

const app = express();
const PORT = process.env.PORT || 3000;

// Database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Make pool available to routes
app.locals.pool = pool;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting placeholder (for production)
// app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: 'mvp-v3',
    timestamp: new Date().toISOString() 
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/waiting-list', waitingListRoutes);
app.use('/api/supports', supportsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`D.A.K MVP v3 API running on port ${PORT}`);
});
