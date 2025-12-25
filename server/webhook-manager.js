const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * WebhookManager - Sistema di webhook automatici
 *
 * Permette di triggare workflows o agents in risposta a eventi:
 * - pre-commit, pre-push (Git hooks)
 * - CI/CD events (deploy, build, test)
 * - Custom events
 *
 * Features:
 * - Event-based triggering
 * - Secret validation per sicurezza
 * - Webhook history e logging
 * - Conditional execution
 */
class WebhookManager {
  constructor(workspaceRoot, agentManager, workflowManager) {
    this.workspaceRoot = workspaceRoot;
    this.agentManager = agentManager;
    this.workflowManager = workflowManager;
    this.webhooksDir = path.join(workspaceRoot, '.mossab', 'webhooks');
    this.webhooks = new Map();
    this.history = [];

    console.log('🪝 WebhookManager initialized');
  }

  /**
   * Inizializza il sistema caricando webhooks da disco
   */
  async initialize() {
    console.log('\n📦 Loading webhooks...');

    try {
      // Crea directory se non esiste
      try {
        await fs.access(this.webhooksDir);
      } catch {
        console.log(`📁 Creating webhooks directory: ${this.webhooksDir}`);
        await fs.mkdir(this.webhooksDir, { recursive: true });
      }

      // Carica webhooks salvati
      const files = await fs.readdir(this.webhooksDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        console.log('ℹ️  No webhooks found');
        return { total: 0 };
      }

      let loaded = 0;
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.webhooksDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const webhook = JSON.parse(content);

          this.webhooks.set(webhook.id, webhook);
          loaded++;
        } catch (error) {
          console.error(`❌ Failed to load webhook from ${file}:`, error.message);
        }
      }

