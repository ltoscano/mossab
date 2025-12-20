const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const ClaudeService = require('./claude-service');
const StreamingManager = require('./streaming-manager');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Workspace root per filesystem operations
const WORKSPACE_ROOT = path.join(__dirname, '..');

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
        "⚠️ **Modalità Limitata**: Sto funzionando senza l'API di Claude configurata.\n\n" +
        "Per attivare le mie capacità complete (reasoning, tool use, planning):\n" +
        "1. Configura `ANTHROPIC_API_KEY` nel file `.env`\n" +
        "2. Riavvia il server\n\n" +
        "Con l'API configurata potrò aiutarti molto meglio con codice, architettura, debugging e molto altro! 🚀";
}

/**
 * API Endpoint principale per la chat
 * Usa Claude Service con tutte le capacità avanzate
 */
app.post('/api/chat', async (req, res) => {
    try {
        const { message, conversationHistory = [], sessionId = 'default' } = req.body;

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({
                error: 'Message is required and must be a non-empty string'
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

        let response;

        // Usa Claude Service se disponibile
        if (claudeService && process.env.ANTHROPIC_API_KEY) {
            try {
                // Imposta il sessionId corrente per ask_user_question tool
                claudeService.currentSessionId = sessionId;

                response = await claudeService.sendMessage(
                    message,
                    conversationHistory.length > 0 ? conversationHistory : session.history,
                    sessionId
                );

                // Salva nella session history
                session.history.push(
                    { role: 'user', content: message },
                    { role: 'assistant', content: response.message }
                );

                // Limita la history a 50 messaggi per sessione
                if (session.history.length > 100) {
                    session.history = session.history.slice(-100);
                }

                res.json({
                    message: response.message,
                    thinking: response.thinking,
                    toolsUsed: response.toolsUsed,
                    model: response.model,
                    usage: response.usage,
                    timestamp: new Date().toISOString(),
                    sessionId: sessionId,
                    capabilities: {
                        toolUse: claudeService.enableToolUse,
                        planning: claudeService.enablePlanning,
                        memory: claudeService.enableMemory
                    }
                });

            } catch (apiError) {
                console.error('Claude API Error:', apiError);

                // Fallback se l'API ha errori
                res.json({
                    message: getFallbackResponse(message),
                    error: true,
                    errorMessage: 'API Error - usando fallback',
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
                hint: 'Configure ANTHROPIC_API_KEY to unlock full capabilities'
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

        if (!claudeService || !process.env.ANTHROPIC_API_KEY) {
            return res.status(503).json({
                error: 'Streaming requires Claude API configuration'
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
    const isApiConfigured = !!process.env.ANTHROPIC_API_KEY;

    res.json({
        name: process.env.MOSSAB_NAME || 'Mossab',
        role: process.env.MOSSAB_ROLE || 'AI Developer & Programming Assistant',
        version: '2.0.0',
        model: process.env.AI_MODEL || 'claude-sonnet-4-5-20250929',
        apiConfigured: isApiConfigured,
        capabilities: {
            chat: true,
            streaming: isApiConfigured,
            toolUse: isApiConfigured && claudeService?.enableToolUse,
            planning: isApiConfigured && claudeService?.enablePlanning,
            memory: isApiConfigured && claudeService?.enableMemory,
            reasoning: isApiConfigured,
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
        availableTools: isApiConfigured ? claudeService?.getTools().map(t => t.name) : [],
        status: isApiConfigured ? 'fully_operational' : 'limited_mode'
    });
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
    const isHealthy = !!claudeService;

    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'degraded',
        mode: process.env.ANTHROPIC_API_KEY ? 'full' : 'fallback',
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
        const conversationHistory = sessions.get(sessionId) || [];

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
        // Ottieni conversation history
        const conversationHistory = sessions.get(sessionId) || [];

        if (conversationHistory.length === 0) {
            return res.json({
                success: true,
                message: 'No messages to summarize',
                optimized: []
            });
        }

        // Trigger summarization
        const optimized = await claudeService.triggerSummarization(conversationHistory);

        // Aggiorna la sessione con history ottimizzata
        sessions.set(sessionId, optimized);

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
    const apiConfigured = !!process.env.ANTHROPIC_API_KEY;

    console.log(`
  ╔════════════════════════════════════════════════════════════╗
  ║                                                            ║
  ║          🤖 MOSSAB - AI Developer Assistant 🤖            ║
  ║                     Version 2.0.0                          ║
  ║                                                            ║
  ║  Server: http://localhost:${PORT.toString().padEnd(39)} ║
  ║                                                            ║
  ║  Mode: ${(apiConfigured ? '✅ FULL POWER' : '⚠️  LIMITED (no API key)').padEnd(48)} ║
  ║                                                            ║
  ${apiConfigured ? `║  Model: ${(process.env.AI_MODEL || 'claude-sonnet-4-5-20250929').padEnd(47)} ║` : '║  💡 Configure ANTHROPIC_API_KEY for full capabilities  ║'}
  ║                                                            ║
  ║  Capabilities:                                             ║
  ║    ${(apiConfigured ? '✅' : '❌')} Tool Use & MCP Integration                         ║
  ║    ${(apiConfigured ? '✅' : '❌')} Advanced Planning & Reasoning                      ║
  ║    ${(apiConfigured ? '✅' : '❌')} Conversation Memory                                ║
  ║    ${(apiConfigured ? '✅' : '❌')} Real-time Streaming                                ║
  ║    ✅ Modern Web Interface                                 ║
  ║                                                            ║
  ║  Status: 🟢 Online and ready to code!                     ║
  ║                                                            ║
  ╚════════════════════════════════════════════════════════════╝
  `);

    if (!apiConfigured) {
        console.log(`
  ⚠️  CONFIGURATION NEEDED
  ───────────────────────────────────────────────────────────
  To unlock Mossab's full capabilities:

  1. Get API key: https://console.anthropic.com/
  2. Add to .env file: ANTHROPIC_API_KEY=your_key_here
  3. Restart server

  Without API key, Mossab runs with basic fallback responses.
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
