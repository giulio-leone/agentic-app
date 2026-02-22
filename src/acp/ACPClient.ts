/**
 * ACP WebSocket client – mirrors the Swift ACPClient.
 * Uses React Native's built-in WebSocket API.
 */

import {
  ACPWireMessage,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  isRequest,
  isResponse,
  isNotification,
} from './models';
import { ACPConnectionState } from './models/types';

export interface ACPClientConfig {
  endpoint: string;
  authToken?: string;
  additionalHeaders?: Record<string, string>;
  pingIntervalMs?: number;
  appendNewline?: boolean;
}

export type ACPClientListener = {
  onStateChange?: (state: ACPConnectionState) => void;
  onMessage?: (message: ACPWireMessage) => void;
  onError?: (error: Error) => void;
};

export class ACPClient {
  private config: ACPClientConfig;
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private listener: ACPClientListener;
  private _state: ACPConnectionState = ACPConnectionState.Disconnected;
  private buffer = '';

  constructor(config: ACPClientConfig, listener: ACPClientListener = {}) {
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
      this.ws = new WebSocket(this.config.endpoint);

      this.ws.onopen = () => {
        this.setState(ACPConnectionState.Connected);
        this.startHeartbeat();
      };

      this.ws.onmessage = (event: WebSocketMessageEvent) => {
        const data = event.data as string;
        this.handleIncomingData(data);
      };

      this.ws.onerror = (event: any) => {
        const detail = event?.message || event?.reason || '';
        const error = new Error(
          detail ? `WebSocket error: ${detail}` : `WebSocket error connecting to ${this.config.endpoint}`,
        );
        this.setState(ACPConnectionState.Failed);
        this.listener.onError?.(error);
      };

      this.ws.onclose = (event: any) => {
        this.stopHeartbeat();
        if (this._state === ACPConnectionState.Connecting) {
          const reason = event?.reason || event?.message || 'Connection refused';
          const error = new Error(`Connection failed (code ${event?.code ?? '?'}): ${reason}`);
          this.setState(ACPConnectionState.Failed);
          this.listener.onError?.(error);
        } else {
          this.setState(ACPConnectionState.Disconnected);
        }
      };
    } catch (error) {
      this.setState(ACPConnectionState.Failed);
      this.listener.onError?.(error as Error);
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState(ACPConnectionState.Disconnected);
  }

  send(message: ACPWireMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    let text = JSON.stringify(message);
    if (this.config.appendNewline !== false) {
      text += '\n';
    }
    this.ws.send(text);
  }

  private handleIncomingData(data: string): void {
    // Try to parse as single message first
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object' && parsed.jsonrpc === '2.0') {
        this.dispatchMessage(parsed as ACPWireMessage);
        return;
      }
    } catch {
      // Not a single JSON – try newline-delimited
    }

    // Newline-delimited messages
    const lines = data.split('\n').filter(l => l.trim().length > 0);
    if (lines.length > 1) {
      let allValid = true;
      const messages: ACPWireMessage[] = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed && parsed.jsonrpc === '2.0') {
            messages.push(parsed as ACPWireMessage);
          } else {
            allValid = false;
            break;
          }
        } catch {
          allValid = false;
          break;
        }
      }
      if (allValid && messages.length > 0) {
        messages.forEach(m => this.dispatchMessage(m));
        return;
      }
    }

    // Buffer-based fallback for fragmented data
    this.buffer += data;
    this.processBuffer();
  }

  private processBuffer(): void {
    while (this.buffer.length > 0) {
      const startIdx = this.buffer.indexOf('{');
      if (startIdx === -1) {
        this.buffer = '';
        return;
      }

      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let i = startIdx; i < this.buffer.length; i++) {
        const ch = this.buffer[i];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (inString) {
          if (ch === '\\') escaped = true;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') inString = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            const jsonStr = this.buffer.substring(startIdx, i + 1);
            this.buffer = this.buffer.substring(i + 1);
            try {
              const parsed = JSON.parse(jsonStr);
              this.dispatchMessage(parsed as ACPWireMessage);
            } catch {
              this.listener.onError?.(new Error('Failed to decode buffered message'));
            }
            break;
          }
        }
      }

      // If we didn't find a complete object, wait for more data
      if (depth > 0) break;
    }
  }

  private dispatchMessage(message: ACPWireMessage): void {
    this.listener.onMessage?.(message);
  }

  private startHeartbeat(): void {
    if (!this.config.pingIntervalMs) return;
    this.pingTimer = setInterval(() => {
      // WebSocket ping is handled at protocol level in RN
      // We send a lightweight JSON-RPC ping if needed
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send('');
        } catch {
          // ignore ping failures
        }
      }
    }, this.config.pingIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