      console.log(`✅ Loaded ${loaded} webhooks`);
      return { total: loaded };

    } catch (error) {
      console.error('❌ Error loading webhooks:', error.message);
      return { total: 0 };
    }
  }

  /**
   * Crea nuovo webhook
   */
  async createWebhook(config) {
    console.log(`📝 Creating webhook: ${config.name}`);

    // Valida config
    if (!config.name || !config.event || !config.action) {
      throw new Error('name, event, and action are required');
    }

    // Genera ID univoco
    const id = crypto.randomBytes(16).toString('hex');

    // Genera secret per validazione
    const secret = config.secret || crypto.randomBytes(32).toString('hex');

    const webhook = {
      id,
      name: config.name,
      description: config.description || '',
      event: config.event, // 'pre-commit', 'pre-push', 'ci-deploy', 'ci-test', 'custom'
      action: config.action, // { type: 'workflow' | 'agent', target: 'workflow-name' | 'agent-name', ... }
      secret,
      enabled: config.enabled !== undefined ? config.enabled : true,
      conditions: config.conditions || {}, // { branch: 'main', files: '*.js', ... }
      createdAt: new Date().toISOString(),
      executionCount: 0,
      lastExecutedAt: null
    };

    // Salva su disco
    const filePath = path.join(this.webhooksDir, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(webhook, null, 2), 'utf-8');

    // Aggiungi alla cache
    this.webhooks.set(id, webhook);

    console.log(`✅ Webhook created: ${webhook.name} (${id})`);

    return {
      success: true,
      webhook: webhook
    };
  }

  /**
   * Trigger webhook
   */
  async triggerWebhook(webhookId, payload = {}, providedSecret = null) {
    const webhook = this.webhooks.get(webhookId);

    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    if (!webhook.enabled) {
      return {
        success: false,
        error: 'Webhook is disabled'
      };
    }

    // Valida secret se fornito
    if (providedSecret && providedSecret !== webhook.secret) {
      console.warn(`⚠️  Invalid secret for webhook ${webhook.name}`);
      return {
        success: false,
        error: 'Invalid secret'
      };
    }

    console.log(`🪝 Triggering webhook: ${webhook.name}`);

    // Verifica condizioni
    if (!this.checkConditions(webhook.conditions, payload)) {
      console.log(`⏭️  Webhook conditions not met, skipping execution`);
      return {
        success: true,
        skipped: true,
        reason: 'Conditions not met'
      };
    }

    // Esegui azione
    let result;
    const startTime = Date.now();

    try {
      if (webhook.action.type === 'workflow') {
        result = await this.workflowManager.executeWorkflow(
          webhook.action.target,
          { ...payload, webhookId, webhookName: webhook.name }
        );
      } else if (webhook.action.type === 'agent') {
        result = await this.agentManager.executeAgent(
          webhook.action.target,
          webhook.action.task || payload.task || 'Execute webhook task',
          webhook.action.options || {}
        );
      } else {
        throw new Error(`Unknown action type: ${webhook.action.type}`);
      }

      const duration = (Date.now() - startTime) / 1000;

      // Update webhook stats
      webhook.executionCount++;
      webhook.lastExecutedAt = new Date().toISOString();
      await this.saveWebhook(webhook);

      // Add to history
      this.addToHistory({
        webhookId,
        webhookName: webhook.name,
        event: webhook.event,
        timestamp: new Date().toISOString(),
        duration,
        success: result.success || true,
        result
      });

      console.log(`✅ Webhook executed successfully (${duration.toFixed(2)}s)`);

      return {
        success: true,
        result,
        duration
      };

    } catch (error) {
      console.error(`❌ Webhook execution failed:`, error.message);

      this.addToHistory({
        webhookId,
        webhookName: webhook.name,
        event: webhook.event,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Trigger webhook by event
   */
  async triggerByEvent(event, payload = {}) {
    console.log(`🎯 Triggering webhooks for event: ${event}`);

    const matchingWebhooks = Array.from(this.webhooks.values())
      .filter(w => w.event === event && w.enabled);

    if (matchingWebhooks.length === 0) {
      console.log(`ℹ️  No webhooks found for event: ${event}`);
      return {
        success: true,
        triggered: 0
      };
    }

    console.log(`📋 Found ${matchingWebhooks.length} webhooks for event ${event}`);

    const results = await Promise.all(
      matchingWebhooks.map(w => this.triggerWebhook(w.id, payload))
    );

    const successful = results.filter(r => r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    const failed = results.filter(r => !r.success).length;

    return {
      success: true,
      triggered: matchingWebhooks.length,
      successful,
      skipped,
      failed,
      results
    };
  }

  /**
   * Verifica condizioni webhook
   */
  checkConditions(conditions, payload) {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    // Check branch condition
    if (conditions.branch && payload.branch) {
      if (conditions.branch !== payload.branch) {
        return false;
      }
    }

    // Check files pattern
    if (conditions.files && payload.files) {
      const pattern = new RegExp(conditions.files);
      const hasMatchingFile = payload.files.some(f => pattern.test(f));
      if (!hasMatchingFile) {
        return false;
      }
    }

    // Check custom conditions
    if (conditions.custom && typeof conditions.custom === 'function') {
      return conditions.custom(payload);
    }

    return true;
  }

  /**
   * Lista webhooks
   */
  listWebhooks() {
    return Array.from(this.webhooks.values()).map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      event: w.event,
      action: w.action,
      enabled: w.enabled,
      executionCount: w.executionCount,
      lastExecutedAt: w.lastExecutedAt,
      createdAt: w.createdAt
    }));
  }

  /**
   * Get webhook by ID
   */
  getWebhook(id) {
    return this.webhooks.get(id);
  }

  /**
   * Update webhook
   */
  async updateWebhook(id, updates) {
    const webhook = this.webhooks.get(id);

    if (!webhook) {
      throw new Error(`Webhook ${id} not found`);
    }

    // Merge updates
    const updated = {
      ...webhook,
      ...updates,
      id: webhook.id, // Preserve ID
      secret: updates.secret || webhook.secret, // Preserve secret if not updating
      executionCount: webhook.executionCount, // Preserve stats
      lastExecutedAt: webhook.lastExecutedAt,
      createdAt: webhook.createdAt,
      updatedAt: new Date().toISOString()
    };

    await this.saveWebhook(updated);
    this.webhooks.set(id, updated);

    console.log(`✅ Webhook updated: ${updated.name}`);

    return {
      success: true,
      webhook: updated
    };
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(id) {
    const webhook = this.webhooks.get(id);

    if (!webhook) {
      throw new Error(`Webhook ${id} not found`);
    }

    // Delete file
    const filePath = path.join(this.webhooksDir, `${id}.json`);
    await fs.unlink(filePath);

    // Remove from cache
    this.webhooks.delete(id);

    console.log(`✅ Webhook deleted: ${webhook.name}`);

    return {
      success: true,
      webhook: webhook.name
    };
  }

  /**
   * Toggle webhook enabled/disabled
   */
  async toggleWebhook(id) {
    const webhook = this.webhooks.get(id);

    if (!webhook) {
      throw new Error(`Webhook ${id} not found`);
    }

    webhook.enabled = !webhook.enabled;
    await this.saveWebhook(webhook);

    console.log(`✅ Webhook ${webhook.enabled ? 'enabled' : 'disabled'}: ${webhook.name}`);

    return {
      success: true,
      webhook: webhook.name,
      enabled: webhook.enabled
    };
  }

  /**
   * Save webhook to disk
   */
  async saveWebhook(webhook) {
    const filePath = path.join(this.webhooksDir, `${webhook.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(webhook, null, 2), 'utf-8');
  }

  /**
   * Add to execution history
   */
  addToHistory(entry) {
    this.history.unshift(entry);

    // Keep only last 100 entries
    if (this.history.length > 100) {
      this.history = this.history.slice(0, 100);
    }
  }

  /**
   * Get execution history
   */
  getHistory(limit = 50) {
    return this.history.slice(0, limit);
  }

  /**
   * Get stats
   */
  getStats() {
    const total = this.webhooks.size;
    const enabled = Array.from(this.webhooks.values()).filter(w => w.enabled).length;
    const disabled = total - enabled;

    const totalExecutions = Array.from(this.webhooks.values())
      .reduce((sum, w) => sum + w.executionCount, 0);

    const eventTypes = {};
    this.webhooks.forEach(w => {
      eventTypes[w.event] = (eventTypes[w.event] || 0) + 1;
    });

    return {
      total,
      enabled,
      disabled,
      totalExecutions,
      eventTypes,
      recentExecutions: this.history.length
    };
  }

  /**
   * Generate webhook URL
   */
  getWebhookUrl(id, baseUrl = 'http://localhost:3000') {
    const webhook = this.webhooks.get(id);
    if (!webhook) return null;

    return `${baseUrl}/api/webhooks/trigger/${id}`;
  }

  /**
   * Generate Git hook script
   */
  generateGitHookScript(webhookId, event) {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    const script = `#!/bin/bash
# Mossab Webhook - ${webhook.name}
# Event: ${event}
# Generated: ${new Date().toISOString()}

WEBHOOK_URL="http://localhost:3000/api/webhooks/trigger/${webhookId}"
SECRET="${webhook.secret}"

# Get git info
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse HEAD)
AUTHOR=$(git log -1 --pretty=format:'%an')

# Get changed files (for pre-commit)
if [ "${event}" = "pre-commit" ]; then
  FILES=$(git diff --cached --name-only)
else
  FILES=$(git diff --name-only HEAD~1)
fi

# Create payload
PAYLOAD=$(cat <<EOF
{
  "event": "${event}",
  "branch": "$BRANCH",
  "commit": "$COMMIT",
  "author": "$AUTHOR",
  "files": ["$FILES"],
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)

# Trigger webhook
curl -X POST "$WEBHOOK_URL" \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Secret: $SECRET" \\
  -d "$PAYLOAD" \\
  --silent

exit 0
`;

    return script;
  }
}

module.exports = WebhookManager;
