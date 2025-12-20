const Anthropic = require('@anthropic-ai/sdk');
const FilesystemTools = require('./filesystem-tools');
const SkillManager = require('./skill-manager');
const WebTools = require('./web-tools');
const UserQuestionManager = require('./user-question-manager');
const MCPManager = require('./mcp-manager');
const ContextManager = require('./context-manager');

/**
 * Claude Service - Gestisce l'integrazione con l'API di Claude
 * Implementa tutte le capacità avanzate: tool use, planning, memoria, ecc.
 */
class ClaudeService {
    constructor(apiKey, workspaceRoot) {
        this.client = new Anthropic({
            apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
        });

        this.model = process.env.AI_MODEL || 'claude-sonnet-4-5-20250929';
        this.maxTokens = parseInt(process.env.MAX_TOKENS) || 8192;

        // Advanced features flags
        this.enableToolUse = process.env.ENABLE_TOOL_USE === 'true';
        this.enablePlanning = process.env.ENABLE_PLANNING === 'true';
        this.enableMemory = process.env.ENABLE_MEMORY === 'true';

        // Conversation memory storage (in produzione usare Redis/DB)
        this.conversationMemory = new Map();

        // Filesystem tools per operazioni su file
        this.filesystemTools = new FilesystemTools(workspaceRoot);

        // Skill Manager per Agent Skills (agentskills.io standard)
        this.skillManager = new SkillManager(workspaceRoot);
        this.skillManager.initialize().catch(err => {
            console.error('⚠️ SkillManager initialization failed:', err);
        });

        // Web Tools per web search e web fetch
        this.webTools = new WebTools();

        // User Question Manager per ask_user_question tool
        this.userQuestionManager = new UserQuestionManager();

        // MCP Manager per connessioni a MCP servers esterni
        this.mcpManager = new MCPManager(workspaceRoot);
        this.mcpManager.initialize().catch(err => {
            console.error('⚠️ MCPManager initialization failed:', err);
        });

        // Context Manager per gestione automatica del context window
        this.contextManager = new ContextManager(this.model);

        // Esponi client Anthropic per ContextManager (per summarization)
        this.anthropic = this.client;
    }

