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
    workingDirectory?: string
  ): Promise<{ sessionId: string; session: CopilotSession }> {
    const sessionId = `copilot-${++this.counter}-${Date.now()}`;
    const session = await client.createSession({
      model,
      streaming: true,
      tools,
      ...(workingDirectory ? { workingDirectory } : {}),
    });

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
