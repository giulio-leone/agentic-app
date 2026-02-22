/**
 * CodexProvider — ProviderAdapter implementation for OpenAI Codex app-server.
 *
 * Maps ACP session/prompt model to Codex thread/turn model.
 * Translates Codex streaming events (item/agentMessage/delta, item/started,
 * turn/completed) into ACP StreamCallbacks (agent_message_chunk, agent_event).
 */

import type {
  ProviderAdapter,
  ProviderInfo,
  ModelInfo,
  SessionInfo,
  SessionSummary,
  CreateSessionOpts,
  StreamCallbacks,
  AgentEvent,
  ProviderConfig,
} from '../../core/types.js';
import { CodexJsonRpcClient } from './jsonrpc.js';

interface CodexSession {
  threadId: string;
  activeTurnId: string | null;
  model: string;
  cwd: string;
  createdAt: Date;
}

export class CodexProvider implements ProviderAdapter {
  readonly id = 'codex';
  readonly name = 'OpenAI Codex';

  private client: CodexJsonRpcClient;
  private sessions = new Map<string, CodexSession>();
  private counter = 0;
  private defaultModel: string;
  private workingDirectory: string;
  private approvalPolicy: string;
  private sandbox: string;
  private cachedModels: ModelInfo[] = [];

  /** Active streaming callbacks per session (for routing notifications) */
  private activeCallbacks = new Map<string, StreamCallbacks>();
  /** Map threadId → sessionId for notification routing */
  private threadToSession = new Map<string, string>();

  constructor(config: ProviderConfig, workingDirectory: string) {
    this.defaultModel = config.model || 'codex-mini-latest';
    this.workingDirectory = workingDirectory;
    this.approvalPolicy = config.approvalPolicy || 'unless-allow-listed';
    this.sandbox = config.sandbox || 'workspaceWrite';
    this.client = new CodexJsonRpcClient({
      codexPath: config.codexPath,
      cwd: workingDirectory,
    });
  }

  async initialize(): Promise<ProviderInfo> {
    await this.client.start();

    // Wire up notification handling
    this.client.on('notification', (method: string, params: Record<string, unknown>) => {
      this.handleNotification(method, params);
    });

    // Fetch models
    const models = await this.fetchModels();
    this.cachedModels = models;

    return {
      id: this.id,
      name: this.name,
      version: '1.0.0',
      models: this.cachedModels,
      capabilities: {
        streaming: true,
        cancel: true,
        multiSession: true,
        agentEvents: true,
      },
    };
  }

  async shutdown(): Promise<void> {
    this.sessions.clear();
    this.activeCallbacks.clear();
    this.threadToSession.clear();
    await this.client.stop();
  }

  async listModels(): Promise<ModelInfo[]> {
    if (this.cachedModels.length === 0) {
      this.cachedModels = await this.fetchModels();
    }
    return this.cachedModels;
  }

  async createSession(opts: CreateSessionOpts): Promise<SessionInfo> {
    const model = opts.model || this.defaultModel;
    const cwd = opts.cwd || this.workingDirectory;
    const sessionId = `codex-${++this.counter}-${Date.now()}`;

    // Create a Codex thread
    const result = await this.client.request('thread/start', {
      model,
      cwd,
      approvalPolicy: this.approvalPolicy,
      sandbox: this.sandbox,
    }) as { thread: { id: string } };

    const threadId = result.thread.id;
    this.sessions.set(sessionId, {
      threadId,
      activeTurnId: null,
      model,
      cwd,
      createdAt: new Date(),
    });
    this.threadToSession.set(threadId, sessionId);

    console.log(`[codex] Created session ${sessionId} → thread ${threadId}`);

    return {
      id: sessionId,
      provider: this.id,
      model,
      cwd,
    };
  }

  async listSessions(): Promise<SessionSummary[]> {
    return [...this.sessions.entries()].map(([id, s]) => ({
      id,
      provider: this.id,
      model: s.model,
      createdAt: s.createdAt.toISOString(),
      cwd: s.cwd,
    }));
  }

