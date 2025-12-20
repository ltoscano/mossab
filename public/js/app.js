// Mossab AI Chat Application
class MossabChat {
    constructor() {
        this.conversationHistory = [];
        this.isTyping = false;
        this.isStreaming = false;
        this.sessionId = 'session_' + Date.now();

        // DOM Elements
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.tokenCounter = document.getElementById('tokenCounter');

        // Steering elements
        this.steeringControl = document.getElementById('steeringControl');
        this.steeringInput = document.getElementById('steeringInput');
        this.sendSteeringBtn = document.getElementById('sendSteeringBtn');
        this.stopStreamBtn = document.getElementById('stopStreamBtn');
        this.mainInputArea = document.getElementById('mainInputArea');

        // TODO elements
        this.todoIndicator = document.getElementById('todoIndicator');
        this.todoProgress = document.getElementById('todoProgress');
        this.todoCurrentTask = document.getElementById('todoCurrentTask');

        // Skills modal elements
        this.skillsBtn = document.getElementById('skillsBtn');
        this.skillsModal = document.getElementById('skillsModal');
        this.skillsModalClose = document.getElementById('skillsModalClose');
        this.skillsModalOverlay = document.getElementById('skillsModalOverlay');
        this.skillsList = document.getElementById('skillsList');
        this.skillsReloadBtn = document.getElementById('skillsReloadBtn');

        // Question modal elements
        this.questionModal = document.getElementById('questionModal');
        this.questionContext = document.getElementById('questionContext');
        this.questionText = document.getElementById('questionText');
        this.questionSuggestedAnswers = document.getElementById('questionSuggestedAnswers');
        this.questionAnswerInput = document.getElementById('questionAnswerInput');
        this.questionSubmitBtn = document.getElementById('questionSubmitBtn');
        this.questionCancelBtn = document.getElementById('questionCancelBtn');

        this.currentQuestionId = null;
        this.questionPollInterval = null;

        this.init();
    }

