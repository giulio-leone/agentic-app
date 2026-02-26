/**
 * WebSocket server for the Copilot SDK Bridge.
 *
 * Manages client connections, message validation, heartbeat keep-alive,
 * and graceful shutdown. Optionally runs over TLS with a provided
 * certificate/key pair.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createHttpsServer } from 'https';
import { createServer as createHttpServer, type Server } from 'http';
import type { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';

import type { BridgeConfig } from '../config.js';
import { ClientMessageSchema } from '../types.js';
import type { ClientMessage, BridgeMessage, ErrorResponse } from '../types.js';
import { errorMessage } from '../errors.js';

// ── Callback types ──

/** Invoked when a validated client message arrives. */
export type OnMessageCallback = (clientId: string, message: ClientMessage) => void;

/** Invoked to authenticate a new WebSocket client. Returns true if allowed. */
export type OnAuthenticateCallback = (clientId: string, token: string | null, req: IncomingMessage) => boolean;

/** Invoked when a new WebSocket client connects (after auth). */
export type OnConnectCallback = (clientId: string, req: IncomingMessage) => void;

/** Invoked when a WebSocket client disconnects. */
export type OnDisconnectCallback = (clientId: string) => void;

// ── TLS options ──

/** Optional TLS certificate/key pair for HTTPS mode. */
export interface TlsOptions {
  cert: string;
  key: string;
}

// ── Extended WebSocket with metadata ──

interface ClientSocket extends WebSocket {
  /** Whether the client responded to the last ping. */
  isAlive: boolean;
  /** Unique identifier assigned at connection time. */
  clientId: string;
}

// ── BridgeWebSocketServer ──

/**
 * WebSocket server that handles JSON-based message exchange between
 * the React Native app and the bridge process.
 *
 * Features:
 * - Optional TLS via self-signed cert
 * - Zod-validated incoming messages
 * - Ping/pong heartbeat with automatic cleanup
 * - Typed send / broadcast helpers
 * - Graceful shutdown with termination timeout
 */
export class BridgeWebSocketServer {
  private readonly config: BridgeConfig;
  private readonly onMessage: OnMessageCallback;
  private readonly onAuthenticate: OnAuthenticateCallback;
  private readonly onConnect: OnConnectCallback;
  private readonly onDisconnect: OnDisconnectCallback;

