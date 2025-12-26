const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const ClaudeService = require('./claude-service');
const StreamingManager = require('./streaming-manager');
const AgentManager = require('./agent-manager');
const WorkflowManager = require('./workflow-manager');
const WebhookManager = require('./webhook-manager');
const SchedulerManager = require('./scheduler-manager');
const MarketplaceManager = require('./marketplace-manager');
const MarketplaceClient = require('./marketplace-client');
const AnalyticsManager = require('./analytics-manager');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Aumentato per supportare immagini base64
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Workspace root per filesystem operations
// Use MOSSAB_WORKSPACE environment variable if set, otherwise use current directory
const WORKSPACE_ROOT = process.env.MOSSAB_WORKSPACE || process.cwd();

// Inizializza Claude Service
let claudeService;
try {
    claudeService = new ClaudeService(process.env.ANTHROPIC_API_KEY, WORKSPACE_ROOT);
    console.log('✅ Claude Service initialized successfully');
    console.log(`📁 Workspace: ${WORKSPACE_ROOT}`);
} catch (error) {
    console.warn('⚠️ Claude Service initialization failed:', error.message);
    console.warn('📝 Mossab will run with limited capabilities');
}

// Inizializza Streaming Manager per steering support
const streamingManager = new StreamingManager();
console.log('✅ Streaming Manager initialized - steering support enabled');

// Helper: verifica se l'API è configurata (Anthropic o LiteLLM)
function isApiConfigured() {
    if (!claudeService) return false;

    // Se provider è LiteLLM, non serve ANTHROPIC_API_KEY
    if (process.env.AI_PROVIDER === 'litellm') {
        return true;
    }

    // Per Anthropic, verifica che la key sia valida (non un placeholder)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && !apiKey.includes('your_') && apiKey.length > 20) {
        return true;
    }

    return false;
}

// Inizializza Agent Manager per agent orchestration
let agentManager;
try {
    agentManager = new AgentManager(WORKSPACE_ROOT);
    // Initialize agents asynchronously
    agentManager.initialize().then(stats => {
        console.log(`✅ Agent Manager initialized - ${stats.total} agents available (${stats.builtin} builtin + ${stats.custom} custom)`);
    }).catch(error => {
        console.warn('⚠️  Agent Manager initialization warning:', error.message);
    });
} catch (error) {
    console.warn('⚠️  Agent Manager initialization failed:', error.message);
}

// Inizializza Workflow Manager per agent pipelines
let workflowManager;
try {
    workflowManager = new WorkflowManager(WORKSPACE_ROOT, agentManager);
    // Initialize workflows asynchronously
    workflowManager.initialize().then(stats => {
        console.log(`✅ Workflow Manager initialized - ${stats.total} workflows available`);
    }).catch(error => {
        console.warn('⚠️  Workflow Manager initialization warning:', error.message);
    });
} catch (error) {
    console.warn('⚠️  Workflow Manager initialization failed:', error.message);
}

// Inizializza Webhook Manager per automatic triggers
let webhookManager;
try {
    webhookManager = new WebhookManager(WORKSPACE_ROOT, agentManager, workflowManager);
    // Initialize webhooks asynchronously
    webhookManager.initialize().then(stats => {
        console.log(`✅ Webhook Manager initialized - ${stats.total} webhooks available`);
    }).catch(error => {
        console.warn('⚠️  Webhook Manager initialization warning:', error.message);
    });
} catch (error) {
    console.warn('⚠️  Webhook Manager initialization failed:', error.message);
}

// Inizializza Scheduler Manager per cron-based workflows
let schedulerManager;
try {
    schedulerManager = new SchedulerManager(WORKSPACE_ROOT, workflowManager);
    // Initialize schedules asynchronously
    schedulerManager.initialize().then(stats => {
        console.log(`✅ Scheduler Manager initialized - ${stats.total} schedules (${stats.active} active)`);
    }).catch(error => {
        console.warn('⚠️  Scheduler Manager initialization warning:', error.message);
    });
} catch (error) {
    console.warn('⚠️  Scheduler Manager initialization failed:', error.message);
}

// Inizializza Marketplace Manager per agent/workflow sharing
let marketplaceManager;
try {
    marketplaceManager = new MarketplaceManager(WORKSPACE_ROOT, agentManager, workflowManager);
    // Initialize marketplace asynchronously
    marketplaceManager.initialize().then(stats => {
        console.log(`✅ Marketplace Manager initialized - ${stats.total} items (${stats.agents} agents + ${stats.workflows} workflows)`);
    }).catch(error => {
        console.warn('⚠️  Marketplace Manager initialization warning:', error.message);
    });
} catch (error) {
    console.warn('⚠️  Marketplace Manager initialization failed:', error.message);
}

// Inizializza Marketplace Client per remote marketplace (opzionale)
let marketplaceClient = null;
const MARKETPLACE_URL = process.env.MARKETPLACE_URL;
const MARKETPLACE_API_KEY = process.env.MARKETPLACE_API_KEY;

if (MARKETPLACE_URL) {
    try {
        marketplaceClient = new MarketplaceClient(MARKETPLACE_URL, MARKETPLACE_API_KEY);
        // Test connection
        marketplaceClient.healthCheck().then(health => {
            if (health.success) {
                console.log(`✅ Marketplace Client connected to ${MARKETPLACE_URL}`);
                console.log(`🔐 Authentication: ${MARKETPLACE_API_KEY ? 'Configured' : 'Anonymous (read-only)'}`);
            } else {
                console.warn(`⚠️  Marketplace server not reachable: ${health.error}`);
            }
        }).catch(error => {
            console.warn(`⚠️  Marketplace connection failed: ${error.message}`);
        });
    } catch (error) {
        console.warn('⚠️  Marketplace Client initialization failed:', error.message);
    }
} else {
    console.log('📦 Marketplace: Local mode (set MARKETPLACE_URL for remote marketplace)');
}

// Inizializza Analytics Manager per metrics tracking
let analyticsManager;
try {
    analyticsManager = new AnalyticsManager(WORKSPACE_ROOT);
    // Initialize analytics asynchronously
    analyticsManager.initialize().then(stats => {
        console.log(`✅ Analytics Manager initialized - ${stats.totalEvents} events tracked`);
    }).catch(error => {
        console.warn('⚠️  Analytics Manager initialization warning:', error.message);
    });
} catch (error) {
    console.warn('⚠️  Analytics Manager initialization failed:', error.message);
}

// Session storage (in produzione usare Redis o DB)
const sessions = new Map();

/**
 * Fallback response quando API non è disponibile
 */
function getFallbackResponse(message) {
    const msg = message.toLowerCase();

    const responses = {
        greetings: [
            "Ciao! Sono Mossab. **Nota**: Sto funzionando con capacità limitate perché l'API di Claude non è configurata. Configura `ANTHROPIC_API_KEY` nel file `.env` per sbloccare tutte le mie capacità! 🚀",
            "Hey! Sono Mossab, il tuo AI developer. Per ora ho funzionalità base - configura l'API key per sbloccare tool use, planning, e molto altro! 💻"
        ],
        capabilities: "Al momento sto funzionando in **modalità limitata**.\n\n" +
            "Per sbloccare le mie capacità complete:\n\n" +
            "1. Ottieni una API key da https://console.anthropic.com/\n" +
            "2. Aggiungi `ANTHROPIC_API_KEY=your_key` al file `.env`\n" +
            "3. Riavvia il server\n\n" +
            "Con l'API configurata avrò:\n" +
            "- 🧠 **Reasoning avanzato** con thinking\n" +
            "- 🔧 **Tool Use** per operazioni reali\n" +
            "- 📋 **Planning** e task decomposition\n" +
            "- 💾 **Memoria** persistente\n" +
            "- 🚀 **Generazione codice** professionale",
        help: "Posso aiutarti con domande sulla programmazione! Anche se sto funzionando con capacità limitate, proverò a rispondere al meglio.\n\n" +
            "💡 **Tip**: Configura l'API di Claude per sbloccare le mie capacità complete!"
    };

    // Check for greetings
    if (msg.match(/\b(ciao|hello|hi|hey|salve|buongiorno)\b/)) {
        return responses.greetings[Math.floor(Math.random() * responses.greetings.length)];
    }

    // Check for capabilities question
    if (msg.match(/\b(chi sei|cosa sai fare|capabilities|presentati)\b/)) {
        return responses.capabilities;
    }

    // Check for help
    if (msg.match(/\b(aiuto|help)\b/)) {
        return responses.help;
    }

    // Default response
    return `Ho ricevuto il tuo messaggio: "${message}"\n\n` +
        "⚠️ **Modalità Limitata**: API non configurata correttamente.\n\n" +
        "Per attivare le mie capacità complete:\n\n" +
        "**Opzione 1 - Anthropic Direct:**\n" +
        "```\nANTHROPIC_API_KEY=sk-ant-...\n```\n\n" +
        "**Opzione 2 - LiteLLM Proxy:**\n" +
        "```\nAI_PROVIDER=litellm\nLITELLM_PROXY_URL=http://localhost:4000\n```\n\n" +
        "Dopo la configurazione, riavvia il server! 🚀";
}

/**
 * API Endpoint principale per la chat
 * Usa Claude Service con streaming e steering support
 */
