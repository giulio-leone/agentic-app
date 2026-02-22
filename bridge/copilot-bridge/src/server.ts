/**
 * Copilot SDK Bridge v2 — TCP NDJSON server that speaks ACP protocol.
 *
 * Multi-session, tool support (filesystem + ask_user), model listing,
 * real cancel, resilient client lifecycle.
 *
 * Usage:
 *   npx tsx src/server.ts [--port 3020] [--model gpt-4.1] [--cwd /path]
 */

import { createServer, type Socket } from 'net';
import { ResilientCopilotClient } from './client.js';
import { SessionManager } from './session-manager.js';
import { createAllTools } from './tools.js';
import { createProtocolHandler } from './protocol.js';
import type { BridgeConfig, JSONRPCRequest } from './types.js';

// ── CLI args ──

function getArg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const config: BridgeConfig = {
  port: parseInt(getArg('port', '3020'), 10),
  model: getArg('model', 'gpt-4.1'),
  workingDirectory: getArg('cwd', process.cwd()),
  cliPath: process.argv.includes('--cli-path')
    ? getArg('cli-path', '')
    : undefined,
};

// ── Singleton client ──

const copilotClient = new ResilientCopilotClient(config);

// ── Connection handler ──

function handleConnection(socket: Socket): void {
  const addr = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[server] Client connected: ${addr}`);

  const sessions = new SessionManager();
  const handler = createProtocolHandler(
    copilotClient,
    sessions,
    config,
    socket,
    createAllTools
  );

  let buffer = '';

  socket.on('data', (data) => {
    buffer += data.toString('utf8');
    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.substring(0, idx).trim();
      buffer = buffer.substring(idx + 1);
      if (!line) continue;
      try {
        const msg: JSONRPCRequest = JSON.parse(line);
        if (msg.jsonrpc === '2.0' && msg.method) {
          handler.handle(msg);
        }
      } catch {
        console.warn(`[server] Malformed JSON from ${addr}: ${line.substring(0, 80)}`);
      }
    }
  });

  socket.on('close', async () => {
    console.log(`[server] Client disconnected: ${addr}`);
    await handler.cleanup();
  });

  socket.on('error', (err) => {
    console.error(`[server] Socket error (${addr}):`, err.message);
  });
}

// ── Start server ──

const server = createServer(handleConnection);

server.listen(config.port, '0.0.0.0', async () => {
  // Pre-start the Copilot client
  try {
    await copilotClient.ensureClient();
  } catch (err) {
    console.error('[server] Warning: Copilot CLI not ready yet:', err);
    console.error('[server] Will retry on first connection.');
  }

  console.log(`
╔═══════════════════════════════════════════════╗
║   Copilot SDK Bridge v2 — ACP over TCP       ║
╠═══════════════════════════════════════════════╣
║  Port:   ${String(config.port).padEnd(38)}║
║  Model:  ${config.model.padEnd(38)}║
║  CWD:    ${config.workingDirectory.substring(0, 38).padEnd(38)}║
║  Tools:  read_file, write_file, list_files   ║
║          ask_user (→ app notification)        ║
║  Proto:  NDJSON (ACP-compatible)             ║
╚═══════════════════════════════════════════════╝

Connect from Agentic: tcp://localhost:${config.port}
`);
});

server.on('error', (err) => {
  console.error('[server] Fatal:', err.message);
  process.exit(1);
});

// ── Graceful shutdown ──

async function shutdown(): Promise<void> {
  console.log('\n[server] Shutting down...');
  server.close();
  await copilotClient.stop();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
