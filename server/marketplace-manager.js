const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * MarketplaceManager - Sistema per condivisione e download di agents e workflows
 *
 * Features:
 * - Pubblicazione di agents e workflows con metadata
 * - Ricerca e filtri per categoria, tags, rating
 * - Sistema di rating e recensioni
 * - Featured items
 * - Statistiche downloads e popularity
 * - Installazione locale di items dal marketplace
 */
class MarketplaceManager {
    constructor(workspaceRoot, agentManager, workflowManager) {
        this.workspaceRoot = workspaceRoot;
        this.agentManager = agentManager;
        this.workflowManager = workflowManager;

        this.marketplaceDir = path.join(workspaceRoot, '.mossab', 'marketplace');
        this.publishedDir = path.join(this.marketplaceDir, 'published');
        this.installedDir = path.join(this.marketplaceDir, 'installed');

        this.items = new Map(); // id -> item
        this.reviews = new Map(); // itemId -> [reviews]
    }

    async initialize() {
        console.log('🛍️  MarketplaceManager initializing...');

        // Create directories
        await fs.mkdir(this.publishedDir, { recursive: true });
        await fs.mkdir(this.installedDir, { recursive: true });

        // Load published items
        await this.loadPublishedItems();

        // Load reviews
        await this.loadReviews();

        const stats = {
            total: this.items.size,
            agents: Array.from(this.items.values()).filter(i => i.type === 'agent').length,
            workflows: Array.from(this.items.values()).filter(i => i.type === 'workflow').length
        };

        console.log('🛍️  MarketplaceManager initialized');
        return stats;
    }

    async loadPublishedItems() {
        try {
            const files = await fs.readdir(this.publishedDir);
            const jsonFiles = files.filter(f => f.endsWith('.json'));

            for (const file of jsonFiles) {
                try {
                    const content = await fs.readFile(
                        path.join(this.publishedDir, file),
                        'utf-8'
                    );
                    const item = JSON.parse(content);
                    this.items.set(item.id, item);
                } catch (error) {
                    console.warn(`Failed to load marketplace item ${file}:`, error.message);
                }
            }
        } catch (error) {
            console.warn('Failed to load published items:', error.message);
        }
    }

    async loadReviews() {
        try {
            const reviewsFile = path.join(this.marketplaceDir, 'reviews.json');
            const content = await fs.readFile(reviewsFile, 'utf-8');
            const reviewsData = JSON.parse(content);

            for (const [itemId, reviews] of Object.entries(reviewsData)) {
                this.reviews.set(itemId, reviews);
            }
        } catch (error) {
            // Reviews file doesn't exist yet, that's ok
        }
    }

    async saveReviews() {
        const reviewsData = Object.fromEntries(this.reviews);
        const reviewsFile = path.join(this.marketplaceDir, 'reviews.json');
        await fs.writeFile(reviewsFile, JSON.stringify(reviewsData, null, 2));
    }

    /**
     * Pubblica un agent o workflow nel marketplace
     */
    async publish(config) {
        const id = crypto.randomBytes(16).toString('hex');
        const now = new Date().toISOString();

        // Validate type
        if (!['agent', 'workflow'].includes(config.type)) {
            throw new Error('Type must be "agent" or "workflow"');
        }

        // Validate item exists
        if (config.type === 'agent') {
            const agent = this.agentManager.getAgent(config.name);
            if (!agent) {
                throw new Error(`Agent "${config.name}" not found`);
            }
        } else if (config.type === 'workflow') {
            const workflow = this.workflowManager.getWorkflow(config.name);
            if (!workflow) {
                throw new Error(`Workflow "${config.name}" not found`);
            }
        }

        const item = {
            id,
            type: config.type,
            name: config.name,
            displayName: config.displayName || config.name,
            description: config.description || '',
            author: config.author || 'Anonymous',
            version: config.version || '1.0.0',
            tags: config.tags || [],
            category: config.category || 'general',

            // Content (actual agent/workflow config)
            content: config.content,

            // Metadata
            featured: config.featured || false,
            license: config.license || 'MIT',
            repository: config.repository || null,

            // Stats
            downloads: 0,
            rating: 0,
            reviewCount: 0,

            // Timestamps
            publishedAt: now,
            updatedAt: now
        };

        // Save to disk
        const filePath = path.join(this.publishedDir, `${id}.json`);
        await fs.writeFile(filePath, JSON.stringify(item, null, 2));

        this.items.set(id, item);

        return {
            success: true,
            item
        };
    }