    init() {
        // Event Listeners
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.messageInput.addEventListener('input', () => {
            this.autoResize();
            this.updateTokenCounter();
        });

        this.newChatBtn.addEventListener('click', () => this.newChat());

        // Steering event listeners
        this.sendSteeringBtn.addEventListener('click', () => this.sendSteering());
        this.steeringInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.sendSteering();
            }
        });
        this.stopStreamBtn.addEventListener('click', () => this.stopStreaming());

        // Skills modal event listeners
        this.skillsBtn.addEventListener('click', () => this.openSkillsModal());
        this.skillsModalClose.addEventListener('click', () => this.closeSkillsModal());
        this.skillsModalOverlay.addEventListener('click', () => this.closeSkillsModal());
        this.skillsReloadBtn.addEventListener('click', () => this.reloadSkills());

        // Question modal event listeners
        this.questionSubmitBtn.addEventListener('click', () => this.submitAnswer());
        this.questionCancelBtn.addEventListener('click', () => this.cancelQuestion());
        this.questionAnswerInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.submitAnswer();
            }
        });

        // Quick action cards
        const quickActionCards = document.querySelectorAll('.quick-action-card');
        quickActionCards.forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.dataset.prompt;
                this.messageInput.value = prompt;
                this.sendMessage();
            });
        });

        // Initial focus
        this.messageInput.focus();

        // Start TODO polling
        this.startTodoPolling();

        // Start question polling
        this.startQuestionPolling();
    }

    /**
     * TODO POLLING
     * Fetch e aggiorna TODO ogni 2 secondi
     */
    startTodoPolling() {
        // Initial fetch
        this.fetchTodos();

        // Poll every 2 seconds
        setInterval(() => this.fetchTodos(), 2000);
    }

    async fetchTodos() {
        try {
            const response = await fetch('/api/todos');
            const data = await response.json();

            this.updateTodoUI(data);

        } catch (error) {
            console.error('Error fetching todos:', error);
        }
    }

    updateTodoUI(data) {
        if (!data.todos || data.todos.length === 0) {
            this.todoIndicator.classList.add('hidden');
            return;
        }

        // Show indicator
        this.todoIndicator.classList.remove('hidden');

        // Update progress
        this.todoProgress.textContent = `${data.summary.completed}/${data.summary.total}`;

        // Update current task
        if (data.summary.current_task) {
            this.todoCurrentTask.textContent = data.summary.current_task;
            this.todoCurrentTask.style.display = 'block';
        } else {
            this.todoCurrentTask.style.display = 'none';
        }
    }

    autoResize() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = this.messageInput.scrollHeight + 'px';
    }

    updateTokenCounter() {
        const text = this.messageInput.value;
        const tokens = Math.ceil(text.length / 4); // Rough estimate
        this.tokenCounter.querySelector('span').textContent = `~${tokens} tokens`;
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();

        if (!message || this.isTyping) return;

        // Hide welcome screen if visible
        const welcomeScreen = document.querySelector('.welcome-screen');
        if (welcomeScreen && !welcomeScreen.classList.contains('hidden')) {
            welcomeScreen.classList.add('fade-out');
            setTimeout(() => {
                welcomeScreen.classList.add('hidden');
            }, 300);
        }

        // Add user message to UI
        this.addMessage('user', message);

        // Clear input
        this.messageInput.value = '';
        this.autoResize();
        this.updateTokenCounter();

        // Add to conversation history
        this.conversationHistory.push({
            role: 'user',
            content: message
        });

        // Show typing indicator
        this.showTypingIndicator();

        // Show steering controls during response generation
        this.showSteeringControls();

        try {
            // Call API
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    conversationHistory: this.conversationHistory,
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();

            // Hide typing indicator and steering controls
            this.hideTypingIndicator();
            this.hideSteeringControls();

            // Add assistant response
            this.addMessage('assistant', data.message);

            // Add to conversation history
            this.conversationHistory.push({
                role: 'assistant',
                content: data.message
            });

        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            this.hideSteeringControls();
            this.addMessage('assistant', '⚠️ Mi dispiace, si è verificato un errore. Riprova per favore.');
        }

        // Scroll to bottom
        this.scrollToBottom();
    }

    addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const avatarText = role === 'user' ? 'You' : 'M';
        const authorName = role === 'user' ? 'You' : 'Mossab';

        // Format content (basic markdown-like formatting)
        const formattedContent = this.formatContent(content);

        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">${avatarText === 'You' ? '👤' : 'M'}</div>
                <span class="message-author">${authorName}</span>
            </div>
            <div class="message-content">${formattedContent}</div>
        `;

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatContent(content) {
        // Convert markdown-like syntax to HTML
        let formatted = content;

        // Bold text: **text** -> <strong>text</strong>
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Code blocks: ```code``` -> <pre><code>code</code></pre>
        formatted = formatted.replace(/```(.+?)```/gs, '<pre><code>$1</code></pre>');

        // Inline code: `code` -> <code>code</code>
        formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');

        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');

        // Checkmarks and symbols
        formatted = formatted.replace(/✅/g, '<span style="color: #00e676;">✅</span>');
        formatted = formatted.replace(/⚠️/g, '<span style="color: #ffd740;">⚠️</span>');
        formatted = formatted.replace(/💡/g, '<span style="color: #ffd740;">💡</span>');

        // Bullet points
        formatted = formatted.replace(/^• /gm, '&nbsp;&nbsp;• ');
        formatted = formatted.replace(/^- /gm, '&nbsp;&nbsp;• ');

        return formatted;
    }

    showTypingIndicator() {
        this.isTyping = true;
        this.sendBtn.disabled = true;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing-message';
        typingDiv.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">M</div>
                <span class="message-author">Mossab</span>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;

        this.messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.isTyping = false;
        this.sendBtn.disabled = false;

        const typingMessage = document.querySelector('.typing-message');
        if (typingMessage) {
            typingMessage.remove();
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 100);
    }

    newChat() {
        // Confirm if there's an active conversation
        if (this.conversationHistory.length > 0) {
            const confirm = window.confirm('Vuoi iniziare una nuova conversazione? La chat corrente andrà persa.');
            if (!confirm) return;
        }

        // Clear conversation
        this.conversationHistory = [];

        // Remove all messages
        const messages = this.messagesContainer.querySelectorAll('.message');
        messages.forEach(msg => msg.remove());

        // Show welcome screen again
        const welcomeScreen = document.querySelector('.welcome-screen');
        if (welcomeScreen) {
            welcomeScreen.classList.remove('hidden', 'fade-out');
        }

        // Reset input
        this.messageInput.value = '';
        this.autoResize();
        this.updateTokenCounter();
        this.messageInput.focus();

        // Reset session
        this.sessionId = 'session_' + Date.now();
    }

    /**
     * STEERING METHODS
     * Permettono di dare feedback in real-time durante la generazione
     */

    /**
     * Mostra i controlli di steering
     */
    showSteeringControls() {
        this.isStreaming = true;
        this.steeringControl.classList.remove('hidden');
        this.mainInputArea.style.opacity = '0.5';
        this.mainInputArea.style.pointerEvents = 'none';
    }

    /**
     * Nasconde i controlli di steering
     */
    hideSteeringControls() {
        this.isStreaming = false;
        this.steeringControl.classList.add('hidden');
        this.mainInputArea.style.opacity = '1';
        this.mainInputArea.style.pointerEvents = 'auto';
        this.steeringInput.value = '';
    }

    /**
     * Invia un messaggio di steering durante la generazione
     */
    async sendSteering() {
        const steeringText = this.steeringInput.value.trim();

        if (!steeringText) return;

        console.log(`🎯 Sending steering: "${steeringText}"`);

        try {
            const response = await fetch(`/api/steering/${this.sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    steeringMessage: steeringText
                })
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ Steering sent successfully');

                // Mostra feedback visivo
                this.steeringInput.value = '';
                this.steeringInput.placeholder = '✨ Feedback inviato! Mossab sta aggiustando...';

                setTimeout(() => {
                    this.steeringInput.placeholder = 'Dai feedback in tempo reale...';
                }, 2000);

            } else {
                console.error('❌ Steering failed:', data.error);
                alert('Impossibile inviare il feedback: ' + data.error);
            }

        } catch (error) {
            console.error('Error sending steering:', error);
            alert('Errore nell\'invio del feedback');
        }
    }

    /**
     * Ferma lo streaming in corso
     */
    async stopStreaming() {
        console.log('🛑 Stopping stream...');

        try {
            const response = await fetch(`/api/streaming/${this.sessionId}/stop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ Stream stopped');
                this.hideSteeringControls();
            }

        } catch (error) {
            console.error('Error stopping stream:', error);
        }
    }

    /**
     * SKILLS MODAL METHODS
     */

    /**
     * Apri il modal delle skills
     */
    async openSkillsModal() {
        this.skillsModal.classList.remove('hidden');
        await this.loadSkills();
    }

    /**
     * Chiudi il modal delle skills
     */
    closeSkillsModal() {
        this.skillsModal.classList.add('hidden');
    }

    /**
     * Carica la lista delle skills
     */
    async loadSkills() {
        try {
            this.skillsList.innerHTML = '<div class="skills-loading">Caricamento skills...</div>';

            const response = await fetch('/api/skills');
            const data = await response.json();

            if (!data.skills || data.skills.length === 0) {
                this.skillsList.innerHTML = `
                    <div class="skills-empty">
                        <p>Nessuna skill disponibile</p>
                        <p class="skills-hint">
                            Crea nuove skills nella directory <code>.claude/skills/</code><br>
                            Segui lo standard <a href="https://agentskills.io" target="_blank">agentskills.io</a>
                        </p>
                    </div>
                `;
                return;
            }

            // Renderizza le skills
            let html = '';
            for (const skill of data.skills) {
                html += `
                    <div class="skill-card">
                        <div class="skill-header">
                            <h3 class="skill-name">${skill.name}</h3>
                            ${skill.license ? `<span class="skill-license">${skill.license}</span>` : ''}
                        </div>
                        <p class="skill-description">${skill.description}</p>
                        ${skill.compatibility ? `<div class="skill-compatibility">📦 ${skill.compatibility}</div>` : ''}
                        <div class="skill-actions">
                            <button class="skill-use-btn" onclick="app.useSkill('${skill.name}')">
                                Usa questa skill
                            </button>
                        </div>
                    </div>
                `;
            }

            this.skillsList.innerHTML = html;

        } catch (error) {
            console.error('Error loading skills:', error);
            this.skillsList.innerHTML = `
                <div class="skills-error">
                    ⚠️ Errore nel caricamento delle skills
                </div>
            `;
        }
    }

    /**
     * Ricarica le skills
     */
    async reloadSkills() {
        try {
            this.skillsReloadBtn.disabled = true;
            this.skillsReloadBtn.textContent = 'Reloading...';

            const response = await fetch('/api/skills/reload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                console.log(`✅ Reloaded ${data.count} skills`);
                await this.loadSkills();
            }

        } catch (error) {
            console.error('Error reloading skills:', error);
            alert('Errore nel reload delle skills');
        } finally {
            this.skillsReloadBtn.disabled = false;
            this.skillsReloadBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"></path>
                </svg>
                Reload Skills
            `;
        }
    }

    /**
     * Usa una skill inviando un messaggio a Mossab
     */
    useSkill(skillName) {
        this.messageInput.value = `Per favore usa la skill "${skillName}" per aiutarmi`;
        this.closeSkillsModal();
        this.messageInput.focus();
    }

    /**
     * QUESTION SYSTEM METHODS
     */

    /**
     * Avvia il polling per controllare domande pendenti
     */
    startQuestionPolling() {
        // Check ogni 2 secondi
        this.questionPollInterval = setInterval(() => {
            this.checkPendingQuestions();
        }, 2000);

        // Initial check
        this.checkPendingQuestions();
    }

    /**
     * Controlla se ci sono domande pendenti
     */
    async checkPendingQuestions() {
        // Solo se non c'è già una domanda aperta
        if (this.currentQuestionId) {
            return;
        }

        try {
            const response = await fetch(`/api/questions?sessionId=${this.sessionId}`);
            const data = await response.json();

            if (data.questions && data.questions.length > 0) {
                // Mostra la prima domanda
                this.showQuestion(data.questions[0]);
            }

        } catch (error) {
            console.error('Error checking questions:', error);
        }
    }

    /**
     * Mostra una domanda all'utente
     */
    showQuestion(question) {
        this.currentQuestionId = question.questionId;

        // Popola il modal
        if (question.context) {
            this.questionContext.textContent = `📝 Contesto: ${question.context}`;
            this.questionContext.style.display = 'block';
        } else {
            this.questionContext.style.display = 'none';
        }

        this.questionText.textContent = question.question;

        // Suggested answers
        if (question.suggestedAnswers && question.suggestedAnswers.length > 0) {
            let html = '<div class="suggested-answers-title">Risposte suggerite:</div>';
            question.suggestedAnswers.forEach((answer, index) => {
                html += `<button class="suggested-answer-btn" onclick="app.selectSuggestedAnswer('${answer.replace(/'/g, "\\'")}')">${index + 1}. ${answer}</button>`;
            });
            this.questionSuggestedAnswers.innerHTML = html;
            this.questionSuggestedAnswers.style.display = 'block';
        } else {
            this.questionSuggestedAnswers.style.display = 'none';
        }

        // Reset input
        this.questionAnswerInput.value = '';

        // Mostra modal
        this.questionModal.classList.remove('hidden');
        this.questionAnswerInput.focus();
    }

    /**
     * Seleziona una risposta suggerita
     */
    selectSuggestedAnswer(answer) {
        this.questionAnswerInput.value = answer;
        this.questionAnswerInput.focus();
    }

    /**
     * Invia la risposta
     */
    async submitAnswer() {
        const answer = this.questionAnswerInput.value.trim();

        if (!answer) {
            alert('Per favore scrivi una risposta');
            return;
        }

        try {
            this.questionSubmitBtn.disabled = true;
            this.questionSubmitBtn.textContent = 'Inviando...';

            const response = await fetch(`/api/questions/${this.currentQuestionId}/answer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ answer })
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ Answer submitted');
                this.closeQuestionModal();
            } else {
                alert(`Errore: ${data.error}`);
            }

        } catch (error) {
            console.error('Error submitting answer:', error);
            alert('Errore nell\'invio della risposta');
        } finally {
            this.questionSubmitBtn.disabled = false;
            this.questionSubmitBtn.textContent = 'Rispondi';
        }
    }

    /**
     * Cancella la domanda (salta)
     */
    async cancelQuestion() {
        if (!confirm('Vuoi saltare questa domanda? Mossab procederà senza questa informazione.')) {
            return;
        }

        try {
            const response = await fetch(`/api/questions/${this.currentQuestionId}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                console.log('❌ Question cancelled');
                this.closeQuestionModal();
            }

        } catch (error) {
            console.error('Error cancelling question:', error);
            alert('Errore nella cancellazione');
        }
    }

    /**
     * Chiudi il modal delle domande
     */
    closeQuestionModal() {
        this.questionModal.classList.add('hidden');
        this.currentQuestionId = null;
        this.questionAnswerInput.value = '';
    }
}

