const ClaudeService = require('../claude-service');
const FilesystemTools = require('../filesystem-tools');

/**
 * ExploreAgent - Agent specializzato nell'esplorazione del codebase
 *
 * Usa casi:
 * - "Dove vengono gestiti gli errori?"
 * - "Come funziona l'autenticazione?"
 * - "Trova tutti i file di configurazione"
 * - "Qual è la struttura del progetto?"
 */
class ExploreAgent {
  constructor(workspaceRoot) {
    this.name = 'explore';
    this.description = '🔍 Esplora il codebase, cerca pattern, risponde a domande sul codice';
    this.workspaceRoot = workspaceRoot;

    // System prompt ottimizzato per exploration
    this.systemPrompt = `You are a specialized codebase exploration agent.

Your job is to thoroughly explore and understand code repositories by:

1. **Finding Files**: Use glob patterns to locate relevant files
   - Config files: **/*.config.js, **/config/**, .env*
   - Components: **/components/**/*.{jsx,tsx}
   - Tests: **/*.{test,spec}.{js,ts}
   - etc.

2. **Searching Code**: Use grep to find patterns
   - Function definitions: "function handleError", "class ErrorHandler"
   - Imports/exports: "import.*Authentication", "export.*API"
   - Comments: "TODO", "FIXME", "@deprecated"
   - Specific patterns: "fetch(", "axios.", "console.error"

3. **Reading Files**: Read relevant files to understand implementation
   - Start with entry points (index.js, main.ts, App.jsx)
   - Follow imports/requires
   - Read related files (tests, configs)

4. **Analyzing Structure**: Understand project organization
   - Identify framework (React, Express, Next.js, etc.)
   - Locate main directories (src/, server/, public/, etc.)
   - Find configuration files
   - Understand build/deployment setup

5. **Answering Questions**: Provide specific, actionable answers
   - Include file paths with line numbers (file.js:123)
   - Quote relevant code snippets
   - Explain how things work
   - Suggest related files to check

## Output Format

Structure your findings clearly:

### Summary
Brief overview of what you found

### Key Findings
- **File**: path/to/file.js:45
  - Description of what's there
  - Relevant code snippet if needed

### Architecture Notes
- How components/modules are organized
- Key patterns used (MVC, microservices, etc.)
- Notable dependencies

### Recommendations
- Files to investigate further
- Potential issues spotted
- Related areas of codebase

## Thoroughness Levels

- **quick**: Basic glob/grep, 1-2 files read (10-20s)
- **medium**: Multiple searches, 5-10 files read (30-60s)
- **very-thorough**: Comprehensive analysis, 15+ files (2-5min)

Be systematic, thorough, and specific. Always include file paths and line numbers.`;
  }

  /**
   * Esegue l'exploration
   */
  async execute(task, thoroughness = 'medium') {
    const sessionId = `explore-${Date.now()}`;

    console.log(`\n🔍 Launching Explore Agent`);
    console.log(`📋 Task: ${task.substring(0, 100)}${task.length > 100 ? '...' : ''}`);
    console.log(`⚙️  Thoroughness: ${thoroughness}`);

    try {
      const claudeService = new ClaudeService(
        process.env.ANTHROPIC_API_KEY,
        this.workspaceRoot
      );

      // Build prompt
      const prompt = `${this.systemPrompt}\n\n## Your Task\n\n${task}\n\n## Thoroughness: ${thoroughness}\n\nBegin your exploration. Be systematic and thorough.`;

      const startTime = Date.now();
      let iterations = 0;
      const maxIterations = this.getMaxIterations(thoroughness);
      let history = [];
      let result = null;

      // Exploration loop
      while (iterations < maxIterations) {
        iterations++;
        console.log(`🔄 Iteration ${iterations}/${maxIterations}`);

        const response = await claudeService.sendMessage(
          iterations === 1 ? prompt : '',
          history,
          sessionId,
          thoroughness
        );

        // Update history
        if (iterations === 1) {
          history.push({
            role: 'user',
            content: prompt
          });
        }

        history.push({
          role: 'assistant',
          content: response.message
        });

        // Continue if there are more tool uses
        if (response.toolResults && response.toolResults.length > 0) {
          continue;
        }

        // Final result
        if (response.stopReason === 'end_turn' || !response.toolUse) {
          result = response.message;
          break;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Explore completed in ${duration}s after ${iterations} iterations`);

      return {
        success: true,
        agent: this.name,
        result: result || 'Exploration completed',
        iterations: iterations,
        duration: parseFloat(duration),
        thoroughness: thoroughness
      };

    } catch (error) {
      console.error(`❌ Explore agent failed:`, error.message);

      return {
        success: false,
        agent: this.name,
        error: error.message
      };
    }
  }

  /**
   * Determina max iterazioni in base al thoroughness
   */
  getMaxIterations(thoroughness) {
    switch (thoroughness) {
      case 'quick':
        return 5;
      case 'medium':
        return 10;
      case 'very-thorough':
        return 20;
      default:
        return 10;
    }
  }

  /**
   * Info sull'agent
   */
  getInfo() {
    return {
      name: this.name,
      description: this.description,
      type: 'builtin',
      tools: ['read', 'glob', 'grep', 'list_dir'],
      thoroughness: ['quick', 'medium', 'very-thorough'],
      examples: [
        'Dove vengono gestiti gli errori nella API?',
        'Come funziona l\'autenticazione?',
        'Trova tutti i file di configurazione',
        'Qual è la struttura del progetto?',
        'Cerca tutti i TODO nel codice'
      ]
    };
  }
}

module.exports = ExploreAgent;
