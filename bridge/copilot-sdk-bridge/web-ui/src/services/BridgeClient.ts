/**
 * BridgeClient — singleton WebSocket client for the copilot-sdk-bridge web UI.
 * Mirrors the RN CopilotBridgeService adapted for browser WebSocket.
 */

import type {
  BridgeMessage,
  ConnectionState,
  ConsoleLogEntry,
  InitializeResult,
  ModelsListResult,
  SessionListResult,
  SessionNewResult,
  StreamCallbacks,
  StreamEventPayload,
  ErrorPayload,
  AuthStatusPayload,
  CliSessionsListResult,
  CliSessionsResumeResult,
  CliSessionsMessagesResult,
  CliSessionFilter,
} from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const CLIENT_VERSION = '1.0.0';
const REQUEST_TIMEOUT_MS = 15_000;
const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;
const MAX_LOG_ENTRIES = 500;

// ── Helpers ──────────────────────────────────────────────────────────────────

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Internal types ───────────────────────────────────────────────────────────

interface PendingRequest<T = unknown> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export type ConnectionStateListener = (state: ConnectionState) => void;
export type ConsoleLogListener = (log: ConsoleLogEntry[]) => void;

// ══════════════════════════════════════════════════════════════════════════════
//  BridgeClient
// ══════════════════════════════════════════════════════════════════════════════

export class BridgeClient {
  // ── Singleton ──────────────────────────────────────────────────────────────

  private static _instance: BridgeClient | null = null;

  static getInstance(): BridgeClient {
    if (!BridgeClient._instance) {
      BridgeClient._instance = new BridgeClient();
    }
    return BridgeClient._instance;
  }

  // ── Internal state ─────────────────────────────────────────────────────────

  private ws: WebSocket | null = null;
  private url: string | null = null;
  private _state: ConnectionState = 'disconnected';
  private pendingRequests = new Map<string, PendingRequest>();
  private activeStreamCallbacks = new Map<string, StreamCallbacks>();
  private stateListeners = new Set<ConnectionStateListener>();
  private logListeners = new Set<ConsoleLogListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = INITIAL_RECONNECT_MS;
  private shouldReconnect = true;
  private _consoleLog: ConsoleLogEntry[] = [];

  private constructor() {}

  // ── Public accessors ───────────────────────────────────────────────────────

  isConnected(): boolean {
    return this._state === 'connected' || this._state === 'authenticated';
  }

  get connectionState(): ConnectionState {
    return this._state;
  }

  get consoleLog(): ReadonlyArray<ConsoleLogEntry> {
    return this._consoleLog;
  }

  onConnectionStateChange(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    return () => { this.stateListeners.delete(listener); };
  }

  onConsoleLogChange(listener: ConsoleLogListener): () => void {
    this.logListeners.add(listener);
    return () => { this.logListeners.delete(listener); };
  }

  // ── Connection lifecycle ───────────────────────────────────────────────────

  connect(url: string): void {
    if (this.ws && this.url === url && this.isConnected()) return;

    if (this.ws) {
      this.errorAllActiveStreams(new Error('Replacing existing connection'));
      this.rejectAllPending(new Error('Replacing existing connection'));
      this.cleanupSocket();
    }

    this.url = url;
    this.shouldReconnect = true;
    this.reconnectDelay = INITIAL_RECONNECT_MS;
    this.setState('connecting');
    this.openSocket();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.rejectAllPending(new Error('Disconnected by client'));
    this.errorAllActiveStreams(new Error('Disconnected by client'));
    this.cleanupSocket();
    this.setState('disconnected');
  }

  // ── Protocol methods ───────────────────────────────────────────────────────

  async initialize(): Promise<InitializeResult> {
    const payload = await this.sendRequest<InitializeResult>('initialize', {
      clientVersion: CLIENT_VERSION,
    });
    if (payload.authenticated) this.setState('authenticated');
    return payload;
  }

  async listModels(): Promise<ModelsListResult> {
    return this.sendRequest<ModelsListResult>('models.list');
  }

  async listSessions(): Promise<SessionListResult> {
    return this.sendRequest<SessionListResult>('session.list');
  }