// Initialize app when DOM is ready
let app; // Global app instance for onclick handlers
document.addEventListener('DOMContentLoaded', () => {
    app = new MossabChat();

    // Add some nice console message
    console.log('%c🤖 Mossab AI Developer', 'color: #7c4dff; font-size: 24px; font-weight: bold;');
    console.log('%cVersion 1.0.0', 'color: #536dfe; font-size: 14px;');
    console.log('%cIl tuo sviluppatore artificiale è pronto! 💻', 'color: #00e676; font-size: 14px;');
});

// Easter egg: Konami code
let konamiCode = [];
const konamiPattern = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

document.addEventListener('keydown', (e) => {
    konamiCode.push(e.key);
    konamiCode = konamiCode.slice(-10);

    if (konamiCode.join(',') === konamiPattern.join(',')) {
        console.log('%c🎮 KONAMI CODE ACTIVATED! 🎮', 'color: #ff00ff; font-size: 20px; font-weight: bold;');
        console.log('%c🚀 Mossab ha sbloccato la modalità TURBO! 🚀', 'color: #00ffff; font-size: 16px;');

        // Add a fun effect
        document.body.style.animation = 'rainbow 2s infinite';
        setTimeout(() => {
            document.body.style.animation = '';
        }, 5000);
    }
});
