/**
 * Search Tools — AI SDK tool definitions for web search and scraping.
 * Powered by OneCrawl (github.com/g97iulio1609/onecrawl).
 * These tools are automatically available to all AI Provider conversations.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { createOneCrawl } from 'onecrawl';

let _crawler: ReturnType<typeof createOneCrawl> | null = null;

/** Lazy-init OneCrawl singleton */
function getCrawler() {
  if (!_crawler) _crawler = createOneCrawl();
  return _crawler;
}

/**
 * Build web search + scrape tools for AI SDK streamText.
 * These enable the AI to autonomously search the web when needed.
 */
export function buildSearchTools() {
  return {
    web_search: tool({
      description: 'Search the web using DuckDuckGo, Google, or Bing. Use this when the user asks a question that requires up-to-date information, current events, or facts you\'re unsure about.',
      inputSchema: z.object({
        query: z.string().describe('The search query'),
        engine: z.enum(['duckduckgo', 'google', 'bing']).default('duckduckgo').describe('Search engine to use'),
        maxResults: z.number().min(1).max(20).default(5).describe('Number of results to return'),
      }),
      execute: async ({ query, engine, maxResults }: { query: string; engine: string; maxResults: number }) => {
        const crawler = getCrawler();
        const results = await crawler.search(query, {
          engine: engine as 'duckduckgo' | 'google' | 'bing',
          maxResults,
        });

        return {
          query: results.query,
          results: results.results.map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet || '',
          })),
          searchTime: results.searchTime,
        };
      },
    }),

    read_webpage: tool({
      description: 'Read and extract content from a webpage URL. Returns the page title, text content, and metadata. Use this to get detailed information from a specific URL found via web_search.',
      inputSchema: z.object({
        url: z.string().url().describe('The URL to read'),
        maxLength: z.number().min(500).max(50000).default(10000).describe('Maximum content length to return'),
      }),
      execute: async ({ url, maxLength }: { url: string; maxLength: number }) => {
        const crawler = getCrawler();
        const response = await crawler.scrape(url, {
          extractMetadata: true,
          maxContentLength: maxLength,
        });

        return {
          title: response.result.title,
          url: response.result.url,
          content: response.result.content,
          markdown: response.result.markdown || '',
          description: response.result.metadata?.description || '',
          loadTime: response.result.loadTime,
        };
      },
    }),

    scrape_many: tool({
      description: 'Scrape multiple URLs in parallel with connection pooling. Use this when you need to read content from several pages at once.',
      inputSchema: z.object({
        urls: z.array(z.string().url()).min(1).max(10).describe('URLs to scrape (max 10)'),
      }),
      execute: async ({ urls }: { urls: string[] }) => {
        const crawler = getCrawler();
        const results = await crawler.scrapeMany(urls, { concurrency: 5 });

        const pages: Array<{ url: string; title: string; content: string }> = [];
        for (const [u, result] of results) {
          pages.push({
            url: u,
            title: result.title,
            content: result.content.slice(0, 5000),
          });
        }
        return { pages, count: pages.length };
      },
    }),
  };
}
