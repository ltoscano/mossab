/**
 * WebTools - Implementazione di web_search e web_fetch
 *
 * Questi tool permettono a Mossab di cercare informazioni online
 * e recuperare contenuto da pagine web.
 */

const https = require('https');
const http = require('http');

class WebTools {
    constructor() {
        // Per web_search, in produzione si userebbe un'API come:
        // - Google Custom Search API
        // - Bing Search API
        // - DuckDuckGo API
        // - SerpAPI

        // Per ora implementiamo una versione base che simula risultati
        // ma fornisce un framework per integrare API reali
    }

    /**
     * Web Search - Cerca informazioni su internet
     *
     * Supporta multiple API:
     * 1. Tavily API (consigliato) - TAVILY_API_KEY
     * 2. Google Custom Search API - SEARCH_API_KEY + SEARCH_ENGINE_ID
     * 3. Fallback simulato
     */
    async webSearch(query, numResults = 5) {
        console.log(`🔍 Web Search: "${query}" (${numResults} results)`);

        // Prova Tavily per primo (migliore per AI)
        const tavilyApiKey = process.env.TAVILY_API_KEY;
        if (tavilyApiKey) {
            try {
                return await this.tavilySearch(query, numResults, tavilyApiKey);
            } catch (error) {
                console.warn('⚠️ Tavily search failed, trying Google:', error.message);
            }
        }

        // Prova Google Custom Search
        const searchApiKey = process.env.SEARCH_API_KEY;
        const searchEngineId = process.env.SEARCH_ENGINE_ID;

        if (searchApiKey && searchEngineId) {
            try {
                return await this.googleCustomSearch(query, numResults, searchApiKey, searchEngineId);
            } catch (error) {
                console.warn('⚠️ Google search failed, using fallback:', error.message);
            }
        }

        // Fallback a risultati simulati con disclaimer
        return {
            query: query,
            num_results: numResults,
            results: [
                {
                    title: `Risultati per: "${query}"`,
                    snippet: `⚠️ Search API non configurata. Per abilitare la ricerca reale, configura una di queste API nel file .env:\n\n**Tavily** (consigliato per AI):\nTAVILY_API_KEY=your_key\nOttieni key: https://tavily.com/\n\n**Google Custom Search**:\nSEARCH_API_KEY=your_key\nSEARCH_ENGINE_ID=your_cx\nOttieni key: https://developers.google.com/custom-search\n\nPer ora, sto simulando i risultati per: "${query}"`,
                    url: 'https://tavily.com/',
                    source: 'simulated'
                }
            ],
            disclaimer: 'Search API not configured. Configure TAVILY_API_KEY or SEARCH_API_KEY to enable real search.',
            provider: 'simulated'
        };
    }

    /**
     * Tavily Search API implementation
     * Tavily è ottimizzato per AI/LLM e fornisce risultati di alta qualità
     */
    async tavilySearch(query, numResults, apiKey) {
        try {
            const url = 'https://api.tavily.com/search';

            const body = JSON.stringify({
                api_key: apiKey,
                query: query,
                max_results: numResults,
                search_depth: 'basic', // 'basic' o 'advanced'
                include_answer: true,
                include_raw_content: false,
                include_images: false
            });

            const response = await this.httpsPost(url, body, {
                'Content-Type': 'application/json'
            });

            const data = JSON.parse(response);

            if (!data.results || data.results.length === 0) {
                return {
                    query: query,
                    results: [],
                    message: 'No results found',
                    provider: 'tavily'
                };
            }

            return {
                query: query,
                num_results: data.results.length,
                answer: data.answer || null, // Tavily fornisce una risposta diretta
                results: data.results.map(item => ({
                    title: item.title,
                    snippet: item.content,
                    url: item.url,
                    score: item.score || null,
                    source: 'tavily'
                })),
                provider: 'tavily'
            };

        } catch (error) {
            console.error('Tavily search error:', error);
            throw new Error(`Tavily search failed: ${error.message}`);
        }
    }

