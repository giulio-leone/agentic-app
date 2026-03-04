/**
 * ChatBridgeClient — WebSocket client for the Chat Bridge server.
 *
 * Connects to the bridge, sends messages, and emits events for streaming
 * responses. Designed to integrate with the Zustand store.
 */

import type {
  ClientMsg,
  ServerMsg,
  CliAgent,
  SessionInfo,
  NetworkInfo,
  UsageInfo,
} from './types';

// ── Event Callbacks ──

export interface ChatBridgeCallbacks {
  onConnected(): void;
  onDisconnected(): void;
  onError(error: string): void;

  onSessionCreated(sessionId: string, cli: CliAgent, cwd: string, model?: string): void;
  onSessionDestroyed(sessionId: string): void;
  onSessionList(sessions: SessionInfo[]): void;
  onSessionEvent(sessionId: string, event: string, detail?: string): void;

  onAssistantStart(sessionId: string, messageId: string): void;
  onAssistantChunk(sessionId: string, messageId: string, text: string): void;
  onToolUse(sessionId: string, messageId: string, toolName: string, input: Record<string, unknown>): void;
  onToolResult(sessionId: string, messageId: string, toolName: string, output: string, isError?: boolean): void;
  onThinking(sessionId: string, messageId: string, text: string): void;
  onAssistantEnd(sessionId: string, messageId: string, stopReason?: string, usage?: UsageInfo): void;

  onStatus(network: NetworkInfo, sessions: SessionInfo[], uptime: number): void;
}

// ── Connection State ──

export type BridgeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

// ── Client ──

export class ChatBridgeClient {
  private ws: WebSocket | null = null;
  private _state: BridgeConnectionState = 'disconnected';
  private endpoint = '';
  private token?: string;
  private callbacks: ChatBridgeCallbacks;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(callbacks: ChatBridgeCallbacks) {
    this.callbacks = callbacks;
  }

  get state(): BridgeConnectionState {
    return this._state;
  }

  /** Connect to the chat bridge */
  connect(endpoint: string, token?: string): void {
    if (this._state === 'connecting' || this._state === 'connected') {
      this.disconnect();
    }

    this.endpoint = endpoint;
    this.token = token;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  /** Disconnect from the bridge */
  disconnect(): void {
    this.clearTimers();
    this._state = 'disconnected';
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.callbacks.onDisconnected();
  }

  /** Send a message to the bridge */
  send(msg: ClientMsg): void {
    if (this._state !== 'connected' || !this.ws) {
      this.callbacks.onError('Not connected to bridge');
      return;
    }
    this.ws.send(JSON.stringify(msg));
  }

  // ── Convenience methods ──

  createSession(cli: CliAgent, cwd?: string, model?: string): void {
    this.send({ type: 'create_session', cli, cwd, model });
  }

  sendMessage(sessionId: string, content: string): void {
    this.send({ type: 'message', sessionId, content });
  }

  stopSession(sessionId: string): void {
    this.send({ type: 'stop', sessionId });
  }

  destroySession(sessionId: string): void {
    this.send({ type: 'destroy_session', sessionId });
  }

  listSessions(): void {
    this.send({ type: 'list_sessions' });
  }

  resumeSession(sessionId: string): void {
    this.send({ type: 'resume_session', sessionId });
  }

  getStatus(): void {
    this.send({ type: 'get_status' });
  }

  // ── Internal ──

  private doConnect(): void {
    this._state = 'connecting';

    const url = this.token
      ? `${this.endpoint}?token=${encodeURIComponent(this.token)}`
      : this.endpoint;

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this._state = 'connected';
      this.reconnectAttempts = 0;
      this.startPing();
      this.callbacks.onConnected();
    };

    ws.onmessage = (event: MessageEvent) => {
      if (this.ws !== ws) return;
      const text = typeof event.data === 'string' ? event.data : String(event.data);
      try {
        const msg = JSON.parse(text) as ServerMsg;
        this.handleMessage(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      if (this.ws !== ws) return;
      this.callbacks.onError('WebSocket error');
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.clearTimers();
      this.ws = null;

      if (this._state === 'connected') {
        this._state = 'disconnected';
        this.callbacks.onDisconnected();
        this.scheduleReconnect();
      } else {
        this._state = 'failed';
        this.callbacks.onDisconnected();
        this.scheduleReconnect();
      }
    };
  }

  private handleMessage(msg: ServerMsg): void {
    switch (msg.type) {
      case 'session_created':
        this.callbacks.onSessionCreated(msg.sessionId, msg.cli, msg.cwd, msg.model);
        break;
      case 'session_destroyed':
        this.callbacks.onSessionDestroyed(msg.sessionId);
        break;
      case 'session_list':
        this.callbacks.onSessionList(msg.sessions);
        break;
      case 'assistant_start':
        this.callbacks.onAssistantStart(msg.sessionId, msg.messageId);
        break;
      case 'assistant_chunk':
        this.callbacks.onAssistantChunk(msg.sessionId, msg.messageId, msg.text);
        break;
      case 'tool_use':
        this.callbacks.onToolUse(msg.sessionId, msg.messageId, msg.toolName, msg.input);
        break;
      case 'tool_result':
        this.callbacks.onToolResult(msg.sessionId, msg.messageId, msg.toolName, msg.output, msg.isError);
        break;
      case 'thinking':
        this.callbacks.onThinking(msg.sessionId, msg.messageId, msg.text);
        break;
      case 'assistant_end':
        this.callbacks.onAssistantEnd(msg.sessionId, msg.messageId, msg.stopReason, msg.usage);
        break;
      case 'status':
        this.callbacks.onStatus(msg.network, msg.sessions, msg.uptime);
        break;
      case 'error':
        this.callbacks.onError(msg.message);
        break;
      case 'session_event':
        this.callbacks.onSessionEvent(msg.sessionId, msg.event, msg.detail);
        break;
      case 'pong':
        break;
    }
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this._state === 'connected' && this.ws) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      if (this._state === 'disconnected' || this._state === 'failed') {
        this.doConnect();
      }
    }, delay);
  }

  private clearTimers(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }
}
