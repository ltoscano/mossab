/**
 * UserQuestionManager
 *
 * Gestisce il flusso di ask_user_question:
 * 1. Mossab fa una domanda usando il tool
 * 2. La domanda viene salvata in una coda
 * 3. Il frontend la mostra all'utente
 * 4. L'utente risponde
 * 5. La risposta viene restituita a Mossab
 *
 * Questo permette a Mossab di chiarire requisiti ambigui prima di procedere.
 */

class UserQuestionManager {
    constructor() {
        // Mappa di domande pendenti: questionId -> { question, context, suggestedAnswers, resolve, reject, timestamp }
        this.pendingQuestions = new Map();

        // Counter per generare ID unici
        this.questionCounter = 0;

        // Timeout per domande non risposte (5 minuti)
        this.QUESTION_TIMEOUT = 5 * 60 * 1000;
    }

    /**
     * Crea una nuova domanda e aspetta la risposta
     *
     * Ritorna una Promise che si risolve quando l'utente risponde
     */
    async askQuestion(question, context = null, suggestedAnswers = null, sessionId = 'default') {
        const questionId = `q_${++this.questionCounter}_${Date.now()}`;

        console.log(`❓ Ask User Question [${questionId}]: "${question}"`);

        return new Promise((resolve, reject) => {
            // Salva la domanda con la Promise
            this.pendingQuestions.set(questionId, {
                questionId,
                sessionId,
                question,
                context,
                suggestedAnswers: suggestedAnswers || [],
                resolve,
                reject,
                timestamp: new Date(),
                status: 'pending'
            });

            // Timeout: se l'utente non risponde entro 5 minuti, risolvi con messaggio di timeout
            setTimeout(() => {
                if (this.pendingQuestions.has(questionId)) {
                    const questionData = this.pendingQuestions.get(questionId);

                    if (questionData.status === 'pending') {
                        console.log(`⏱️ Question timeout [${questionId}]`);

                        // Risolvi con risposta di timeout
                        resolve({
                            answer: '[TIMEOUT] L\'utente non ha risposto entro 5 minuti. Procedo con la mia migliore ipotesi.',
                            timeout: true,
                            questionId
                        });

                        // Cleanup
                        this.pendingQuestions.delete(questionId);
                    }
                }
            }, this.QUESTION_TIMEOUT);
        });
    }

    /**
     * L'utente risponde a una domanda
     */
    answerQuestion(questionId, answer) {
        const questionData = this.pendingQuestions.get(questionId);

        if (!questionData) {
            return {
                success: false,
                error: 'Question not found or already answered'
            };
        }

        if (questionData.status !== 'pending') {
            return {
                success: false,
                error: 'Question already answered'
            };
        }

        console.log(`✅ Question answered [${questionId}]: "${answer}"`);

        // Marca come answered
        questionData.status = 'answered';

        // Risolvi la Promise
        questionData.resolve({
            answer: answer,
            timeout: false,
            questionId: questionId,
            answeredAt: new Date()
        });

        // Cleanup dopo un po' (per permettere eventuali check)
        setTimeout(() => {
            this.pendingQuestions.delete(questionId);
        }, 60000); // 1 minuto

        return {
            success: true,
            questionId: questionId
        };
    }

    /**
     * Ottieni tutte le domande pendenti per una sessione
     */
    getPendingQuestions(sessionId = null) {
        const questions = [];

        for (const [questionId, data] of this.pendingQuestions) {
            if (data.status === 'pending') {
                if (!sessionId || data.sessionId === sessionId) {
                    questions.push({
                        questionId: data.questionId,
                        sessionId: data.sessionId,
                        question: data.question,
                        context: data.context,
                        suggestedAnswers: data.suggestedAnswers,
                        timestamp: data.timestamp
                    });
                }
            }
        }

        return questions;
    }

    /**
     * Ottieni dettagli di una domanda specifica
     */
    getQuestion(questionId) {
        const data = this.pendingQuestions.get(questionId);

        if (!data) {
            return null;
        }

        return {
            questionId: data.questionId,
            sessionId: data.sessionId,
            question: data.question,
            context: data.context,
            suggestedAnswers: data.suggestedAnswers,
            status: data.status,
            timestamp: data.timestamp
        };
    }

    /**
     * Cancella una domanda (l'utente ha deciso di non rispondere)
     */
    cancelQuestion(questionId) {
        const questionData = this.pendingQuestions.get(questionId);

        if (!questionData) {
            return {
                success: false,
                error: 'Question not found'
            };
        }

        console.log(`❌ Question cancelled [${questionId}]`);

        // Risolvi con risposta di cancellazione
        questionData.resolve({
            answer: '[CANCELLED] L\'utente ha cancellato la domanda. Procedo senza questa informazione.',
            cancelled: true,
            questionId: questionId
        });

        // Cleanup
        this.pendingQuestions.delete(questionId);

        return {
            success: true,
            questionId: questionId
        };
    }

    /**
     * Ottieni statistiche
     */
    getStats() {
        let pending = 0;
        let answered = 0;

        for (const data of this.pendingQuestions.values()) {
            if (data.status === 'pending') pending++;
            else if (data.status === 'answered') answered++;
        }

        return {
            total: this.pendingQuestions.size,
            pending,
            answered,
            questionCounter: this.questionCounter
        };
    }
}

module.exports = UserQuestionManager;
