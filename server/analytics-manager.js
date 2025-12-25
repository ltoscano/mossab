const fs = require('fs').promises;
const path = require('path');

/**
 * AnalyticsManager - Sistema di tracking e analytics per agents, workflows, webhooks e schedules
 *
 * Features:
 * - Tracking esecuzioni agents (successi, fallimenti, durate)
 * - Tracking esecuzioni workflows (step completati, errori)
 * - Tracking webhook triggers
 * - Tracking schedule executions
 * - Aggregazioni temporali (giornaliere, settimanali, mensili)
 * - Metriche: success rate, avg duration, error rate, usage trends
 * - Dashboard data export per visualizzazioni
 */
class AnalyticsManager {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;

        this.analyticsDir = path.join(workspaceRoot, '.mossab', 'analytics');
        this.eventsFile = path.join(this.analyticsDir, 'events.json');
        this.aggregationsFile = path.join(this.analyticsDir, 'aggregations.json');

        this.events = []; // Recent events (last 1000)
        this.aggregations = {
            daily: {},
            weekly: {},
            monthly: {}
        };

        // In-memory cache per performance
        this.cache = {
            agentStats: null,
            workflowStats: null,
            webhookStats: null,
            scheduleStats: null,
            lastUpdate: null
        };
    }

    async initialize() {
        console.log('📊 AnalyticsManager initializing...');

        // Create directory
        await fs.mkdir(this.analyticsDir, { recursive: true });

        // Load events
        await this.loadEvents();

        // Load aggregations
        await this.loadAggregations();

        // Build cache
        this.rebuildCache();

        console.log('📊 AnalyticsManager initialized');

        return {
            totalEvents: this.events.length,
            cacheReady: true
        };
    }

    async loadEvents() {
        try {
            const content = await fs.readFile(this.eventsFile, 'utf-8');
            this.events = JSON.parse(content);
        } catch (error) {
            // Events file doesn't exist yet
            this.events = [];
        }
    }

    async loadAggregations() {
        try {
            const content = await fs.readFile(this.aggregationsFile, 'utf-8');
            this.aggregations = JSON.parse(content);
        } catch (error) {
            // Aggregations file doesn't exist yet
            this.aggregations = {
                daily: {},
                weekly: {},
                monthly: {}
            };
        }
    }

    async saveEvents() {
        // Keep only last 1000 events
        if (this.events.length > 1000) {
            this.events = this.events.slice(-1000);
        }

        await fs.writeFile(this.eventsFile, JSON.stringify(this.events, null, 2));
    }

    async saveAggregations() {
        await fs.writeFile(this.aggregationsFile, JSON.stringify(this.aggregations, null, 2));
    }

    /**
     * Track agent execution
     */
    async trackAgentExecution(data) {
        const event = {
            id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'agent',
            agentName: data.agentName,
            agentType: data.agentType || 'custom', // builtin | custom
            status: data.status, // success | failure
            duration: data.duration || 0,
            error: data.error || null,
            context: data.context || {},
            timestamp: new Date().toISOString()
        };

        this.events.push(event);
        await this.saveEvents();

        // Update aggregations
        await this.updateAggregations(event);

        // Invalidate cache
        this.cache.agentStats = null;
        this.cache.lastUpdate = null;

        return event;
    }

    /**
     * Track workflow execution
     */
    async trackWorkflowExecution(data) {
        const event = {
            id: `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'workflow',
            workflowName: data.workflowName,
            status: data.status, // success | partial | failure
            stepsTotal: data.stepsTotal || 0,
            stepsCompleted: data.stepsCompleted || 0,
            stepsFailed: data.stepsFailed || 0,
            duration: data.duration || 0,
            error: data.error || null,
            context: data.context || {},
            timestamp: new Date().toISOString()
        };

        this.events.push(event);
        await this.saveEvents();

        // Update aggregations
        await this.updateAggregations(event);

        // Invalidate cache
        this.cache.workflowStats = null;
        this.cache.lastUpdate = null;

        return event;
    }

    /**
     * Track webhook trigger
     */
    async trackWebhookTrigger(data) {
        const event = {
            id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'webhook',
            webhookName: data.webhookName,
            webhookEvent: data.webhookEvent,
            status: data.status, // success | failure | skipped
            skipped: data.skipped || false,
            skipReason: data.skipReason || null,
            duration: data.duration || 0,
            error: data.error || null,
            timestamp: new Date().toISOString()
        };

        this.events.push(event);
        await this.saveEvents();

        // Update aggregations
        await this.updateAggregations(event);

        // Invalidate cache
        this.cache.webhookStats = null;
        this.cache.lastUpdate = null;

        return event;
    }

    /**
     * Track schedule execution
     */
    async trackScheduleExecution(data) {
        const event = {
            id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'schedule',
            scheduleName: data.scheduleName,
            scheduleType: data.scheduleType, // cron | interval
            status: data.status, // success | failure
            duration: data.duration || 0,
            error: data.error || null,
            timestamp: new Date().toISOString()
        };

        this.events.push(event);
        await this.saveEvents();

        // Update aggregations
        await this.updateAggregations(event);

        // Invalidate cache
        this.cache.scheduleStats = null;
        this.cache.lastUpdate = null;

        return event;
    }

    /**
     * Update aggregations
     */
    async updateAggregations(event) {
        const date = new Date(event.timestamp);

        // Daily key: YYYY-MM-DD
        const dailyKey = date.toISOString().split('T')[0];

        // Weekly key: YYYY-Www (ISO week)
        const weekNum = this.getWeekNumber(date);
        const weeklyKey = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

        // Monthly key: YYYY-MM
        const monthlyKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        // Initialize if needed
        if (!this.aggregations.daily[dailyKey]) {
            this.aggregations.daily[dailyKey] = this.createEmptyAggregation();
        }
        if (!this.aggregations.weekly[weeklyKey]) {
            this.aggregations.weekly[weeklyKey] = this.createEmptyAggregation();
        }
        if (!this.aggregations.monthly[monthlyKey]) {
            this.aggregations.monthly[monthlyKey] = this.createEmptyAggregation();
        }

        // Update all time periods
        for (const key of [dailyKey, weeklyKey, monthlyKey]) {
            const period = key === dailyKey ? 'daily' : key === weeklyKey ? 'weekly' : 'monthly';
            const agg = this.aggregations[period][key];

            // Update based on type
            if (event.type === 'agent') {
                agg.agents.total++;
                if (event.status === 'success') agg.agents.success++;
                else agg.agents.failure++;
                agg.agents.totalDuration += event.duration;
            } else if (event.type === 'workflow') {
                agg.workflows.total++;
                if (event.status === 'success') agg.workflows.success++;
                else if (event.status === 'partial') agg.workflows.partial++;
                else agg.workflows.failure++;
                agg.workflows.totalDuration += event.duration;
            } else if (event.type === 'webhook') {
                agg.webhooks.total++;
                if (event.status === 'success') agg.webhooks.success++;
                else if (event.status === 'skipped') agg.webhooks.skipped++;
                else agg.webhooks.failure++;
            } else if (event.type === 'schedule') {
                agg.schedules.total++;
                if (event.status === 'success') agg.schedules.success++;
                else agg.schedules.failure++;
            }
        }

        await this.saveAggregations();
    }

    createEmptyAggregation() {
        return {
            agents: { total: 0, success: 0, failure: 0, totalDuration: 0 },
            workflows: { total: 0, success: 0, partial: 0, failure: 0, totalDuration: 0 },
            webhooks: { total: 0, success: 0, skipped: 0, failure: 0 },
            schedules: { total: 0, success: 0, failure: 0 }
        };
    }

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    /**
     * Get agent statistics
     */
    getAgentStats(timeRange = 'all') {
        if (this.cache.agentStats && this.cache.lastUpdate) {
            const cacheAge = Date.now() - this.cache.lastUpdate;
            if (cacheAge < 30000) { // 30 seconds cache
                return this.cache.agentStats;
            }
        }

        const agentEvents = this.filterEventsByTimeRange(
            this.events.filter(e => e.type === 'agent'),
            timeRange
        );

        const stats = {
            total: agentEvents.length,
            success: agentEvents.filter(e => e.status === 'success').length,
            failure: agentEvents.filter(e => e.status === 'failure').length,
            successRate: 0,
            avgDuration: 0,

            // By agent
            byAgent: {},

            // Recent executions
            recent: agentEvents.slice(-10).reverse()
        };

        if (stats.total > 0) {
            stats.successRate = Math.round((stats.success / stats.total) * 100);
            const totalDuration = agentEvents.reduce((sum, e) => sum + (e.duration || 0), 0);
            stats.avgDuration = Math.round(totalDuration / stats.total);
        }

        // Group by agent
        for (const event of agentEvents) {
            if (!stats.byAgent[event.agentName]) {
                stats.byAgent[event.agentName] = {
                    total: 0,
                    success: 0,
                    failure: 0,
                    avgDuration: 0,
                    totalDuration: 0
                };
            }

            const agentStat = stats.byAgent[event.agentName];
            agentStat.total++;
            if (event.status === 'success') agentStat.success++;
            else agentStat.failure++;
            agentStat.totalDuration += event.duration || 0;
        }

        // Calculate averages
        for (const agentName in stats.byAgent) {
            const agentStat = stats.byAgent[agentName];
            if (agentStat.total > 0) {
                agentStat.avgDuration = Math.round(agentStat.totalDuration / agentStat.total);
            }
        }

        this.cache.agentStats = stats;
        this.cache.lastUpdate = Date.now();

        return stats;
    }

    /**
     * Get workflow statistics
     */
    getWorkflowStats(timeRange = 'all') {
        if (this.cache.workflowStats && this.cache.lastUpdate) {
            const cacheAge = Date.now() - this.cache.lastUpdate;
            if (cacheAge < 30000) {
                return this.cache.workflowStats;
            }
        }

        const workflowEvents = this.filterEventsByTimeRange(
            this.events.filter(e => e.type === 'workflow'),
            timeRange
        );

        const stats = {
            total: workflowEvents.length,
            success: workflowEvents.filter(e => e.status === 'success').length,
            partial: workflowEvents.filter(e => e.status === 'partial').length,
            failure: workflowEvents.filter(e => e.status === 'failure').length,
            successRate: 0,
            avgDuration: 0,

            // By workflow
            byWorkflow: {},

            // Recent executions
            recent: workflowEvents.slice(-10).reverse()
        };

        if (stats.total > 0) {
            stats.successRate = Math.round((stats.success / stats.total) * 100);
            const totalDuration = workflowEvents.reduce((sum, e) => sum + (e.duration || 0), 0);
            stats.avgDuration = Math.round(totalDuration / stats.total);
        }

        // Group by workflow
        for (const event of workflowEvents) {
            if (!stats.byWorkflow[event.workflowName]) {
                stats.byWorkflow[event.workflowName] = {
                    total: 0,
                    success: 0,
                    partial: 0,
                    failure: 0,
                    avgDuration: 0,
                    totalDuration: 0
                };
            }

            const workflowStat = stats.byWorkflow[event.workflowName];
            workflowStat.total++;
            if (event.status === 'success') workflowStat.success++;
            else if (event.status === 'partial') workflowStat.partial++;
            else workflowStat.failure++;
            workflowStat.totalDuration += event.duration || 0;
        }

        // Calculate averages
        for (const workflowName in stats.byWorkflow) {
            const workflowStat = stats.byWorkflow[workflowName];
            if (workflowStat.total > 0) {
                workflowStat.avgDuration = Math.round(workflowStat.totalDuration / workflowStat.total);
            }
        }

        this.cache.workflowStats = stats;
        this.cache.lastUpdate = Date.now();

        return stats;
    }

    /**
     * Get webhook statistics
     */
    getWebhookStats(timeRange = 'all') {
        const webhookEvents = this.filterEventsByTimeRange(
            this.events.filter(e => e.type === 'webhook'),
            timeRange
        );

        const stats = {
            total: webhookEvents.length,
            success: webhookEvents.filter(e => e.status === 'success').length,
            skipped: webhookEvents.filter(e => e.status === 'skipped').length,
            failure: webhookEvents.filter(e => e.status === 'failure').length,

            // By webhook
            byWebhook: {},

            // By event type
            byEvent: {},

            // Recent triggers
            recent: webhookEvents.slice(-10).reverse()
        };

        // Group by webhook
        for (const event of webhookEvents) {
            if (!stats.byWebhook[event.webhookName]) {
                stats.byWebhook[event.webhookName] = { total: 0, success: 0, skipped: 0, failure: 0 };
            }
            const webhookStat = stats.byWebhook[event.webhookName];
            webhookStat.total++;
            webhookStat[event.status]++;

            // Group by event type
            if (!stats.byEvent[event.webhookEvent]) {
                stats.byEvent[event.webhookEvent] = { total: 0, success: 0, skipped: 0, failure: 0 };
            }
            const eventStat = stats.byEvent[event.webhookEvent];
            eventStat.total++;
            eventStat[event.status]++;
        }

        return stats;
    }

    /**
     * Get schedule statistics
     */
    getScheduleStats(timeRange = 'all') {
        const scheduleEvents = this.filterEventsByTimeRange(
            this.events.filter(e => e.type === 'schedule'),
            timeRange
        );

        const stats = {
            total: scheduleEvents.length,
            success: scheduleEvents.filter(e => e.status === 'success').length,
            failure: scheduleEvents.filter(e => e.status === 'failure').length,

            // By schedule
            bySchedule: {},

            // Recent executions
            recent: scheduleEvents.slice(-10).reverse()
        };

        // Group by schedule
        for (const event of scheduleEvents) {
            if (!stats.bySchedule[event.scheduleName]) {
                stats.bySchedule[event.scheduleName] = { total: 0, success: 0, failure: 0 };
            }
            const scheduleStat = stats.bySchedule[event.scheduleName];
            scheduleStat.total++;
            scheduleStat[event.status]++;
        }

        return stats;
    }

    /**
     * Get overview dashboard data
     */
    getDashboardOverview(timeRange = 'today') {
        const agentStats = this.getAgentStats(timeRange);
        const workflowStats = this.getWorkflowStats(timeRange);
        const webhookStats = this.getWebhookStats(timeRange);
        const scheduleStats = this.getScheduleStats(timeRange);

        return {
            timeRange,
            agents: agentStats,
            workflows: workflowStats,
            webhooks: webhookStats,
            schedules: scheduleStats,
            summary: {
                totalExecutions: agentStats.total + workflowStats.total + webhookStats.total + scheduleStats.total,
                totalSuccesses: agentStats.success + workflowStats.success + webhookStats.success + scheduleStats.success,
                totalFailures: agentStats.failure + workflowStats.failure + webhookStats.failure + scheduleStats.failure
            }
        };
    }

    /**
     * Get time series data for charts
     */
    getTimeSeries(period = 'daily', days = 7) {
        const now = new Date();
        const data = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);

            const key = date.toISOString().split('T')[0];

            const agg = this.aggregations.daily[key] || this.createEmptyAggregation();

            data.push({
                date: key,
                agents: agg.agents.total,
                agentsSuccess: agg.agents.success,
                workflows: agg.workflows.total,
                workflowsSuccess: agg.workflows.success,
                webhooks: agg.webhooks.total,
                schedules: agg.schedules.total
            });
        }

        return data;
    }

    /**
     * Filter events by time range
     */
    filterEventsByTimeRange(events, timeRange) {
        const now = new Date();

        switch (timeRange) {
            case 'today': {
                const todayStart = new Date(now);
                todayStart.setHours(0, 0, 0, 0);
                return events.filter(e => new Date(e.timestamp) >= todayStart);
            }
            case 'week': {
                const weekStart = new Date(now);
                weekStart.setDate(weekStart.getDate() - 7);
                return events.filter(e => new Date(e.timestamp) >= weekStart);
            }
            case 'month': {
                const monthStart = new Date(now);
                monthStart.setMonth(monthStart.getMonth() - 1);
                return events.filter(e => new Date(e.timestamp) >= monthStart);
            }
            case 'all':
            default:
                return events;
        }
    }

    /**
     * Rebuild cache
     */
    rebuildCache() {
        this.cache.agentStats = null;
        this.cache.workflowStats = null;
        this.cache.webhookStats = null;
        this.cache.scheduleStats = null;
        this.cache.lastUpdate = null;
    }
}

module.exports = AnalyticsManager;
