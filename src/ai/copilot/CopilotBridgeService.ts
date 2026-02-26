/**
 * CopilotBridgeService — singleton managing the WebSocket connection to the
 * copilot-sdk-bridge. Provides a streaming interface compatible with the
 * existing AI service callbacks (onChunk, onComplete, onError, …).
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  CopilotBridgeConfig,
  CopilotConnectionState,
  StreamCallbacks,
  ToolRequest,
  ClientMessage,
  BridgeEnvelope,
  InitializeResponsePayload,
  SessionNewResponsePayload,
  SessionListResponsePayload,
  ModelsListResponsePayload,
  McpListResponsePayload,
  StreamEventPayload,
  ToolRequestPayload,
  AuthStatusPayload,
  ErrorPayload,
} from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const CLIENT_VERSION = '1.0.0';
const REQUEST_TIMEOUT_MS = 15_000;
const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

// ── Pending request bookkeeping ──────────────────────────────────────────────

interface PendingRequest<T = unknown> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// ── Connection-state listener ────────────────────────────────────────────────

export type ConnectionStateListener = (state: CopilotConnectionState) => void;

// ══════════════════════════════════════════════════════════════════════════════
//  Service
// ══════════════════════════════════════════════════════════════════════════════

export class CopilotBridgeService {
  // ── Singleton ──────────────────────────────────────────────────────────────

  private static _instance: CopilotBridgeService | null = null;

  static getInstance(): CopilotBridgeService {
    if (!CopilotBridgeService._instance) {
      CopilotBridgeService._instance = new CopilotBridgeService();
    }
    return CopilotBridgeService._instance;
  }

  // ── Internal state ─────────────────────────────────────────────────────────

  private ws: WebSocket | null = null;
  private config: CopilotBridgeConfig | null = null;
  private _state: CopilotConnectionState = 'disconnected';
  private pendingRequests = new Map<string, PendingRequest>();
  private activeStreamCallbacks = new Map<string, StreamCallbacks>();
  private stateListeners = new Set<ConnectionStateListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = INITIAL_RECONNECT_MS;
  private shouldReconnect = true;

  private constructor() {}

  // ── Public accessors ───────────────────────────────────────────────────────

  isConnected(): boolean {
    return this._state === 'connected' || this._state === 'authenticated';
  }

  isAuthenticated(): boolean {
    return this._state === 'authenticated';
  }

  get connectionState(): CopilotConnectionState {
    return this._state;
  }

  onConnectionStateChange(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  // ── Connection lifecycle ───────────────────────────────────────────────────

  connect(config: CopilotBridgeConfig): void {
    if (this.ws) {
      this.errorAllActiveStreams(new Error('Replacing existing connection'));
      this.rejectAllPending(new Error('Replacing existing connection'));
      this.cleanupSocket();
    }

    this.config = config;
    this.shouldReconnect = config.reconnect !== false;
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

  async initialize(): Promise<InitializeResponsePayload> {
    const payload = await this.sendRequest<InitializeResponsePayload>({
      type: 'initialize',
      id: '',
      payload: { clientVersion: CLIENT_VERSION },
    });
    if (payload.authenticated) {
      this.setState('authenticated');
    }
    return payload;
  }

  async listModels(): Promise<ModelsListResponsePayload> {
    return this.sendRequest<ModelsListResponsePayload>({
      type: 'models.list',
      id: '',
    });
  }

  async createSession(model?: string): Promise<SessionNewResponsePayload> {
    return this.sendRequest<SessionNewResponsePayload>({
      type: 'session.new',
      id: '',
      payload: { model },
    });
  }

  async listSessions(): Promise<SessionListResponsePayload> {
    return this.sendRequest<SessionListResponsePayload>({
      type: 'session.list',
      id: '',
    });
  }

  streamPrompt(
    sessionId: string,
    message: string,
    callbacks: StreamCallbacks,
  ): AbortController {
    const controller = new AbortController();
    const id = uuidv4();

    this.activeStreamCallbacks.set(sessionId, callbacks);

    const cleanup = () => {
      this.activeStreamCallbacks.delete(sessionId);
    };

    controller.signal.addEventListener('abort', () => {
      cleanup();
      this.cancelPrompt(sessionId).catch(() => {});
    });

    const raw: ClientMessage = {
      type: 'session.prompt',
      id,
      payload: { sessionId, message },
    };

    this.sendRaw({ ...raw, id });

    // Register pending for the ack, but don't block the caller
    this.registerPending(id).catch((err) => {
      cleanup();
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    });

    return controller;
  }

  async cancelPrompt(sessionId: string): Promise<void> {
    await this.sendRequest({
      type: 'session.cancel',
      id: '',
      payload: { sessionId },
    });
    this.activeStreamCallbacks.delete(sessionId);
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.sendRequest({
      type: 'session.destroy',
      id: '',
      payload: { sessionId },
    });
    this.activeStreamCallbacks.delete(sessionId);
  }

  async respondToTool(
    sessionId: string,
    toolCallId: string,
    result: unknown,
    approved?: boolean,
  ): Promise<void> {
    await this.sendRequest({
      type: 'tool.response',
      id: '',
      payload: { sessionId, toolCallId, result, approved },
    });
  }

  async listMcpServers(): Promise<McpListResponsePayload> {
    return this.sendRequest<McpListResponsePayload>({
      type: 'mcp.list',
      id: '',
    });
  }

  async toggleMcpServer(serverId: string, enabled: boolean): Promise<void> {
    await this.sendRequest({
      type: 'mcp.toggle',
      id: '',
      payload: { serverId, enabled },
    });
  }

  // ── Internal: socket management ────────────────────────────────────────────

  private openSocket(): void {
    if (!this.config) return;

    const ws = new WebSocket(this.config.url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.reconnectDelay = INITIAL_RECONNECT_MS;
      this.setState('connected');

      // Auto-send token if present
      if (this.config?.token) {
        this.initialize().catch(() => {});
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      if (this.ws !== ws) return;
      this.handleMessage(typeof event.data === 'string' ? event.data : String(event.data));
    };

    ws.onerror = () => {
      if (this.ws !== ws) return;
      // onerror is always followed by onclose on RN WebSocket
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

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_MS);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ── Internal: state ────────────────────────────────────────────────────────

  private setState(next: CopilotConnectionState): void {
    if (next === this._state) return;
    this._state = next;
    Array.from(this.stateListeners).forEach((listener) => {
      try { listener(next); } catch { /* listener error is non-critical */ }
    });
  }

  // ── Internal: request/response correlation ─────────────────────────────────

  private sendRequest<T>(message: Omit<ClientMessage, 'id'> & { id: string }): Promise<T> {
    const id = uuidv4();
    const withId = { ...message, id } as ClientMessage;
    this.sendRaw(withId);
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

  private sendRaw(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
    this.ws.send(JSON.stringify(message));
  }

  private errorAllActiveStreams(error: Error): void {
    for (const [, callbacks] of this.activeStreamCallbacks) {
      try {
        callbacks.onError(error);
      } catch { /* best-effort */ }
    }
    this.activeStreamCallbacks.clear();
  }

  private rejectAllPending(error: Error): void {
    Array.from(this.pendingRequests.values()).forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(error);
    });
    this.pendingRequests.clear();
  }

  // ── Internal: message dispatch ─────────────────────────────────────────────

  private handleMessage(raw: string): void {
    let msg: BridgeEnvelope;
    try {
      msg = JSON.parse(raw) as BridgeEnvelope;
    } catch {
      return; // malformed JSON — ignore
    }

    // 1. Response to a pending request
    if (msg.id && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id)!;
      this.pendingRequests.delete(msg.id);
      clearTimeout(pending.timeout);

      if (msg.type === 'error') {
        const ep = msg.payload as ErrorPayload;
        pending.reject(new Error(ep.message ?? 'Bridge error'));
      } else {
        pending.resolve(msg.payload);
      }
      return;
    }

    // 2. Notifications (no id or unmatched id)
    switch (msg.type) {
      case 'stream.event':
        this.handleStreamEvent(msg.payload as StreamEventPayload);
        break;
      case 'tool.request':
        this.handleToolRequest(msg.payload as ToolRequestPayload);
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
        // no-op
        break;
      case 'message.delta':
        callbacks.onChunk(String(data.text ?? ''));
        break;
      case 'message.end':
        callbacks.onComplete('stop');
        this.activeStreamCallbacks.delete(payload.sessionId);
        break;
      case 'tool.call':
        callbacks.onToolCall?.(
          String(data.name ?? ''),
          JSON.stringify(data.args ?? {}),
        );
        break;
      case 'tool.result':
        callbacks.onToolResult?.(
          String(data.name ?? ''),
          JSON.stringify(data.result ?? null),
        );
        break;
      case 'thinking':
        callbacks.onReasoning?.(String(data.text ?? ''));
        break;
      case 'error':
        callbacks.onError(new Error(String(data.message ?? 'Stream error')));
        this.activeStreamCallbacks.delete(payload.sessionId);
        break;
      case 'session.idle':
        callbacks.onComplete('stop');
        this.activeStreamCallbacks.delete(payload.sessionId);
        break;
      default:
        break;
    }
  }

  private handleToolRequest(payload: ToolRequestPayload): void {
    const callbacks = this.activeStreamCallbacks.get(payload.sessionId);
    if (!callbacks?.onToolRequest) return;

    const request: ToolRequest = {
      kind: payload.kind,
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      message: payload.message ?? '',
      args: payload.args,
    };
    callbacks.onToolRequest(request);
  }

  private handleAuthStatus(payload: AuthStatusPayload): void {
    if (payload.authenticated) {
      this.setState('authenticated');
    } else if (this._state === 'authenticated') {
      this.setState('connected');
    }
  }

  private handleBroadcastError(payload: ErrorPayload): void {
    // Route session-specific errors to the appropriate stream callbacks
    if (payload.sessionId) {
      const callbacks = this.activeStreamCallbacks.get(payload.sessionId);
      if (callbacks) {
        callbacks.onError(new Error(payload.message));
        this.activeStreamCallbacks.delete(payload.sessionId);
      }
    }
  }
}
