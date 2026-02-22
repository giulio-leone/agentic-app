/**
 * ProviderRegistry — manages available provider adapters.
 *
 * Supports registration, lookup by ID, and resolution of session IDs
 * to their owning provider (via session prefix: 'copilot-xxx', 'codex-xxx').
 */

import type { ProviderAdapter, ProviderInfo } from './types.js';

export class ProviderRegistry {
  private providers = new Map<string, ProviderAdapter>();
  private providerInfo = new Map<string, ProviderInfo>();

  /** Register a provider adapter. */
  register(provider: ProviderAdapter): void {
    this.providers.set(provider.id, provider);
    console.log(`[registry] Registered provider: ${provider.id} (${provider.name})`);
  }

  /** Get a provider by ID. */
  get(id: string): ProviderAdapter | undefined {
    return this.providers.get(id);
  }

  /** Resolve a session ID to its owning provider. Session IDs are prefixed with provider ID. */
  resolveSession(sessionId: string): ProviderAdapter | undefined {
    for (const [id, provider] of this.providers) {
      if (sessionId.startsWith(`${id}-`)) {
        return provider;
      }
    }
    return undefined;
  }

  /** Initialize all registered providers. Returns combined info. */
  async initializeAll(): Promise<ProviderInfo[]> {
    const results: ProviderInfo[] = [];
    for (const [id, provider] of this.providers) {
      try {
        const info = await provider.initialize();
        this.providerInfo.set(id, info);
        results.push(info);
        console.log(`[registry] Initialized ${id}: ${info.models.length} models`);
      } catch (err) {
        console.error(`[registry] Failed to initialize ${id}:`, err);
      }
    }
    return results;
  }

  /** Get cached provider info. */
  getInfo(id: string): ProviderInfo | undefined {
    return this.providerInfo.get(id);
  }

  /** List all registered provider IDs. */
  list(): string[] {
    return [...this.providers.keys()];
  }

  /** Shutdown all providers. */
  async shutdownAll(): Promise<void> {
    for (const [id, provider] of this.providers) {
      try {
        await provider.shutdown();
        console.log(`[registry] Shutdown ${id}`);
      } catch (err) {
        console.error(`[registry] Error shutting down ${id}:`, err);
      }
    }
    this.providers.clear();
    this.providerInfo.clear();
  }

  get size(): number {
    return this.providers.size;
  }
}
