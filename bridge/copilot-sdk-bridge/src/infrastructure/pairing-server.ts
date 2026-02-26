/**
 * Infrastructure – Minimal HTTP server for the QR-code pairing flow.
 *
 * Runs on `port + 1` (e.g. 3031) alongside the main WebSocket server
 * and exposes endpoints that let a mobile device scan a QR code to
 * obtain the bridge URL + pairing token.
 *
 * Endpoints:
 *   GET  /pairing/qr       – HTML page with the QR code
 *   GET  /pairing/qr.png   – QR code as PNG image
 *   GET  /pairing/info     – JSON { url, token, name }
 *   POST /pairing/validate – Validate a token: { token } → { valid }
 */

import http from 'node:http';
import https from 'node:https';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';

import type { PairingTokenManager } from './security.js';

// ── Types ──

/** Options accepted by the {@link PairingServer} constructor. */
export interface PairingServerOptions {
  port: number;
  tls: boolean;
  cert?: string;
  key?: string;
  pairingManager: PairingTokenManager;
}

// ── Helpers ──

/**
 * Build the `agmente://` deep-link URL encoded in the QR code.
 * Format: `agmente://pair?url=<wsUrl>&token=<tok>&name=<name>`
 */
function buildPairingDeepLink(wsUrl: string, token: string, name: string): string {
  const params = new URLSearchParams({ url: wsUrl, token, name });
  return `agmente://pair?${params.toString()}`;
}

/** Return the first non-internal IPv4 address (LAN IP). */
function getLanIp(): string {
  const ifaces = networkInterfaces();
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

/** Read the full request body as a UTF-8 string. */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── PairingServer ──

/**
 * Lightweight HTTP server that serves QR-code pairing pages and a
 * validation endpoint for the React Native companion app.
 */
export class PairingServer {
  private readonly httpPort: number;
  private readonly tls: boolean;
  private readonly pairingManager: PairingTokenManager;
  private server: http.Server | https.Server | null = null;

  /** Cached QR PNG buffer + deep-link; regenerated via {@link regenerateToken}. */
  private qrPngBuffer: Buffer | null = null;
  private deepLink = '';

  constructor(opts: PairingServerOptions) {
    this.httpPort = opts.port + 1;
    this.tls = opts.tls;
    this.pairingManager = opts.pairingManager;

    if (opts.tls && opts.cert && opts.key) {
      this.server = https.createServer(
        { cert: opts.cert, key: opts.key },
        (req, res) => void this.handleRequest(req, res),
      );
    } else {
      this.server = http.createServer(
        (req, res) => void this.handleRequest(req, res),
      );
    }
  }

  // ── Public API ──

  /** Start listening on `port + 1`. */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) return reject(new Error('Server not initialised'));
      this.server.listen(this.httpPort, '0.0.0.0', () => {
        console.log(`[pairing] HTTP server listening on port ${this.httpPort}`);
        resolve();
      });
      this.server.once('error', reject);
    });
  }

  /** Stop the HTTP server. */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => {
        console.log('[pairing] HTTP server stopped');
        resolve();
      });
    });
  }

  /**
   * Generate a new pairing token and rebuild the QR code cache.
   *
   * @param wsUrl - The WebSocket URL the client should connect to.
   * @param ttlMs - Token time-to-live in milliseconds.
   * @param name  - Human-readable bridge name.
   */
  async regenerateToken(wsUrl: string, ttlMs: number, name = 'copilot-bridge'): Promise<void> {
    const token = this.pairingManager.generateToken(ttlMs);
    this.deepLink = buildPairingDeepLink(wsUrl, token.token, name);
    this.qrPngBuffer = await QRCode.toBuffer(this.deepLink, { type: 'png', width: 400 });
    console.log(`[pairing] QR regenerated — ${this.deepLink}`);
  }

  // ── Request routing ──

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const path = url.pathname;

    // CORS headers for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (req.method === 'GET' && path === '/pairing/qr') {
        await this.handleQrPage(res);
      } else if (req.method === 'GET' && path === '/pairing/qr.png') {
        await this.handleQrPng(res);
      } else if (req.method === 'GET' && path === '/pairing/info') {
        this.handleInfo(res);
      } else if (req.method === 'POST' && path === '/pairing/validate') {
        await this.handleValidate(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (err) {
      console.error(`[pairing] request error: ${err instanceof Error ? err.message : err}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  // ── Handlers ──

  /** GET /pairing/qr — HTML page with embedded QR code. */
  private async handleQrPage(res: http.ServerResponse): Promise<void> {
    const dataUrl = this.qrPngBuffer
      ? `data:image/png;base64,${this.qrPngBuffer.toString('base64')}`
      : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Agmente — Pair Device</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; display: flex;
           flex-direction: column; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #0d1117; color: #e6edf3; }
    h1 { font-size: 1.4rem; margin-bottom: .25rem; }
    p  { color: #8b949e; font-size: .9rem; margin-top: 0; }
    img { border-radius: 12px; background: #fff; padding: 16px; }
    code { background: #161b22; padding: 2px 8px; border-radius: 6px;
           font-size: .8rem; word-break: break-all; }
  </style>
</head>
<body>
  <h1>Scan to pair</h1>
  <p>Open Agmente on your phone and scan this QR code.</p>
  ${dataUrl ? `<img src="${dataUrl}" width="280" height="280" alt="QR Code" />` : '<p>No QR code available — token not generated.</p>'}
  <p style="margin-top:1rem;"><code>${this.deepLink}</code></p>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  /** GET /pairing/qr.png — Raw PNG image. */
  private async handleQrPng(res: http.ServerResponse): Promise<void> {
    if (!this.qrPngBuffer) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'QR code not generated yet' }));
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': String(this.qrPngBuffer.length),
      'Cache-Control': 'no-store',
    });
    res.end(this.qrPngBuffer);
  }

  /** GET /pairing/info — JSON pairing metadata. */
  private handleInfo(res: http.ServerResponse): void {
    const lanIp = getLanIp();
    const proto = this.tls ? 'wss' : 'ws';
    const wsPort = this.httpPort - 1;
    const wsUrl = `${proto}://${lanIp}:${wsPort}`;

    const active = this.pairingManager.getActiveTokenInfo(wsUrl);

    const body = {
      url: active?.url ?? wsUrl,
      token: active?.token ?? null,
      name: 'copilot-bridge',
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  /** POST /pairing/validate — Check whether a token is valid (non-destructive peek). */
  private async handleValidate(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const raw = await readBody(req);
    let token: string;
    try {
      const parsed = JSON.parse(raw) as { token?: string };
      token = parsed.token ?? '';
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const valid = this.pairingManager.validateToken(token);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ valid }));
  }
}
