/**
 * SessionManager — multi-session management for Copilot SDK.
 *
 * Each connection can hold multiple Copilot sessions (keyed by sessionId).
 * Sessions are created with the configured model and streaming enabled.
 */

import type { CopilotClient, CopilotSession, Tool } from '@github/copilot-sdk';

export interface SessionEntry {
  session: CopilotSession;
  createdAt: Date;
  model: string;
}

export class CopilotSessionManager {
  private sessions = new Map<string, SessionEntry>();
  private counter = 0;

  /** Creates a new session and returns its ID (prefixed with 'copilot-'). */
  async create(
    client: CopilotClient,
    model: string,
    tools: Tool[],
    workingDirectory?: string,
    reasoningEffort?: 'low' | 'medium' | 'high'
  ): Promise<{ sessionId: string; session: CopilotSession }> {
    const sessionId = `copilot-${++this.counter}-${Date.now()}`;
    const sessionOpts: Record<string, unknown> = {
      model,
      streaming: true,
      tools,
      ...(workingDirectory ? { workingDirectory } : {}),
      ...(reasoningEffort ? { reasoningEffort } : {}),
    };

    let session: CopilotSession;
    try {
      session = await client.createSession(sessionOpts as Parameters<CopilotClient['createSession']>[0]);
    } catch (err) {
      // Retry without reasoning effort if model doesn't support it
      if (reasoningEffort && String(err).includes('reasoning effort')) {
        console.log(`[copilot] Model ${model} doesn't support reasoning effort, retrying without`);
        delete sessionOpts.reasoningEffort;
        session = await client.createSession(sessionOpts as Parameters<CopilotClient['createSession']>[0]);
      } else {
        throw err;
      }
    }

    this.sessions.set(sessionId, {
      session,
      createdAt: new Date(),
      model,
    });

    console.log(`[copilot] Created session ${sessionId} (model: ${model})`);
    return { sessionId, session };
  }

  /** Gets a session by ID. */
  get(sessionId: string): SessionEntry | undefined {
    return this.sessions.get(sessionId);
  }

  /** Destroys a session by ID. */
  async destroy(sessionId: string): Promise<boolean> {
    const entry = this.sessions.get(sessionId);
    if (!entry) return false;
    try {
      await entry.session.destroy();
    } catch { /* best-effort */ }
    this.sessions.delete(sessionId);
    console.log(`[copilot] Destroyed session ${sessionId}`);
    return true;
  }

  /** Lists all active sessions. */
  list(): Array<{ id: string; model: string; createdAt: string }> {
    return [...this.sessions.entries()].map(([id, entry]) => ({
      id,
      model: entry.model,
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  /** Destroys all sessions. */
  async destroyAll(): Promise<void> {
    for (const [id] of this.sessions) {
      await this.destroy(id);
    }
  }

  get size(): number {
    return this.sessions.size;
  }
}
