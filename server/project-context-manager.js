const fs = require('fs').promises;
const path = require('path');

/**
 * Project Context Manager
 *
 * Gestisce il file .claude/project.json che contiene:
 * - Instructions: Istruzioni specifiche del progetto
 * - Preferences: Preferenze di sviluppo (framework, style, ecc.)
 * - Standards: Standard di codifica da seguire
 * - Custom fields: Campi personalizzati dall'utente
 *
 * Simile al Project Context di Claude Code
 */
class ProjectContextManager {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.claudeDir = path.join(workspaceRoot, '.claude');
        this.projectFile = path.join(this.claudeDir, 'project.json');
        this.defaultContext = {
            instructions: '',
            preferences: {},
            standards: {},
            metadata: {
                created: new Date().toISOString(),
                updated: new Date().toISOString()
            }
        };
    }

    /**
     * Inizializza il project context
     * Crea .claude/ directory e project.json se non esistono
     */
    async initialize() {
        try {
            // Assicurati che .claude/ esista
            try {
                await fs.access(this.claudeDir);
            } catch {
                await fs.mkdir(this.claudeDir, { recursive: true });
                console.log('✅ Created .claude/ directory');
            }

            // Carica o crea project.json
            await this.loadOrCreateProjectContext();

        } catch (error) {
            console.error('❌ ProjectContextManager initialization failed:', error);
            throw error;
        }
    }

    /**
     * Carica project.json o crea uno di default
     */
    async loadOrCreateProjectContext() {
        try {
            await fs.access(this.projectFile);
            // File esiste, caricalo
            const content = await fs.readFile(this.projectFile, 'utf-8');
            const context = JSON.parse(content);
            console.log('✅ Loaded project context from .claude/project.json');
            return context;
        } catch {
            // File non esiste, crealo con defaults
            await this.saveProjectContext(this.defaultContext);
            console.log('✅ Created default project context');
            return this.defaultContext;
        }
    }

    /**
     * Ottieni il project context corrente
     */
    async getProjectContext() {
        try {
            const content = await fs.readFile(this.projectFile, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.warn('⚠️ Could not read project context, using defaults');
            return this.defaultContext;
        }
    }

    /**
     * Salva il project context
     */
    async saveProjectContext(context) {
        try {
            // Aggiorna timestamp
            const updatedContext = {
                ...context,
                metadata: {
                    ...context.metadata,
                    updated: new Date().toISOString()
                }
            };

            // Salva con formattazione bella
            await fs.writeFile(
                this.projectFile,
                JSON.stringify(updatedContext, null, 2),
                'utf-8'
            );

            console.log('✅ Saved project context to .claude/project.json');
            return updatedContext;
        } catch (error) {
            console.error('❌ Failed to save project context:', error);
            throw error;
        }
    }

    /**
     * Aggiorna il project context (merge con esistente)
     */
    async updateProjectContext(updates) {
        try {
            const current = await this.getProjectContext();

            const updated = {
                ...current,
                instructions: updates.instructions !== undefined ? updates.instructions : current.instructions,
                preferences: updates.preferences !== undefined ?
                    { ...current.preferences, ...updates.preferences } :
                    current.preferences,
                standards: updates.standards !== undefined ?
                    { ...current.standards, ...updates.standards } :
                    current.standards
            };

            return await this.saveProjectContext(updated);
        } catch (error) {
            console.error('❌ Failed to update project context:', error);
            throw error;
        }
    }

    /**
     * Genera il testo da iniettare nel system prompt
     * Formatta il project context in modo leggibile per Claude
     */
    async getSystemPromptAddition() {
        try {
            const context = await this.getProjectContext();

            // Se non ci sono dati significativi, ritorna stringa vuota
            if (!context.instructions &&
                Object.keys(context.preferences || {}).length === 0 &&
                Object.keys(context.standards || {}).length === 0) {
                return '';
            }

            let prompt = '\n\n## 📋 Project Context\n\n';

            // Instructions
            if (context.instructions && context.instructions.trim()) {
                prompt += '### Project Instructions\n';
                prompt += context.instructions.trim() + '\n\n';
            }

            // Preferences
            if (context.preferences && Object.keys(context.preferences).length > 0) {
                prompt += '### Development Preferences\n';
                for (const [key, value] of Object.entries(context.preferences)) {
                    if (value) {
                        prompt += `- **${this.formatKey(key)}**: ${value}\n`;
                    }
                }
                prompt += '\n';
            }

            // Standards
            if (context.standards && Object.keys(context.standards).length > 0) {
                prompt += '### Coding Standards\n';
                for (const [key, value] of Object.entries(context.standards)) {
                    if (value) {
                        prompt += `- **${this.formatKey(key)}**: ${value}\n`;
                    }
                }
                prompt += '\n';
            }

            return prompt;

        } catch (error) {
            console.error('⚠️ Failed to generate system prompt addition:', error);
            return '';
        }
    }

    /**
     * Formatta chiave da camelCase a Title Case
     */
    formatKey(key) {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    /**
     * Reset project context ai defaults
     */
    async resetProjectContext() {
        return await this.saveProjectContext(this.defaultContext);
    }

    /**
     * Esporta project context
     */
    async exportProjectContext() {
        const context = await this.getProjectContext();
        return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            workspaceRoot: this.workspaceRoot,
            context: context
        };
    }

    /**
     * Importa project context
     */
    async importProjectContext(exportedData) {
        if (!exportedData.context) {
            throw new Error('Invalid export data: missing context');
        }

        // Preserva metadata corrente
        const current = await this.getProjectContext();
        const imported = {
            ...exportedData.context,
            metadata: {
                ...current.metadata,
                imported: new Date().toISOString(),
                importedFrom: exportedData.workspaceRoot || 'unknown'
            }
        };

        return await this.saveProjectContext(imported);
    }

    /**
     * Ottieni template comuni per quick setup
     */
    getTemplates() {
        return {
            react: {
                instructions: 'This is a React 18 project using TypeScript and modern hooks.',
                preferences: {
                    framework: 'React 18',
                    language: 'TypeScript',
                    componentStyle: 'Functional components with hooks',
                    stateManagement: 'React Context + useReducer',
                    testFramework: 'Jest + React Testing Library',
                    styling: 'CSS Modules'
                },
                standards: {
                    naming: 'PascalCase for components, camelCase for functions',
                    fileStructure: 'Feature-based folder structure',
                    testing: 'Write unit tests for all components',
                    comments: 'JSDoc comments for public APIs'
                }
            },
            vue: {
                instructions: 'This is a Vue 3 project using Composition API and TypeScript.',
                preferences: {
                    framework: 'Vue 3',
                    language: 'TypeScript',
                    componentStyle: 'Composition API with <script setup>',
                    stateManagement: 'Pinia',
                    testFramework: 'Vitest',
                    styling: 'SCSS'
                },
                standards: {
                    naming: 'PascalCase for components, kebab-case for files',
                    fileStructure: 'Feature-based with composables',
                    testing: 'Unit tests for composables and components',
                    comments: 'TSDoc for TypeScript code'
                }
            },
            nodejs: {
                instructions: 'This is a Node.js backend project using Express and TypeScript.',
                preferences: {
                    framework: 'Express.js',
                    language: 'TypeScript',
                    database: 'PostgreSQL',
                    orm: 'Prisma',
                    testFramework: 'Jest',
                    apiStyle: 'RESTful'
                },
                standards: {
                    naming: 'camelCase for variables, PascalCase for classes',
                    fileStructure: 'Layered architecture (routes/controllers/services)',
                    testing: 'Unit + integration tests',
                    errorHandling: 'Centralized error middleware',
                    logging: 'Winston for structured logging'
                }
            },
            python: {
                instructions: 'This is a Python project following PEP 8 standards.',
                preferences: {
                    version: 'Python 3.10+',
                    framework: 'FastAPI',
                    database: 'PostgreSQL',
                    orm: 'SQLAlchemy',
                    testFramework: 'pytest',
                    typing: 'Type hints everywhere'
                },
                standards: {
                    naming: 'snake_case for functions and variables, PascalCase for classes',
                    fileStructure: 'Package-based with clear separation',
                    testing: 'pytest with fixtures and parametrize',
                    documentation: 'Docstrings following Google style',
                    formatting: 'Black for code formatting'
                }
            },
            fullstack: {
                instructions: 'This is a full-stack monorepo with React frontend and Node.js backend.',
                preferences: {
                    frontend: 'React 18 + TypeScript',
                    backend: 'Node.js + Express + TypeScript',
                    database: 'PostgreSQL',
                    monorepo: 'npm workspaces',
                    testFramework: 'Jest',
                    styling: 'Tailwind CSS'
                },
                standards: {
                    naming: 'Consistent across frontend and backend',
                    fileStructure: 'apps/ and packages/ structure',
                    testing: 'E2E with Playwright, unit tests everywhere',
                    apiContract: 'OpenAPI spec for API documentation',
                    sharedCode: 'Shared types in packages/types'
                }
            }
        };
    }

    /**
     * Applica un template al project context
     */
    async applyTemplate(templateName) {
        const templates = this.getTemplates();
        const template = templates[templateName];

        if (!template) {
            throw new Error(`Template "${templateName}" not found`);
        }

        return await this.saveProjectContext({
            ...template,
            metadata: {
                created: new Date().toISOString(),
                updated: new Date().toISOString(),
                template: templateName
            }
        });
    }
}

module.exports = ProjectContextManager;
