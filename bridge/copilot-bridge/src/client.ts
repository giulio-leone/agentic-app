/**
 * ResilientCopilotClient — manages the Copilot CLI process lifecycle.
 *
 * Wraps CopilotClient with automatic start, graceful stop,
 * and restart capabilities.
 */

import { CopilotClient } from '@github/copilot-sdk';
import type { BridgeConfig } from './types.js';

export class ResilientCopilotClient {
  private client: CopilotClient | null = null;
  private config: BridgeConfig;

  constructor(config: BridgeConfig) {
    this.config = config;
  }

  /** Returns a running CopilotClient, starting one if needed. */
  async ensureClient(): Promise<CopilotClient> {
    if (!this.client) {
      this.client = new CopilotClient({
        cliPath: this.config.cliPath || undefined,
      });
      try {
        await this.client.start();
        console.log('[client] CopilotClient started');
      } catch (err) {
        this.client = null;
        throw new Error(
          `Copilot CLI not available: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    return this.client;
  }

  /** Force-restarts the client (stops then starts). */
  async restart(): Promise<void> {
    await this.stop();
    await this.ensureClient();
    console.log('[client] CopilotClient restarted');
  }

  /** Gracefully stops the client. */
  async stop(): Promise<void> {
    if (this.client) {
      try {
        await this.client.stop();
      } catch {
        try {
          await this.client.forceStop();
        } catch { /* best-effort */ }
      }
      this.client = null;
      console.log('[client] CopilotClient stopped');
    }
  }

  /** Lists available models from Copilot. */
  async listModels(): Promise<string[]> {
    const c = await this.ensureClient();
    try {
      const models = await c.listModels();
      return models
        .map((m: { id?: string }) => m.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
    } catch (err) {
      console.warn('[client] Failed to list models:', err);
      return [];
    }
  }

  /** Raw access to the underlying client. */
  get raw(): CopilotClient | null {
    return this.client;
  }
}
