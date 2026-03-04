/**
 * Session Manager — orchestrates CLI sessions.
 *
 * Manages the lifecycle of sessions: create, message, stop, resume, destroy.
 * Bridges between the WebSocket protocol layer and the CLI spawner.
 */

import { randomUUID } from 'crypto';
import { CliSpawner, type CliOutputEvent, type CliExitEvent } from '../cli/spawner.js';
import { TmuxManager } from './tmux.js';
import type { Session, SpawnOptions } from './types.js';
import type {
  CliAgent,
  SessionInfo,
  ServerAssistantStart,
  ServerAssistantChunk,
  ServerAssistantEnd,
  ServerToolUse,
  ServerToolResult,
  ServerThinking,
  ServerError,
  ServerSessionEvent,
  ServerMsg,
} from '../protocol/messages.js';
import { ClaudeStreamParser } from '../parser/stream-json.js';
import { RawTextParser } from '../parser/raw-text.js';
import { Logger } from '../utils/logger.js';

const log = new Logger('session-mgr');

export type MessageSink = (msg: ServerMsg) => void;

export class SessionManager {
  private sessions = new Map<string, Session>();
  private spawner = new CliSpawner();
  private tmux = new TmuxManager();
  private parsers = new Map<string, ClaudeStreamParser | RawTextParser>();
  private activePrompts = new Map<string, string>(); // sessionId → messageId

  constructor() {
    this.spawner.on('output', (evt: CliOutputEvent) => this.handleOutput(evt));
    this.spawner.on('exit', (evt: CliExitEvent) => this.handleExit(evt));
  }

  /** Create a new CLI session */
  createSession(opts: SpawnOptions): Session {
    const id = randomUUID().slice(0, 8);
    const session: Session = {
      id,
      cli: opts.cli,
      cwd: opts.cwd,
      model: opts.model,
      tmuxSession: `cb-${id}`,
      alive: true,
      createdAt: new Date(),
      lastActivity: new Date(),
    };
    this.sessions.set(id, session);
    log.info(`Session created`, { id, cli: opts.cli, cwd: opts.cwd });
    return session;
  }

  /** Send a message (prompt) to a session */
  sendMessage(sessionId: string, content: string, sink: MessageSink): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      sink({ type: 'error', message: `Session not found: ${sessionId}`, sessionId });
      return;
    }

    const messageId = randomUUID().slice(0, 12);
    this.activePrompts.set(sessionId, messageId);
    session.lastActivity = new Date();

    // Create parser based on CLI type
    const isStructured = session.cli === 'claude';
    const parser = isStructured
      ? new ClaudeStreamParser(sessionId, messageId, sink)
      : new RawTextParser(sessionId, messageId, sink);
    this.parsers.set(sessionId, parser);

    // Send assistant_start
    sink({ type: 'assistant_start', sessionId, messageId });

    // Spawn the CLI process
    try {
      this.spawner.spawn(sessionId, session.cli, content, session.cwd, session.model);
    } catch (err) {
      sink({
        type: 'error',
        message: `Failed to spawn ${session.cli}: ${(err as Error).message}`,
        sessionId,
      });
      this.parsers.delete(sessionId);
      this.activePrompts.delete(sessionId);
    }
  }

  /** Stop an active prompt */
  stop(sessionId: string, sink: MessageSink): void {
    const messageId = this.activePrompts.get(sessionId);
    this.spawner.kill(sessionId);
    this.parsers.delete(sessionId);
    this.activePrompts.delete(sessionId);

    if (messageId) {
      sink({
        type: 'assistant_end',
        sessionId,
        messageId,
        stopReason: 'user_stopped',
      });
    }
    sink({ type: 'session_event', sessionId, event: 'stopped' });
  }

  /** Destroy a session entirely */
  destroySession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.spawner.kill(sessionId);
    this.tmux.killSession(session.tmuxSession);
    this.parsers.delete(sessionId);
    this.activePrompts.delete(sessionId);
    this.sessions.delete(sessionId);
    log.info(`Session destroyed`, { sessionId });
    return true;
  }

  /** List all sessions */
  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      cli: s.cli,
      cwd: s.cwd,
      model: s.model,
      alive: s.alive,
      createdAt: s.createdAt.toISOString(),
      lastActivity: s.lastActivity.toISOString(),
      title: s.title,
    }));
  }

  /** Get a session by ID */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /** Shutdown all sessions */
  shutdown(): void {
    this.spawner.killAll();
    for (const [, session] of this.sessions) {
      this.tmux.killSession(session.tmuxSession);
    }
    this.sessions.clear();
    this.parsers.clear();
    this.activePrompts.clear();
  }

  // ── Internal ──

  private sinks = new Map<string, MessageSink>();

  /** Register a message sink for a session (called by WebSocket handler) */
  registerSink(sessionId: string, sink: MessageSink): void {
    this.sinks.set(sessionId, sink);
  }

  /** Unregister a sink */
  unregisterSink(sessionId: string): void {
    this.sinks.delete(sessionId);
  }

  private getSink(sessionId: string): MessageSink | undefined {
    return this.sinks.get(sessionId);
  }

  private handleOutput(evt: CliOutputEvent): void {
    const parser = this.parsers.get(evt.sessionId);
    if (parser) {
      parser.feed(evt.data);
    }
  }

  private handleExit(evt: CliExitEvent): void {
    const session = this.sessions.get(evt.sessionId);
    if (session) session.alive = false;

    const parser = this.parsers.get(evt.sessionId);
    if (parser) {
      parser.flush();
      this.parsers.delete(evt.sessionId);
    }

    const messageId = this.activePrompts.get(evt.sessionId);
    if (messageId) {
      const sink = this.getSink(evt.sessionId);
      if (sink) {
        // Emit final usage from parser if available
        const usage = parser instanceof ClaudeStreamParser ? parser.getUsage() : undefined;
        sink({
          type: 'assistant_end',
          sessionId: evt.sessionId,
          messageId,
          stopReason: evt.exitCode === 0 ? 'end_turn' : 'error',
          usage,
        });
      }
      this.activePrompts.delete(evt.sessionId);
    }

    const sink = this.getSink(evt.sessionId);
    if (sink) {
      sink({
        type: 'session_event',
        sessionId: evt.sessionId,
        event: evt.exitCode === 0 ? 'idle' : 'error',
        detail: `Exit code: ${evt.exitCode}`,
      });
    }
  }
}
