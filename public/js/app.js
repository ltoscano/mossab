// Mossab AI Chat Application
class MossabChat {
    constructor() {
        this.conversationHistory = [];
        this.isTyping = false;
        this.isStreaming = false;
        this.sessionId = 'session_' + Date.now();

        // Attachments
        this.attachments = [];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.allowedTextExtensions = ['.txt', '.md', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.css', '.html', '.json', '.xml', '.yaml', '.yml', '.sh', '.bash', '.sql', '.go', '.rs', '.rb', '.php', '.swift', '.kt'];
        this.allowedImageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

        // DOM Elements
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.attachBtn = document.querySelector('.attach-btn');

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
        this.todoHeader = document.getElementById('todoHeader');
        this.todoList = document.getElementById('todoList');
        this.todoExpanded = false;
        this.currentTodos = [];

        // Skills modal elements
        this.skillsBtn = document.getElementById('skillsBtn');
        this.skillsModal = document.getElementById('skillsModal');
        this.skillsModalClose = document.getElementById('skillsModalClose');
        this.skillsModalOverlay = document.getElementById('skillsModalOverlay');
        this.skillsList = document.getElementById('skillsList');
        this.skillsReloadBtn = document.getElementById('skillsReloadBtn');

        // MCP modal elements
        this.mcpBtn = document.getElementById('mcpBtn');
        this.mcpModal = document.getElementById('mcpModal');
        this.mcpModalClose = document.getElementById('mcpModalClose');
        this.mcpModalOverlay = document.getElementById('mcpModalOverlay');
        this.mcpServersList = document.getElementById('mcpServersList');
        this.mcpStatusServers = document.getElementById('mcpStatusServers');
        this.mcpStatusTools = document.getElementById('mcpStatusTools');
        this.mcpAddBtn = document.getElementById('mcpAddBtn');
        this.mcpReloadBtn = document.getElementById('mcpReloadBtn');
        this.mcpAddForm = document.getElementById('mcpAddForm');
        this.mcpCancelAddBtn = document.getElementById('mcpCancelAddBtn');
        this.mcpSubmitAddBtn = document.getElementById('mcpSubmitAddBtn');

        // Context usage elements
        this.contextUsage = document.getElementById('contextUsage');
        this.contextFill = document.getElementById('contextFill');
        this.contextText = document.getElementById('contextText');
        this.contextSummarizeBtn = document.getElementById('contextSummarizeBtn');
        this.contextUpdateInterval = null;
        this.autoSummarizationTriggered = false;

        // Project Context modal elements
        this.projectBtn = document.getElementById('projectBtn');
        this.projectModal = document.getElementById('projectModal');
        this.projectModalClose = document.getElementById('projectModalClose');
        this.projectModalOverlay = document.getElementById('projectModalOverlay');
        this.projectTemplate = document.getElementById('projectTemplate');
        this.projectApplyTemplateBtn = document.getElementById('projectApplyTemplateBtn');
        this.projectInstructions = document.getElementById('projectInstructions');
        this.prefFramework = document.getElementById('prefFramework');
        this.prefLanguage = document.getElementById('prefLanguage');
        this.prefTestFramework = document.getElementById('prefTestFramework');
        this.prefStyling = document.getElementById('prefStyling');
        this.stdNaming = document.getElementById('stdNaming');
        this.stdFileStructure = document.getElementById('stdFileStructure');
        this.projectResetBtn = document.getElementById('projectResetBtn');
        this.projectSaveBtn = document.getElementById('projectSaveBtn');

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

        // MCP modal event listeners
        this.mcpBtn.addEventListener('click', () => this.openMCPModal());
        this.mcpModalClose.addEventListener('click', () => this.closeMCPModal());
        this.mcpModalOverlay.addEventListener('click', () => this.closeMCPModal());
        this.mcpAddBtn.addEventListener('click', () => this.showMCPAddForm());
        this.mcpReloadBtn.addEventListener('click', () => this.reloadMCP());
        this.mcpCancelAddBtn.addEventListener('click', () => this.hideMCPAddForm());
        this.mcpSubmitAddBtn.addEventListener('click', () => this.submitMCPServer());

        // Context management event listeners
        this.contextSummarizeBtn.addEventListener('click', () => this.triggerManualSummarization());

        // Project Context modal event listeners
        this.projectBtn.addEventListener('click', () => this.openProjectModal());
        this.projectModalClose.addEventListener('click', () => this.closeProjectModal());
        this.projectModalOverlay.addEventListener('click', () => this.closeProjectModal());
        this.projectApplyTemplateBtn.addEventListener('click', () => this.applyProjectTemplate());
        this.projectSaveBtn.addEventListener('click', () => this.saveProjectContext());
        this.projectResetBtn.addEventListener('click', () => this.resetProjectContext());

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

        // Attachment event listeners
        this.initAttachments();

        // Initial focus
        this.messageInput.focus();

        // TODO toggle event
        if (this.todoHeader) {
            this.todoHeader.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleTodoList();
            });
        }