app.post('/api/chat', async (req, res) => {
    try {
        const { message, conversationHistory = [], sessionId = 'default', attachments = [] } = req.body;

        // Allow empty message if there are attachments
        const hasAttachments = attachments && attachments.length > 0;
        if ((!message || typeof message !== 'string' || message.trim() === '') && !hasAttachments) {
            return res.status(400).json({
                error: 'Message or attachments required'
            });
        }

        // Get or create session
        if (!sessions.has(sessionId)) {
            sessions.set(sessionId, {
                history: [],
                createdAt: new Date(),
                lastActive: new Date()
            });
        }

        const session = sessions.get(sessionId);
        session.lastActive = new Date();

        // Check if Claude Service is available (works with both Anthropic and LiteLLM)
        if (isApiConfigured()) {
            try {
                // Imposta il sessionId corrente per ask_user_question tool
                claudeService.currentSessionId = sessionId;

                const history = conversationHistory.length > 0 ? conversationHistory : session.history;
                let accumulatedText = '';
                let toolsUsed = [];

                // Usa streamWithSteering per supportare steering e tool use
                await claudeService.streamWithSteering(
                    message || '',
                    history,
                    streamingManager,
                    sessionId,
                    // onChunk - accumula testo
                    (chunk) => {
                        accumulatedText += chunk;
                    },
                    // onComplete
                    (finalText) => {
                        accumulatedText = finalText;
                    },
                    // onError
                    (error) => {
                        console.error('Streaming error:', error);
                    },
                    // attachments (nuovo parametro)
                    attachments
                );

                // Salva nella session history
                session.history.push(
                    { role: 'user', content: message },
                    { role: 'assistant', content: accumulatedText }
                );

                // Limita la history a 100 messaggi per sessione
                if (session.history.length > 100) {
                    session.history = session.history.slice(-100);
                }

                res.json({
                    message: accumulatedText,
                    thinking: null,
                    toolsUsed: toolsUsed,
                    model: claudeService.model,
                    timestamp: new Date().toISOString(),
                    sessionId: sessionId,
                    provider: claudeService.provider,
                    capabilities: {
                        toolUse: claudeService.enableToolUse,
                        planning: claudeService.enablePlanning,
                        memory: claudeService.enableMemory,
                        steering: true
                    }
                });

            } catch (apiError) {
                console.error('API Error:', apiError);

                // Fallback se l'API ha errori
                res.json({
                    message: getFallbackResponse(message),
                    error: true,
                    errorMessage: apiError.message || 'API Error - usando fallback',
                    timestamp: new Date().toISOString()
                });
            }
        } else {
            // Fallback mode - API non configurata
            const fallbackMessage = getFallbackResponse(message);

            res.json({
                message: fallbackMessage,
                mode: 'fallback',
                timestamp: new Date().toISOString(),
                hint: 'Configure ANTHROPIC_API_KEY or AI_PROVIDER=litellm to unlock full capabilities'
            });
        }

    } catch (error) {
        console.error('Error in chat endpoint:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * Streaming endpoint per risposte in tempo reale
 */
app.post('/api/chat/stream', async (req, res) => {
    try {
        const { message, conversationHistory = [] } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!isApiConfigured()) {
            return res.status(503).json({
                error: 'Streaming requires API configuration (ANTHROPIC_API_KEY or AI_PROVIDER=litellm)'
            });
        }

        // Set headers for SSE (Server-Sent Events)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = await claudeService.streamMessage(message, conversationHistory);

        stream.on('text', (text) => {
            res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
        });

        stream.on('end', () => {
            res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
            res.end();
        });

        stream.on('error', (error) => {
            console.error('Stream error:', error);
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        });

    } catch (error) {
        console.error('Error in streaming endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get info su Mossab e le sue capacità
 */
app.get('/api/mossab/info', (req, res) => {
    const apiReady = isApiConfigured();

    res.json({
        name: process.env.MOSSAB_NAME || 'Mossab',
        role: process.env.MOSSAB_ROLE || 'AI Developer & Programming Assistant',
        version: '2.0.0',
        model: claudeService?.model || process.env.AI_MODEL || 'claude-sonnet-4-5-20250929',
        provider: claudeService?.provider || 'anthropic',
        apiConfigured: apiReady,
        capabilities: {
            chat: true,
            streaming: apiReady,
            steering: apiReady,
            toolUse: apiReady && claudeService?.enableToolUse,
            planning: apiReady && claudeService?.enablePlanning,
            memory: apiReady && claudeService?.enableMemory,
            reasoning: apiReady,
            codeGeneration: true
        },
        skills: [
            'JavaScript/TypeScript',
            'Node.js & Express',
            'React, Vue, Angular',
            'Python',
            'Database Design',
            'API Development',
            'DevOps & CI/CD',
            'Cloud Architecture',
            'Problem Solving',
            'Code Review'
        ],
        availableTools: apiReady ? claudeService?.getTools().map(t => t.name) : [],
        status: apiReady ? 'fully_operational' : 'limited_mode'
    });
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
    const isHealthy = !!claudeService;
    const apiReady = isApiConfigured();

    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'degraded',
        mode: apiReady ? 'full' : 'fallback',
        provider: claudeService?.provider || 'none',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        sessions: sessions.size
    });
});

/**
 * Clear session
 */
app.delete('/api/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
        res.json({ success: true, message: 'Session cleared' });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

/**
 * Get session info
 */
app.get('/api/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    if (sessions.has(sessionId)) {
        const session = sessions.get(sessionId);
        res.json({
            sessionId,
            messageCount: session.history.length,
            createdAt: session.createdAt,
            lastActive: session.lastActive
        });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

/**
 * STEERING ENDPOINTS
 * Permettono di dare feedback in real-time durante la generazione
 */

/**
 * POST /api/steering/:sessionId
 * Invia un messaggio di steering per ri-indirizzare la risposta in corso
 */
app.post('/api/steering/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { steeringMessage } = req.body;

        if (!steeringMessage || typeof steeringMessage !== 'string') {
            return res.status(400).json({
                error: 'steeringMessage is required and must be a string'
            });
        }

        // Verifica se la sessione sta streamando
        const streamState = streamingManager.getSessionState(sessionId);

        if (!streamState.exists) {
            return res.status(404).json({
                error: 'Session not found or not streaming'
            });
        }

        if (!streamState.active) {
            return res.status(400).json({
                error: 'Session is not actively streaming',
                hint: 'Steering can only be applied during active generation'
            });
        }

        // Aggiungi il messaggio di steering
        const result = streamingManager.addSteeringMessage(sessionId, steeringMessage);

        if (!result.success) {
            return res.status(500).json({
                error: 'Failed to add steering message',
                details: result.error
            });
        }

        res.json({
            success: true,
            message: 'Steering message added successfully',
            sessionId: sessionId,
            steeringText: steeringMessage,
            queuePosition: result.queueLength,
            accumulatedTextLength: result.accumulatedText.length,
            hint: 'The AI will incorporate your feedback in the ongoing response'
        });

    } catch (error) {
        console.error('Error in steering endpoint:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * POST /api/streaming/:sessionId/pause
 * Pausa temporaneamente lo streaming
 */
app.post('/api/streaming/:sessionId/pause', (req, res) => {
    const { sessionId } = req.params;

    const success = streamingManager.pauseSession(sessionId);

    if (success) {
        res.json({
            success: true,
            message: 'Session paused',
            sessionId: sessionId
        });
    } else {
        res.status(404).json({
            error: 'Session not found or not active'
        });
    }
});

/**
 * POST /api/streaming/:sessionId/resume
 * Riprende lo streaming pausato
 */
app.post('/api/streaming/:sessionId/resume', (req, res) => {
    const { sessionId } = req.params;

    const success = streamingManager.resumeSession(sessionId);

    if (success) {
        res.json({
            success: true,
            message: 'Session resumed',
            sessionId: sessionId
        });
    } else {
        res.status(404).json({
            error: 'Session not found or not paused'
        });
    }
});

/**
 * POST /api/streaming/:sessionId/stop
 * Ferma completamente lo streaming
 */
app.post('/api/streaming/:sessionId/stop', (req, res) => {
    const { sessionId } = req.params;

    const success = streamingManager.stopSession(sessionId);

    if (success) {
        res.json({
            success: true,
            message: 'Session stopped',
            sessionId: sessionId
        });
    } else {
        res.status(404).json({
            error: 'Session not found'
        });
    }
});

/**
 * GET /api/streaming/:sessionId/state
 * Ottieni lo stato corrente dello streaming
 */
app.get('/api/streaming/:sessionId/state', (req, res) => {
    const { sessionId } = req.params;

    const state = streamingManager.getSessionState(sessionId);

    res.json(state);
});

/**
 * GET /api/todos
 * Ottieni la lista TODO corrente
 */
app.get('/api/todos', (req, res) => {
    if (!claudeService || !claudeService.filesystemTools) {
        return res.json({ todos: [], message: 'TODO tracking not available' });
    }

    const todos = claudeService.filesystemTools.getTodos();

    const inProgress = todos.find(t => t.status === 'in_progress');
    const completed = todos.filter(t => t.status === 'completed').length;

    res.json({
        todos: todos,
        summary: {
            total: todos.length,
            completed: completed,
            pending: todos.filter(t => t.status === 'pending').length,
            in_progress: inProgress ? 1 : 0,
            current_task: inProgress?.activeForm || null
        }
    });
});

/**
 * USER QUESTIONS ENDPOINTS
 * Gestione del tool ask_user_question per chiarire requisiti ambigui
 */

/**
 * GET /api/questions
 * Ottieni tutte le domande pendenti (o filtrate per sessionId)
 */
app.get('/api/questions', (req, res) => {
    if (!claudeService || !claudeService.userQuestionManager) {
        return res.json({
            questions: [],
            message: 'Question system not available'
        });
    }

    const { sessionId } = req.query;

    try {
        const questions = claudeService.userQuestionManager.getPendingQuestions(sessionId);

        res.json({
            questions: questions,
            count: questions.length
        });

    } catch (error) {
        console.error('Error getting questions:', error);
        res.status(500).json({
            error: 'Failed to get questions',
            message: error.message
        });
    }
});

/**
 * POST /api/questions/:questionId/answer
 * Rispondi a una domanda di Mossab
 */
app.post('/api/questions/:questionId/answer', (req, res) => {
    if (!claudeService || !claudeService.userQuestionManager) {
        return res.status(503).json({
            error: 'Question system not available'
        });
    }

    const { questionId } = req.params;
    const { answer } = req.body;

    if (!answer || typeof answer !== 'string') {
        return res.status(400).json({
            error: 'answer is required and must be a string'
        });
    }

    try {
        const result = claudeService.userQuestionManager.answerQuestion(questionId, answer);

        if (result.success) {
            res.json({
                success: true,
                message: 'Answer submitted successfully',
                questionId: questionId
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('Error answering question:', error);
        res.status(500).json({
            error: 'Failed to answer question',
            message: error.message
        });
    }
});

/**
 * POST /api/questions/:questionId/cancel
 * Cancella una domanda (l'utente non vuole rispondere)
 */
app.post('/api/questions/:questionId/cancel', (req, res) => {
    if (!claudeService || !claudeService.userQuestionManager) {
        return res.status(503).json({
            error: 'Question system not available'
        });
    }

    const { questionId } = req.params;

    try {
        const result = claudeService.userQuestionManager.cancelQuestion(questionId);

        if (result.success) {
            res.json({
                success: true,
                message: 'Question cancelled',
                questionId: questionId
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('Error cancelling question:', error);
        res.status(500).json({
            error: 'Failed to cancel question',
            message: error.message
        });
    }
});

/**
 * GET /api/questions/stats
 * Ottieni statistiche sulle domande
 */
app.get('/api/questions/stats', (req, res) => {
    if (!claudeService || !claudeService.userQuestionManager) {
        return res.json({
            stats: null,
            message: 'Question system not available'
        });
    }

    try {
        const stats = claudeService.userQuestionManager.getStats();

        res.json({
            stats: stats
        });

    } catch (error) {
        console.error('Error getting question stats:', error);
        res.status(500).json({
            error: 'Failed to get stats',
            message: error.message
        });
    }
});

/**
 * PROJECT CONTEXT ENDPOINTS
 * Gestione configurazione progetto (.claude/project.json)
 */

/**
 * GET /api/project/context
 * Ottieni project context corrente
 */
app.get('/api/project/context', async (req, res) => {
    if (!claudeService || !claudeService.projectContextManager) {
        return res.json({
            instructions: '',
            preferences: {},
            standards: {}
        });
    }

    try {
        const context = await claudeService.projectContextManager.getProjectContext();
        res.json(context);
    } catch (error) {
        console.error('Error getting project context:', error);
        res.status(500).json({
            error: 'Failed to get project context',
            message: error.message
        });
    }
});

/**
 * PUT /api/project/context
 * Aggiorna project context
 */
app.put('/api/project/context', async (req, res) => {
    if (!claudeService || !claudeService.projectContextManager) {
        return res.status(503).json({
            error: 'Project context system not available'
        });
    }

    try {
        const updates = req.body;
        const updated = await claudeService.projectContextManager.updateProjectContext(updates);

        // Refresh cache nel ClaudeService
        claudeService.cachedProjectContextAddition =
            await claudeService.projectContextManager.getSystemPromptAddition();

        res.json({
            success: true,
            message: 'Project context updated successfully',
            context: updated
        });
    } catch (error) {
        console.error('Error updating project context:', error);
        res.status(500).json({
            error: 'Failed to update project context',
            message: error.message
        });
    }
});

/**
 * DELETE /api/project/context
 * Reset project context ai defaults
 */
app.delete('/api/project/context', async (req, res) => {
    if (!claudeService || !claudeService.projectContextManager) {
        return res.status(503).json({
            error: 'Project context system not available'
        });
    }

    try {
        const reset = await claudeService.projectContextManager.resetProjectContext();

        // Refresh cache
        claudeService.cachedProjectContextAddition =
            await claudeService.projectContextManager.getSystemPromptAddition();

        res.json({
            success: true,
            message: 'Project context reset to defaults',
            context: reset
        });
    } catch (error) {
        console.error('Error resetting project context:', error);
        res.status(500).json({
            error: 'Failed to reset project context',
            message: error.message
        });
    }
});

/**
 * GET /api/project/templates
 * Ottieni templates disponibili
 */
app.get('/api/project/templates', (req, res) => {
    if (!claudeService || !claudeService.projectContextManager) {
        return res.json({
            templates: {}
        });
    }

    try {
        const templates = claudeService.projectContextManager.getTemplates();
        res.json({ templates });
    } catch (error) {
        console.error('Error getting templates:', error);
        res.status(500).json({
            error: 'Failed to get templates',
            message: error.message
        });
    }
});

/**
 * POST /api/project/template/:templateName
 * Applica un template
 */
app.post('/api/project/template/:templateName', async (req, res) => {
    if (!claudeService || !claudeService.projectContextManager) {
        return res.status(503).json({
            error: 'Project context system not available'
        });
    }

    const { templateName } = req.params;

    try {
        const context = await claudeService.projectContextManager.applyTemplate(templateName);

        // Refresh cache
        claudeService.cachedProjectContextAddition =
            await claudeService.projectContextManager.getSystemPromptAddition();

        res.json({
            success: true,
            message: `Template "${templateName}" applied successfully`,
            context: context
        });
    } catch (error) {
        console.error('Error applying template:', error);
        res.status(400).json({
            error: 'Failed to apply template',
            message: error.message
        });
    }
});

/**
 * GIT INTEGRATION ENDPOINTS
 * Gestione Git, PR creation, Code Review automation
 */

/**
 * GET /api/git/status
 * Ottieni git status del repository
 */
app.get('/api/git/status', async (req, res) => {
    if (!claudeService || !claudeService.gitToolsManager) {
        return res.json({
            success: false,
            error: 'Git system not available'
        });
    }

    try {
        const status = await claudeService.gitToolsManager.getStatus();
        res.json({
            success: true,
            status: status
        });
    } catch (error) {
        console.error('Error getting git status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get git status',
            message: error.message
        });
    }
});

/**
 * POST /api/git/diff
 * Ottieni git diff con opzioni
 */
app.post('/api/git/diff', async (req, res) => {
    if (!claudeService || !claudeService.gitToolsManager) {
        return res.status(503).json({
            success: false,
            error: 'Git system not available'
        });
    }

    try {
        const options = req.body || {};
        const diff = await claudeService.gitToolsManager.getDiff(options);
        res.json({
            success: true,
            diff: diff
        });
    } catch (error) {
        console.error('Error getting diff:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get diff',
            message: error.message
        });
    }
});

/**
 * GET /api/git/log
 * Ottieni git log
 */
app.get('/api/git/log', async (req, res) => {
    if (!claudeService || !claudeService.gitToolsManager) {
        return res.status(503).json({
            success: false,
            error: 'Git system not available'
        });
    }

    try {
        const limit = parseInt(req.query.limit) || 10;
        const branch = req.query.branch || null;

        const log = await claudeService.gitToolsManager.getLog({ limit, branch });
        res.json({
            success: true,
            commits: log
        });
    } catch (error) {
        console.error('Error getting log:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get log',
            message: error.message
        });
    }
});

/**
 * POST /api/git/commit
 * Crea un commit
 */
app.post('/api/git/commit', async (req, res) => {
    if (!claudeService || !claudeService.gitToolsManager) {
        return res.status(503).json({
            success: false,
            error: 'Git system not available'
        });
    }

    try {
        const { message, files = [], all = false } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Commit message is required'
            });
        }

        const result = await claudeService.gitToolsManager.commit(message, { files, all });
        res.json(result);
    } catch (error) {
        console.error('Error creating commit:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create commit',
            message: error.message
        });
    }
});

/**
 * POST /api/git/push
 * Push al remote
 */
app.post('/api/git/push', async (req, res) => {
    if (!claudeService || !claudeService.gitToolsManager) {
        return res.status(503).json({
            success: false,
            error: 'Git system not available'
        });
    }

    try {
        const options = req.body || {};
        const result = await claudeService.gitToolsManager.push(options);
        res.json(result);
    } catch (error) {
        console.error('Error pushing:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to push',
            message: error.message
        });
    }
});

/**
 * POST /api/pr/create
 * Crea Pull Request con template
 */
app.post('/api/pr/create', async (req, res) => {
    if (!claudeService || !claudeService.prTemplateManager) {
        return res.status(503).json({
            success: false,
            error: 'PR template system not available'
        });
    }

    try {
        const options = req.body || {};
        const result = await claudeService.prTemplateManager.createPullRequest(options);
        res.json(result);
    } catch (error) {
        console.error('Error creating PR:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create PR',
            message: error.message
        });
    }
});

/**
 * POST /api/pr/generate-body
 * Genera PR body con AI
 */
app.post('/api/pr/generate-body', async (req, res) => {
    if (!claudeService || !claudeService.prTemplateManager) {
        return res.status(503).json({
            success: false,
            error: 'PR template system not available'
        });
    }

    try {
        const options = req.body || {};
        const result = await claudeService.prTemplateManager.generatePRBody(options);
        res.json(result);
    } catch (error) {
        console.error('Error generating PR body:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate PR body',
            message: error.message
        });
    }
});

/**
 * GET /api/pr/list
 * Lista Pull Requests
 */
app.get('/api/pr/list', async (req, res) => {
    if (!claudeService || !claudeService.gitToolsManager) {
        return res.status(503).json({
            success: false,
            error: 'Git system not available'
        });
    }

    try {
        const state = req.query.state || 'open';
        const limit = parseInt(req.query.limit) || 10;

        const prs = await claudeService.gitToolsManager.listPullRequests({ state, limit });
        res.json({
            success: true,
            pullRequests: prs
        });
    } catch (error) {
        console.error('Error listing PRs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list PRs',
            message: error.message
        });
    }
});

/**
 * GET /api/pr/:number
 * Visualizza PR specifica
 */
app.get('/api/pr/:number', async (req, res) => {
    if (!claudeService || !claudeService.gitToolsManager) {
        return res.status(503).json({
            success: false,
            error: 'Git system not available'
        });
    }

    try {
        const prNumber = parseInt(req.params.number);
        const pr = await claudeService.gitToolsManager.getPullRequest(prNumber);
        res.json({
            success: true,
            pullRequest: pr
        });
    } catch (error) {
        console.error('Error getting PR:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get PR',
            message: error.message
        });
    }
});

/**
 * POST /api/review/code
 * Esegui code review automatico
 */
app.post('/api/review/code', async (req, res) => {
    if (!claudeService || !claudeService.codeReviewer) {
        return res.status(503).json({
            success: false,
            error: 'Code review system not available'
        });
    }

    try {
        const options = req.body || {};
        const result = await claudeService.codeReviewer.reviewCode(options);
        res.json(result);
    } catch (error) {
        console.error('Error during code review:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform code review',
            message: error.message
        });
    }
});

/**
 * POST /api/review/security
 * Esegui security scan
 */
app.post('/api/review/security', async (req, res) => {
    if (!claudeService || !claudeService.codeReviewer) {
        return res.status(503).json({
            success: false,
            error: 'Code review system not available'
        });
    }

    try {
        const options = req.body || {};
        const result = await claudeService.codeReviewer.securityScan(options);
        res.json(result);
    } catch (error) {
        console.error('Error during security scan:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform security scan',
            message: error.message
        });
    }
});

/**
 * GET /api/pr/templates
 * Lista template PR disponibili
 */
app.get('/api/pr/templates', async (req, res) => {
    if (!claudeService || !claudeService.prTemplateManager) {
        return res.json({
            success: true,
            templates: []
        });
    }

    try {
        const templates = await claudeService.prTemplateManager.listTemplates();
        res.json({
            success: true,
            templates: templates
        });
    } catch (error) {
        console.error('Error listing templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list templates',
            message: error.message
        });
    }
});

