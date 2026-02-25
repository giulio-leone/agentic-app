import TcpSocket from 'react-native-tcp-socket';
import { type ConnectionState, eventBus } from '../../domain';

interface TCPAdapterConfig {
  host: string;
  port: number;
  connectionTimeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export class TCPAdapter {
  private socket: ReturnType<typeof TcpSocket.createConnection> | null = null;
  private _state: ConnectionState = 'Disconnected';
  private buffer = '';
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly config: Required<TCPAdapterConfig>;
  private readonly onMessage: (data: string) => void;

  constructor(config: TCPAdapterConfig, onMessage: (data: string) => void) {
    this.config = {
      ...config,
      connectionTimeoutMs: config.connectionTimeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
    this.onMessage = onMessage;
  }

  get state(): ConnectionState {
    return this._state;
  }

  connect(): void {
    if (this._state !== 'Disconnected') return;

    this.setState('Connecting');

    this.connectionTimer = setTimeout(() => {
      this.emitError('Connection timeout');
      this.cleanup();
      this.setState('Disconnected');
    }, this.config.connectionTimeoutMs);

    const socket = TcpSocket.createConnection(
      { host: this.config.host, port: this.config.port },
      () => {
        this.clearTimer();
        this.setState('Connected');
      },
    ) as unknown as import('net').Socket;

    this.socket = socket as unknown as ReturnType<typeof TcpSocket.createConnection>;

    socket.on('data', (data: Buffer | string) => {
      this.buffer += data.toString();
      let newlineIdx: number;
      while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, newlineIdx);
        this.buffer = this.buffer.slice(newlineIdx + 1);
        if (line.length > 0) this.onMessage(line);
      }
    });

    socket.on('error', (err: Error) => {
      this.emitError(err.message);
    });

    socket.on('close', () => {
      this.cleanup();
      this.setState('Disconnected');
    });
  }

  disconnect(): void {
    if (this._state === 'Disconnected') return;
    this.cleanup();
    this.setState('Disconnected');
  }

  send(data: string): void {
    if (this._state !== 'Connected' || !this.socket) {
      throw new Error('Cannot send: not connected');
    }
    this.socket.write(data);
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private setState(next: ConnectionState): void {
    if (next === this._state) return;
    const prev = this._state;
    this._state = next;
    eventBus.emit({
      type: 'connection:stateChanged',
      state: next,
      previousState: prev,
      transport: 'tcp',
      timestamp: Date.now(),
    });
  }

  private emitError(message: string): void {
    eventBus.emit({
      type: 'error:occurred',
      code: 'TRANSPORT_ERROR',
      message,
      context: { transport: 'tcp' },
      timestamp: Date.now(),
    });
  }

  private clearTimer(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  private cleanup(): void {
    this.clearTimer();
    this.buffer = '';
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }
}
