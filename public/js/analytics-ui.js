/**
 * Analytics Dashboard UI - Dashboard per metriche e statistics
 */
class AnalyticsUI {
    constructor() {
        this.currentTimeRange = 'today';
        this.dashboardData = null;
        this.timeSeriesData = [];

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Analytics modal toggle
        const openBtn = document.querySelector('[data-action="open-analytics"]');
        if (openBtn) {
            openBtn.addEventListener('click', () => this.openModal());
        }

        // Close modal
        const closeBtn = document.querySelector('.analytics-modal .modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Tab navigation
        const tabs = document.querySelectorAll('.analytics-modal .modal-tabs button');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Time range filter
        document.getElementById('analyticsTimeRange')?.addEventListener('change', (e) => {
            this.currentTimeRange = e.target.value;
            this.loadDashboard();
        });
    }

    async openModal() {
        const modal = document.querySelector('.analytics-modal');
        if (modal) {
            modal.classList.remove('hidden');
            await this.loadDashboard();
        }
    }

    closeModal() {
        const modal = document.querySelector('.analytics-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        const tabs = document.querySelectorAll('.analytics-modal .modal-tabs button');
        tabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update tab contents
        const contents = document.querySelectorAll('.analytics-modal .tab-content');
        contents.forEach(content => {
            if (content.id === `analytics-${tabName}`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        // Load specific data
        if (tabName === 'overview') {
            this.loadDashboard();
        } else if (tabName === 'agents') {
            this.loadAgentDetails();
        } else if (tabName === 'workflows') {
            this.loadWorkflowDetails();
        } else if (tabName === 'trends') {
            this.loadTimeSeries();
        }
    }

    async loadDashboard() {
        try {
            const response = await fetch(`/api/analytics/dashboard?timeRange=${this.currentTimeRange}`);
            const data = await response.json();

            if (data.success) {
                this.dashboardData = data.data;
                this.renderDashboard();
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showToast('Failed to load analytics dashboard', 'error');
        }
    }

    renderDashboard() {
        if (!this.dashboardData) return;

        const container = document.getElementById('analyticsOverviewContent');
        if (!container) return;

        const summary = this.dashboardData.summary;
        const agents = this.dashboardData.agents;
        const workflows = this.dashboardData.workflows;
        const webhooks = this.dashboardData.webhooks;
        const schedules = this.dashboardData.schedules;

        container.innerHTML = `
            <!-- Summary Cards -->
            <div class="analytics-summary-grid">
                <div class="summary-card primary">
                    <div class="summary-icon">📊</div>
                    <div class="summary-content">
                        <div class="summary-value">${summary.totalExecutions}</div>
                        <div class="summary-label">Total Executions</div>
                    </div>
                </div>

                <div class="summary-card success">
                    <div class="summary-icon">✅</div>
                    <div class="summary-content">
                        <div class="summary-value">${summary.totalSuccesses}</div>
                        <div class="summary-label">Successful</div>
                    </div>
                </div>

                <div class="summary-card error">
                    <div class="summary-icon">❌</div>
                    <div class="summary-content">
                        <div class="summary-value">${summary.totalFailures}</div>
                        <div class="summary-label">Failed</div>
                    </div>
                </div>

                <div class="summary-card info">
                    <div class="summary-icon">📈</div>
                    <div class="summary-content">
                        <div class="summary-value">${this.calculateSuccessRate(summary)}%</div>
                        <div class="summary-label">Success Rate</div>
                    </div>
                </div>
            </div>

            <!-- Components Stats -->
            <div class="analytics-components-grid">
                <!-- Agents Card -->
                <div class="component-stats-card">
                    <div class="card-header">
                        <h3>🤖 Agents</h3>
                    </div>
                    <div class="card-body">
                        <div class="stats-row">
                            <span class="stat-label">Total:</span>
                            <span class="stat-value">${agents.total}</span>
                        </div>
                        <div class="stats-row success">
                            <span class="stat-label">Success:</span>
                            <span class="stat-value">${agents.success}</span>
                        </div>
                        <div class="stats-row error">
                            <span class="stat-label">Failed:</span>
                            <span class="stat-value">${agents.failure}</span>
                        </div>
                        <div class="stats-row">
                            <span class="stat-label">Success Rate:</span>
                            <span class="stat-value">${agents.successRate}%</span>
                        </div>
                        <div class="stats-row">
                            <span class="stat-label">Avg Duration:</span>
                            <span class="stat-value">${this.formatDuration(agents.avgDuration)}</span>
                        </div>
                    </div>
                </div>

                <!-- Workflows Card -->
                <div class="component-stats-card">
                    <div class="card-header">
                        <h3>⚙️ Workflows</h3>
                    </div>
                    <div class="card-body">
                        <div class="stats-row">
                            <span class="stat-label">Total:</span>
                            <span class="stat-value">${workflows.total}</span>
                        </div>
                        <div class="stats-row success">
                            <span class="stat-label">Success:</span>
                            <span class="stat-value">${workflows.success}</span>
                        </div>
                        <div class="stats-row warning">
                            <span class="stat-label">Partial:</span>
                            <span class="stat-value">${workflows.partial}</span>
                        </div>
                        <div class="stats-row error">
                            <span class="stat-label">Failed:</span>
                            <span class="stat-value">${workflows.failure}</span>
                        </div>
                        <div class="stats-row">
                            <span class="stat-label">Success Rate:</span>
                            <span class="stat-value">${workflows.successRate}%</span>
                        </div>
                    </div>
                </div>

                <!-- Webhooks Card -->
                <div class="component-stats-card">
                    <div class="card-header">
                        <h3>🪝 Webhooks</h3>
                    </div>
                    <div class="card-body">
                        <div class="stats-row">
                            <span class="stat-label">Total:</span>
                            <span class="stat-value">${webhooks.total}</span>
                        </div>
                        <div class="stats-row success">
                            <span class="stat-label">Success:</span>
                            <span class="stat-value">${webhooks.success}</span>
                        </div>
                        <div class="stats-row warning">
                            <span class="stat-label">Skipped:</span>
                            <span class="stat-value">${webhooks.skipped}</span>
                        </div>
                        <div class="stats-row error">
                            <span class="stat-label">Failed:</span>
                            <span class="stat-value">${webhooks.failure}</span>
                        </div>
                    </div>
                </div>

                <!-- Schedules Card -->
                <div class="component-stats-card">
                    <div class="card-header">
                        <h3>⏰ Schedules</h3>
                    </div>
                    <div class="card-body">
                        <div class="stats-row">
                            <span class="stat-label">Total:</span>
                            <span class="stat-value">${schedules.total}</span>
                        </div>
                        <div class="stats-row success">
                            <span class="stat-label">Success:</span>
                            <span class="stat-value">${schedules.success}</span>
                        </div>
                        <div class="stats-row error">
                            <span class="stat-label">Failed:</span>
                            <span class="stat-value">${schedules.failure}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Recent Activity -->
            ${agents.recent && agents.recent.length > 0 ? `
                <div class="analytics-section">
                    <h3>Recent Agent Executions</h3>
                    <div class="recent-activity-list">
                        ${agents.recent.slice(0, 5).map(event => this.renderActivityItem(event, 'agent')).join('')}
                    </div>
                </div>
            ` : ''}

            ${workflows.recent && workflows.recent.length > 0 ? `
                <div class="analytics-section">
                    <h3>Recent Workflow Executions</h3>
                    <div class="recent-activity-list">
                        ${workflows.recent.slice(0, 5).map(event => this.renderActivityItem(event, 'workflow')).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    renderActivityItem(event, type) {
        const statusIcon = event.status === 'success' ? '✅' :
                          event.status === 'partial' ? '⚠️' : '❌';
        const statusClass = event.status === 'success' ? 'success' :
                           event.status === 'partial' ? 'warning' : 'error';
        const timestamp = new Date(event.timestamp).toLocaleString();

        return `
            <div class="activity-item ${statusClass}">
                <span class="activity-icon">${statusIcon}</span>
                <div class="activity-content">
                    <div class="activity-name">${this.escapeHtml(event.agentName || event.workflowName)}</div>
                    <div class="activity-meta">
                        <span class="activity-time">${timestamp}</span>
                        ${event.duration ? `<span class="activity-duration">${this.formatDuration(event.duration)}</span>` : ''}
                    </div>
                </div>
                <span class="activity-status">${event.status}</span>
            </div>
        `;
    }

    async loadAgentDetails() {
        try {
            const response = await fetch(`/api/analytics/agents?timeRange=${this.currentTimeRange}`);
            const data = await response.json();

            if (data.success) {
                this.renderAgentDetails(data.stats);
            }
        } catch (error) {
            console.error('Error loading agent details:', error);
            this.showToast('Failed to load agent analytics', 'error');
        }
    }

    renderAgentDetails(stats) {
        const container = document.getElementById('analyticsAgentsContent');
        if (!container) return;

        container.innerHTML = `
            <div class="analytics-details-header">
                <h3>Agent Performance</h3>
                <div class="details-summary">
                    <span>Total: ${stats.total}</span>
                    <span class="success">Success: ${stats.success}</span>
                    <span class="error">Failed: ${stats.failure}</span>
                    <span>Rate: ${stats.successRate}%</span>
                </div>
            </div>

            ${Object.keys(stats.byAgent).length > 0 ? `
                <div class="agent-stats-grid">
                    ${Object.entries(stats.byAgent).map(([name, agentStats]) => `
                        <div class="agent-stat-card">
                            <div class="agent-stat-header">
                                <h4>${this.escapeHtml(name)}</h4>
                            </div>
                            <div class="agent-stat-body">
                                <div class="stat-row">
                                    <span>Total Executions:</span>
                                    <span class="stat-value">${agentStats.total}</span>
                                </div>
                                <div class="stat-row success">
                                    <span>Success:</span>
                                    <span class="stat-value">${agentStats.success}</span>
                                </div>
                                <div class="stat-row error">
                                    <span>Failed:</span>
                                    <span class="stat-value">${agentStats.failure}</span>
                                </div>
                                <div class="stat-row">
                                    <span>Success Rate:</span>
                                    <span class="stat-value">${this.calculateRate(agentStats.success, agentStats.total)}%</span>
                                </div>
                                <div class="stat-row">
                                    <span>Avg Duration:</span>
                                    <span class="stat-value">${this.formatDuration(agentStats.avgDuration)}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="empty-message">No agent execution data available</p>'}
        `;
    }

    async loadWorkflowDetails() {
        try {
            const response = await fetch(`/api/analytics/workflows?timeRange=${this.currentTimeRange}`);
            const data = await response.json();

            if (data.success) {
                this.renderWorkflowDetails(data.stats);
            }
        } catch (error) {
            console.error('Error loading workflow details:', error);
            this.showToast('Failed to load workflow analytics', 'error');
        }
    }

    renderWorkflowDetails(stats) {
        const container = document.getElementById('analyticsWorkflowsContent');
        if (!container) return;

        container.innerHTML = `
            <div class="analytics-details-header">
                <h3>Workflow Performance</h3>
                <div class="details-summary">
                    <span>Total: ${stats.total}</span>
                    <span class="success">Success: ${stats.success}</span>
                    <span class="warning">Partial: ${stats.partial}</span>
                    <span class="error">Failed: ${stats.failure}</span>
                    <span>Rate: ${stats.successRate}%</span>
                </div>
            </div>

            ${Object.keys(stats.byWorkflow).length > 0 ? `
                <div class="workflow-stats-grid">
                    ${Object.entries(stats.byWorkflow).map(([name, workflowStats]) => `
                        <div class="workflow-stat-card">
                            <div class="workflow-stat-header">
                                <h4>${this.escapeHtml(name)}</h4>
                            </div>
                            <div class="workflow-stat-body">
                                <div class="stat-row">
                                    <span>Total Executions:</span>
                                    <span class="stat-value">${workflowStats.total}</span>
                                </div>
                                <div class="stat-row success">
                                    <span>Success:</span>
                                    <span class="stat-value">${workflowStats.success}</span>
                                </div>
                                <div class="stat-row warning">
                                    <span>Partial:</span>
                                    <span class="stat-value">${workflowStats.partial}</span>
                                </div>
                                <div class="stat-row error">
                                    <span>Failed:</span>
                                    <span class="stat-value">${workflowStats.failure}</span>
                                </div>
                                <div class="stat-row">
                                    <span>Success Rate:</span>
                                    <span class="stat-value">${this.calculateRate(workflowStats.success, workflowStats.total)}%</span>
                                </div>
                                <div class="stat-row">
                                    <span>Avg Duration:</span>
                                    <span class="stat-value">${this.formatDuration(workflowStats.avgDuration)}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="empty-message">No workflow execution data available</p>'}
        `;
    }

    async loadTimeSeries() {
        try {
            const response = await fetch('/api/analytics/timeseries?period=daily&days=7');
            const data = await response.json();

            if (data.success) {
                this.timeSeriesData = data.data;
                this.renderTimeSeries();
            }
        } catch (error) {
            console.error('Error loading time series:', error);
            this.showToast('Failed to load trends data', 'error');
        }
    }

    renderTimeSeries() {
        const container = document.getElementById('analyticsTrendsContent');
        if (!container) return;

        if (this.timeSeriesData.length === 0) {
            container.innerHTML = '<p class="empty-message">No trends data available</p>';
            return;
        }

        // Simple ASCII chart representation
        container.innerHTML = `
            <div class="trends-section">
                <h3>Execution Trends (Last 7 Days)</h3>
                <div class="trends-chart">
                    ${this.renderSimpleChart()}
                </div>
            </div>

            <div class="trends-table">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Agents</th>
                            <th>Workflows</th>
                            <th>Webhooks</th>
                            <th>Schedules</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.timeSeriesData.map(day => `
                            <tr>
                                <td>${new Date(day.date).toLocaleDateString()}</td>
                                <td>${day.agents} <span class="success-indicator">(${day.agentsSuccess})</span></td>
                                <td>${day.workflows} <span class="success-indicator">(${day.workflowsSuccess})</span></td>
                                <td>${day.webhooks}</td>
                                <td>${day.schedules}</td>
                                <td><strong>${day.agents + day.workflows + day.webhooks + day.schedules}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderSimpleChart() {
        // Find max value for scaling
        const maxValue = Math.max(...this.timeSeriesData.map(d =>
            d.agents + d.workflows + d.webhooks + d.schedules
        ));

        if (maxValue === 0) return '<p>No activity to display</p>';

        return `
            <div class="chart-bars">
                ${this.timeSeriesData.map(day => {
                    const total = day.agents + day.workflows + day.webhooks + day.schedules;
                    const height = (total / maxValue) * 100;
                    return `
                        <div class="chart-bar-container">
                            <div class="chart-bar" style="height: ${height}%" title="${total} executions">
                                <span class="bar-value">${total}</span>
                            </div>
                            <div class="chart-label">${new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    calculateSuccessRate(summary) {
        if (summary.totalExecutions === 0) return 0;
        return Math.round((summary.totalSuccesses / summary.totalExecutions) * 100);
    }

    calculateRate(success, total) {
        if (total === 0) return 0;
        return Math.round((success / total) * 100);
    }

    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
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
let analyticsUI;
document.addEventListener('DOMContentLoaded', () => {
    analyticsUI = new AnalyticsUI();
});
