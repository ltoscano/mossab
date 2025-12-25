const fs = require('fs').promises;
const path = require('path');

/**
 * VersionManager - Sistema di versioning universale per agents e workflows
 *
 * Gestisce:
 * - Creazione nuove versioni (semantic versioning)
 * - Listing versioni disponibili
 * - Switch tra versioni (set active version)
 * - Eliminazione versioni
 * - Metadata versioni (created, tags, changelog)
 *
 * Struttura:
 * .mossab/{type}/{name}/
 *   versions.json      # Metadata di tutte le versioni
 *   v1.0.0.json       # Versione 1.0.0
 *   v1.1.0.json       # Versione 1.1.0
 *   v2.0.0.json       # Versione 2.0.0
 */
class VersionManager {
    constructor(baseDir, type) {
        this.baseDir = baseDir; // .mossab/agents or .mossab/workflows
        this.type = type; // 'agent' or 'workflow'
    }

    /**
     * Ottieni path della directory delle versioni per un item
     */
    getItemDir(name) {
        return path.join(this.baseDir, name);
    }

    /**
     * Ottieni path del file versions.json
     */
    getVersionsFile(name) {
        return path.join(this.getItemDir(name), 'versions.json');
    }

    /**
     * Ottieni path di un file versione specifica
     */
    getVersionFile(name, version) {
        return path.join(this.getItemDir(name), `v${version}.json`);
    }

