# 🤖 Mossab Custom Agents

Questa cartella contiene **Custom Agents** - sotto-processi AI specializzati per task complessi.

## Cos'è un Agent?

Un **Agent** è un processo AI isolato che:
- Ha un suo **system prompt** specializzato
- Accede solo a **tools specifici** (per sicurezza)
- Lavora **autonomamente** e ritorna risultati
- Può usare **modelli diversi** (haiku/sonnet/opus)

## Agents Disponibili

### Built-in (predefiniti):
- **explore** - Esplora codebase, cerca pattern, risponde a domande sul codice
- **plan** - Progetta architetture e piani di implementazione
- **research** - Ricerca approfondita multi-step

### Custom (in questa cartella):
- **security-audit** 🔒 - Trova vulnerabilità di sicurezza (SQL injection, XSS, etc.)
- **db-optimizer** 🗄️ - Ottimizza query database (N+1, missing indexes)
- **test-coverage** 🧪 - Genera test mancanti per funzioni critiche
- **doc-generator** 📚 - Genera documentazione automatica
- **perf-profiler** ⚡ - Trova bottleneck di performance

## Come Creare un Custom Agent

### 1. Crea un file JSON

```bash
touch .mossab/agents/my-agent.json
```

### 2. Definisci la configurazione

```json
{
  "name": "my-agent",
  "description": "Breve descrizione di cosa fa l'agent",
  "model": "sonnet",
  "tools": ["read", "grep", "glob"],
  "system_prompt": "Sei un esperto di X. Il tuo compito è...",
  "thoroughness": "medium",
  "max_iterations": 5,
  "parallel": false,
  "examples": [
    {
      "input": "Esempio di richiesta",
      "output": "Esempio di risposta"
    }
  ]
}
```

### 3. Parametri Spiegati

| Parametro | Tipo | Descrizione | Valori |
|-----------|------|-------------|--------|
| `name` | string | Nome univoco dell'agent | `kebab-case` |
| `description` | string | Cosa fa l'agent (mostrato in UI) | Chiaro e conciso |
| `model` | string | Modello AI da usare | `haiku` (veloce/economico)<br>`sonnet` (bilanciato)<br>`opus` (potente/costoso) |
| `tools` | array | Tools accessibili all'agent | Vedi lista sotto |
| `system_prompt` | string | Istruzioni specializzate | Chiaro e dettagliato |
| `thoroughness` | string | Quanto approfondire | `quick`, `medium`, `very-thorough` |
| `max_iterations` | number | Max round di tool use | 1-20 (default: 5) |
| `parallel` | boolean | Esegui tool in parallelo | `true`/`false` |
| `examples` | array | Esempi input/output | Per documentazione |

### 4. Tools Disponibili

#### File System:
- `read` - Leggi file
- `write` - Scrivi file (⚠️ usa con cautela)
- `edit` - Modifica file (⚠️ usa con cautela)
- `multi_edit` - Multi-file editing (⚠️ solo se abilitato)
- `glob` - Cerca file per pattern
- `list_dir` - Lista contenuto directory

#### Code Analysis:
- `grep` - Cerca nel codice
- `bash` - Esegui comandi shell (⚠️ potenzialmente pericoloso)

#### Git:
- `git_status` - Status git
- `git_diff` - Diff modifiche
- `git_log` - Log commits
- `git_commit` - Crea commit (⚠️ usa con cautela)

#### Code Review:
- `code_review` - Analisi codice automatica
- `review_file` - Review singolo file

⚠️ **Principio del minimo privilegio**: Dai all'agent SOLO i tools necessari!

### 5. Esempi di System Prompt

#### Bad ❌:
```
"Sei un AI assistant. Aiuta l'utente."
```
Troppo generico, l'agent non sa cosa fare.

#### Good ✅:
```
"Sei un esperto security researcher specializzato in web security.

Il tuo compito è analizzare il codice per trovare:
1. SQL Injection - query concatenate senza parametri
2. XSS - output non sanitizzato in HTML
3. CSRF - form senza token

Per ogni vulnerabilità:
- File e linea esatta
- Severità (Critical/High/Medium/Low)
- Fix suggerito con codice

Output in formato markdown con tabelle."
```

