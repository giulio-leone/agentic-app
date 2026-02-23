/**
 * Unified Bridge — TCP NDJSON server that speaks ACP protocol.
 *
 * Multi-provider (Copilot SDK + Codex app-server), streaming, cancel,
 * agent events (terminal, file edits), model listing.
 *
 * Usage:
 *   npx tsx src/index.ts [options]
 *
 * Options:
 *   --port <n>         TCP port (default: 3020)
 *   --cwd <path>       Working directory (default: current)
 *   --copilot          Enable Copilot provider (default: enabled)
 *   --codex            Enable Codex provider (default: disabled)
 *   --no-copilot       Disable Copilot provider
 *   --model <name>     Default model (default: gpt-4.1)
 *   --codex-model <n>  Default Codex model (default: codex-mini-latest)
 *   --codex-path <p>   Path to codex binary
 *   --cli-path <p>     Path to Copilot CLI binary
 */

import { createServer, type Socket } from 'net';
import { ProviderRegistry } from './core/provider-registry.js';
import { createProtocolHandler } from './core/protocol.js';
import { CopilotProvider } from './providers/copilot/adapter.js';
import { CodexProvider } from './providers/codex/adapter.js';
import { TerminalManager } from './terminal/manager.js';
import type { BridgeConfig, ProviderConfig } from './core/types.js';

// ── CLI args ──

function getArg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1].trim() : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const enableCopilot = !hasFlag('no-copilot');
const enableCodex = hasFlag('codex');
const port = parseInt(getArg('port', '3020'), 10);
const cwd = getArg('cwd', process.cwd());

const config: BridgeConfig = {
  port,
  workingDirectory: cwd,
  providers: [],
};

if (enableCopilot) {
  const reasoningEffort = getArg('reasoning-effort', '');
  config.providers.push({
    type: 'copilot',
    enabled: true,
    model: getArg('model', 'gpt-4.1'),
    reasoningEffort: reasoningEffort as ProviderConfig['reasoningEffort'] || undefined,
    cliPath: hasFlag('cli-path') ? getArg('cli-path', '') : undefined,
  });
}

if (enableCodex) {
  config.providers.push({
    type: 'codex',
    enabled: true,
    model: getArg('codex-model', 'codex-mini-latest'),
    codexPath: hasFlag('codex-path') ? getArg('codex-path', '') : undefined,
    approvalPolicy: getArg('approval-policy', 'unless-allow-listed'),
    sandbox: getArg('sandbox', 'workspaceWrite'),
  });
}

// ── Provider Registry ──

const registry = new ProviderRegistry();

function createProvider(pc: ProviderConfig) {
  switch (pc.type) {
    case 'copilot':
      return new CopilotProvider(pc, config.workingDirectory);
    case 'codex':
      return new CodexProvider(pc, config.workingDirectory);
    default:
      throw new Error(`Unknown provider type: ${pc.type}`);
  }
}

// ── Terminal Manager ──

const terminalManager = new TerminalManager();

// ── Connection handler ──

function handleConnection(socket: Socket): void {
  const addr = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[server] Client connected: ${addr}`);

  const handler = createProtocolHandler(registry, config, socket, terminalManager);

  let buffer = '';

  socket.on('data', (data) => {
    buffer += data.toString('utf8');
    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.substring(0, idx).trim();
      buffer = buffer.substring(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
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

async function main(): Promise<void> {
  // Register and initialize providers
  for (const pc of config.providers) {
    if (!pc.enabled) continue;
    const provider = createProvider(pc);
    registry.register(provider);
  }

  if (registry.size === 0) {
    console.error('[server] No providers configured! Use --copilot and/or --codex');
    process.exit(1);
  }

  // Initialize all providers
  console.log('[server] Initializing providers...');
  const providerInfos = await registry.initializeAll();

  const totalModels = providerInfos.reduce((sum, p) => sum + p.models.length, 0);
  const providerList = providerInfos.map((p) => `${p.name} (${p.models.length} models)`);

  // Start TCP server
  const server = createServer(handleConnection);

  server.listen(config.port, '0.0.0.0', () => {
    const providerLines = providerList
      .map((p) => `║  ✓ ${p.padEnd(40)}║`)
      .join('\n');

    console.log(`
╔═══════════════════════════════════════════════╗
║   Agentic Unified Bridge v1.0.0              ║
╠═══════════════════════════════════════════════╣
║  Port:     ${String(config.port).padEnd(35)}║
║  CWD:      ${config.workingDirectory.substring(0, 35).padEnd(35)}║
║  Models:   ${String(totalModels).padEnd(35)}║
╠═══════════════════════════════════════════════╣
${providerLines}
╠═══════════════════════════════════════════════╣
║  Proto:    ACP over TCP NDJSON               ║
║  Events:   agent_event (terminal, files)     ║
╚═══════════════════════════════════════════════╝

Connect from Agentic: tcp://localhost:${config.port}
`);
  });

  server.on('error', (err) => {
    console.error('[server] Fatal:', err.message);
    process.exit(1);
  });

  // Graceful shutdown
  async function shutdown(): Promise<void> {
    console.log('\n[server] Shutting down...');
    server.close();
    terminalManager.shutdown();
    await registry.shutdownAll();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[server] Fatal error:', err);
  process.exit(1);
});
