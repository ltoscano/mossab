const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * Filesystem Tools - Implementa i tool che Claude Code usa per operare su file
 *
 * Questi tool permettono a Mossab di:
 * - Leggere e scrivere file
 * - Cercare file e contenuti
 * - Eseguire comandi
 * - Gestire TODO
 */
class FilesystemTools {
    constructor(workspaceRoot = process.cwd()) {
        this.workspaceRoot = workspaceRoot;
        this.todos = []; // TODO list in-memory
    }

    /**
     * Definizione dei tool disponibili per Claude
     */
    getToolDefinitions() {
        return [
            {
                name: 'read_file',
                description: 'Legge il contenuto di un file con numeri di riga. Supporta lettura parziale per file grandi. Usa questo tool quando devi esaminare codice esistente, leggere configurazioni, o analizzare file.',
                input_schema: {
                    type: 'object',
                    properties: {
                        file_path: {
                            type: 'string',
                            description: 'Path del file da leggere (relativo al workspace)'
                        },
                        offset: {
                            type: 'number',
                            description: 'Numero di riga da cui iniziare (0-indexed). Ometti per leggere dall\'inizio.'
                        },
                        limit: {
                            type: 'number',
                            description: 'Numero massimo di righe da leggere. Ometti per leggere tutto il file. Usa questo per file grandi (es: limit=100 per prime 100 righe).'
                        }
                    },
                    required: ['file_path']
                }
            },
            {
                name: 'write_file',
                description: 'Scrive contenuto in un file. Usa questo per creare nuovi file o sovrascrivere completamente file esistenti.',
                input_schema: {
                    type: 'object',
                    properties: {
                        file_path: {
                            type: 'string',
                            description: 'Path del file da scrivere'
                        },
                        content: {
                            type: 'string',
                            description: 'Contenuto da scrivere nel file'
                        }
                    },
                    required: ['file_path', 'content']
                }
            },
            {
                name: 'edit_file',
                description: 'Modifica un file esistente sostituendo una stringa con un\'altra. Perfetto per modifiche mirate senza riscrivere tutto il file.',
                input_schema: {
                    type: 'object',
                    properties: {
                        file_path: {
                            type: 'string',
                            description: 'Path del file da modificare'
                        },
                        old_string: {
                            type: 'string',
                            description: 'Stringa da sostituire (deve essere esatta)'
                        },
                        new_string: {
                            type: 'string',
                            description: 'Nuova stringa'
                        }
                    },
                    required: ['file_path', 'old_string', 'new_string']
                }
            },
            {
                name: 'glob',
                description: 'Cerca file per pattern. Usa questo per trovare file con nomi specifici o estensioni. Es: "**/*.js" trova tutti i file JS.',
                input_schema: {
                    type: 'object',
                    properties: {
                        pattern: {
                            type: 'string',
                            description: 'Pattern glob (es: **/*.js, src/**/*.tsx)'
                        }
                    },
                    required: ['pattern']
                }
            },
            {
                name: 'grep',
                description: 'Cerca contenuto nei file usando regex. Usa questo per trovare dove è usata una funzione, variabile, o pattern specifico nel codice.',
                input_schema: {
                    type: 'object',
                    properties: {
                        pattern: {
                            type: 'string',
                            description: 'Pattern regex da cercare'
                        },
                        path: {
                            type: 'string',
                            description: 'Path dove cercare (opzionale, default: workspace root)'
                        },
                        file_pattern: {
                            type: 'string',
                            description: 'Pattern per filtrare file (es: *.js)'
                        }
                    },
                    required: ['pattern']
                }
            },
            {
                name: 'bash',
                description: 'Esegue un comando bash. Usa questo per npm install, git operations, build, test, ecc. IMPORTANTE: non usare comandi interattivi.',
                input_schema: {
                    type: 'object',
                    properties: {
                        command: {
                            type: 'string',
                            description: 'Comando da eseguire'
                        },
                        cwd: {
                            type: 'string',
                            description: 'Working directory (opzionale)'
                        }
                    },
                    required: ['command']
                }
            },
            {
                name: 'todo_write',
                description: 'Crea o aggiorna la lista TODO. Usa questo per trackare il progresso di task complessi. CRITICAL: usa questo tool frequentemente per dare visibilità all\'utente!',
                input_schema: {
                    type: 'object',
                    properties: {
                        todos: {
                            type: 'array',
                            description: 'Array di TODO items',
                            items: {
                                type: 'object',
                                properties: {
                                    content: {
                                        type: 'string',
                                        description: 'Descrizione del task (imperativo: "Implementa X")'
                                    },
                                    activeForm: {
                                        type: 'string',
                                        description: 'Forma attiva (presente continuo: "Implementando X")'
                                    },
                                    status: {
                                        type: 'string',
                                        enum: ['pending', 'in_progress', 'completed'],
                                        description: 'Stato del task'
                                    }
                                },
                                required: ['content', 'activeForm', 'status']
                            }
                        }
                    },
                    required: ['todos']
                }
            }
        ];

        // Conditionally add multi_edit tool if enabled
        if (process.env.ENABLE_MULTI_EDIT === 'true') {
            tools.push({
                name: 'multi_edit',
                description: '🔥 ATOMIC multi-file editing. Modifica multipli file in una transazione all-or-nothing con automatic rollback. Perfetto per refactoring cross-file (rename functions, update imports, restructure code). Se una edit fallisce, TUTTE vengono automaticamente annullate (rollback). Molto più sicuro che edit_file multipli.',
                input_schema: {
                    type: 'object',
                    properties: {
                        edits: {
                            type: 'array',
                            description: 'Array di modifiche da applicare atomicamente',
                            items: {
                                type: 'object',
                                properties: {
                                    file_path: {
                                        type: 'string',
                                        description: 'Path del file da modificare (relativo al workspace)'
                                    },
                                    old_string: {
                                        type: 'string',
                                        description: 'Stringa da sostituire (deve esistere esattamente)'
                                    },
                                    new_string: {
                                        type: 'string',
                                        description: 'Nuova stringa'
                                    },
                                    replace_all: {
                                        type: 'boolean',
                                        description: 'Se true, sostituisce tutte le occorrenze. Se false (default), solo la prima.'
                                    }
                                },
                                required: ['file_path', 'old_string', 'new_string']
                            }
                        },
                        dry_run: {
                            type: 'boolean',
                            description: 'Se true, mostra preview senza applicare le modifiche. Utile per verificare prima di eseguire. Default: false'
                        }
                    },
                    required: ['edits']
                }
            });
        }

        return tools;
    }