/**
 * CONTEXT MANAGEMENT ENDPOINTS
 * Gestione context window e automatic summarization
 */

/**
 * GET /api/context/stats/:sessionId
 * Ottieni statistiche sul context usage di una sessione
 */
app.get('/api/context/stats/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    if (!claudeService) {
        return res.json({
            current: 0,
            max: 200000,
            percentage: 0,
            remaining: 200000,
            status: 'normal'
        });
    }

    try {
        // Ottieni conversation history dalla sessione
        const session = sessions.get(sessionId);
        const conversationHistory = session?.history || [];

        // Ottieni stats dal ContextManager
        const stats = await claudeService.getContextStats(conversationHistory);

        res.json(stats);

    } catch (error) {
        console.error('Error getting context stats:', error);
        res.status(500).json({
            error: 'Failed to get context stats',
            message: error.message
        });
    }
});

/**
 * POST /api/context/summarize/:sessionId
 * Trigger manual summarization di una conversazione
 */
app.post('/api/context/summarize/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    if (!claudeService) {
        return res.status(503).json({
            error: 'Claude service not available'
        });
    }

    try {
        // Ottieni conversation history dalla sessione
        const session = sessions.get(sessionId);
        const conversationHistory = session?.history || [];

        if (conversationHistory.length === 0) {
            return res.json({
                success: true,
                message: 'No messages to summarize',
                optimized: []
            });
        }

        // Trigger summarization
        const optimized = await claudeService.triggerSummarization(conversationHistory);

        // Aggiorna la sessione con history ottimizzata (mantieni struttura sessione)
        if (session) {
            session.history = optimized;
            session.lastActive = new Date();
        }

        // Calcola saving
        const originalTokens = await claudeService.contextManager.countTokens(conversationHistory);
        const optimizedTokens = await claudeService.contextManager.countTokens(optimized);
        const savedTokens = originalTokens - optimizedTokens;
        const savedPercentage = ((savedTokens / originalTokens) * 100).toFixed(1);

        res.json({
            success: true,
            message: 'Conversation summarized successfully',
            stats: {
                originalMessages: conversationHistory.length,
                optimizedMessages: optimized.length,
                originalTokens: originalTokens,
                optimizedTokens: optimizedTokens,
                savedTokens: savedTokens,
                savedPercentage: savedPercentage
            }
        });

    } catch (error) {
        console.error('Error in manual summarization:', error);
        res.status(500).json({
            error: 'Summarization failed',
            message: error.message
        });
    }
});

