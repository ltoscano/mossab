const fs = require('fs').promises;
const path = require('path');

/**
 * WorkflowManager - Sistema per combinare multipli agents in workflow complessi
 *
 * Supporta:
 * - Sequential: Esegui agents uno dopo l'altro
 * - Parallel: Esegui agents simultaneamente
 * - Conditional: Esegui basato su risultati precedenti
 * - Data passing: Passa output tra agents
 */
class WorkflowManager {
  constructor(workspaceRoot, agentManager) {
    this.workspaceRoot = workspaceRoot;
    this.agentManager = agentManager;
    this.workflowsDir = path.join(workspaceRoot, '.mossab', 'workflows');
    this.workflows = {};

    console.log('🔄 WorkflowManager initialized');
  }

  /**
   * Inizializza caricando workflows da disco
   */
  async initialize() {
    console.log('\n📦 Loading workflows...');

    // Carica workflows da file
    await this.loadWorkflows();

    const totalWorkflows = Object.keys(this.workflows).length;
    console.log(`✅ Loaded ${totalWorkflows} workflows`);

    return {
      total: totalWorkflows
    };
  }

  /**
   * Carica workflows da .mossab/workflows/*.json
   */
  async loadWorkflows() {
    this.workflows = {}; // Reset

    try {
      // Verifica se la directory esiste
      try {
        await fs.access(this.workflowsDir);
      } catch {
        console.log(`📁 Creating workflows directory: ${this.workflowsDir}`);
        await fs.mkdir(this.workflowsDir, { recursive: true });
        return;
      }

      // Leggi tutti i file JSON
      const files = await fs.readdir(this.workflowsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        console.log('ℹ️  No workflows found in .mossab/workflows/');
        return;
      }

      console.log(`📂 Found ${jsonFiles.length} workflow config files`);

      // Carica ogni workflow
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.workflowsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const config = JSON.parse(content);

          // Valida workflow
          this.validateWorkflow(config);

          this.workflows[config.name] = config;
          console.log(`✅ Workflow loaded: ${config.name} (${config.steps.length} steps)`);

        } catch (error) {
          console.error(`❌ Failed to load workflow from ${file}:`, error.message);
        }
      }

    } catch (error) {
      console.error('❌ Error loading workflows:', error.message);
    }
  }

  /**
   * Valida configurazione workflow
   */
  validateWorkflow(config) {
    if (!config.name) {
      throw new Error('Workflow missing: name');
    }

    if (!config.steps || !Array.isArray(config.steps) || config.steps.length === 0) {
      throw new Error(`Workflow ${config.name} missing or empty: steps`);
    }

    // Valida ogni step
    for (const step of config.steps) {
      if (!step.name) {
        throw new Error(`Workflow ${config.name}: step missing name`);
      }

      if (!step.agent) {
        throw new Error(`Workflow ${config.name}, step ${step.name}: missing agent`);
      }

      if (!step.task) {
        throw new Error(`Workflow ${config.name}, step ${step.name}: missing task`);
      }

      const validModes = ['sequential', 'parallel'];
      const mode = step.mode || 'sequential';
      if (!validModes.includes(mode)) {
        throw new Error(`Workflow ${config.name}, step ${step.name}: invalid mode ${mode}`);
      }
    }
  }

  /**
   * Esegue un workflow
   */
  async executeWorkflow(workflowName, context = {}) {
    console.log(`\n🔄 Executing workflow: ${workflowName}`);

    const workflow = this.workflows[workflowName];
    if (!workflow) {
      throw new Error(`Workflow '${workflowName}' not found. Available: ${Object.keys(this.workflows).join(', ')}`);
    }

    const startTime = Date.now();
    const results = [];
    let previousResults = {};

    console.log(`📋 Workflow: ${workflow.description || workflow.name}`);
    console.log(`📊 Steps: ${workflow.steps.length}`);
    console.log(`⚙️  Mode: ${workflow.mode || 'sequential'}\n`);

    try {
      // Esegui steps
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        console.log(`\n▶️  Step ${i + 1}/${workflow.steps.length}: ${step.name}`);

        // Check condition se presente
        if (step.condition) {
          const shouldRun = this.evaluateCondition(step.condition, previousResults);
          if (!shouldRun) {
            console.log(`⏭️  Skipping step (condition not met): ${step.condition}`);
            results.push({
              step: step.name,
              skipped: true,
              reason: 'Condition not met'
            });
            continue;
          }
        }

        // Build task con variabili
        const task = this.interpolateTask(step.task, { ...context, ...previousResults });

        // Esegui agent
        const agentResult = await this.agentManager.executeAgent(
          step.agent,
          task,
          step.options || {}
        );

        results.push({
          step: step.name,
          agent: step.agent,
          ...agentResult
        });

        // Salva risultato per step successivi
        if (step.outputVariable) {
          previousResults[step.outputVariable] = agentResult.result;
        }

        // Stop on failure se configurato
        if (!agentResult.success && step.stopOnFailure !== false) {
          console.log(`\n❌ Workflow stopped: step ${step.name} failed`);
          break;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const successful = results.filter(r => r.success && !r.skipped).length;
      const failed = results.filter(r => !r.success && !r.skipped).length;
      const skipped = results.filter(r => r.skipped).length;

      console.log(`\n✅ Workflow completed in ${duration}s`);
      console.log(`📊 Results: ${successful} succeeded, ${failed} failed, ${skipped} skipped`);

      return {
        success: failed === 0,
        workflow: workflowName,
        steps: results,
        duration: parseFloat(duration),
        summary: {
          total: results.length,
          successful: successful,
          failed: failed,
          skipped: skipped
        }
      };

    } catch (error) {
      console.error(`❌ Workflow execution failed:`, error.message);

      return {
        success: false,
        workflow: workflowName,
        error: error.message,
        steps: results
      };
    }
  }

  /**
   * Interpola variabili nel task template
   */
  interpolateTask(taskTemplate, variables) {
    let task = taskTemplate;

    // Replace {{variable}} con valori
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      task = task.replace(regex, value || '');
    }

    return task;
  }

  /**
   * Valuta condizione per conditional execution
   */
  evaluateCondition(condition, results) {
    // Simple conditions: "stepName.success", "stepName.failed"
    const parts = condition.split('.');

    if (parts.length === 2) {
      const [varName, property] = parts;
      const value = results[varName];

      if (property === 'success') {
        return value && !value.includes('error') && !value.includes('failed');
      }

      if (property === 'failed') {
        return value && (value.includes('error') || value.includes('failed'));
      }

      if (property === 'contains') {
        // Format: "varName.contains:searchString"
        const searchString = condition.split(':')[1];
        return value && value.includes(searchString);
      }
    }

    // Default: true
    return true;
  }

  /**
   * Crea nuovo workflow
   */
  async createWorkflow(config) {
    console.log(`📝 Creating workflow: ${config.name}`);

    // Valida
    this.validateWorkflow(config);

    // Salva su disco
    const filePath = path.join(this.workflowsDir, `${config.name}.json`);
    await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');

    // Aggiungi alla cache
    this.workflows[config.name] = config;

    console.log(`✅ Workflow created: ${config.name}`);

    return {
      success: true,
      workflow: config.name,
      filePath: filePath
    };
  }

  /**
   * Aggiorna workflow esistente
   */
  async updateWorkflow(name, updates) {
    if (!this.workflows[name]) {
      throw new Error(`Workflow '${name}' not found`);
    }

    const updated = {
      ...this.workflows[name],
      ...updates,
      name: name // Preserva il nome
    };

    // Valida
    this.validateWorkflow(updated);

    // Salva
    const filePath = path.join(this.workflowsDir, `${name}.json`);
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8');

    // Update cache
    this.workflows[name] = updated;

    return {
      success: true,
      workflow: name
    };
  }

  /**
   * Elimina workflow
   */
  async deleteWorkflow(name) {
    if (!this.workflows[name]) {
      throw new Error(`Workflow '${name}' not found`);
    }

    // Elimina file
    const filePath = path.join(this.workflowsDir, `${name}.json`);
    await fs.unlink(filePath);

    // Rimuovi dalla cache
    delete this.workflows[name];

    return {
      success: true,
      workflow: name
    };
  }

  /**
   * Lista workflows disponibili
   */
  listWorkflows() {
    return Object.keys(this.workflows).map(name => {
      const workflow = this.workflows[name];
      return {
        name: workflow.name,
        description: workflow.description || '',
        steps: workflow.steps.length,
        agents: [...new Set(workflow.steps.map(s => s.agent))],
        mode: workflow.mode || 'sequential'
      };
    });
  }

  /**
   * Ottieni workflow specifico
   */
  getWorkflow(name) {
    return this.workflows[name] || null;
  }

  /**
   * Reload workflows da disco
   */
  async reloadWorkflows() {
    console.log('🔄 Reloading workflows...');
    await this.loadWorkflows();
    return this.listWorkflows();
  }
}

module.exports = WorkflowManager;