    /**
     * Esegue un tool
     */
    async executeTool(toolName, toolInput) {
        console.log(`🔧 Executing tool: ${toolName}`, toolInput);

        try {
            switch (toolName) {
                case 'read_file':
                    return await this.readFile(
                        toolInput.file_path,
                        toolInput.offset,
                        toolInput.limit
                    );

                case 'write_file':
                    return await this.writeFile(toolInput.file_path, toolInput.content);

                case 'edit_file':
                    return await this.editFile(
                        toolInput.file_path,
                        toolInput.old_string,
                        toolInput.new_string
                    );

                case 'glob':
                    return await this.glob(toolInput.pattern);

                case 'grep':
                    return await this.grep(
                        toolInput.pattern,
                        toolInput.path,
                        toolInput.file_pattern
                    );

                case 'bash':
                    return await this.bash(toolInput.command, toolInput.cwd);

                case 'todo_write':
                    return await this.todoWrite(toolInput.todos);

                case 'multi_edit':
                    return await this.multiEdit(toolInput.edits, toolInput.dry_run);

                default:
                    return { error: `Unknown tool: ${toolName}` };
            }
        } catch (error) {
            console.error(`❌ Error executing tool ${toolName}:`, error);
            return {
                error: error.message,
                stderr: error.stderr
            };
        }
    }