/**
 * POST /api/context/reset
 * Reset token tracking (chiamato quando si inizia una nuova chat)
 */
app.post('/api/context/reset', (req, res) => {
    if (!claudeService || !claudeService.contextManager) {
        return res.json({ success: true, message: 'No context to reset' });
    }

    try {
        claudeService.contextManager.resetTrackedUsage();
        console.log('📊 Token tracking reset');
        res.json({
            success: true,
            message: 'Token tracking reset successfully'
        });
    } catch (error) {
        console.error('Error resetting context:', error);
        res.status(500).json({
            error: 'Reset failed',
            message: error.message
        });
    }
});

/**
 * MCP SERVER ENDPOINTS
 * Gestione configurazione e connessioni MCP servers
 */

/**
 * GET /api/mcp/servers
 * Lista tutti i server MCP configurati
 */
app.get('/api/mcp/servers', async (req, res) => {
    if (!claudeService || !claudeService.mcpManager) {
        return res.json({
            servers: [],
            message: 'MCP system not available'
        });
    }

    try {
        const servers = await claudeService.mcpManager.listServers();

        res.json({
            servers: servers,
            count: servers.length
        });

    } catch (error) {
        console.error('Error listing MCP servers:', error);
        res.status(500).json({
            error: 'Failed to list servers',
            message: error.message
        });
    }
});

/**
 * POST /api/mcp/servers
 * Aggiungi nuovo server MCP
 */
app.post('/api/mcp/servers', async (req, res) => {
    if (!claudeService || !claudeService.mcpManager) {
        return res.status(503).json({
            error: 'MCP system not available'
        });
    }

    const { name, url, bearerToken, description, enabled } = req.body;

    if (!name || !url) {
        return res.status(400).json({
            error: 'name and url are required'
        });
    }

    try {
        await claudeService.mcpManager.addServerConfig({
            name,
            url,
            bearerToken: bearerToken || '',
            description: description || '',
            enabled: enabled !== false
        });

        res.json({
            success: true,
            message: 'Server added successfully',
            name: name
        });

    } catch (error) {
        console.error('Error adding MCP server:', error);
        res.status(500).json({
            error: 'Failed to add server',
            message: error.message
        });
    }
});

/**
 * PUT /api/mcp/servers/:name
 * Aggiorna configurazione server
 */
app.put('/api/mcp/servers/:name', async (req, res) => {
    if (!claudeService || !claudeService.mcpManager) {
        return res.status(503).json({
            error: 'MCP system not available'
        });
    }

    const { name } = req.params;
    const updates = req.body;

    try {
        await claudeService.mcpManager.updateServerConfig(name, updates);

        res.json({
            success: true,
            message: 'Server updated successfully',
            name: name
        });

    } catch (error) {
        console.error('Error updating MCP server:', error);
        res.status(500).json({
            error: 'Failed to update server',
            message: error.message
        });
    }
});

/**
 * DELETE /api/mcp/servers/:name
 * Rimuovi server
 */
app.delete('/api/mcp/servers/:name', async (req, res) => {
    if (!claudeService || !claudeService.mcpManager) {
        return res.status(503).json({
            error: 'MCP system not available'
        });
    }

    const { name } = req.params;

    try {
        await claudeService.mcpManager.deleteServerConfig(name);

        res.json({
            success: true,
            message: 'Server deleted successfully',
            name: name
        });

    } catch (error) {
        console.error('Error deleting MCP server:', error);
        res.status(500).json({
            error: 'Failed to delete server',
            message: error.message
        });
    }
});

/**
 * POST /api/mcp/reload
 * Reload configurazione MCP
 */
app.post('/api/mcp/reload', async (req, res) => {
    if (!claudeService || !claudeService.mcpManager) {
        return res.status(503).json({
            error: 'MCP system not available'
        });
    }

    try {
        await claudeService.mcpManager.reload();

        const status = claudeService.mcpManager.getStatus();

        res.json({
            success: true,
            message: 'MCP configuration reloaded',
            status: status
        });

    } catch (error) {
        console.error('Error reloading MCP:', error);
        res.status(500).json({
            error: 'Failed to reload',
            message: error.message
        });
    }
});

/**
 * GET /api/mcp/status
 * Ottieni status connessioni MCP
 */
app.get('/api/mcp/status', (req, res) => {
    if (!claudeService || !claudeService.mcpManager) {
        return res.json({
            totalServers: 0,
            totalTools: 0,
            servers: []
        });
    }

    try {
        const status = claudeService.mcpManager.getStatus();

        res.json(status);

    } catch (error) {
        console.error('Error getting MCP status:', error);
        res.status(500).json({
            error: 'Failed to get status',
            message: error.message
        });
    }
});

/**
 * AGENT SKILLS ENDPOINTS
 * Gestione delle skills seguendo lo standard agentskills.io
 */

/**
 * GET /api/skills
 * Lista tutte le skills disponibili
 */
app.get('/api/skills', (req, res) => {
    if (!claudeService || !claudeService.skillManager) {
        return res.json({
            skills: [],
            message: 'Skill system not available'
        });
    }

    try {
        const skills = claudeService.skillManager.listSkills();

        res.json({
            skills: skills,
            count: skills.length,
            skillsDirectory: '.claude/skills/'
        });

    } catch (error) {
        console.error('Error listing skills:', error);
        res.status(500).json({
            error: 'Failed to list skills',
            message: error.message
        });
    }
});

/**
 * GET /api/skills/:name
 * Ottieni dettagli completi di una skill
 */
app.get('/api/skills/:name', (req, res) => {
    if (!claudeService || !claudeService.skillManager) {
        return res.status(503).json({
            error: 'Skill system not available'
        });
    }

    try {
        const { name } = req.params;
        const skillContent = claudeService.skillManager.getSkillContent(name);

        res.json({
            skill: skillContent
        });

    } catch (error) {
        console.error('Error getting skill:', error);
        res.status(404).json({
            error: 'Skill not found',
            message: error.message,
            available_skills: claudeService.skillManager.listSkills()
        });
    }
});

/**
 * POST /api/skills/reload
 * Ricarica tutte le skills (utile dopo aver aggiunto nuove skills)
 */
app.post('/api/skills/reload', async (req, res) => {
    if (!claudeService || !claudeService.skillManager) {
        return res.status(503).json({
            error: 'Skill system not available'
        });
    }

    try {
        await claudeService.skillManager.reload();

        const skills = claudeService.skillManager.listSkills();

        res.json({
            success: true,
            message: 'Skills reloaded successfully',
            count: skills.length,
            skills: skills
        });

    } catch (error) {
        console.error('Error reloading skills:', error);
        res.status(500).json({
            error: 'Failed to reload skills',
            message: error.message
        });
    }
});

/**
 * AGENT SYSTEM ENDPOINTS
 * Sistema di orchestrazione agents (builtin + custom)
 */

/**
 * GET /api/agents
 * Lista tutti gli agents disponibili (builtin + custom)
 */
app.get('/api/agents', (req, res) => {
    if (!agentManager) {
        return res.json({
            builtin: [],
            custom: [],
            total: 0,
            message: 'Agent system not available'
        });
    }

    try {
        const agents = agentManager.listAgents();

        res.json({
            ...agents,
            agentsDirectory: '.mossab/agents/'
        });

    } catch (error) {
        console.error('Error listing agents:', error);
        res.status(500).json({
            error: 'Failed to list agents',
            message: error.message
        });
    }
});

/**
 * GET /api/agents/stats
 * Ottieni statistiche di utilizzo agents
 */
app.get('/api/agents/stats', (req, res) => {
    if (!agentManager) {
        return res.json({
            success: true,
            stats: {
                totalExecutions: 0,
                successfulExecutions: 0,
                failedExecutions: 0,
                successRate: '0%',
                totalDuration: '0s',
                averageDuration: '0s',
                agentUsage: {},
                mostUsedAgent: null
            }
        });
    }

    try {
        const stats = agentManager.getStats();

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('Error getting agent stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get stats',
            message: error.message
        });
    }
});

/**
 * GET /api/agents/:name
 * Ottieni info dettagliate su un agent specifico
 */
app.get('/api/agents/:name', (req, res) => {
    if (!agentManager) {
        return res.status(503).json({
            error: 'Agent system not available'
        });
    }

    try {
        const { name } = req.params;
        const info = agentManager.getAgentInfo(name);

        if (!info) {
            return res.status(404).json({
                error: 'Agent not found',
                available: agentManager.listAgentNames()
            });
        }

        res.json({
            agent: info
        });

    } catch (error) {
        console.error('Error getting agent info:', error);
        res.status(500).json({
            error: 'Failed to get agent info',
            message: error.message
        });
    }
});

/**
 * POST /api/agents/execute
 * Esegui un agent specifico
 */
app.post('/api/agents/execute', async (req, res) => {
    if (!agentManager) {
        return res.status(503).json({
            error: 'Agent system not available'
        });
    }

    try {
        const { agent, task, options = {} } = req.body;

        if (!agent || !task) {
            return res.status(400).json({
                error: 'agent and task are required',
                example: {
                    agent: 'explore',
                    task: 'Find all error handling code',
                    options: {
                        thoroughness: 'medium'
                    }
                }
            });
        }

        // Esegui agent
        const result = await agentManager.executeAgent(agent, task, options);

        res.json(result);

    } catch (error) {
        console.error('Error executing agent:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to execute agent',
            message: error.message
        });
    }
});

/**
 * POST /api/agents/execute-parallel
 * Esegui multipli agents in parallelo
 */
app.post('/api/agents/execute-parallel', async (req, res) => {
    if (!agentManager) {
        return res.status(503).json({
            error: 'Agent system not available'
        });
    }

    try {
        const { agents } = req.body;

        if (!agents || !Array.isArray(agents) || agents.length === 0) {
            return res.status(400).json({
                error: 'agents array is required',
                example: {
                    agents: [
                        { agent: 'security-audit', task: 'Scan for vulnerabilities' },
                        { agent: 'perf-profiler', task: 'Find performance bottlenecks' }
                    ]
                }
            });
        }

        // Esegui agents in parallelo
        const result = await agentManager.executeParallel(agents);

        res.json(result);

    } catch (error) {
        console.error('Error executing parallel agents:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to execute parallel agents',
            message: error.message
        });
    }
});

/**
 * POST /api/agents/reload
 * Ricarica custom agents da .mossab/agents/
 */
app.post('/api/agents/reload', async (req, res) => {
    if (!agentManager) {
        return res.status(503).json({
            error: 'Agent system not available'
        });
    }

    try {
        const agents = await agentManager.reloadCustomAgents();

        res.json({
            success: true,
            message: 'Custom agents reloaded successfully',
            ...agents
        });

    } catch (error) {
        console.error('Error reloading agents:', error);
        res.status(500).json({
            error: 'Failed to reload agents',
            message: error.message
        });
    }
});

/**
 * POST /api/agents/stats/reset
 * Reset statistiche agents
 */
