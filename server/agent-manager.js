const fs = require('fs').promises;
const path = require('path');
const CustomAgent = require('./agents/custom-agent');
const ExploreAgent = require('./agents/explore-agent');
const PlanAgent = require('./agents/plan-agent');

/**
 * AgentManager - Sistema di orchestrazione agents
 *
 * Gestisce:
 * - Caricamento agents (builtin + custom)
 * - Esecuzione agents (singoli o paralleli)
 * - Listing agents disponibili
 * - Hot-reload di custom agents
 */
class AgentManager {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.agentsDir = path.join(workspaceRoot, '.mossab', 'agents');

    // Built-in agents (sempre disponibili)
    this.builtinAgents = {
      explore: new ExploreAgent(workspaceRoot),
      plan: new PlanAgent(workspaceRoot)
    };

    // Custom agents (caricati da .mossab/agents/)
    this.customAgents = {};

    // Stats
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalDuration: 0,
      agentUsage: {} // { agentName: count }
    };

    console.log('🤖 AgentManager initialized');
  }

  /**
   * Inizializza il sistema caricando tutti gli agents
   */
  async initialize() {
    console.log('\n📦 Loading agents...');

    // Carica built-in agents
    console.log(`✅ Loaded ${Object.keys(this.builtinAgents).length} built-in agents: ${Object.keys(this.builtinAgents).join(', ')}`);

    // Carica custom agents
    await this.loadCustomAgents();

    const totalAgents = Object.keys(this.builtinAgents).length + Object.keys(this.customAgents).length;
    console.log(`\n🎯 Total agents available: ${totalAgents}`);

    return {
      builtin: Object.keys(this.builtinAgents).length,
      custom: Object.keys(this.customAgents).length,
      total: totalAgents
    };
  }

  /**
   * Carica custom agents da .mossab/agents/*.json
   */
  async loadCustomAgents() {
    this.customAgents = {}; // Reset

    try {
      // Verifica se la directory esiste
      try {
        await fs.access(this.agentsDir);
      } catch {
        console.log(`📁 Creating agents directory: ${this.agentsDir}`);
        await fs.mkdir(this.agentsDir, { recursive: true });
        return;
      }

      // Leggi tutti i file JSON
      const files = await fs.readdir(this.agentsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        console.log('ℹ️  No custom agents found in .mossab/agents/');
        return;
      }

      console.log(`📂 Found ${jsonFiles.length} custom agent config files`);

      // Carica ogni agent
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.agentsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const config = JSON.parse(content);

          // Crea l'agent
          const agent = new CustomAgent(config, this.workspaceRoot);
          this.customAgents[agent.name] = agent;

        } catch (error) {
          console.error(`❌ Failed to load agent from ${file}:`, error.message);
        }
      }

      const loadedCount = Object.keys(this.customAgents).length;
      console.log(`✅ Loaded ${loadedCount} custom agents: ${Object.keys(this.customAgents).join(', ')}`);

    } catch (error) {
      console.error('❌ Error loading custom agents:', error.message);
    }
  }

  /**
   * Ricarica custom agents (hot-reload)
   */
  async reloadCustomAgents() {
    console.log('🔄 Reloading custom agents...');
    await this.loadCustomAgents();
    return this.listAgents();
  }

  /**
   * Esegue un agent
   */
  async executeAgent(agentName, task, options = {}) {
    console.log(`\n🚀 Executing agent: ${agentName}`);

    // Trova l'agent
    const agent = this.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent '${agentName}' not found. Available agents: ${this.listAgentNames().join(', ')}`);
    }

    // Track usage
    this.stats.totalExecutions++;
    this.stats.agentUsage[agentName] = (this.stats.agentUsage[agentName] || 0) + 1;

    // Esegui
    try {
      const result = await agent.execute(task, options);

      // Update stats
      if (result.success) {
        this.stats.successfulExecutions++;
        this.stats.totalDuration += result.duration || 0;
      } else {
        this.stats.failedExecutions++;
      }

      return result;

    } catch (error) {
      this.stats.failedExecutions++;

      return {
        success: false,
        agent: agentName,
        error: error.message
      };
    }
  }

  /**
   * Esegue multipli agents in parallelo
   */
  async executeParallel(agentTasks) {
    console.log(`\n⚡ Executing ${agentTasks.length} agents in parallel...`);

    const promises = agentTasks.map(({ agent, task, options }) =>
      this.executeAgent(agent, task, options)
    );

    const results = await Promise.all(promises);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\n✅ Parallel execution completed: ${successful} succeeded, ${failed} failed`);

    return {
      success: failed === 0,
      results: results,
      summary: {
        total: agentTasks.length,
        successful: successful,
        failed: failed
      }
    };
  }

  /**
   * Trova un agent (builtin o custom)
   */
  getAgent(agentName) {
    // Cerca prima nei builtin
    if (this.builtinAgents[agentName]) {
      return this.builtinAgents[agentName];
    }

    // Poi nei custom
    if (this.customAgents[agentName]) {
      return this.customAgents[agentName];
    }

    return null;
  }

  /**
   * Lista tutti gli agents disponibili
   */
  listAgents() {
    const builtin = Object.keys(this.builtinAgents).map(name => ({
      name: name,
      type: 'builtin',
      ...this.builtinAgents[name].getInfo()
    }));

    const custom = Object.keys(this.customAgents).map(name => ({
      name: name,
      type: 'custom',
      ...this.customAgents[name].getInfo()
    }));

    return {
      builtin: builtin,
      custom: custom,
      total: builtin.length + custom.length
    };
  }

  /**
   * Lista solo i nomi degli agents
   */
  listAgentNames() {
    return [
      ...Object.keys(this.builtinAgents),
      ...Object.keys(this.customAgents)
    ];
  }

  /**
   * Info su un agent specifico
   */
  getAgentInfo(agentName) {
    const agent = this.getAgent(agentName);
    if (!agent) {
      return null;
    }

    const info = agent.getInfo();
    const usage = this.stats.agentUsage[agentName] || 0;

    return {
      ...info,
      usage: usage,
      type: this.builtinAgents[agentName] ? 'builtin' : 'custom'
    };
  }

  /**
   * Statistiche di utilizzo
   */
  getStats() {
    const avgDuration = this.stats.successfulExecutions > 0
      ? (this.stats.totalDuration / this.stats.successfulExecutions).toFixed(2)
      : 0;

    const successRate = this.stats.totalExecutions > 0
      ? ((this.stats.successfulExecutions / this.stats.totalExecutions) * 100).toFixed(1)
      : 0;

    return {
      totalExecutions: this.stats.totalExecutions,
      successfulExecutions: this.stats.successfulExecutions,
      failedExecutions: this.stats.failedExecutions,
      successRate: `${successRate}%`,
      totalDuration: `${this.stats.totalDuration.toFixed(2)}s`,
      averageDuration: `${avgDuration}s`,
      agentUsage: this.stats.agentUsage,
      mostUsedAgent: this.getMostUsedAgent()
    };
  }

  /**
   * Trova l'agent più usato
   */
  getMostUsedAgent() {
    const entries = Object.entries(this.stats.agentUsage);
    if (entries.length === 0) {
      return null;
    }

    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return {
      name: sorted[0][0],
      count: sorted[0][1]
    };
  }

  /**
   * Reset statistiche
   */
  resetStats() {
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalDuration: 0,
      agentUsage: {}
    };

    console.log('📊 Stats reset');
    return { success: true };
  }

  /**
   * Verifica se un agent esiste
   */
  hasAgent(agentName) {
    return this.getAgent(agentName) !== null;
  }

  /**
   * Suggerisci agent per un task
   */
  suggestAgent(task) {
    const taskLower = task.toLowerCase();

    // Pattern matching per suggerire l'agent giusto
    if (taskLower.includes('esplora') || taskLower.includes('trova') || taskLower.includes('cerca') || taskLower.includes('dove')) {
      return 'explore';
    }

    if (taskLower.includes('piano') || taskLower.includes('progetta') || taskLower.includes('architettura') || taskLower.includes('implementa')) {
      return 'plan';
    }

    if (taskLower.includes('security') || taskLower.includes('vulnerabilità') || taskLower.includes('sicurezza')) {
      return this.hasAgent('security-audit') ? 'security-audit' : null;
    }

    if (taskLower.includes('performance') || taskLower.includes('ottimizza') || taskLower.includes('lento')) {
      return this.hasAgent('perf-profiler') ? 'perf-profiler' : null;
    }

    if (taskLower.includes('test') || taskLower.includes('coverage')) {
      return this.hasAgent('test-coverage') ? 'test-coverage' : null;
    }

    if (taskLower.includes('doc') || taskLower.includes('documentazione')) {
      return this.hasAgent('doc-generator') ? 'doc-generator' : null;
    }

    if (taskLower.includes('database') || taskLower.includes('query') || taskLower.includes('sql')) {
      return this.hasAgent('db-optimizer') ? 'db-optimizer' : null;
    }

    // Default: explore per task generici
    return 'explore';
  }

  /**
   * AGENT COMPOSER METHODS
   * Creazione/modifica agents via API senza scrivere JSON
   */

  /**
   * Crea nuovo agent custom
   */
  async createAgent(config) {
    console.log(`📝 Creating custom agent: ${config.name}`);

    // Valida nome
    if (!config.name || !/^[a-z0-9-]+$/.test(config.name)) {
      throw new Error('Agent name must be lowercase alphanumeric with hyphens (e.g., my-agent)');
    }

    // Check se esiste già
    if (this.builtinAgents[config.name]) {
      throw new Error(`Cannot override builtin agent: ${config.name}`);
    }

    if (this.customAgents[config.name]) {
      throw new Error(`Agent ${config.name} already exists. Use updateAgent to modify it.`);
    }

    // Valida config
    const agentConfig = this.buildAgentConfig(config);

    // Salva su disco
    const filePath = path.join(this.agentsDir, `${config.name}.json`);
    await fs.writeFile(filePath, JSON.stringify(agentConfig, null, 2), 'utf-8');

    // Carica l'agent
    const agent = new CustomAgent(agentConfig, this.workspaceRoot);
    this.customAgents[config.name] = agent;

    console.log(`✅ Agent created: ${config.name}`);

    return {
      success: true,
      agent: config.name,
      filePath: filePath
    };
  }

  /**
   * Aggiorna agent esistente
   */
  async updateAgent(name, updates) {
    if (!this.customAgents[name]) {
      throw new Error(`Agent ${name} not found. Use createAgent to create it.`);
    }

    // Leggi config corrente
    const filePath = path.join(this.agentsDir, `${name}.json`);
    const currentContent = await fs.readFile(filePath, 'utf-8');
    const currentConfig = JSON.parse(currentContent);

    // Merge updates
    const updatedConfig = this.buildAgentConfig({
      ...currentConfig,
      ...updates,
      name: name // Preserva il nome
    });

    // Salva
    await fs.writeFile(filePath, JSON.stringify(updatedConfig, null, 2), 'utf-8');

    // Reload agent
    const agent = new CustomAgent(updatedConfig, this.workspaceRoot);
    this.customAgents[name] = agent;

    console.log(`✅ Agent updated: ${name}`);

    return {
      success: true,
      agent: name
    };
  }

  /**
   * Elimina agent custom
   */
  async deleteAgent(name) {
    if (this.builtinAgents[name]) {
      throw new Error(`Cannot delete builtin agent: ${name}`);
    }

    if (!this.customAgents[name]) {
      throw new Error(`Agent ${name} not found`);
    }

    // Elimina file
    const filePath = path.join(this.agentsDir, `${name}.json`);
    await fs.unlink(filePath);

    // Rimuovi dalla cache
    delete this.customAgents[name];

    console.log(`✅ Agent deleted: ${name}`);

    return {
      success: true,
      agent: name
    };
  }

  /**
   * Build agent config da parametri user-friendly
   */
  buildAgentConfig(params) {
    return {
      name: params.name,
      description: params.description || `Custom agent: ${params.name}`,
      model: params.model || 'sonnet',
      tools: params.tools || ['read', 'grep', 'glob'],
      system_prompt: params.system_prompt || params.systemPrompt || 'You are a helpful AI assistant.',
      thoroughness: params.thoroughness || 'medium',
      max_iterations: params.max_iterations || params.maxIterations || 5,
      parallel: params.parallel !== undefined ? params.parallel : false,
      examples: params.examples || []
    };
  }

  /**
   * Genera template agent basato su tipo
   */
  generateAgentTemplate(type) {
    const templates = {
      'code-analyzer': {
        name: 'my-code-analyzer',
        description: 'Analyzes code for patterns and issues',
        model: 'sonnet',
        tools: ['read', 'grep', 'glob'],
        system_prompt: 'You are an expert code analyzer. Examine code for:\n- Code smells\n- Anti-patterns\n- Maintainability issues\n- Best practices violations\n\nProvide specific file paths and line numbers with suggestions.',
        thoroughness: 'medium',
        max_iterations: 8
      },
      'api-designer': {
        name: 'my-api-designer',
        description: 'Designs RESTful API endpoints',
        model: 'sonnet',
        tools: ['read', 'glob'],
        system_prompt: 'You are an API design expert. Design RESTful APIs following:\n- REST principles\n- Proper HTTP methods\n- Clear endpoint naming\n- Appropriate status codes\n- Request/response schemas\n\nProvide OpenAPI/Swagger specs when possible.',
        thoroughness: 'medium',
        max_iterations: 5
      },
      'bug-hunter': {
        name: 'my-bug-hunter',
        description: 'Finds bugs and potential issues',
        model: 'opus',
        tools: ['read', 'grep', 'glob', 'bash'],
        system_prompt: 'You are a bug hunter. Find:\n- Logic errors\n- Edge cases not handled\n- Race conditions\n- Null pointer issues\n- Off-by-one errors\n\nFor each bug: file path, line number, description, severity, fix suggestion.',
        thoroughness: 'very-thorough',
        max_iterations: 10
      },
      'refactoring-assistant': {
        name: 'my-refactoring-assistant',
        description: 'Suggests code refactoring opportunities',
        model: 'sonnet',
        tools: ['read', 'grep', 'glob'],
        system_prompt: 'You are a refactoring expert. Identify:\n- Duplicate code\n- Long functions/classes\n- Complex conditionals\n- God objects\n- Feature envy\n\nSuggest refactoring with before/after code examples.',
        thoroughness: 'medium',
        max_iterations: 8
      }
    };

    return templates[type] || null;
  }
}

module.exports = AgentManager;