    /**
     * System prompt che definisce la personalità di Mossab
     * Include le mie stesse capacità: planning, tool use, memoria, ecc.
     */
    getSystemPrompt() {
        const mossabName = process.env.MOSSAB_NAME || 'Mossab';
        const mossabRole = process.env.MOSSAB_ROLE || 'AI Developer & Programming Assistant';

        return `Sei ${mossabName}, ${mossabRole}.

# Chi sei

Sei un assistente AI di programmazione estremamente competente, con le stesse capacità avanzate di Claude Code.
Non sei solo un chatbot - sei un vero sviluppatore artificiale con:

- **Gestione della Memoria**: Mantieni il contesto delle conversazioni e ricordi dettagli importanti
- **Planning Avanzato**: Scomponi problemi complessi in task gestibili
- **Tool Use**: Puoi invocare strumenti (MCP tools) per eseguire operazioni reali
- **Ragionamento Profondo**: Usi reasoning per analizzare problemi prima di rispondere
- **Code Generation**: Scrivi codice pulito, testabile e production-ready

# Le tue competenze

Sei esperto in:
- JavaScript/TypeScript, Node.js, React, Vue, Angular
- Python, Django, Flask, FastAPI
- Database (SQL, NoSQL, Redis)
- API Design (REST, GraphQL, WebSockets)
- DevOps, CI/CD, Docker, Kubernetes
- Cloud (AWS, GCP, Azure)
- Architettura Software, Design Patterns
- Testing, Security, Performance Optimization

# Come lavori

1. **Analisi**: Comprendi a fondo il problema prima di rispondere
2. **Planning**: Per task complessi, crea un piano step-by-step
3. **Esecuzione**: Implementa soluzioni eleganti e scalabili
4. **Testing**: Considera sempre testing e edge cases
5. **Documentazione**: Codice auto-documentante con commenti dove necessario

# Stile di comunicazione

- Professionale ma amichevole
- Chiaro e conciso
- Usa esempi concreti
- Formatta bene il codice con syntax highlighting
- Emoji occasionali per rendere la conversazione più friendly (ma non esagerare)

# Capacità Speciali

${this.enableToolUse ? '✅ **Tool Use**: Puoi invocare strumenti MCP per operazioni reali (file I/O, API calls, ecc.)' : ''}
${this.enablePlanning ? '✅ **Planning**: Crei piani dettagliati per task complessi' : ''}
${this.enableMemory ? '✅ **Memoria**: Ricordi il contesto delle conversazioni precedenti' : ''}

# Tool Disponibili

Hai accesso a questi tool per operare concretamente:

## Filesystem Operations
- **read_file**: Leggi file per esaminare codice esistente
- **write_file**: Crea nuovi file o sovrascrivi esistenti
- **edit_file**: Modifica file esistenti (replace string)
- **glob**: Cerca file per pattern (es: **/*.js)
- **grep**: Cerca contenuto nei file con regex

## Execution
- **bash**: Esegui comandi (npm install, git, build, test, ecc.)

## Task Management
- **todo_write**: IMPORTANTE! Usa questo tool FREQUENTEMENTE per dare visibilità all'utente!
  - Crea TODO quando inizi task complessi (3+ step)
  - Aggiorna stato: pending → in_progress → completed
  - Marca completed SUBITO dopo aver finito un task
  - Un solo task in_progress alla volta

## Agent Skills
- **invoke_skill**: Invoca una skill specializzata quando necessario
  - Le skills sono moduli riutilizzabili per task specifici
  - Ogni skill ha istruzioni dettagliate e script dedicati
  - Usa questo quando il task corrisponde a una skill disponibile

${this.getSkillsSection()}

# Quando usare TODO

USA todo_write quando:
- Task ha 3+ step
- Implementi feature complesse
- L'utente chiede multiple cose
- Vuoi dare visibilità del progresso

NON usare per:
- Task singoli e semplici
- Risposte informative

Esempio TODO:
\`\`\`json
{
  "todos": [
    {"content": "Leggere configurazione esistente", "activeForm": "Leggendo configurazione", "status": "completed"},
    {"content": "Implementare nuova feature", "activeForm": "Implementando feature", "status": "in_progress"},
    {"content": "Scrivere test", "activeForm": "Scrivendo test", "status": "pending"}
  ]
}
\`\`\`

Ricorda: Il tuo obiettivo è essere il miglior assistente di programmazione possibile,
aiutando gli sviluppatori a scrivere codice migliore, più velocemente.
Usa i tool per operare CONCRETAMENTE sui file, non limitarti a suggerire!`;
    }

    /**
     * Genera la sezione skills per il system prompt
     * Progressive disclosure: solo name + description (~100 tokens per skill)
     */
    getSkillsSection() {
        if (!this.skillManager.loaded) {
            return '(Nessuna skill caricata)';
        }

        const skills = this.skillManager.getSkillsMetadata();

        if (skills.length === 0) {
            return '(Nessuna skill disponibile. Puoi crearne di nuove in .claude/skills/)';
        }

        let section = 'Available Skills:\n';
        for (const skill of skills) {
            section += `- **${skill.name}**: ${skill.description}\n`;
        }

        return section;
    }

