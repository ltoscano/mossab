const Anthropic = require('@anthropic-ai/sdk');

/**
 * Claude Service - Gestisce l'integrazione con l'API di Claude
 * Implementa tutte le capacità avanzate: tool use, planning, memoria, ecc.
 */
class ClaudeService {
    constructor(apiKey) {
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

Ricorda: Il tuo obiettivo è essere il miglior assistente di programmazione possibile,
aiutando gli sviluppatori a scrivere codice migliore, più velocemente.`;
    }

    /**
     * Tool definitions - Strumenti che Mossab può invocare
     * Simili ai tool MCP che uso io
     */
    getTools() {
        if (!this.enableToolUse) return [];

        return [
            {
                name: 'web_search',
                description: 'Cerca informazioni su internet. Usa questo tool quando hai bisogno di informazioni aggiornate, documentazione, o risorse non incluse nella tua knowledge base.',
                input_schema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'La query di ricerca'
                        }
                    },
                    required: ['query']
                }
            },
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
    }

    /**
     * Esegue un tool (simulato - in produzione implementare le funzioni reali)
     */
    async executeTool(toolName, toolInput) {
        console.log(`🔧 Executing tool: ${toolName}`, toolInput);

        switch (toolName) {
            case 'web_search':
                return {
                    results: [
                        {
                            title: 'Risultato simulato',
                            snippet: `Risultati per la ricerca: "${toolInput.query}". In produzione, questo userebbe un'API di ricerca reale.`
                        }
                    ]
                };

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
}

module.exports = ClaudeService;