    /**
     * Carica metadata versioni
     */
    async loadVersions(name) {
        try {
            const content = await fs.readFile(this.getVersionsFile(name), 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            // File non esiste, ritorna struttura vuota
            return {
                name,
                currentVersion: null,
                latestVersion: null,
                versions: []
            };
        }
    }

    /**
     * Salva metadata versioni
     */
    async saveVersions(name, metadata) {
        const itemDir = this.getItemDir(name);
        await fs.mkdir(itemDir, { recursive: true });
        await fs.writeFile(
            this.getVersionsFile(name),
            JSON.stringify(metadata, null, 2),
            'utf-8'
        );
    }

    /**
     * Crea una nuova versione
     */
    async createVersion(name, version, config, options = {}) {
        // Valida versione (semantic versioning)
        if (!this.isValidVersion(version)) {
            throw new Error('Invalid version format. Use semantic versioning (e.g., 1.0.0)');
        }

        // Carica metadata
        const metadata = await this.loadVersions(name);

        // Check se versione esiste già
        if (metadata.versions.find(v => v.version === version)) {
            throw new Error(`Version ${version} already exists`);
        }

        // Crea directory se non esiste
        const itemDir = this.getItemDir(name);
        await fs.mkdir(itemDir, { recursive: true });

        // Salva config della versione
        const versionFile = this.getVersionFile(name, version);
        await fs.writeFile(versionFile, JSON.stringify(config, null, 2), 'utf-8');

        // Aggiungi versione al metadata
        const versionInfo = {
            version,
            createdAt: new Date().toISOString(),
            tag: options.tag || 'stable',
            changelog: options.changelog || '',
            author: options.author || 'unknown'
        };

        metadata.versions.push(versionInfo);

        // Ordina per versione (semantic versioning)
        metadata.versions.sort((a, b) => this.compareVersions(b.version, a.version));

        // Imposta come latest e current se è la prima versione o se richiesto
        if (!metadata.latestVersion || options.setAsLatest) {
            metadata.latestVersion = version;
        }

        if (!metadata.currentVersion || options.setAsCurrent) {
            metadata.currentVersion = version;
        }

        // Salva metadata
        await this.saveVersions(name, metadata);

        console.log(`✅ Created version ${version} for ${this.type} ${name}`);

        return {
            success: true,
            version,
            versionInfo,
            metadata
        };
    }

    /**
     * Lista tutte le versioni di un item
     */
    async listVersions(name) {
        const metadata = await this.loadVersions(name);
        return {
            success: true,
            name,
            currentVersion: metadata.currentVersion,
            latestVersion: metadata.latestVersion,
            versions: metadata.versions
        };
    }

    /**
     * Ottieni config di una versione specifica
     */
    async getVersion(name, version) {
        const versionFile = this.getVersionFile(name, version);

        try {
            const content = await fs.readFile(versionFile, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Version ${version} not found for ${this.type} ${name}`);
        }
    }

    /**
     * Ottieni la versione corrente
     */
    async getCurrentVersion(name) {
        const metadata = await this.loadVersions(name);

        if (!metadata.currentVersion) {
            throw new Error(`No current version set for ${this.type} ${name}`);
        }

        return await this.getVersion(name, metadata.currentVersion);
    }

    /**
     * Switch alla versione specifica (set as current)
     */
    async switchVersion(name, version) {
        // Verifica che la versione esista
        const config = await this.getVersion(name, version);

        // Carica metadata
        const metadata = await this.loadVersions(name);

        // Imposta come current
        const previousVersion = metadata.currentVersion;
        metadata.currentVersion = version;

        // Salva metadata
        await this.saveVersions(name, metadata);

        console.log(`✅ Switched ${this.type} ${name} from v${previousVersion} to v${version}`);

        return {
            success: true,
            previousVersion,
            currentVersion: version,
            config
        };
    }

    /**
     * Elimina una versione
     */
    async deleteVersion(name, version) {
        // Carica metadata
        const metadata = await this.loadVersions(name);

        // Non permettere di eliminare l'unica versione
        if (metadata.versions.length === 1) {
            throw new Error('Cannot delete the only version. Delete the entire item instead.');
        }

        // Non permettere di eliminare la versione corrente
        if (metadata.currentVersion === version) {
            throw new Error('Cannot delete current version. Switch to another version first.');
        }

        // Trova la versione
        const versionIndex = metadata.versions.findIndex(v => v.version === version);
        if (versionIndex === -1) {
            throw new Error(`Version ${version} not found`);
        }

        // Elimina file
        const versionFile = this.getVersionFile(name, version);
        await fs.unlink(versionFile);

        // Rimuovi dal metadata
        metadata.versions.splice(versionIndex, 1);

        // Se era latest, imposta la versione più recente come latest
        if (metadata.latestVersion === version) {
            metadata.latestVersion = metadata.versions[0]?.version || null;
        }

        // Salva metadata
        await this.saveVersions(name, metadata);

        console.log(`✅ Deleted version ${version} for ${this.type} ${name}`);

        return {
            success: true,
            deletedVersion: version
        };
    }

    /**
     * Migra da struttura legacy (file singolo) a struttura con versioning
     */
    async migrateFromLegacy(name, legacyConfig, initialVersion = '1.0.0') {
        console.log(`🔄 Migrating ${this.type} ${name} to versioned structure...`);

        // Crea la prima versione
        await this.createVersion(name, initialVersion, legacyConfig, {
            tag: 'stable',
            changelog: 'Initial version (migrated from legacy)',
            setAsLatest: true,
            setAsCurrent: true
        });

        console.log(`✅ Migration complete: ${this.type} ${name} → v${initialVersion}`);

        return {
            success: true,
            migratedFrom: 'legacy',
            initialVersion
        };
    }

    /**
     * Check se esiste almeno una versione
     */
    async hasVersions(name) {
        try {
            const metadata = await this.loadVersions(name);
            return metadata.versions.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Valida formato versione (semantic versioning)
     */
    isValidVersion(version) {
        return /^\d+\.\d+\.\d+$/.test(version);
    }

    /**
     * Confronta due versioni (semantic versioning)
     * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
     */
    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if (parts1[i] > parts2[i]) return 1;
            if (parts1[i] < parts2[i]) return -1;
        }

        return 0;
    }

    /**
     * Suggerisci prossima versione (bump)
     */
    suggestNextVersion(currentVersion, type = 'patch') {
        const parts = currentVersion.split('.').map(Number);

        if (type === 'major') {
            parts[0]++;
            parts[1] = 0;
            parts[2] = 0;
        } else if (type === 'minor') {
            parts[1]++;
            parts[2] = 0;
        } else { // patch
            parts[2]++;
        }

        return parts.join('.');
    }
}

module.exports = VersionManager;
