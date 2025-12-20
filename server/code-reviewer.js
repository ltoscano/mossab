const Anthropic = require('@anthropic-ai/sdk');
const FormatHelpers = require('./format-helpers');

/**
 * Code Reviewer
 *
 * Analisi automatica del codice con AI-powered review.
 * Features:
 * - Static analysis (security, performance, code smells)
 * - Inline review comments
 * - Diff analysis (breaking changes, API changes)
 * - Automated scoring
 * - Smart suggestions
 */
class CodeReviewer {
    constructor(gitToolsManager) {
        this.gitManager = gitToolsManager;
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        this.model = 'claude-sonnet-4-5-20250929';

        // Categorie di analisi
        this.analysisCategories = {
            security: {
                weight: 10,
                icon: '🔒',
                name: 'Security'
            },
            performance: {
                weight: 7,
                icon: '⚡',
                name: 'Performance'
            },
            quality: {
                weight: 6,
                icon: '✨',
                name: 'Code Quality'
            },
            maintainability: {
                weight: 5,
                icon: '🔧',
                name: 'Maintainability'
            },
            testing: {
                weight: 4,
                icon: '🧪',
                name: 'Testing'
            },
            documentation: {
                weight: 3,
                icon: '📝',
                name: 'Documentation'
            }
        };

        // Severity levels
        this.severityLevels = {
            critical: { score: -20, icon: '🔴', name: 'Critical' },
            high: { score: -10, icon: '🟠', name: 'High' },
            medium: { score: -5, icon: '🟡', name: 'Medium' },
            low: { score: -2, icon: '🔵', name: 'Low' },
            info: { score: 0, icon: 'ℹ️', name: 'Info' }
        };
    }

    /**
     * Esegui code review completo su PR o commit
     */
    async reviewCode(options = {}) {
        const {
            prNumber = null,
            branch = null,
            files = null,
            staged = false
        } = options;

        console.log('🔍 Starting code review...');

        try {
            // 1. Ottieni diff
            let diffData;
            if (prNumber) {
                diffData = await this.gitManager.getPullRequestDiff(prNumber);
            } else {
                diffData = await this.gitManager.getDiff({
                    branch: branch,
                    files: files,
                    staged: staged
                });
            }

            if (!diffData.diff || diffData.diff.trim() === '') {
                return {
                    success: false,
                    message: 'No changes to review'
                };
            }

            // 2. Analizza il diff con AI
            const analysis = await this.analyzeDiffWithAI(diffData.diff, diffData.files);

            // 3. Genera score
            const score = this.calculateScore(analysis.issues);

            // 4. Genera summary
            const summary = this.generateSummary(analysis, score, diffData.stats);

            console.log(`✅ Code review complete - Score: ${score.total}/100`);

            return {
                success: true,
                score: score,
                summary: summary,
                issues: analysis.issues,
                suggestions: analysis.suggestions,
                stats: diffData.stats,
                files: diffData.files
            };

        } catch (error) {
            console.error('❌ Code review failed:', error);
            throw error;
        }
    }

