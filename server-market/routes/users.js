/**
 * Users Routes
 */

const express = require('express');
const { authMiddleware, adminOnly } = require('../middleware/auth');

function createUsersRouter(db) {
  const router = express.Router();

  // Register new user
  router.post('/register', (req, res) => {
    try {
      const { username, email, password } = req.body;

      // Validation
      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username, email, and password are required'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters'
        });
      }

      // Check if user exists
      const existing = db.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Username already exists'
        });
      }

      // Create user
      const user = db.createUser(username, email, password);

      res.status(201).json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          api_key: user.api_key
        },
        message: 'User registered successfully. Save your API key!'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Login (get API key)
  router.post('/login', (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required'
        });
      }

      const user = db.verifyPassword(username, password);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid username or password'
        });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          api_key: user.api_key
        },
        message: 'Login successful'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get current user profile (requires auth)
  router.get('/me', authMiddleware(db), (req, res) => {
    try {
      // Get user's published items
      const items = db.searchItems({ author_id: req.user.id, limit: 100 });

      res.json({
        success: true,
        user: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          is_admin: req.user.is_admin,
          created_at: req.user.created_at
        },
        stats: {
          published_items: items.length,
          total_downloads: items.reduce((sum, item) => sum + item.downloads, 0)
        },
        items
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get user's published items
  router.get('/me/items', authMiddleware(db), (req, res) => {
    try {
      const items = db.searchItems({
        author_id: req.user.id,
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      });

      res.json({
        success: true,
        items
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

module.exports = createUsersRouter;