    /**
     * Tool definitions - Strumenti che Mossab può invocare
     * Simili ai tool MCP che uso io
     */
    getTools() {
        if (!this.enableToolUse) return [];

        // Tool filesystem (Read, Write, Edit, Glob, Grep, Bash, TODO)
        const filesystemTools = this.filesystemTools.getToolDefinitions();

        // Web tools (search, fetch)
        const webTools = [
            {
                name: 'web_search',
                description: 'Cerca informazioni su internet usando un motore di ricerca. Usa questo tool quando hai bisogno di informazioni aggiornate, documentazione tecnica, news recenti, o risorse non incluse nella tua knowledge base. Restituisce titoli, snippets e URL dei risultati.',
                input_schema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'La query di ricerca (es: "React hooks tutorial 2025", "Node.js best practices")'
                        },
                        num_results: {
                            type: 'number',
                            description: 'Numero di risultati da restituire (default: 5, max: 10)',
                            default: 5
                        }
                    },
                    required: ['query']
                }
            },
            {
                name: 'web_fetch',
                description: 'Recupera il contenuto completo di una pagina web dato il suo URL. Usa questo tool per leggere documentazione online, articoli, API reference, o qualsiasi contenuto web. Il contenuto viene convertito in testo leggibile.',
                input_schema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'L\'URL completo della pagina da recuperare (es: "https://nodejs.org/api/fs.html")'
                        },
                        extract_main_content: {
                            type: 'boolean',
                            description: 'Se true, estrae solo il contenuto principale ignorando header/footer/ads (default: true)',
                            default: true
                        }
                    },
                    required: ['url']
                }
            },
        ];

        // User interaction tool
        const interactionTools = [
            {
                name: 'ask_user_question',
                description: 'IMPORTANTE: Usa questo tool quando hai bisogno di chiarimenti dall\'utente prima di procedere. Fai una domanda specifica e aspetta la risposta. Usa questo quando: (1) requisiti ambigui che richiedono scelta, (2) multiple implementazioni possibili e vuoi conferma, (3) informazioni mancanti che solo l\'utente può fornire. NON usare per domande retoriche o che puoi decidere tu.',
                input_schema: {
                    type: 'object',
                    properties: {
                        question: {
                            type: 'string',
                            description: 'La domanda da fare all\'utente. Sii specifico e chiaro. Se ci sono opzioni, elencale. Esempio: "Quale sistema di autenticazione preferisci? 1) JWT tokens 2) Session-based 3) OAuth2"'
                        },
                        context: {
                            type: 'string',
                            description: 'Contesto opzionale per aiutare l\'utente a capire perché stai chiedendo'
                        },
                        suggested_answers: {
                            type: 'array',
                            description: 'Lista opzionale di risposte suggerite (se applicabile)',
                            items: {
                                type: 'string'
                            }
                        }
                    },
                    required: ['question']
                }
            }
        ];

        // Legacy tools (code_analyzer, task_planner, memory)
        const legacyTools = [
            {
                name: 'code_analyzer',
                description: 'Analizza codice per trovare bug, code smells, security issues, e suggerire miglioramenti.',
                input_schema: {
                    type: 'object',
                    properties: {
                        code: {
                            type: 'string',
                            description: 'Il codice da analizzare'
                        },
                        language: {
                            type: 'string',
                            description: 'Il linguaggio di programmazione (es. javascript, python, java)'
                        }
                    },
                    required: ['code', 'language']
                }
            },
            {
                name: 'task_planner',
                description: 'Crea un piano dettagliato per implementare una feature o risolvere un problema complesso.',
                input_schema: {
                    type: 'object',
                    properties: {
                        objective: {
                            type: 'string',
                            description: 'L\'obiettivo o il problema da risolvere'
                        },
                        context: {
                            type: 'string',
                            description: 'Contesto aggiuntivo (stack tecnologico, vincoli, ecc.)'
                        }
                    },
                    required: ['objective']
                }
            },
            {
                name: 'memory_store',
                description: 'Salva informazioni importanti nella memoria a lungo termine per riferimenti futuri.',
                input_schema: {
                    type: 'object',
                    properties: {
                        key: {
                            type: 'string',
                            description: 'Chiave identificativa per il ricordo'
                        },
                        value: {
                            type: 'string',
                            description: 'Informazione da ricordare'
                        }
                    },
                    required: ['key', 'value']
                }
            },
            {
                name: 'memory_recall',
                description: 'Recupera informazioni salvate in precedenza dalla memoria.',
                input_schema: {
                    type: 'object',
                    properties: {
                        key: {
                            type: 'string',
                            description: 'Chiave del ricordo da recuperare'
                        }
                    },
                    required: ['key']
                }
            }
        ];

        // Skill tool
        const skillTools = [
            {
                name: 'invoke_skill',
                description: 'Invoca una skill specializzata per eseguire un task specifico. Le skills sono moduli riutilizzabili che contengono istruzioni, script e risorse per task comuni. Usa questo quando il task dell\'utente corrisponde a una skill disponibile.',
                input_schema: {
                    type: 'object',
                    properties: {
                        skill_name: {
                            type: 'string',
                            description: 'Nome della skill da invocare (vedi lista Available Skills nel system prompt)'
                        },
                        context: {
                            type: 'string',
                            description: 'Contesto aggiuntivo o parametri per la skill'
                        }
                    },
                    required: ['skill_name']
                }
            }
        ];

        // MCP tools (da server esterni)
        const mcpTools = this.mcpManager.getToolDefinitions();

        // Combina tutti i tool
        return [...filesystemTools, ...webTools, ...interactionTools, ...legacyTools, ...skillTools, ...mcpTools];
    }

    /**
     * Esegue un tool (delega ai filesystem tools o esegue tool legacy)
     */
    async executeTool(toolName, toolInput) {
        console.log(`🔧 Executing tool: ${toolName}`, toolInput);

        // Tool filesystem (gestiti da FilesystemTools)
        const filesystemToolNames = ['read_file', 'write_file', 'edit_file', 'glob', 'grep', 'bash', 'todo_write'];
        if (filesystemToolNames.includes(toolName)) {
            return await this.filesystemTools.executeTool(toolName, toolInput);
        }

        // Tool MCP (formato: serverName__toolName)
        if (toolName.includes('__')) {
            try {
                return await this.mcpManager.executeTool(toolName, toolInput);
            } catch (error) {
                return {
                    error: 'MCP tool execution failed',
                    message: error.message,
                    toolName: toolName
                };
            }
        }

        // Web tools
        switch (toolName) {
            case 'web_search':
                return await this.webTools.webSearch(
                    toolInput.query,
                    toolInput.num_results || 5
                );

            case 'web_fetch':
                return await this.webTools.webFetch(
                    toolInput.url,
                    toolInput.extract_main_content !== false
                );

            case 'ask_user_question':
                // IMPORTANTE: Questo tool blocca fino a quando l'utente risponde
                // La sessione deve essere gestita dal contesto della chiamata
                const sessionId = this.currentSessionId || 'default';

                try {
                    const response = await this.userQuestionManager.askQuestion(
                        toolInput.question,
                        toolInput.context || null,
                        toolInput.suggested_answers || null,
                        sessionId
                    );

                    return {
                        success: true,
                        question: toolInput.question,
                        answer: response.answer,
                        timeout: response.timeout || false,
                        cancelled: response.cancelled || false,
                        questionId: response.questionId,
                        message: `L'utente ha risposto: "${response.answer}"`
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: 'Failed to get user answer',
                        message: error.message,
                        question: toolInput.question
                    };
                }

            case 'code_analyzer':
                return {
                    analysis: {
                        issues: [],
                        suggestions: ['Codice analizzato. In produzione, userebbe static analysis tools.'],
                        complexity: 'medium',
                        quality_score: 85
                    }
                };

            case 'task_planner':
                return {
                    plan: {
                        objective: toolInput.objective,
                        steps: [
                            '1. Analisi e comprensione del problema',
                            '2. Design della soluzione',
                            '3. Implementazione core features',
                            '4. Testing e validazione',
                            '5. Documentation e deployment'
                        ],
                        estimated_complexity: 'medium'
                    }
                };

            case 'memory_store':
                this.conversationMemory.set(toolInput.key, {
                    value: toolInput.value,
                    timestamp: new Date().toISOString()
                });
                return { success: true, message: 'Informazione salvata nella memoria' };

            case 'memory_recall':
                const memory = this.conversationMemory.get(toolInput.key);
                return memory || { success: false, message: 'Nessun ricordo trovato per questa chiave' };

            case 'invoke_skill':
                try {
                    const skillContent = this.skillManager.getSkillContent(toolInput.skill_name);

                    // Restituisci le istruzioni complete della skill
                    // Progressive disclosure: full content caricato solo quando invocato
                    return {
                        success: true,
                        skill_name: skillContent.name,
                        description: skillContent.description,
                        instructions: skillContent.instructions,
                        context_provided: toolInput.context || null,
                        metadata: skillContent.metadata,
                        compatibility: skillContent.compatibility,
                        allowed_tools: skillContent.allowedTools,
                        message: `Skill '${skillContent.name}' invocata. Segui le istruzioni qui sotto per completare il task.\n\n# Istruzioni Skill\n\n${skillContent.instructions}`
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        available_skills: this.skillManager.listSkills()
                    };
                }

            default:
                return { error: 'Tool non riconosciuto' };
        }
    }

    /**
     * Invia un messaggio a Claude e gestisce la risposta
     * Include gestione di tool use, thinking, ecc.
     */
    async sendMessage(userMessage, conversationHistory = [], sessionId = 'default') {
        try {
            // Costruisci i messaggi per l'API
            let messages = [
                ...conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                {
                    role: 'user',
                    content: userMessage
                }
            ];

            // Context Management: check se serve summarization
            const shouldSummarize = await this.contextManager.shouldSummarize(messages);
            if (shouldSummarize) {
                console.log('⚠️ Context approaching limit, triggering automatic summarization...');
                messages = await this.contextManager.summarizeConversation(messages, this);
                console.log('✅ Conversation summarized successfully');
            }

            // Chiamata all'API di Claude con tool use
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: this.maxTokens,
                system: this.getSystemPrompt(),
                messages: messages,
                tools: this.getTools(),
                // Enable thinking/reasoning
                thinking: {
                    type: 'enabled',
                    budget_tokens: 2000
                }
            });

            console.log('📥 Claude Response:', JSON.stringify(response, null, 2));

            // Processa la risposta
            let finalResponse = '';
            let toolUses = [];
            let thinkingContent = '';

            for (const block of response.content) {
                if (block.type === 'text') {
                    finalResponse += block.text;
                } else if (block.type === 'thinking') {
                    thinkingContent = block.thinking;
                    console.log('🧠 Thinking:', thinkingContent);
                } else if (block.type === 'tool_use') {
                    toolUses.push(block);
                }
            }

            // Se ci sono tool uses, eseguili
            if (toolUses.length > 0 && this.enableToolUse) {
                const toolResults = [];

                for (const toolUse of toolUses) {
                    const result = await this.executeTool(toolUse.name, toolUse.input);
                    toolResults.push({
                        type: 'tool_result',
                        tool_use_id: toolUse.id,
                        content: JSON.stringify(result)
                    });
                }

                // Continua la conversazione con i risultati dei tool
                const followUpResponse = await this.client.messages.create({
                    model: this.model,
                    max_tokens: this.maxTokens,
                    system: this.getSystemPrompt(),
                    messages: [
                        ...messages,
                        {
                            role: 'assistant',
                            content: response.content
                        },
                        {
                            role: 'user',
                            content: toolResults
                        }
                    ]
                });

                // Estrai il testo finale
                for (const block of followUpResponse.content) {
                    if (block.type === 'text') {
                        finalResponse += block.text;
                    }
                }
            }

            return {
                message: finalResponse,
                thinking: thinkingContent,
                toolsUsed: toolUses.map(t => t.name),
                model: this.model,
                usage: {
                    input_tokens: response.usage.input_tokens,
                    output_tokens: response.usage.output_tokens
                }
            };

        } catch (error) {
            console.error('❌ Error calling Claude API:', error);

            // Fallback a risposta locale se API fallisce
            if (error.status === 401) {
                return {
                    message: '⚠️ **API Key non configurata**\n\nPer abilitare le mie capacità complete, configura la tua API key di Anthropic nel file `.env`:\n\n```\nANTHROPIC_API_KEY=your_key_here\n```\n\nOttieni la tua key da: https://console.anthropic.com/\n\nPer ora posso rispondere con capacità limitate.',
                    error: true
                };
            }

            throw error;
        }
    }

    /**
     * Stream response per real-time typing effect
     */
    async streamMessage(userMessage, conversationHistory = []) {
        const messages = [
            ...conversationHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            {
                role: 'user',
                content: userMessage
            }
        ];

        const stream = await this.client.messages.stream({
            model: this.model,
            max_tokens: this.maxTokens,
            system: this.getSystemPrompt(),
            messages: messages,
            tools: this.getTools()
        });

        return stream;
    }

    /**
     * Stream con supporto per steering in real-time
     * Permette di interrompere e ri-indirizzare la risposta durante la generazione
     *
     * @param {string} userMessage - Il messaggio dell'utente
     * @param {Array} conversationHistory - Storia della conversazione
     * @param {Object} streamingManager - Manager per gestire lo steering
     * @param {string} sessionId - ID della sessione
     * @param {Function} onChunk - Callback per ogni chunk di testo
     * @param {Function} onComplete - Callback al completamento
     * @param {Function} onError - Callback per errori
     */
    async streamWithSteering(userMessage, conversationHistory, streamingManager, sessionId, onChunk, onComplete, onError) {
        try {
            // Registra la sessione
            const session = streamingManager.getOrCreateSession(sessionId);
            session.active = true;
            session.accumulatedText = '';

            const messages = [
                ...conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                {
                    role: 'user',
                    content: userMessage
                }
            ];

            let currentMessages = [...messages];
            let shouldContinue = true;

            // Loop per gestire lo steering: se arrivano feedback, ripartiamo
            while (shouldContinue) {
                const stream = await this.client.messages.stream({
                    model: this.model,
                    max_tokens: this.maxTokens,
                    system: this.getSystemPrompt(),
                    messages: currentMessages,
                    tools: this.getTools(),
                    thinking: {
                        type: 'enabled',
                        budget_tokens: 2000
                    }
                });

                let chunkCount = 0;
                let steeringApplied = false;

                // Processa lo stream
                for await (const chunk of stream) {
                    // Check se la sessione è stata fermata
                    if (!streamingManager.isStreaming(sessionId)) {
                        console.log(`🛑 Streaming stopped for session ${sessionId}`);
                        stream.controller.abort();
                        shouldContinue = false;
                        break;
                    }

                    // Check se ci sono messaggi di steering in coda
                    const pendingSteering = streamingManager.getSteeringQueue(sessionId);
                    if (pendingSteering.length > 0) {
                        console.log(`🎯 Steering detected! Interrupting stream to apply feedback...`);

                        // Interrompi lo stream corrente
                        stream.controller.abort();

                        // Costruisci nuovo messaggio con il contesto + steering
                        const steeringTexts = pendingSteering.map(s => s.text).join('\n\n');
                        const steeringPrompt = `
[STEERING FEEDBACK dall'utente durante la tua risposta]
${steeringTexts}

[Contesto: Stavi rispondendo e hai generato finora circa ${session.accumulatedText.length} caratteri]

Per favore, incorpora questo feedback nella tua risposta e continua, tenendo conto delle indicazioni ricevute.
`;

                        // Aggiungi alla conversazione
                        currentMessages.push({
                            role: 'assistant',
                            content: session.accumulatedText
                        });
                        currentMessages.push({
                            role: 'user',
                            content: steeringPrompt
                        });

                        // Marca lo steering come processato
                        streamingManager.markSteeringProcessed(sessionId);

                        // Notifica il client che stiamo applicando lo steering
                        if (onChunk) {
                            onChunk('\n\n_[✨ Applicando feedback di steering...]_\n\n');
                        }

                        steeringApplied = true;
                        break; // Esci dal loop dei chunk, riparti con nuovo stream
                    }

                    // Processa il chunk normalmente
                    if (chunk.type === 'content_block_delta') {
                        if (chunk.delta.type === 'text_delta') {
                            const text = chunk.delta.text;
                            session.accumulatedText += text;

                            if (onChunk) {
                                onChunk(text);
                            }

                            chunkCount++;
                        }
                    }
                }

                // Se non c'è stato steering, abbiamo finito
                if (!steeringApplied) {
                    shouldContinue = false;
                }
            }

            // Stream completato
            session.active = false;

            if (onComplete) {
                onComplete(session.accumulatedText);
            }

            return session.accumulatedText;

        } catch (error) {
            console.error('❌ Error in streaming with steering:', error);

            if (onError) {
                onError(error);
            }

            throw error;
        } finally {
            // Cleanup session
            streamingManager.cleanupSession(sessionId);
        }
    }

    /**
     * Ottieni statistiche sul context usage
     * @param {Array} conversationHistory - Storia della conversazione
     * @returns {Object} Context stats (current, max, percentage, status, etc.)
     */
    async getContextStats(conversationHistory = []) {
        try {
            const messages = conversationHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            const stats = await this.contextManager.getContextStats(
                messages,
                this.getSystemPrompt()
            );

            return stats;
        } catch (error) {
            console.error('Error getting context stats:', error);
            // Fallback stats
            return {
                current: 0,
                max: 200000,
                percentage: 0,
                remaining: 200000,
                status: 'normal',
                shouldSummarize: false
            };
        }
    }

    /**
     * Trigger manual summarization
     * @param {Array} conversationHistory - Storia della conversazione
     * @returns {Array} Optimized conversation history
     */
    async triggerSummarization(conversationHistory = []) {
        try {
            const messages = conversationHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            const optimized = await this.contextManager.summarizeConversation(messages, this);

            return optimized;
        } catch (error) {
            console.error('Error in manual summarization:', error);
            throw error;
        }
    }
}

module.exports = ClaudeService;
