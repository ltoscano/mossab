#!/usr/bin/env node

/**
 * Mossab Marketplace Server
 * Central community repository for agents and workflows
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const MarketplaceDB = require('./models/database');
const createItemsRouter = require('./routes/items');
const createUsersRouter = require('./routes/users');

const app = express();
const PORT = process.env.MARKETPLACE_PORT || process.env.PORT || 4000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data/marketplace.db');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize database
console.log('🔄 Initializing database...');
const db = new MarketplaceDB(DB_PATH);
console.log(`✅ Database ready at: ${DB_PATH}`);

// Routes
app.use('/api/items', createItemsRouter(db));
app.use('/api/users', createUsersRouter(db));

// Stats endpoint (public)
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Root info
app.get('/', (req, res) => {
  res.json({
    name: 'Mossab Marketplace Server',
    version: '1.0.0',
    description: 'Community marketplace for Mossab agents and workflows',
    endpoints: {
      items: '/api/items',
      users: '/api/users',
      stats: '/api/stats',
      health: '/health'
    },
    documentation: 'https://github.com/your-org/mossab-marketplace'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ============================================');
  console.log('   Mossab Marketplace Server');
  console.log('============================================');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`📁 Database: ${DB_PATH}`);
  console.log('');
  console.log('📚 API Endpoints:');
  console.log(`   - GET  /api/items          (Browse marketplace)`);
  console.log(`   - POST /api/items          (Publish item, requires auth)`);
  console.log(`   - GET  /api/items/:id      (Get item details)`);
  console.log(`   - POST /api/items/:id/download  (Download item)`);
  console.log(`   - POST /api/items/:id/rate (Rate item, requires auth)`);
  console.log(`   - POST /api/users/register (Register user)`);
  console.log(`   - POST /api/users/login    (Login/get API key)`);
  console.log(`   - GET  /api/users/me       (Get profile, requires auth)`);
  console.log(`   - GET  /api/stats          (Marketplace stats)`);
  console.log('');
  console.log('🔑 Authentication:');
  console.log('   - Include header: X-API-Key: your-api-key');
  console.log('   - Or: Authorization: Bearer your-api-key');
  console.log('');
  console.log('============================================');
  console.log('');
});

module.exports = app;