    /**
     * READ FILE
     * Supporta offset e limit per lettura parziale di file grandi
     */
    async readFile(filePath, offset = null, limit = null) {
        const fullPath = path.join(this.workspaceRoot, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');

        // Split in righe
        const lines = content.split('\n');
        const totalLines = lines.length;

        // Determina range da leggere
        const startLine = offset !== null && offset >= 0 ? offset : 0;
        const endLine = limit !== null ? startLine + limit : totalLines;

        // Slice delle righe richieste
        const selectedLines = lines.slice(startLine, endLine);

        // Numera le righe (1-indexed per l'output, ma offset è 0-indexed)
        const numbered = selectedLines.map((line, i) =>
            `${startLine + i + 1}→${line}`
        ).join('\n');

        return {
            file_path: filePath,
            content: numbered,
            lines: totalLines,
            lines_shown: selectedLines.length,
            offset: startLine,
            showing_range: `${startLine + 1}-${startLine + selectedLines.length}`
        };
    }

    /**
     * WRITE FILE
     */
    async writeFile(filePath, content) {
        const fullPath = path.join(this.workspaceRoot, filePath);

        // Crea directory se non esiste
        await fs.mkdir(path.dirname(fullPath), { recursive: true });

        await fs.writeFile(fullPath, content, 'utf-8');

        return {
            success: true,
            file_path: filePath,
            bytes_written: content.length
        };
    }

    /**
     * EDIT FILE
     */
    async editFile(filePath, oldString, newString) {
        const fullPath = path.join(this.workspaceRoot, filePath);

        let content = await fs.readFile(fullPath, 'utf-8');

        // Check se old_string esiste
        if (!content.includes(oldString)) {
            return {
                error: 'old_string not found in file',
                hint: 'Make sure the string matches exactly (including whitespace)'
            };
        }

        // Replace
        const newContent = content.replace(oldString, newString);

        await fs.writeFile(fullPath, newContent, 'utf-8');

        return {
            success: true,
            file_path: filePath,
            changes: 1
        };
    }

    /**
     * MULTI EDIT - Modifica multipli file atomicamente
     * All-or-nothing: se una edit fallisce, tutte vengono rollback
     */
    async multiEdit(edits, dryRun = false) {
        console.log(`📝 Multi-edit: ${edits.length} files (dry-run: ${dryRun})`);

        const backups = [];
        const changes = [];

        try {
            // Phase 1: VALIDATION - Verifica che tutte le edit siano valide
            console.log('🔍 Phase 1: Validation...');
            for (const edit of edits) {
                const { file_path, old_string, new_string, replace_all } = edit;
                const fullPath = path.join(this.workspaceRoot, file_path);

                // Check file exists
                try {
                    await fs.access(fullPath);
                } catch {
                    throw new Error(`File not found: ${file_path}`);
                }

                // Read and validate old_string exists
                const content = await fs.readFile(fullPath, 'utf-8');

                if (!content.includes(old_string)) {
                    throw new Error(
                        `String not found in ${file_path}: "${old_string.substring(0, 50)}${old_string.length > 50 ? '...' : ''}"`
                    );
                }

                // Count occurrences
                const occurrences = (content.match(new RegExp(old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

                changes.push({
                    file: file_path,
                    occurrences: occurrences,
                    replace_all: replace_all || false
                });
            }

            console.log(`✅ Validation passed: ${edits.length} files ready`);

            // If dry-run, return preview without applying
            if (dryRun) {
                return {
                    success: true,
                    dry_run: true,
                    files: edits.length,
                    changes: changes,
                    message: 'Dry-run successful. No files were modified. Set dry_run=false to apply changes.'
                };
            }

            // Phase 2: BACKUP - Salva contenuti originali
            console.log('💾 Phase 2: Backup...');
            for (const edit of edits) {
                const fullPath = path.join(this.workspaceRoot, edit.file_path);
                const content = await fs.readFile(fullPath, 'utf-8');
                backups.push({
                    file_path: edit.file_path,
                    fullPath: fullPath,
                    content: content
                });
            }

            console.log(`✅ Backed up ${backups.length} files`);

            // Phase 3: APPLY - Applica tutte le modifiche
            console.log('✏️ Phase 3: Applying edits...');
            let totalReplacements = 0;

            for (let i = 0; i < edits.length; i++) {
                const edit = edits[i];
                const { file_path, old_string, new_string, replace_all } = edit;
                const fullPath = path.join(this.workspaceRoot, file_path);

                let content = await fs.readFile(fullPath, 'utf-8');

                // Apply replacement
                if (replace_all) {
                    // Replace all occurrences
                    const regex = new RegExp(old_string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                    content = content.replace(regex, new_string);
                } else {
                    // Replace only first occurrence
                    content = content.replace(old_string, new_string);
                }

                await fs.writeFile(fullPath, content, 'utf-8');
                totalReplacements++;

                console.log(`  ✓ ${file_path} (${changes[i].occurrences} occurrence${changes[i].occurrences > 1 ? 's' : ''})`);
            }

            console.log(`✅ Multi-edit successful: ${totalReplacements} files modified`);

            return {
                success: true,
                files: totalReplacements,
                changes: changes,
                message: `Successfully modified ${totalReplacements} file(s) atomically`
            };

        } catch (error) {
            // Phase 4: ROLLBACK - Ripristina tutti i file in caso di errore
            console.error(`❌ Multi-edit failed: ${error.message}`);

            if (backups.length > 0) {
                console.log(`🔄 Rolling back ${backups.length} files...`);

                for (const backup of backups) {
                    try {
                        await fs.writeFile(backup.fullPath, backup.content, 'utf-8');
                        console.log(`  ↩️ Restored ${backup.file_path}`);
                    } catch (rollbackError) {
                        console.error(`  ❌ Failed to restore ${backup.file_path}: ${rollbackError.message}`);
                    }
                }

                console.log(`✅ Rollback complete`);
            }

            return {
                success: false,
                error: error.message,
                rolled_back: backups.length,
                message: `Multi-edit failed and rolled back ${backups.length} file(s): ${error.message}`
            };
        }
    }

    /**
     * GLOB - Cerca file per pattern
     */
    async glob(pattern) {
        const { stdout } = await execPromise(`find . -name "${pattern}" -type f`, {
            cwd: this.workspaceRoot
        });

        const files = stdout
            .trim()
            .split('\n')
            .filter(f => f)
            .map(f => f.replace('./', ''));

        return {
            pattern: pattern,
            matches: files,
            count: files.length
        };
    }

    /**
     * GREP - Cerca contenuto nei file
     */
    async grep(pattern, searchPath = '.', filePattern = '*') {
        try {
            const { stdout } = await execPromise(
                `grep -r "${pattern}" --include="${filePattern}" ${searchPath} || true`,
                { cwd: this.workspaceRoot }
            );

            const matches = stdout
                .trim()
                .split('\n')
                .filter(line => line)
                .map(line => {
                    const [file, ...rest] = line.split(':');
                    return {
                        file: file,
                        line: rest.join(':')
                    };
                });

            return {
                pattern: pattern,
                matches: matches,
                count: matches.length
            };
        } catch (error) {
            // Grep returns non-zero if no matches, ma non è un errore
            return {
                pattern: pattern,
                matches: [],
                count: 0
            };
        }
    }

    /**
     * BASH - Esegue comando
     */
    async bash(command, cwd = null) {
        const workDir = cwd ? path.join(this.workspaceRoot, cwd) : this.workspaceRoot;

        const { stdout, stderr } = await execPromise(command, {
            cwd: workDir,
            timeout: 30000 // 30 secondi timeout
        });

        return {
            command: command,
            stdout: stdout,
            stderr: stderr,
            exit_code: 0
        };
    }

    /**
     * TODO WRITE - Gestisce lista TODO
     */
    async todoWrite(todos) {
        this.todos = todos;

        // Trova task in_progress per mostrarlo
        const inProgress = todos.find(t => t.status === 'in_progress');
        const completed = todos.filter(t => t.status === 'completed').length;
        const total = todos.length;

        return {
            success: true,
            todos: this.todos,
            current_task: inProgress?.activeForm || 'None',
            progress: `${completed}/${total} completed`
        };
    }

    /**
     * Get current TODO state
     */
    getTodos() {
        return this.todos;
    }
}

module.exports = FilesystemTools;
