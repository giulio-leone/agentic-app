/**
 * Discovery & pairing utilities for the Copilot bridge.
 *
 * Handles deep-link parsing (agmente://pair?…), bridge validation,
 * and persistent config storage via AsyncStorage.
 *
 * NOTE: mDNS-based discovery requires `react-native-zeroconf`.
 *       A placeholder is provided; see {@link discoverBridgesViaMdns}.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CopilotBridgeConfig } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = '@agmente/bridge-config';
const VALIDATE_TIMEOUT_MS = 5_000;

// ── Types ────────────────────────────────────────────────────────────────────

/** Parsed result from an `agmente://pair` deep-link URL. */
export interface PairingParams {
  bridgeUrl: string;
  token: string;
  name: string;
}

/** Entry returned by bridge discovery. */
export interface DiscoveredBridge {
  name: string;
  url: string;
  tls: boolean;
}

/** Result of a bridge connection validation attempt. */
export interface ValidationResult {
  connected: boolean;
  authenticated: boolean;
  bridgeVersion: string;
  error?: string;
}

// ── 1. Deep-link parsing ─────────────────────────────────────────────────────

/**
 * Parse an `agmente://pair?url=…&token=…&name=…` deep-link URL.
 *
 * @returns The extracted {@link PairingParams}, or `null` if the URL
 *          is malformed or missing required fields.
 */
export function parsePairingUrl(url: string): PairingParams | null {
  try {
    // URL constructor requires a scheme it recognises — swap to http
    // so we can use URLSearchParams.
    const normalized = url.replace(/^agmente:\/\//, 'http://agmente/');
    const parsed = new URL(normalized);

    if (parsed.pathname !== '/pair' && parsed.hostname !== 'pair') {
      console.log('[pairing] URL is not an agmente://pair link');
      return null;
    }

    const bridgeUrl = parsed.searchParams.get('url') ?? '';
    const token = parsed.searchParams.get('token') ?? '';
    const name = parsed.searchParams.get('name') ?? 'bridge';

    if (!bridgeUrl || !token) {
      console.log('[pairing] Missing url or token in deep link');
      return null;
    }

    console.log(`[pairing] Parsed deep link — bridge=${bridgeUrl} name=${name}`);
    return { bridgeUrl, token, name };
  } catch {
    console.log('[pairing] Failed to parse deep-link URL');
    return null;
  }
}

// ── 2. mDNS discovery (placeholder) ──────────────────────────────────────────

/**
 * Discover bridges on the local network via mDNS / Bonjour.
 *
 * **Requires** the `react-native-zeroconf` native module to be installed
 * and linked.  If the module is not available this function returns an
 * empty array.
 *
 * @param _timeout - Discovery window in milliseconds (unused in placeholder).
 * @returns A promise resolving to an array of discovered bridges.
 */
export async function discoverBridgesViaMdns(
  _timeout = 5_000,
): Promise<DiscoveredBridge[]> {
  // TODO: integrate react-native-zeroconf when available:
  //
  //   import Zeroconf from 'react-native-zeroconf';
  //   const zc = new Zeroconf();
  //   zc.scan('copilot-bridge', 'tcp', 'local.');
  //   …collect results for `timeout` ms…
  //   zc.stop();
  //
  console.log('[pairing] mDNS discovery not available — react-native-zeroconf required');
  return [];
}

// ── 3. Bridge validation ─────────────────────────────────────────────────────

/**
 * Validate a bridge connection by opening a WebSocket and sending an
 * `initialize` handshake.
 *
 * The socket is closed immediately after the first response or on
 * timeout (5 s).
 */
export function validateBridgeConnection(
  url: string,
  token?: string,
): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const wsUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;

    let settled = false;
    const settle = (result: ValidationResult) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      settle({
        connected: false,
        authenticated: false,
        bridgeVersion: '',
        error: 'Connection timed out',
      });
    }, VALIDATE_TIMEOUT_MS);

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      clearTimeout(timer);
      resolve({
        connected: false,
        authenticated: false,
        bridgeVersion: '',
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    ws.onopen = () => {
      // Send initialize handshake
      const msg = JSON.stringify({
        type: 'initialize',
        id: 'validate-1',
        payload: { clientVersion: '1.0.0' },
      });
      ws.send(msg);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(
          typeof event.data === 'string' ? event.data : String(event.data),
        ) as { type?: string; payload?: { bridgeVersion?: string; authenticated?: boolean } };

        if (data.type === 'initialize.result') {
          settle({
            connected: true,
            authenticated: data.payload?.authenticated ?? false,
            bridgeVersion: data.payload?.bridgeVersion ?? 'unknown',
          });
        } else if (data.type === 'error') {
          settle({
            connected: true,
            authenticated: false,
            bridgeVersion: '',
            error: 'Bridge returned an error',
          });
        }
      } catch {
        // Non-JSON frame — ignore
      }
    };

    ws.onerror = () => {
      settle({
        connected: false,
        authenticated: false,
        bridgeVersion: '',
        error: 'WebSocket error',
      });
    };

    ws.onclose = () => {
      settle({
        connected: false,
        authenticated: false,
        bridgeVersion: '',
        error: 'Connection closed unexpectedly',
      });
    };
  });
}

// ── 4. Persistent config ─────────────────────────────────────────────────────

/**
 * Persist a bridge configuration to AsyncStorage.
 */
export async function saveBridgeConfig(config: CopilotBridgeConfig): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    console.log('[pairing] Bridge config saved');
  } catch (err) {
    console.error('[pairing] Failed to save bridge config:', err);
  }
}

/**
 * Load the previously saved bridge configuration from AsyncStorage.
 *
 * @returns The stored config, or `null` if none exists.
 */
export async function loadBridgeConfig(): Promise<CopilotBridgeConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw) as CopilotBridgeConfig;
    console.log(`[pairing] Bridge config loaded — ${config.url}`);
    return config;
  } catch (err) {
    console.error('[pairing] Failed to load bridge config:', err);
    return null;
  }
}
