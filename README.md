# 🤖 Mossab - Your AI Developer

> **Assistente AI di programmazione con CLI cross-platform, agenti specializzati, workflow automation e marketplace community**

Mossab è un sistema completo di sviluppo AI-powered che combina:
- 💬 **Chat AI intelligente** (powered by Claude Sonnet 4.5)
- 🎯 **Agenti specializzati** (code review, bug hunting, refactoring)
- 🔄 **Workflow automation** (pipeline multi-agente)
- 🏪 **Community marketplace** (condividi e scopri agenti/workflow)
- 📊 **Analytics dashboard** (metriche e statistiche)

![Version](https://img.shields.io/badge/version-2.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D16-green)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey)

---

## 🚀 Quick Start (3 Step)

### 1️⃣ Installa Mossab

```bash
# Clona il repository
git clone https://github.com/your-org/mossab.git
cd mossab

# Installa dipendenze
npm install

# Installa globalmente (per usare ovunque)
npm install -g .
```

### 2️⃣ Configura API Key

Ottieni una API key da [Anthropic Console](https://console.anthropic.com/) e configurala:

```bash
# Opzione A: Variabile d'ambiente (raccomandato)
export ANTHROPIC_API_KEY='sk-ant-your-key-here'

# Opzione B: File .env
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env
```

### 3️⃣ Avvia Mossab

```bash
# Usa nel tuo progetto
cd ~/my-project
mossab

# Si apre automaticamente su http://localhost:3000
```

**Fatto!** 🎉 Mossab è pronto per lavorare sul tuo progetto.

---

## 📖 Utilizzo Base

### Lavorare su Progetti

```bash
# Directory corrente
cd ~/my-website
mossab

# Directory specifica
mossab /path/to/project

# Porta personalizzata
mossab --port 8080

# Windows
mossab C:\Users\Me\Projects\app
```

### Comandi CLI

```bash
mossab [workspace] [options]

Opzioni:
  -p, --port PORT   Porta del server (default: 3000)
  --no-open         Non aprire browser automaticamente
  -h, --help        Mostra aiuto
  -v, --version     Mostra versione
```

### Funzionalità Web UI

1. **Chat AI**: Conversazioni intelligenti con Claude
2. **Agenti**: Specialisti per task specifici (code review, bug hunting, etc.)
3. **Workflow**: Pipeline automatizzate multi-agente
4. **Marketplace**: Browse e installa agenti/workflow dalla community
5. **Analytics**: Metriche e statistiche di utilizzo

---

## 🏪 Marketplace Community (Opzionale)

Per condividere agenti e workflow con la community, configura il marketplace server:

### Setup Marketplace Server

```bash
# 1. Vai nella directory marketplace
cd server-market

# 2. Installa dipendenze
npm install

# 3. Inizializza database (crea admin user)
npm run init-db

# Output: API Key admin - SALVALA!
# ✅ Admin user created!
#    API Key: mossab_abc123...

# 4. Avvia server
npm start

# Marketplace server su http://localhost:4000
```

### Connetti Client al Marketplace

Aggiungi al tuo `.env`:

```env
MARKETPLACE_URL=http://localhost:4000
# MARKETPLACE_API_KEY opzionale - puoi fare login via UI
```

**Riavvia Mossab** e vedrai:
- 🌐 Badge "Remote Marketplace" nella UI
- Opzioni per login/register
- Browse e download da marketplace centrale

---

## ⚙️ Configurazione Avanzata

### Variabili d'Ambiente

Crea un file `.env` nella root del progetto:

```env
# ============================================
# Claude AI Configuration
# ============================================
ANTHROPIC_API_KEY=sk-ant-your-key-here
AI_MODEL=claude-sonnet-4-5-20250929

# Server
PORT=3000

# ============================================
# Community Marketplace (Opzionale)
# ============================================
MARKETPLACE_URL=http://localhost:4000
MARKETPLACE_API_KEY=mossab_your-api-key

# ============================================
# Features
# ============================================
ENABLE_TOOL_USE=true
ENABLE_PLANNING=true
ENABLE_MEMORY=true
```

### Multi-Progetto

Lavora su più progetti contemporaneamente:

```bash
# Terminal 1
cd ~/project-a
mossab --port 3000

# Terminal 2
cd ~/project-b
mossab --port 3001

# Ogni istanza lavora su workspace separato!
```

---

## 🎯 Esempi d'Uso

### 1. Chat AI per Coding

```
Apri UI → Chat tab
> "Crea un'API REST con Express per gestire utenti"
> "Aggiungi autenticazione JWT"
> "Scrivi test con Jest"
```

### 2. Agenti Specializzati

```
Apri UI → Agents tab
→ Crea agent "security-audit"
→ Configura: model, tools, system_prompt
→ Esegui su codebase

Risultato: Report sicurezza completo
```

### 3. Workflow Automation

```
Apri UI → Workflows tab
→ Crea workflow "full-review"
→ Step 1: Code Review (agent: code-reviewer)
→ Step 2: Security Scan (agent: security-audit)
→ Step 3: Performance Check (agent: perf-analyzer)
→ Esegui workflow

Risultato: Pipeline completa automatizzata
```

### 4. Marketplace

```
Apri UI → Marketplace tab

Browse:
→ Cerca "code-reviewer"
→ Vedi rating, downloads, descrizione
→ Click "Install" → Installato localmente!

Publish:
→ Login (se remote marketplace)
→ Seleziona agent/workflow
→ Click "Publish"
→ Disponibile per tutta la community!
```

---

## 📁 Struttura Workspace

Quando usi Mossab in un progetto, crea questa struttura:

```
your-project/
├── .mossab/
│   ├── agents/              # Agenti custom
│   │   └── my-agent/
│   │       ├── config.json
│   │       └── versions.json
│   ├── workflows/           # Workflow definitions
│   ├── webhooks/            # Webhook configs
│   ├── schedules/           # Scheduled tasks
│   ├── marketplace/         # Published items (local)
│   └── analytics/           # Analytics data
└── [tuoi file del progetto]
```

---

## 🌍 Multi-Piattaforma

Mossab funziona nativamente su:

| Sistema | Supporto | Note |
|---------|----------|------|
| 🐧 Linux | ✅ Completo | Ubuntu, Debian, Fedora, Arch |
| 🍎 macOS | ✅ Completo | macOS 10.15+ |
| 🪟 Windows | ✅ Completo | Windows 10/11, PowerShell/CMD |

### Windows: Setup Veloce

```powershell
# 1. Installa
npm install -g .

# 2. Configura API key
$env:ANTHROPIC_API_KEY='sk-ant-your-key'

# 3. Usa
cd C:\Projects\my-app
mossab
```

---

## 🔧 Troubleshooting

### API Key non funziona

```bash
# Verifica che sia settata
echo $ANTHROPIC_API_KEY  # Linux/Mac
echo %ANTHROPIC_API_KEY%  # Windows CMD
$env:ANTHROPIC_API_KEY   # Windows PowerShell
```

### Porta già in uso

```bash
mossab --port 3001
```

### Permessi su Linux/Mac

```bash
sudo npm install -g .
```

### Windows: Comando non trovato

```powershell
# Aggiungi npm global bin al PATH
npm config get prefix
# Aggiungi quel path a Environment Variables > PATH
```

### Marketplace non si connette

```bash
# Verifica che il server sia attivo
curl http://localhost:4000/health

# Verifica configurazione
echo $MARKETPLACE_URL
```

---

## 📚 Documentazione Completa

- **[Agent System](docs/agents.md)** - Crea agenti specializzati
- **[Workflows](docs/workflows.md)** - Automation multi-agente
- **[Marketplace](docs/marketplace.md)** - Condivisione community
- **[Webhooks](docs/webhooks.md)** - Trigger automatici
- **[Versioning](docs/versioning.md)** - Version management
- **[Analytics](docs/analytics.md)** - Metriche e statistiche
- **[API Reference](docs/api.md)** - Endpoint REST

---

## 🚢 Deployment

### Marketplace Server in Produzione

#### Opzione 1: VPS (Ubuntu)

```bash
# 1. Setup server
ssh user@your-server.com
git clone your-repo
cd mossab/server-market
npm install

# 2. Configure
cp .env.example .env
nano .env  # Edita configurazione

# 3. Initialize
npm run init-db

# 4. Run with PM2
npm install -g pm2
pm2 start index.js --name marketplace
pm2 save
pm2 startup
```

#### Opzione 2: Docker

```bash
cd server-market
docker build -t mossab-marketplace .
docker run -d \
  -p 4000:4000 \
  -v $(pwd)/data:/app/data \
  --name marketplace \
  mossab-marketplace
```

#### Opzione 3: Railway/Render (1-click)

1. Push repository su GitHub
2. Connetti Railway/Render
3. Deploy automatico!
4. Configura `DATABASE_URL` (se PostgreSQL)

### Client Mossab (Local Development)

Il client Mossab è pensato per girare **localmente** sulla macchina dello sviluppatore per lavorare sui file locali. Non fare deploy del client - lascialo locale!

---

## 🤝 Contributing

Contributi benvenuti!

```bash
# 1. Fork il repository
# 2. Crea branch
git checkout -b feature/amazing-feature

# 3. Commit
git commit -m 'feat: Add amazing feature'

# 4. Push e PR
git push origin feature/amazing-feature
```

---

## 📄 Licenza

MIT License - vedi [LICENSE](LICENSE)

---

## 💡 Tips & Best Practices

### Performance

- Usa `--port` per istanze multiple
- Chiudi tab non usate per ridurre memory
- Analytics salvate ogni 30s (cache)

### Sicurezza

- Non committare `.env` con API keys
- Usa variabili d'ambiente in produzione
- Cambia password admin marketplace subito

### Workflow

- Crea agenti riusabili per task comuni
- Usa workflow per pipeline ripetitive
- Pubblica sul marketplace per condividere

### Marketplace

- Usa tag descrittivi per migliore discovery
- Versiona gli agenti prima di pubblicare
- Testa localmente prima di publish

---

## 🆘 Supporto

- 📖 [Documentazione](docs/)
- 🐛 [Report Bug](https://github.com/your-org/mossab/issues)
- 💬 [Discussions](https://github.com/your-org/mossab/discussions)

---

## 🙏 Credits

- Powered by [Anthropic Claude](https://www.anthropic.com/)
- Built with Express.js, Node.js
- UI inspired by Claude AI

---

**Made with ❤️ by Mossab Community**

*"Il codice migliore è quello che scrive se stesso... quasi!"*
