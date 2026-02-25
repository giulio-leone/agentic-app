import { ConnectionState, eventBus } from '../../domain';

interface WebSocketAdapterConfig {
  endpoint: string;
  pingIntervalMs?: number;
  connectionTimeoutMs?: number;
}

export class WebSocketAdapter {
  private ws: WebSocket | null = null;
  private _state: ConnectionState = 'Disconnected';
  private buffer = '';
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private config: WebSocketAdapterConfig;
  private onMessage: (data: string) => void;

  constructor(config: WebSocketAdapterConfig, onMessage: (data: string) => void) {
    this.config = config;
    this.onMessage = onMessage;
  }

  get state(): ConnectionState {
    return this._state;
  }

  connect(): void {
    if (this._state !== 'Disconnected' && this._state !== 'Failed') return;

    this.setState('Connecting');
    this.buffer = '';

    const ws = new WebSocket(this.config.endpoint);
    this.ws = ws;

    const timeoutMs = this.config.connectionTimeoutMs ?? 10_000;
    this.connectionTimer = setTimeout(() => {
      if (this._state === 'Connecting') {
        this.emitError('Connection timeout');
        this.cleanup();
        this.setState('Failed');
      }
    }, timeoutMs);

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.clearConnectionTimer();
      this.setState('Connected');
      this.startHeartbeat();
    };

    ws.onmessage = (event: MessageEvent) => {
      if (this.ws !== ws) return;
      this.handleData(typeof event.data === 'string' ? event.data : String(event.data));
    };

    ws.onerror = (event: Event) => {
      if (this.ws !== ws) return;
      const message = (event as any).message ?? 'WebSocket error';
      this.emitError(message);
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.cleanup();
      if (this._state !== 'Disconnected') {
        this.setState('Disconnected');
      }
    };
  }

  disconnect(): void {
    const ws = this.ws;
    this.cleanup();
    this.setState('Disconnected');
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close();
    }
  }

  send(data: string): void {
    if (this._state !== 'Connected' || !this.ws) return;
    this.ws.send(data);
  }

  private handleData(raw: string): void {
    this.buffer += raw;

    const lines = this.buffer.split('\n');
    // Last element is either empty (complete batch) or a partial line
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        this.onMessage(trimmed);
      }
    }
  }

  private setState(next: ConnectionState): void {
    if (next === this._state) return;
    const previous = this._state;
    this._state = next;
    eventBus.emit({
      type: 'connection:stateChanged',
      state: next,
      previousState: previous,
      transport: 'websocket',
      timestamp: Date.now(),
    });
  }

  private emitError(message: string): void {
    eventBus.emit({
      type: 'error:occurred',
      code: 'TRANSPORT_ERROR',
      message,
      context: { transport: 'websocket' },
      timestamp: Date.now(),
    });
  }

  private startHeartbeat(): void {
    if (!this.config.pingIntervalMs) return;
    this.pingTimer = setInterval(() => {
      if (this._state === 'Connected' && this.ws) {
        this.ws.send('');
      }
    }, this.config.pingIntervalMs);
  }

  private clearConnectionTimer(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  private cleanup(): void {
    this.clearConnectionTimer();
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.buffer = '';
    this.ws = null;
  }
}
