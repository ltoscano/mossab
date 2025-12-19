/**
 * Streaming Manager - Gestisce le sessioni di streaming attive con supporto per steering
 *
 * Permette di:
 * - Pausare/riprendere stream in corso
 * - Inviare feedback di steering in real-time
 * - Interrompere e ri-indirizzare la generazione
 */
class StreamingManager {
    constructor() {
        // Map di sessioni attive: sessionId -> streamSession
        this.activeSessions = new Map();
    }

    /**
     * Crea una nuova sessione di streaming
     */
    createSession(sessionId) {
        const session = {
            id: sessionId,
            active: false,
            paused: false,
            currentStream: null,
            accumulatedText: '',
            steeringQueue: [],
            createdAt: new Date(),
            onText: null,
            onEnd: null,
            onError: null,
            abortController: new AbortController()
        };

        this.activeSessions.set(sessionId, session);
        return session;
    }

    /**
     * Ottiene una sessione esistente o ne crea una nuova
     */
    getOrCreateSession(sessionId) {
        if (!this.activeSessions.has(sessionId)) {
            return this.createSession(sessionId);
        }
        return this.activeSessions.get(sessionId);
    }

    /**
     * Verifica se una sessione è attivamente in streaming
     */
    isStreaming(sessionId) {
        const session = this.activeSessions.get(sessionId);
        return session && session.active && !session.paused;
    }

    /**
     * Pausa una sessione di streaming
     */
    pauseSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session && session.active) {
            session.paused = true;
            console.log(`⏸️  Session ${sessionId} paused for steering`);
            return true;
        }
        return false;
    }

    /**
     * Riprende una sessione pausata
     */
    resumeSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session && session.paused) {
            session.paused = false;
            console.log(`▶️  Session ${sessionId} resumed`);
            return true;
        }
        return false;
    }

    /**
     * Aggiunge un messaggio di steering alla coda
     * Questo verrà processato per ri-indirizzare la risposta
     */
    addSteeringMessage(sessionId, steeringText) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }

        session.steeringQueue.push({
            text: steeringText,
            timestamp: new Date(),
            processedAt: null
        });

        console.log(`🎯 Steering added to session ${sessionId}: "${steeringText}"`);

        return {
            success: true,
            queueLength: session.steeringQueue.length,
            accumulatedText: session.accumulatedText
        };
    }

    /**
     * Ottiene i messaggi di steering in coda
     */
    getSteeringQueue(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return [];

        return session.steeringQueue.filter(s => !s.processedAt);
    }

    /**
     * Marca i messaggi di steering come processati
     */
    markSteeringProcessed(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;

        const now = new Date();
        session.steeringQueue.forEach(steering => {
            if (!steering.processedAt) {
                steering.processedAt = now;
            }
        });
    }

    /**
     * Stoppa completamente una sessione
     */
    stopSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return false;

        // Abort the stream
        session.abortController.abort();
        session.active = false;
        session.paused = false;

        console.log(`⏹️  Session ${sessionId} stopped`);
        return true;
    }

    /**
     * Pulisce una sessione dopo il completamento
     */
    cleanupSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            session.active = false;
            session.currentStream = null;
        }
    }

    /**
     * Rimuove completamente una sessione
     */
    removeSession(sessionId) {
        this.stopSession(sessionId);
        this.activeSessions.delete(sessionId);
        console.log(`🗑️  Session ${sessionId} removed`);
    }

    /**
     * Ottiene lo stato di una sessione
     */
    getSessionState(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return { exists: false };
        }

        return {
            exists: true,
            active: session.active,
            paused: session.paused,
            accumulatedLength: session.accumulatedText.length,
            pendingSteering: session.steeringQueue.filter(s => !s.processedAt).length,
            createdAt: session.createdAt
        };
    }

    /**
     * Cleanup periodico delle sessioni vecchie
     */
    cleanupOldSessions(maxAgeMs = 30 * 60 * 1000) { // 30 minuti default
        const now = new Date();
        let cleaned = 0;

        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (!session.active && (now - session.createdAt) > maxAgeMs) {
                this.removeSession(sessionId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} old streaming sessions`);
        }

        return cleaned;
    }
}

module.exports = StreamingManager;
