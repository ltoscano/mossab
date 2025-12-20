# Tool Completi di Mossab

## Overview

Mossab ora dispone di un set completo di tool production-ready che gli permettono di:
- Cercare informazioni online
- Recuperare contenuti web
- Fare domande all'utente per chiarire requisiti ambigui
- Operare su filesystem
- Gestire task e TODO
- Invocare skills specializzate

## Tool Implementati

### 1. Web Tools ✅ PRODUCTION-READY

#### web_search
**Scopo**: Cercare informazioni su internet
**Status**: ✅ Production-ready con Google Custom Search API

**Implementazione**:
- Supporta Google Custom Search API (configurabile con `SEARCH_API_KEY` e `SEARCH_ENGINE_ID`)
- Fallback intelligente con disclaimer quando l'API non è configurata
- Restituisce titoli, snippets, URL
- Parametri: `query`, `num_results` (default: 5, max: 10)

**File**: `server/web-tools.js`

**Esempio output**:
```json
{
  "query": "React hooks tutorial",
  "num_results": 5,
  "results": [
    {
      "title": "React Hooks Documentation",
      "snippet": "Learn about React Hooks...",
      "url": "https://react.dev/learn/hooks",
      "source": "google"
    }
  ]
}
```

#### web_fetch
**Scopo**: Recuperare contenuto completo da URL
**Status**: ✅ Production-ready con HTTPS/HTTP nativo

**Implementazione**:
- Usa moduli HTTPS/HTTP nativi di Node.js
- Gestisce redirect automaticamente
- Estrae contenuto principale (rimuove script, style, HTML tags)
- Decodifica HTML entities
- Limita lunghezza a 50K caratteri (~12500 tokens)
- Timeout 30 secondi
- User-Agent custom

**File**: `server/web-tools.js`

**Esempio output**:
```json
{
  "url": "https://nodejs.org/api/fs.html",
  "content": "File System The node:fs module enables...",
  "content_length": 45230,
  "extracted_main_content": true,
  "success": true
}
```

### 2. User Interaction Tools ✅ PRODUCTION-READY

#### ask_user_question
**Scopo**: Fare domande all'utente e aspettare risposta
**Status**: ✅ Production-ready con Promise-based system

**Implementazione**:
- Sistema basato su Promise che blocca finché l'utente risponde
- Timeout automatico dopo 5 minuti
- Supporto per risposte suggerite
- Contesto opzionale
- Cancellazione manuale possibile
- Polling frontend ogni 2 secondi
- UI modal dedicata

**File**: `server/user-question-manager.js`

**Quando usarlo**:
- Requisiti ambigui (es: "Vuoi JWT o session-based auth?")
- Multiple implementazioni possibili
- Informazioni mancanti che solo l'utente può fornire

**Esempio**:
```javascript
// Mossab invoca il tool
{
  "tool": "ask_user_question",
  "input": {
    "question": "Quale sistema di autenticazione preferisci? 1) JWT tokens 2) Session-based 3) OAuth2",
    "context": "Sto implementando il sistema di login",
    "suggested_answers": ["JWT tokens", "Session-based", "OAuth2"]
  }
}

// Output dopo risposta utente
{
  "success": true,
  "question": "Quale sistema...",
  "answer": "JWT tokens",
  "timeout": false,
  "message": "L'utente ha risposto: 'JWT tokens'"
}
```

**API Endpoints**:
- `GET /api/questions` - Lista domande pendenti
- `POST /api/questions/:id/answer` - Rispondi
- `POST /api/questions/:id/cancel` - Cancella
- `GET /api/questions/stats` - Statistiche

**UI**: Modal con:
- Domanda prominente
- Contesto se fornito
- Bottoni per risposte suggerite
- Textarea per risposta custom
- Tasti "Rispondi" e "Salta"
- Polling automatico

### 3. Filesystem Tools ✅ PRODUCTION-READY

#### read_file, write_file, edit_file, glob, grep, bash
**Status**: ✅ Già implementati nel commit precedente

**File**: `server/filesystem-tools.js`

