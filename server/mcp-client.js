/**
 * MCP Client
 *
 * Client per connettersi a MCP (Model Context Protocol) servers via HTTP/SSE
 * Supporta:
 * - JSON-RPC 2.0
 * - Bearer token authentication
 * - Tool invocation
 * - Resource listing
 * - Prompt templates
 *
 * Spec: https://modelcontextprotocol.io/
 */

const https = require('https');
const http = require('http');
const { EventEmitter } = require('events');

class MCPClient extends EventEmitter {
    constructor(serverConfig) {
        super();

        this.serverUrl = serverConfig.url;
        this.bearerToken = serverConfig.bearerToken || null;
        this.serverName = serverConfig.name || 'unknown';
        this.timeout = serverConfig.timeout || 30000;

        this.connected = false;
        this.tools = [];
        this.resources = [];
        this.prompts = [];

        console.log(`🔌 MCP Client created for: ${this.serverName} (${this.serverUrl})`);
    }

    /**
     * Connetti al server MCP e recupera capabilities
     */
    async connect() {
        try {
            console.log(`🔌 Connecting to MCP server: ${this.serverName}...`);

            // Initialize connection (JSON-RPC 2.0: initialize method)
            const initResponse = await this.sendRequest('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {
                    roots: { listChanged: true },
                    sampling: {}
                },
                clientInfo: {
                    name: 'mossab-ai',
                    version: '1.0.0'
                }
            });

            if (!initResponse.result) {
                throw new Error('Initialize failed: no result');
            }

            console.log(`✅ MCP server ${this.serverName} initialized`);
            console.log(`   Protocol: ${initResponse.result.protocolVersion}`);
            console.log(`   Server: ${initResponse.result.serverInfo?.name || 'unknown'}`);

            // Get available tools
            await this.listTools();

            // Get available resources (optional)
            try {
                await this.listResources();
            } catch (error) {
                console.log(`   ℹ️  No resources available`);
            }

            // Get available prompts (optional)
            try {
                await this.listPrompts();
            } catch (error) {
                console.log(`   ℹ️  No prompts available`);
            }

            this.connected = true;
            this.emit('connected');

            return true;

        } catch (error) {
            console.error(`❌ Failed to connect to MCP server ${this.serverName}:`, error.message);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Lista i tool disponibili sul server
     */
    async listTools() {
        const response = await this.sendRequest('tools/list', {});

        if (response.result && response.result.tools) {
            this.tools = response.result.tools;
            console.log(`   📦 Tools available: ${this.tools.length}`);
            this.tools.forEach(tool => {
                console.log(`      - ${tool.name}: ${tool.description || 'no description'}`);
            });
        }

        return this.tools;
    }

    /**
     * Lista le risorse disponibili
     */
    async listResources() {
        const response = await this.sendRequest('resources/list', {});

        if (response.result && response.result.resources) {
            this.resources = response.result.resources;
            console.log(`   📄 Resources available: ${this.resources.length}`);
        }

        return this.resources;
    }

    /**
     * Lista i prompt templates disponibili
     */
    async listPrompts() {
        const response = await this.sendRequest('prompts/list', {});

        if (response.result && response.result.prompts) {
            this.prompts = response.result.prompts;
            console.log(`   💬 Prompts available: ${this.prompts.length}`);
        }

        return this.prompts;
    }

    /**
     * Invoca un tool sul server MCP
     */
    async callTool(toolName, parameters = {}) {
        console.log(`🔧 MCP Tool call: ${this.serverName}/${toolName}`);

        const response = await this.sendRequest('tools/call', {
            name: toolName,
            arguments: parameters
        });

        if (response.error) {
            throw new Error(`MCP tool error: ${response.error.message}`);
        }

        return response.result;
    }

    /**
     * Leggi una risorsa
     */
    async readResource(resourceUri) {
        const response = await this.sendRequest('resources/read', {
            uri: resourceUri
        });

        if (response.error) {
            throw new Error(`MCP resource error: ${response.error.message}`);
        }

        return response.result;
    }

    /**
     * Ottieni un prompt
     */
    async getPrompt(promptName, arguments_ = {}) {
        const response = await this.sendRequest('prompts/get', {
            name: promptName,
            arguments: arguments_
        });

        if (response.error) {
            throw new Error(`MCP prompt error: ${response.error.message}`);
        }

        return response.result;
    }

    /**
     * Invia richiesta JSON-RPC 2.0 al server
     */
    async sendRequest(method, params) {
        const requestId = Date.now() + Math.random();

        const requestBody = JSON.stringify({
            jsonrpc: '2.0',
            id: requestId,
            method: method,
            params: params
        });

        const urlObj = new URL(this.serverUrl);
        const protocol = urlObj.protocol === 'https:' ? https : http;

        return new Promise((resolve, reject) => {
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody),
                    'User-Agent': 'Mossab-MCP-Client/1.0'
                }
            };

            // Add bearer token if configured
            if (this.bearerToken) {
                options.headers['Authorization'] = `Bearer ${this.bearerToken}`;
            }

            const request = protocol.request(options, (response) => {
                let data = '';

                response.on('data', chunk => {
                    data += chunk;
                });

                response.on('end', () => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`HTTP ${response.statusCode}: ${data}`));
                        return;
                    }

                    try {
                        const jsonResponse = JSON.parse(data);

                        // Verifica JSON-RPC response
                        if (jsonResponse.id !== requestId) {
                            reject(new Error('Response ID mismatch'));
                            return;
                        }

                        resolve(jsonResponse);

                    } catch (error) {
                        reject(new Error(`Invalid JSON response: ${error.message}`));
                    }
                });
            });

            request.on('error', reject);

            request.setTimeout(this.timeout, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });

            request.write(requestBody);
            request.end();
        });
    }

    /**
     * Disconnetti dal server
     */
    async disconnect() {
        if (!this.connected) return;

        console.log(`🔌 Disconnecting from MCP server: ${this.serverName}`);

        this.connected = false;
        this.tools = [];
        this.resources = [];
        this.prompts = [];

        this.emit('disconnected');
    }

    /**
     * Ottieni info sullo stato del client
     */
    getStatus() {
        return {
            name: this.serverName,
            url: this.serverUrl,
            connected: this.connected,
            toolsCount: this.tools.length,
            resourcesCount: this.resources.length,
            promptsCount: this.prompts.length,
            hasAuth: !!this.bearerToken
        };
    }
}

module.exports = MCPClient;