  async newSession(model: string, cwd?: string): Promise<SessionNewResult> {
    return this.sendRequest<SessionNewResult>('session.new', {
      model,
      ...(cwd ? { cwd } : {}),
    });
  }

  promptSession(
    sessionId: string,
    prompt: string,
    callbacks: StreamCallbacks,
  ): void {
    const id = uuid();
    this.activeStreamCallbacks.set(sessionId, callbacks);

    const msg: BridgeMessage = {
      type: 'session.prompt',
      id,
      payload: { sessionId, message: prompt },
    };
    this.sendRaw(msg);

    // Register pending for the ack — don't block the caller
    this.registerPending(id).catch((err) => {
      this.activeStreamCallbacks.delete(sessionId);
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    });
  }

  cancelSession(sessionId: string): void {
    const id = uuid();
    const msg: BridgeMessage = {
      type: 'session.cancel',
      id,
      payload: { sessionId },
    };
    this.sendRaw(msg);
    this.activeStreamCallbacks.delete(sessionId);
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.sendRequest('session.destroy', { sessionId });
    this.activeStreamCallbacks.delete(sessionId);
  }

  // ── CLI Session methods ────────────────────────────────────────────────────

  async listCliSessions(
    filter?: CliSessionFilter,
  ): Promise<CliSessionsListResult> {
    return this.sendRequest<CliSessionsListResult>(
      'cli.sessions.list',
      filter ? { filter } : undefined,
    );
  }

  async resumeCliSession(sessionId: string): Promise<CliSessionsResumeResult> {
    return this.sendRequest<CliSessionsResumeResult>('cli.sessions.resume', {
      sessionId,
    });
  }

  async getCliSessionMessages(
    sessionId: string,
  ): Promise<CliSessionsMessagesResult> {
    return this.sendRequest<CliSessionsMessagesResult>(
      'cli.sessions.getMessages',
      { sessionId },
    );
  }

  async deleteCliSession(sessionId: string): Promise<void> {
    await this.sendRequest('cli.sessions.delete', { sessionId });
  }

  // ── Internal: socket management ────────────────────────────────────────────

  private openSocket(): void {
    if (!this.url) return;

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.reconnectDelay = INITIAL_RECONNECT_MS;
      this.setState('connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      if (this.ws !== ws) return;
      const raw = typeof event.data === 'string' ? event.data : String(event.data);
      this.handleMessage(raw);
    };

    ws.onerror = () => {
      // onerror is always followed by onclose
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.cleanupSocket();
      this.rejectAllPending(new Error('WebSocket closed'));
      this.errorAllActiveStreams(new Error('WebSocket connection closed'));
      if (this.shouldReconnect && this._state !== 'disconnected') {
        this.scheduleReconnect();
      } else {
        this.setState('disconnected');
      }
    };
  }

