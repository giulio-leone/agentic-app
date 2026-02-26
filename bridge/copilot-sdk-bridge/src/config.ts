/**
 * Bridge configuration — parsed from CLI args and environment variables.
 *
 * Priority: CLI arg → env var → default value.
 *
 * Environment variables (all optional):
 *   COPILOT_BRIDGE_PORT          TCP port
 *   COPILOT_BRIDGE_HOST          Bind address
 *   COPILOT_BRIDGE_TLS           "1" to enable TLS
 *   COPILOT_CLI_PATH             Path to copilot binary
 *   COPILOT_BRIDGE_MAX_SESSIONS  Max concurrent sessions
 */

// ── Types ──

/** Fully resolved bridge configuration. */
export interface BridgeConfig {
  /** WebSocket listen port (default 3030). */
  port: number;
  /** Bind address (default '0.0.0.0'). */
  host: string;
  /** Enable TLS with self-signed cert (default false). */
  tls: boolean;
  /** Optional path to copilot binary. */
  copilotCliPath?: string;
  /** Max concurrent chat sessions (default 5). */
  maxSessions: number;
  /** Pairing token time-to-live in ms (default 300 000 — 5 min). */
  pairingTokenTtl: number;
  /** WebSocket heartbeat interval in ms (default 30 000). */
  heartbeatInterval: number;
  /** Operation timeout in ms (default 3 600 000 — 1 hour). */
  operationTimeout: number;
}

// ── CLI helpers ──

/**
 * Read a `--name value` pair from `process.argv`.
 * Returns the trimmed value or `fallback` when absent.
 */
function getArg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1]
    ? process.argv[idx + 1].trim()
    : fallback;
}

/**
 * Check whether a boolean `--flag` is present in `process.argv`.
 */
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/**
 * Read from an environment variable, falling back to `fallback`.
 */
function env(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

// ── Parser ──

/**
 * Build a {@link BridgeConfig} from CLI args and env vars.
 *
 * CLI args take precedence over env vars; env vars over defaults.
 */
export function parseConfig(): BridgeConfig {
  const port = parseInt(
    getArg('port', env('COPILOT_BRIDGE_PORT', '3030')),
    10,
  );
  const host = getArg('host', env('COPILOT_BRIDGE_HOST', '0.0.0.0'));
  const tls = hasFlag('tls') || env('COPILOT_BRIDGE_TLS', '') === '1';

  const copilotCliPath =
    getArg('copilot-cli-path', env('COPILOT_CLI_PATH', '')) || undefined;

  const maxSessions = parseInt(
    getArg('max-sessions', env('COPILOT_BRIDGE_MAX_SESSIONS', '5')),
    10,
  );

  const pairingTokenTtl = parseInt(
    getArg('pairing-ttl', env('COPILOT_BRIDGE_PAIRING_TTL', '300000')),
    10,
  );

  const heartbeatInterval = parseInt(
    getArg('heartbeat', env('COPILOT_BRIDGE_HEARTBEAT', '30000')),
    10,
  );

  const operationTimeout = parseInt(
    getArg('timeout', env('COPILOT_BRIDGE_TIMEOUT', '3600000')),
    10,
  );

  return {
    port,
    host,
    tls,
    copilotCliPath,
    maxSessions,
    pairingTokenTtl,
    heartbeatInterval,
    operationTimeout,
  };
}
