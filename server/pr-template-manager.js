const fs = require('fs').promises;
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * PR Template Manager
 *
 * Gestisce template per Pull Request con features avanzate:
 * - Template multipli (bugfix, feature, refactor, etc.)
 * - Auto-selezione basata su branch name
 * - Variable substitution
 * - AI-generated PR descriptions
 * - Integration con code review
 */
class PRTemplateManager {
    constructor(workspaceRoot, gitManager) {
        this.workspaceRoot = workspaceRoot;
        this.gitManager = gitManager;
        this.templatesDir = path.join(workspaceRoot, '.claude', 'pr-templates');
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        this.model = 'claude-sonnet-4-5-20250929';

        // Template types
        this.templateTypes = {
            feature: {
                name: 'Feature',
                icon: '✨',
                patterns: ['feature/', 'feat/'],
                checklist: [
                    'Tests added',
                    'Documentation updated',
                    'No breaking changes',
                    'Performance impact considered'
                ]
            },
            bugfix: {
                name: 'Bug Fix',
                icon: '🐛',
                patterns: ['bugfix/', 'fix/', 'hotfix/'],
                checklist: [
                    'Bug reproduced',
                    'Root cause identified',
                    'Fix verified',
                    'Tests prevent regression'
                ]
            },
            refactor: {
                name: 'Refactor',
                icon: '♻️',
                patterns: ['refactor/', 'refact/'],
                checklist: [
                    'Behavior unchanged',
                    'Tests still pass',
                    'Performance maintained or improved',
                    'No breaking changes'
                ]
            },
            docs: {
                name: 'Documentation',
                icon: '📝',
                patterns: ['docs/', 'doc/'],
                checklist: [
                    'Information accurate',
                    'Examples provided',
                    'Formatting correct'
                ]
            },
            performance: {
                name: 'Performance',
                icon: '⚡',
                patterns: ['perf/', 'performance/'],
                checklist: [
                    'Benchmarks added',
                    'Performance improvement measured',
                    'No functionality regression',
                    'Memory impact considered'
                ]
            },
            test: {
                name: 'Test',
                icon: '🧪',
                patterns: ['test/', 'tests/'],
                checklist: [
                    'Test coverage increased',
                    'All tests pass',
                    'Edge cases covered'
                ]
            }
        };
    }

    /**
     * Inizializza template directory
     */
    async initialize() {
        try {
            // Crea .claude/pr-templates se non esiste
            try {
                await fs.access(this.templatesDir);
            } catch {
                await fs.mkdir(this.templatesDir, { recursive: true });
                console.log('✅ Created PR templates directory');

                // Crea template di default
                await this.createDefaultTemplates();
            }

            console.log('✅ PRTemplateManager initialized');
        } catch (error) {
            console.error('❌ PRTemplateManager initialization failed:', error);
            throw error;
        }
    }

    /**
     * Crea template di default
     */
    async createDefaultTemplates() {
        const templates = {
            'feature.md': `# {{icon}} {{type}}: {{title}}

## 📋 Description
{{description}}

## 🎯 Motivation
<!-- Why is this change needed? What problem does it solve? -->

## 🔧 Changes Made
{{changes}}

## 🧪 Testing
<!-- How was this tested? -->
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual testing performed

## 📸 Screenshots
<!-- If applicable, add screenshots -->

## ⚠️ Breaking Changes
<!-- List any breaking changes, or write "None" -->

## 📝 Checklist
{{checklist}}

## 🔗 Related Issues
<!-- Link related issues: Closes #123 -->
`,

            'bugfix.md': `# {{icon}} {{type}}: {{title}}

## 🐛 Bug Description
{{description}}

## 🔍 Root Cause
<!-- What caused this bug? -->

## 🔧 Fix
{{changes}}

## ✅ Verification
- [ ] Bug reproduced before fix
- [ ] Fix verified
- [ ] Tests prevent regression
- [ ] No side effects introduced

## 🧪 Testing
<!-- How did you test the fix? -->

## 📝 Checklist
{{checklist}}

## 🔗 Related Issues
<!-- Fixes #123 -->
`,

            'refactor.md': `# {{icon}} {{type}}: {{title}}

## ♻️ Refactoring Description
{{description}}

## 🎯 Goals
<!-- What are you improving? -->

## 🔧 Changes Made
{{changes}}

## ✅ Verification
- [ ] All tests still pass
- [ ] No behavior changes
- [ ] Performance maintained or improved
- [ ] Code more maintainable

## 📊 Code Quality Impact
<!-- How does this improve code quality? -->

## 📝 Checklist
{{checklist}}
`,

            'default.md': `# {{icon}} {{title}}

## Description
{{description}}

## Changes
{{changes}}

## Testing
<!-- How was this tested? -->

## Checklist
{{checklist}}
`
        };

        for (const [filename, content] of Object.entries(templates)) {
            const filePath = path.join(this.templatesDir, filename);
            await fs.writeFile(filePath, content, 'utf-8');
        }

        console.log(`   Created ${Object.keys(templates).length} default templates`);
    }

