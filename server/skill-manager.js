/**
 * SkillManager
 *
 * Gestisce le Agent Skills seguendo lo standard agentskills.io
 * - Carica skills da .claude/skills/
 * - Parsing YAML frontmatter + Markdown body
 * - Progressive disclosure (metadata → full content → resources)
 * - Validazione secondo spec agentskills.io
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class SkillManager {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.skillsDir = path.join(workspaceRoot, '.claude', 'skills');
        this.skills = new Map(); // Map<skillName, skillData>
        this.loaded = false;
    }

    /**
     * Inizializza il manager caricando tutte le skills
     */
    async initialize() {
        console.log('🎯 SkillManager: Initializing...');

        try {
            // Verifica che la directory skills esista
            await fs.mkdir(this.skillsDir, { recursive: true });

            // Carica tutte le skills
            await this.loadAllSkills();

            this.loaded = true;
            console.log(`✅ SkillManager: Loaded ${this.skills.size} skills`);

        } catch (error) {
            console.error('❌ SkillManager initialization error:', error);
            this.loaded = false;
        }
    }

    /**
     * Carica tutte le skills dalla directory
     */
    async loadAllSkills() {
        try {
            const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    await this.loadSkill(entry.name);
                }
            }

        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            // Directory non esiste ancora, va bene
        }
    }

    /**
     * Carica una singola skill
     */
    async loadSkill(skillName) {
        const skillPath = path.join(this.skillsDir, skillName);
        const skillFile = path.join(skillPath, 'SKILL.md');

        try {
            const content = await fs.readFile(skillFile, 'utf-8');
            const parsed = this.parseSkillFile(content);

            // Validazione secondo agentskills.io spec
            this.validateSkill(skillName, parsed);

            // Salva la skill
            this.skills.set(skillName, {
                name: skillName,
                path: skillPath,
                ...parsed,
                loadedAt: new Date()
            });

            console.log(`  ✓ Loaded skill: ${skillName}`);

        } catch (error) {
            console.error(`  ✗ Failed to load skill '${skillName}':`, error.message);
        }
    }

    /**
     * Parsing del file SKILL.md
     * Formato: YAML frontmatter + Markdown body
     */
    parseSkillFile(content) {
        // Estrai frontmatter YAML
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
        const match = content.match(frontmatterRegex);

        if (!match) {
            throw new Error('Invalid SKILL.md format: missing YAML frontmatter');
        }

        const [, yamlContent, markdownBody] = match;

        // Parse YAML (simple implementation)
        const frontmatter = this.parseYAML(yamlContent);

        return {
            frontmatter,
            body: markdownBody.trim(),
            fullContent: content
        };
    }

    /**
     * Simple YAML parser per frontmatter
     */
    parseYAML(yamlText) {
        const result = {};
        const lines = yamlText.trim().split('\n');

        for (const line of lines) {
            const match = line.match(/^(\w+):\s*(.+)$/);
            if (match) {
                const [, key, value] = match;
                // Remove quotes if present
                result[key] = value.replace(/^["']|["']$/g, '').trim();
            }
        }

        return result;
    }

    /**
     * Validazione skill secondo spec agentskills.io
     */
    validateSkill(skillName, parsed) {
        const { frontmatter } = parsed;

        // Required fields
        if (!frontmatter.name) {
            throw new Error('Missing required field: name');
        }

        if (!frontmatter.description) {
            throw new Error('Missing required field: description');
        }

        // Name validation
        const nameRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (!nameRegex.test(frontmatter.name)) {
            throw new Error('Invalid name: must be lowercase alphanumerics and hyphens only');
        }

        if (frontmatter.name.length < 1 || frontmatter.name.length > 64) {
            throw new Error('Invalid name: must be 1-64 characters');
        }

        // Name must match directory name
        if (frontmatter.name !== skillName) {
            throw new Error(`Skill name '${frontmatter.name}' must match directory name '${skillName}'`);
        }

        // Description validation
        if (frontmatter.description.length < 1 || frontmatter.description.length > 1024) {
            throw new Error('Invalid description: must be 1-1024 characters');
        }
    }

    /**
     * Ottieni metadata di tutte le skills (per system prompt)
     * Progressive disclosure: solo name + description (~100 tokens per skill)
     */
    getSkillsMetadata() {
        const metadata = [];

        for (const [name, skill] of this.skills) {
            metadata.push({
                name: skill.frontmatter.name,
                description: skill.frontmatter.description
            });
        }

        return metadata;
    }

    /**
     * Ottieni il contenuto completo di una skill
     * Chiamato quando la skill viene invocata
     */
    getSkillContent(skillName) {
        const skill = this.skills.get(skillName);

        if (!skill) {
            throw new Error(`Skill '${skillName}' not found`);
        }

        return {
            name: skill.frontmatter.name,
            description: skill.frontmatter.description,
            instructions: skill.body,
            metadata: skill.frontmatter.metadata || {},
            compatibility: skill.frontmatter.compatibility || null,
            license: skill.frontmatter.license || null,
            allowedTools: skill.frontmatter['allowed-tools']?.split(' ') || []
        };
    }

    /**
     * Leggi un file di riferimento dalla skill
     * Es: references/REFERENCE.md
     */
    async getSkillReference(skillName, referencePath) {
        const skill = this.skills.get(skillName);

        if (!skill) {
            throw new Error(`Skill '${skillName}' not found`);
        }

        const refFile = path.join(skill.path, referencePath);

        try {
            const content = await fs.readFile(refFile, 'utf-8');
            return content;
        } catch (error) {
            throw new Error(`Reference file '${referencePath}' not found in skill '${skillName}'`);
        }
    }

    /**
     * Esegui uno script dalla skill
     * Es: scripts/process.py
     */
    async executeSkillScript(skillName, scriptPath, args = []) {
        const skill = this.skills.get(skillName);

        if (!skill) {
            throw new Error(`Skill '${skillName}' not found`);
        }

        const scriptFile = path.join(skill.path, scriptPath);

        try {
            // Verifica che il file esista
            await fs.access(scriptFile);

            // Determina l'esecutore in base all'estensione
            const ext = path.extname(scriptFile);
            let executor = '';

            switch (ext) {
                case '.py':
                    executor = 'python3';
                    break;
                case '.js':
                    executor = 'node';
                    break;
                case '.sh':
                    executor = 'bash';
                    break;
                default:
                    throw new Error(`Unsupported script type: ${ext}`);
            }

            // Esegui lo script
            const command = `${executor} "${scriptFile}" ${args.join(' ')}`;
            const output = execSync(command, {
                cwd: skill.path,
                encoding: 'utf-8',
                maxBuffer: 10 * 1024 * 1024 // 10MB
            });

            return {
                success: true,
                output: output.trim()
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                stderr: error.stderr?.toString() || ''
            };
        }
    }

    /**
     * Ricarica tutte le skills
     */
    async reload() {
        console.log('🔄 SkillManager: Reloading skills...');
        this.skills.clear();
        await this.loadAllSkills();
        console.log(`✅ SkillManager: Reloaded ${this.skills.size} skills`);
    }

    /**
     * Ottieni lista di tutte le skills
     */
    listSkills() {
        return Array.from(this.skills.values()).map(skill => ({
            name: skill.frontmatter.name,
            description: skill.frontmatter.description,
            compatibility: skill.frontmatter.compatibility || null,
            license: skill.frontmatter.license || null
        }));
    }
}

module.exports = SkillManager;
