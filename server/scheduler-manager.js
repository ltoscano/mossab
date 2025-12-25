const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * SchedulerManager - Sistema di scheduling automatico
 *
 * Permette di eseguire workflows automaticamente su schedule:
 * - Cron-based scheduling
 * - Recurring workflows (hourly, daily, weekly, monthly)
 * - One-time scheduled executions
 *
 * Features:
 * - Cron expression support
 * - Schedule persistence
 * - Execution history
 * - Pause/resume schedules
 * - Next run calculation
 */
class SchedulerManager {
  constructor(workspaceRoot, workflowManager) {
    this.workspaceRoot = workspaceRoot;
    this.workflowManager = workflowManager;
    this.schedulesDir = path.join(workspaceRoot, '.mossab', 'schedules');
    this.schedules = new Map();
    this.timers = new Map();
    this.history = [];

    console.log('⏰ SchedulerManager initialized');
  }

  /**
   * Inizializza il sistema caricando schedules da disco
   */
  async initialize() {
    console.log('\n📦 Loading schedules...');

    try {
      // Crea directory se non esiste
      try {
        await fs.access(this.schedulesDir);
      } catch {
        console.log(`📁 Creating schedules directory: ${this.schedulesDir}`);
        await fs.mkdir(this.schedulesDir, { recursive: true });
      }

      // Carica schedules salvati
      const files = await fs.readdir(this.schedulesDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        console.log('ℹ️  No schedules found');
        return { total: 0, active: 0 };
      }

      let loaded = 0;
      let active = 0;

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.schedulesDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const schedule = JSON.parse(content);

          this.schedules.set(schedule.id, schedule);
          loaded++;

          // Start active schedules
          if (schedule.enabled) {
            this.startSchedule(schedule.id);
            active++;
          }
        } catch (error) {
          console.error(`❌ Failed to load schedule from ${file}:`, error.message);
        }
      }

