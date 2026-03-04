/**
 * WebSocket Server — the main entry point for client connections.
 *
 * Handles:
 * - WebSocket upgrades with token auth
 * - Message routing via protocol handler
 * - Health/QR HTTP endpoints
 * - Graceful shutdown
 */

import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'http';
import { WebSocketServer, type WebSocket } from 'ws';
import { createProtocolHandler } from './protocol/handler.js';
import { SessionManager } from './session/manager.js';
import { NetworkManager } from './network/manager.js';
import { generateQRSvg } from './network/qrcode.js';
import type { ClientMsg, AuthConfig } from './protocol/messages.js';
import { Logger } from './utils/logger.js';

const log = new Logger('server');

export interface ServerConfig {
  port: number;
  auth?: AuthConfig;
}

export class ChatBridgeServer {
  private httpServer;
  private wss: WebSocketServer;
  private sessions = new SessionManager();
  private network: NetworkManager;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.network = new NetworkManager(config.port);

    this.httpServer = createHttpServer((req, res) => this.handleHttp(req, res));
    this.wss = new WebSocketServer({
      server: this.httpServer,
      verifyClient: (info, cb) => this.verifyClient(info, cb),
    });
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
  }

  /** Start the server */
  async start(): Promise<void> {
    // Discover network
    await this.network.discover();

    return new Promise((resolve) => {
      this.httpServer.listen(this.config.port, '0.0.0.0', () => {
        log.info(`Chat Bridge listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  /** Get the network manager (for QR code, status) */
  getNetwork(): NetworkManager {
    return this.network;
  }

  /** Get the session manager */
  getSessions(): SessionManager {
    return this.sessions;
  }

  /** Graceful shutdown */
  shutdown(): void {
    log.info('Shutting down...');
    this.sessions.shutdown();
    this.wss.close();
    this.httpServer.close();
  }

  // ── WebSocket ──

  private verifyClient(
    info: { req: IncomingMessage },
    cb: (res: boolean, code?: number, message?: string) => void,
  ): void {
    if (!this.config.auth?.token) { cb(true); return; }
    const url = new URL(info.req.url ?? '/', `http://${info.req.headers.host}`);
    const token = url.searchParams.get('token') ?? info.req.headers.authorization?.replace('Bearer ', '');
    if (token === this.config.auth.token) {
      cb(true);
    } else {
      log.warn('Unauthorized connection attempt');
      cb(false, 4001, 'Unauthorized');
    }
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    log.info('Client connected', { ip: req.socket.remoteAddress });

    const handler = createProtocolHandler(ws, this.sessions, this.network);

    ws.on('message', (data: Buffer | string) => {
      const text = typeof data === 'string' ? data : data.toString('utf-8');
      try {
        const msg = JSON.parse(text) as ClientMsg;
        handler.handle(msg);
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => {
      log.info('Client disconnected');
      handler.cleanup();
    });

    ws.on('error', (err) => {
      log.error('WebSocket error', { error: err.message });
      handler.cleanup();
    });

    // Send initial status
    ws.send(JSON.stringify({
      type: 'status',
      network: this.network.getInfo(),
      sessions: this.sessions.listSessions(),
      uptime: process.uptime(),
    }));
  }

  // ── HTTP endpoints (health, QR, status) ──

  private async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    switch (url.pathname) {
      case '/health': {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          uptime: process.uptime(),
          sessions: this.sessions.listSessions().length,
          network: this.network.getInfo(),
        }));
        break;
      }
      case '/qr': {
        const bestUrl = this.network.getBestUrl();
        const svg = await generateQRSvg(bestUrl);
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        res.end(svg);
        break;
      }
      case '/status': {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          network: this.network.getInfo(),
          sessions: this.sessions.listSessions(),
          uptime: process.uptime(),
        }));
        break;
      }
      default: {
        // WebSocket upgrade will be handled by ws library
        if (req.headers.upgrade?.toLowerCase() === 'websocket') return;
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Agmente Chat Bridge — connect via WebSocket');
      }
    }
  }
}
