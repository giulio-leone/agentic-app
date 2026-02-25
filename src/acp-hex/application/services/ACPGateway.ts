import {
  eventBus,
  type DomainEvent,
  type ConnectionState,
  type SessionId,
  type TransportType,
} from '../../domain';

import {
  JsonRpcResponseSchema,
  JsonRpcNotificationSchema,
  type JsonRpcResponse,
  type JsonRpcNotification,
} from '../../domain/schemas';

import {
  WebSocketAdapter,
  TCPAdapter,
  ResilientTransport,
  type ResilientTransportConfig,
} from '../../infrastructure/transport';

// ─── Config ──────────────────────────────────────────────────────────────────

export interface ACPGatewayConfig {
  endpoint: string; // "ws://host:port" or "tcp://host:port"
  transportType: TransportType;
  resilient?: Partial<ResilientTransportConfig>;
  tcpFallbackPort?: number;
}

// ─── JSON-RPC helpers ────────────────────────────────────────────────────────

function isResponse(data: unknown): data is JsonRpcResponse {
  return JsonRpcResponseSchema.safeParse(data).success;
}

function isNotification(data: unknown): data is JsonRpcNotification {
  const parsed = JsonRpcNotificationSchema.safeParse(data);
  // Notifications have no `id` field
  return parsed.success && !('id' in (data as Record<string, unknown>));
}

// ─── Pending request tracking ────────────────────────────────────────────────

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  method: string;
  timer: ReturnType<typeof setTimeout>;
}

// ─── ACPGateway ──────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000;

export class ACPGateway {
  private transport: ResilientTransport;
  private readonly pendingRequests = new Map<number | string, PendingRequest>();
  private idCounter = 0;
  private readonly eventBusUnsubscribers: Array<() => void> = [];
  private readonly config: ACPGatewayConfig;

  constructor(config: ACPGatewayConfig) {
    this.config = config;

    const inner = this.createInnerTransport(config);
    this.transport = new ResilientTransport(
      inner,
      config.transportType,
      config.resilient,
    );

    // Re-emit reconnection events so use cases can restart watches
    const unsub = eventBus.on('connection:stateChanged', (event) => {
      if (event.transport !== config.transportType) return;
      if (
        event.state === 'Connected' &&
        event.previousState === 'Reconnecting'
      ) {
        eventBus.emit({
          type: 'connection:stateChanged',
          state: 'Connected',
          previousState: 'Reconnecting',
          transport: config.transportType,
          timestamp: Date.now(),
        });
      }
    });
    this.eventBusUnsubscribers.push(unsub);
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.transport.connect();

    return new Promise<void>((resolve, reject) => {
      const unsub = eventBus.on('connection:stateChanged', (event) => {
        if (event.transport !== this.config.transportType) return;

        if (event.state === 'Connected') {
          unsub();
          resolve();
        }
        if (event.state === 'Failed') {
          unsub();
          reject(new Error('Connection failed'));
        }
      });
    });
  }

  disconnect(): void {
    // Reject all pending requests
    this.pendingRequests.forEach((pending, id) => {
      clearTimeout(pending.timer);
      pending.reject(new Error(`Disconnected while awaiting: ${pending.method}`));
    });
    this.pendingRequests.clear();

    this.transport.disconnect();
  }

  dispose(): void {
    this.disconnect();
    this.eventBusUnsubscribers.forEach((u) => u());
    this.eventBusUnsubscribers.length = 0;
  }

  get state(): ConnectionState {
    return this.transport.state;
  }

  // ─── JSON-RPC: request (expects response) ───────────────────────────────────

  async request<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    // Wait for connection if still connecting
    if (this.transport.state !== 'Connected') {
      await this.waitForConnected();
    }

    const id = ++this.idCounter;
    const message = { jsonrpc: '2.0' as const, id, method, params };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, {
        resolve: resolve as (r: unknown) => void,
        reject,
        method,
        timer,
      });

      this.transport.send(JSON.stringify(message) + '\n');
    });
  }

  // ─── JSON-RPC: notification (fire-and-forget) ──────────────────────────────

  async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    if (this.transport.state !== 'Connected') {
      await this.waitForConnected();
    }
    const message = { jsonrpc: '2.0' as const, method, params };
    this.transport.send(JSON.stringify(message) + '\n');
  }

  private waitForConnected(timeoutMs = 10_000): Promise<void> {
    if (this.transport.state === 'Connected') return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error(`Connection timeout: state is ${this.transport.state}`));
      }, timeoutMs);
      const unsub = eventBus.on('connection:stateChanged', (event) => {
        if (event.state === 'Connected') {
          clearTimeout(timer);
          unsub();
          resolve();
        }
        if (event.state === 'Failed' || event.state === 'Disconnected') {
          clearTimeout(timer);
          unsub();
          reject(new Error(`Connection ${event.state}`));
        }
      });
    });
  }

  // ─── Incoming message routing ──────────────────────────────────────────────

  private handleIncomingMessage(raw: string): void {
    // Acknowledge heartbeat on any incoming data
    this.transport.acknowledgeHeartbeat();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (isResponse(parsed)) {
      this.handleResponse(parsed);
    } else if (isNotification(parsed)) {
      this.handleNotification(parsed);
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(
        new Error(`${response.error.code}: ${response.error.message}`),
      );
    } else {
      pending.resolve(response.result);
    }
  }

  private handleNotification(notification: JsonRpcNotification): void {
    const { method, params } = notification;
    const timestamp = Date.now();

    switch (method) {
      case 'session/update':
      case 'notifications/session/update':
        eventBus.emit({
          type: 'session:updated',
          sessionId: (params?.sessionId ?? '') as SessionId,
          updates: params ?? {},
          timestamp,
        });
        break;

      case 'terminal/data':
        eventBus.emit({
          type: 'terminal:output',
          terminalId: String(params?.terminalId ?? ''),
          data: String(params?.data ?? ''),
          timestamp,
        });
        break;

      case 'terminal/exit':
        eventBus.emit({
          type: 'terminal:exited',
          terminalId: String(params?.terminalId ?? ''),
          exitCode: typeof params?.exitCode === 'number' ? params.exitCode : undefined,
          timestamp,
        });
        break;

      case 'copilot/pty/output':
        eventBus.emit({
          type: 'terminal:output',
          terminalId: String(params?.ptyId ?? ''),
          data: String(params?.data ?? ''),
          timestamp,
        });
        break;

      case 'copilot/pty/exit':
        eventBus.emit({
          type: 'terminal:exited',
          terminalId: String(params?.ptyId ?? ''),
          exitCode: typeof params?.exitCode === 'number' ? params.exitCode : undefined,
          timestamp,
        });
        break;

      case 'copilot/delta':
        eventBus.emit({
          type: 'cli:delta',
          sessionId: String(params?.sessionId ?? ''),
          deltaType: (params?.type as 'new_turn' | 'session_updated' | 'new_session') ?? 'session_updated',
          payload: params,
          timestamp,
        });
        break;
    }
  }

  // ─── Transport factory ─────────────────────────────────────────────────────

  private createInnerTransport(
    config: ACPGatewayConfig,
  ): WebSocketAdapter | TCPAdapter {
    const onMessage = (data: string) => this.handleIncomingMessage(data);

    if (config.transportType === 'tcp') {
      const url = new URL(config.endpoint.replace(/^tcp:/, 'http:'));
      return new TCPAdapter(
        { host: url.hostname, port: Number(url.port) || config.tcpFallbackPort || 7080 },
        onMessage,
      );
    }

    return new WebSocketAdapter({ endpoint: config.endpoint }, onMessage);
  }
}