    /**
     * Aggiorna un item esistente
     */
    async update(itemId, updates) {
        const item = this.items.get(itemId);
        if (!item) {
            throw new Error('Item not found');
        }

        // Update allowed fields
        const allowedUpdates = ['displayName', 'description', 'tags', 'category', 'content', 'version', 'featured', 'repository'];
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                item[key] = updates[key];
            }
        }

        item.updatedAt = new Date().toISOString();

        // Save to disk
        const filePath = path.join(this.publishedDir, `${itemId}.json`);
        await fs.writeFile(filePath, JSON.stringify(item, null, 2));

        return {
            success: true,
            item
        };
    }

    /**
     * Elimina un item dal marketplace
     */
    async unpublish(itemId) {
        const item = this.items.get(itemId);
        if (!item) {
            throw new Error('Item not found');
        }

        // Delete file
        const filePath = path.join(this.publishedDir, `${itemId}.json`);
        await fs.unlink(filePath);

        this.items.delete(itemId);

        // Delete reviews
        this.reviews.delete(itemId);
        await this.saveReviews();

        return {
            success: true,
            message: 'Item unpublished successfully'
        };
    }

    /**
     * Lista tutti gli items con filtri
     */
    async list(filters = {}) {
        let items = Array.from(this.items.values());

        // Filter by type
        if (filters.type) {
            items = items.filter(item => item.type === filters.type);
        }

        // Filter by category
        if (filters.category) {
            items = items.filter(item => item.category === filters.category);
        }

        // Filter by tags
        if (filters.tags && filters.tags.length > 0) {
            items = items.filter(item =>
                filters.tags.some(tag => item.tags.includes(tag))
            );
        }

        // Filter by featured
        if (filters.featured === true) {
            items = items.filter(item => item.featured);
        }

        // Search by query
        if (filters.query) {
            const query = filters.query.toLowerCase();
            items = items.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.displayName.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query) ||
                item.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        // Sort
        const sortBy = filters.sortBy || 'publishedAt';
        const sortOrder = filters.sortOrder || 'desc';

        items.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];

            if (sortBy === 'publishedAt' || sortBy === 'updatedAt') {
                aVal = new Date(aVal).getTime();
                bVal = new Date(bVal).getTime();
            }

            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        // Pagination
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        const paginatedItems = items.slice(startIndex, endIndex);

        return {
            success: true,
            items: paginatedItems,
            total: items.length,
            page,
            pages: Math.ceil(items.length / limit)
        };
    }

    /**
     * Ottieni dettagli di un singolo item
     */
    async getItem(itemId) {
        const item = this.items.get(itemId);
        if (!item) {
            throw new Error('Item not found');
        }

        // Include reviews
        const reviews = this.reviews.get(itemId) || [];

        return {
            success: true,
            item: {
                ...item,
                reviews
            }
        };
    }

    /**
     * Installa un item dal marketplace
     */
    async install(itemId) {
        const item = this.items.get(itemId);
        if (!item) {
            throw new Error('Item not found');
        }

        let result;

        if (item.type === 'agent') {
            // Install agent using AgentManager
            result = await this.agentManager.composeAgent(item.content);
        } else if (item.type === 'workflow') {
            // Install workflow using WorkflowManager
            result = await this.workflowManager.createWorkflow(item.content);
        }

        // Increment download count
        item.downloads++;
        item.updatedAt = new Date().toISOString();

        const filePath = path.join(this.publishedDir, `${itemId}.json`);
        await fs.writeFile(filePath, JSON.stringify(item, null, 2));

        // Track installation
        const installRecord = {
            itemId,
            itemName: item.name,
            itemType: item.type,
            installedAt: new Date().toISOString()
        };

        const installsFile = path.join(this.installedDir, 'installed.json');
        let installs = [];
        try {
            const content = await fs.readFile(installsFile, 'utf-8');
            installs = JSON.parse(content);
        } catch (error) {
            // File doesn't exist yet
        }

        installs.push(installRecord);
        await fs.writeFile(installsFile, JSON.stringify(installs, null, 2));

        return {
            success: true,
            message: `${item.type} "${item.name}" installed successfully`,
            result
        };
    }

    /**
     * Aggiungi una recensione
     */
    async addReview(itemId, review) {
        const item = this.items.get(itemId);
        if (!item) {
            throw new Error('Item not found');
        }

        // Validate rating
        if (review.rating < 1 || review.rating > 5) {
            throw new Error('Rating must be between 1 and 5');
        }

        const reviewObj = {
            id: crypto.randomBytes(8).toString('hex'),
            author: review.author || 'Anonymous',
            rating: review.rating,
            comment: review.comment || '',
            createdAt: new Date().toISOString()
        };

        // Add to reviews
        if (!this.reviews.has(itemId)) {
            this.reviews.set(itemId, []);
        }
        this.reviews.get(itemId).push(reviewObj);

        // Update item rating
        const reviews = this.reviews.get(itemId);
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        item.rating = Math.round(avgRating * 10) / 10; // Round to 1 decimal
        item.reviewCount = reviews.length;

        // Save
        await this.saveReviews();

        const filePath = path.join(this.publishedDir, `${itemId}.json`);
        await fs.writeFile(filePath, JSON.stringify(item, null, 2));

        return {
            success: true,
            review: reviewObj,
            newRating: item.rating
        };
    }

    /**
     * Ottieni categorie disponibili
     */
    getCategories() {
        return [
            { id: 'general', name: 'General', description: 'General purpose agents and workflows' },
            { id: 'security', name: 'Security', description: 'Security auditing and testing' },
            { id: 'testing', name: 'Testing', description: 'Test automation and coverage' },
            { id: 'performance', name: 'Performance', description: 'Performance optimization and profiling' },
            { id: 'documentation', name: 'Documentation', description: 'Documentation generation' },
            { id: 'database', name: 'Database', description: 'Database optimization and management' },
            { id: 'devops', name: 'DevOps', description: 'CI/CD and deployment automation' },
            { id: 'quality', name: 'Code Quality', description: 'Code quality and linting' },
            { id: 'monitoring', name: 'Monitoring', description: 'Monitoring and alerting' }
        ];
    }

    /**
     * Ottieni statistiche marketplace
     */
    getStats() {
        const items = Array.from(this.items.values());

        const stats = {
            total: items.length,
            agents: items.filter(i => i.type === 'agent').length,
            workflows: items.filter(i => i.type === 'workflow').length,
            featured: items.filter(i => i.featured).length,
            totalDownloads: items.reduce((sum, i) => sum + i.downloads, 0),
            avgRating: items.length > 0
                ? Math.round((items.reduce((sum, i) => sum + i.rating, 0) / items.length) * 10) / 10
                : 0,

            // By category
            byCategory: {},

            // Most popular
            mostDownloaded: items
                .sort((a, b) => b.downloads - a.downloads)
                .slice(0, 5)
                .map(i => ({ id: i.id, name: i.displayName, downloads: i.downloads })),

            // Top rated
            topRated: items
                .filter(i => i.reviewCount > 0)
                .sort((a, b) => b.rating - a.rating)
                .slice(0, 5)
                .map(i => ({ id: i.id, name: i.displayName, rating: i.rating, reviews: i.reviewCount }))
        };

        // Count by category
        for (const item of items) {
            stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;
        }

        return stats;
    }
}

module.exports = MarketplaceManager;