      console.log(`✅ Loaded ${loaded} schedules (${active} active)`);
      return { total: loaded, active };

    } catch (error) {
      console.error('❌ Error loading schedules:', error.message);
      return { total: 0, active: 0 };
    }
  }

  /**
   * Crea nuovo schedule
   */
  async createSchedule(config) {
    console.log(`📝 Creating schedule: ${config.name}`);

    // Valida config
    if (!config.name || !config.workflow) {
      throw new Error('name and workflow are required');
    }

    if (!config.cron && !config.interval) {
      throw new Error('Either cron expression or interval is required');
    }

    // Genera ID univoco
    const id = crypto.randomBytes(16).toString('hex');

    const schedule = {
      id,
      name: config.name,
      description: config.description || '',
      workflow: config.workflow,
      cron: config.cron || null, // Cron expression (e.g., '0 */6 * * *')
      interval: config.interval || null, // Interval in minutes (e.g., 60 for hourly)
      context: config.context || {}, // Context to pass to workflow
      enabled: config.enabled !== undefined ? config.enabled : true,
      timezone: config.timezone || 'UTC',
      createdAt: new Date().toISOString(),
      executionCount: 0,
      lastExecutedAt: null,
      nextRunAt: null
    };

    // Calculate next run
    schedule.nextRunAt = this.calculateNextRun(schedule);

    // Salva su disco
    const filePath = path.join(this.schedulesDir, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(schedule, null, 2), 'utf-8');

    // Aggiungi alla cache
    this.schedules.set(id, schedule);

    // Start schedule if enabled
    if (schedule.enabled) {
      this.startSchedule(id);
    }

    console.log(`✅ Schedule created: ${schedule.name} (${id})`);

    return {
      success: true,
      schedule: schedule
    };
  }

  /**
   * Start schedule
   */
  startSchedule(scheduleId) {
    const schedule = this.schedules.get(scheduleId);

    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    // Clear existing timer if any
    if (this.timers.has(scheduleId)) {
      clearInterval(this.timers.get(scheduleId));
    }

    console.log(`▶️  Starting schedule: ${schedule.name}`);

    // Calculate interval in milliseconds
    let intervalMs;

    if (schedule.interval) {
      // Simple interval-based scheduling (in minutes)
      intervalMs = schedule.interval * 60 * 1000;
    } else if (schedule.cron) {
      // For cron, we'll check every minute if it's time to run
      intervalMs = 60 * 1000; // Check every minute
    } else {
      throw new Error('No cron or interval specified');
    }

    // Set up timer
    const timer = setInterval(async () => {
      await this.checkAndExecute(scheduleId);
    }, intervalMs);

    this.timers.set(scheduleId, timer);

    // Execute immediately if it's past the next run time
    const now = new Date();
    const nextRun = new Date(schedule.nextRunAt);
    if (nextRun <= now) {
      this.executeSchedule(scheduleId);
    }
  }

  /**
   * Stop schedule
   */
  stopSchedule(scheduleId) {
    const schedule = this.schedules.get(scheduleId);

    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    console.log(`⏸️  Stopping schedule: ${schedule.name}`);

    if (this.timers.has(scheduleId)) {
      clearInterval(this.timers.get(scheduleId));
      this.timers.delete(scheduleId);
    }
  }

  /**
   * Check if it's time to execute and run if needed
   */
  async checkAndExecute(scheduleId) {
    const schedule = this.schedules.get(scheduleId);

    if (!schedule || !schedule.enabled) {
      return;
    }

    const now = new Date();

    // For interval-based schedules, always execute
    if (schedule.interval) {
      await this.executeSchedule(scheduleId);
      return;
    }

    // For cron-based schedules, check if it's time
    if (schedule.cron && schedule.nextRunAt) {
      const nextRun = new Date(schedule.nextRunAt);

      if (now >= nextRun) {
        await this.executeSchedule(scheduleId);
      }
    }
  }

  /**
   * Execute schedule
   */
  async executeSchedule(scheduleId) {
    const schedule = this.schedules.get(scheduleId);

    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    console.log(`⏰ Executing scheduled workflow: ${schedule.workflow}`);

    const startTime = Date.now();

    try {
      const result = await this.workflowManager.executeWorkflow(
        schedule.workflow,
        {
          ...schedule.context,
          scheduleId,
          scheduleName: schedule.name,
          scheduledAt: new Date().toISOString()
        }
      );

      const duration = (Date.now() - startTime) / 1000;

      // Update schedule stats
      schedule.executionCount++;
      schedule.lastExecutedAt = new Date().toISOString();
      schedule.nextRunAt = this.calculateNextRun(schedule);

      await this.saveSchedule(schedule);

      // Add to history
      this.addToHistory({
        scheduleId,
        scheduleName: schedule.name,
        workflow: schedule.workflow,
        timestamp: new Date().toISOString(),
        duration,
        success: result.success || true,
        result
      });

      console.log(`✅ Scheduled workflow executed successfully (${duration.toFixed(2)}s)`);
      console.log(`📅 Next run: ${schedule.nextRunAt}`);

      return {
        success: true,
        result,
        duration,
        nextRunAt: schedule.nextRunAt
      };

    } catch (error) {
      console.error(`❌ Scheduled workflow execution failed:`, error.message);

      schedule.nextRunAt = this.calculateNextRun(schedule);
      await this.saveSchedule(schedule);

      this.addToHistory({
        scheduleId,
        scheduleName: schedule.name,
        workflow: schedule.workflow,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        nextRunAt: schedule.nextRunAt
      };
    }
  }

  /**
   * Calculate next run time
   */
  calculateNextRun(schedule) {
    const now = new Date();

    if (schedule.interval) {
      // Simple interval: add interval minutes to now
      const nextRun = new Date(now.getTime() + schedule.interval * 60 * 1000);
      return nextRun.toISOString();
    }

    if (schedule.cron) {
      // Parse cron expression (simplified implementation)
      // Format: minute hour day month dayOfWeek
      const parts = schedule.cron.split(' ');

      if (parts.length !== 5) {
        console.warn(`Invalid cron expression: ${schedule.cron}, using default interval`);
        const nextRun = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
        return nextRun.toISOString();
      }

      // For simplicity, calculate next run based on common patterns
      const [minute, hour, day, month, dayOfWeek] = parts;

      const nextRun = new Date(now);

      // Handle common patterns
      if (schedule.cron === '0 0 * * *') {
        // Daily at midnight
        nextRun.setHours(0, 0, 0, 0);
        nextRun.setDate(nextRun.getDate() + 1);
      } else if (schedule.cron === '0 */6 * * *') {
        // Every 6 hours
        const currentHour = nextRun.getHours();
        const nextHour = Math.ceil((currentHour + 1) / 6) * 6;
        nextRun.setHours(nextHour, 0, 0, 0);
        if (nextHour >= 24) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
      } else if (schedule.cron === '0 * * * *') {
        // Every hour
        nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);
      } else if (schedule.cron === '*/15 * * * *') {
        // Every 15 minutes
        const currentMinute = nextRun.getMinutes();
        const nextMinute = Math.ceil((currentMinute + 1) / 15) * 15;
        nextRun.setMinutes(nextMinute, 0, 0);
        if (nextMinute >= 60) {
          nextRun.setHours(nextRun.getHours() + 1);
        }
      } else {
        // Default: 1 hour from now
        nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);
      }

      return nextRun.toISOString();
    }

    // Fallback
    const nextRun = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
    return nextRun.toISOString();
  }

  /**
   * Lista schedules
   */
  listSchedules() {
    return Array.from(this.schedules.values()).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      workflow: s.workflow,
      cron: s.cron,
      interval: s.interval,
      enabled: s.enabled,
      executionCount: s.executionCount,
      lastExecutedAt: s.lastExecutedAt,
      nextRunAt: s.nextRunAt,
      createdAt: s.createdAt
    }));
  }

  /**
   * Get schedule by ID
   */
  getSchedule(id) {
    return this.schedules.get(id);
  }

  /**
   * Update schedule
   */
  async updateSchedule(id, updates) {
    const schedule = this.schedules.get(id);

    if (!schedule) {
      throw new Error(`Schedule ${id} not found`);
    }

    const wasEnabled = schedule.enabled;

    // Merge updates
    const updated = {
      ...schedule,
      ...updates,
      id: schedule.id, // Preserve ID
      executionCount: schedule.executionCount, // Preserve stats
      lastExecutedAt: schedule.lastExecutedAt,
      createdAt: schedule.createdAt,
      updatedAt: new Date().toISOString()
    };

    // Recalculate next run if cron/interval changed
    if (updates.cron !== undefined || updates.interval !== undefined) {
      updated.nextRunAt = this.calculateNextRun(updated);
    }

    await this.saveSchedule(updated);
    this.schedules.set(id, updated);

    // Restart schedule if it was enabled or if enable state changed
    if (wasEnabled) {
      this.stopSchedule(id);
    }

    if (updated.enabled) {
      this.startSchedule(id);
    }

    console.log(`✅ Schedule updated: ${updated.name}`);

    return {
      success: true,
      schedule: updated
    };
  }

  /**
   * Delete schedule
   */
  async deleteSchedule(id) {
    const schedule = this.schedules.get(id);

    if (!schedule) {
      throw new Error(`Schedule ${id} not found`);
    }

    // Stop schedule first
    this.stopSchedule(id);

    // Delete file
    const filePath = path.join(this.schedulesDir, `${id}.json`);
    await fs.unlink(filePath);

    // Remove from cache
    this.schedules.delete(id);

    console.log(`✅ Schedule deleted: ${schedule.name}`);

    return {
      success: true,
      schedule: schedule.name
    };
  }

  /**
   * Toggle schedule enabled/disabled
   */
  async toggleSchedule(id) {
    const schedule = this.schedules.get(id);

    if (!schedule) {
      throw new Error(`Schedule ${id} not found`);
    }

    schedule.enabled = !schedule.enabled;

    if (schedule.enabled) {
      this.startSchedule(id);
    } else {
      this.stopSchedule(id);
    }

    await this.saveSchedule(schedule);

    console.log(`✅ Schedule ${schedule.enabled ? 'enabled' : 'disabled'}: ${schedule.name}`);

    return {
      success: true,
      schedule: schedule.name,
      enabled: schedule.enabled
    };
  }

  /**
   * Pause all schedules
   */
  pauseAll() {
    console.log('⏸️  Pausing all schedules');
    this.timers.forEach((timer, id) => {
      clearInterval(timer);
    });
    this.timers.clear();
  }

  /**
   * Resume all schedules
   */
  resumeAll() {
    console.log('▶️  Resuming all schedules');
    this.schedules.forEach((schedule, id) => {
      if (schedule.enabled) {
        this.startSchedule(id);
      }
    });
  }

  /**
   * Save schedule to disk
   */
  async saveSchedule(schedule) {
    const filePath = path.join(this.schedulesDir, `${schedule.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(schedule, null, 2), 'utf-8');
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
    const total = this.schedules.size;
    const enabled = Array.from(this.schedules.values()).filter(s => s.enabled).length;
    const disabled = total - enabled;

    const totalExecutions = Array.from(this.schedules.values())
      .reduce((sum, s) => sum + s.executionCount, 0);

    const upcomingRuns = Array.from(this.schedules.values())
      .filter(s => s.enabled && s.nextRunAt)
      .sort((a, b) => new Date(a.nextRunAt) - new Date(b.nextRunAt))
      .slice(0, 5)
      .map(s => ({
        name: s.name,
        workflow: s.workflow,
        nextRunAt: s.nextRunAt
      }));

    return {
      total,
      enabled,
      disabled,
      active: this.timers.size,
      totalExecutions,
      upcomingRuns,
      recentExecutions: this.history.length
    };
  }

  /**
   * Get cron templates
   */
  getCronTemplates() {
    return {
      'every-minute': {
        name: 'Every Minute',
        cron: '* * * * *',
        description: 'Runs every minute'
      },
      'every-15-minutes': {
        name: 'Every 15 Minutes',
        cron: '*/15 * * * *',
        description: 'Runs every 15 minutes'
      },
      'hourly': {
        name: 'Hourly',
        cron: '0 * * * *',
        description: 'Runs at the start of every hour'
      },
      'every-6-hours': {
        name: 'Every 6 Hours',
        cron: '0 */6 * * *',
        description: 'Runs every 6 hours'
      },
      'daily': {
        name: 'Daily (Midnight)',
        cron: '0 0 * * *',
        description: 'Runs daily at midnight'
      },
      'daily-9am': {
        name: 'Daily (9 AM)',
        cron: '0 9 * * *',
        description: 'Runs daily at 9:00 AM'
      },
      'weekly': {
        name: 'Weekly (Sunday)',
        cron: '0 0 * * 0',
        description: 'Runs every Sunday at midnight'
      },
      'monthly': {
        name: 'Monthly (1st)',
        cron: '0 0 1 * *',
        description: 'Runs on the 1st of every month at midnight'
      }
    };
  }
}

module.exports = SchedulerManager;