Specifico, actionable, output definito.

## Come Usare un Agent

### Via Chat:

```
User: "Usa l'agent security-audit per analizzare il progetto"
Mossab: [Lancia agent security-audit]
Agent: [Analizza tutto il codebase]
Agent: [Ritorna report vulnerabilità]
Mossab: "Trovate 8 vulnerabilità: 2 Critical..."
```

### Via API:

```bash
curl -X POST http://localhost:3000/api/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "security-audit",
    "task": "Analizza il progetto per vulnerabilità"
  }'
```

### Lista Agents:

```bash
curl http://localhost:3000/api/agents
```

## Best Practices

### 1. Naming
- Usa `kebab-case`: `my-agent` non `MyAgent` o `my_agent`
- Nome descrittivo: `react-optimizer` non `ro`

### 2. Model Selection
- **haiku** per task semplici (doc generation, formatting)
- **sonnet** per task normali (code review, optimization)
- **opus** per task complessi (architettura, security audit profondo)

### 3. Tools
- **Read-only** per analisi (read, grep, glob)
- **Write** solo se necessario (test generation, doc generation)
- **Mai bash** per agents non fidati

### 4. System Prompt
- Sii specifico su cosa cercare
- Definisci formato output (markdown, JSON, etc.)
- Includi esempi di cosa fare/non fare
- Usa numbered lists per chiarezza

### 5. Thoroughness
- `quick` per feedback rapidi (10-20s)
- `medium` per analisi normali (30-60s)
- `very-thorough` per audit completi (2-5min)

### 6. Testing
Testa il tuo agent prima di usarlo in production:

```bash
# Lista agents disponibili
curl http://localhost:3000/api/agents

# Test su progetto piccolo
curl -X POST http://localhost:3000/api/agent/execute \
  -d '{"agent": "my-agent", "task": "test task"}'
```

## Troubleshooting

### Agent non trovato
- Verifica che il file JSON sia in `.mossab/agents/`
- Verifica che il nome file sia `agent-name.json` (non `.txt`)
- Riavvia Mossab per ricaricare agents

### Agent fallisce subito
- Controlla che i tools specificati esistano
- Verifica che il model sia valido (haiku/sonnet/opus)
- Controlla i log in console

### Agent troppo lento
- Riduci `thoroughness` a `quick` o `medium`
- Riduci `max_iterations`
- Usa `haiku` invece di `sonnet`/`opus`

### Agent fa cose inaspettate
- System prompt troppo generico - sii più specifico
- Troppi tools - limita solo a quelli necessari
- Aggiungi esempi di cosa fare/non fare

## Condividere Agents

Puoi condividere i tuoi agents custom:

```bash
# In git, committa la cartella .mossab/
git add .mossab/agents/my-agent.json
git commit -m "Add my-agent custom agent"
git push
```

Oppure condividi il JSON con il team!

## Esempi Avanzati

### Agent Composer (multiple agents)

```json
{
  "name": "full-audit",
  "description": "Audit completo: security + performance + tests",
  "model": "opus",
  "tools": ["agent"],
  "system_prompt": "Esegui in sequenza:\n1. security-audit\n2. perf-profiler\n3. test-coverage\n\nAggrega i risultati in un report unificato.",
  "thoroughness": "very-thorough"
}
```

### Agent con Web Search

```json
{
  "name": "cve-checker",
  "description": "Verifica CVE per dipendenze del progetto",
  "model": "sonnet",
  "tools": ["read", "bash", "web_search"],
  "system_prompt": "1. Leggi package.json\n2. Per ogni dipendenza, cerca CVE online\n3. Report vulnerabilità note con fix"
}
```

## Resources

- [Mossab Documentation](../README.md)
- [Anthropic Claude API](https://docs.anthropic.com)
- [LiteLLM Models](https://docs.litellm.ai/docs/providers)

---

**Happy Agent Building!** 🚀

Se hai domande o idee per nuovi agents, apri una issue su GitHub!