app.post('/api/agents/stats/reset', (req, res) => {
    if (!agentManager) {
        return res.status(503).json({
            error: 'Agent system not available'
        });
    }

    try {
        const result = agentManager.resetStats();

        res.json({
            success: true,
            message: 'Agent stats reset successfully'
        });

    } catch (error) {
        console.error('Error resetting stats:', error);
        res.status(500).json({
            error: 'Failed to reset stats',
            message: error.message
        });
    }
});

/**
 * POST /api/agents/suggest
 * Suggerisci quale agent usare per un task
 */
app.post('/api/agents/suggest', (req, res) => {
    if (!agentManager) {
        return res.status(503).json({
            error: 'Agent system not available'
        });
    }

    try {
        const { task } = req.body;

        if (!task) {
            return res.status(400).json({
                error: 'task is required'
            });
        }

        const suggested = agentManager.suggestAgent(task);

        if (!suggested) {
            return res.json({
                suggested: null,
                message: 'Could not determine best agent for this task',
                available: agentManager.listAgentNames()
            });
        }

        const agentInfo = agentManager.getAgentInfo(suggested);

        res.json({
            suggested: suggested,
            info: agentInfo,
            reason: `Based on your task, '${suggested}' seems most appropriate`
        });

    } catch (error) {
        console.error('Error suggesting agent:', error);
        res.status(500).json({
            error: 'Failed to suggest agent',
            message: error.message
        });
    }
});

/**
 * AGENT COMPOSER ENDPOINTS
 * Creazione agents via API senza scrivere JSON
 */

/**
 * POST /api/agents/compose
 * Crea un nuovo agent custom
 */
app.post('/api/agents/compose', async (req, res) => {
    if (!agentManager) {
        return res.status(503).json({
            error: 'Agent system not available'
        });
    }

    try {
        const config = req.body;

        if (!config.name) {
            return res.status(400).json({
                error: 'name is required',
                example: {
                    name: 'my-agent',
                    description: 'My custom agent',
                    model: 'sonnet',
                    tools: ['read', 'grep'],
                    systemPrompt: 'You are a helpful assistant...'
                }
            });
        }

        const result = await agentManager.createAgent(config);

        res.json(result);

    } catch (error) {
        console.error('Error composing agent:', error);
        res.status(400).json({
            error: 'Failed to create agent',
            message: error.message
        });
    }
});

/**
 * PUT /api/agents/:name
 * Aggiorna agent esistente
 */
app.put('/api/agents/:name', async (req, res) => {
    if (!agentManager) {
        return res.status(503).json({
            error: 'Agent system not available'
        });
    }

    try {
        const { name } = req.params;
        const updates = req.body;

        const result = await agentManager.updateAgent(name, updates);

        res.json(result);

    } catch (error) {
        console.error('Error updating agent:', error);
        res.status(400).json({
            error: 'Failed to update agent',
            message: error.message
        });
    }
});

/**
 * DELETE /api/agents/:name
 * Elimina agent custom
 */
app.delete('/api/agents/:name', async (req, res) => {
    if (!agentManager) {
        return res.status(503).json({
            error: 'Agent system not available'
        });
    }

    try {
        const { name } = req.params;

        const result = await agentManager.deleteAgent(name);

        res.json(result);

    } catch (error) {
        console.error('Error deleting agent:', error);
        res.status(400).json({
            error: 'Failed to delete agent',
            message: error.message
        });
    }
});

/**
 * GET /api/agents/templates/:type
 * Ottieni template agent per tipo specifico
 */
app.get('/api/agents/templates/:type', (req, res) => {
    if (!agentManager) {
        return res.status(503).json({
            error: 'Agent system not available'
        });
    }

    try {
        const { type } = req.params;
        const template = agentManager.generateAgentTemplate(type);

        if (!template) {
            return res.status(404).json({
                error: 'Template not found',
                available: ['code-analyzer', 'api-designer', 'bug-hunter', 'refactoring-assistant']
            });
        }

        res.json({
            template: template
        });

    } catch (error) {
        console.error('Error getting template:', error);
        res.status(500).json({
            error: 'Failed to get template',
            message: error.message
        });
    }
});

/**
 * WORKFLOW SYSTEM ENDPOINTS
 * Combinare agents in pipeline complesse
 */

/**
 * GET /api/workflows
 * Lista workflows disponibili
 */
app.get('/api/workflows', (req, res) => {
    if (!workflowManager) {
        return res.json({
            workflows: [],
            message: 'Workflow system not available'
        });
    }

    try {
        const workflows = workflowManager.listWorkflows();

        res.json({
            workflows: workflows,
            count: workflows.length,
            workflowsDirectory: '.mossab/workflows/'
        });

    } catch (error) {
        console.error('Error listing workflows:', error);
        res.status(500).json({
            error: 'Failed to list workflows',
            message: error.message
        });
    }
});

/**
 * GET /api/workflows/:name
 * Ottieni workflow specifico
 */
app.get('/api/workflows/:name', (req, res) => {
    if (!workflowManager) {
        return res.status(503).json({
            error: 'Workflow system not available'
        });
    }

    try {
        const { name } = req.params;
        const workflow = workflowManager.getWorkflow(name);

        if (!workflow) {
            return res.status(404).json({
                error: 'Workflow not found',
                available: workflowManager.listWorkflows().map(w => w.name)
            });
        }

        res.json({
            workflow: workflow
        });

    } catch (error) {
        console.error('Error getting workflow:', error);
        res.status(500).json({
            error: 'Failed to get workflow',
            message: error.message
        });
    }
});

/**
 * POST /api/workflows/execute
 * Esegui workflow
 */
app.post('/api/workflows/execute', async (req, res) => {
    if (!workflowManager) {
        return res.status(503).json({
            error: 'Workflow system not available'
        });
    }

    try {
        const { workflow, context = {} } = req.body;

        if (!workflow) {
            return res.status(400).json({
                error: 'workflow name is required',
                example: {
                    workflow: 'full-audit',
                    context: {
                        branch: 'main',
                        environment: 'production'
                    }
                }
            });
        }

        // Esegui workflow
        const result = await workflowManager.executeWorkflow(workflow, context);

        res.json(result);

    } catch (error) {
        console.error('Error executing workflow:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to execute workflow',
            message: error.message
        });
    }
});

/**
 * POST /api/workflows/create
 * Crea nuovo workflow
 */
app.post('/api/workflows/create', async (req, res) => {
    if (!workflowManager) {
        return res.status(503).json({
            error: 'Workflow system not available'
        });
    }

    try {
        const config = req.body;

        if (!config.name || !config.steps) {
            return res.status(400).json({
                error: 'name and steps are required',
                example: {
                    name: 'my-workflow',
                    description: 'Description',
                    steps: [
                        {
                            name: 'Step 1',
                            agent: 'explore',
                            task: 'Find all TODO comments'
                        }
                    ]
                }
            });
        }

        const result = await workflowManager.createWorkflow(config);

        res.json(result);

    } catch (error) {
        console.error('Error creating workflow:', error);
        res.status(400).json({
            error: 'Failed to create workflow',
            message: error.message
        });
    }
});

/**
 * PUT /api/workflows/:name
 * Aggiorna workflow esistente
 */
app.put('/api/workflows/:name', async (req, res) => {
    if (!workflowManager) {
        return res.status(503).json({
            error: 'Workflow system not available'
        });
    }

    try {
        const { name } = req.params;
        const updates = req.body;

        const result = await workflowManager.updateWorkflow(name, updates);

        res.json(result);

    } catch (error) {
        console.error('Error updating workflow:', error);
        res.status(400).json({
            error: 'Failed to update workflow',
            message: error.message
        });
    }
});

/**
 * DELETE /api/workflows/:name
 * Elimina workflow
 */
app.delete('/api/workflows/:name', async (req, res) => {
    if (!workflowManager) {
        return res.status(503).json({
            error: 'Workflow system not available'
        });
    }

    try {
        const { name } = req.params;

        const result = await workflowManager.deleteWorkflow(name);

        res.json(result);

    } catch (error) {
        console.error('Error deleting workflow:', error);
        res.status(400).json({
            error: 'Failed to delete workflow',
            message: error.message
        });
    }
});

/**
 * POST /api/workflows/reload
 * Ricarica workflows da disco
 */
app.post('/api/workflows/reload', async (req, res) => {
    if (!workflowManager) {
        return res.status(503).json({
            error: 'Workflow system not available'
        });
    }

    try {
        const workflows = await workflowManager.reloadWorkflows();

        res.json({
            success: true,
            message: 'Workflows reloaded successfully',
            workflows: workflows,
            count: workflows.length
        });

    } catch (error) {
        console.error('Error reloading workflows:', error);
        res.status(500).json({
            error: 'Failed to reload workflows',
            message: error.message
        });
    }
});

/**
 * WEBHOOK SYSTEM ENDPOINTS
 * Sistema di trigger automatici per eventi
 */

/**
 * GET /api/webhooks
 * Lista tutti i webhooks
 */
app.get('/api/webhooks', (req, res) => {
    if (!webhookManager) {
        return res.json({
            webhooks: [],
            message: 'Webhook system not available'
        });
    }

    try {
        const webhooks = webhookManager.listWebhooks();

        res.json({
            success: true,
            webhooks: webhooks,
            count: webhooks.length
        });

    } catch (error) {
        console.error('Error listing webhooks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list webhooks',
            message: error.message
        });
    }
});

/**
 * POST /api/webhooks
 * Crea nuovo webhook
 */
app.post('/api/webhooks', async (req, res) => {
    if (!webhookManager) {
        return res.status(503).json({
            error: 'Webhook system not available'
        });
    }

    try {
        const config = req.body;

        if (!config.name || !config.event || !config.action) {
            return res.status(400).json({
                error: 'name, event, and action are required',
                example: {
                    name: 'pre-commit-security',
                    description: 'Run security audit on pre-commit',
                    event: 'pre-commit',
                    action: {
                        type: 'workflow',
                        target: 'code-quality'
                    },
                    conditions: {
                        branch: 'main',
                        files: '*.js'
                    }
                }
            });
        }

        const result = await webhookManager.createWebhook(config);

        res.json(result);

    } catch (error) {
        console.error('Error creating webhook:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to create webhook',
            message: error.message
        });
    }
});

/**
 * POST /api/webhooks/trigger/:id
 * Trigger webhook manualmente o da evento
 */
app.post('/api/webhooks/trigger/:id', async (req, res) => {
    if (!webhookManager) {
        return res.status(503).json({
            error: 'Webhook system not available'
        });
    }

    try {
        const { id } = req.params;
        const payload = req.body;
        const secret = req.headers['x-webhook-secret'];

        const result = await webhookManager.triggerWebhook(id, payload, secret);

        res.json(result);

    } catch (error) {
        console.error('Error triggering webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to trigger webhook',
            message: error.message
        });
    }
});

/**
 * POST /api/webhooks/trigger-event
 * Trigger tutti i webhooks per un evento
 */
app.post('/api/webhooks/trigger-event', async (req, res) => {
    if (!webhookManager) {
        return res.status(503).json({
            error: 'Webhook system not available'
        });
    }

    try {
        const { event, payload = {} } = req.body;

        if (!event) {
            return res.status(400).json({
                error: 'event is required'
            });
        }

        const result = await webhookManager.triggerByEvent(event, payload);

        res.json(result);

    } catch (error) {
        console.error('Error triggering event webhooks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to trigger event webhooks',
            message: error.message
        });
    }
});

