/**
 * Marketplace UI - Interfaccia per browse, search e installazione di agents/workflows
 */
class MarketplaceUI {
    constructor() {
        this.items = [];
        this.categories = [];
        this.stats = {};
        this.currentFilters = {
            type: '',
            category: '',
            query: '',
            featured: false,
            sortBy: 'publishedAt',
            sortOrder: 'desc',
            page: 1
        };

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Marketplace modal toggle
        const openBtn = document.querySelector('[data-action="open-marketplace"]');
        if (openBtn) {
            openBtn.addEventListener('click', () => this.openModal());
        }

        // Close modal
        const closeBtn = document.querySelector('.marketplace-modal .modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Tab navigation
        const tabs = document.querySelectorAll('.marketplace-modal .modal-tabs button');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Filters
        document.getElementById('marketplaceTypeFilter')?.addEventListener('change', (e) => {
            this.currentFilters.type = e.target.value;
            this.currentFilters.page = 1;
            this.loadItems();
        });

        document.getElementById('marketplaceCategoryFilter')?.addEventListener('change', (e) => {
            this.currentFilters.category = e.target.value;
            this.currentFilters.page = 1;
            this.loadItems();
        });

        document.getElementById('marketplaceFeaturedFilter')?.addEventListener('change', (e) => {
            this.currentFilters.featured = e.target.checked;
            this.currentFilters.page = 1;
            this.loadItems();
        });

        document.getElementById('marketplaceSearchInput')?.addEventListener('input', (e) => {
            this.currentFilters.query = e.target.value;
            this.currentFilters.page = 1;
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.loadItems(), 300);
        });

        document.getElementById('marketplaceSortBy')?.addEventListener('change', (e) => {
            this.currentFilters.sortBy = e.target.value;
            this.loadItems();
        });

        // Publish form
        document.getElementById('publishItemForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.publishItem();
        });
    }

    async openModal() {
        const modal = document.querySelector('.marketplace-modal');
        if (modal) {
            modal.classList.remove('hidden');
            await this.loadCategories();
            await this.loadStats();
            await this.loadItems();
        }
    }

    closeModal() {
        const modal = document.querySelector('.marketplace-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        const tabs = document.querySelectorAll('.marketplace-modal .modal-tabs button');
        tabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update tab contents
        const contents = document.querySelectorAll('.marketplace-modal .tab-content');
        contents.forEach(content => {
            if (content.id === `marketplace-${tabName}`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        // Load data for specific tabs
        if (tabName === 'browse') {
            this.loadItems();
        } else if (tabName === 'stats') {
            this.renderStats();
        }
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/marketplace/categories');
            const data = await response.json();

            if (data.success) {
                this.categories = data.categories;
                this.renderCategoryFilter();
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    renderCategoryFilter() {
        const filter = document.getElementById('marketplaceCategoryFilter');
        if (!filter) return;

        filter.innerHTML = '<option value="">All Categories</option>';

        for (const category of this.categories) {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            filter.appendChild(option);
        }
    }

    async loadStats() {
        try {
            const response = await fetch('/api/marketplace/stats');
            const data = await response.json();

            if (data.success) {
                this.stats = data.stats;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async loadItems() {
        try {
            const queryParams = new URLSearchParams();

            if (this.currentFilters.type) queryParams.set('type', this.currentFilters.type);
            if (this.currentFilters.category) queryParams.set('category', this.currentFilters.category);
            if (this.currentFilters.query) queryParams.set('query', this.currentFilters.query);
            if (this.currentFilters.featured) queryParams.set('featured', 'true');
            queryParams.set('sortBy', this.currentFilters.sortBy);
            queryParams.set('sortOrder', this.currentFilters.sortOrder);
            queryParams.set('page', this.currentFilters.page);

            const response = await fetch(`/api/marketplace/items?${queryParams}`);
            const data = await response.json();

            if (data.success) {
                this.items = data.items;
                this.renderItems(data);
            }
        } catch (error) {
            console.error('Error loading items:', error);
            this.showToast('Failed to load marketplace items', 'error');
        }
    }

    renderItems(data) {
        const container = document.getElementById('marketplaceItemsGrid');
        if (!container) return;

        if (data.items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No items found</p>
                    <p class="text-secondary">Try adjusting your filters</p>
                </div>
            `;
            return;
        }

        container.innerHTML = data.items.map(item => this.createItemCard(item)).join('');

        // Add event listeners to install buttons
        container.querySelectorAll('[data-action="install"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.dataset.itemId;
                this.installItem(itemId);
            });
        });

        // Add event listeners to view details buttons
        container.querySelectorAll('[data-action="view-details"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.dataset.itemId;
                this.viewItemDetails(itemId);
            });
        });

        // Render pagination
        this.renderPagination(data);
    }

    createItemCard(item) {
        const typeIcon = item.type === 'agent' ? '🤖' : '⚙️';
        const featuredBadge = item.featured ? '<span class="badge badge-featured">Featured</span>' : '';
        const stars = '★'.repeat(Math.round(item.rating)) + '☆'.repeat(5 - Math.round(item.rating));

        return `
            <div class="marketplace-item-card" data-item-id="${item.id}">
                <div class="item-header">
                    <span class="item-icon">${typeIcon}</span>
                    <div class="item-type-badge ${item.type}">${item.type}</div>
                    ${featuredBadge}
                </div>

                <h3 class="item-title">${this.escapeHtml(item.displayName)}</h3>
                <p class="item-description">${this.escapeHtml(item.description)}</p>

                <div class="item-meta">
                    <span class="item-author">by ${this.escapeHtml(item.author)}</span>
                    <span class="item-version">v${item.version}</span>
                </div>

                <div class="item-category">
                    <span class="category-badge">${item.category}</span>
                </div>

                ${item.tags.length > 0 ? `
                    <div class="item-tags">
                        ${item.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}

                <div class="item-stats">
                    <span class="stat">
                        <span class="stat-icon">⭐</span>
                        <span class="stat-value">${item.rating.toFixed(1)}</span>
                        <span class="stat-label">(${item.reviewCount})</span>
                    </span>
                    <span class="stat">
                        <span class="stat-icon">📥</span>
                        <span class="stat-value">${item.downloads}</span>
                    </span>
                </div>

                <div class="item-actions">
                    <button class="btn btn-primary" data-action="install" data-item-id="${item.id}">
                        Install
                    </button>
                    <button class="btn btn-secondary" data-action="view-details" data-item-id="${item.id}">
                        Details
                    </button>
                </div>
            </div>
        `;
    }

    renderPagination(data) {
        const container = document.getElementById('marketplacePagination');
        if (!container) return;

        if (data.pages <= 1) {
            container.innerHTML = '';
            return;
        }

        const buttons = [];

        // Previous button
        if (data.page > 1) {
            buttons.push(`<button class="btn btn-secondary" data-page="${data.page - 1}">← Previous</button>`);
        }

        // Page info
        buttons.push(`<span class="pagination-info">Page ${data.page} of ${data.pages}</span>`);

        // Next button
        if (data.page < data.pages) {
            buttons.push(`<button class="btn btn-secondary" data-page="${data.page + 1}">Next →</button>`);
        }

        container.innerHTML = buttons.join('');

        // Add event listeners
        container.querySelectorAll('[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentFilters.page = parseInt(btn.dataset.page);
                this.loadItems();
            });
        });
    }

    async installItem(itemId) {
        try {
            const response = await fetch(`/api/marketplace/install/${itemId}`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.showToast(data.message, 'success');
                await this.loadItems(); // Refresh to update download count
            } else {
                this.showToast(data.error || 'Installation failed', 'error');
            }
        } catch (error) {
            console.error('Error installing item:', error);
            this.showToast('Failed to install item', 'error');
        }
    }

    async viewItemDetails(itemId) {
        try {
            const response = await fetch(`/api/marketplace/items/${itemId}`);
            const data = await response.json();

            if (data.success) {
                this.showItemDetailsModal(data.item);
            }
        } catch (error) {
            console.error('Error loading item details:', error);
            this.showToast('Failed to load item details', 'error');
        }
    }

    showItemDetailsModal(item) {
        // Create and show a modal with full item details
        const modalHtml = `
            <div class="item-details-modal" id="itemDetailsModal">
                <div class="modal-overlay" onclick="document.getElementById('itemDetailsModal').remove()"></div>
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h2>${this.escapeHtml(item.displayName)}</h2>
                        <button class="modal-close" onclick="document.getElementById('itemDetailsModal').remove()">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="item-details-content">
                            <p>${this.escapeHtml(item.description)}</p>

                            <div class="details-section">
                                <h3>Information</h3>
                                <ul>
                                    <li><strong>Type:</strong> ${item.type}</li>
                                    <li><strong>Author:</strong> ${this.escapeHtml(item.author)}</li>
                                    <li><strong>Version:</strong> ${item.version}</li>
                                    <li><strong>Category:</strong> ${item.category}</li>
                                    <li><strong>License:</strong> ${item.license}</li>
                                    <li><strong>Downloads:</strong> ${item.downloads}</li>
                                    <li><strong>Rating:</strong> ${item.rating.toFixed(1)} (${item.reviewCount} reviews)</li>
                                </ul>
                            </div>

                            ${item.reviews && item.reviews.length > 0 ? `
                                <div class="details-section">
                                    <h3>Reviews</h3>
                                    <div class="reviews-list">
                                        ${item.reviews.slice(0, 5).map(review => `
                                            <div class="review">
                                                <div class="review-header">
                                                    <span class="review-author">${this.escapeHtml(review.author)}</span>
                                                    <span class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
                                                </div>
                                                <p class="review-comment">${this.escapeHtml(review.comment)}</p>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="marketplaceUI.installItem('${item.id}'); document.getElementById('itemDetailsModal').remove();">
                            Install
                        </button>
                        <button class="btn btn-secondary" onclick="document.getElementById('itemDetailsModal').remove()">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    async publishItem() {
        const form = document.getElementById('publishItemForm');
        if (!form) return;

        const formData = new FormData(form);

        const itemData = {
            type: formData.get('type'),
            name: formData.get('name'),
            displayName: formData.get('displayName'),
            description: formData.get('description'),
            author: formData.get('author'),
            version: formData.get('version'),
            category: formData.get('category'),
            tags: formData.get('tags').split(',').map(t => t.trim()).filter(t => t),
            license: formData.get('license'),
            featured: formData.get('featured') === 'on',
            content: {} // This should be populated with actual agent/workflow config
        };

        try {
            // First, get the actual agent or workflow config
            let configResponse;
            if (itemData.type === 'agent') {
                configResponse = await fetch(`/api/agents/${itemData.name}`);
            } else {
                configResponse = await fetch(`/api/workflows/${itemData.name}`);
            }

            if (!configResponse.ok) {
                throw new Error(`${itemData.type} "${itemData.name}" not found`);
            }

            const configData = await configResponse.json();
            itemData.content = configData.success ? configData.agent || configData.workflow : {};

            // Publish to marketplace
            const response = await fetch('/api/marketplace/publish', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Item published successfully!', 'success');
                form.reset();
                this.switchTab('browse');
                await this.loadItems();
            } else {
                this.showToast(data.error || 'Publication failed', 'error');
            }
        } catch (error) {
            console.error('Error publishing item:', error);
            this.showToast(error.message || 'Failed to publish item', 'error');
        }
    }

    renderStats() {
        const container = document.getElementById('marketplaceStatsContent');
        if (!container) return;

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${this.stats.total || 0}</div>
                    <div class="stat-label">Total Items</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.stats.agents || 0}</div>
                    <div class="stat-label">Agents</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.stats.workflows || 0}</div>
                    <div class="stat-label">Workflows</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.stats.featured || 0}</div>
                    <div class="stat-label">Featured</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.stats.totalDownloads || 0}</div>
                    <div class="stat-label">Total Downloads</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.stats.avgRating ? this.stats.avgRating.toFixed(1) : '0.0'}</div>
                    <div class="stat-label">Avg Rating</div>
                </div>
            </div>

            ${this.stats.mostDownloaded && this.stats.mostDownloaded.length > 0 ? `
                <div class="stats-section">
                    <h3>Most Downloaded</h3>
                    <div class="top-items-list">
                        ${this.stats.mostDownloaded.map((item, index) => `
                            <div class="top-item">
                                <span class="top-item-rank">${index + 1}</span>
                                <span class="top-item-name">${this.escapeHtml(item.name)}</span>
                                <span class="top-item-value">📥 ${item.downloads}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${this.stats.topRated && this.stats.topRated.length > 0 ? `
                <div class="stats-section">
                    <h3>Top Rated</h3>
                    <div class="top-items-list">
                        ${this.stats.topRated.map((item, index) => `
                            <div class="top-item">
                                <span class="top-item-rank">${index + 1}</span>
                                <span class="top-item-name">${this.escapeHtml(item.name)}</span>
                                <span class="top-item-value">⭐ ${item.rating.toFixed(1)} (${item.reviews})</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} show`;
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize on page load
let marketplaceUI;
document.addEventListener('DOMContentLoaded', () => {
    marketplaceUI = new MarketplaceUI();
});
