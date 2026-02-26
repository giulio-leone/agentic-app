/**
 * Copilot SDK Bridge — WebSocket gateway for React Native.
 *
 * Exposes the @github/copilot-sdk over a WebSocket so a React Native
 * companion app can drive Copilot conversations, stream responses,
 * and manage MCP tool servers.
 *
 * Usage:
 *   npx tsx src/index.ts [options]
 *
 * Options:
 *   --port <n>             WebSocket port      (default: 3030)
 *   --host <addr>          Bind address         (default: 0.0.0.0)
 *   --tls                  Enable TLS (self-signed)
 *   --copilot-cli-path <p> Path to copilot binary
 *   --max-sessions <n>     Max concurrent sessions (default: 5)
 */

import { parseConfig } from './config.js';
import type { BridgeConfig } from './config.js';
import { errorMessage } from './errors.js';

// ── Domain ──

import { ResilientCopilotClient } from './domain/copilot-client.js';
import { SessionManager } from './domain/session-manager.js';
import { McpRegistry } from './domain/mcp-registry.js';

// ── Infrastructure ──

import { BridgeWebSocketServer } from './infrastructure/ws-server.js';
import {
  PairingTokenManager,
  ConnectionAuthenticator,
  RateLimiter,
  generateSelfSignedCert,
  generatePairingQR,
} from './infrastructure/security.js';
import { MdnsAdvertiser } from './infrastructure/mdns-advertiser.js';
import { PairingServer } from './infrastructure/pairing-server.js';
import type { TlsOptions } from './infrastructure/ws-server.js';

// ── Application ──

import { ProtocolHandler } from './application/protocol-handler.js';

// ── CLI args ──

const config: BridgeConfig = parseConfig();

// ── Shared references (set in main, used in shutdown) ──

let wss: BridgeWebSocketServer | undefined;
let sessions: SessionManager | undefined;
let client: ResilientCopilotClient | undefined;
let pairingManager: PairingTokenManager | undefined;
let pairingServer: PairingServer | undefined;
let mdnsAdvertiser: MdnsAdvertiser | undefined;

// ── Startup banner ──

/** Print a formatted banner with the current configuration. */
function printBanner(cfg: BridgeConfig): void {
  const proto = cfg.tls ? 'wss' : 'ws';
  const url = `${proto}://${cfg.host}:${cfg.port}`;

  const lines = [
    '┌─────────────────────────────────────────┐',
    '│   Copilot SDK Bridge                     │',
    '├─────────────────────────────────────────┤',
    `│  URL          ${url.padEnd(26)}│`,
    `│  TLS          ${String(cfg.tls).padEnd(26)}│`,
    `│  Max sessions ${String(cfg.maxSessions).padEnd(26)}│`,
    `│  Heartbeat    ${(cfg.heartbeatInterval + ' ms').padEnd(26)}│`,
    `│  Timeout      ${(cfg.operationTimeout + ' ms').padEnd(26)}│`,
    '└─────────────────────────────────────────┘',
  ];

  for (const l of lines) {
    console.log(`[bridge] ${l}`);
  }
}

// ── Graceful shutdown ──

let isShuttingDown = false;

/**
 * Perform a graceful shutdown — close the server, destroy all
 * sessions, stop the Copilot client, and clean up resources.
 */
async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[bridge] ${signal} received — shutting down…`);

  try {
    if (wss) await wss.close();
  } catch (err: unknown) {
    console.warn(`[bridge] WSS close error: ${errorMessage(err)}`);
  }

  try {
    if (sessions) await sessions.destroyAll();
  } catch (err: unknown) {
    console.warn(`[bridge] Session cleanup error: ${errorMessage(err)}`);
  }

  try {
    if (client) await client.stop();
  } catch (err: unknown) {
    console.warn(`[bridge] Client stop error: ${errorMessage(err)}`);
  }

  try {
    if (pairingServer) await pairingServer.stop();
  } catch (err: unknown) {
    console.warn(`[bridge] Pairing server stop error: ${errorMessage(err)}`);
  }

  try {
    if (mdnsAdvertiser) mdnsAdvertiser.stop();
  } catch (err: unknown) {
    console.warn(`[bridge] mDNS stop error: ${errorMessage(err)}`);
  }

  pairingManager?.dispose();

  console.log('[bridge] Goodbye.');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// ── Start ──

async function main(): Promise<void> {
  printBanner(config);

  // ── Initialize domain ──

  client = new ResilientCopilotClient(config);
  await client.ensureClient();

  const authResult = await client.isAuthenticated();
  if (authResult.authenticated) {
    console.log('[bridge] ✓ Copilot authenticated');
  } else {
    console.warn(`[bridge] ⚠ Copilot not authenticated: ${authResult.error}`);
  }

  sessions = new SessionManager(config.maxSessions);

  const mcpRegistry = new McpRegistry();
  await mcpRegistry.loadConfig();

  // ── Initialize security ──

  pairingManager = new PairingTokenManager();
  const authenticator = new ConnectionAuthenticator(pairingManager);
  const rateLimiter = new RateLimiter();

  let tlsOptions: TlsOptions | undefined;
  if (config.tls) {
    const cert = generateSelfSignedCert();
    tlsOptions = { cert: cert.cert, key: cert.key };
  }

  // ── Initialize application + infrastructure ──

  const handler = new ProtocolHandler(
    client,
    sessions,
    mcpRegistry,
    authenticator,
    rateLimiter,
  );

  wss = new BridgeWebSocketServer(
    config,
    (clientId, msg) => handler.handleMessage(clientId, msg),
    (clientId, token, req) => {
      const result = authenticator.authenticateConnection(token ?? '', req);
      if (!result.authenticated) return false;
      // Map the WS-assigned clientId to the authenticator's record
      authenticator.removeClient(result.clientId);
      (authenticator as any).authenticated.set(clientId, true);
      return true;
    },
    (clientId, _req) => handler.handleConnect(clientId),
    (clientId) => handler.handleDisconnect(clientId),
    tlsOptions,
  );

  handler.setWebSocketServer(wss);

  await wss.listen();

  // ── Start mDNS advertisement ──

  mdnsAdvertiser = new MdnsAdvertiser({
    port: config.port,
    tls: config.tls,
  });
  mdnsAdvertiser.start();

  const svcInfo = mdnsAdvertiser.getServiceInfo();
  if (svcInfo) {
    console.log(
      `[bridge] ✓ mDNS advertising as "${svcInfo.name}" on port ${svcInfo.port}`,
    );
  }

  // ── Generate pairing token ──

  const token = pairingManager.generateToken(config.pairingTokenTtl);
  const qr = await generatePairingQR(wss.url, token.token);
  console.log('[bridge] Scan this QR code to pair:\n' + qr.ascii);
  console.log(`[bridge] Or use token: ${token.token}`);
  console.log(`[bridge] URL: ${wss.url}`);

  // ── Start pairing HTTP server ──

  pairingServer = new PairingServer({
    port: config.port,
    tls: config.tls,
    cert: tlsOptions?.cert,
    key: tlsOptions?.key,
    pairingManager,
  });

  await pairingServer.regenerateToken(wss.url, config.pairingTokenTtl);
  await pairingServer.start();

  const pairingProto = config.tls ? 'https' : 'http';
  console.log(
    `[bridge] Pairing page: ${pairingProto}://localhost:${config.port + 1}/pairing/qr`,
  );

  console.log('[bridge] ✓ Server ready');
}

main().catch((err: unknown) => {
  console.error(`[bridge] Fatal: ${errorMessage(err)}`);
  process.exit(1);
});