    /**
     * Analizza diff usando Claude AI
     */
    async analyzeDiffWithAI(diff, files) {
        const prompt = this.buildReviewPrompt(diff, files);

        try {
            const response = await this.anthropic.messages.create({
                model: this.model,
                max_tokens: 4000,
                temperature: 0.3, // Più deterministica per code review
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            const analysisText = response.content[0].text;

            // Parse la risposta AI in formato strutturato
            return this.parseAIResponse(analysisText);

        } catch (error) {
            console.error('AI analysis error:', error);
            // Fallback: analisi basic senza AI
            return this.performBasicAnalysis(diff);
        }
    }

    /**
     * Costruisci prompt per l'AI review
     */
    buildReviewPrompt(diff, files) {
        return `You are an expert code reviewer. Analyze this git diff and provide a comprehensive code review.

DIFF TO REVIEW:
\`\`\`diff
${diff}
\`\`\`

FILES CHANGED:
${files.map(f => `- ${f.file} (+${f.additions}/-${f.deletions})`).join('\n')}

ANALYZE FOR:

1. 🔒 **SECURITY ISSUES** (Critical Priority)
   - SQL injection, XSS, command injection
   - Authentication/authorization flaws
   - Sensitive data exposure
   - Cryptography misuse
   - Path traversal

2. ⚡ **PERFORMANCE ISSUES**
   - N+1 queries, inefficient algorithms
   - Memory leaks, resource waste
   - Blocking operations
   - Missing indexes/caching

3. ✨ **CODE QUALITY**
   - Code smells, duplications
   - Complexity, readability
   - Best practices violations
   - Design patterns misuse

4. 🔧 **MAINTAINABILITY**
   - Naming conventions
   - Code organization
   - Error handling
   - Logging

5. 🧪 **TESTING**
   - Missing tests
   - Test coverage
   - Edge cases

6. 📝 **DOCUMENTATION**
   - Missing comments
   - Unclear logic
   - API documentation

RESPONSE FORMAT (JSON):
{
  "issues": [
    {
      "category": "security|performance|quality|maintainability|testing|documentation",
      "severity": "critical|high|medium|low|info",
      "title": "Brief issue title",
      "description": "Detailed explanation",
      "file": "path/to/file.js",
      "line": 42,
      "code": "problematic code snippet",
      "suggestion": "How to fix it"
    }
  ],
  "suggestions": [
    {
      "type": "improvement|refactor|optimization",
      "title": "Suggestion title",
      "description": "What to improve",
      "benefit": "Why it helps"
    }
  ],
  "breakingChanges": [
    {
      "description": "What changed that breaks compatibility",
      "impact": "How it affects consumers"
    }
  ],
  "positives": [
    "Good things in this change"
  ]
}

Provide ONLY the JSON response, no additional text.`;
    }

    /**
     * Parse la risposta JSON dell'AI
     */
    parseAIResponse(responseText) {
        try {
            // Cerca JSON nel testo (potrebbe essere wrappato in markdown)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in AI response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // Valida struttura
            if (!parsed.issues || !Array.isArray(parsed.issues)) {
                parsed.issues = [];
            }
            if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
                parsed.suggestions = [];
            }
            if (!parsed.breakingChanges || !Array.isArray(parsed.breakingChanges)) {
                parsed.breakingChanges = [];
            }
            if (!parsed.positives || !Array.isArray(parsed.positives)) {
                parsed.positives = [];
            }

            return parsed;

        } catch (error) {
            console.warn('Failed to parse AI response:', error);
            // Ritorna struttura vuota
            return {
                issues: [],
                suggestions: [],
                breakingChanges: [],
                positives: []
            };
        }
    }

    /**
     * Analisi basic senza AI (fallback)
     */
    performBasicAnalysis(diff) {
        const issues = [];
        const suggestions = [];
        const lines = diff.split('\n');

        let currentFile = null;
        let lineNumber = 0;

        for (const line of lines) {
            // Track current file
            if (line.startsWith('+++')) {
                currentFile = line.substring(6);
                lineNumber = 0;
                continue;
            }

            // Track line numbers
            if (line.startsWith('@@')) {
                const match = line.match(/@@ -\d+,?\d* \+(\d+)/);
                if (match) {
                    lineNumber = parseInt(match[1]);
                }
                continue;
            }

            if (line.startsWith('+')) {
                lineNumber++;
                const code = line.substring(1);

                // Security checks
                if (code.match(/eval\s*\(/)) {
                    issues.push({
                        category: 'security',
                        severity: 'critical',
                        title: 'Dangerous eval() usage',
                        description: 'Using eval() can lead to code injection vulnerabilities',
                        file: currentFile,
                        line: lineNumber,
                        code: code.trim(),
                        suggestion: 'Use safer alternatives like JSON.parse() or Function constructor'
                    });
                }

                if (code.match(/innerHTML\s*=/)) {
                    issues.push({
                        category: 'security',
                        severity: 'high',
                        title: 'Potential XSS vulnerability',
                        description: 'Direct innerHTML assignment can lead to XSS attacks',
                        file: currentFile,
                        line: lineNumber,
                        code: code.trim(),
                        suggestion: 'Use textContent or a sanitization library'
                    });
                }

                if (code.match(/password|secret|api[_-]?key/i) && !code.match(/process\.env/)) {
                    issues.push({
                        category: 'security',
                        severity: 'critical',
                        title: 'Hardcoded credentials',
                        description: 'Credentials should not be hardcoded',
                        file: currentFile,
                        line: lineNumber,
                        code: code.trim(),
                        suggestion: 'Use environment variables or secret management'
                    });
                }

                // Performance checks
                if (code.match(/console\.log/)) {
                    issues.push({
                        category: 'quality',
                        severity: 'low',
                        title: 'Console.log in code',
                        description: 'Debug logging should be removed from production code',
                        file: currentFile,
                        line: lineNumber,
                        code: code.trim(),
                        suggestion: 'Remove console.log or use proper logging library'
                    });
                }

                if (code.match(/var\s+/)) {
                    issues.push({
                        category: 'quality',
                        severity: 'low',
                        title: 'Use of var instead of let/const',
                        description: 'var has function scope and can lead to bugs',
                        file: currentFile,
                        line: lineNumber,
                        code: code.trim(),
                        suggestion: 'Use let or const for block-scoped variables'
                    });
                }

                if (code.match(/==\s*/) && !code.match(/===\s*/)) {
                    issues.push({
                        category: 'quality',
                        severity: 'medium',
                        title: 'Use === instead of ==',
                        description: 'Loose equality can lead to unexpected type coercion',
                        file: currentFile,
                        line: lineNumber,
                        code: code.trim(),
                        suggestion: 'Use strict equality === or !== instead'
                    });
                }
            }
        }

        // Suggestions generiche
        if (issues.filter(i => i.category === 'security').length > 0) {
            suggestions.push({
                type: 'improvement',
                title: 'Security audit recommended',
                description: 'Consider running a full security audit on this code',
                benefit: 'Prevents security vulnerabilities in production'
            });
        }

        return {
            issues: issues,
            suggestions: suggestions,
            breakingChanges: [],
            positives: issues.length === 0 ? ['No obvious issues found'] : []
        };
    }

    /**
     * Calcola score del codice
     */
    calculateScore(issues) {
        let baseScore = 100;
        let deductions = 0;
        const breakdown = {};

        // Inizializza breakdown
        for (const category in this.analysisCategories) {
            breakdown[category] = {
                issues: 0,
                score: 0
            };
        }

        // Calcola deduzioni per categoria
        for (const issue of issues) {
            const severity = this.severityLevels[issue.severity] || this.severityLevels.medium;
            const category = this.analysisCategories[issue.category] || this.analysisCategories.quality;

            const deduction = Math.abs(severity.score) * (category.weight / 10);
            deductions += deduction;

            breakdown[issue.category].issues++;
            breakdown[issue.category].score -= deduction;
        }

        const total = Math.max(0, Math.round(baseScore - deductions));

        return {
            total: total,
            grade: this.getGrade(total),
            breakdown: breakdown,
            deductions: Math.round(deductions)
        };
    }

    /**
     * Ottieni grade letter da score
     */
    getGrade(score) {
        if (score >= 90) return 'A+';
        if (score >= 85) return 'A';
        if (score >= 80) return 'A-';
        if (score >= 75) return 'B+';
        if (score >= 70) return 'B';
        if (score >= 65) return 'B-';
        if (score >= 60) return 'C+';
        if (score >= 55) return 'C';
        if (score >= 50) return 'C-';
        if (score >= 45) return 'D';
        return 'F';
    }

    /**
     * Genera summary del review
     */
    generateSummary(analysis, score, stats) {
        const { issues, suggestions, breakingChanges, positives } = analysis;

        // Raggruppa issues per severity
        const bySeverity = {
            critical: issues.filter(i => i.severity === 'critical'),
            high: issues.filter(i => i.severity === 'high'),
            medium: issues.filter(i => i.severity === 'medium'),
            low: issues.filter(i => i.severity === 'low'),
            info: issues.filter(i => i.severity === 'info')
        };

        // Raggruppa per category
        const byCategory = {};
        for (const category in this.analysisCategories) {
            byCategory[category] = issues.filter(i => i.category === category);
        }

        let summary = `# Code Review Summary\n\n`;

        // Overall score
        summary += `## Overall Score: ${score.total}/100 (${score.grade})\n\n`;

        // Stats
        summary += `### Changes\n`;
        summary += `- Files: ${stats.files}\n`;
        summary += `- Additions: +${stats.additions}\n`;
        summary += `- Deletions: -${stats.deletions}\n\n`;

        // Issues by severity
        summary += `### Issues Found: ${issues.length}\n\n`;

        if (bySeverity.critical.length > 0) {
            summary += `🔴 **Critical**: ${bySeverity.critical.length}\n`;
        }
        if (bySeverity.high.length > 0) {
            summary += `🟠 **High**: ${bySeverity.high.length}\n`;
        }
        if (bySeverity.medium.length > 0) {
            summary += `🟡 **Medium**: ${bySeverity.medium.length}\n`;
        }
        if (bySeverity.low.length > 0) {
            summary += `🔵 **Low**: ${bySeverity.low.length}\n`;
        }
        summary += `\n`;

        // Top issues
        if (issues.length > 0) {
            summary += `### Top Issues\n\n`;
            const topIssues = issues
                .sort((a, b) => {
                    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
                    return severityOrder[a.severity] - severityOrder[b.severity];
                })
                .slice(0, 5);

            for (const issue of topIssues) {
                const sev = this.severityLevels[issue.severity];
                const cat = this.analysisCategories[issue.category];
                summary += `${sev.icon} **${issue.title}** (${cat.icon} ${cat.name})\n`;
                summary += `   ${issue.file}:${issue.line}\n`;
                summary += `   ${issue.description}\n\n`;
            }
        }

        // Breaking changes
        if (breakingChanges.length > 0) {
            summary += `### ⚠️ Breaking Changes\n\n`;
            for (const change of breakingChanges) {
                summary += `- ${change.description}\n`;
                summary += `  Impact: ${change.impact}\n\n`;
            }
        }

        // Suggestions
        if (suggestions.length > 0) {
            summary += `### 💡 Suggestions\n\n`;
            for (const suggestion of suggestions.slice(0, 3)) {
                summary += `- **${suggestion.title}**: ${suggestion.description}\n`;
            }
            summary += `\n`;
        }

        // Positives
        if (positives.length > 0) {
            summary += `### ✅ Positives\n\n`;
            for (const positive of positives) {
                summary += `- ${positive}\n`;
            }
            summary += `\n`;
        }

        return summary;
    }

    /**
     * Review specifico di un file
     */
    async reviewFile(filePath) {
        const diffData = await this.gitManager.getDiff({
            files: [filePath]
        });

        if (!diffData.diff) {
            return {
                success: false,
                message: `No changes in ${filePath}`
            };
        }

        return await this.reviewCode({
            files: [filePath]
        });
    }

    /**
     * Quick security scan (solo security issues)
     */
    async securityScan(options = {}) {
        const fullReview = await this.reviewCode(options);

        if (!fullReview.success) {
            return fullReview;
        }

        const securityIssues = fullReview.issues.filter(i => i.category === 'security');

        return {
            success: true,
            issues: securityIssues,
            critical: securityIssues.filter(i => i.severity === 'critical').length,
            high: securityIssues.filter(i => i.severity === 'high').length,
            summary: this.generateSecuritySummary(securityIssues)
        };
    }

    /**
     * Genera security summary
     */
    generateSecuritySummary(issues) {
        if (issues.length === 0) {
            return '✅ No security issues found';
        }

        let summary = `🔒 Security Scan Results\n\n`;
        summary += `Found ${issues.length} security issue(s):\n\n`;

        for (const issue of issues) {
            const sev = this.severityLevels[issue.severity];
            summary += `${sev.icon} **${issue.title}**\n`;
            summary += `   ${issue.file}:${issue.line}\n`;
            summary += `   ${issue.description}\n`;
            summary += `   Fix: ${issue.suggestion}\n\n`;
        }

        return summary;
    }

    /**
     * Tool definitions per ClaudeService
     */
    getToolDefinitions() {
        return [
            {
                name: 'code_review',
                description: 'Esegui code review automatico su modifiche staged, branch, o PR. Analizza security, performance, quality, maintainability, testing, documentation. Ritorna score e issues dettagliati.',
                input_schema: {
                    type: 'object',
                    properties: {
                        pr_number: {
                            type: 'number',
                            description: 'Numero PR da revieware (opzionale)'
                        },
                        branch: {
                            type: 'string',
                            description: 'Branch con cui confrontare (es: "main")'
                        },
                        files: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'File specifici da revieware (opzionale)'
                        },
                        staged: {
                            type: 'boolean',
                            description: 'Se true, review solo staged changes (default: false)'
                        }
                    }
                }
            },
            {
                name: 'security_scan',
                description: 'Esegui security scan rapido. Trova solo security issues (SQL injection, XSS, hardcoded credentials, etc.). Più veloce di code_review completo.',
                input_schema: {
                    type: 'object',
                    properties: {
                        pr_number: {
                            type: 'number',
                            description: 'Numero PR da scannerizzare (opzionale)'
                        },
                        branch: {
                            type: 'string',
                            description: 'Branch con cui confrontare'
                        },
                        staged: {
                            type: 'boolean',
                            description: 'Se true, scan solo staged changes'
                        }
                    }
                }
            },
            {
                name: 'review_file',
                description: 'Review di un singolo file. Utile per analisi mirata.',
                input_schema: {
                    type: 'object',
                    properties: {
                        file: {
                            type: 'string',
                            description: 'Path del file da revieware'
                        }
                    },
                    required: ['file']
                }
            }
        ];
    }

    /**
     * Esegui un tool
     */
    async executeTool(toolName, toolInput) {
        let result;
        let formattedMessage = '';

        switch (toolName) {
            case 'code_review':
                result = await this.reviewCode({
                    prNumber: toolInput.pr_number,
                    branch: toolInput.branch,
                    files: toolInput.files,
                    staged: toolInput.staged
                });
                formattedMessage = FormatHelpers.formatCodeReview(result);
                return { ...result, formatted_message: formattedMessage };

            case 'security_scan':
                result = await this.securityScan({
                    prNumber: toolInput.pr_number,
                    branch: toolInput.branch,
                    staged: toolInput.staged
                });
                formattedMessage = FormatHelpers.formatSecurityScan(result);
                return { ...result, formatted_message: formattedMessage };

            case 'review_file':
                result = await this.reviewFile(toolInput.file);
                formattedMessage = FormatHelpers.formatCodeReview(result);
                return { ...result, formatted_message: formattedMessage };

            default:
                throw new Error(`Unknown code review tool: ${toolName}`);
        }
    }
}

module.exports = CodeReviewer;
