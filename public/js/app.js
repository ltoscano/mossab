// Mossab AI Chat Application
class MossabChat {
    constructor() {
        this.conversationHistory = [];
        this.isTyping = false;

        // DOM Elements
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.tokenCounter = document.getElementById('tokenCounter');

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

        try {
            // Call API
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    conversationHistory: this.conversationHistory
                })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();

            // Hide typing indicator
            this.hideTypingIndicator();

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
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new MossabChat();

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
