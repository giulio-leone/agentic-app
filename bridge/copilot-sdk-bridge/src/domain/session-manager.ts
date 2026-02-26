/**
 * SessionManager — LRU-evicting pool of Copilot SDK sessions.
 *
 * Manages creation, retrieval, eviction and destruction of chat
 * sessions, enforcing a configurable maximum pool size.
 */

import { SessionError, errorMessage } from '../errors.js';

// ── Types ──

/** Internal bookkeeping for a live session. */
export interface SessionEntry {
  session: unknown;
  sessionId: string;
  model: string;
  workingDirectory: string;
  createdAt: Date;
  lastActivity: Date;
}

/** Options accepted by {@link SessionManager.createSession}. */
export interface CreateSessionOptions {
  client: unknown;
  model?: string;
  workingDirectory?: string;
  tools?: unknown[];
  systemMessage?: string;
  mcpServers?: unknown[];
}

/** Public summary returned by {@link SessionManager.listSessions}. */
export interface SessionInfo {
  sessionId: string;
  model: string;
  createdAt: Date;
  lastActivity: Date;
}

// ── Session Manager ──

/**
 * Manages a bounded pool of Copilot SDK sessions with LRU eviction.
 *
 * When the pool is full the least-recently-used session (oldest
 * `lastActivity`) is evicted before a new one is created.
 */
export class SessionManager {
  private readonly sessions = new Map<string, SessionEntry>();
  private readonly maxSessions: number;
  private counter = 0;

  constructor(maxSessions: number) {
    this.maxSessions = maxSessions;
  }

  // ── Creation ──

  /**
   * Create a new Copilot session and register it in the pool.
   *
   * If the pool is at capacity the LRU session is evicted first.
   *
   * @returns The new session's ID and resolved model name.
   */
  async createSession(
    options: CreateSessionOptions,
  ): Promise<{ sessionId: string; model: string }> {
    const {
      client,
      model = 'gpt-4o',
      workingDirectory = process.cwd(),
      tools,
      systemMessage,
      mcpServers,
    } = options;

    if (this.sessions.size >= this.maxSessions) {
      this.evictLRU();
    }

    this.counter += 1;
    const sessionId = `copilot-${this.counter}-${Date.now()}`;

    const session = await (client as any).createSession({
      model,
      streaming: true,
      workingDirectory,
      tools,
      systemMessage,
      mcpServers,
      infiniteSessions: { enabled: true },
    });

    const now = new Date();
    this.sessions.set(sessionId, {
      session,
      sessionId,
      model,
      workingDirectory,
      createdAt: now,
      lastActivity: now,
    });

    console.log(`[sessions] Created session ${sessionId} (model=${model})`);
    return { sessionId, model };
  }

  // ── Retrieval ──

  /**
   * Retrieve a session entry by ID.
   *
   * @throws {SessionError} if the session does not exist.
   */
  getSession(sessionId: string): SessionEntry {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new SessionError(`Session not found: ${sessionId}`, sessionId);
    }
    return entry;
  }

  /**
   * Bump `lastActivity` to now — call on every prompt.
   */
  touchSession(sessionId: string): void {
    const entry = this.getSession(sessionId);
    entry.lastActivity = new Date();
  }

  /**
   * List all sessions sorted by `lastActivity` descending (most recent first).
   */
  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
      .map(({ sessionId, model, createdAt, lastActivity }) => ({
        sessionId,
        model,
        createdAt,
        lastActivity,
      }));
  }

  // ── Destruction ──

  /**
   * Destroy a single session (best-effort — never throws).
   */
  async destroySession(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;

    try {
      await (entry.session as any).abort();
    } catch (err) {
      console.warn(
        `[sessions] Failed to abort session ${sessionId}: ${errorMessage(err)}`,
      );
    }

    this.sessions.delete(sessionId);
    console.log(`[sessions] Destroyed session ${sessionId}`);
  }

  /**
   * Destroy every session in the pool. Used during shutdown.
   */
  async destroyAll(): Promise<void> {
    const ids = Array.from(this.sessions.keys());
    await Promise.all(ids.map((id) => this.destroySession(id)));
    console.log('[sessions] All sessions destroyed');
  }

  // ── Pool info ──

  /**
   * Returns the current number of live sessions.
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  // ── Project switching ──

  /**
   * Return an existing session for `workingDir`, or create a new one.
   *
   * Useful when the companion app switches between projects — avoids
   * creating duplicate sessions for the same directory.
   */
  async switchToProject(
    client: unknown,
    workingDir: string,
    model?: string,
    tools?: unknown[],
    mcpServers?: unknown[],
  ): Promise<{ sessionId: string; model: string }> {
    const entries = Array.from(this.sessions.values());
    for (const entry of entries) {
      if (entry.workingDirectory === workingDir) {
        this.touchSession(entry.sessionId);
        console.log(
          `[sessions] Reusing session ${entry.sessionId} for ${workingDir}`,
        );
        return { sessionId: entry.sessionId, model: entry.model };
      }
    }

    return this.createSession({
      client,
      model,
      workingDirectory: workingDir,
      tools,
      mcpServers,
    });
  }

  // ── LRU eviction (private) ──

  /**
   * Evict the least-recently-used session from the pool.
   */
  private evictLRU(): void {
    let oldest: SessionEntry | undefined;

    const all = Array.from(this.sessions.values());
    for (const entry of all) {
      if (!oldest || entry.lastActivity.getTime() < oldest.lastActivity.getTime()) {
        oldest = entry;
      }
    }

    if (oldest) {
      console.log(
        `[sessions] Evicted session ${oldest.sessionId} (LRU, inactive since ${oldest.lastActivity.toISOString()})`,
      );
      this.sessions.delete(oldest.sessionId);
      // Best-effort abort — fire and forget
      Promise.resolve((oldest.session as any).abort?.()).catch(() => { /* best-effort */ });
    }
  }
}