  async destroySession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.threadToSession.delete(session.threadId);
    this.sessions.delete(sessionId);
    this.activeCallbacks.delete(sessionId);
    console.log(`[codex] Destroyed session ${sessionId}`);
    return true;
  }

  async prompt(
    sessionId: string,
    text: string,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      callbacks.onError(`Session not found: ${sessionId}`);
      return;
    }

    // Register callbacks for notification routing
    this.activeCallbacks.set(sessionId, callbacks);
    callbacks.onMessageStart();

    try {
      // Start a turn
      const result = await this.client.request('turn/start', {
        threadId: session.threadId,
        input: [{ type: 'user_message', content: text }],
      }) as { turn: { id: string } };

      session.activeTurnId = result.turn.id;

      // Wait for turn/completed notification
      await this.waitForTurnComplete(sessionId, session.threadId, result.turn.id);
    } catch (err) {
      callbacks.onError(err instanceof Error ? err.message : String(err));
    }

    callbacks.onMessageEnd();
    this.activeCallbacks.delete(sessionId);
  }

  async cancel(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session?.activeTurnId) return false;

    try {
      await this.client.request('turn/interrupt', {
        threadId: session.threadId,
        turnId: session.activeTurnId,
      });
      return true;
    } catch {
      return false;
    }
  }

  // ── Private helpers ──

  private async fetchModels(): Promise<ModelInfo[]> {
    try {
      const result = await this.client.request('model/list') as {
        models: Array<{ id: string; name?: string; hidden?: boolean }>;
      };
      return result.models
        .filter((m) => !m.hidden)
        .map((m) => ({
          id: m.id,
          name: m.name || m.id,
          provider: 'codex',
        }));
    } catch (err) {
      console.warn('[codex] Failed to list models:', err);
      return [];
    }
  }

  /** Wait for the turn/completed notification for a specific turn. */
  private waitForTurnComplete(
    sessionId: string,
    _threadId: string,
    turnId: string
  ): Promise<void> {
    return new Promise((resolve) => {
      const handler = (method: string, params: Record<string, unknown>) => {
        if (
          method === 'turn/completed' &&
          (params as { turnId?: string }).turnId === turnId
        ) {
          this.client.off('notification', handler);
          resolve();
        }
      };
      this.client.on('notification', handler);

      // Timeout safety net
      setTimeout(() => {
        this.client.off('notification', handler);
        const cb = this.activeCallbacks.get(sessionId);
        cb?.onError('Turn timeout — no completion received');
        resolve();
      }, 300_000); // 5 min max turn
    });
  }

  /** Route Codex notifications to the appropriate session's callbacks. */
  private handleNotification(method: string, params: Record<string, unknown>): void {
    // Extract threadId from various notification shapes
    const threadId =
      (params.threadId as string) ||
      (params.thread as { id?: string })?.id ||
      (params.item as { threadId?: string })?.threadId;

    if (!threadId) return;

    const sessionId = this.threadToSession.get(threadId);
    if (!sessionId) return;

    const callbacks = this.activeCallbacks.get(sessionId);
    if (!callbacks) return;

    switch (method) {
      case 'item/agentMessage/delta':
        this.handleMessageDelta(callbacks, params);
        break;

      case 'item/started':
        this.handleItemStarted(callbacks, params);
        break;

      case 'item/completed':
        this.handleItemCompleted(callbacks, params);
        break;

      default:
        // Other notifications are logged but not forwarded
        break;
    }
  }

  private handleMessageDelta(
    callbacks: StreamCallbacks,
    params: Record<string, unknown>
  ): void {
    const delta = params.delta as string | undefined;
    if (delta) {
      callbacks.onMessageChunk(delta);
    }
  }

  private handleItemStarted(
    callbacks: StreamCallbacks,
    params: Record<string, unknown>
  ): void {
    const item = params.item as Record<string, unknown> | undefined;
    if (!item) return;

    const kind = item.type as string;

    if (kind === 'command_call' || kind === 'shell') {
      const event: AgentEvent = {
        kind: 'terminal_command',
        name: (item.command as string) || (item.name as string),
        data: {
          args: item.args,
          cwd: item.cwd,
        },
        timestamp: Date.now(),
      };
      callbacks.onAgentEvent(event);
    } else if (kind === 'file_change' || kind === 'file_edit') {
      const event: AgentEvent = {
        kind: 'file_edit',
        name: (item.path as string) || (item.file as string),
        data: {
          action: item.action,
          content: item.content,
        },
        timestamp: Date.now(),
      };
      callbacks.onAgentEvent(event);
    } else if (kind === 'reasoning') {
      const event: AgentEvent = {
        kind: 'reasoning',
        output: (item.content as string) || (item.text as string),
        timestamp: Date.now(),
      };
      callbacks.onAgentEvent(event);
    }
  }

  private handleItemCompleted(
    callbacks: StreamCallbacks,
    params: Record<string, unknown>
  ): void {
    const item = params.item as Record<string, unknown> | undefined;
    if (!item) return;

    const kind = item.type as string;

    if (kind === 'command_call' || kind === 'shell') {
      const event: AgentEvent = {
        kind: 'terminal_output',
        name: (item.command as string) || (item.name as string),
        output: (item.output as string) || (item.stdout as string),
        data: {
          exitCode: item.exitCode ?? item.exit_code,
          stderr: item.stderr,
        },
        timestamp: Date.now(),
      };
      callbacks.onAgentEvent(event);
    }
  }
}