    /**
     * Determina template type dal branch name
     */
    detectTemplateType(branchName) {
        if (!branchName) return 'default';

        for (const [type, config] of Object.entries(this.templateTypes)) {
            for (const pattern of config.patterns) {
                if (branchName.startsWith(pattern)) {
                    return type;
                }
            }
        }

        return 'default';
    }

    /**
     * Carica template file
     */
    async loadTemplate(templateType) {
        const filename = `${templateType}.md`;
        const filePath = path.join(this.templatesDir, filename);

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return content;
        } catch {
            // Fallback to default template
            const defaultPath = path.join(this.templatesDir, 'default.md');
            try {
                return await fs.readFile(defaultPath, 'utf-8');
            } catch {
                // Fallback hardcoded
                return this.getHardcodedTemplate();
            }
        }
    }

    /**
     * Template hardcoded di emergenza
     */
    getHardcodedTemplate() {
        return `# {{title}}

## Description
{{description}}

## Changes
{{changes}}

## Checklist
{{checklist}}
`;
    }

    /**
     * Genera PR body automaticamente usando AI
     */
    async generatePRBody(options = {}) {
        const {
            branchName = null,
            baseBranch = 'main',
            title = null,
            templateType = null,
            includeReview = false,
            reviewData = null
        } = options;

        console.log('📝 Generating PR body...');

        try {
            // 1. Auto-detect template type se non specificato
            const currentBranch = branchName || this.gitManager.getCurrentBranch();
            const type = templateType || this.detectTemplateType(currentBranch);
            const typeConfig = this.templateTypes[type] || { name: 'Change', icon: '🔧', checklist: [] };

            // 2. Ottieni diff e log
            const diffData = await this.gitManager.getDiff({ branch: baseBranch });
            const logData = await this.gitManager.getLog({ limit: 20, branch: currentBranch });

            // 3. Estrai commit messages
            const commitMessages = logData.map(commit =>
                typeof commit === 'string' ? commit : commit.message
            ).join('\n');

            // 4. Genera description con AI
            const description = await this.generateDescription(
                diffData.diff,
                commitMessages,
                typeConfig.name
            );

            // 5. Genera changes summary
            const changesSummary = this.generateChangesSummary(diffData);

            // 6. Genera checklist
            const checklist = this.generateChecklist(typeConfig, diffData);

            // 7. Load template
            const template = await this.loadTemplate(type);

            // 8. Fill template variables
            const prBody = this.fillTemplate(template, {
                icon: typeConfig.icon,
                type: typeConfig.name,
                title: title || this.generateTitle(currentBranch, typeConfig),
                description: description,
                changes: changesSummary,
                checklist: checklist,
                branch: currentBranch,
                base: baseBranch,
                files: diffData.stats.files,
                additions: diffData.stats.additions,
                deletions: diffData.stats.deletions
            });

            // 9. Aggiungi code review se richiesto
            let finalBody = prBody;
            if (includeReview && reviewData) {
                finalBody += '\n\n---\n\n';
                finalBody += this.formatReviewInPR(reviewData);
            }

            console.log('✅ PR body generated');

            return {
                success: true,
                body: finalBody,
                title: title || this.generateTitle(currentBranch, typeConfig),
                type: type,
                template: template
            };

        } catch (error) {
            console.error('❌ Failed to generate PR body:', error);
            throw error;
        }
    }

    /**
     * Genera description usando AI
     */
    async generateDescription(diff, commits, prType) {
        const prompt = `You are creating a Pull Request description.

PR Type: ${prType}

Commit Messages:
${commits}

Git Diff (first 3000 chars):
\`\`\`diff
${diff.substring(0, 3000)}
\`\`\`

Generate a concise PR description (2-4 sentences) that:
1. Explains WHAT was changed
2. Explains WHY it was changed
3. Mentions key technical decisions if any

Keep it professional and clear. Do NOT include title, just the description paragraph.`;

        try {
            const response = await this.anthropic.messages.create({
                model: this.model,
                max_tokens: 500,
                temperature: 0.5,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            return response.content[0].text.trim();

        } catch (error) {
            console.warn('AI description generation failed:', error);
            // Fallback: usa i commit messages
            return commits.split('\n').slice(0, 3).join('\n');
        }
    }

    /**
     * Genera changes summary dal diff
     */
    generateChangesSummary(diffData) {
        const { files, stats } = diffData;

        if (files.length === 0) {
            return 'No changes';
        }

        let summary = `**${stats.files} file(s) changed** (+${stats.additions}/-${stats.deletions})\n\n`;

        // Raggruppa file per tipo di modifica
        const modified = files.filter(f => f.additions > 0 && f.deletions > 0);
        const added = files.filter(f => f.additions > 0 && f.deletions === 0);
        const deleted = files.filter(f => f.additions === 0 && f.deletions > 0);

        if (added.length > 0) {
            summary += `**Added:**\n`;
            for (const file of added.slice(0, 5)) {
                summary += `- \`${file.file}\` (+${file.additions})\n`;
            }
            if (added.length > 5) {
                summary += `- ... and ${added.length - 5} more\n`;
            }
            summary += '\n';
        }

        if (modified.length > 0) {
            summary += `**Modified:**\n`;
            for (const file of modified.slice(0, 5)) {
                summary += `- \`${file.file}\` (+${file.additions}/-${file.deletions})\n`;
            }
            if (modified.length > 5) {
                summary += `- ... and ${modified.length - 5} more\n`;
            }
            summary += '\n';
        }

        if (deleted.length > 0) {
            summary += `**Deleted:**\n`;
            for (const file of deleted.slice(0, 5)) {
                summary += `- \`${file.file}\` (-${file.deletions})\n`;
            }
            if (deleted.length > 5) {
                summary += `- ... and ${deleted.length - 5} more\n`;
            }
        }

        return summary.trim();
    }

    /**
     * Genera checklist
     */
    generateChecklist(typeConfig, diffData) {
        const items = typeConfig.checklist || [];

        let checklist = '';
        for (const item of items) {
            checklist += `- [ ] ${item}\n`;
        }

        // Aggiungi checklist comuni
        checklist += '- [ ] Code reviewed\n';

        if (diffData.stats.additions > 100) {
            checklist += '- [ ] Large change - extra review needed\n';
        }

        return checklist;
    }

    /**
     * Genera title da branch name
     */
    generateTitle(branchName, typeConfig) {
        // Rimuovi prefisso tipo feature/, bugfix/, etc.
        let title = branchName;
        for (const pattern of typeConfig.patterns || []) {
            if (title.startsWith(pattern)) {
                title = title.substring(pattern.length);
                break;
            }
        }

        // Converti kebab-case o snake_case in Title Case
        title = title
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        return title;
    }

    /**
     * Fill template con variabili
     */
    fillTemplate(template, variables) {
        let filled = template;

        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            filled = filled.replace(new RegExp(placeholder, 'g'), value);
        }

        // Rimuovi variabili non sostituite
        filled = filled.replace(/\{\{[^}]+\}\}/g, '');

        return filled;
    }

    /**
     * Formatta code review per PR body
     */
    formatReviewInPR(reviewData) {
        let section = '## 🔍 Code Review\n\n';

        section += `**Score:** ${reviewData.score.total}/100 (${reviewData.score.grade})\n\n`;

        if (reviewData.issues.length === 0) {
            section += '✅ No issues found\n';
            return section;
        }

        // Issues critici e high
        const critical = reviewData.issues.filter(i => i.severity === 'critical');
        const high = reviewData.issues.filter(i => i.severity === 'high');

        if (critical.length > 0) {
            section += `### 🔴 Critical Issues (${critical.length})\n\n`;
            for (const issue of critical.slice(0, 3)) {
                section += `- **${issue.title}**\n`;
                section += `  ${issue.file}:${issue.line}\n`;
                section += `  ${issue.description}\n\n`;
            }
        }

        if (high.length > 0) {
            section += `### 🟠 High Priority Issues (${high.length})\n\n`;
            for (const issue of high.slice(0, 3)) {
                section += `- **${issue.title}**\n`;
                section += `  ${issue.file}:${issue.line}\n\n`;
            }
        }

        // Link al full review
        if (reviewData.issues.length > 6) {
            section += `\n*... and ${reviewData.issues.length - 6} more issues. Run full code review for details.*\n`;
        }

        return section;
    }

    /**
     * Crea PR con template
     */
    async createPullRequest(options = {}) {
        const {
            title = null,
            base = 'main',
            head = null,
            draft = false,
            autoReview = false
        } = options;

        console.log('🚀 Creating Pull Request...');

        try {
            // 1. Genera PR body
            const bodyData = await this.generatePRBody({
                branchName: head,
                baseBranch: base,
                title: title
            });

            // 2. Opzionale: esegui code review
            let reviewData = null;
            if (autoReview) {
                console.log('Running code review...');
                // Assume we have access to CodeReviewer
                // This would be injected in real usage
            }

            // 3. Crea PR usando GitToolsManager
            const prResult = await this.gitManager.createPullRequest({
                title: bodyData.title,
                body: bodyData.body,
                base: base,
                head: head,
                draft: draft
            });

            console.log('✅ Pull Request created');

            return {
                success: true,
                url: prResult.url,
                title: bodyData.title,
                body: bodyData.body,
                type: bodyData.type
            };

        } catch (error) {
            console.error('❌ Failed to create PR:', error);
            throw error;
        }
    }

    /**
     * Salva custom template
     */
    async saveTemplate(templateName, content) {
        const filename = `${templateName}.md`;
        const filePath = path.join(this.templatesDir, filename);

        await fs.writeFile(filePath, content, 'utf-8');

        return {
            success: true,
            path: filePath
        };
    }

    /**
     * Lista template disponibili
     */
    async listTemplates() {
        try {
            const files = await fs.readdir(this.templatesDir);
            const templates = files
                .filter(f => f.endsWith('.md'))
                .map(f => f.replace('.md', ''));

            return templates;
        } catch {
            return ['default'];
        }
    }

    /**
     * Tool definitions per ClaudeService
     */
    getToolDefinitions() {
        return [
            {
                name: 'generate_pr_body',
                description: 'Genera automaticamente il body di una Pull Request con AI. Include description, changes, checklist. Può integrare code review.',
                input_schema: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            description: 'Titolo della PR (opzionale, auto-generato se non fornito)'
                        },
                        base_branch: {
                            type: 'string',
                            description: 'Branch base per confronto (default: "main")',
                            default: 'main'
                        },
                        template_type: {
                            type: 'string',
                            enum: ['feature', 'bugfix', 'refactor', 'docs', 'performance', 'test', 'default'],
                            description: 'Tipo di template (auto-detect se non specificato)'
                        },
                        include_review: {
                            type: 'boolean',
                            description: 'Include code review nel PR body (default: false)'
                        }
                    }
                }
            },
            {
                name: 'create_pr_with_template',
                description: 'Crea Pull Request completa con template, auto-generated body, e optional code review.',
                input_schema: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            description: 'Titolo PR (opzionale)'
                        },
                        base: {
                            type: 'string',
                            description: 'Branch base (default: "main")',
                            default: 'main'
                        },
                        head: {
                            type: 'string',
                            description: 'Branch head (opzionale, usa current)'
                        },
                        draft: {
                            type: 'boolean',
                            description: 'Crea come draft PR (default: false)'
                        },
                        auto_review: {
                            type: 'boolean',
                            description: 'Esegui code review automatico (default: false)'
                        }
                    }
                }
            },
            {
                name: 'list_pr_templates',
                description: 'Lista tutti i template PR disponibili in .claude/pr-templates/',
                input_schema: {
                    type: 'object',
                    properties: {}
                }
            }
        ];
    }

    /**
     * Esegui tool
     */
    async executeTool(toolName, toolInput) {
        switch (toolName) {
            case 'generate_pr_body':
                return await this.generatePRBody({
                    title: toolInput.title,
                    baseBranch: toolInput.base_branch,
                    templateType: toolInput.template_type,
                    includeReview: toolInput.include_review
                });

            case 'create_pr_with_template':
                return await this.createPullRequest({
                    title: toolInput.title,
                    base: toolInput.base,
                    head: toolInput.head,
                    draft: toolInput.draft,
                    autoReview: toolInput.auto_review
                });

            case 'list_pr_templates':
                return await this.listTemplates();

            default:
                throw new Error(`Unknown PR template tool: ${toolName}`);
        }
    }
}

module.exports = PRTemplateManager;
