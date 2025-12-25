/**
 * Marketplace Database Model
 * Uses SQLite for simplicity - can be migrated to PostgreSQL
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class MarketplaceDB {
  constructor(dbPath = null) {
    // Default database location
    const defaultPath = path.join(__dirname, '../data/marketplace.db');
    this.dbPath = dbPath || defaultPath;

    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL'); // Better performance

    this.initializeTables();
  }

  initializeTables() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Items table (agents and workflows)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('agent', 'workflow')),
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        author_id INTEGER NOT NULL,
        author_name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        tags TEXT,
        downloads INTEGER DEFAULT 0,
        rating_avg REAL DEFAULT 0,
        rating_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id),
        UNIQUE(type, name, version)
      )
    `);

    // Ratings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        review TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(item_id, user_id)
      )
    `);

    // Downloads table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        user_id INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
      CREATE INDEX IF NOT EXISTS idx_items_author ON items(author_id);
      CREATE INDEX IF NOT EXISTS idx_items_downloads ON items(downloads DESC);
      CREATE INDEX IF NOT EXISTS idx_items_rating ON items(rating_avg DESC);
      CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ratings_item ON ratings(item_id);
      CREATE INDEX IF NOT EXISTS idx_downloads_item ON downloads(item_id);
    `);

    console.log('✅ Database tables initialized');
  }

  // ============ USER METHODS ============

  createUser(username, email, password) {
    const bcrypt = require('bcrypt');
    const passwordHash = bcrypt.hashSync(password, 10);
    const apiKey = this.generateApiKey();

    const stmt = this.db.prepare(`
      INSERT INTO users (username, email, password_hash, api_key)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(username, email, passwordHash, apiKey);

    return {
      id: result.lastInsertRowid,
      username,
      email,
      api_key: apiKey
    };
  }

  getUserByApiKey(apiKey) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE api_key = ?');
    return stmt.get(apiKey);
  }

  getUserById(id) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  }

  getUserByUsername(username) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  verifyPassword(username, password) {
    const user = this.getUserByUsername(username);
    if (!user) return null;

    const bcrypt = require('bcrypt');
    const isValid = bcrypt.compareSync(password, user.password_hash);

    return isValid ? user : null;
  }

  generateApiKey() {
    return 'mossab_' + crypto.randomBytes(32).toString('hex');
  }

  // ============ ITEM METHODS ============

  createItem(data) {
    const stmt = this.db.prepare(`
      INSERT INTO items (
        type, name, version, author_id, author_name,
        title, description, content, category, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tags = Array.isArray(data.tags) ? data.tags.join(',') : data.tags;

    const result = stmt.run(
      data.type,
      data.name,
      data.version,
      data.author_id,
      data.author_name,
      data.title,
      data.description,
      JSON.stringify(data.content),
      data.category || null,
      tags || null
    );

    return this.getItemById(result.lastInsertRowid);
  }

  getItemById(id) {
    const stmt = this.db.prepare('SELECT * FROM items WHERE id = ?');
    const item = stmt.get(id);

    if (item) {
      item.content = JSON.parse(item.content);
      item.tags = item.tags ? item.tags.split(',') : [];
    }

    return item;
  }

  getItemByNameVersion(type, name, version) {
    const stmt = this.db.prepare(`
      SELECT * FROM items
      WHERE type = ? AND name = ? AND version = ?
    `);
    const item = stmt.get(type, name, version);

    if (item) {
      item.content = JSON.parse(item.content);
      item.tags = item.tags ? item.tags.split(',') : [];
    }

    return item;
  }

  searchItems(filters = {}) {
    let query = 'SELECT * FROM items WHERE 1=1';
    const params = [];

    if (filters.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }

    if (filters.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.search) {
      query += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.author_id) {
      query += ' AND author_id = ?';
      params.push(filters.author_id);
    }

    // Sorting
    const sortBy = filters.sortBy || 'created_at';
    const order = filters.order || 'DESC';
    query += ` ORDER BY ${sortBy} ${order}`;

    // Pagination
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const items = stmt.all(...params);

    // Parse content and tags
    items.forEach(item => {
      item.content = JSON.parse(item.content);
      item.tags = item.tags ? item.tags.split(',') : [];
    });

    return items;
  }

  updateItem(id, updates) {
    const fields = [];
    const params = [];

    if (updates.title) {
      fields.push('title = ?');
      params.push(updates.title);
    }
    if (updates.description) {
      fields.push('description = ?');
      params.push(updates.description);
    }
    if (updates.category) {
      fields.push('category = ?');
      params.push(updates.category);
    }
    if (updates.tags) {
      fields.push('tags = ?');
      params.push(Array.isArray(updates.tags) ? updates.tags.join(',') : updates.tags);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const query = `UPDATE items SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(query);
    stmt.run(...params);

    return this.getItemById(id);
  }

  deleteItem(id) {
    const stmt = this.db.prepare('DELETE FROM items WHERE id = ?');
    return stmt.run(id);
  }

  incrementDownloads(itemId) {
    const stmt = this.db.prepare(`
      UPDATE items SET downloads = downloads + 1 WHERE id = ?
    `);
    stmt.run(itemId);
  }

  // ============ RATING METHODS ============

  createRating(itemId, userId, rating, review = null) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ratings (item_id, user_id, rating, review)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(itemId, userId, rating, review);

    // Update item's rating average
    this.updateItemRating(itemId);

    return this.getRating(itemId, userId);
  }

  getRating(itemId, userId) {
    const stmt = this.db.prepare(`
      SELECT * FROM ratings WHERE item_id = ? AND user_id = ?
    `);
    return stmt.get(itemId, userId);
  }

  getItemRatings(itemId) {
    const stmt = this.db.prepare(`
      SELECT r.*, u.username
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE r.item_id = ?
      ORDER BY r.created_at DESC
    `);
    return stmt.all(itemId);
  }

  updateItemRating(itemId) {
    const stmt = this.db.prepare(`
      SELECT AVG(rating) as avg, COUNT(*) as count
      FROM ratings WHERE item_id = ?
    `);
    const result = stmt.get(itemId);

    const updateStmt = this.db.prepare(`
      UPDATE items
      SET rating_avg = ?, rating_count = ?
      WHERE id = ?
    `);
    updateStmt.run(result.avg || 0, result.count || 0, itemId);
  }

  // ============ DOWNLOAD METHODS ============

  recordDownload(itemId, userId = null, ipAddress = null, userAgent = null) {
    const stmt = this.db.prepare(`
      INSERT INTO downloads (item_id, user_id, ip_address, user_agent)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(itemId, userId, ipAddress, userAgent);
    this.incrementDownloads(itemId);
  }

  getDownloadStats(itemId) {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM downloads WHERE item_id = ?
    `);
    return stmt.get(itemId);
  }

  // ============ STATS METHODS ============

  getStats() {
    const stats = {
      users: this.db.prepare('SELECT COUNT(*) as count FROM users').get().count,
      items: this.db.prepare('SELECT COUNT(*) as count FROM items').get().count,
      agents: this.db.prepare("SELECT COUNT(*) as count FROM items WHERE type = 'agent'").get().count,
      workflows: this.db.prepare("SELECT COUNT(*) as count FROM items WHERE type = 'workflow'").get().count,
      downloads: this.db.prepare('SELECT SUM(downloads) as total FROM items').get().total || 0
    };

    return stats;
  }

  close() {
    this.db.close();
  }
}

module.exports = MarketplaceDB;
