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
import { CopilotJsonlParser } from '../parser/copilot-jsonl.js';
import { RawTextParser } from '../parser/raw-text.js';
import { Logger } from '../utils/logger.js';

const log = new Logger('session-mgr');

export type MessageSink = (msg: ServerMsg) => void;

export class SessionManager {
  private sessions = new Map<string, Session>();
  private spawner = new CliSpawner();
  private tmux = new TmuxManager();
  private parsers = new Map<string, ClaudeStreamParser | CopilotJsonlParser | RawTextParser>();
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

  /** Spawn an interactive session from an external read-only session's cwd */
  spawnFromExternal(externalSessionId: string): Session | null {
    const ext = this.sessions.get(externalSessionId);
    if (!ext || !ext.external) return null;
    return this.createSession({ cli: ext.cli, cwd: ext.cwd, model: ext.model });
  }

  /** Send a message (prompt) to a session */
  sendMessage(sessionId: string, content: string, sink: MessageSink): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      sink({ type: 'error', message: `Session not found: ${sessionId}`, sessionId });
      return;
    }

    if (session.readonly) {
      sink({
        type: 'error',
        message: 'This is a read-only session detected from the local Copilot CLI. Use "Spawn here" to create an interactive session in the same directory.',
        sessionId,
        code: 'READONLY_SESSION',
      });
      return;
    }

    const messageId = randomUUID().slice(0, 12);
    this.activePrompts.set(sessionId, messageId);
    session.lastActivity = new Date();

    // Create parser based on CLI type
    let parser: ClaudeStreamParser | CopilotJsonlParser | RawTextParser;
    if (session.cli === 'claude') {
      parser = new ClaudeStreamParser(sessionId, messageId, sink);
    } else if (session.cli === 'copilot') {
      parser = new CopilotJsonlParser(sessionId, messageId, sink);
    } else {
      parser = new RawTextParser(sessionId, messageId, sink);
    }
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
      external: s.external,
      readonly: s.readonly,
      branch: s.branch,
      repository: s.repository,
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

  // ── External Sessions (CLI watcher) ──

  /** Register an externally-detected CLI session (from ~/.copilot/session-state/) */
  registerExternalSession(opts: {
    id: string;
    cli: CliAgent;
    cwd: string;
    title?: string;
    repository?: string;
    branch?: string;
  }): boolean {
    if (this.sessions.has(opts.id)) return false;

    const session: Session = {
      id: opts.id,
      cli: opts.cli,
      cwd: opts.cwd,
      model: undefined,
      tmuxSession: '',
      alive: true,
      createdAt: new Date(),
      lastActivity: new Date(),
      title: opts.title,
      external: true,
      readonly: true,
      branch: opts.branch,
      repository: opts.repository,
    };
    this.sessions.set(opts.id, session);
    log.info('External session registered', { id: opts.id, cli: opts.cli, cwd: opts.cwd });

    // Notify all connected sinks about the new session
    this.broadcastSessionList();
    return true;
  }

  /** Forward a parsed events.jsonl event from an external session to connected sinks */
  forwardExternalEvent(sessionId: string, event: { type: string; data?: Record<string, unknown>; timestamp?: string }): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivity = new Date();
    const sink = this.getSink(sessionId);
    // Also broadcast to any client watching via session_list
    const broadcastSink = this.sinks.get('__broadcast__');

    const targets = [sink, broadcastSink].filter(Boolean) as MessageSink[];
    if (targets.length === 0) return;

    const send = (msg: ServerMsg) => targets.forEach(s => s(msg));

    switch (event.type) {
      case 'session.start':
        // Session already registered; update metadata if available
        if (event.data?.context) {
          const ctx = event.data.context as Record<string, string>;
          session.cwd = ctx.cwd ?? session.cwd;
          session.title = session.title || `Copilot • ${ctx.branch ?? sessionId.slice(4, 12)}`;
        }
        this.broadcastSessionList();
        break;

      case 'user.message':
        // Forward user message as a session event
        send({
          type: 'session_event',
          sessionId,
          event: 'user_message',
          detail: String((event.data as Record<string, unknown>)?.content ?? '').slice(0, 200),
        });
        break;

      case 'assistant.turn_start': {
        const msgId = String((event.data as Record<string, unknown>)?.turnId ?? randomUUID().slice(0, 12));
        this.activePrompts.set(sessionId, msgId);
        send({ type: 'assistant_start', sessionId, messageId: msgId });
        break;
      }

      case 'assistant.message_delta':
        if (event.data) {
          const msgId = this.activePrompts.get(sessionId) ?? 'unknown';
          const text = String((event.data as Record<string, unknown>)?.text ?? '');
          if (text) {
            send({ type: 'assistant_chunk', sessionId, messageId: msgId, text });
          }
        }
        break;

      case 'assistant.message': {
        const msgId = this.activePrompts.get(sessionId) ?? 'unknown';
        const content = String((event.data as Record<string, unknown>)?.content ?? '');
        if (content) {
          send({ type: 'assistant_chunk', sessionId, messageId: msgId, text: content });
        }
        // Extract tool requests
        const toolRequests = (event.data as Record<string, unknown>)?.toolRequests;
        if (Array.isArray(toolRequests)) {
          for (const tr of toolRequests) {
            const tool = tr as Record<string, unknown>;
            send({
              type: 'tool_use',
              sessionId,
              messageId: msgId,
              toolName: String(tool.name ?? 'unknown'),
              input: (tool.arguments ?? {}) as Record<string, unknown>,
            });
          }
        }
        break;
      }

      case 'tool.execution_start': {
        const msgId = this.activePrompts.get(sessionId) ?? 'unknown';
        const toolName = String((event.data as Record<string, unknown>)?.name ?? 'unknown');
        send({
          type: 'tool_use',
          sessionId,
          messageId: msgId,
          toolName,
          input: ((event.data as Record<string, unknown>)?.arguments ?? {}) as Record<string, unknown>,
        });
        break;
      }

      case 'tool.execution_complete': {
        const msgId = this.activePrompts.get(sessionId) ?? 'unknown';
        const toolName = String((event.data as Record<string, unknown>)?.name ?? 'tool');
        const output = String((event.data as Record<string, unknown>)?.output ?? '');
        send({
          type: 'tool_result',
          sessionId,
          messageId: msgId,
          toolName,
          output: output.slice(0, 5000),
          isError: (event.data as Record<string, unknown>)?.isError === true,
        });
        break;
      }

      case 'assistant.turn_end': {
        const msgId = this.activePrompts.get(sessionId) ?? 'unknown';
        send({
          type: 'assistant_end',
          sessionId,
          messageId: msgId,
          stopReason: 'end_turn',
        });
        this.activePrompts.delete(sessionId);
        break;
      }

      case 'result': {
        const msgId = this.activePrompts.get(sessionId) ?? 'unknown';
        const usage = event.data?.usage as Record<string, number> | undefined;
        send({
          type: 'assistant_end',
          sessionId,
          messageId: msgId,
          stopReason: 'end_turn',
          usage: usage ? {
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
          } : undefined,
        });
        this.activePrompts.delete(sessionId);
        break;
      }

      case 'session.end':
        session.alive = false;
        send({ type: 'session_event', sessionId, event: 'idle', detail: 'Session ended' });
        this.broadcastSessionList();
        break;
    }
  }

  /** Broadcast updated session list to all connected sinks */
  private broadcastSessionList(): void {
    const list = this.listSessions();
    for (const [, sink] of this.sinks) {
      sink({ type: 'session_list', sessions: list });
    }
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
        const usage =
          parser instanceof ClaudeStreamParser || parser instanceof CopilotJsonlParser
            ? parser.getUsage()
            : undefined;
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
