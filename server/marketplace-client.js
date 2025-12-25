/**
 * Marketplace Client
 * Handles communication with remote Mossab Marketplace Server
 */

const fetch = require('node-fetch');

class MarketplaceClient {
  constructor(marketplaceUrl, apiKey = null) {
    this.baseUrl = marketplaceUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add API key if available
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      throw new Error(`Marketplace API error: ${error.message}`);
    }
  }

  // ============ PUBLIC METHODS (No auth required) ============

  async browse(filters = {}) {
    const params = new URLSearchParams();

    if (filters.type) params.append('type', filters.type);
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.order) params.append('order', filters.order);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);

    const query = params.toString();
    const endpoint = `/api/items${query ? '?' + query : ''}`;

    return await this.request(endpoint);
  }

  async getItem(id) {
    return await this.request(`/api/items/${id}`);
  }

  async download(id) {
    return await this.request(`/api/items/${id}/download`, {
      method: 'POST'
    });
  }

  async getStats() {
    return await this.request('/api/stats');
  }

  // ============ AUTHENTICATED METHODS (Require API key) ============

  async publish(itemData) {
    if (!this.apiKey) {
      throw new Error('API key required to publish items');
    }

    return await this.request('/api/items', {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  }

  async rate(itemId, rating, review = null) {
    if (!this.apiKey) {
      throw new Error('API key required to rate items');
    }

    return await this.request(`/api/items/${itemId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, review })
    });
  }

  async updateItem(id, updates) {
    if (!this.apiKey) {
      throw new Error('API key required to update items');
    }

    return await this.request(`/api/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteItem(id) {
    if (!this.apiKey) {
      throw new Error('API key required to delete items');
    }

    return await this.request(`/api/items/${id}`, {
      method: 'DELETE'
    });
  }

  async getMyProfile() {
    if (!this.apiKey) {
      throw new Error('API key required to get profile');
    }

    return await this.request('/api/users/me');
  }

  async getMyItems() {
    if (!this.apiKey) {
      throw new Error('API key required to get your items');
    }

    return await this.request('/api/users/me/items');
  }

  // ============ USER MANAGEMENT ============

  async register(username, email, password) {
    return await this.request('/api/users/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
  }

  async login(username, password) {
    return await this.request('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  // ============ HEALTH CHECK ============

  async healthCheck() {
    try {
      return await this.request('/health');
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = MarketplaceClient;