  private cleanupSocket(): void {
    const ws = this.ws;
    this.ws = null;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close();
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.setState('connecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_MS);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ── Internal: state ────────────────────────────────────────────────────────

  private setState(next: ConnectionState): void {
    if (next === this._state) return;
    this._state = next;
    for (const listener of this.stateListeners) {
      try { listener(next); } catch { /* non-critical */ }
    }
  }

  // ── Internal: console log ──────────────────────────────────────────────────

  private pushLog(direction: 'in' | 'out', raw: string): void {
    let type = 'unknown';
    let id: string | undefined;
    try {
      const parsed = JSON.parse(raw);
      type = parsed.type ?? 'unknown';
      id = parsed.id;
    } catch { /* unparseable */ }

    const entry: ConsoleLogEntry = { timestamp: Date.now(), direction, type, raw, id };
    this._consoleLog.push(entry);
    if (this._consoleLog.length > MAX_LOG_ENTRIES) {
      this._consoleLog = this._consoleLog.slice(-MAX_LOG_ENTRIES);
    }
    const snapshot = this._consoleLog;
    for (const listener of this.logListeners) {
      try { listener(snapshot); } catch { /* non-critical */ }
    }
  }

  // ── Internal: request/response correlation ─────────────────────────────────

  private sendRequest<T>(type: string, payload?: unknown): Promise<T> {
    const id = uuid();
    const msg: BridgeMessage = { type, id, ...(payload !== undefined ? { payload } : {}) };
    this.sendRaw(msg);
    return this.registerPending<T>(id);
  }

  private registerPending<T>(id: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} timed out`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timeout,
      });
    });
  }

  private sendRaw(message: BridgeMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    const raw = JSON.stringify(message);
    this.pushLog('out', raw);
    this.ws.send(raw);
  }

  // ── Internal: cleanup helpers ──────────────────────────────────────────────

  private errorAllActiveStreams(error: Error): void {
    for (const [, callbacks] of this.activeStreamCallbacks) {
      try { callbacks.onError(error); } catch { /* best-effort */ }
    }
    this.activeStreamCallbacks.clear();
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  // ── Internal: message dispatch ─────────────────────────────────────────────

  private handleMessage(raw: string): void {
    this.pushLog('in', raw);

    let msg: BridgeMessage;
    try {
      msg = JSON.parse(raw) as BridgeMessage;
    } catch {
      return; // malformed JSON
    }

    // Application-level ping/pong
    if (msg.type === 'ping') {
      try { this.ws?.send(JSON.stringify({ type: 'pong' })); } catch { /* best-effort */ }
      return;
    }

    // 1. Response to a pending request
    if (msg.id && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id)!;
      this.pendingRequests.delete(msg.id);
      clearTimeout(pending.timeout);

      if (msg.type === 'error') {
        const ep = msg.payload as ErrorPayload;
        pending.reject(new Error(ep?.message ?? 'Bridge error'));
      } else {
        pending.resolve(msg.payload);
      }
      return;
    }

    // 2. Notifications
    switch (msg.type) {
      case 'stream.event':
        this.handleStreamEvent(msg.payload as StreamEventPayload);
        break;
      case 'auth.status':
        this.handleAuthStatus(msg.payload as AuthStatusPayload);
        break;
      case 'error':
        this.handleBroadcastError(msg.payload as ErrorPayload);
        break;
      default:
        break;
    }
  }

  private handleStreamEvent(payload: StreamEventPayload): void {
    const callbacks = this.activeStreamCallbacks.get(payload.sessionId);
    if (!callbacks) return;

    const data = payload.data ?? {};

    switch (payload.kind) {
      case 'message.start':
        break;
      case 'message.delta':
        callbacks.onContent(String(data.text ?? data.content ?? ''));
        break;
      case 'message.end': {
        const content =
          (data as Record<string, unknown>)?.data != null
            ? String((data as Record<string, Record<string, unknown>>).data.content ?? '')
            : String(data.content ?? data.text ?? '');
        if (content) callbacks.onContent(content);
        callbacks.onComplete();
        this.activeStreamCallbacks.delete(payload.sessionId);
        break;
      }
      case 'tool.call':
        callbacks.onToolCall?.(
          String(data.name ?? ''),
          JSON.stringify(data.args ?? {}),
        );
        break;
      case 'tool.result':
        callbacks.onToolResult?.(
          JSON.stringify(data.result ?? null),
        );
        break;
      case 'thinking':
        callbacks.onReasoning?.(String(data.text ?? ''));
        break;
      case 'error':
        callbacks.onError(String(data.message ?? 'Stream error'));
        this.activeStreamCallbacks.delete(payload.sessionId);
        break;
      case 'session.idle':
        callbacks.onComplete();
        this.activeStreamCallbacks.delete(payload.sessionId);
        break;
      default:
        break;
    }
  }

  private handleAuthStatus(payload: AuthStatusPayload): void {
    if (payload.authenticated) {
      this.setState('authenticated');
    } else if (this._state === 'authenticated') {
      this.setState('connected');
    }
  }

  private handleBroadcastError(payload: ErrorPayload): void {
    if (payload?.sessionId) {
      const callbacks = this.activeStreamCallbacks.get(payload.sessionId);
      if (callbacks) {
        callbacks.onError(new Error(payload.message));
        this.activeStreamCallbacks.delete(payload.sessionId);
      }
    }
  }
}
