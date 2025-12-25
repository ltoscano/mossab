/**
 * Authentication Middleware
 */

function authMiddleware(db) {
  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required. Provide X-API-Key header.'
      });
    }

    const user = db.getUserByApiKey(apiKey);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    // Attach user to request
    req.user = user;
    next();
  };
}

function optionalAuth(db) {
  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (apiKey) {
      const user = db.getUserByApiKey(apiKey);
      if (user) {
        req.user = user;
      }
    }

    next();
  };
}

function adminOnly(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  next();
}

module.exports = {
  authMiddleware,
  optionalAuth,
  adminOnly
};
