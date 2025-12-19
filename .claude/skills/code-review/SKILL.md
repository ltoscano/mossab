---
name: code-review
description: Performs comprehensive code review analyzing bugs, security issues, best practices, performance, and suggesting improvements
license: MIT
compatibility: All programming languages supported
---

# Code Review Skill

Questa skill esegue una code review completa e professionale, analizzando codice per identificare problemi e suggerire miglioramenti.

## Obiettivo

Fornire una code review dettagliata e costruttiva che aiuti a migliorare la qualità del codice.

## Processo di Review

### 1. Analisi Iniziale

Prima di tutto, esamina il codice fornito e identifica:
- Linguaggio di programmazione
- Framework/librerie utilizzate
- Contesto e scopo del codice
- Complessità generale

### 2. Aree di Analisi

Analizza il codice seguendo queste categorie:

#### A. Bug e Errori Logici
- Errori evidenti che causerebbero crash o comportamenti incorretti
- Edge cases non gestiti
- Null/undefined reference potenziali
- Off-by-one errors
- Race conditions o problemi di concurrency

#### B. Security Issues
- Input validation mancante
- SQL injection, XSS, CSRF vulnerabilities
- Hardcoded credentials o secrets
- Insufficient authentication/authorization
- Insecure cryptography
- Path traversal vulnerabilities

#### C. Performance Issues
- Loop inefficienti o N+1 queries
- Memory leaks potenziali
- Allocazioni eccessive
- Mancanza di caching dove appropriato
- Blocking operations in contesti async

#### D. Best Practices & Code Quality
- Naming conventions
- Code duplication (DRY principle)
- Function/method length e complessità
- Single Responsibility Principle
- SOLID principles violations
- Separation of concerns

#### E. Maintainability
- Readability del codice
- Commenti necessari vs. ovvi
- Magic numbers/strings
- Hard-coded values che dovrebbero essere configurabili
- Test coverage considerations

#### F. Type Safety & Error Handling
- Type annotations mancanti (TypeScript/Python)
- Error handling inadeguato
- Uncaught exceptions potenziali
- Return type ambiguity

### 3. Output Format

Presenta i risultati della review in questo formato:

```
# Code Review Report

## Summary
[Breve riassunto generale del codice e del livello di qualità]

## Critical Issues 🔴
[Issues che DEVONO essere fixati - bugs, security, data loss]

## Important Issues 🟡
[Issues significativi che dovrebbero essere fixati - performance, best practices]

## Suggestions 🔵
[Miglioramenti opzionali - refactoring, readability]

## Positive Aspects ✅
[Cosa è fatto bene nel codice - importante dare feedback positivo!]

## Recommendations
[Raccomandazioni generali per migliorare]
```

### 4. Tone e Stile

- **Costruttivo**: Focus su come migliorare, non solo su cosa è sbagliato
- **Specifico**: Fornisci esempi di codice per le correzioni suggerite
- **Educativo**: Spiega il "perché" dietro ogni suggerimento
- **Bilanciato**: Menziona anche aspetti positivi
- **Actionable**: Ogni issue deve avere una chiara azione di fix

## Esempi di Output

### Esempio Issue Critico
```
🔴 **SQL Injection Vulnerability** (Line 42)
**Problema**: Query SQL costruita con string concatenation usando input utente non sanitizzato
**Rischio**: Un attacker potrebbe eseguire arbitrary SQL commands
**Fix**:
\`\`\`javascript
// ❌ Current (vulnerable)
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ Fixed (use parameterized query)
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);
\`\`\`
```

### Esempio Suggestion
```
🔵 **Extract Magic Number** (Line 15)
**Osservazione**: Il numero 86400 è hardcoded senza context
**Suggerimento**: Usa una named constant per migliorare readability
\`\`\`javascript
// ✅ Better
const SECONDS_PER_DAY = 86400;
const expirationTime = Date.now() + SECONDS_PER_DAY;
\`\`\`
```

## Note Aggiuntive

- Se il codice è particolarmente lungo (>200 linee), considera di focalizzarti sulle parti più critiche
- Prioritizza sempre security e bugs prima di style issues
- Se ci sono pattern ripetuti, menzionalo una volta invece di ripetere per ogni occorrenza
- Considera il contesto: codice di produzione richiede standard più alti di prototipi

## Tools Raccomandati

Se necessario per una review più approfondita, puoi usare:
- `bash`: Per eseguire linters (eslint, pylint, etc.)
- `read_file`: Per esaminare file correlati e comprendere meglio il contesto
- `grep`: Per cercare pattern problematici nel codebase
