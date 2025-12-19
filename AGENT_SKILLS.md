# Agent Skills System

## Overview

Mossab ora supporta **Agent Skills** seguendo lo standard [agentskills.io](https://agentskills.io) pubblicato da Anthropic.

Le Agent Skills sono moduli riutilizzabili che contengono istruzioni, script e risorse per task specifici. Quando Mossab incontra un task che corrisponde a una skill disponibile, può invocare la skill per ricevere istruzioni dettagliate su come completare il task in modo ottimale.

## Come Funziona

### 1. Progressive Disclosure

Il sistema implementa la strategia di "progressive disclosure" dello standard agentskills.io:

- **Startup**: Solo name + description di ogni skill vengono caricate nel system prompt (~100 tokens per skill)
- **Invocation**: Quando una skill viene invocata, il contenuto completo viene caricato (<5000 tokens raccomandati)
- **Resources**: Eventuali file di riferimento o script vengono caricati solo quando necessari

### 2. Struttura di una Skill

Ogni skill è una directory in `.claude/skills/` che contiene:

```
.claude/skills/skill-name/
├── SKILL.md           # File principale (required)
├── scripts/           # Script eseguibili (optional)
├── references/        # Documentazione aggiuntiva (optional)
└── assets/            # Risorse statiche (optional)
```

### 3. Formato SKILL.md

Il file `SKILL.md` deve contenere:

**YAML Frontmatter** (required):
```yaml
---
name: skill-name              # Required: 1-64 chars, lowercase alphanumerics + hyphens
description: Brief description # Required: 1-1024 chars
license: MIT                   # Optional: License info
compatibility: Node.js 18+     # Optional: Environment requirements
metadata:                      # Optional: Additional key-value pairs
  author: Your Name
---
```

**Markdown Body** (required):
Istruzioni dettagliate su come eseguire il task, inclusi:
- Processo step-by-step
- Best practices
- Esempi di output
- Tool raccomandati da usare

## Skills Disponibili

### 1. code-review
Esegue code review professionale analizzando:
- Bug e errori logici
- Security issues
- Performance problems
- Best practices violations
- Maintainability concerns

### 2. write-tests
Genera test suite completa includendo:
- Unit tests con AAA pattern
- Integration tests
- Edge cases e boundary conditions
- Mocking di dependencies
- Coverage analysis

### 3. refactor-code
Refactoring professionale applicando:
- SOLID principles
- Design patterns
- Code smell elimination
- Clean Code principles
- Performance optimization

## Come Usare le Skills

### Per l'Utente

1. **Aprire il pannello Skills**: Clicca sull'icona ⚡ nella header
2. **Vedere skills disponibili**: La lista mostra tutte le skills con descrizioni
3. **Usare una skill**: Clicca "Usa questa skill" o chiedi direttamente a Mossab

Esempi di richieste:
```
"Usa la skill code-review per analizzare questo codice: [code]"
"Per favore usa write-tests per generare test per questa funzione"
"Applica la skill refactor-code a questo file"
```

### Per Mossab (AI)

Quando ricevi un task, valuta se corrisponde a una skill disponibile:

1. **Check Available Skills**: Nel tuo system prompt vedi tutte le skills con nome e descrizione
2. **Match Task to Skill**: Se il task corrisponde, invoca la skill con il tool `invoke_skill`
3. **Follow Instructions**: La skill ti fornisce istruzioni dettagliate su come procedere

Esempio di invocazione:
```json
{
  "tool": "invoke_skill",
  "input": {
    "skill_name": "code-review",
    "context": "The user wants me to review a JavaScript function for security issues"
  }
}
```

## API Endpoints

### GET /api/skills
Lista tutte le skills disponibili

**Response**:
```json
{
  "skills": [
    {
      "name": "code-review",
      "description": "Performs comprehensive code review...",
      "license": "MIT",
      "compatibility": "All programming languages"
    }
  ],
  "count": 3,
  "skillsDirectory": ".claude/skills/"
}
```

### GET /api/skills/:name
Ottieni dettagli completi di una skill

**Response**:
```json
{
  "skill": {
    "name": "code-review",
    "description": "...",
    "instructions": "# Full markdown content...",
    "metadata": {},
    "compatibility": "...",
    "allowedTools": []
  }
}
```

### POST /api/skills/reload
Ricarica tutte le skills (utile dopo aver aggiunto nuove skills)

**Response**:
```json
{
  "success": true,
  "message": "Skills reloaded successfully",
  "count": 3,
  "skills": [...]
}
```

## Creare Nuove Skills

### 1. Crea la directory
```bash
mkdir -p .claude/skills/your-skill-name
```

### 2. Crea SKILL.md
```markdown
---
name: your-skill-name
description: Brief description of what your skill does (1-1024 chars)
license: MIT
compatibility: Any specific requirements
---

# Your Skill Name

Detailed instructions on how to perform this task.

## Process

1. Step one
2. Step two
3. Step three

## Examples

[Provide examples]

## Best Practices

[Provide best practices]
```

### 3. (Optional) Aggiungi script
```bash
mkdir .claude/skills/your-skill-name/scripts
# Add Python, Bash, or JavaScript files
```

### 4. Reload skills
- Clicca "Reload Skills" nel pannello Skills UI
- Oppure: `POST /api/skills/reload`
- Oppure: Riavvia il server

## Implementazione Tecnica

### SkillManager Class
`server/skill-manager.js` gestisce:
- Discovery di skills dalla directory `.claude/skills/`
- Parsing YAML frontmatter + Markdown body
- Validazione secondo spec agentskills.io
- Progressive disclosure (metadata → full content → resources)
- Esecuzione di script (Python, Bash, JavaScript)

### ClaudeService Integration
`server/claude-service.js` integra:
- SkillManager nel constructor
- Skill metadata nel system prompt
- Tool `invoke_skill` per invocare skills
- Handling di skill invocation in `executeTool()`

### UI Components
`public/index.html` + `public/js/app.js` + `public/css/styles.css`:
- Modal per visualizzare skills disponibili
- Lista skills con descrizioni e metadata
- Bottone "Usa questa skill" per ogni skill
- Reload skills button

## Validazione

Il SkillManager valida automaticamente:

✅ **YAML Frontmatter**:
- `name` required (1-64 chars, lowercase, alphanumerics + hyphens)
- `description` required (1-1024 chars)
- Nome directory = nome skill

✅ **Markdown Body**:
- Deve essere presente
- Formato libero

✅ **Naming Convention**:
- No spazi
- No caratteri speciali
- No leading/trailing hyphens
- No consecutive hyphens

## Best Practices

### Per Skill Authors

1. **Keep it Focused**: Una skill = un task specifico
2. **Clear Instructions**: Step-by-step, non ambiguous
3. **Include Examples**: Mostra output atteso
4. **Recommend Tools**: Suggerisci quali tool Mossab dovrebbe usare
5. **Stay Under 5K tokens**: Per il body della skill
6. **Test Thoroughly**: Testa la skill con vari scenari

### Per Mossab (AI)

1. **Use Skills Proactively**: Non aspettare che l'utente chieda esplicitamente
2. **Follow Instructions**: Le skills contengono expertise domain-specific
3. **Combine with Tools**: Usa read_file, write_file, bash secondo necessità
4. **Provide Context**: Quando invochi una skill, fornisci contesto utile
5. **Report Results**: Comunica all'utente quale skill hai usato e perché

## Risorse

- **Standard agentskills.io**: https://agentskills.io
- **Specification**: https://agentskills.io/specification
- **GitHub**: https://github.com/agentskills/agentskills
- **Anthropic Blog**: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills

## Conclusione

Il sistema Agent Skills trasforma Mossab da un AI assistant generico a un developer AI con competenze specializzate e riutilizzabili.

Ogni skill è un modulo di expertise che può essere:
- **Condiviso** con altri utenti
- **Migliorato** nel tempo
- **Esteso** con script e risorse
- **Riutilizzato** automaticamente quando necessario

Questo approccio segue il pattern "progressive disclosure" che ottimizza l'uso del contesto mantenendo alta la qualità delle risposte.
