const Anthropic = require('@anthropic-ai/sdk');

/**
 * Context Manager per gestire il context window di Claude
 *
 * Features:
 * - Token counting in tempo reale (supporta Anthropic e LiteLLM)
 * - Automatic summarization quando context si riempie
 * - Message prioritization (codice > decisioni > output ripetitivi)
 * - Smart context optimization
 */
class ContextManager {
    constructor(model = 'claude-sonnet-4-5-20250929') {
        this.model = model;
        this.maxTokens = 200000;
        // PRODUZIONE: Soglie per summarization
        this.warningThreshold = 0.85;  // 85% = 170K tokens → mostra bottone manuale
        this.criticalThreshold = 0.95; // 95% = 190K tokens → summarization automatica

        console.log(`📊 ContextManager initialized:`);
        console.log(`   Warning (manual): ${this.warningThreshold * 100}% = ${this.maxTokens * this.warningThreshold / 1000}K tokens`);
        console.log(`   Critical (auto): ${this.criticalThreshold * 100}% = ${this.maxTokens * this.criticalThreshold / 1000}K tokens`);

        // Provider configuration
        this.provider = process.env.AI_PROVIDER || 'anthropic';

        // LiteLLM configuration
        this.litellmProxyUrl = process.env.LITELLM_PROXY_URL || 'http://localhost:4000';
        this.litellmApiKey = process.env.LITELLM_API_KEY || 'default';

        // Anthropic client (only if not using LiteLLM or for fallback)
        if (this.provider !== 'litellm' && process.env.ANTHROPIC_API_KEY) {
            this.anthropic = new Anthropic({
                apiKey: process.env.ANTHROPIC_API_KEY
            });
        }

        // Cache per evitare recount continuo
        this.tokenCache = new Map();
    }

    /**
     * Conta i token in un array di messaggi
     * Usa LiteLLM o Anthropic API, con fallback a stima locale
     */
    async countTokens(messages) {
        // Handle empty/invalid messages
        if (!messages || messages.length === 0) {
            return 0;
        }

        // Crea cache key
        const cacheKey = JSON.stringify(messages);

        if (this.tokenCache.has(cacheKey)) {
            return this.tokenCache.get(cacheKey);
        }

        let count = 0;

        try {
            // Try provider-specific token counting
            if (this.provider === 'litellm') {
                count = await this.countTokensLiteLLM(messages);
            } else {
                count = await this.countTokensAnthropic(messages);
            }
        } catch (error) {
            // Fallback to estimation on any error
            count = this.estimateTokens(messages);
        }

        // Ensure we always have a valid count
        if (!count || count <= 0) {
            count = this.estimateTokens(messages);
        }

        this.cacheResult(cacheKey, count);
        return count;
    }

