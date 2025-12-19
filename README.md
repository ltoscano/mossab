# 🤖 Mossab - AI Developer Assistant v2.0

> **Il tuo programmatore artificiale con le stesse capacità di Claude Code**

Mossab è un assistente AI di programmazione **potenziato da Claude Sonnet 4.5**, con le stesse capacità avanzate che trovi in Claude Code: gestione della memoria, tool use (MCP), planning, reasoning e molto altro. Un vero "dipendente artificiale" sempre disponibile!

![Mossab AI Developer](https://img.shields.io/badge/AI-Developer-7c4dff?style=for-the-badge)
![Claude Powered](https://img.shields.io/badge/Powered_by-Claude_4.5-orange?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)

## ✨ Caratteristiche Principali

### 🎨 Interfaccia & UX
- 💬 **UI Moderna Premium**: Design ispirato a Claude AI con sfondo gradiente viola-blu
- 📱 **Fully Responsive**: Funziona perfettamente su desktop, tablet e mobile
- ⚡ **Animazioni Fluide**: Transizioni smooth e feedback visivo professionale
- 🎯 **Quick Actions**: Suggerimenti contestuali per iniziare velocemente

### 🧠 Capacità AI Avanzate (Powered by Claude 4.5)
- 🔧 **Tool Use & MCP**: Può invocare strumenti per operazioni reali
- 🧩 **Advanced Planning**: Scompone problemi complessi in task gestibili
- 💾 **Conversation Memory**: Mantiene il contesto tra sessioni
- 🤔 **Extended Thinking**: Ragionamento profondo prima delle risposte
- 💻 **Professional Code Gen**: Codice production-ready con best practices
- 🔄 **Real-time Streaming**: Risposte in tempo reale

## 🎯 Cosa può fare Mossab

### 💻 Sviluppo Software
- Scrittura di codice production-ready in JavaScript/TypeScript, Python, e molti altri linguaggi
- Generazione di architetture software scalabili e manutenibili
- Code review dettagliati con suggerimenti di best practices
- Refactoring e ottimizzazione di codice esistente

### 🔧 Tool Use & MCP (Model Context Protocol)
Quando configurato con API key, Mossab può invocare questi strumenti:

- **`web_search`**: Cerca informazioni aggiornate su internet
- **`code_analyzer`**: Analizza codice per bug, security issues, e code smells
- **`task_planner`**: Crea piani dettagliati per feature complesse
- **`memory_store`**: Salva informazioni importanti per riferimenti futuri
- **`memory_recall`**: Recupera informazioni da conversazioni precedenti

### 🧩 Advanced Capabilities
- **Planning**: Scompone problemi complessi in step actionable
- **Reasoning**: Usa "thinking" per analisi approfondite
- **Memory**: Ricorda contesto tra conversazioni
- **Streaming**: Risposte in tempo reale senza attese

## 🚀 Quick Start

### Prerequisiti

- Node.js v14 o superiore
- npm o yarn
- API key di Anthropic (per capacità complete) - [Ottienila qui](https://console.anthropic.com/)

### Installazione

1. **Clona il repository**
   ```bash
   git clone <repository-url>
   cd mossab
   ```

2. **Installa le dipendenze**
   ```bash
   npm install
   ```

3. **Configura l'API Key** ⚡ IMPORTANTE
   ```bash
   cp .env.example .env
   ```

   Modifica il file `.env` e aggiungi la tua API key:
   ```env
   ANTHROPIC_API_KEY=sk-ant-your-api-key-here
   AI_MODEL=claude-sonnet-4-5-20250929
   ENABLE_TOOL_USE=true
   ENABLE_PLANNING=true
   ENABLE_MEMORY=true
   ```

   **Nota**: Senza API key, Mossab funzionerà in modalità limitata con risposte predefinite.

4. **Avvia il server**
   ```bash
   npm start
   ```

5. **Apri il browser**
   ```
   http://localhost:3000
   ```

### 🎬 Demo Veloce (senza API key)

Puoi provare Mossab anche senza API key per vedere l'interfaccia:
```bash
npm install
npm start
```
Mossab risponderà con un messaggio che ti guiderà nella configurazione completa!

## 📁 Struttura del Progetto

```
mossab/
├── server/
│   ├── index.js           # Server Express principale
│   └── claude-service.js  # Servizio integrazione Claude API con tool use
├── public/
│   ├── index.html         # Interfaccia chat moderna
│   ├── css/
│   │   └── styles.css     # Styling premium con glassmorphism
│   └── js/
│       └── app.js         # Logica frontend e gestione chat
├── package.json           # Dipendenze (@anthropic-ai/sdk, express, ecc.)
├── .env.example           # Template configurazione
├── .gitignore
└── README.md
```

### 🔍 File Chiave

- **`server/claude-service.js`**: Core service che implementa tool use, planning, memoria, e reasoning
- **`server/index.js`**: REST API con endpoint per chat, streaming, e session management
- **`public/css/styles.css`**: Design moderno ispirato a Claude AI
- **`public/js/app.js`**: Client-side logic con auto-resize, markdown formatting, ecc.

## 🎨 Design & UI

L'interfaccia di Mossab è stata progettata con attenzione ai dettagli:

- **Gradiente Dinamico**: Sfondo viola-blu elegante e professionale
- **Glassmorphism**: Effetti di blur e trasparenza moderna
- **Animazioni Smooth**: Transizioni fluide e naturali
- **Tipografia Chiara**: Font system ottimizzati per leggibilità
- **Dark Theme**: Ottimizzato per ridurre l'affaticamento visivo

### Palette Colori

- Primary: `#7c4dff` (Purple)
- Secondary: `#536dfe` (Indigo)
- Success: `#00e676` (Green)
- Background: Gradiente Purple → Blue

## 🔧 Configurazione

### Variabili d'Ambiente

Crea un file `.env` dalla copia di `.env.example`:

```env
# Porta del server
PORT=3000

# API Key per Claude (opzionale)
ANTHROPIC_API_KEY=your_api_key_here

# Configurazione AI
AI_MODEL=local
```

### Personalizzazione

#### Modificare la Personalità di Mossab

Modifica l'oggetto `mossabPersonality` in `server/index.js`:

```javascript
const mossabPersonality = {
  name: "Mossab",
  role: "AI Developer & Programming Assistant",
  skills: [/* aggiungi le tue skills */],
  // ...
};
```

#### Aggiungere Nuove Risposte

Estendi la `knowledgeBase` in `server/index.js`:

```javascript
const knowledgeBase = {
  // Aggiungi nuove categorie
  myCategory: "Le mie risposte personalizzate..."
};
```

## 🌐 API Endpoints

### POST `/api/chat`

Invia un messaggio a Mossab (con tutte le capacità avanzate).

**Request:**
```json
{
  "message": "Come creo un'API REST con Node.js?",
  "conversationHistory": [],
  "sessionId": "user-123"
}
```

**Response (con API key configurata):**
```json
{
  "message": "Per creare un'API REST con Node.js...",
  "thinking": "Analizzo la richiesta... [thinking content]",
  "toolsUsed": ["web_search", "code_analyzer"],
  "model": "claude-sonnet-4-5-20250929",
  "usage": {
    "input_tokens": 120,
    "output_tokens": 450
  },
  "timestamp": "2025-12-19T00:00:00.000Z",
  "capabilities": {
    "toolUse": true,
    "planning": true,
    "memory": true
  }
}
```

### POST `/api/chat/stream`

Streaming real-time delle risposte (Server-Sent Events).

**Request:**
```json
{
  "message": "Spiegami i design patterns",
  "conversationHistory": []
}
```

**Response:** Stream di eventi SSE
```
data: {"type":"text","content":"I design patterns..."}
data: {"type":"text","content":" sono soluzioni..."}
data: {"type":"end"}
```

### GET `/api/mossab/info`

Informazioni su Mossab e capacità disponibili.

**Response:**
```json
{
  "name": "Mossab",
  "role": "AI Developer & Programming Assistant",
  "version": "2.0.0",
  "model": "claude-sonnet-4-5-20250929",
  "apiConfigured": true,
  "capabilities": {
    "chat": true,
    "streaming": true,
    "toolUse": true,
    "planning": true,
    "memory": true,
    "reasoning": true
  },
  "availableTools": ["web_search", "code_analyzer", "task_planner", "memory_store", "memory_recall"],
  "status": "fully_operational"
}
```

### GET `/api/health`

Health check e status del server.

**Response:**
```json
{
  "status": "healthy",
  "mode": "full",
  "uptime": 12345.67,
  "timestamp": "2025-12-19T00:00:00.000Z",
  "sessions": 5
}
```

### DELETE `/api/session/:sessionId`

Cancella una sessione specifica.

### GET `/api/session/:sessionId`

Ottieni info su una sessione.

## 🚀 Deployment

### Deploy su Heroku

```bash
# Login
heroku login

# Crea app
heroku create mossab-ai

# Deploy
git push heroku main

# Apri
heroku open
```

### Deploy su Vercel

```bash
# Installa Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Deploy su Railway

1. Connetti il repository GitHub
2. Configura le variabili d'ambiente
3. Deploy automatico!

## 🎯 Roadmap

### ✅ Completato (v2.0)
- [x] Integrazione Claude API con Sonnet 4.5
- [x] Tool Use & MCP Protocol
- [x] Advanced Planning & Reasoning
- [x] Conversation Memory
- [x] Real-time Streaming
- [x] Session Management
- [x] Modern UI con glassmorphism

### 🚧 In Sviluppo
- [ ] Supporto code highlighting con Prism.js/Shiki
- [ ] Persistenza conversazioni su database (Redis/PostgreSQL)
- [ ] Esportazione chat in Markdown/PDF
- [ ] Implementazione tool MCP reali (non simulati)
- [ ] File upload e code analysis
- [ ] Multi-user support con authentication

### 💡 Future Ideas
- [ ] Voice input/output
- [ ] Dark/Light theme toggle
- [ ] Plugin system
- [ ] Mobile app (React Native)
- [ ] VS Code extension
- [ ] Collaborative coding sessions

## 🤝 Contribuire

Le contribuzioni sono benvenute! Per contribuire:

1. Fork del progetto
2. Crea un branch (`git checkout -b feature/AmazingFeature`)
3. Commit delle modifiche (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

## 📝 License

Questo progetto è sotto licenza MIT. Vedi il file `LICENSE` per dettagli.

## 💬 Supporto

Se hai domande o problemi:

- Apri una [Issue](https://github.com/your-repo/issues)
- Contattaci su Twitter [@mossab_ai](https://twitter.com/mossab_ai)

## 🙏 Ringraziamenti

- Design ispirato a Claude AI e ChatGPT
- Icone da [Feather Icons](https://feathericons.com/)
- Font da System Fonts

---

**Fatto con ❤️ da Mossab AI Team**

*"Il codice migliore è quello che scrive se stesso... quasi!" - Mossab*
