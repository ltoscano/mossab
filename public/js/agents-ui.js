/**
 * Agents UI Manager
 * Handles all agent management UI interactions
 */

class AgentsUI {
  constructor() {
    this.modal = null;
    this.currentTab = 'list';
    this.agents = { builtin: [], custom: [], total: 0 };
    this.stats = null;

    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
    } else {
      this.setupEventListeners();
    }
  }

  setupEventListeners() {
    this.modal = document.getElementById('agentsModal');
    const agentsBtn = document.getElementById('agentsBtn');
    const closeBtn = this.modal?.querySelector('.agents-modal-close');

    // Open modal
    agentsBtn?.addEventListener('click', () => this.openModal());

    // Close modal
    closeBtn?.addEventListener('click', () => this.closeModal());

    // Close on outside click
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });

    // Tab switching
    const tabs = this.modal?.querySelectorAll('.agents-tabs button');
    tabs?.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Create agent form
    const createForm = document.getElementById('agentCreateForm');
    createForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.createAgent();
    });

    // Template buttons
    this.setupTemplateButtons();

    // Reload button
    const reloadBtn = document.getElementById('agentsReloadBtn');
    reloadBtn?.addEventListener('click', () => this.reloadAgents());
  }

  setupTemplateButtons() {
    const templates = ['code-analyzer', 'api-designer', 'bug-hunter', 'refactoring-assistant'];

    templates.forEach(template => {
      const btn = document.querySelector(`[data-template="${template}"] .agent-template-use-btn`);
      btn?.addEventListener('click', () => this.useTemplate(template));
    });
  }

  async openModal() {
    this.modal?.classList.remove('hidden');
    await this.loadAgents();
    this.switchTab('list');
  }

  closeModal() {
    this.modal?.classList.add('hidden');
  }

  switchTab(tabName) {
    this.currentTab = tabName;

    // Update tab buttons
    const tabs = this.modal?.querySelectorAll('.agents-tabs button');
    tabs?.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update tab content
    const contents = this.modal?.querySelectorAll('.agents-tab-content');
    contents?.forEach(content => {
      if (content.id === `agentsTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`) {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    });

    // Load data for specific tabs
    if (tabName === 'list') {
      this.renderAgentsList();
    } else if (tabName === 'stats') {
      this.loadStats();
    }
  }

  async loadAgents() {
    try {
      const response = await fetch('/api/agents');
      const data = await response.json();

      if (data.success) {
        this.agents = data.agents;
        this.renderAgentsList();
      } else {
        this.showError('Failed to load agents');
      }
    } catch (error) {
      this.showError('Error loading agents: ' + error.message);
    }
  }

  renderAgentsList() {
    const listContainer = document.getElementById('agentsListContainer');
    if (!listContainer) return;

    const builtinAgents = this.agents.builtin || [];
    const customAgents = this.agents.custom || [];

    let html = `
      <div class="agents-stats-summary">
        <div class="stat-card">
          <div class="stat-value">${this.agents.total || 0}</div>
          <div class="stat-label">Total Agents</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${builtinAgents.length}</div>
          <div class="stat-label">Built-in</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${customAgents.length}</div>
          <div class="stat-label">Custom</div>
        </div>
      </div>

      <h3>Built-in Agents</h3>
      <div class="agents-grid">
    `;

    builtinAgents.forEach(agent => {
      html += this.renderAgentCard(agent, 'builtin');
    });

    html += `</div>`;

    if (customAgents.length > 0) {
      html += `
        <h3>Custom Agents</h3>
        <div class="agents-grid">
      `;

      customAgents.forEach(agent => {
        html += this.renderAgentCard(agent, 'custom');
      });

      html += `</div>`;
    }

    listContainer.innerHTML = html;

    // Setup delete buttons for custom agents
    customAgents.forEach(agent => {
      const deleteBtn = document.getElementById(`delete-${agent.name}`);
      deleteBtn?.addEventListener('click', () => this.deleteAgent(agent.name));
    });

    // Setup version buttons for custom agents
    customAgents.forEach(agent => {
      const versionBtn = document.querySelector(`.agent-versions-btn[data-agent="${agent.name}"]`);
      versionBtn?.addEventListener('click', () => this.showVersionsModal(agent.name));
    });
  }

  renderAgentCard(agent, type) {
    const tools = Array.isArray(agent.tools) ? agent.tools.join(', ') : 'N/A';
    const versionsBtn = type === 'custom'
      ? `<button class="agent-versions-btn" data-agent="${agent.name}">📋 Versions</button>`
      : '';
    const deleteBtn = type === 'custom'
      ? `<button class="agent-delete-btn" id="delete-${agent.name}">Delete</button>`
      : '';

    return `
      <div class="agent-card ${type}">
        <div class="agent-card-header">
          <h4>${agent.name}</h4>
          <span class="agent-type-badge">${type}</span>
        </div>
        <p class="agent-description">${agent.description || 'No description'}</p>
        <div class="agent-details">
          <div class="agent-detail">
            <strong>Model:</strong> ${agent.model || 'N/A'}
          </div>
          <div class="agent-detail">
            <strong>Tools:</strong> ${tools}
          </div>
          <div class="agent-detail">
            <strong>Thoroughness:</strong> ${agent.thoroughness || 'N/A'}
          </div>
        </div>
        <div class="agent-actions">
          ${versionsBtn}
          ${deleteBtn}
        </div>
      </div>
    `;
  }

  async createAgent() {
    const name = document.getElementById('agentName')?.value;
    const description = document.getElementById('agentDescription')?.value;
    const model = document.getElementById('agentModel')?.value;
    const thoroughness = document.getElementById('agentThoroughness')?.value;
    const toolsInput = document.getElementById('agentTools')?.value;
    const systemPrompt = document.getElementById('agentSystemPrompt')?.value;

    // Validate name
    if (!name || !/^[a-z0-9-]+$/.test(name)) {
      this.showError('Agent name must be lowercase alphanumeric with hyphens (e.g., my-agent)');
      return;
    }

    // Parse tools
    const tools = toolsInput.split(',').map(t => t.trim()).filter(t => t);

    const config = {
      name,
      description,
      model,
      thoroughness,
      tools,
      system_prompt: systemPrompt
    };

    try {
      const response = await fetch('/api/agents/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess(`Agent "${name}" created successfully!`);
        document.getElementById('agentCreateForm')?.reset();
        await this.loadAgents();
        this.switchTab('list');
      } else {
        this.showError(data.error || 'Failed to create agent');
      }
    } catch (error) {
      this.showError('Error creating agent: ' + error.message);
    }
  }

  async deleteAgent(name) {
    if (!confirm(`Are you sure you want to delete agent "${name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/agents/${name}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess(`Agent "${name}" deleted successfully!`);
        await this.loadAgents();
      } else {
        this.showError(data.error || 'Failed to delete agent');
      }
    } catch (error) {
      this.showError('Error deleting agent: ' + error.message);
    }
  }

  async useTemplate(templateType) {
    try {
      const response = await fetch(`/api/agents/templates/${templateType}`);
      const data = await response.json();

      if (data.success) {
        const template = data.template;

        // Fill form with template data
        document.getElementById('agentName').value = template.name;
        document.getElementById('agentDescription').value = template.description;
        document.getElementById('agentModel').value = template.model;
        document.getElementById('agentThoroughness').value = template.thoroughness;
        document.getElementById('agentTools').value = template.tools.join(', ');
        document.getElementById('agentSystemPrompt').value = template.system_prompt;

        // Switch to create tab
        this.switchTab('create');
        this.showSuccess(`Template "${templateType}" loaded! Edit and create your agent.`);
      } else {
        this.showError(data.error || 'Failed to load template');
      }
    } catch (error) {
      this.showError('Error loading template: ' + error.message);
    }
  }

  async loadStats() {
    try {
      const response = await fetch('/api/agents/stats');
      const data = await response.json();

      if (data.success) {
        this.stats = data.stats;
        this.renderStats();
      } else {
        this.showError('Failed to load stats');
      }
    } catch (error) {
      this.showError('Error loading stats: ' + error.message);
    }
  }

  renderStats() {
    const statsContainer = document.getElementById('agentsStatsContainer');
    if (!statsContainer || !this.stats) return;

    const mostUsed = this.stats.mostUsedAgent
      ? `${this.stats.mostUsedAgent.name} (${this.stats.mostUsedAgent.count} times)`
      : 'N/A';

    const usageTable = Object.entries(this.stats.agentUsage || {})
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `
        <tr>
          <td>${name}</td>
          <td>${count}</td>
        </tr>
      `).join('');

    const html = `
      <div class="stats-grid">
        <div class="stat-card-large">
          <div class="stat-value">${this.stats.totalExecutions || 0}</div>
          <div class="stat-label">Total Executions</div>
        </div>
        <div class="stat-card-large">
          <div class="stat-value">${this.stats.successRate || '0%'}</div>
          <div class="stat-label">Success Rate</div>
        </div>
        <div class="stat-card-large">
          <div class="stat-value">${this.stats.averageDuration || '0s'}</div>
          <div class="stat-label">Avg Duration</div>
        </div>
        <div class="stat-card-large">
          <div class="stat-value">${mostUsed}</div>
          <div class="stat-label">Most Used Agent</div>
        </div>
      </div>

      <h3>Agent Usage</h3>
      <table class="stats-table">
        <thead>
          <tr>
            <th>Agent Name</th>
            <th>Executions</th>
          </tr>
        </thead>
        <tbody>
          ${usageTable || '<tr><td colspan="2">No usage data yet</td></tr>'}
        </tbody>
      </table>
    `;

    statsContainer.innerHTML = html;
  }

  async reloadAgents() {
    try {
      const response = await fetch('/api/agents/reload', {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess('Agents reloaded successfully!');
        await this.loadAgents();
      } else {
        this.showError('Failed to reload agents');
      }
    } catch (error) {
      this.showError('Error reloading agents: ' + error.message);
    }
  }

  async showVersionsModal(agentName) {
    // Create modal HTML
    const modalHtml = `
      <div id="versionsModal" class="version-modal">
        <div class="version-modal-content">
          <div class="version-modal-header">
            <h2>Versions: ${agentName}</h2>
            <button class="version-modal-close">&times;</button>
          </div>
          <div class="version-modal-body">
            <div class="version-tabs">
              <button class="active" data-vtab="list">Version List</button>
              <button data-vtab="create">Create Version</button>
            </div>
            <div class="version-tab-content" id="versionTabList">
              <div id="versionsListContainer">Loading...</div>
            </div>
            <div class="version-tab-content hidden" id="versionTabCreate">
              <form id="versionCreateForm">
                <div class="form-group">
                  <label>Version Number</label>
                  <input type="text" id="versionNumber" placeholder="1.0.0" required />
                  <small>Use semantic versioning (e.g., 1.0.0, 2.1.0)</small>
                </div>
                <div class="form-group">
                  <label>Tag</label>
                  <select id="versionTag">
                    <option value="stable">Stable</option>
                    <option value="beta">Beta</option>
                    <option value="alpha">Alpha</option>
                    <option value="experimental">Experimental</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Changelog</label>
                  <textarea id="versionChangelog" rows="4" placeholder="What changed in this version?"></textarea>
                </div>
                <div class="form-group">
                  <label>
                    <input type="checkbox" id="versionSetCurrent" />
                    Set as current version
                  </label>
                </div>
                <button type="submit" class="btn-primary">Create Version</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to body
    const existingModal = document.getElementById('versionsModal');
    if (existingModal) {
      existingModal.remove();
    }
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Get modal elements
    const modal = document.getElementById('versionsModal');
    const closeBtn = modal.querySelector('.version-modal-close');

    // Setup event listeners
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Tab switching
    const tabs = modal.querySelectorAll('.version-tabs button');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const vtabName = e.target.dataset.vtab;

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');

        // Show/hide content
        const contents = modal.querySelectorAll('.version-tab-content');
        contents.forEach(content => {
          if (content.id === `versionTab${vtabName.charAt(0).toUpperCase() + vtabName.slice(1)}`) {
            content.classList.remove('hidden');
          } else {
            content.classList.add('hidden');
          }
        });
      });
    });

    // Create version form
    const createForm = document.getElementById('versionCreateForm');
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.createAgentVersion(agentName, modal);
    });

    // Load versions
    await this.loadAgentVersions(agentName, modal);
  }

  async loadAgentVersions(agentName, modal) {
    try {
      const response = await fetch(`/api/agents/${agentName}/versions`);
      const data = await response.json();

      if (data.success) {
        this.renderVersionsList(agentName, data, modal);
      } else {
        this.showError('Failed to load versions');
      }
    } catch (error) {
      this.showError('Error loading versions: ' + error.message);
    }
  }

  renderVersionsList(agentName, data, modal) {
    const container = modal.querySelector('#versionsListContainer');
    if (!container) return;

    const versions = data.versions || [];
    const currentVersion = data.currentVersion;
    const latestVersion = data.latestVersion;

    if (versions.length === 0) {
      container.innerHTML = '<p class="no-data">No versions yet. Create your first version!</p>';
      return;
    }

    let html = `
      <div class="version-info">
        <p><strong>Current Version:</strong> ${currentVersion || 'None'}</p>
        <p><strong>Latest Version:</strong> ${latestVersion || 'None'}</p>
      </div>
      <div class="versions-list">
    `;

    versions.forEach(version => {
      const isCurrent = version.version === currentVersion;
      const isLatest = version.version === latestVersion;

      html += `
        <div class="version-item ${isCurrent ? 'current' : ''}">
          <div class="version-header">
            <h4>v${version.version}</h4>
            <div class="version-badges">
              ${isCurrent ? '<span class="badge badge-current">Current</span>' : ''}
              ${isLatest ? '<span class="badge badge-latest">Latest</span>' : ''}
              <span class="badge badge-${version.tag}">${version.tag}</span>
            </div>
          </div>
          <p class="version-meta">Created: ${new Date(version.createdAt).toLocaleString()}</p>
          ${version.changelog ? `<p class="version-changelog">${version.changelog}</p>` : ''}
          <div class="version-actions">
            ${!isCurrent ? `<button class="btn-switch" onclick="agentsUI.switchAgentVersion('${agentName}', '${version.version}')">Switch to this</button>` : ''}
            ${!isCurrent ? `<button class="btn-delete" onclick="agentsUI.deleteAgentVersion('${agentName}', '${version.version}')">Delete</button>` : ''}
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  }

  async createAgentVersion(agentName, modal) {
    const version = document.getElementById('versionNumber')?.value;
    const tag = document.getElementById('versionTag')?.value;
    const changelog = document.getElementById('versionChangelog')?.value;
    const setCurrent = document.getElementById('versionSetCurrent')?.checked;

    if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
      this.showError('Invalid version format. Use semantic versioning (e.g., 1.0.0)');
      return;
    }

    try {
      const response = await fetch(`/api/agents/${agentName}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version,
          tag,
          changelog,
          setAsCurrent: setCurrent,
          setAsLatest: true
        })
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess(`Version ${version} created successfully!`);
        document.getElementById('versionCreateForm')?.reset();
        await this.loadAgentVersions(agentName, modal);

        // Switch to list tab
        const listTab = modal.querySelector('[data-vtab="list"]');
        listTab?.click();
      } else {
        this.showError(data.error || 'Failed to create version');
      }
    } catch (error) {
      this.showError('Error creating version: ' + error.message);
    }
  }

  async switchAgentVersion(agentName, version) {
    if (!confirm(`Switch to version ${version}? This will update the active agent configuration.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/agents/${agentName}/versions/${version}/switch`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess(`Switched to version ${version}`);

        // Reload versions modal
        const modal = document.getElementById('versionsModal');
        if (modal) {
          await this.loadAgentVersions(agentName, modal);
        }

        // Reload agents list
        await this.loadAgents();
      } else {
        this.showError(data.error || 'Failed to switch version');
      }
    } catch (error) {
      this.showError('Error switching version: ' + error.message);
    }
  }

  async deleteAgentVersion(agentName, version) {
    if (!confirm(`Delete version ${version}? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/agents/${agentName}/versions/${version}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess(`Version ${version} deleted`);

        // Reload versions modal
        const modal = document.getElementById('versionsModal');
        if (modal) {
          await this.loadAgentVersions(agentName, modal);
        }
      } else {
        this.showError(data.error || 'Failed to delete version');
      }
    } catch (error) {
      this.showError('Error deleting version: ' + error.message);
    }
  }

  showSuccess(message) {
    this.showToast(message, 'success');
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  showToast(message, type) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove toast after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize when script loads
const agentsUI = new AgentsUI();