  private readonly clients = new Map<string, ClientSocket>();
  private httpServer: Server | ReturnType<typeof createHttpsServer>;
  private wss!: WebSocketServer;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    config: BridgeConfig,
    onMessage: OnMessageCallback,
    onAuthenticate: OnAuthenticateCallback,
    onConnect: OnConnectCallback,
    onDisconnect: OnDisconnectCallback,
    tlsOptions?: TlsOptions,
  ) {
    this.config = config;
    this.onMessage = onMessage;
    this.onAuthenticate = onAuthenticate;
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;

    // ── HTTP(S) server creation ──

    if (config.tls && tlsOptions) {
      this.httpServer = createHttpsServer({
        cert: tlsOptions.cert,
        key: tlsOptions.key,
      });
    } else {
      this.httpServer = createHttpServer();
    }

    this.initWebSocketServer();
  }

  // ── Server initialisation ──

  /** Attach the WebSocket server and wire up connection handling. */
  private initWebSocketServer(): void {
    this.wss = new WebSocketServer({ server: this.httpServer as Server });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const client = ws as ClientSocket;
      const clientId = uuidv4();
      client.clientId = clientId;
      client.isAlive = true;

      // Extract token from query param or Authorization header
      let token: string | null = null;
      try {
        const url = new URL(req.url ?? '', `http://${req.headers.host}`);
        token = url.searchParams.get('token');
      } catch { /* ignore malformed URL */ }
      if (!token) {
        const auth = req.headers['authorization'];
        if (auth?.startsWith('Bearer ')) {
          token = auth.slice(7).trim();
        }
      }

      // Authenticate before accepting the connection
      if (!this.onAuthenticate(clientId, token, req)) {
        console.log(`[ws] client rejected (unauthorized): ${clientId}`);
        ws.close(4001, 'Unauthorized');
        return;
      }

      this.clients.set(clientId, client);
      console.log(`[ws] client connected: ${clientId}`);
      this.onConnect(clientId, req);

      // ── Message handling ──

      client.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
        this.handleMessage(client, data);
      });

      // ── Pong handling ──

      client.on('pong', () => {
        client.isAlive = true;
      });

      // ── Disconnect handling ──

      client.on('close', () => {
        console.log(`[ws] client disconnected: ${clientId}`);
        this.clients.delete(clientId);
        this.onDisconnect(clientId);
      });

      client.on('error', (err) => {
        console.error(`[ws] client error (${clientId}):`, errorMessage(err));
      });
    });
  }

  // ── Message handling ──

  /** Parse, validate, and dispatch an incoming message. */
  private handleMessage(client: ClientSocket, data: Buffer | ArrayBuffer | Buffer[]): void {
    let raw: string;
    try {
      raw = data.toString();
    } catch {
      this.sendError(client.clientId, undefined, 'PARSE_ERROR', 'Unable to decode message');
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      this.sendError(client.clientId, undefined, 'PARSE_ERROR', 'Invalid JSON');
      return;
    }

    const result = ClientMessageSchema.safeParse(json);
    if (!result.success) {
      const id = (json as Record<string, unknown>)?.id as string | undefined;
      this.sendError(
        client.clientId,
        id,
        'VALIDATION_ERROR',
        result.error.issues.map((i) => i.message).join('; '),
      );
      return;
    }

    this.onMessage(client.clientId, result.data);
  }

  // ── Sending ──

  /**
   * Send a message to a specific client.
   * Silently drops if the client is not connected or not in OPEN state.
   */
  send(clientId: string, message: BridgeMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.readyState !== WebSocket.OPEN) return;
    client.send(JSON.stringify(message));
  }

  /** Broadcast a message to every connected client. */
  broadcast(message: BridgeMessage): void {
    const payload = JSON.stringify(message);
    for (const client of this.clients.values()) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  /** Send an ErrorResponse to a specific client. */
  private sendError(clientId: string, id: string | undefined, code: string, message: string): void {
    const err: ErrorResponse = {
      type: 'error',
      ...(id ? { id } : {}),
      payload: { code, message },
    };
    this.send(clientId, err);
  }

  // ── Heartbeat ──

  /** Start the ping/pong heartbeat loop. */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const [clientId, client] of this.clients) {
        if (!client.isAlive) {
          console.log(`[ws] terminating unresponsive client: ${clientId}`);
          this.clients.delete(clientId);
          client.terminate();
          this.onDisconnect(clientId);
          continue;
        }
        client.isAlive = false;
        client.ping();
      }
    }, this.config.heartbeatInterval);
  }

  /** Stop the heartbeat loop. */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  // ── Lifecycle ──

  /**
   * Start listening on the configured host and port.
   * Resolves once the server is ready to accept connections.
   */
  listen(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.httpServer.once('error', reject);
      this.httpServer.listen(this.config.port, this.config.host, () => {
        this.running = true;
        this.startHeartbeat();
        console.log(`[ws] server listening on ${this.url}`);
        resolve();
      });
    });
  }

  /**
   * Gracefully shut down the server.
   * Closes all client connections, stops the heartbeat, and closes
   * the underlying HTTP(S) server with a termination timeout.
   */
  close(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.stopHeartbeat();

      // Close every connected client
      for (const [, client] of this.clients) {
        client.close(1001, 'Server shutting down');
      }
      this.clients.clear();

      // Force-close after timeout
      const timeout = setTimeout(() => {
        console.log('[ws] forcing server close after timeout');
        this.wss.clients.forEach((ws) => ws.terminate());
        this.httpServer.close();
        this.running = false;
        resolve();
      }, 5_000);

      this.wss.close(() => {
        this.httpServer.close(() => {
          clearTimeout(timeout);
          this.running = false;
          console.log('[ws] server closed');
          resolve();
        });
      });
    });
  }

  // ── Properties ──

  /** Number of currently connected clients. */
  get clientCount(): number {
    return this.clients.size;
  }

  /** Whether the server is actively listening. */
  get isRunning(): boolean {
    return this.running;
  }

  /** The full URL the server is listening on. */
  get url(): string {
    const protocol = this.config.tls ? 'wss' : 'ws';
    return `${protocol}://${this.config.host}:${this.config.port}`;
  }
}
