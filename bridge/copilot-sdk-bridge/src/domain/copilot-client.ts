/**
 * Resilient wrapper around the Copilot SDK client.
 *
 * Handles lazy initialisation, graceful shutdown, automatic restarts
 * and authentication checks so that upper layers never touch the raw
 * SDK directly.
 */

import { CopilotClient } from '@github/copilot-sdk';

import type { BridgeConfig } from '../config.js';
import { AuthenticationError, errorMessage } from '../errors.js';

// ── Types ──

/** Result of an authentication probe. */
export interface AuthStatus {
  authenticated: boolean;
  error?: string;
}

/** Trimmed model descriptor returned by {@link ResilientCopilotClient.listModels}. */
export interface ModelInfo {
  id: string;
  name: string;
  vendor: string;
  supportsReasoningEffort?: boolean;
}

// ── Client ──

/**
 * Wrapper that adds resilience (lazy start, graceful stop, restart)
 * around the low-level {@link CopilotClient} from `@github/copilot-sdk`.
 */
export class ResilientCopilotClient {
  private client: CopilotClient | null = null;
  private readonly cliPath: string | undefined;

  /** Whether the underlying SDK client has been started. */
  public isStarted = false;

  /** Timestamp of the last successful start, if any. */
  public startedAt: Date | null = null;

  constructor(config: Pick<BridgeConfig, 'copilotCliPath'>) {
    this.cliPath = config.copilotCliPath;
    console.info('[client] created — cliPath=%s', this.cliPath ?? '(default)');
  }

  // ── Lifecycle ──

  /**
   * Lazily initialise and start the SDK client.
   * If the client is already running it is returned immediately.
   */
  async ensureClient(): Promise<CopilotClient> {
    if (this.client && this.isStarted) {
      return this.client;
    }

    try {
      console.info('[client] starting SDK client…');
      this.client = new CopilotClient({ cliPath: this.cliPath });
      await this.client.start();
      this.isStarted = true;
      this.startedAt = new Date();
      console.info('[client] started at %s', this.startedAt.toISOString());
      return this.client;
    } catch (err: unknown) {
      this.client = null;
      this.isStarted = false;
      const msg = errorMessage(err);
      console.error('[client] start failed — %s', msg);
      throw new AuthenticationError(`Failed to start Copilot client: ${msg}`);
    }
  }

  /**
   * Gracefully stop the client.
   * Falls back to {@link CopilotClient.forceStop} when the normal
   * shutdown path throws.
   */
  async stop(): Promise<void> {
    if (!this.client) {
      console.info('[client] stop called but no client exists');
      return;
    }

    try {
      console.info('[client] stopping…');
      await this.client.stop();
      console.info('[client] stopped gracefully');
    } catch (err: unknown) {
      console.warn(
        '[client] graceful stop failed — forcing: %s',
        errorMessage(err),
      );
      try {
        this.client.forceStop();
      } catch (forceErr: unknown) {
        console.error(
          '[client] forceStop also failed: %s',
          errorMessage(forceErr),
        );
      }
    } finally {
      this.client = null;
      this.isStarted = false;
    }
  }

  /**
   * Restart the client (stop → ensureClient).
   */
  async restart(): Promise<CopilotClient> {
    console.info('[client] restarting…');
    await this.stop();
    return this.ensureClient();
  }

  // ── Queries ──

  /**
   * Probe whether the current credentials are valid by attempting
   * to list available models.
   */
  async isAuthenticated(): Promise<AuthStatus> {
    try {
      await this.listModels();
      console.info('[client] authentication check passed');
      return { authenticated: true };
    } catch (err: unknown) {
      const msg = errorMessage(err);
      console.warn('[client] authentication check failed — %s', msg);
      return { authenticated: false, error: msg };
    }
  }

  /**
   * List models exposed by the Copilot backend.
   * Auto-starts the client when it has not been started yet.
   */
  async listModels(): Promise<ModelInfo[]> {
    const client = await this.ensureClient();

    try {
      console.info('[client] listing models…');
      const models = await client.listModels();
      console.info('[client] found %d model(s)', models.length);

      return models.map((m) => {
        const raw = m as unknown as Record<string, unknown>;
        const capabilities = raw.capabilities as Record<string, unknown> | undefined;
        const supports = capabilities?.supports as Record<string, unknown> | undefined;
        return {
          id: m.id,
          name: (raw.name as string) ?? m.id,
          vendor: (raw.vendor as string) ?? 'unknown',
          ...(supports?.reasoningEffort != null
            ? { supportsReasoningEffort: Boolean(supports.reasoningEffort) }
            : {}),
        };
      });
    } catch (err: unknown) {
      const msg = errorMessage(err);
      console.error('[client] listModels failed — %s', msg);
      throw new AuthenticationError(`Failed to list models: ${msg}`);
    }
  }

  // ── Accessor ──

  /**
   * Return the active {@link CopilotClient} instance.
   *
   * @throws {AuthenticationError} if the client has not been started.
   */
  getClient(): CopilotClient {
    if (!this.client || !this.isStarted) {
      throw new AuthenticationError(
        'Copilot client is not started — call ensureClient() first',
      );
    }
    return this.client;
  }
}
