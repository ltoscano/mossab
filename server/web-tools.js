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
     * NOTA: Questa è un'implementazione base simulata.
     * Per usare una search API reale, configurare:
     * - SEARCH_API_KEY nel .env
     * - SEARCH_ENGINE_ID nel .env
     */
    async webSearch(query, numResults = 5) {
        console.log(`🔍 Web Search: "${query}" (${numResults} results)`);

        // Check se abbiamo una search API configurata
        const searchApiKey = process.env.SEARCH_API_KEY;
        const searchEngineId = process.env.SEARCH_ENGINE_ID;

        if (searchApiKey && searchEngineId) {
            // Usa Google Custom Search API
            return await this.googleCustomSearch(query, numResults, searchApiKey, searchEngineId);
        }

        // Fallback a risultati simulati con disclaimer
        return {
            query: query,
            num_results: numResults,
            results: [
                {
                    title: `Risultati per: "${query}"`,
                    snippet: `⚠️ Search API non configurata. Per abilitare la ricerca reale, configura SEARCH_API_KEY e SEARCH_ENGINE_ID nel file .env.\n\nPer ottenere le credenziali:\n1. Google Custom Search: https://developers.google.com/custom-search\n2. Bing Search API: https://www.microsoft.com/en-us/bing/apis/bing-web-search-api\n\nPer ora, sto simulando i risultati per la query: "${query}"`,
                    url: 'https://developers.google.com/custom-search',
                    source: 'simulated'
                }
            ],
            disclaimer: 'Search API not configured. Results are simulated. Configure SEARCH_API_KEY to enable real search.'
        };
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
}

module.exports = WebTools;
