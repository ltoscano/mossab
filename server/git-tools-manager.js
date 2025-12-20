const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * Git Tools Manager
 *
 * Gestisce operazioni Git avanzate con tool dedicati (non solo bash).
 * Include: status, diff, commit, push, PR creation, branch management.
 *
 * Usa 'gh' CLI per GitHub operations.
 */
class GitToolsManager {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.isGitRepo = false;
        this.currentBranch = null;
        this.remoteName = 'origin';
    }

    /**
     * Inizializza e verifica che sia un repo git
     */
    async initialize() {
        try {
            // Check if git repo
            execSync('git rev-parse --git-dir', {
                cwd: this.workspaceRoot,
                stdio: 'pipe'
            });
            this.isGitRepo = true;

            // Get current branch
            this.currentBranch = this.getCurrentBranch();

            console.log('✅ GitToolsManager initialized');
            console.log(`   Current branch: ${this.currentBranch}`);
        } catch (error) {
            console.warn('⚠️ Not a git repository');
            this.isGitRepo = false;
        }
    }

    /**
     * Esegue comando git e ritorna output
     */
    execGit(command, options = {}) {
        if (!this.isGitRepo && !options.allowNonRepo) {
            throw new Error('Not a git repository');
        }

        try {
            const output = execSync(`git ${command}`, {
                cwd: this.workspaceRoot,
                encoding: 'utf-8',
                ...options
            });
            return output.trim();
        } catch (error) {
            throw new Error(`Git command failed: ${error.message}`);
        }
    }

    /**
     * Ottieni branch corrente
     */
    getCurrentBranch() {
        try {
            return this.execGit('branch --show-current');
        } catch {
            return 'unknown';
        }
    }

    /**
     * Git status con parsing intelligente
     */
    async getStatus() {
        const output = this.execGit('status --porcelain');
        const lines = output.split('\n').filter(l => l.trim());

        const status = {
            branch: this.getCurrentBranch(),
            staged: [],
            unstaged: [],
            untracked: [],
            conflicts: [],
            clean: lines.length === 0
        };

        for (const line of lines) {
            const statusCode = line.substring(0, 2);
            const file = line.substring(3);

            if (statusCode.includes('U') || statusCode.includes('A') && statusCode.includes('A')) {
                status.conflicts.push(file);
            } else if (statusCode[0] !== ' ' && statusCode[0] !== '?') {
                status.staged.push({ file, status: statusCode[0] });
            } else if (statusCode[1] !== ' ') {
                status.unstaged.push({ file, status: statusCode[1] });
            } else if (statusCode === '??') {
                status.untracked.push(file);
            }
        }

        return status;
    }

    /**
     * Git diff con opzioni avanzate
     */
    async getDiff(options = {}) {
        const {
            staged = false,
            files = null,
            branch = null,
            contextLines = 3
        } = options;

        let command = `diff -U${contextLines}`;

        if (staged) {
            command += ' --staged';
        }

        if (branch) {
            command += ` ${branch}`;
        }

        if (files && files.length > 0) {
            command += ` -- ${files.join(' ')}`;
        }

        const diff = this.execGit(command);

        return {
            diff: diff,
            stats: this.getDiffStats(diff),
            files: this.parseDiffFiles(diff)
        };
    }

    /**
     * Parse diff per ottenere stats
     */
    getDiffStats(diff) {
        if (!diff) return { additions: 0, deletions: 0, files: 0 };

        const lines = diff.split('\n');
        let additions = 0;
        let deletions = 0;
        const files = new Set();

        for (const line of lines) {
            if (line.startsWith('+++') || line.startsWith('---')) {
                const file = line.substring(6);
                if (file !== '/dev/null') {
                    files.add(file);
                }
            } else if (line.startsWith('+') && !line.startsWith('+++')) {
                additions++;
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                deletions++;
            }
        }

        return { additions, deletions, files: files.size };
    }

    /**
     * Parse diff per file
     */
    parseDiffFiles(diff) {
        const files = [];
        const chunks = diff.split('diff --git');

        for (const chunk of chunks.slice(1)) {
            const lines = chunk.split('\n');
            const header = lines[0];
            const match = header.match(/a\/(.+) b\/(.+)/);

            if (match) {
                files.push({
                    file: match[2],
                    additions: chunk.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).length,
                    deletions: chunk.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---')).length
                });
            }
        }

        return files;
    }

    /**
     * Git log con formattazione
     */
    async getLog(options = {}) {
        const {
            limit = 10,
            branch = null,
            format = 'default'
        } = options;

        const formatStr = format === 'oneline'
            ? '--oneline'
            : '--format=%H|%an|%ae|%at|%s';

        let command = `log ${formatStr} -${limit}`;

        if (branch) {
            command += ` ${branch}`;
        }

        const output = this.execGit(command);
        const lines = output.split('\n').filter(l => l.trim());

        if (format === 'oneline') {
            return lines;
        }

        return lines.map(line => {
            const [hash, author, email, timestamp, message] = line.split('|');
            return {
                hash,
                author,
                email,
                date: new Date(parseInt(timestamp) * 1000),
                message
            };
        });
    }

    /**
     * Crea commit
     */
    async commit(message, options = {}) {
        const {
            files = [],
            all = false,
            amend = false
        } = options;

        // Stage files se specificati
        if (files.length > 0) {
            this.execGit(`add ${files.join(' ')}`);
        } else if (all) {
            this.execGit('add -A');
        }

        // Commit
        let command = 'commit -m ' + this.escapeShellArg(message);

        if (amend) {
            command += ' --amend';
        }

        const output = this.execGit(command);

        return {
            success: true,
            message: output,
            hash: this.execGit('rev-parse HEAD')
        };
    }

    /**
     * Push al remote
     */
    async push(options = {}) {
        const {
            branch = null,
            force = false,
            setUpstream = false
        } = options;

        let command = 'push';

        if (setUpstream) {
            command += ' -u origin';
        }

        if (branch) {
            command += ` ${this.remoteName} ${branch}`;
        }

        if (force) {
            command += ' --force';
        }

        const output = this.execGit(command);

        return {
            success: true,
            message: output
        };
    }

    /**
     * Crea branch
     */
    async createBranch(branchName, options = {}) {
        const {
            checkout = true,
            from = null
        } = options;

        let command = `branch ${branchName}`;

        if (from) {
            command += ` ${from}`;
        }

        this.execGit(command);

        if (checkout) {
            this.execGit(`checkout ${branchName}`);
            this.currentBranch = branchName;
        }

        return {
            success: true,
            branch: branchName
        };
    }

    /**
     * Crea Pull Request usando gh CLI
     */
    async createPullRequest(options = {}) {
        const {
            title,
            body = '',
            base = 'main',
            head = null,
            draft = false,
            labels = []
        } = options;

        if (!title) {
            throw new Error('PR title is required');
        }

        // Check if gh is installed
        try {
            execSync('gh --version', { stdio: 'pipe' });
        } catch {
            throw new Error('GitHub CLI (gh) is not installed');
        }

        let command = `gh pr create --title ${this.escapeShellArg(title)} --body ${this.escapeShellArg(body)} --base ${base}`;

        if (head) {
            command += ` --head ${head}`;
        }

        if (draft) {
            command += ' --draft';
        }

        if (labels.length > 0) {
            command += ` --label ${labels.join(',')}`;
        }

        const output = execSync(command, {
            cwd: this.workspaceRoot,
            encoding: 'utf-8'
        });

        // Extract PR URL from output
        const urlMatch = output.match(/https:\/\/github\.com\/[^\s]+/);

        return {
            success: true,
            url: urlMatch ? urlMatch[0] : null,
            output: output.trim()
        };
    }

    /**
     * Lista PRs usando gh CLI
     */
    async listPullRequests(options = {}) {
        const {
            state = 'open',
            limit = 10
        } = options;

        try {
            execSync('gh --version', { stdio: 'pipe' });
        } catch {
            throw new Error('GitHub CLI (gh) is not installed');
        }

        const output = execSync(
            `gh pr list --state ${state} --limit ${limit} --json number,title,author,createdAt,url,headRefName`,
            {
                cwd: this.workspaceRoot,
                encoding: 'utf-8'
            }
        );

        return JSON.parse(output);
    }

    /**
     * Ottieni info su una PR specifica
     */
    async getPullRequest(prNumber) {
        try {
            execSync('gh --version', { stdio: 'pipe' });
        } catch {
            throw new Error('GitHub CLI (gh) is not installed');
        }

        const output = execSync(
            `gh pr view ${prNumber} --json number,title,body,author,state,createdAt,updatedAt,url,headRefName,baseRefName,additions,deletions,changedFiles`,
            {
                cwd: this.workspaceRoot,
                encoding: 'utf-8'
            }
        );

        return JSON.parse(output);
    }

    /**
     * Ottieni diff di una PR
     */
    async getPullRequestDiff(prNumber) {
        try {
            execSync('gh --version', { stdio: 'pipe' });
        } catch {
            throw new Error('GitHub CLI (gh) is not installed');
        }

        const diff = execSync(
            `gh pr diff ${prNumber}`,
            {
                cwd: this.workspaceRoot,
                encoding: 'utf-8'
            }
        );

        return {
            diff: diff,
            stats: this.getDiffStats(diff),
            files: this.parseDiffFiles(diff)
        };
    }

    /**
     * Escape shell argument
     */
    escapeShellArg(arg) {
        return `"${arg.replace(/"/g, '\\"')}"`;
    }

    /**
     * Tool definitions per ClaudeService
     */
    getToolDefinitions() {
        return [
            {
                name: 'git_status',
                description: 'Ottieni lo stato corrente del repository Git. Mostra file staged, unstaged, untracked e conflicts.',
                input_schema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'git_diff',
                description: 'Ottieni il diff delle modifiche. Puoi specificare se vedere staged changes, specifici file, o confronto con un branch.',
                input_schema: {
                    type: 'object',
                    properties: {
                        staged: {
                            type: 'boolean',
                            description: 'Se true, mostra solo staged changes (default: false)'
                        },
                        files: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Lista di file specifici da includere nel diff (opzionale)'
                        },
                        branch: {
                            type: 'string',
                            description: 'Branch con cui confrontare (es: "main", "develop")'
                        }
                    }
                }
            },
            {
                name: 'git_log',
                description: 'Ottieni la history dei commit. Utile per vedere commit recenti e i loro messaggi.',
                input_schema: {
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'number',
                            description: 'Numero di commit da mostrare (default: 10)'
                        },
                        branch: {
                            type: 'string',
                            description: 'Branch specifico (opzionale, default: current)'
                        }
                    }
                }
            },
            {
                name: 'git_create_pr',
                description: 'Crea una Pull Request su GitHub. Richiede GitHub CLI (gh) installato e autenticato.',
                input_schema: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            description: 'Titolo della PR (obbligatorio)'
                        },
                        body: {
                            type: 'string',
                            description: 'Descrizione/body della PR (opzionale)'
                        },
                        base: {
                            type: 'string',
                            description: 'Branch base (default: "main")',
                            default: 'main'
                        },
                        draft: {
                            type: 'boolean',
                            description: 'Se true, crea come draft PR (default: false)'
                        }
                    },
                    required: ['title']
                }
            },
            {
                name: 'git_list_prs',
                description: 'Lista le Pull Requests del repository. Richiede GitHub CLI (gh).',
                input_schema: {
                    type: 'object',
                    properties: {
                        state: {
                            type: 'string',
                            enum: ['open', 'closed', 'merged', 'all'],
                            description: 'Stato delle PR da listare (default: "open")',
                            default: 'open'
                        },
                        limit: {
                            type: 'number',
                            description: 'Numero massimo di PR da mostrare (default: 10)'
                        }
                    }
                }
            },
            {
                name: 'git_view_pr',
                description: 'Visualizza dettagli di una Pull Request specifica. Richiede GitHub CLI (gh).',
                input_schema: {
                    type: 'object',
                    properties: {
                        pr_number: {
                            type: 'number',
                            description: 'Numero della PR da visualizzare'
                        }
                    },
                    required: ['pr_number']
                }
            }
        ];
    }

    /**
     * Esegui un tool git
     */
    async executeTool(toolName, toolInput) {
        switch (toolName) {
            case 'git_status':
                return await this.getStatus();

            case 'git_diff':
                return await this.getDiff(toolInput);

            case 'git_log':
                return await this.getLog(toolInput);

            case 'git_create_pr':
                return await this.createPullRequest(toolInput);

            case 'git_list_prs':
                return await this.listPullRequests(toolInput);

            case 'git_view_pr':
                return await this.getPullRequest(toolInput.pr_number);

            default:
                throw new Error(`Unknown git tool: ${toolName}`);
        }
    }
}

module.exports = GitToolsManager;
