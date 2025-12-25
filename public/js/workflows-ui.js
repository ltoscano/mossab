/**
 * Workflows UI Manager
 * Handles all workflow management UI interactions
 */

class WorkflowsUI {
  constructor() {
    this.modal = null;
    this.currentTab = 'list';
    this.workflows = [];
    this.currentWorkflowSteps = [];
    this.latestResults = null;

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
    this.modal = document.getElementById('workflowsModal');
    const workflowsBtn = document.getElementById('workflowsBtn');
    const closeBtn = this.modal?.querySelector('.workflows-modal-close');

    // Open modal
    workflowsBtn?.addEventListener('click', () => this.openModal());

    // Close modal
    closeBtn?.addEventListener('click', () => this.closeModal());

    // Close on outside click
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });

    // Tab switching
    const tabs = this.modal?.querySelectorAll('.workflows-tabs button');
    tabs?.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Create workflow form
    const createForm = document.getElementById('workflowCreateForm');
    createForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.createWorkflow();
    });

    // Add step button
    const addStepBtn = document.getElementById('workflowAddStepBtn');
    addStepBtn?.addEventListener('click', () => this.addWorkflowStep());

    // Reload button
    const reloadBtn = document.getElementById('workflowsReloadBtn');
    reloadBtn?.addEventListener('click', () => this.reloadWorkflows());
  }

  async openModal() {
    this.modal?.classList.remove('hidden');
    await this.loadWorkflows();
    this.switchTab('list');
  }

  closeModal() {
    this.modal?.classList.add('hidden');
  }

  switchTab(tabName) {
    this.currentTab = tabName;

    // Update tab buttons
    const tabs = this.modal?.querySelectorAll('.workflows-tabs button');
    tabs?.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update tab content
    const contents = this.modal?.querySelectorAll('.workflows-tab-content');
    contents?.forEach(content => {
      if (content.id === `workflowsTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`) {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    });

    // Load data for specific tabs
    if (tabName === 'list') {
      this.renderWorkflowsList();
    } else if (tabName === 'create') {
      this.initializeWorkflowForm();
    } else if (tabName === 'results' && this.latestResults) {
      this.renderResults();
    }
  }

  async loadWorkflows() {
    try {
      const response = await fetch('/api/workflows');
      const data = await response.json();

      if (data.success) {
        this.workflows = data.workflows || [];
        this.renderWorkflowsList();
      } else {
        this.showError('Failed to load workflows');
      }
    } catch (error) {
      this.showError('Error loading workflows: ' + error.message);
    }
  }

  renderWorkflowsList() {
    const listContainer = document.getElementById('workflowsListContainer');
    if (!listContainer) return;

    if (this.workflows.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <p>No workflows found</p>
          <button class="btn-primary" onclick="workflowsUI.switchTab('create')">Create Your First Workflow</button>
        </div>
      `;
      return;
    }

    let html = `
      <div class="workflows-stats-summary">
        <div class="stat-card">
          <div class="stat-value">${this.workflows.length}</div>
          <div class="stat-label">Total Workflows</div>
        </div>
      </div>
      <div class="workflows-grid">
    `;

    this.workflows.forEach(workflow => {
      html += this.renderWorkflowCard(workflow);
    });

    html += `</div>`;
    listContainer.innerHTML = html;

    // Setup action buttons
    this.workflows.forEach(workflow => {
      const executeBtn = document.getElementById(`execute-${workflow.name}`);
      const deleteBtn = document.getElementById(`delete-workflow-${workflow.name}`);

      executeBtn?.addEventListener('click', () => this.executeWorkflow(workflow.name));
      deleteBtn?.addEventListener('click', () => this.deleteWorkflow(workflow.name));
    });
  }

  renderWorkflowCard(workflow) {
    const steps = workflow.steps || [];
    const mode = workflow.mode || 'sequential';
    const modeIcon = mode === 'parallel' ? '⚡' : '📋';

    return `
      <div class="workflow-card">
        <div class="workflow-card-header">
          <h4>${workflow.name}</h4>
          <span class="workflow-mode-badge">${modeIcon} ${mode}</span>
        </div>
        <p class="workflow-description">${workflow.description || 'No description'}</p>
        <div class="workflow-steps-preview">
          <strong>Steps (${steps.length}):</strong>
          <ol class="steps-list">
            ${steps.map(step => `<li>${step.name} <span class="step-agent">(${step.agent})</span></li>`).join('')}
          </ol>
        </div>
        <div class="workflow-actions">
          <button class="btn-primary" id="execute-${workflow.name}">▶ Execute</button>
          <button class="btn-danger" id="delete-workflow-${workflow.name}">Delete</button>
        </div>
      </div>
    `;
  }

  initializeWorkflowForm() {
    this.currentWorkflowSteps = [];
    document.getElementById('workflowName')?.value = '';
    document.getElementById('workflowDescription')?.value = '';
    document.getElementById('workflowMode')?.value = 'sequential';

    const stepsContainer = document.getElementById('workflowSteps');
    if (stepsContainer) {
      stepsContainer.innerHTML = '';
    }

    // Add initial step
    this.addWorkflowStep();
  }

  addWorkflowStep() {
    const stepsContainer = document.getElementById('workflowSteps');
    if (!stepsContainer) return;

    const stepIndex = this.currentWorkflowSteps.length;
    this.currentWorkflowSteps.push({
      name: '',
      agent: '',
      task: '',
      outputVariable: '',
      stopOnFailure: false
    });

    const stepHtml = `
      <div class="workflow-step" data-step-index="${stepIndex}">
        <div class="workflow-step-header">
          <h4>Step ${stepIndex + 1}</h4>
          <button type="button" class="btn-remove-step" onclick="workflowsUI.removeStep(${stepIndex})">Remove</button>
        </div>
        <div class="form-group">
          <label>Step Name:</label>
          <input type="text" class="step-name" data-step="${stepIndex}" placeholder="e.g., Security Scan" required>
        </div>
        <div class="form-group">
          <label>Agent:</label>
          <input type="text" class="step-agent" data-step="${stepIndex}" placeholder="e.g., security-audit" required>
        </div>
        <div class="form-group">
          <label>Task Description:</label>
          <textarea class="step-task" data-step="${stepIndex}" placeholder="What should this agent do?" rows="3" required></textarea>
        </div>
        <div class="form-group">
          <label>Output Variable (optional):</label>
          <input type="text" class="step-output" data-step="${stepIndex}" placeholder="e.g., securityResults">
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" class="step-stop-on-failure" data-step="${stepIndex}">
            Stop workflow if this step fails
          </label>
        </div>
      </div>
    `;

    stepsContainer.insertAdjacentHTML('beforeend', stepHtml);
  }

  removeStep(stepIndex) {
    const stepElement = document.querySelector(`[data-step-index="${stepIndex}"]`);
    if (stepElement) {
      stepElement.remove();
      this.currentWorkflowSteps.splice(stepIndex, 1);

      // Re-index remaining steps
      this.reindexSteps();
    }
  }

  reindexSteps() {
    const stepsContainer = document.getElementById('workflowSteps');
    if (!stepsContainer) return;

    const stepElements = stepsContainer.querySelectorAll('.workflow-step');
    stepElements.forEach((element, index) => {
      element.dataset.stepIndex = index;
      element.querySelector('h4').textContent = `Step ${index + 1}`;

      // Update data attributes
      element.querySelectorAll('[data-step]').forEach(input => {
        input.dataset.step = index;
      });

      // Update remove button
      const removeBtn = element.querySelector('.btn-remove-step');
      removeBtn.setAttribute('onclick', `workflowsUI.removeStep(${index})`);
    });
  }

  async createWorkflow() {
    const name = document.getElementById('workflowName')?.value;
    const description = document.getElementById('workflowDescription')?.value;
    const mode = document.getElementById('workflowMode')?.value;

    // Validate name
    if (!name || !/^[a-z0-9-]+$/.test(name)) {
      this.showError('Workflow name must be lowercase alphanumeric with hyphens (e.g., my-workflow)');
      return;
    }

    // Collect steps
    const steps = [];
    const stepElements = document.querySelectorAll('.workflow-step');

    stepElements.forEach((element, index) => {
      const stepName = element.querySelector('.step-name')?.value;
      const agent = element.querySelector('.step-agent')?.value;
      const task = element.querySelector('.step-task')?.value;
      const outputVariable = element.querySelector('.step-output')?.value;
      const stopOnFailure = element.querySelector('.step-stop-on-failure')?.checked;

      if (stepName && agent && task) {
        const step = {
          name: stepName,
          agent: agent,
          task: task,
          stopOnFailure: stopOnFailure
        };

        if (outputVariable) {
          step.outputVariable = outputVariable;
        }

        steps.push(step);
      }
    });

    if (steps.length === 0) {
      this.showError('Workflow must have at least one step');
      return;
    }

    const workflow = {
      name,
      description,
      mode,
      steps
    };

    try {
      const response = await fetch('/api/workflows/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow)
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess(`Workflow "${name}" created successfully!`);
        await this.loadWorkflows();
        this.switchTab('list');
      } else {
        this.showError(data.error || 'Failed to create workflow');
      }
    } catch (error) {
      this.showError('Error creating workflow: ' + error.message);
    }
  }

  async executeWorkflow(workflowName) {
    this.showSuccess(`Executing workflow: ${workflowName}...`);

    try {
      const response = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: workflowName })
      });

      const data = await response.json();

      if (data.success) {
        this.latestResults = {
          workflow: workflowName,
          ...data.result
        };
        this.showSuccess(`Workflow "${workflowName}" completed!`);
        this.switchTab('results');
      } else {
        this.showError(data.error || 'Workflow execution failed');
      }
    } catch (error) {
      this.showError('Error executing workflow: ' + error.message);
    }
  }

  async deleteWorkflow(name) {
    if (!confirm(`Are you sure you want to delete workflow "${name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/workflows/${name}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess(`Workflow "${name}" deleted successfully!`);
        await this.loadWorkflows();
      } else {
        this.showError(data.error || 'Failed to delete workflow');
      }
    } catch (error) {
      this.showError('Error deleting workflow: ' + error.message);
    }
  }

  renderResults() {
    const resultsContainer = document.getElementById('workflowResultsContainer');
    if (!resultsContainer || !this.latestResults) return;

    const results = this.latestResults.results || [];
    const summary = this.latestResults.summary || {};

    let html = `
      <div class="workflow-results-header">
        <h3>Workflow: ${this.latestResults.workflow}</h3>
        <div class="results-summary">
          <span class="result-badge ${this.latestResults.success ? 'success' : 'error'}">
            ${this.latestResults.success ? '✓ Success' : '✗ Failed'}
          </span>
          <span>Duration: ${this.latestResults.duration || 'N/A'}s</span>
          <span>Steps: ${summary.completed || 0}/${summary.total || 0}</span>
        </div>
      </div>

      <div class="workflow-results-steps">
    `;

    results.forEach((result, index) => {
      const status = result.success ? 'success' : 'error';
      const icon = result.success ? '✓' : '✗';

      html += `
        <div class="result-step ${status}">
          <div class="result-step-header">
            <h4>${icon} ${result.step}</h4>
            <span class="result-agent">Agent: ${result.agent}</span>
          </div>
          <div class="result-content">
            ${result.error ? `<p class="error-message">Error: ${result.error}</p>` : ''}
            ${result.result ? `<pre>${JSON.stringify(result.result, null, 2)}</pre>` : ''}
          </div>
        </div>
      `;
    });

    html += `</div>`;

    resultsContainer.innerHTML = html;
  }

  async reloadWorkflows() {
    try {
      const response = await fetch('/api/workflows/reload', {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess('Workflows reloaded successfully!');
        await this.loadWorkflows();
      } else {
        this.showError('Failed to reload workflows');
      }
    } catch (error) {
      this.showError('Error reloading workflows: ' + error.message);
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
const workflowsUI = new WorkflowsUI();