/**
 * PUT /api/webhooks/:id
 * Aggiorna webhook
 */
app.put('/api/webhooks/:id', async (req, res) => {
    if (!webhookManager) {
        return res.status(503).json({
            error: 'Webhook system not available'
        });
    }

    try {
        const { id } = req.params;
        const updates = req.body;

        const result = await webhookManager.updateWebhook(id, updates);

        res.json(result);

    } catch (error) {
        console.error('Error updating webhook:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to update webhook',
            message: error.message
        });
    }
});

/**
 * DELETE /api/webhooks/:id
 * Elimina webhook
 */
app.delete('/api/webhooks/:id', async (req, res) => {
    if (!webhookManager) {
        return res.status(503).json({
            error: 'Webhook system not available'
        });
    }

    try {
        const { id } = req.params;

        const result = await webhookManager.deleteWebhook(id);

        res.json(result);

    } catch (error) {
        console.error('Error deleting webhook:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to delete webhook',
            message: error.message
        });
    }
});

/**
 * POST /api/webhooks/:id/toggle
 * Abilita/disabilita webhook
 */
app.post('/api/webhooks/:id/toggle', async (req, res) => {
    if (!webhookManager) {
        return res.status(503).json({
            error: 'Webhook system not available'
        });
    }

    try {
        const { id } = req.params;

        const result = await webhookManager.toggleWebhook(id);

        res.json(result);

    } catch (error) {
        console.error('Error toggling webhook:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to toggle webhook',
            message: error.message
        });
    }
});

/**
 * GET /api/webhooks/:id/script
 * Genera script Git hook per webhook
 */
app.get('/api/webhooks/:id/script', (req, res) => {
    if (!webhookManager) {
        return res.status(503).json({
            error: 'Webhook system not available'
        });
    }

    try {
        const { id } = req.params;
        const { event } = req.query;

        if (!event) {
            return res.status(400).json({
                error: 'event query parameter is required (e.g., ?event=pre-commit)'
            });
        }

        const script = webhookManager.generateGitHookScript(id, event);

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${event}.sh"`);
        res.send(script);

    } catch (error) {
        console.error('Error generating hook script:', error);
        res.status(400).json({
            error: 'Failed to generate hook script',
            message: error.message
        });
    }
});

/**
 * GET /api/webhooks/history
 * Ottieni history esecuzioni webhook
 */
app.get('/api/webhooks/history', (req, res) => {
    if (!webhookManager) {
        return res.json({
            history: []
        });
    }

    try {
        const limit = parseInt(req.query.limit) || 50;
        const history = webhookManager.getHistory(limit);

        res.json({
            success: true,
            history: history,
            count: history.length
        });

    } catch (error) {
        console.error('Error getting webhook history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get webhook history',
            message: error.message
        });
    }
});

/**
 * GET /api/webhooks/stats
 * Ottieni statistiche webhooks
 */
app.get('/api/webhooks/stats', (req, res) => {
    if (!webhookManager) {
        return res.json({
            stats: {
                total: 0,
                enabled: 0,
                disabled: 0
            }
        });
    }

    try {
        const stats = webhookManager.getStats();

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('Error getting webhook stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get webhook stats',
            message: error.message
        });
    }
});

/**
 * SCHEDULER SYSTEM ENDPOINTS
 * Sistema di cron-based workflow automation
 */

/**
 * GET /api/schedules
 * Lista tutti gli schedules
 */
app.get('/api/schedules', (req, res) => {
    if (!schedulerManager) {
        return res.json({
            schedules: [],
            message: 'Scheduler system not available'
        });
    }

    try {
        const schedules = schedulerManager.listSchedules();

        res.json({
            success: true,
            schedules: schedules,
            count: schedules.length
        });

    } catch (error) {
        console.error('Error listing schedules:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list schedules',
            message: error.message
        });
    }
});

/**
 * POST /api/schedules
 * Crea nuovo schedule
 */
app.post('/api/schedules', async (req, res) => {
    if (!schedulerManager) {
        return res.status(503).json({
            error: 'Scheduler system not available'
        });
    }

    try {
        const config = req.body;

        if (!config.name || !config.workflow || (!config.cron && !config.interval)) {
            return res.status(400).json({
                error: 'name, workflow, and (cron or interval) are required',
                example: {
                    name: 'daily-security-scan',
                    description: 'Run security scan daily',
                    workflow: 'code-quality',
                    cron: '0 0 * * *',
                    context: {
                        branch: 'main'
                    }
                }
            });
        }

        const result = await schedulerManager.createSchedule(config);

        res.json(result);

    } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to create schedule',
            message: error.message
        });
    }
});

/**
 * PUT /api/schedules/:id
 * Aggiorna schedule
 */
app.put('/api/schedules/:id', async (req, res) => {
    if (!schedulerManager) {
        return res.status(503).json({
            error: 'Scheduler system not available'
        });
    }

    try {
        const { id } = req.params;
        const updates = req.body;

        const result = await schedulerManager.updateSchedule(id, updates);

        res.json(result);

    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to update schedule',
            message: error.message
        });
    }
});

/**
 * DELETE /api/schedules/:id
 * Elimina schedule
 */
app.delete('/api/schedules/:id', async (req, res) => {
    if (!schedulerManager) {
        return res.status(503).json({
            error: 'Scheduler system not available'
        });
    }

    try {
        const { id } = req.params;

        const result = await schedulerManager.deleteSchedule(id);

        res.json(result);

    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to delete schedule',
            message: error.message
        });
    }
});

/**
 * POST /api/schedules/:id/toggle
 * Abilita/disabilita schedule
 */
app.post('/api/schedules/:id/toggle', async (req, res) => {
    if (!schedulerManager) {
        return res.status(503).json({
            error: 'Scheduler system not available'
        });
    }

    try {
        const { id } = req.params;

        const result = await schedulerManager.toggleSchedule(id);

        res.json(result);

    } catch (error) {
        console.error('Error toggling schedule:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to toggle schedule',
            message: error.message
        });
    }
});

/**
 * POST /api/schedules/:id/execute
 * Esegui schedule manualmente (una tantum)
 */
app.post('/api/schedules/:id/execute', async (req, res) => {
    if (!schedulerManager) {
        return res.status(503).json({
            error: 'Scheduler system not available'
        });
    }

    try {
        const { id } = req.params;

        const result = await schedulerManager.executeSchedule(id);

        res.json(result);

    } catch (error) {
        console.error('Error executing schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to execute schedule',
            message: error.message
        });
    }
});

/**
 * GET /api/schedules/history
 * Ottieni history esecuzioni schedule
 */
app.get('/api/schedules/history', (req, res) => {
    if (!schedulerManager) {
        return res.json({
            history: []
        });
    }

    try {
        const limit = parseInt(req.query.limit) || 50;
        const history = schedulerManager.getHistory(limit);

        res.json({
            success: true,
            history: history,
            count: history.length
        });

    } catch (error) {
        console.error('Error getting schedule history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get schedule history',
            message: error.message
        });
    }
});

/**
 * GET /api/schedules/stats
 * Ottieni statistiche schedules
 */
app.get('/api/schedules/stats', (req, res) => {
    if (!schedulerManager) {
        return res.json({
            stats: {
                total: 0,
                enabled: 0,
                disabled: 0
            }
        });
    }

    try {
        const stats = schedulerManager.getStats();

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('Error getting schedule stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get schedule stats',
            message: error.message
        });
    }
});

/**
 * GET /api/schedules/cron-templates
 * Ottieni templates di cron expressions
 */
app.get('/api/schedules/cron-templates', (req, res) => {
    if (!schedulerManager) {
        return res.json({
            templates: {}
        });
    }

    try {
        const templates = schedulerManager.getCronTemplates();

        res.json({
            success: true,
            templates: templates
        });

    } catch (error) {
        console.error('Error getting cron templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cron templates',
            message: error.message
        });
    }
});

// ============================================================================
// VERSIONING API ENDPOINTS
// ============================================================================

/**
 * POST /api/agents/:name/versions
 * Crea una nuova versione di un agent
 */
app.post('/api/agents/:name/versions', async (req, res) => {
    if (!agentManager) {
        return res.status(503).json({
            success: false,
            error: 'Agent Manager not available'
        });
    }

    try {
        const { name } = req.params;
        const { version, tag, changelog, author } = req.body;

        const result = await agentManager.createAgentVersion(name, version, {
            tag,
            changelog,
            author,
            setAsLatest: req.body.setAsLatest,
            setAsCurrent: req.body.setAsCurrent
        });

        res.json(result);

    } catch (error) {
        console.error('Error creating agent version:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to create agent version',
            message: error.message
        });
    }
});

/**
 * GET /api/agents/:name/versions
 * Lista tutte le versioni di un agent
 */
app.get('/api/agents/:name/versions', async (req, res) => {
    if (!agentManager) {
        return res.json({
            success: true,
            versions: []
        });
    }

    try {
        const { name } = req.params;
        const result = await agentManager.listAgentVersions(name);

        res.json(result);

    } catch (error) {
        console.error('Error listing agent versions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list agent versions',
            message: error.message
        });
    }
});

/**
 * GET /api/agents/:name/versions/:version
 * Ottieni una versione specifica di un agent
 */
app.get('/api/agents/:name/versions/:version', async (req, res) => {
    if (!agentManager) {
        return res.status(404).json({
            success: false,
            error: 'Agent Manager not available'
        });
    }

    try {
        const { name, version } = req.params;
        const config = await agentManager.getAgentVersion(name, version);

        res.json({
            success: true,
            version,
            config
        });

    } catch (error) {
        console.error('Error getting agent version:', error);
        res.status(404).json({
            success: false,
            error: 'Version not found',
            message: error.message
        });
    }
});

/**
 * POST /api/agents/:name/versions/:version/switch
 * Switch alla versione specifica
 */
app.post('/api/agents/:name/versions/:version/switch', async (req, res) => {
    if (!agentManager) {
        return res.status(503).json({
            success: false,
            error: 'Agent Manager not available'
        });
    }

    try {
        const { name, version } = req.params;
        const result = await agentManager.switchAgentVersion(name, version);

        res.json(result);

    } catch (error) {
        console.error('Error switching agent version:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to switch version',
            message: error.message
        });
    }
});

/**
 * DELETE /api/agents/:name/versions/:version
 * Elimina una versione
 */
app.delete('/api/agents/:name/versions/:version', async (req, res) => {
    if (!agentManager) {
        return res.status(503).json({
            success: false,
            error: 'Agent Manager not available'
        });
    }

    try {
        const { name, version } = req.params;
        const result = await agentManager.deleteAgentVersion(name, version);

        res.json(result);

    } catch (error) {
        console.error('Error deleting agent version:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to delete version',
            message: error.message
        });
    }
});

/**
 * POST /api/workflows/:name/versions
 * Crea una nuova versione di un workflow
 */