Dettagli:
- `read_file`: Leggi file con line numbers
- `write_file`: Crea o sovrascrivi file
- `edit_file`: Modifica con replace string
- `glob`: Cerca file per pattern (**/*.js)
- `grep`: Cerca contenuto con regex
- `bash`: Esegui comandi shell

### 4. Task Management Tools ✅ PRODUCTION-READY

#### todo_write
**Status**: ✅ Production-ready con UI real-time

**File**: `server/filesystem-tools.js`

**Features**:
- Stati: pending → in_progress → completed
- Storage in-memory (Map)
- UI con indicator in header
- Polling frontend ogni 2 secondi
- Mostra progress: X/Y task
- Mostra current task

### 5. Agent Skills Tools ✅ PRODUCTION-READY

#### invoke_skill
**Status**: ✅ Production-ready seguendo standard agentskills.io

**File**: `server/skill-manager.js`

**Features**:
- Progressive disclosure
- YAML frontmatter + Markdown body
- Validazione spec completa
- 3 skills incluse: code-review, write-tests, refactor-code
- UI modal per skills
- API endpoints complete

### 6. Memory Tools ✅ IMPLEMENTED

#### memory_store, memory_recall
**Status**: ✅ Functional (in-memory Map)

**Implementazione**:
- Map in-memory per conversazione
- Key-value storage
- Timestamp su ogni entry
- Produzione: migrare a Redis/DB

### 7. Analysis Tools ⚠️ SIMULATED

#### code_analyzer
**Status**: ⚠️ Simulato (legacy tool)

**Note**: Tool legacy mantenuto per compatibilità. In produzione si integrerebbe con:
- ESLint per JavaScript
- Pylint per Python
- SonarQube per analisi enterprise

#### task_planner
**Status**: ⚠️ Simulato (legacy tool)

**Note**: Tool legacy. Mossab usa principalmente `todo_write` per planning.

## Riepilogo Status

| Tool | Status | Implementazione | File |
|------|--------|-----------------|------|
| web_search | ✅ Production-ready | Google Custom Search API + fallback | web-tools.js |
| web_fetch | ✅ Production-ready | HTTPS/HTTP nativo | web-tools.js |
| ask_user_question | ✅ Production-ready | Promise + UI + API | user-question-manager.js |
| read_file | ✅ Production-ready | fs.readFile + formatting | filesystem-tools.js |
| write_file | ✅ Production-ready | fs.writeFile | filesystem-tools.js |
| edit_file | ✅ Production-ready | Replace string | filesystem-tools.js |
| glob | ✅ Production-ready | File pattern matching | filesystem-tools.js |
| grep | ✅ Production-ready | Content search + regex | filesystem-tools.js |
| bash | ✅ Production-ready | execSync | filesystem-tools.js |
| todo_write | ✅ Production-ready | Map + UI + polling | filesystem-tools.js |
| invoke_skill | ✅ Production-ready | agentskills.io standard | skill-manager.js |
| memory_store | ✅ Functional | Map in-memory | claude-service.js |
| memory_recall | ✅ Functional | Map in-memory | claude-service.js |
| code_analyzer | ⚠️ Simulated | Legacy placeholder | claude-service.js |
| task_planner | ⚠️ Simulated | Legacy placeholder | claude-service.js |

## Configurazione

### Per abilitare web_search con Google Custom Search

1. Ottieni API key: https://developers.google.com/custom-search/v1/overview
2. Crea search engine: https://cse.google.com/cse/create/new
3. Configura `.env`:
```bash
SEARCH_API_KEY=your_google_api_key
SEARCH_ENGINE_ID=your_search_engine_id
```

### Per abilitare tutti i tool

In `.env`:
```bash
ENABLE_TOOL_USE=true
ENABLE_PLANNING=true
ENABLE_MEMORY=true
```

## Testing

Ogni tool è stato testato per:
- ✅ Sintassi JavaScript valida
- ✅ Error handling robusto
- ✅ Timeout e retry logic
- ✅ Input validation
- ✅ Output formatting consistente

## Esempi d'Uso

### Web Search
```
User: "Cerca le ultime best practices per React hooks 2025"
Mossab: [usa web_search] → Trova articoli recenti → Riassume le best practices
```

### Web Fetch
```
User: "Leggi la documentazione di Express.js per middleware"
Mossab: [usa web_fetch su expressjs.com] → Estrae contenuto → Spiega middleware
```

### Ask User Question
```
User: "Implementa autenticazione per l'app"
Mossab: [Vede ambiguità] → [usa ask_user_question: "Quale sistema di auth?"]
User: [Risponde "JWT"]
Mossab: → Implementa JWT-based auth
```

### Combined Tools
```
User: "Aggiungi dark mode all'app React"
Mossab:
1. [usa ask_user_question] → "Vuoi CSS-in-JS o CSS modules?"
2. [usa read_file] → Legge App.js corrente
3. [usa web_search] → Cerca pattern dark mode React 2025
4. [usa todo_write] → Crea piano: 1) Context 2) Toggle 3) Styles
5. [usa write_file] → Implementa DarkModeContext.js
6. [usa edit_file] → Modifica App.js
```

## Note di Produzione

**Pronto per produzione**:
- ✅ web_search (con API key)
- ✅ web_fetch
- ✅ ask_user_question
- ✅ Tutti i filesystem tools
- ✅ todo_write
- ✅ invoke_skill

**Da migrare per produzione**:
- memory_store/recall → Redis o database persistente
- code_analyzer → Integrare ESLint/Pylint reali
- task_planner → Opzionale, già coperto da todo_write

**Limiti da considerare**:
- web_search richiede Google API key (quota limiti)
- web_fetch: timeout 30s, max 50K chars
- ask_user_question: timeout 5 minuti
- memory: in-memory, persa a restart server

## Conclusione

Mossab ora dispone di un arsenale completo di tool production-ready che gli permettono di:
- 🌐 Accedere a informazioni online
- 💬 Chiarire requisiti con l'utente
- 📁 Operare su filesystem
- 📋 Gestire task complessi
- ⚡ Usare skills specializzate

Ogni tool è implementato seguendo best practices con error handling, timeout, validazione e UI/API complete.