    /**
     * Count tokens using LiteLLM endpoints
     * Tries multiple endpoints in order of accuracy
     */
    async countTokensLiteLLM(messages) {
        // 1. Prima prova l'endpoint Anthropic-compatible /v1/messages/count_tokens
        try {
            const response = await fetch(`${this.litellmProxyUrl}/v1/messages/count_tokens`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.litellmApiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages
                }),
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                const data = await response.json();
                // Anthropic format: { input_tokens: N }
                const count = data.input_tokens || data.count || data.total_tokens;
                if (count && count > 0) {
                    console.log(`📊 Token count (v1/messages/count_tokens): ${count}`);
                    return count;
                }
            }
        } catch (error) {
            // Endpoint non disponibile, prova il prossimo
            console.log('⚠️ /v1/messages/count_tokens not available, trying fallback...');
        }

        // 2. Prova l'endpoint /utils/token_counter
        try {
            const response = await fetch(`${this.litellmProxyUrl}/utils/token_counter`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.litellmApiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages
                }),
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                const data = await response.json();
                const count = data.count || data.total_tokens || data.input_tokens;
                if (count && count > 0) {
                    console.log(`📊 Token count (utils/token_counter): ${count}`);
                    return count;
                }
            }
        } catch (error) {
            console.log('⚠️ /utils/token_counter not available');
        }

        // 3. Se abbiamo tracked usage da risposte precedenti, usalo
        if (this.trackedUsage && this.trackedUsage.totalInputTokens > 0) {
            console.log(`📊 Using tracked usage: ${this.trackedUsage.totalInputTokens} input tokens`);
            return this.trackedUsage.totalInputTokens;
        }

        // 4. Ultima risorsa: stima basata su caratteri (non ideale ma meglio di 0)
        console.log('⚠️ No LiteLLM token counting available, using character estimation');
        return this.estimateTokens(messages);
    }

    /**
     * Track actual token usage from API responses
     * Call this after each API call to accumulate real usage data
     */
    trackUsage(usage) {
        if (!this.trackedUsage) {
            this.trackedUsage = {
                totalInputTokens: 0,
                totalOutputTokens: 0,
                lastUpdated: null
            };
        }

        if (usage) {
            // OpenAI format: prompt_tokens, completion_tokens
            // Anthropic format: input_tokens, output_tokens
            const inputTokens = usage.prompt_tokens || usage.input_tokens || 0;
            const outputTokens = usage.completion_tokens || usage.output_tokens || 0;

            if (inputTokens > 0 || outputTokens > 0) {
                this.trackedUsage.totalInputTokens += inputTokens;
                this.trackedUsage.totalOutputTokens += outputTokens;
                this.trackedUsage.lastUpdated = new Date();

                console.log(`📊 Tracked usage: +${inputTokens} input, +${outputTokens} output (total: ${this.trackedUsage.totalInputTokens} input)`);
            }
        }
    }

    /**
     * Get current tracked usage
     */
    getTrackedUsage() {
        return this.trackedUsage || { totalInputTokens: 0, totalOutputTokens: 0 };
    }

    /**
     * Reset tracked usage (e.g., on new chat)
     */
    resetTrackedUsage() {
        this.trackedUsage = {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            lastUpdated: null
        };
    }

    /**
     * Count tokens using Anthropic beta.messages.countTokens API
     */
    async countTokensAnthropic(messages) {
        const hasCountTokensAPI = this.anthropic?.beta?.messages?.countTokens;

        if (!hasCountTokensAPI) {
            return null;
        }

        try {
            const response = await this.anthropic.beta.messages.countTokens({
                model: this.model,
                messages: messages,
                system: this.systemPrompt || ''
            });

            return response.input_tokens;
        } catch (error) {
            if (!error.message?.includes('not a function')) {
                console.error('Anthropic token counting error:', error.message);
            }
            return null;
        }
    }

    /**
     * Cache result with size limit
     */
    cacheResult(cacheKey, count) {
        this.tokenCache.set(cacheKey, count);

        // Limita cache a 100 entries
        if (this.tokenCache.size > 100) {
            const firstKey = this.tokenCache.keys().next().value;
            this.tokenCache.delete(firstKey);
        }
    }

    /**
     * Stima approssimativa dei token (fallback)
     */
    estimateTokens(messages) {
        let totalChars = 0;
        for (const msg of messages) {
            if (typeof msg.content === 'string') {
                totalChars += msg.content.length;
            } else if (Array.isArray(msg.content)) {
                for (const block of msg.content) {
                    if (block.text) {
                        totalChars += block.text.length;
                    }
                }
            }
        }
        // Stima: ~4 caratteri per token
        return Math.ceil(totalChars / 4);
    }

    /**
     * Calcola priorità di un messaggio
     * Score più alto = più importante da preservare
     */
    calculateMessagePriority(message) {
        let score = 0;
        const content = this.getMessageContent(message);

        // Code blocks (massima priorità)
        const codeBlocks = content.match(/```[\s\S]*?```/g);
        if (codeBlocks) {
            score += codeBlocks.length * 15;
        }

        // File operations
        if (content.match(/\b(created|modified|deleted|wrote|edited)\b.*\.(js|ts|css|html|json|py|java)/i)) {
            score += 12;
        }

        // Tool use (medio-alta priorità)
        if (message.content && Array.isArray(message.content)) {
            const hasToolUse = message.content.some(block => block.type === 'tool_use');
            if (hasToolUse) score += 10;
        }

        // Errors e debugging
        if (content.match(/\b(error|exception|failed|bug|fix)\b/i)) {
            score += 8;
        }

        // Decisioni architetturali
        if (content.match(/\b(decided|chose|implemented|architecture|design pattern)\b/i)) {
            score += 7;
        }

        // Domande importanti
        if (content.match(/\b(how|why|what|quando|come|perché)\b/i) && content.length > 50) {
            score += 5;
        }

        // Penalità per messaggi ripetitivi/brevi
        if (content.match(/^(ok|yes|done|✅|👍|grazie|thanks)\s*$/i)) {
            score -= 10;
        }

        // Penalità per output molto lunghi e ripetitivi
        if (content.length > 5000 && !codeBlocks) {
            score -= 3;
        }

        return score;
    }

    /**
     * Estrae il contenuto testuale da un messaggio
     */
    getMessageContent(message) {
        if (typeof message.content === 'string') {
            return message.content;
        } else if (Array.isArray(message.content)) {
            return message.content
                .filter(block => block.text)
                .map(block => block.text)
                .join('\n');
        }
        return '';
    }

    /**
     * Verifica se serve summarization
     */
    async shouldSummarize(messages) {
        const tokenCount = await this.countTokens(messages);
        return tokenCount > (this.maxTokens * this.warningThreshold);
    }

    /**
     * Esegue summarization intelligente della conversazione
     * Preserva messaggi ad alta priorità, riassume il resto
     */
    async summarizeConversation(messages, claudeService) {
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║  🧠 SUMMARIZATION STARTED                                     ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');

        // 1. Dividi conversazione in chunks temporali
        const totalMessages = messages.length;
        const earlyEnd = Math.floor(totalMessages * 0.25);
        const midEnd = Math.floor(totalMessages * 0.75);

        const earlyMessages = messages.slice(0, earlyEnd);
        const midMessages = messages.slice(earlyEnd, midEnd);
        const recentMessages = messages.slice(midEnd);

        console.log(`📋 Message Distribution:`);
        console.log(`   Total messages: ${totalMessages}`);
        console.log(`   Early (0-25%): ${earlyMessages.length} messages`);
        console.log(`   Mid (25-75%): ${midMessages.length} messages`);
        console.log(`   Recent (75-100%): ${recentMessages.length} messages [NEVER SUMMARIZED]`);

        // 2. Calcola priorità per early e mid messages
        const scoredEarly = earlyMessages.map(msg => ({
            message: msg,
            priority: this.calculateMessagePriority(msg)
        }));

        const scoredMid = midMessages.map(msg => ({
            message: msg,
            priority: this.calculateMessagePriority(msg)
        }));

        // Log priority scores
        console.log(`\n📊 Priority Scoring (threshold: 8):`);
        console.log(`   Early messages scores: [${scoredEarly.map(s => s.priority).join(', ')}]`);
        console.log(`   Mid messages scores: [${scoredMid.map(s => s.priority).join(', ')}]`);

        // 3. Identifica messaggi ad alta priorità da preservare
        const highPriorityThreshold = 8;
        const preservedEarly = scoredEarly
            .filter(item => item.priority >= highPriorityThreshold)
            .map(item => item.message);

        const preservedMid = scoredMid
            .filter(item => item.priority >= highPriorityThreshold)
            .map(item => item.message);

        // 4. Messaggi da summarize
        const toSummarizeEarly = scoredEarly
            .filter(item => item.priority < highPriorityThreshold)
            .map(item => item.message);

        const toSummarizeMid = scoredMid
            .filter(item => item.priority < highPriorityThreshold)
            .map(item => item.message);

        console.log(`\n🔍 Categorization:`);
        console.log(`   Early - Preserved (priority≥8): ${preservedEarly.length} messages`);
        console.log(`   Early - To summarize: ${toSummarizeEarly.length} messages`);
        console.log(`   Mid - Preserved (priority≥8): ${preservedMid.length} messages`);
        console.log(`   Mid - To summarize: ${toSummarizeMid.length} messages`);

        // 5. Genera summary per early messages
        let earlySummary = null;
        if (toSummarizeEarly.length > 0) {
            console.log(`\n📝 Generating EARLY summary for ${toSummarizeEarly.length} messages...`);
            earlySummary = await this.generateSummary(toSummarizeEarly, 'early', claudeService);
            console.log(`   ✅ Early summary generated (${earlySummary?.length || 0} chars)`);
        } else {
            console.log(`\n📝 No early messages to summarize`);
        }

        // 6. Genera summary per mid messages
        let midSummary = null;
        if (toSummarizeMid.length > 0) {
            console.log(`📝 Generating MID summary for ${toSummarizeMid.length} messages...`);
            midSummary = await this.generateSummary(toSummarizeMid, 'mid', claudeService);
            console.log(`   ✅ Mid summary generated (${midSummary?.length || 0} chars)`);
        } else {
            console.log(`📝 No mid messages to summarize`);
        }

        // 7. Ricostruisci conversation history ottimizzata
        const optimizedHistory = [];

        // Aggiungi early summary
        if (earlySummary) {
            optimizedHistory.push({
                role: 'user',
                content: '[CONTEXT SUMMARY - Early Conversation]'
            });
            optimizedHistory.push({
                role: 'assistant',
                content: earlySummary
            });
        }

        // Aggiungi preserved early messages
        optimizedHistory.push(...preservedEarly);

        // Aggiungi mid summary
        if (midSummary) {
            optimizedHistory.push({
                role: 'user',
                content: '[CONTEXT SUMMARY - Mid Conversation]'
            });
            optimizedHistory.push({
                role: 'assistant',
                content: midSummary
            });
        }

        // Aggiungi preserved mid messages
        optimizedHistory.push(...preservedMid);

        // Aggiungi tutti i messaggi recenti (non summarize mai questi)
        optimizedHistory.push(...recentMessages);

        const originalTokens = await this.countTokens(messages);
        const optimizedTokens = await this.countTokens(optimizedHistory);
        const savedTokens = originalTokens - optimizedTokens;
        const savedPercentage = ((savedTokens / originalTokens) * 100).toFixed(1);

        console.log(`✅ Summarization complete:`);
        console.log(`   Original: ${originalTokens.toLocaleString()} tokens`);
        console.log(`   Optimized: ${optimizedTokens.toLocaleString()} tokens`);
        console.log(`   Saved: ${savedTokens.toLocaleString()} tokens (${savedPercentage}%)`);
        console.log(`   Messages: ${messages.length} → ${optimizedHistory.length}`);

        return optimizedHistory;
    }

    /**
     * Genera summary di un set di messaggi
     */
    async generateSummary(messages, phase, claudeService) {
        const summaryPrompt = `
Riassumi questa parte della conversazione (${phase} phase) in modo conciso ma completo.

DEVI PRESERVARE:
- Tutti i blocchi di codice scritti o modificati
- Decisioni architetturali importanti
- Errori risolti e fix applicati
- File creati, modificati o eliminati
- Configurazioni importanti
- Tool utilizzati e risultati chiave

PUOI COMPRIMERE:
- Conferme e acknowledgments ("ok", "done", etc.)
- Output ripetitivi di tool
- Discussioni intermedie già concluse
- Messaggi di debugging già risolti

Formato del summary:
- Usa bullet points per chiarezza
- Mantieni blocchi di codice importanti con \`\`\`
- Sii conciso ma non perdere informazioni critiche

Conversazione da riassumere:
${this.formatMessagesForSummary(messages)}
`;

        try {
            // Usa il ClaudeService per generare il summary
            const response = await claudeService.anthropic.messages.create({
                model: this.model,
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: summaryPrompt
                }]
            });

            return response.content[0].text;
        } catch (error) {
            console.error('Error generating summary:', error);
            // Fallback: summary molto basic
            return this.generateBasicSummary(messages);
        }
    }

    /**
     * Formatta messaggi per il prompt di summarization
     */
    formatMessagesForSummary(messages) {
        return messages.map((msg, idx) => {
            const content = this.getMessageContent(msg);
            const role = msg.role === 'user' ? 'USER' : 'ASSISTANT';
            return `[${idx + 1}] ${role}: ${content.substring(0, 500)}${content.length > 500 ? '...' : ''}`;
        }).join('\n\n');
    }

    /**
     * Summary basic (fallback se API call fallisce)
     */
    generateBasicSummary(messages) {
        const codeBlocks = [];
        const fileOps = [];
        const errors = [];

        for (const msg of messages) {
            const content = this.getMessageContent(msg);

            // Estrai code blocks
            const codes = content.match(/```[\s\S]*?```/g);
            if (codes) codeBlocks.push(...codes);

            // Estrai file operations
            const files = content.match(/\b(created|modified|deleted)\b.*\.(js|ts|css|html|json|py)/gi);
            if (files) fileOps.push(...files);

            // Estrai errors
            const errs = content.match(/error:.*$/gim);
            if (errs) errors.push(...errs);
        }

        let summary = `Summary of ${messages.length} messages:\n\n`;

        if (fileOps.length > 0) {
            summary += `Files: ${fileOps.join(', ')}\n\n`;
        }

        if (codeBlocks.length > 0) {
            summary += `Code blocks: ${codeBlocks.length} blocks written\n`;
            summary += codeBlocks.slice(0, 2).join('\n\n') + '\n\n';
        }

        if (errors.length > 0) {
            summary += `Errors resolved: ${errors.length}\n`;
        }

        return summary;
    }

    /**
     * Ottieni statistiche sul context usage
     */
    async getContextStats(messages, systemPrompt = '') {
        this.systemPrompt = systemPrompt;

        let currentTokens = 0;
        let source = 'unknown';

        // SEMPRE conta i token dei messaggi attuali (questo è il vero context window)
        // trackedUsage è cumulativo e non rappresenta la dimensione della conversazione
        currentTokens = await this.countTokens(messages);
        source = 'counted';

        const percentage = (currentTokens / this.maxTokens) * 100;

        const isWarning = percentage > (this.warningThreshold * 100);
        const isCritical = percentage > (this.criticalThreshold * 100);

        return {
            current: currentTokens,
            max: this.maxTokens,
            percentage: percentage,
            remaining: this.maxTokens - currentTokens,
            status: this.getContextStatus(percentage),
            showManualButton: isWarning && !isCritical,  // 85-95%: mostra bottone
            shouldAutoSummarize: isCritical,              // >95%: auto summarization
            source: source
        };
    }

    /**
     * Determina lo status del context
     */
    getContextStatus(percentage) {
        if (percentage > this.criticalThreshold * 100) {
            return 'critical';
        } else if (percentage > this.warningThreshold * 100) {
            return 'warning';
        } else {
            return 'normal';
        }
    }
}

module.exports = ContextManager;