app.post('/api/workflows/:name/versions', async (req, res) => {
    if (!workflowManager) {
        return res.status(503).json({
            success: false,
            error: 'Workflow Manager not available'
        });
    }

    try {
        const { name } = req.params;
        const { version, tag, changelog, author } = req.body;

        const result = await workflowManager.createWorkflowVersion(name, version, {
            tag,
            changelog,
            author,
            setAsLatest: req.body.setAsLatest,
            setAsCurrent: req.body.setAsCurrent
        });

        res.json(result);

    } catch (error) {
        console.error('Error creating workflow version:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to create workflow version',
            message: error.message
        });
    }
});

/**
 * GET /api/workflows/:name/versions
 * Lista tutte le versioni di un workflow
 */
app.get('/api/workflows/:name/versions', async (req, res) => {
    if (!workflowManager) {
        return res.json({
            success: true,
            versions: []
        });
    }

    try {
        const { name } = req.params;
        const result = await workflowManager.listWorkflowVersions(name);

        res.json(result);

    } catch (error) {
        console.error('Error listing workflow versions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list workflow versions',
            message: error.message
        });
    }
});

/**
 * GET /api/workflows/:name/versions/:version
 * Ottieni una versione specifica di un workflow
 */
app.get('/api/workflows/:name/versions/:version', async (req, res) => {
    if (!workflowManager) {
        return res.status(404).json({
            success: false,
            error: 'Workflow Manager not available'
        });
    }

    try {
        const { name, version } = req.params;
        const config = await workflowManager.getWorkflowVersion(name, version);

        res.json({
            success: true,
            version,
            config
        });

    } catch (error) {
        console.error('Error getting workflow version:', error);
        res.status(404).json({
            success: false,
            error: 'Version not found',
            message: error.message
        });
    }
});

/**
 * POST /api/workflows/:name/versions/:version/switch
 * Switch alla versione specifica
 */
app.post('/api/workflows/:name/versions/:version/switch', async (req, res) => {
    if (!workflowManager) {
        return res.status(503).json({
            success: false,
            error: 'Workflow Manager not available'
        });
    }

    try {
        const { name, version } = req.params;
        const result = await workflowManager.switchWorkflowVersion(name, version);

        res.json(result);

    } catch (error) {
        console.error('Error switching workflow version:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to switch version',
            message: error.message
        });
    }
});

/**
 * DELETE /api/workflows/:name/versions/:version
 * Elimina una versione
 */
app.delete('/api/workflows/:name/versions/:version', async (req, res) => {
    if (!workflowManager) {
        return res.status(503).json({
            success: false,
            error: 'Workflow Manager not available'
        });
    }

    try {
        const { name, version } = req.params;
        const result = await workflowManager.deleteWorkflowVersion(name, version);

        res.json(result);

    } catch (error) {
        console.error('Error deleting workflow version:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to delete version',
            message: error.message
        });
    }
});

// ============================================================================
// MARKETPLACE API ENDPOINTS
// ============================================================================

/**
 * GET /api/marketplace/config
 * Restituisce la configurazione del marketplace (local vs remote)
 */
app.get('/api/marketplace/config', (req, res) => {
    res.json({
        success: true,
        mode: marketplaceClient ? 'remote' : 'local',
        remoteUrl: MARKETPLACE_URL || null,
        authenticated: !!MARKETPLACE_API_KEY,
        features: {
            publish: marketplaceClient ? !!MARKETPLACE_API_KEY : true,
            browse: true,
            download: true,
            rate: marketplaceClient ? !!MARKETPLACE_API_KEY : false,
            register: !!marketplaceClient,
            login: !!marketplaceClient
        }
    });
});

/**
 * POST /api/marketplace/register
 * Registra nuovo utente sul marketplace remoto
 */
app.post('/api/marketplace/register', async (req, res) => {
    if (!marketplaceClient) {
        return res.status(400).json({
            success: false,
            error: 'Remote marketplace not configured. Registration only available in remote mode.'
        });
    }

    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username, email, and password are required'
            });
        }

        const result = await marketplaceClient.register(username, email, password);

        res.json(result);

    } catch (error) {
        console.error('Error registering user:', error);
        res.status(400).json({
            success: false,
            error: 'Registration failed',
            message: error.message
        });
    }
});

/**
 * POST /api/marketplace/login
 * Login utente sul marketplace remoto (ottieni API key)
 */
app.post('/api/marketplace/login', async (req, res) => {
    if (!marketplaceClient) {
        return res.status(400).json({
            success: false,
            error: 'Remote marketplace not configured. Login only available in remote mode.'
        });
    }

    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        const result = await marketplaceClient.login(username, password);

        res.json(result);

    } catch (error) {
        console.error('Error logging in:', error);
        res.status(401).json({
            success: false,
            error: 'Login failed',
            message: error.message
        });
    }
});

/**
 * GET /api/marketplace/remote/items
 * Browse items dal marketplace remoto
 */
app.get('/api/marketplace/remote/items', async (req, res) => {
    if (!marketplaceClient) {
        return res.status(400).json({
            success: false,
            error: 'Remote marketplace not configured'
        });
    }

    try {
        const filters = {
            type: req.query.type,
            category: req.query.category,
            search: req.query.search,
            sortBy: req.query.sortBy,
            order: req.query.order,
            limit: parseInt(req.query.limit) || 20,
            offset: parseInt(req.query.offset) || 0
        };

        const result = await marketplaceClient.browse(filters);

        res.json(result);

    } catch (error) {
        console.error('Error browsing remote marketplace:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to browse remote marketplace',
            message: error.message
        });
    }
});

/**
 * POST /api/marketplace/remote/publish
 * Pubblica item sul marketplace remoto
 */
app.post('/api/marketplace/remote/publish', async (req, res) => {
    if (!marketplaceClient) {
        return res.status(400).json({
            success: false,
            error: 'Remote marketplace not configured'
        });
    }

    if (!MARKETPLACE_API_KEY) {
        return res.status(401).json({
            success: false,
            error: 'API key required to publish. Please login first.'
        });
    }

    try {
        const result = await marketplaceClient.publish(req.body);

        res.json(result);

    } catch (error) {
        console.error('Error publishing to remote marketplace:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to publish to remote marketplace',
            message: error.message
        });
    }
});

/**
 * GET /api/marketplace/remote/items/:id
 * Ottieni dettagli item dal marketplace remoto
 */
app.get('/api/marketplace/remote/items/:id', async (req, res) => {
    if (!marketplaceClient) {
        return res.status(400).json({
            success: false,
            error: 'Remote marketplace not configured'
        });
    }

    try {
        const result = await marketplaceClient.getItem(req.params.id);

        res.json(result);

    } catch (error) {
        console.error('Error getting remote item:', error);
        res.status(404).json({
            success: false,
            error: 'Item not found',
            message: error.message
        });
    }
});

/**
 * POST /api/marketplace/remote/items/:id/download
 * Download item dal marketplace remoto e installa localmente
 */
app.post('/api/marketplace/remote/items/:id/download', async (req, res) => {
    if (!marketplaceClient) {
        return res.status(400).json({
            success: false,
            error: 'Remote marketplace not configured'
        });
    }

    try {
        const downloadResult = await marketplaceClient.download(req.params.id);

        // Installa localmente l'item scaricato
        if (downloadResult.success && downloadResult.item) {
            const item = downloadResult.item;

            if (item.type === 'agent' && agentManager) {
                // Installa agent localmente
                await agentManager.createCustomAgent(item.content);
            } else if (item.type === 'workflow' && workflowManager) {
                // Installa workflow localmente
                await workflowManager.createWorkflow(item.content);
            }
        }

        res.json(downloadResult);

    } catch (error) {
        console.error('Error downloading from remote marketplace:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to download item',
            message: error.message
        });
    }
});

/**
 * POST /api/marketplace/remote/items/:id/rate
 * Vota item sul marketplace remoto
 */
app.post('/api/marketplace/remote/items/:id/rate', async (req, res) => {
    if (!marketplaceClient) {
        return res.status(400).json({
            success: false,
            error: 'Remote marketplace not configured'
        });
    }

    if (!MARKETPLACE_API_KEY) {
        return res.status(401).json({
            success: false,
            error: 'API key required to rate items. Please login first.'
        });
    }

    try {
        const { rating, review } = req.body;
        const result = await marketplaceClient.rate(req.params.id, rating, review);

        res.json(result);

    } catch (error) {
        console.error('Error rating item:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to rate item',
            message: error.message
        });
    }
});

/**
 * GET /api/marketplace/remote/stats
 * Statistiche dal marketplace remoto
 */
app.get('/api/marketplace/remote/stats', async (req, res) => {
    if (!marketplaceClient) {
        return res.status(400).json({
            success: false,
            error: 'Remote marketplace not configured'
        });
    }

    try {
        const result = await marketplaceClient.getStats();

        res.json(result);

    } catch (error) {
        console.error('Error getting remote stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get marketplace stats',
            message: error.message
        });
    }
});

/**
 * GET /api/marketplace/items
 * Lista items dal marketplace con filtri
 */
app.get('/api/marketplace/items', async (req, res) => {
    if (!marketplaceManager) {
        return res.json({
            success: true,
            items: [],
            total: 0,
            page: 1,
            pages: 0
        });
    }

    try {
        const filters = {
            type: req.query.type, // 'agent' | 'workflow'
            category: req.query.category,
            tags: req.query.tags ? req.query.tags.split(',') : undefined,
            featured: req.query.featured === 'true',
            query: req.query.query,
            sortBy: req.query.sortBy || 'publishedAt',
            sortOrder: req.query.sortOrder || 'desc',
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20
        };

        const result = await marketplaceManager.list(filters);

        res.json(result);

    } catch (error) {
        console.error('Error listing marketplace items:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list marketplace items',
            message: error.message
        });
    }
});

/**
 * GET /api/marketplace/items/:id
 * Ottieni dettagli di un item
 */
app.get('/api/marketplace/items/:id', async (req, res) => {
    if (!marketplaceManager) {
        return res.status(404).json({
            success: false,
            error: 'Marketplace not available'
        });
    }

    try {
        const result = await marketplaceManager.getItem(req.params.id);

        res.json(result);

    } catch (error) {
        console.error('Error getting marketplace item:', error);
        res.status(404).json({
            success: false,
            error: 'Item not found',
            message: error.message
        });
    }
});

/**
 * POST /api/marketplace/publish
 * Pubblica un agent o workflow nel marketplace
 */
app.post('/api/marketplace/publish', async (req, res) => {
    if (!marketplaceManager) {
        return res.status(503).json({
            success: false,
            error: 'Marketplace not available'
        });
    }

    try {
        const result = await marketplaceManager.publish(req.body);

        res.json(result);

    } catch (error) {
        console.error('Error publishing to marketplace:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to publish item',
            message: error.message
        });
    }
});

/**
 * PUT /api/marketplace/items/:id
 * Aggiorna un item del marketplace
 */
app.put('/api/marketplace/items/:id', async (req, res) => {
    if (!marketplaceManager) {
        return res.status(503).json({
            success: false,
            error: 'Marketplace not available'
        });
    }

    try {
        const result = await marketplaceManager.update(req.params.id, req.body);

        res.json(result);

    } catch (error) {
        console.error('Error updating marketplace item:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to update item',
            message: error.message
        });
    }
});

