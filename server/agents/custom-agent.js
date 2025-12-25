const ClaudeService = require('../claude-service');
const FilesystemTools = require('../filesystem-tools');
const GitToolsManager = require('../git-tools-manager');
const CodeReviewer = require('../code-reviewer');
const PRTemplateManager = require('../pr-template-manager');

/**
 * CustomAgent - Esegue agents personalizzati definiti dagli utenti
 *
 * Ogni custom agent:
 * - Ha il suo system prompt specializzato
 * - Accede solo ai tools specificati nella config
 * - Lavora in isolamento (sessione separata)
 * - Può usare modelli diversi (haiku/sonnet/opus)
 */
class CustomAgent {
  constructor(config, workspaceRoot) {
    this.name = config.name;
    this.description = config.description;
    this.model = config.model || 'sonnet';
    this.allowedTools = config.tools || [];
    this.systemPrompt = config.system_prompt;
    this.thoroughness = config.thoroughness || 'medium';
    this.maxIterations = config.max_iterations || 5;
    this.parallel = config.parallel !== undefined ? config.parallel : false;
    this.examples = config.examples || [];
    this.workspaceRoot = workspaceRoot;

    // Valida configurazione
    this.validate();

    console.log(`✅ Custom agent loaded: ${this.name} (model: ${this.model}, tools: ${this.allowedTools.length})`);
  }

  /**
   * Valida la configurazione dell'agent
   */
  validate() {
    if (!this.name) {
      throw new Error('Agent config missing: name');
    }

    if (!this.systemPrompt) {
      throw new Error(`Agent ${this.name} missing: system_prompt`);
    }

    const validModels = ['haiku', 'sonnet', 'opus'];
    if (!validModels.includes(this.model)) {
      throw new Error(`Agent ${this.name} invalid model: ${this.model}. Use: ${validModels.join(', ')}`);
    }

    const validThoroughness = ['quick', 'medium', 'very-thorough'];
    if (!validThoroughness.includes(this.thoroughness)) {
      throw new Error(`Agent ${this.name} invalid thoroughness: ${this.thoroughness}`);
    }
  }

  /**
   * Esegue l'agent per un task specifico
   */
  async execute(task, context = {}) {
    const sessionId = `agent-${this.name}-${Date.now()}`;

    console.log(`\n🤖 Launching custom agent: ${this.name}`);
    console.log(`📋 Task: ${task.substring(0, 100)}${task.length > 100 ? '...' : ''}`);
    console.log(`🎯 Model: ${this.model}`);
    console.log(`🔧 Tools: ${this.allowedTools.join(', ')}`);
    console.log(`⚙️  Thoroughness: ${this.thoroughness}`);
    console.log(`🔄 Max iterations: ${this.maxIterations}`);

    try {
      // Crea ClaudeService isolato per questo agent
      const claudeService = new ClaudeService(
        process.env.ANTHROPIC_API_KEY,
        this.workspaceRoot
      );

      // Filtra tools disponibili
      const filteredTools = this.getFilteredTools();

      // Override tools nel claudeService
      claudeService.filesystemTools = new FilesystemTools(this.workspaceRoot);
      claudeService.gitTools = new GitToolsManager(this.workspaceRoot);
      claudeService.codeReviewer = new CodeReviewer(this.workspaceRoot);
      claudeService.prTemplateManager = new PRTemplateManager(this.workspaceRoot);

      // Build prompt completo
      const fullPrompt = this.buildPrompt(task, context);

      // Esegui agent
      const startTime = Date.now();
      let iterations = 0;
      let history = [];
      let result = null;

      // Loop di esecuzione con limite iterazioni
      while (iterations < this.maxIterations) {
        iterations++;
        console.log(`\n🔄 Iteration ${iterations}/${this.maxIterations}`);

        const response = await claudeService.sendMessage(
          iterations === 1 ? fullPrompt : '',
          history,
          sessionId,
          this.thoroughness
        );

        // Aggiungi alla history
        if (iterations === 1) {
          history.push({
            role: 'user',
            content: fullPrompt
          });
        }

        history.push({
          role: 'assistant',
          content: response.message
        });

        // Se ci sono tool results, aggiungili alla history
        if (response.toolResults && response.toolResults.length > 0) {
          // Continua il loop per processare i tool results
          continue;
        }

        // Se non ci sono più tool use, abbiamo il risultato finale
        if (response.stopReason === 'end_turn' || !response.toolUse) {
          result = response.message;
          break;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`\n✅ Agent completed in ${duration}s after ${iterations} iterations`);

      return {
        success: true,
        agent: this.name,
        result: result || 'Agent completed but returned no final message',
        iterations: iterations,
        duration: parseFloat(duration),
        model: this.model,
        thoroughness: this.thoroughness
      };

    } catch (error) {
      console.error(`❌ Agent ${this.name} failed:`, error.message);

      return {
        success: false,
        agent: this.name,
        error: error.message,
        iterations: 0,
        duration: 0
      };
    }
  }

  /**
   * Costruisce il prompt completo per l'agent
   */
  buildPrompt(task, context) {
    let prompt = this.systemPrompt;

    // Aggiungi context se fornito
    if (context && Object.keys(context).length > 0) {
      prompt += '\n\n## Context\n';
      for (const [key, value] of Object.entries(context)) {
        prompt += `- **${key}**: ${value}\n`;
      }
    }

    // Aggiungi esempi se disponibili
    if (this.examples.length > 0) {
      prompt += '\n\n## Examples\n';
      this.examples.forEach((example, i) => {
        prompt += `\n### Example ${i + 1}\n`;
        prompt += `**Input**: ${example.input}\n`;
        prompt += `**Output**: ${example.output}\n`;
      });
    }

    // Aggiungi task
    prompt += `\n\n## Your Task\n\n${task}`;

    // Aggiungi constraints
    prompt += '\n\n## Constraints\n';
    prompt += `- You have access to these tools: ${this.allowedTools.join(', ')}\n`;
    prompt += `- Maximum iterations: ${this.maxIterations}\n`;
    prompt += `- Thoroughness level: ${this.thoroughness}\n`;
    prompt += '- Provide a structured, actionable report\n';
    prompt += '- Include specific file paths and line numbers when relevant\n';

    return prompt;
  }

  /**
   * Filtra i tools disponibili in base alla config dell'agent
   */
  getFilteredTools() {
    // Get all available tools
    const filesystemTools = new FilesystemTools(this.workspaceRoot);
    const gitTools = new GitToolsManager(this.workspaceRoot);
    const codeReviewer = new CodeReviewer(this.workspaceRoot);

    const allTools = [
      ...filesystemTools.getToolDefinitions(),
      ...gitTools.getToolDefinitions(),
      ...codeReviewer.getToolDefinitions()
    ];

    // Filtra solo i tools permessi
    const filtered = allTools.filter(tool =>
      this.allowedTools.includes(tool.name)
    );

    console.log(`🔧 Filtered ${filtered.length}/${allTools.length} tools for agent ${this.name}`);

    return filtered;
  }

  /**
   * Ritorna info sull'agent
   */
  getInfo() {
    return {
      name: this.name,
      description: this.description,
      model: this.model,
      tools: this.allowedTools,
      thoroughness: this.thoroughness,
      maxIterations: this.maxIterations,
      parallel: this.parallel,
      exampleCount: this.examples.length
    };
  }
}

module.exports = CustomAgent;
