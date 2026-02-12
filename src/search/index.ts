/**
 * Search module — powered by OneCrawl (github.com/g97iulio1609/onecrawl).
 * Re-exports OneCrawl's cross-platform API for React Native.
 */

// Re-export OneCrawl native API
export { createOneCrawl } from 'onecrawl';
export type { OneCrawl } from 'onecrawl';

// AI SDK tool integration
export { buildSearchTools } from './SearchTools';
