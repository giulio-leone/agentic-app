/**
 * Chat Bridge — Entry Point
 *
 * Usage:
 *   npx tsx src/index.ts [options]
 *
 * Options:
 *   --port <n>      WebSocket port (default: 3030)
 *   --token <t>     Auth token for connections
 *   --tailscale     Auto-publish via Tailscale serve
 *   --funnel        Auto-publish via Tailscale funnel (public)
 *   --no-qr         Don't print QR code
 */

import { ChatBridgeServer } from './server.js';
import { TmuxManager } from './session/tmux.js';
import { printQRCode } from './network/qrcode.js';
import { Logger } from './utils/logger.js';

const log = new Logger('main');

// ── CLI args ──

function getArg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1]!.trim() : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const port = parseInt(getArg('port', '3030'), 10);
const token = hasFlag('token') ? getArg('token', '') : process.env.CHAT_BRIDGE_TOKEN;
const useTailscale = hasFlag('tailscale') || hasFlag('funnel');
const useFunnel = hasFlag('funnel');
const noQr = hasFlag('no-qr');

// ── Checks ──

if (!TmuxManager.isAvailable()) {
  log.warn('tmux not found — sessions will not persist across bridge restarts');
}

// ── Start ──

async function main(): Promise<void> {
  const server = new ChatBridgeServer({
    port,
    auth: token ? { token } : undefined,
  });

  await server.start();

  const network = server.getNetwork();

  // Tailscale publish
  if (useTailscale) {
    await network.publishTailscale(useFunnel);
  }

  const bestUrl = network.getBestUrl();
  const info = network.getInfo();

  // Print banner
  console.log(`
╔═══════════════════════════════════════════════╗
║   Agmente Chat Bridge v1.0.0                 ║
╠═══════════════════════════════════════════════╣
║  WebSocket:  ws://0.0.0.0:${String(port).padEnd(21)}║
║  Auth:       ${(token ? 'enabled' : 'disabled').padEnd(33)}║
╠═══════════════════════════════════════════════╣
║  Local:      ${info.local.ip.padEnd(33)}║${info.tailscale?.enabled ? `
║  Tailscale:  ${(info.tailscale.ip ?? 'detecting...').padEnd(33)}║` : ''}${info.meshnet?.enabled ? `
║  Meshnet:    ${(info.meshnet.ip ?? info.meshnet.hostname ?? 'detecting...').padEnd(33)}║` : ''}
╠═══════════════════════════════════════════════╣
║  Connect:    ${bestUrl.substring(0, 33).padEnd(33)}║
╚═══════════════════════════════════════════════╝
`);

  // QR Code
  if (!noQr) {
    await printQRCode(bestUrl);
  }

  // Graceful shutdown
  function shutdown(): void {
    console.log('\nShutting down...');
    if (useTailscale) network.unpublishTailscale();
    server.shutdown();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  log.error('Fatal error', { error: (err as Error).message });
  process.exit(1);
});
