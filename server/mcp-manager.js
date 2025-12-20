/**
 * MCP Manager
 *
 * Gestisce multiple connessioni a MCP servers
 * - Configurazione persistente in .claude/mcp-config.json
 * - Auto-connect all'avvio
 * - Tool aggregation da tutti i server
 * - Routing tool calls ai server corretti
 */

const fs = require('fs').promises;
const path = require('path');
const MCPClient = require('./mcp-client');

class MCPManager {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.configFile = path.join(workspaceRoot, '.claude', 'mcp-config.json');

        // Map di client connessi: serverName -> MCPClient
        this.clients = new Map();

        // Tool aggregati da tutti i server
        this.aggregatedTools = [];

        console.log('🔌 MCP Manager initialized');
    }

    /**
     * Carica configurazione e connetti a tutti i server
     */
    async initialize() {
        console.log('🔌 MCP Manager: Loading configuration...');

        try {
            // Carica configurazione
            const config = await this.loadConfig();

            if (!config.servers || config.servers.length === 0) {
                console.log('   ℹ️  No MCP servers configured');
                return;
            }

            console.log(`   📋 Found ${config.servers.length} configured servers`);

            // Connetti a tutti i server abilitati
            for (const serverConfig of config.servers) {
                if (serverConfig.enabled !== false) {
                    try {
                        await this.addServer(serverConfig);
                    } catch (error) {
                        console.error(`   ⚠️  Failed to connect to ${serverConfig.name}:`, error.message);
                    }
                }
            }

            // Aggrega tutti i tool
            this.updateAggregatedTools();

            console.log(`✅ MCP Manager ready with ${this.clients.size} servers connected`);

        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('   ℹ️  No MCP configuration file found. Creating default...');
                await this.createDefaultConfig();
            } else {
                console.error('❌ MCP Manager initialization error:', error);
            }
        }
    }

    /**
     * Carica configurazione da file
     */
    async loadConfig() {
        const content = await fs.readFile(this.configFile, 'utf-8');
        return JSON.parse(content);
    }

    /**
     * Salva configurazione su file
     */
    async saveConfig(config) {
        // Assicura che la directory esista
        await fs.mkdir(path.dirname(this.configFile), { recursive: true });

        await fs.writeFile(
            this.configFile,
            JSON.stringify(config, null, 2),
            'utf-8'
        );
    }

    /**
     * Crea configurazione di default
     */
    async createDefaultConfig() {
        const defaultConfig = {
            version: '1.0',
            servers: [
                {
                    name: 'example-server',
                    url: 'https://example.com/mcp',
                    bearerToken: '',
                    enabled: false,
                    description: 'Example MCP server configuration. Edit this to add your servers.',
                    timeout: 30000
                }
            ]
        };

        await this.saveConfig(defaultConfig);
        console.log(`   ✅ Created default config at: ${this.configFile}`);
    }

    /**
     * Aggiungi e connetti a un server MCP
     */
    async addServer(serverConfig) {
        const { name } = serverConfig;

        if (this.clients.has(name)) {
            throw new Error(`Server ${name} already connected`);
        }

        console.log(`   🔌 Connecting to: ${name}...`);

        const client = new MCPClient(serverConfig);
        await client.connect();

        this.clients.set(name, client);

        // Event listeners
        client.on('error', (error) => {
            console.error(`❌ MCP Server ${name} error:`, error);
        });

        client.on('disconnected', () => {
            console.log(`🔌 MCP Server ${name} disconnected`);
            this.clients.delete(name);
            this.updateAggregatedTools();
        });

        return client;
    }

    /**
     * Rimuovi un server
     */
    async removeServer(serverName) {
        const client = this.clients.get(serverName);

        if (!client) {
            throw new Error(`Server ${serverName} not found`);
        }

        await client.disconnect();
        this.clients.delete(serverName);
        this.updateAggregatedTools();
    }

    /**
     * Aggrega tool da tutti i server connessi
     */
    updateAggregatedTools() {
        this.aggregatedTools = [];

        for (const [serverName, client] of this.clients) {
            for (const tool of client.tools) {
                // Prefissa il nome del tool con il server per evitare collisioni
                this.aggregatedTools.push({
                    name: `${serverName}__${tool.name}`,
                    originalName: tool.name,
                    serverName: serverName,
                    description: `[${serverName}] ${tool.description || ''}`,
                    inputSchema: tool.inputSchema
                });
            }
        }

        console.log(`   📦 Aggregated ${this.aggregatedTools.length} tools from ${this.clients.size} servers`);
    }

    /**
     * Ottieni definizioni tool per Claude (formato Anthropic)
     */
    getToolDefinitions() {
        return this.aggregatedTools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema || {
                type: 'object',
                properties: {},
                required: []
            }
        }));
    }

    /**
     * Esegui un tool su un server MCP
     */
    async executeTool(toolName, toolInput) {
        // Parse server name dal tool name (formato: serverName__toolName)
        const parts = toolName.split('__');

        if (parts.length !== 2) {
            throw new Error(`Invalid MCP tool name format: ${toolName}`);
        }

        const [serverName, originalToolName] = parts;

        const client = this.clients.get(serverName);

        if (!client) {
            throw new Error(`MCP server ${serverName} not connected`);
        }

        if (!client.connected) {
            throw new Error(`MCP server ${serverName} is not connected`);
        }

        // Chiama il tool sul server
        return await client.callTool(originalToolName, toolInput);
    }

    /**
     * Lista tutti i server configurati
     */
    async listServers() {
        const config = await this.loadConfig();
        return config.servers || [];
    }

    /**
     * Ottieni status di tutti i client
     */
    getStatus() {
        const statuses = [];

        for (const [name, client] of this.clients) {
            statuses.push(client.getStatus());
        }

        return {
            totalServers: this.clients.size,
            totalTools: this.aggregatedTools.length,
            servers: statuses
        };
    }

    /**
     * Aggiungi nuovo server alla configurazione
     */
    async addServerConfig(serverConfig) {
        const config = await this.loadConfig();

        // Verifica che il nome non esista già
        if (config.servers.some(s => s.name === serverConfig.name)) {
            throw new Error(`Server ${serverConfig.name} already exists in configuration`);
        }

        config.servers.push({
            name: serverConfig.name,
            url: serverConfig.url,
            bearerToken: serverConfig.bearerToken || '',
            enabled: serverConfig.enabled !== false,
            description: serverConfig.description || '',
            timeout: serverConfig.timeout || 30000
        });

        await this.saveConfig(config);

        // Se enabled, connetti subito
        if (serverConfig.enabled !== false) {
            await this.addServer(serverConfig);
            this.updateAggregatedTools();
        }
    }

    /**
     * Aggiorna configurazione server
     */
    async updateServerConfig(serverName, updates) {
        const config = await this.loadConfig();

        const serverIndex = config.servers.findIndex(s => s.name === serverName);

        if (serverIndex === -1) {
            throw new Error(`Server ${serverName} not found in configuration`);
        }

        // Aggiorna config
        config.servers[serverIndex] = {
            ...config.servers[serverIndex],
            ...updates
        };

        await this.saveConfig(config);

        // Se il server è connesso e la config è cambiata, riconnetti
        if (this.clients.has(serverName)) {
            await this.removeServer(serverName);

            if (config.servers[serverIndex].enabled !== false) {
                await this.addServer(config.servers[serverIndex]);
                this.updateAggregatedTools();
            }
        }
    }

    /**
     * Rimuovi server dalla configurazione
     */
    async deleteServerConfig(serverName) {
        const config = await this.loadConfig();

        config.servers = config.servers.filter(s => s.name !== serverName);

        await this.saveConfig(config);

        // Disconnetti se connesso
        if (this.clients.has(serverName)) {
            await this.removeServer(serverName);
        }
    }

    /**
     * Reload configurazione e riconnetti
     */
    async reload() {
        console.log('🔄 Reloading MCP configuration...');

        // Disconnetti tutti
        for (const [name, client] of this.clients) {
            await client.disconnect();
        }

        this.clients.clear();
        this.aggregatedTools = [];

        // Ricarica
        await this.initialize();
    }
}

module.exports = MCPManager;