        // Close todo list when clicking outside
        document.addEventListener('click', (e) => {
            if (this.todoExpanded && !this.todoIndicator.contains(e.target)) {
                this.todoExpanded = false;
                this.todoList.classList.add('hidden');
            }
        });

        // Start TODO polling
        this.startTodoPolling();

        // Start question polling
        this.startQuestionPolling();

        // Start context usage polling
        this.startContextPolling();
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
            this.todoExpanded = false;
            return;
        }

        // Store current todos
        this.currentTodos = data.todos;

        // Show indicator
        this.todoIndicator.classList.remove('hidden');

        // Update progress
        this.todoProgress.textContent = `${data.summary.completed}/${data.summary.total}`;

        // Update current task
        if (data.summary.current_task) {
            this.todoCurrentTask.textContent = data.summary.current_task;
            this.todoCurrentTask.style.display = 'inline';
        } else {
            this.todoCurrentTask.style.display = 'none';
        }

        // Update todo list if expanded
        if (this.todoExpanded) {
            this.renderTodoList();
        }
    }

    toggleTodoList() {
        this.todoExpanded = !this.todoExpanded;

        if (this.todoExpanded) {
            this.todoList.classList.remove('hidden');
            this.renderTodoList();
        } else {
            this.todoList.classList.add('hidden');
        }
    }

    renderTodoList() {
        if (!this.todoList || !this.currentTodos.length) return;

        this.todoList.innerHTML = this.currentTodos.map(todo => {
            let statusIcon, statusClass;

            switch (todo.status) {
                case 'completed':
                    statusIcon = '✓';
                    statusClass = 'todo-completed';
                    break;
                case 'in_progress':
                    statusIcon = '+';
                    statusClass = 'todo-in-progress';
                    break;
                default:
                    statusIcon = '○';
                    statusClass = 'todo-pending';
            }

            const isActive = todo.status === 'in_progress';
            const displayText = isActive ? todo.activeForm : todo.content;

            return `
                <div class="todo-item ${statusClass}">
                    <span class="todo-status-icon">${statusIcon}</span>
                    <span class="todo-text">${displayText}</span>
                </div>
            `;
        }).join('');
    }

    autoResize() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = this.messageInput.scrollHeight + 'px';
    }


    async sendMessage() {
        const message = this.messageInput.value.trim();

        if ((!message && this.attachments.length === 0) || this.isTyping) return;

        // Hide welcome screen if visible
        const welcomeScreen = document.querySelector('.welcome-screen');
        if (welcomeScreen && !welcomeScreen.classList.contains('hidden')) {
            welcomeScreen.classList.add('fade-out');
            setTimeout(() => {
                welcomeScreen.classList.add('hidden');
            }, 300);
        }

        // Prepara display message con attachments
        let displayMessage = message;
        if (this.attachments.length > 0) {
            const attachInfo = this.attachments.map(a =>
                a.type === 'image' ? `📷 ${a.name}` : `📎 ${a.name}`
            ).join(', ');
            displayMessage = message ? `${message}\n\n_Allegati: ${attachInfo}_` : `_Allegati: ${attachInfo}_`;
        }

        // Add user message to UI
        this.addMessage('user', displayMessage);

        // Clear input and attachments
        this.messageInput.value = '';
        const currentAttachments = [...this.attachments];
        this.clearAttachments();
        this.autoResize();

        // Add to conversation history (testo semplice per history)
        this.conversationHistory.push({
            role: 'user',
            content: message || 'Vedi allegati'
        });

        // Show typing indicator
        this.showTypingIndicator();

        // Show steering controls during response generation
        this.showSteeringControls();

        try {
            // Call API con attachments
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    attachments: currentAttachments,
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

    async newChat() {
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
        this.messageInput.focus();

        // Reset session
        this.sessionId = 'session_' + Date.now();

        // Reset token tracking on server
        try {
            await fetch('/api/context/reset', { method: 'POST' });
            console.log('📊 Token tracking reset');
        } catch (error) {
            console.error('Error resetting token tracking:', error);
        }

        // Update context usage display
        this.updateContextUsage();
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
                this.showAlert('Impossibile inviare il feedback: ' + data.error, 'error');
            }

        } catch (error) {
            console.error('Error sending steering:', error);
            this.showAlert('Errore nell\'invio del feedback', 'error');
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
            this.showAlert('Errore nel reload delle skills', 'error');
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
     * MCP SERVERS MODAL METHODS
     */

    /**
     * Apri il modal MCP
     */
    async openMCPModal() {
        this.mcpModal.classList.remove('hidden');
        await this.loadMCPStatus();
        await this.loadMCPServers();
    }

    /**
     * Chiudi il modal MCP
     */
    closeMCPModal() {
        this.mcpModal.classList.add('hidden');
        this.hideMCPAddForm();
    }

    /**
     * Carica lo status MCP (servers connessi, tools disponibili)
     */
    async loadMCPStatus() {
        try {
            const response = await fetch('/api/mcp/status');
            const data = await response.json();

            this.mcpStatusServers.textContent = data.totalServers || 0;
            this.mcpStatusTools.textContent = data.totalTools || 0;

        } catch (error) {
            console.error('Error loading MCP status:', error);
            this.mcpStatusServers.textContent = '0';
            this.mcpStatusTools.textContent = '0';
        }
    }

    /**
     * Carica la lista dei server MCP
     */
    async loadMCPServers() {
        try {
            this.mcpServersList.innerHTML = '<div class="mcp-loading">Caricamento servers...</div>';

            const [serversResponse, statusResponse] = await Promise.all([
                fetch('/api/mcp/servers'),
                fetch('/api/mcp/status')
            ]);

            const serversData = await serversResponse.json();
            const statusData = await statusResponse.json();

            if (!serversData.servers || serversData.servers.length === 0) {
                this.mcpServersList.innerHTML = `
                    <div class="mcp-empty">
                        <p>Nessun server MCP configurato</p>
                        <p class="mcp-hint">
                            Clicca su "Aggiungi Server" per configurare il primo server MCP
                        </p>
                    </div>
                `;
                return;
            }

            // Crea mappa dello status per server
            const statusMap = {};
            if (statusData.servers) {
                statusData.servers.forEach(s => {
                    statusMap[s.serverName] = s;
                });
            }

            // Renderizza i server
            let html = '';
            for (const server of serversData.servers) {
                const serverStatus = statusMap[server.name];
                const isConnected = serverStatus && serverStatus.connected;
                const toolsCount = serverStatus ? serverStatus.tools.length : 0;

                html += `
                    <div class="mcp-server-card">
                        <div class="mcp-server-header">
                            <span class="mcp-server-name">${server.name}</span>
                            <span class="mcp-server-status ${isConnected ? 'connected' : 'disconnected'}">
                                ${isConnected ? '● Connected' : '○ Disconnected'}
                            </span>
                        </div>
                        <div class="mcp-server-url">${server.url}</div>
                        ${server.description ? `<div class="mcp-server-description">${server.description}</div>` : ''}
                        ${isConnected ? `<div class="mcp-server-tools">🛠️ ${toolsCount} tools disponibili</div>` : ''}
                        <div class="mcp-server-actions">
                            <button class="mcp-server-toggle" onclick="app.toggleMCPServer('${server.name}', ${server.enabled})">
                                ${server.enabled ? 'Disabilita' : 'Abilita'}
                            </button>
                            <button class="mcp-server-delete" onclick="app.deleteMCPServer('${server.name}')">
                                Elimina
                            </button>
                        </div>
                    </div>
                `;
            }

            this.mcpServersList.innerHTML = html;

        } catch (error) {
            console.error('Error loading MCP servers:', error);
            this.mcpServersList.innerHTML = `
                <div class="mcp-error">
                    ⚠️ Errore nel caricamento dei server MCP
                </div>
            `;
        }
    }

    /**
     * Mostra il form per aggiungere un server
     */
    showMCPAddForm() {
        this.mcpAddForm.classList.remove('hidden');
        // Reset form
        document.getElementById('mcpServerName').value = '';
        document.getElementById('mcpServerUrl').value = '';
        document.getElementById('mcpServerToken').value = '';
        document.getElementById('mcpServerDescription').value = '';
        document.getElementById('mcpServerEnabled').checked = true;
    }

    /**
     * Nascondi il form per aggiungere un server
     */
    hideMCPAddForm() {
        this.mcpAddForm.classList.add('hidden');
    }

    /**
     * Submit nuovo server MCP
     */
    async submitMCPServer() {
        const name = document.getElementById('mcpServerName').value.trim();
        const url = document.getElementById('mcpServerUrl').value.trim();
        const bearerToken = document.getElementById('mcpServerToken').value.trim();
        const description = document.getElementById('mcpServerDescription').value.trim();
        const enabled = document.getElementById('mcpServerEnabled').checked;

        if (!name || !url) {
            this.showAlert('Nome e URL sono obbligatori', 'warning');
            return;
        }

        try {
            this.mcpSubmitAddBtn.disabled = true;
            this.mcpSubmitAddBtn.textContent = 'Aggiungendo...';

            const response = await fetch('/api/mcp/servers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    url,
                    bearerToken,
                    description,
                    enabled
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log(`✅ Server MCP "${name}" aggiunto con successo`);
                this.hideMCPAddForm();
                await this.loadMCPStatus();
                await this.loadMCPServers();
            } else {
                this.showAlert(`Errore: ${data.error || data.message || 'Operazione fallita'}`, 'error');
            }

        } catch (error) {
            console.error('Error adding MCP server:', error);
            this.showAlert('Errore nell\'aggiunta del server', 'error');
        } finally {
            this.mcpSubmitAddBtn.disabled = false;
            this.mcpSubmitAddBtn.textContent = 'Aggiungi Server';
        }
    }

    /**
     * Toggle enabled/disabled di un server
     */
    async toggleMCPServer(serverName, currentEnabled) {
        try {
            const response = await fetch(`/api/mcp/servers/${serverName}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    enabled: !currentEnabled
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log(`✅ Server "${serverName}" ${!currentEnabled ? 'abilitato' : 'disabilitato'}`);
                await this.loadMCPStatus();
                await this.loadMCPServers();
            } else {
                this.showAlert(`Errore: ${data.error || data.message}`, 'error');
            }

        } catch (error) {
            console.error('Error toggling MCP server:', error);
            this.showAlert('Errore nell\'aggiornamento del server', 'error');
        }
    }

    /**
     * Elimina un server MCP
     */
    async deleteMCPServer(serverName) {
        if (!confirm(`Sei sicuro di voler eliminare il server "${serverName}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/mcp/servers/${serverName}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log(`✅ Server "${serverName}" eliminato`);
                await this.loadMCPStatus();
                await this.loadMCPServers();
            } else {
                this.showAlert(`Errore: ${data.error || data.message}`, 'error');
            }

        } catch (error) {
            console.error('Error deleting MCP server:', error);
            this.showAlert('Errore nell\'eliminazione del server', 'error');
        }
    }

    /**
     * Reload configurazione MCP
     */
    async reloadMCP() {
        try {
            this.mcpReloadBtn.disabled = true;
            this.mcpReloadBtn.textContent = 'Reloading...';

            const response = await fetch('/api/mcp/reload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ MCP configuration reloaded');
                await this.loadMCPStatus();
                await this.loadMCPServers();
            }

        } catch (error) {
            console.error('Error reloading MCP:', error);
            this.showAlert('Errore nel reload della configurazione MCP', 'error');
        } finally {
            this.mcpReloadBtn.disabled = false;
            this.mcpReloadBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"></path>
                </svg>
                Reload
            `;
        }
    }

    /**
     * CONTEXT MANAGEMENT METHODS
     */

    /**
     * Avvia il polling per aggiornare il context usage
     */
    startContextPolling() {
        // Update ogni 5 secondi (meno frequente per performance)
        this.contextUpdateInterval = setInterval(() => {
            this.updateContextUsage();
        }, 5000);

        // Initial update
        this.updateContextUsage();
    }

    /**
     * Aggiorna l'indicatore di context usage
     */
    async updateContextUsage() {
        try {
            const response = await fetch(`/api/context/stats/${this.sessionId}`);
            const stats = await response.json();

            // Aggiorna percentuale
            const percentage = stats.percentage || 0;
            this.contextFill.style.width = `${percentage}%`;

            // Aggiorna testo
            const currentK = Math.round(stats.current / 1000);
            const maxK = Math.round(stats.max / 1000);
            this.contextText.textContent = `${currentK}K / ${maxK}K`;

            // Aggiorna stato visivo
            this.contextUsage.classList.remove('warning', 'critical');
            this.contextFill.classList.remove('warning', 'critical');

            if (stats.status === 'critical') {
                this.contextUsage.classList.add('critical');
                this.contextFill.classList.add('critical');
            } else if (stats.status === 'warning') {
                this.contextUsage.classList.add('warning');
                this.contextFill.classList.add('warning');
            }

            // Gestione bottone e auto-summarization
            if (stats.showManualButton) {
                // 85-95%: mostra bottone per summarization manuale
                this.contextSummarizeBtn.classList.remove('hidden');
            } else if (stats.shouldAutoSummarize) {
                // >95%: trigger auto summarization
                this.contextSummarizeBtn.classList.add('hidden');
                if (!this.autoSummarizationTriggered) {
                    this.autoSummarizationTriggered = true;
                    console.log('⚠️ Context critical (>95%), triggering auto summarization...');
                    this.triggerAutoSummarization();
                }
            } else {
                // <85%: nascondi bottone
                this.contextSummarizeBtn.classList.add('hidden');
                this.autoSummarizationTriggered = false;
            }

        } catch (error) {
            console.error('Error updating context usage:', error);
            // Fallback silente
        }
    }

    /**
     * Trigger manual summarization
     */
    async triggerManualSummarization() {
        if (!confirm('Vuoi riassumere la conversazione per liberare spazio nel context?\n\nQuesta operazione preserverà codice e decisioni importanti.')) {
            return;
        }

        try {
            this.contextSummarizeBtn.disabled = true;
            this.contextSummarizeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>';

            const response = await fetch(`/api/context/summarize/${this.sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                // Mostra stats del risparmio (se disponibili)
                const { stats } = data;

                if (stats) {
                    console.log(`✅ Conversation summarized successfully!`);
                    console.log(`   Messages: ${stats.originalMessages} → ${stats.optimizedMessages}`);
                    console.log(`   Tokens: ${stats.originalTokens.toLocaleString()} → ${stats.optimizedTokens.toLocaleString()}`);
                    console.log(`   Saved: ${stats.savedTokens.toLocaleString()} tokens (${stats.savedPercentage}%)`);

                    // Aggiungi messaggio di sistema nella chat
                    this.addSystemMessage(
                        `🧠 Context Summarized: ${stats.savedPercentage}% saved (${stats.originalMessages} → ${stats.optimizedMessages} messages)`
                    );
                } else {
                    // Nessun messaggio da summarizzare
                    console.log(`ℹ️ ${data.message || 'No messages to summarize'}`);
                    this.addSystemMessage(`ℹ️ ${data.message || 'Nessun messaggio da riassumere'}`);
                }

                // Update context usage
                await this.updateContextUsage();
            } else {
                this.showAlert(`Errore: ${data.error || data.message}`, 'error');
            }

        } catch (error) {
            console.error('Error in manual summarization:', error);
            this.showAlert('Errore durante la summarization', 'error');
        } finally {
            this.contextSummarizeBtn.disabled = false;
            this.contextSummarizeBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"></path>
                </svg>
            `;
        }
    }

    /**
     * Trigger automatic summarization (no confirmation)
     * Called when context exceeds 95%
     */
    async triggerAutoSummarization() {
        console.log('🧠 Auto-summarization triggered (context > 95%)');

        // Mostra notifica all'utente
        this.addSystemMessage('⚠️ Context quasi pieno (>95%), avvio summarization automatica...');

        try {
            const response = await fetch(`/api/context/summarize/${this.sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success && data.stats) {
                const { stats } = data;
                console.log(`✅ Auto-summarization complete!`);
                console.log(`   Messages: ${stats.originalMessages} → ${stats.optimizedMessages}`);
                console.log(`   Saved: ${stats.savedTokens.toLocaleString()} tokens (${stats.savedPercentage}%)`);

                this.addSystemMessage(
                    `✅ Auto-summarization completata: ${stats.savedPercentage}% risparmiato (${stats.originalMessages} → ${stats.optimizedMessages} messaggi)`
                );

                // Update context usage
                await this.updateContextUsage();
            } else if (data.success) {
                console.log('ℹ️ No messages to auto-summarize');
            } else {
                console.error('Auto-summarization failed:', data.error);
                this.addSystemMessage(`⚠️ Auto-summarization fallita: ${data.error || data.message}`);
            }

        } catch (error) {
            console.error('Error in auto-summarization:', error);
            this.addSystemMessage('⚠️ Errore durante auto-summarization');
        } finally {
            // Reset flag dopo un delay per evitare trigger multipli
            setTimeout(() => {
                this.autoSummarizationTriggered = false;
            }, 30000); // 30 secondi prima di poter ri-triggerare
        }
    }

    /**
     * Aggiungi messaggio di sistema
     */
    addSystemMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${text}</div>
            </div>
        `;
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    /**
     * PROJECT CONTEXT METHODS
     */

    async openProjectModal() {
        this.projectModal.classList.remove('hidden');
        await this.loadProjectContext();
    }

    closeProjectModal() {
        this.projectModal.classList.add('hidden');
    }

    async loadProjectContext() {
        try {
            const response = await fetch('/api/project/context');
            const context = await response.json();

            this.projectInstructions.value = context.instructions || '';
            this.prefFramework.value = context.preferences?.framework || '';
            this.prefLanguage.value = context.preferences?.language || '';
            this.prefTestFramework.value = context.preferences?.testFramework || '';
            this.prefStyling.value = context.preferences?.styling || '';
            this.stdNaming.value = context.standards?.naming || '';
            this.stdFileStructure.value = context.standards?.fileStructure || '';
        } catch (error) {
            console.error('Error loading project context:', error);
        }
    }

    async applyProjectTemplate() {
        const templateName = this.projectTemplate.value;
        if (!templateName) return;

        try {
            const response = await fetch(`/api/project/template/${templateName}`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                await this.loadProjectContext();
                console.log(`✅ Template "${templateName}" applied`);
            }
        } catch (error) {
            console.error('Error applying template:', error);
            this.showAlert('Errore nell\'applicazione del template', 'error');
        }
    }

    async saveProjectContext() {
        try {
            this.projectSaveBtn.disabled = true;
            this.projectSaveBtn.textContent = 'Saving...';

            const updates = {
                instructions: this.projectInstructions.value,
                preferences: {
                    framework: this.prefFramework.value,
                    language: this.prefLanguage.value,
                    testFramework: this.prefTestFramework.value,
                    styling: this.prefStyling.value
                },
                standards: {
                    naming: this.stdNaming.value,
                    fileStructure: this.stdFileStructure.value
                }
            };

            const response = await fetch('/api/project/context', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ Project context saved');
                this.addSystemMessage('📋 Project context saved successfully');
            }
        } catch (error) {
            console.error('Error saving project context:', error);
            this.showAlert('Errore nel salvataggio', 'error');
        } finally {
            this.projectSaveBtn.disabled = false;
            this.projectSaveBtn.textContent = 'Save';
        }
    }

    async resetProjectContext() {
        if (!confirm('Reset project context to defaults?')) return;

        try {
            const response = await fetch('/api/project/context', {
                method: 'DELETE'
            });
            const data = await response.json();

            if (data.success) {
                await this.loadProjectContext();
                console.log('✅ Project context reset');
            }
        } catch (error) {
            console.error('Error resetting project context:', error);
            this.showAlert('Errore nel reset', 'error');
        }
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
            this.showAlert('Per favore scrivi una risposta', 'warning');
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
                this.showAlert(`Errore: ${data.error}`, 'error');
            }

        } catch (error) {
            console.error('Error submitting answer:', error);
            this.showAlert('Errore nell\'invio della risposta', 'error');
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
            this.showAlert('Errore nella cancellazione', 'error');
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

    // ==========================================
    // ATTACHMENT FUNCTIONALITY
    // ==========================================

    /**
     * Inizializza la funzionalità di attachment
     */
    initAttachments() {
        // Crea input file nascosto
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.multiple = true;
        this.fileInput.accept = [...this.allowedTextExtensions, ...this.allowedImageExtensions].join(',');
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);

        // Crea container per preview attachments
        this.attachmentPreview = document.createElement('div');
        this.attachmentPreview.className = 'attachment-preview hidden';
        this.attachmentPreview.id = 'attachmentPreview';

        // Inserisci prima dell'input wrapper
        const inputWrapper = document.querySelector('.input-wrapper');
        inputWrapper.parentNode.insertBefore(this.attachmentPreview, inputWrapper);

        // Event: click sul bottone attach
        if (this.attachBtn) {
            this.attachBtn.addEventListener('click', () => this.fileInput.click());
        }

        // Event: file selezionati
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));

        // Event: drag & drop sull'input area
        const inputArea = document.querySelector('.input-area');
        if (inputArea) {
            inputArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                inputArea.classList.add('drag-over');
            });

            inputArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                inputArea.classList.remove('drag-over');
            });

            inputArea.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                inputArea.classList.remove('drag-over');
                this.handleFileSelect(e.dataTransfer.files);
            });
        }

        // Event: paste immagini
        document.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            const files = [];
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) files.push(file);
                }
            }
            if (files.length > 0) {
                this.handleFileSelect(files);
            }
        });
    }

    /**
     * Gestisci selezione file
     */
    async handleFileSelect(files) {
        for (const file of files) {
            // Verifica dimensione
            if (file.size > this.maxFileSize) {
                this.showNotification(`File "${file.name}" troppo grande (max 10MB)`, 'error');
                continue;
            }

            // Determina tipo file
            const ext = '.' + file.name.split('.').pop().toLowerCase();
            const isImage = this.allowedImageExtensions.includes(ext) || file.type.startsWith('image/');
            const isText = this.allowedTextExtensions.includes(ext);

            if (!isImage && !isText) {
                this.showNotification(`Tipo file non supportato: ${ext}`, 'error');
                continue;
            }

            try {
                if (isImage) {
                    // Leggi immagine come base64
                    const base64 = await this.readFileAsBase64(file);
                    this.attachments.push({
                        type: 'image',
                        name: file.name,
                        mimeType: file.type || 'image/png',
                        data: base64,
                        size: file.size
                    });
                } else {
                    // Leggi file di testo
                    const content = await this.readFileAsText(file);
                    this.attachments.push({
                        type: 'text',
                        name: file.name,
                        content: content,
                        size: file.size
                    });
                }
            } catch (error) {
                console.error('Error reading file:', error);
                this.showNotification(`Errore lettura file: ${file.name}`, 'error');
            }
        }

        this.updateAttachmentPreview();
        this.fileInput.value = ''; // Reset per permettere ri-selezione stesso file
    }

    /**
     * Leggi file come base64
     */
    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Rimuovi il prefisso "data:...;base64,"
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Leggi file come testo
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * Aggiorna preview degli attachment
     */
    updateAttachmentPreview() {
        if (this.attachments.length === 0) {
            this.attachmentPreview.classList.add('hidden');
            this.attachmentPreview.innerHTML = '';
            return;
        }

        this.attachmentPreview.classList.remove('hidden');
        this.attachmentPreview.innerHTML = this.attachments.map((att, index) => {
            if (att.type === 'image') {
                return `
                    <div class="attachment-item attachment-image" data-index="${index}">
                        <img src="data:${att.mimeType};base64,${att.data}" alt="${att.name}">
                        <span class="attachment-name">${att.name}</span>
                        <button class="attachment-remove" onclick="app.removeAttachment(${index})">×</button>
                    </div>
                `;
            } else {
                const icon = this.getFileIcon(att.name);
                return `
                    <div class="attachment-item attachment-text" data-index="${index}">
                        <span class="attachment-icon">${icon}</span>
                        <span class="attachment-name">${att.name}</span>
                        <span class="attachment-size">${this.formatFileSize(att.size)}</span>
                        <button class="attachment-remove" onclick="app.removeAttachment(${index})">×</button>
                    </div>
                `;
            }
        }).join('');
    }

    /**
     * Rimuovi attachment
     */
    removeAttachment(index) {
        this.attachments.splice(index, 1);
        this.updateAttachmentPreview();
    }

    /**
     * Pulisci tutti gli attachment
     */
    clearAttachments() {
        this.attachments = [];
        this.updateAttachmentPreview();
    }

    /**
     * Ottieni icona per tipo file
     */
    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const icons = {
            'js': '📜', 'ts': '📘', 'py': '🐍', 'java': '☕',
            'c': '⚙️', 'cpp': '⚙️', 'h': '⚙️', 'go': '🔵',
            'rs': '🦀', 'rb': '💎', 'php': '🐘', 'swift': '🍎',
            'kt': '🟣', 'json': '📋', 'xml': '📄', 'yaml': '📝',
            'yml': '📝', 'md': '📖', 'txt': '📝', 'html': '🌐',
            'css': '🎨', 'sql': '🗃️', 'sh': '💻', 'bash': '💻'
        };
        return icons[ext] || '📄';
    }

    /**
     * Formatta dimensione file
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * Mostra notifica toast (temporanea)
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            border-radius: 8px;
            background: ${type === 'error' ? '#ff5252' : '#7c4dff'};
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Mostra alert modale personalizzato (sostituisce alert())
     * @param {string} message - Messaggio da mostrare
     * @param {string} type - Tipo: 'info', 'warning', 'error', 'success'
     * @param {string} title - Titolo opzionale
     * @returns {Promise} - Si risolve quando l'utente chiude il modale
     */
    showAlert(message, type = 'info', title = null) {
        return new Promise((resolve) => {
            // Icone per tipo
            const icons = {
                info: 'ℹ️',
                warning: '⚠️',
                error: '❌',
                success: '✅'
            };

            // Colori per tipo
            const colors = {
                info: '#7c4dff',
                warning: '#ff9800',
                error: '#ff5252',
                success: '#00e676'
            };

            // Titoli default per tipo
            const defaultTitles = {
                info: 'Informazione',
                warning: 'Attenzione',
                error: 'Errore',
                success: 'Completato'
            };

            const icon = icons[type] || icons.info;
            const color = colors[type] || colors.info;
            const modalTitle = title || defaultTitles[type] || 'Messaggio';

            // Crea overlay
            const overlay = document.createElement('div');
            overlay.className = 'custom-alert-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                animation: fadeIn 0.2s ease;
            `;

            // Crea modal
            const modal = document.createElement('div');
            modal.className = 'custom-alert-modal';
            modal.style.cssText = `
                background: #1e1e2e;
                border-radius: 12px;
                padding: 24px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.1);
                animation: slideUp 0.3s ease;
            `;

            modal.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <span style="font-size: 24px;">${icon}</span>
                    <h3 style="margin: 0; color: ${color}; font-size: 18px;">${modalTitle}</h3>
                </div>
                <div style="color: #e0e0e0; line-height: 1.6; margin-bottom: 20px; white-space: pre-wrap;">${message}</div>
                <div style="display: flex; justify-content: flex-end;">
                    <button class="custom-alert-ok-btn" style="
                        background: ${color};
                        color: white;
                        border: none;
                        padding: 10px 24px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 500;
                        font-size: 14px;
                        transition: opacity 0.2s;
                    ">OK</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Event handlers
            const closeModal = () => {
                overlay.style.animation = 'fadeOut 0.2s ease';
                modal.style.animation = 'slideDown 0.2s ease';
                setTimeout(() => {
                    overlay.remove();
                    resolve();
                }, 200);
            };

            modal.querySelector('.custom-alert-ok-btn').addEventListener('click', closeModal);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal();
            });

            // ESC key
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escHandler);
                    closeModal();
                }
            };
            document.addEventListener('keydown', escHandler);

            // Focus sul bottone
            modal.querySelector('.custom-alert-ok-btn').focus();
        });
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
