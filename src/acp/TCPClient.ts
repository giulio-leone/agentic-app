/**
 * ACP TCP NDJSON transport — for Copilot CLI ACP and other TCP-based agents.
 * Uses react-native-tcp-socket for raw TCP connections with newline-delimited JSON.
 */

import TcpSocket from 'react-native-tcp-socket';
import {
  ACPWireMessage,
  isRequest,
  isResponse,
  isNotification,
} from './models';
import { ACPConnectionState } from './models/types';
import type { ACPTransport, ACPTransportConfig, ACPTransportListener } from './ACPTransport';

export class TCPClient implements ACPTransport {
  private config: ACPTransportConfig;
  private socket: ReturnType<typeof TcpSocket.createConnection> | null = null;
  private listener: ACPTransportListener;
  private _state: ACPConnectionState = ACPConnectionState.Disconnected;
  private buffer = '';

  constructor(config: ACPTransportConfig, listener: ACPTransportListener = {}) {
    this.config = config;
    this.listener = listener;
  }

  get state(): ACPConnectionState {
    return this._state;
  }

  private setState(state: ACPConnectionState) {
    this._state = state;
    this.listener.onStateChange?.(state);
  }

  connect(): void {
    if (this._state !== ACPConnectionState.Disconnected) return;
    this.setState(ACPConnectionState.Connecting);

    try {
      const { host, port } = this.parseEndpoint();

      this.socket = TcpSocket.createConnection(
        { host, port },
        () => {
          this.setState(ACPConnectionState.Connected);
        },
      );

      this.socket.on('data', (data: string | Buffer) => {
        const text = typeof data === 'string' ? data : data.toString('utf8');
        this.handleIncomingData(text);
      });

      this.socket.on('error', (error: Error) => {
        const msg = error?.message || 'TCP connection error';
        this.setState(ACPConnectionState.Failed);
        this.listener.onError?.(new Error(`TCP error (${this.config.endpoint}): ${msg}`));
      });

      this.socket.on('close', (_hadError: boolean) => {
        if (this._state === ACPConnectionState.Connecting) {
          this.setState(ACPConnectionState.Failed);
          this.listener.onError?.(new Error(`TCP connection refused: ${this.config.endpoint}`));
        } else {
          this.setState(ACPConnectionState.Disconnected);
        }
        this.socket = null;
      });
    } catch (error) {
      this.setState(ACPConnectionState.Failed);
      this.listener.onError?.(error as Error);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.buffer = '';
    this.setState(ACPConnectionState.Disconnected);
  }

  send(message: ACPWireMessage): void {
    if (!this.socket) {
      throw new Error('TCP not connected');
    }
    const text = JSON.stringify(message) + '\n';
    this.socket.write(text);
  }

  private parseEndpoint(): { host: string; port: number } {
    // Accept "tcp://host:port" or "host:port"
    const clean = this.config.endpoint.replace(/^tcp:\/\//i, '');
    const colonIdx = clean.lastIndexOf(':');
    if (colonIdx === -1) throw new Error(`Invalid TCP endpoint: ${this.config.endpoint}`);
    const host = clean.substring(0, colonIdx);
    const port = parseInt(clean.substring(colonIdx + 1), 10);
    if (isNaN(port)) throw new Error(`Invalid port in endpoint: ${this.config.endpoint}`);
    return { host, port };
  }

  private handleIncomingData(data: string): void {
    this.buffer += data;
    this.processBuffer();
  }

  private processBuffer(): void {
    // NDJSON: split on newlines, parse complete lines
    let newlineIdx: number;
    while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.substring(0, newlineIdx).trim();
      this.buffer = this.buffer.substring(newlineIdx + 1);

      if (!line) continue;

      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed === 'object' && parsed.jsonrpc === '2.0') {
          this.listener.onMessage?.(parsed as ACPWireMessage);
        }
      } catch {
        // Skip malformed lines
      }
    }
  }
}