    /**
     * Google Custom Search API implementation
     */
    async googleCustomSearch(query, numResults, apiKey, searchEngineId) {
        try {
            const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=${numResults}`;

            const response = await this.httpsGet(url);
            const data = JSON.parse(response);

            if (!data.items) {
                return {
                    query: query,
                    results: [],
                    message: 'No results found'
                };
            }

            return {
                query: query,
                num_results: data.items.length,
                results: data.items.map(item => ({
                    title: item.title,
                    snippet: item.snippet,
                    url: item.link,
                    source: 'google'
                }))
            };

        } catch (error) {
            console.error('Google Custom Search error:', error);
            return {
                error: 'Search failed',
                message: error.message,
                query: query
            };
        }
    }

    /**
     * Web Fetch - Recupera contenuto da URL
     *
     * Scarica una pagina web e la converte in testo leggibile
     */
    async webFetch(url, extractMainContent = true) {
        console.log(`🌐 Web Fetch: ${url}`);

        try {
            // Validazione URL
            const urlObj = new URL(url);

            // Determina protocollo
            const protocol = urlObj.protocol === 'https:' ? https : http;

            // Fetch content
            const html = await this.httpsGet(url, protocol);

            // Estrai testo da HTML
            let content = html;

            if (extractMainContent) {
                // Rimuovi script e style tags
                content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

                // Rimuovi HTML tags
                content = content.replace(/<[^>]+>/g, ' ');

                // Decodifica HTML entities comuni
                content = content.replace(/&nbsp;/g, ' ');
                content = content.replace(/&amp;/g, '&');
                content = content.replace(/&lt;/g, '<');
                content = content.replace(/&gt;/g, '>');
                content = content.replace(/&quot;/g, '"');

                // Pulisci whitespace
                content = content.replace(/\s+/g, ' ').trim();
            }

            // Limita lunghezza per evitare overflow di contesto
            const MAX_LENGTH = 50000; // ~12500 tokens
            if (content.length > MAX_LENGTH) {
                content = content.substring(0, MAX_LENGTH) + '\n\n[... contenuto troncato per lunghezza]';
            }

            return {
                url: url,
                content: content,
                content_length: content.length,
                extracted_main_content: extractMainContent,
                success: true
            };

        } catch (error) {
            console.error('Web Fetch error:', error);
            return {
                url: url,
                error: 'Failed to fetch URL',
                message: error.message,
                success: false
            };
        }
    }

    /**
     * Helper: HTTPS GET request
     */
    httpsGet(url, protocol = https) {
        return new Promise((resolve, reject) => {
            const request = protocol.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; MossabAI/1.0; +https://github.com/mossab)'
                }
            }, (response) => {
                // Handle redirects
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    console.log(`Following redirect to: ${response.headers.location}`);
                    return this.httpsGet(response.headers.location).then(resolve).catch(reject);
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                let data = '';

                response.on('data', chunk => {
                    data += chunk;
                });

                response.on('end', () => {
                    resolve(data);
                });
            });

            request.on('error', reject);

            // Timeout dopo 30 secondi
            request.setTimeout(30000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    /**
     * Helper: HTTPS POST request
     */
    httpsPost(url, body, headers = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; MossabAI/1.0; +https://github.com/mossab)',
                    'Content-Length': Buffer.byteLength(body),
                    ...headers
                }
            };

            const request = https.request(options, (response) => {
                if (response.statusCode !== 200) {
                    let errorData = '';
                    response.on('data', chunk => errorData += chunk);
                    response.on('end', () => {
                        reject(new Error(`HTTP ${response.statusCode}: ${errorData || response.statusMessage}`));
                    });
                    return;
                }

                let data = '';

                response.on('data', chunk => {
                    data += chunk;
                });

                response.on('end', () => {
                    resolve(data);
                });
            });

            request.on('error', reject);

            // Timeout dopo 30 secondi
            request.setTimeout(30000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });

            request.write(body);
            request.end();
        });
    }
}

module.exports = WebTools;
