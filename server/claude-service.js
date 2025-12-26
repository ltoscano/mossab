const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const FilesystemTools = require('./filesystem-tools');
const SkillManager = require('./skill-manager');
const WebTools = require('./web-tools');
const UserQuestionManager = require('./user-question-manager');
const MCPManager = require('./mcp-manager');
const ContextManager = require('./context-manager');
const ProjectContextManager = require('./project-context-manager');
const GitToolsManager = require('./git-tools-manager');
const CodeReviewer = require('./code-reviewer');
const PRTemplateManager = require('./pr-template-manager');

/**
 * Claude Service - Gestisce l'integrazione con l'API di Claude
 * Implementa tutte le capacità avanzate: tool use, planning, memoria, ecc.
 */
class ClaudeService {
    constructor(apiKey, workspaceRoot) {
        // Provider configuration: 'anthropic' (direct) or 'litellm' (proxy)
        this.provider = process.env.AI_PROVIDER || 'anthropic';
        this.maxTokens = parseInt(process.env.MAX_TOKENS) || 8192;

        // Initialize client based on provider
        if (this.provider === 'litellm') {
            // LiteLLM Proxy (OpenAI-compatible API)
            this.client = new OpenAI({
                apiKey: process.env.LITELLM_API_KEY || 'default',
                baseURL: process.env.LITELLM_PROXY_URL || 'http://localhost:4000'
            });
            this.model = process.env.LITELLM_MODEL || 'claude-sonnet-4-5-20250929';

            // Model routing for different task complexities
            this.modelRouting = {
                simple: process.env.LITELLM_MODEL_SIMPLE || this.model,
                advanced: process.env.LITELLM_MODEL_ADVANCED || this.model,
                fast: process.env.LITELLM_MODEL_FAST || this.model
            };

            console.log(`✅ LiteLLM Proxy configured: ${this.client.baseURL}`);
            console.log(`   Default model: ${this.model}`);
            console.log(`   Simple tasks: ${this.modelRouting.simple}`);
            console.log(`   Advanced tasks: ${this.modelRouting.advanced}`);
        } else {
            // Anthropic Direct Connection
            this.client = new Anthropic({
                apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
            });
            this.model = process.env.AI_MODEL || 'claude-sonnet-4-5-20250929';

            console.log(`✅ Anthropic Direct configured`);
            console.log(`   Model: ${this.model}`);
        }

        // Esponi anche client Anthropic per ContextManager (summarization)
        // Se usiamo LiteLLM, creiamo un client Anthropic separato per summarization (opzionale)
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        const isValidAnthropicKey = anthropicKey &&
            anthropicKey.startsWith('sk-ant-') &&
            anthropicKey.length > 20;

        if (this.provider === 'litellm') {
            // LiteLLM mode - usa Anthropic per summarization solo se key valida
            this.anthropic = isValidAnthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
        } else {
            // Anthropic direct mode
            this.anthropic = this.client;
        }

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

        // Project Context Manager per preferenze e istruzioni del progetto
        this.projectContextManager = new ProjectContextManager(workspaceRoot);
        this.cachedProjectContextAddition = '';

        // Initialize e cache project context
        this.projectContextManager.initialize()
            .then(async () => {
                this.cachedProjectContextAddition = await this.projectContextManager.getSystemPromptAddition();
            })
            .catch(err => {
                console.error('⚠️ ProjectContextManager initialization failed:', err);
            });

        // Git Tools Manager per operazioni Git avanzate
        this.gitToolsManager = new GitToolsManager(workspaceRoot);
        this.gitToolsManager.initialize().catch(err => {
            console.error('⚠️ GitToolsManager initialization failed:', err);
        });

        // Code Reviewer per analisi automatica del codice
        this.codeReviewer = new CodeReviewer(this.gitToolsManager);

        // PR Template Manager per creazione PR con template
        this.prTemplateManager = new PRTemplateManager(workspaceRoot, this.gitToolsManager);
        this.prTemplateManager.initialize().catch(err => {
            console.error('⚠️ PRTemplateManager initialization failed:', err);
        });
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

## 📝 Importante: Presentazione Risultati

Quando invochi tool Git, Code Review, o PR, il risultato include un campo **\`formatted_message\`**.
Questo contiene output già formattato con:
- Tabelle markdown
- Syntax highlighting
- Grafici ASCII
- Progress bars
- Emoji e icone

**DEVI sempre mostrare \`formatted_message\` all'utente** invece di raw JSON.

Esempio:
\`\`\`
[Invochi git_status tool]
Result: {
  branch: "main",
  staged: [...],
  formatted_message: "## 🌿 Git Status\\n\\n**Branch:** \`main\`..."
}

[Presenta all'utente:]
formatted_message  ← Mostra questo, non il JSON!
\`\`\`

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
Usa i tool per operare CONCRETAMENTE sui file, non limitarti a suggerire!
${this.cachedProjectContextAddition}`;
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

        // Git tools (git operations, PR creation, code review)
        const gitTools = this.gitToolsManager.getToolDefinitions();
        const reviewTools = this.codeReviewer.getToolDefinitions();
        const prTools = this.prTemplateManager.getToolDefinitions();

        // Combina tutti i tool
        return [
            ...filesystemTools,
            ...webTools,
            ...interactionTools,
            ...legacyTools,
            ...skillTools,
            ...mcpTools,
            ...gitTools,
            ...reviewTools,
            ...prTools
        ];
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

            // Git tools
            case 'git_status':
            case 'git_diff':
            case 'git_log':
            case 'git_create_pr':
            case 'git_list_prs':
            case 'git_view_pr':
                return await this.gitToolsManager.executeTool(toolName, toolInput);

            // Code review tools
            case 'code_review':
            case 'security_scan':
            case 'review_file':
                return await this.codeReviewer.executeTool(toolName, toolInput);

            // PR template tools
            case 'generate_pr_body':
            case 'create_pr_with_template':
            case 'list_pr_templates':
                return await this.prTemplateManager.executeTool(toolName, toolInput);

            default:
                return { error: 'Tool non riconosciuto' };
        }
    }

    /**
     * Conversion Helpers: Anthropic ↔ OpenAI formats
     */

    /**
     * Converte tools Anthropic format → OpenAI format
     */
    convertToolsToOpenAI(tools) {
        if (!tools || tools.length === 0) return [];

        return tools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema
            }
        }));
    }

    /**
     * Converte tool calls OpenAI → Anthropic format per execution
     */
    convertOpenAIToolCalls(toolCalls) {
        if (!toolCalls) return [];

        return toolCalls.map(call => ({
            id: call.id,
            name: call.function.name,
            input: JSON.parse(call.function.arguments)
        }));
    }

    /**
     * Invia messaggio usando LiteLLM Proxy (OpenAI-compatible)
     */
    async sendMessageLiteLLM(userMessage, conversationHistory = [], sessionId = 'default', complexity = 'simple') {
        try {
            // Seleziona modello basato su complexity
            const selectedModel = this.modelRouting?.[complexity] || this.model;

            console.log(`🔄 LiteLLM Request (model: ${selectedModel}, complexity: ${complexity})`);

            // Costruisci messaggi in formato OpenAI
            let messages = [
                { role: 'system', content: this.getSystemPrompt() },
                ...conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                { role: 'user', content: userMessage }
            ];

            // Converti tools in formato OpenAI
            const tools = this.convertToolsToOpenAI(this.getTools());

            let finalResponse = '';
            let allToolsUsed = [];
            let totalUsage = { input_tokens: 0, output_tokens: 0 };
            let lastModel = null;

            // Loop per gestire multiple rounds di tool calls
            const MAX_TOOL_ROUNDS = 50; // Alto limite, utente può sempre stoppare
            let round = 0;

            while (round < MAX_TOOL_ROUNDS) {
                round++;
                console.log(`🔄 LiteLLM Round ${round}`);

                // Chiamata a LiteLLM (formato OpenAI)
                const response = await this.client.chat.completions.create({
                    model: selectedModel,
                    messages: messages,
                    max_tokens: this.maxTokens,
                    temperature: 0.7,
                    tools: this.enableToolUse && tools.length > 0 ? tools : undefined
                });

                const choice = response.choices[0];
                const content = choice.message.content || '';
                const toolCalls = choice.message.tool_calls || [];

                lastModel = response.model;
                totalUsage.input_tokens += response.usage?.prompt_tokens || 0;
                totalUsage.output_tokens += response.usage?.completion_tokens || 0;

                // Track usage in context manager for accurate token counting
                if (response.usage) {
                    this.contextManager.trackUsage(response.usage);
                }

                console.log('📥 LiteLLM Response:', {
                    model: response.model,
                    finishReason: choice.finish_reason,
                    toolCalls: toolCalls.length,
                    hasContent: content.length > 0
                });

                // Aggiungi contenuto testuale alla risposta finale
                if (content) {
                    finalResponse += content;
                }

                // Se non ci sono tool calls, abbiamo finito
                if (toolCalls.length === 0 || !this.enableToolUse) {
                    break;
                }

                // Esegui i tool
                const convertedToolUses = this.convertOpenAIToolCalls(toolCalls);
                allToolsUsed.push(...convertedToolUses.map(t => t.name));

                const toolResults = [];
                for (const toolUse of convertedToolUses) {
                    console.log(`🔧 Executing tool: ${toolUse.name}`);
                    const result = await this.executeTool(toolUse.name, toolUse.input);
                    toolResults.push({
                        role: 'tool',
                        tool_call_id: toolUse.id,
                        content: JSON.stringify(result)
                    });
                }

                // Aggiungi assistant message e tool results per il prossimo round
                messages = [
                    ...messages,
                    choice.message,
                    ...toolResults
                ];
            }

            if (round >= MAX_TOOL_ROUNDS) {
                console.warn('⚠️ Max tool rounds reached, stopping');
            }

            return {
                message: finalResponse,
                thinking: null, // OpenAI doesn't support thinking mode
                toolsUsed: allToolsUsed,
                model: lastModel,
                usage: totalUsage,
                provider: 'litellm'
            };

        } catch (error) {
            console.error('❌ Error calling LiteLLM:', error);
            throw error;
        }
    }

    /**
     * Invia messaggio usando Anthropic Direct
     */
    async sendMessageAnthropic(userMessage, conversationHistory = [], sessionId = 'default') {
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
                },
                provider: 'anthropic'
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
     * Router principale per sendMessage
     * Delega a Anthropic o LiteLLM basato su configurazione
     */
    async sendMessage(userMessage, conversationHistory = [], sessionId = 'default', complexity = 'simple') {
        if (this.provider === 'litellm') {
            return await this.sendMessageLiteLLM(userMessage, conversationHistory, sessionId, complexity);
        } else {
            return await this.sendMessageAnthropic(userMessage, conversationHistory, sessionId);
        }
    }

    /**
     * Stream response per real-time typing effect
     * Supporta sia Anthropic che LiteLLM
     */
    async streamMessage(userMessage, conversationHistory = []) {
        if (this.provider === 'litellm') {
            return this.streamMessageLiteLLM(userMessage, conversationHistory);
        }

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
     * Stream message using LiteLLM (OpenAI-compatible streaming)
     * Returns an async iterator that emits text chunks
     */
    async streamMessageLiteLLM(userMessage, conversationHistory = []) {
        const messages = [
            { role: 'system', content: this.getSystemPrompt() },
            ...conversationHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            { role: 'user', content: userMessage }
        ];

        const tools = this.convertToolsToOpenAI(this.getTools());

        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: messages,
            max_tokens: this.maxTokens,
            temperature: 0.7,
            tools: this.enableToolUse && tools.length > 0 ? tools : undefined,
            stream: true
        });

        return stream;
    }

    /**
     * Stream con supporto per steering in real-time
     * Permette di interrompere e ri-indirizzare la risposta durante la generazione
     * Supporta sia Anthropic che LiteLLM
     * @param {Array} attachments - Array di {type: 'image'|'text', name, data/content, mimeType}
     */
    async streamWithSteering(userMessage, conversationHistory, streamingManager, sessionId, onChunk, onComplete, onError, attachments = []) {
        if (this.provider === 'litellm') {
            return this.streamWithSteeringLiteLLM(userMessage, conversationHistory, streamingManager, sessionId, onChunk, onComplete, onError, attachments);
        }
        return this.streamWithSteeringAnthropic(userMessage, conversationHistory, streamingManager, sessionId, onChunk, onComplete, onError, attachments);
    }

    /**
     * Formatta messaggio con attachments per OpenAI/LiteLLM API
     * @returns {string|Array} - Contenuto formattato
     */
    formatMessageWithAttachments(message, attachments) {
        if (!attachments || attachments.length === 0) {
            return message;
        }

        // Costruisci array di content parts
        const contentParts = [];

        // Aggiungi file di testo come contesto
        const textFiles = attachments.filter(a => a.type === 'text');
        if (textFiles.length > 0) {
            let textContext = '';
            for (const file of textFiles) {
                textContext += `\n\n--- File: ${file.name} ---\n${file.content}\n--- Fine ${file.name} ---\n`;
            }
            contentParts.push({
                type: 'text',
                text: message + textContext
            });
        } else {
            contentParts.push({
                type: 'text',
                text: message || 'Analizza le immagini allegate.'
            });
        }

        // Aggiungi immagini
        const imageFiles = attachments.filter(a => a.type === 'image');
        for (const img of imageFiles) {
            contentParts.push({
                type: 'image_url',
                image_url: {
                    url: `data:${img.mimeType};base64,${img.data}`
                }
            });
        }

        return contentParts;
    }

    /**
     * Formatta messaggio con attachments per Anthropic API
     * @returns {string|Array} - Contenuto formattato
     */
    formatMessageWithAttachmentsAnthropic(message, attachments) {
        if (!attachments || attachments.length === 0) {
            return message;
        }

        // Costruisci array di content parts per Anthropic
        const contentParts = [];

        // Aggiungi file di testo come contesto
        const textFiles = attachments.filter(a => a.type === 'text');
        let textMessage = message || '';
        if (textFiles.length > 0) {
            for (const file of textFiles) {
                textMessage += `\n\n--- File: ${file.name} ---\n${file.content}\n--- Fine ${file.name} ---\n`;
            }
        }

        contentParts.push({
            type: 'text',
            text: textMessage || 'Analizza le immagini allegate.'
        });

        // Aggiungi immagini in formato Anthropic
        const imageFiles = attachments.filter(a => a.type === 'image');
        for (const img of imageFiles) {
            contentParts.push({
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: img.mimeType,
                    data: img.data
                }
            });
        }

        return contentParts;
    }

    /**
     * Stream con steering per LiteLLM (OpenAI-compatible)
     */
    async streamWithSteeringLiteLLM(userMessage, conversationHistory, streamingManager, sessionId, onChunk, onComplete, onError, attachments = []) {
        try {
            const session = streamingManager.getOrCreateSession(sessionId);
            session.active = true;
            session.accumulatedText = '';

            // Formatta messaggio con attachments
            const userContent = this.formatMessageWithAttachments(userMessage, attachments);

            let messages = [
                { role: 'system', content: this.getSystemPrompt() },
                ...conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                { role: 'user', content: userContent }
            ];

            const tools = this.convertToolsToOpenAI(this.getTools());
            const MAX_TOOL_ROUNDS = 50; // Alto limite, utente può sempre stoppare
            let round = 0;
            let allToolsUsed = [];

            while (round < MAX_TOOL_ROUNDS) {
                round++;
                console.log(`🔄 LiteLLM Streaming Round ${round}`);

                // Streaming request with usage tracking
                const stream = await this.client.chat.completions.create({
                    model: this.model,
                    messages: messages,
                    max_tokens: this.maxTokens,
                    temperature: 0.7,
                    tools: this.enableToolUse && tools.length > 0 ? tools : undefined,
                    stream: true,
                    stream_options: { include_usage: true }
                });

                let currentContent = '';
                let toolCalls = [];
                let steeringApplied = false;
                let streamFinished = false;
                let streamUsage = null;

                // Process stream chunks
                for await (const chunk of stream) {
                    // Check if session was stopped
                    if (!streamingManager.isStreaming(sessionId)) {
                        console.log(`🛑 Streaming stopped for session ${sessionId}`);
                        break;
                    }

                    const delta = chunk.choices?.[0]?.delta;
                    const finishReason = chunk.choices?.[0]?.finish_reason;

                    // Check if stream is finished
                    if (finishReason) {
                        streamFinished = true;
                    }

                    // Capture usage from final chunk (when stream_options.include_usage is true)
                    if (chunk.usage) {
                        streamUsage = chunk.usage;
                        console.log(`📊 Stream usage received: ${streamUsage.prompt_tokens || 0} prompt, ${streamUsage.completion_tokens || 0} completion`);
                        // Track usage in context manager
                        this.contextManager.trackUsage(streamUsage);
                    }

                    if (!delta) continue;

                    // Handle text content
                    if (delta.content) {
                        currentContent += delta.content;
                        session.accumulatedText += delta.content;
                        if (onChunk) onChunk(delta.content);

                        // Only check for steering during text generation (not during tool calls)
                        const pendingSteering = streamingManager.getSteeringQueue(sessionId);
                        if (pendingSteering.length > 0 && toolCalls.length === 0) {
                            console.log(`🎯 Steering detected!`);
                            const steeringTexts = pendingSteering.map(s => s.text).join('\n\n');

                            messages.push({ role: 'assistant', content: session.accumulatedText });
                            messages.push({
                                role: 'user',
                                content: `[STEERING FEEDBACK]\n${steeringTexts}\n\nPer favore, incorpora questo feedback nella tua risposta.`
                            });

                            streamingManager.markSteeringProcessed(sessionId);
                            if (onChunk) onChunk('\n\n_[✨ Applicando feedback...]_\n\n');
                            steeringApplied = true;
                            break;
                        }
                    }

                    // Handle tool calls - accumulate arguments
                    if (delta.tool_calls) {
                        for (const tc of delta.tool_calls) {
                            if (tc.index !== undefined) {
                                if (!toolCalls[tc.index]) {
                                    toolCalls[tc.index] = {
                                        id: tc.id || '',
                                        function: { name: '', arguments: '' }
                                    };
                                }
                                if (tc.id) toolCalls[tc.index].id = tc.id;
                                if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name;
                                if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                            }
                        }
                    }
                }

                // If steering was applied, continue to next iteration (restart stream)
                if (steeringApplied) {
                    continue;
                }

                // If no tool calls, we're done
                if (toolCalls.length === 0) {
                    break;
                }

                // Validate and execute tools
                const toolResults = [];
                const validToolCalls = [];

                for (const tc of toolCalls) {
                    if (!tc.function.name) continue;

                    // Validate JSON arguments before processing
                    let input;
                    try {
                        input = JSON.parse(tc.function.arguments || '{}');
                    } catch (jsonError) {
                        console.error(`⚠️ Invalid JSON in tool arguments for ${tc.function.name}: ${tc.function.arguments}`);
                        // Skip this tool call - arguments are incomplete
                        continue;
                    }

                    console.log(`🔧 Executing tool: ${tc.function.name}`);
                    allToolsUsed.push(tc.function.name);
                    validToolCalls.push(tc);

                    try {
                        const result = await this.executeTool(tc.function.name, input);

                        // Notify client about tool execution
                        if (onChunk) {
                            onChunk(`\n\n_[🔧 ${tc.function.name}]_\n`);
                        }

                        toolResults.push({
                            role: 'tool',
                            tool_call_id: tc.id,
                            content: JSON.stringify(result)
                        });
                    } catch (error) {
                        console.error(`Tool execution error: ${error.message}`);
                        toolResults.push({
                            role: 'tool',
                            tool_call_id: tc.id,
                            content: JSON.stringify({ error: error.message })
                        });
                    }
                }

                // Only add to messages if we have valid tool calls
                if (validToolCalls.length > 0) {
                    messages.push({
                        role: 'assistant',
                        content: currentContent || null,
                        tool_calls: validToolCalls.map(tc => ({
                            id: tc.id,
                            type: 'function',
                            function: tc.function
                        }))
                    });
                    messages.push(...toolResults);
                } else if (currentContent) {
                    // If no valid tool calls but we have content, just add the content
                    messages.push({
                        role: 'assistant',
                        content: currentContent
                    });
                }
            }

            session.active = false;
            if (onComplete) onComplete(session.accumulatedText);
            return session.accumulatedText;

        } catch (error) {
            console.error('❌ Error in LiteLLM streaming:', error);
            if (onError) onError(error);
            throw error;
        } finally {
            streamingManager.cleanupSession(sessionId);
        }
    }

    /**
     * Stream con steering per Anthropic Direct
     */
    async streamWithSteeringAnthropic(userMessage, conversationHistory, streamingManager, sessionId, onChunk, onComplete, onError, attachments = []) {
        try {
            // Registra la sessione
            const session = streamingManager.getOrCreateSession(sessionId);
            session.active = true;
            session.accumulatedText = '';

            // Formatta messaggio con attachments per Anthropic
            const userContent = this.formatMessageWithAttachmentsAnthropic(userMessage, attachments);

            const messages = [
                ...conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                {
                    role: 'user',
                    content: userContent
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
            // Ensure conversationHistory is an array
            if (!Array.isArray(conversationHistory)) {
                conversationHistory = [];
            }

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
