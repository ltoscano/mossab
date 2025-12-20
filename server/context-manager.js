const Anthropic = require('@anthropic-ai/sdk');

/**
 * Context Manager per gestire il context window di Claude
 *
 * Features:
 * - Token counting in tempo reale
 * - Automatic summarization quando context si riempie
 * - Message prioritization (codice > decisioni > output ripetitivi)
 * - Smart context optimization
 */
class ContextManager {
    constructor(model = 'claude-sonnet-4-5-20250929') {
        this.model = model;
        this.maxTokens = 200000;
        this.warningThreshold = 0.85;  // 85% = 170K tokens
        this.criticalThreshold = 0.95; // 95% = 190K tokens
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });

        // Cache per evitare recount continuo
        this.tokenCache = new Map();
    }

    /**
     * Conta i token in un array di messaggi
     * Usa l'API di Anthropic per conteggio accurato
     */
    async countTokens(messages) {
        // Crea cache key
        const cacheKey = JSON.stringify(messages);

        if (this.tokenCache.has(cacheKey)) {
            return this.tokenCache.get(cacheKey);
        }

        try {
            // Usa l'API count_tokens di Anthropic
            const response = await this.anthropic.messages.countTokens({
                model: this.model,
                messages: messages,
                system: this.systemPrompt || ''
            });

            const count = response.input_tokens;
            this.tokenCache.set(cacheKey, count);

            // Limita cache a 100 entries
            if (this.tokenCache.size > 100) {
                const firstKey = this.tokenCache.keys().next().value;
                this.tokenCache.delete(firstKey);
            }

            return count;
        } catch (error) {
            console.error('Token counting error:', error);
            // Fallback: stima approssimativa (4 chars = 1 token)
            return this.estimateTokens(messages);
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
        console.log('🧠 Starting intelligent conversation summarization...');

        // 1. Dividi conversazione in chunks temporali
        const totalMessages = messages.length;
        const earlyEnd = Math.floor(totalMessages * 0.25);
        const midEnd = Math.floor(totalMessages * 0.75);

        const earlyMessages = messages.slice(0, earlyEnd);
        const midMessages = messages.slice(earlyEnd, midEnd);
        const recentMessages = messages.slice(midEnd);

        // 2. Calcola priorità per early e mid messages
        const scoredEarly = earlyMessages.map(msg => ({
            message: msg,
            priority: this.calculateMessagePriority(msg)
        }));

        const scoredMid = midMessages.map(msg => ({
            message: msg,
            priority: this.calculateMessagePriority(msg)
        }));

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

        // 5. Genera summary per early messages
        let earlySummary = null;
        if (toSummarizeEarly.length > 0) {
            earlySummary = await this.generateSummary(toSummarizeEarly, 'early', claudeService);
        }

        // 6. Genera summary per mid messages
        let midSummary = null;
        if (toSummarizeMid.length > 0) {
            midSummary = await this.generateSummary(toSummarizeMid, 'mid', claudeService);
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
        const currentTokens = await this.countTokens(messages);
        const percentage = (currentTokens / this.maxTokens) * 100;

        return {
            current: currentTokens,
            max: this.maxTokens,
            percentage: percentage,
            remaining: this.maxTokens - currentTokens,
            status: this.getContextStatus(percentage),
            shouldSummarize: percentage > (this.warningThreshold * 100)
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
