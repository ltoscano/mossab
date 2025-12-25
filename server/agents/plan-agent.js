const ClaudeService = require('../claude-service');

/**
 * PlanAgent - Agent specializzato nella pianificazione architettuale
 *
 * Casi d'uso:
 * - "Come implementare autenticazione JWT?"
 * - "Progetta un sistema di caching"
 * - "Piano per migrare da REST a GraphQL"
 * - "Architettura per real-time notifications"
 */
class PlanAgent {
  constructor(workspaceRoot) {
    this.name = 'plan';
    this.description = '🏗️ Progetta architetture e piani di implementazione step-by-step';
    this.workspaceRoot = workspaceRoot;

    // System prompt ottimizzato per planning
    this.systemPrompt = `You are a specialized software architecture and planning agent.

Your job is to design implementation plans for features and architectural changes by:

## 1. Understanding Requirements

- Clarify what needs to be built
- Identify constraints (performance, security, scalability)
- Understand existing codebase architecture
- Identify stakeholder needs

## 2. Exploring Current State

- Use tools to understand existing code structure
- Identify patterns and conventions in the project
- Find similar features already implemented
- Locate relevant files and modules

## 3. Designing Solution

Consider multiple approaches:

### Approach A: [Name]
**Pros**:
- Benefit 1
- Benefit 2

**Cons**:
- Drawback 1
- Drawback 2

**Complexity**: Low/Medium/High
**Time estimate**: Rough estimate
**Best for**: When X is priority

### Approach B: [Name]
... (same structure)

**Recommended**: Approach X because [reasoning]

## 4. Creating Implementation Plan

Break down into phases:

### Phase 1: [Name] (Priority: High/Medium/Low)
**Goal**: What this phase achieves

**Steps**:
1. **File**: path/to/file.js
   - Action: What to do
   - Details: How to do it
   - Dependencies: What needs to be done first

2. **File**: path/to/another.js
   - Action: ...

**Testing**: How to verify this phase works
**Rollback**: How to undo if needed

### Phase 2: [Name]
... (same structure)

## 5. Implementation Details

For each file modification provide:

- **Current state**: What exists now
- **Changes needed**: Specific modifications
- **New code structure**: Rough code outline
- **Imports/dependencies**: What to add
- **Tests**: What to test

## 6. Risk Analysis

**Potential Issues**:
- Risk 1: Description and mitigation
- Risk 2: Description and mitigation

**Breaking Changes**:
- What might break and how to handle it

**Migration Path**:
- How to transition safely (if applicable)

## 7. Alternative Considerations

**Quick & Dirty** (if time-constrained):
- Minimal approach
- Technical debt incurred

**Production-Ready** (if quality is priority):
- Comprehensive approach
- Additional work required

## Output Format

Your plan should be:
- **Structured**: Clear phases and steps
- **Actionable**: Specific file paths and changes
- **Realistic**: Acknowledge trade-offs
- **Comprehensive**: Cover edge cases and risks

Include:
- Architecture diagrams (ASCII art if needed)
- Code snippets for complex parts
- File tree showing new structure
- API contracts if designing endpoints

Be thorough but concise. Focus on **why** decisions are made, not just **what** to do.`;
  }

  /**
   * Esegue la pianificazione
   */
  async execute(task, context = {}) {
    const sessionId = `plan-${Date.now()}`;

    console.log(`\n🏗️  Launching Plan Agent`);
    console.log(`📋 Task: ${task.substring(0, 100)}${task.length > 100 ? '...' : ''}`);

    try {
      const claudeService = new ClaudeService(
        process.env.ANTHROPIC_API_KEY,
        this.workspaceRoot
      );

      // Build prompt with context
      let prompt = this.systemPrompt;

      if (context && Object.keys(context).length > 0) {
        prompt += '\n\n## Context Provided\n';
        for (const [key, value] of Object.entries(context)) {
          prompt += `- **${key}**: ${value}\n`;
        }
      }

      prompt += `\n\n## Your Task\n\n${task}\n\nCreate a comprehensive implementation plan. Explore the codebase first to understand the current architecture, then design the solution.`;

      const startTime = Date.now();
      let iterations = 0;
      const maxIterations = 15; // Planning needs more iterations
      let history = [];
      let result = null;

      // Planning loop
      while (iterations < maxIterations) {
        iterations++;
        console.log(`🔄 Iteration ${iterations}/${maxIterations}`);

        const response = await claudeService.sendMessage(
          iterations === 1 ? prompt : '',
          history,
          sessionId,
          'medium' // Default thoroughness for planning
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
      console.log(`✅ Plan completed in ${duration}s after ${iterations} iterations`);

      return {
        success: true,
        agent: this.name,
        result: result || 'Planning completed',
        iterations: iterations,
        duration: parseFloat(duration)
      };

    } catch (error) {
      console.error(`❌ Plan agent failed:`, error.message);

      return {
        success: false,
        agent: this.name,
        error: error.message
      };
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
      model: 'sonnet', // Planning uses sonnet for better reasoning
      examples: [
        'Come implementare autenticazione JWT?',
        'Progetta un sistema di caching con Redis',
        'Piano per migrare da REST a GraphQL',
        'Architettura per real-time notifications con WebSocket',
        'Refactoring di server/index.js in microservizi'
      ]
    };
  }
}

module.exports = PlanAgent;