/**
 * DELETE /api/marketplace/items/:id
 * Elimina un item dal marketplace
 */
app.delete('/api/marketplace/items/:id', async (req, res) => {
    if (!marketplaceManager) {
        return res.status(503).json({
            success: false,
            error: 'Marketplace not available'
        });
    }

    try {
        const result = await marketplaceManager.unpublish(req.params.id);

        res.json(result);

    } catch (error) {
        console.error('Error unpublishing marketplace item:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to unpublish item',
            message: error.message
        });
    }
});

/**
 * POST /api/marketplace/install/:id
 * Installa un item dal marketplace
 */
app.post('/api/marketplace/install/:id', async (req, res) => {
    if (!marketplaceManager) {
        return res.status(503).json({
            success: false,
            error: 'Marketplace not available'
        });
    }

    try {
        const result = await marketplaceManager.install(req.params.id);

        res.json(result);

    } catch (error) {
        console.error('Error installing from marketplace:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to install item',
            message: error.message
        });
    }
});

/**
 * POST /api/marketplace/items/:id/review
 * Aggiungi una recensione
 */
app.post('/api/marketplace/items/:id/review', async (req, res) => {
    if (!marketplaceManager) {
        return res.status(503).json({
            success: false,
            error: 'Marketplace not available'
        });
    }

    try {
        const result = await marketplaceManager.addReview(req.params.id, req.body);

        res.json(result);

    } catch (error) {
        console.error('Error adding review:', error);
        res.status(400).json({
            success: false,
            error: 'Failed to add review',
            message: error.message
        });
    }
});

/**
 * GET /api/marketplace/categories
 * Ottieni categorie disponibili
 */
app.get('/api/marketplace/categories', (req, res) => {
    if (!marketplaceManager) {
        return res.json({
            success: true,
            categories: []
        });
    }

    try {
        const categories = marketplaceManager.getCategories();

        res.json({
            success: true,
            categories: categories
        });

    } catch (error) {
        console.error('Error getting categories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get categories',
            message: error.message
        });
    }
});

/**
 * GET /api/marketplace/stats
 * Ottieni statistiche marketplace
 */
app.get('/api/marketplace/stats', (req, res) => {
    if (!marketplaceManager) {
        return res.json({
            success: true,
            stats: {
                total: 0,
                agents: 0,
                workflows: 0,
                featured: 0,
                totalDownloads: 0,
                avgRating: 0,
                byCategory: {},
                mostDownloaded: [],
                topRated: []
            }
        });
    }

    try {
        const stats = marketplaceManager.getStats();

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('Error getting marketplace stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get marketplace stats',
            message: error.message
        });
    }
});

// ============================================================================
// ANALYTICS API ENDPOINTS
// ============================================================================

/**
 * POST /api/analytics/track/agent
 * Track agent execution
 */
app.post('/api/analytics/track/agent', async (req, res) => {
    if (!analyticsManager) {
        return res.json({
            success: true,
            message: 'Analytics not available'
        });
    }

    try {
        const event = await analyticsManager.trackAgentExecution(req.body);

        res.json({
            success: true,
            event: event
        });

    } catch (error) {
        console.error('Error tracking agent execution:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to track agent execution',
            message: error.message
        });
    }
});

/**
 * POST /api/analytics/track/workflow
 * Track workflow execution
 */
app.post('/api/analytics/track/workflow', async (req, res) => {
    if (!analyticsManager) {
        return res.json({
            success: true,
            message: 'Analytics not available'
        });
    }

    try {
        const event = await analyticsManager.trackWorkflowExecution(req.body);

        res.json({
            success: true,
            event: event
        });

    } catch (error) {
        console.error('Error tracking workflow execution:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to track workflow execution',
            message: error.message
        });
    }
});

/**
 * POST /api/analytics/track/webhook
 * Track webhook trigger
 */
app.post('/api/analytics/track/webhook', async (req, res) => {
    if (!analyticsManager) {
        return res.json({
            success: true,
            message: 'Analytics not available'
        });
    }

    try {
        const event = await analyticsManager.trackWebhookTrigger(req.body);

        res.json({
            success: true,
            event: event
        });

    } catch (error) {
        console.error('Error tracking webhook trigger:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to track webhook trigger',
            message: error.message
        });
    }
});

/**
 * POST /api/analytics/track/schedule
 * Track schedule execution
 */
app.post('/api/analytics/track/schedule', async (req, res) => {
    if (!analyticsManager) {
        return res.json({
            success: true,
            message: 'Analytics not available'
        });
    }

    try {
        const event = await analyticsManager.trackScheduleExecution(req.body);

        res.json({
            success: true,
            event: event
        });

    } catch (error) {
        console.error('Error tracking schedule execution:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to track schedule execution',
            message: error.message
        });
    }
});

/**
 * GET /api/analytics/agents
 * Get agent statistics
 */
app.get('/api/analytics/agents', (req, res) => {
    if (!analyticsManager) {
        return res.json({
            success: true,
            stats: {
                total: 0,
                success: 0,
                failure: 0,
                successRate: 0,
                avgDuration: 0,
                byAgent: {},
                recent: []
            }
        });
    }

    try {
        const timeRange = req.query.timeRange || 'all';
        const stats = analyticsManager.getAgentStats(timeRange);

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('Error getting agent stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get agent stats',
            message: error.message
        });
    }
});

/**
 * GET /api/analytics/workflows
 * Get workflow statistics
 */
app.get('/api/analytics/workflows', (req, res) => {
    if (!analyticsManager) {
        return res.json({
            success: true,
            stats: {
                total: 0,
                success: 0,
                partial: 0,
                failure: 0,
                successRate: 0,
                avgDuration: 0,
                byWorkflow: {},
                recent: []
            }
        });
    }

    try {
        const timeRange = req.query.timeRange || 'all';
        const stats = analyticsManager.getWorkflowStats(timeRange);

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('Error getting workflow stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get workflow stats',
            message: error.message
        });
    }
});

/**
 * GET /api/analytics/webhooks
 * Get webhook statistics
 */
app.get('/api/analytics/webhooks', (req, res) => {
    if (!analyticsManager) {
        return res.json({
            success: true,
            stats: {
                total: 0,
                success: 0,
                skipped: 0,
                failure: 0,
                byWebhook: {},
                byEvent: {},
                recent: []
            }
        });
    }

    try {
        const timeRange = req.query.timeRange || 'all';
        const stats = analyticsManager.getWebhookStats(timeRange);

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('Error getting webhook stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get webhook stats',
            message: error.message
        });
    }
});

/**
 * GET /api/analytics/schedules
 * Get schedule statistics
 */
app.get('/api/analytics/schedules', (req, res) => {
    if (!analyticsManager) {
        return res.json({
            success: true,
            stats: {
                total: 0,
                success: 0,
                failure: 0,
                bySchedule: {},
                recent: []
            }
        });
    }

    try {
        const timeRange = req.query.timeRange || 'all';
        const stats = analyticsManager.getScheduleStats(timeRange);

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('Error getting schedule stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get schedule stats',
            message: error.message
        });
    }
});

/**
 * GET /api/analytics/dashboard
 * Get dashboard overview data
 */
app.get('/api/analytics/dashboard', (req, res) => {
    if (!analyticsManager) {
        return res.json({
            success: true,
            data: {
                timeRange: 'today',
                agents: { total: 0, success: 0, failure: 0, successRate: 0, avgDuration: 0, byAgent: {}, recent: [] },
                workflows: { total: 0, success: 0, partial: 0, failure: 0, successRate: 0, avgDuration: 0, byWorkflow: {}, recent: [] },
                webhooks: { total: 0, success: 0, skipped: 0, failure: 0, byWebhook: {}, byEvent: {}, recent: [] },
                schedules: { total: 0, success: 0, failure: 0, bySchedule: {}, recent: [] },
                summary: { totalExecutions: 0, totalSuccesses: 0, totalFailures: 0 }
            }
        });
    }

    try {
        const timeRange = req.query.timeRange || 'today';
        const data = analyticsManager.getDashboardOverview(timeRange);

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Error getting dashboard overview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get dashboard overview',
            message: error.message
        });
    }
});

/**
 * GET /api/analytics/timeseries
 * Get time series data for charts
 */
app.get('/api/analytics/timeseries', (req, res) => {
    if (!analyticsManager) {
        return res.json({
            success: true,
            data: []
        });
    }

    try {
        const period = req.query.period || 'daily';
        const days = parseInt(req.query.days) || 7;
        const data = analyticsManager.getTimeSeries(period, days);

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Error getting time series data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get time series data',
            message: error.message
        });
    }
});

// Serve index.html per tutte le altre route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Cleanup vecchie sessioni ogni ora
setInterval(() => {
    const now = new Date();
    const ONE_HOUR = 60 * 60 * 1000;

    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.lastActive > ONE_HOUR) {
            sessions.delete(sessionId);
            console.log(`🧹 Cleaned up inactive session: ${sessionId}`);
        }
    }
}, 60 * 60 * 1000);

// Start server
app.listen(PORT, () => {
    const apiReady = isApiConfigured();
    const provider = claudeService?.provider || 'none';
    const model = claudeService?.model || process.env.AI_MODEL || 'claude-sonnet-4-5-20250929';

    console.log(`
  ╔════════════════════════════════════════════════════════════╗
  ║                                                            ║
  ║          🤖 MOSSAB - AI Developer Assistant 🤖            ║
  ║                     Version 2.0.0                          ║
  ║                                                            ║
  ║  Server: http://localhost:${PORT.toString().padEnd(39)} ║
  ║                                                            ║
  ║  Mode: ${(apiReady ? '✅ FULL POWER' : '⚠️  LIMITED (no API)').padEnd(48)} ║
  ║  Provider: ${provider.padEnd(44)} ║
  ║  Model: ${model.substring(0, 47).padEnd(47)} ║
  ║                                                            ║
  ║  Capabilities:                                             ║
  ║    ${(apiReady ? '✅' : '❌')} Tool Use & MCP Integration                         ║
  ║    ${(apiReady ? '✅' : '❌')} Advanced Planning & Reasoning                      ║
  ║    ${(apiReady ? '✅' : '❌')} Conversation Memory                                ║
  ║    ${(apiReady ? '✅' : '❌')} Real-time Streaming + Steering                     ║
  ║    ✅ Modern Web Interface                                 ║
  ║                                                            ║
  ║  Status: 🟢 Online and ready to code!                     ║
  ║                                                            ║
  ╚════════════════════════════════════════════════════════════╝
  `);

    if (!apiReady) {
        console.log(`
  ⚠️  CONFIGURATION NEEDED
  ───────────────────────────────────────────────────────────
  To unlock Mossab's full capabilities:

  Option 1 - Anthropic Direct:
    ANTHROPIC_API_KEY=your_key_here

  Option 2 - LiteLLM Proxy:
    AI_PROVIDER=litellm
    LITELLM_PROXY_URL=http://localhost:4000
    LITELLM_MODEL=your_model

  Without configuration, Mossab runs with basic fallback responses.
  ───────────────────────────────────────────────────────────
        `);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT received, shutting down gracefully...');
    process.exit(0);
});
