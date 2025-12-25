/**
 * Items Routes (Agents & Workflows)
 */

const express = require('express');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

function createItemsRouter(db) {
  const router = express.Router();

  // Get all items (public, with optional auth for personalization)
  router.get('/', optionalAuth(db), (req, res) => {
    try {
      const filters = {
        type: req.query.type, // 'agent' or 'workflow'
        category: req.query.category,
        search: req.query.search,
        sortBy: req.query.sortBy || 'created_at',
        order: req.query.order || 'DESC',
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0
      };

      const items = db.searchItems(filters);
      const total = db.db.prepare('SELECT COUNT(*) as count FROM items WHERE 1=1').get().count;

      res.json({
        success: true,
        items,
        pagination: {
          total,
          limit: filters.limit,
          offset: filters.offset,
          hasMore: filters.offset + filters.limit < total
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get single item by ID
  router.get('/:id', optionalAuth(db), (req, res) => {
    try {
      const item = db.getItemById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }

      // Get ratings
      const ratings = db.getItemRatings(item.id);

      // Get user's rating if authenticated
      let userRating = null;
      if (req.user) {
        userRating = db.getRating(item.id, req.user.id);
      }

      res.json({
        success: true,
        item,
        ratings,
        userRating
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Publish new item (requires auth)
  router.post('/', authMiddleware(db), (req, res) => {
    try {
      const { type, name, version, title, description, content, category, tags } = req.body;

      // Validation
      if (!type || !name || !version || !title || !description || !content) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: type, name, version, title, description, content'
        });
      }

      if (!['agent', 'workflow'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Type must be either "agent" or "workflow"'
        });
      }

      // Check if item already exists
      const existing = db.getItemByNameVersion(type, name, version);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: `${type} "${name}" version ${version} already exists`
        });
      }

      // Create item
      const item = db.createItem({
        type,
        name,
        version,
        author_id: req.user.id,
        author_name: req.user.username,
        title,
        description,
        content,
        category,
        tags
      });

      res.status(201).json({
        success: true,
        item,
        message: `${type} published successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Update item (requires auth, owner only)
  router.put('/:id', authMiddleware(db), (req, res) => {
    try {
      const item = db.getItemById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }

      // Check ownership
      if (item.author_id !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({
          success: false,
          error: 'You can only update your own items'
        });
      }

      const { title, description, category, tags } = req.body;

      const updatedItem = db.updateItem(item.id, {
        title,
        description,
        category,
        tags
      });

      res.json({
        success: true,
        item: updatedItem,
        message: 'Item updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Delete item (requires auth, owner only)
  router.delete('/:id', authMiddleware(db), (req, res) => {
    try {
      const item = db.getItemById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }

      // Check ownership
      if (item.author_id !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({
          success: false,
          error: 'You can only delete your own items'
        });
      }

      db.deleteItem(item.id);

      res.json({
        success: true,
        message: 'Item deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Download item (public, tracks downloads)
  router.post('/:id/download', optionalAuth(db), (req, res) => {
    try {
      const item = db.getItemById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }

      // Record download
      db.recordDownload(
        item.id,
        req.user?.id,
        req.ip,
        req.headers['user-agent']
      );

      res.json({
        success: true,
        item,
        message: 'Download successful'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Rate item (requires auth)
  router.post('/:id/rate', authMiddleware(db), (req, res) => {
    try {
      const item = db.getItemById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }

      const { rating, review } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: 'Rating must be between 1 and 5'
        });
      }

      const userRating = db.createRating(item.id, req.user.id, rating, review);

      res.json({
        success: true,
        rating: userRating,
        message: 'Rating submitted successfully'
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

module.exports = createItemsRouter;
