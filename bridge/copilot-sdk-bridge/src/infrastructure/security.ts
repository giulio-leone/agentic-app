/**
 * Infrastructure – Security layer for the Copilot SDK Bridge.
 *
 * Provides self-signed TLS certificate generation, pairing-token
 * management, QR-code pairing, WebSocket connection authentication,
 * and basic per-client rate limiting.
 */

import { randomBytes } from 'crypto';
import type { IncomingMessage } from 'http';

import selfsigned from 'selfsigned';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

import { SecurityError, AuthenticationError } from '../errors.js';
import type { BridgeConfig } from '../config.js';

// ── Types ──

/** PEM-encoded certificate + private key pair. */
export interface TlsCert {
  cert: string;
  key: string;
}

/** Stored pairing token record. */
export interface PairingToken {
  token: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

/** Result returned by {@link ConnectionAuthenticator.authenticateConnection}. */
export interface AuthResult {
  authenticated: boolean;
  clientId: string;
}

/** Payload for QR-code generation output. */
export interface QRResult {
  ascii: string;
  dataUrl: string;
}

// ── 1. Self-signed TLS Certificates ──

/**
 * Generate a self-signed X.509 certificate valid for 365 days.
 *
 * The Subject Alternative Name (SAN) includes `localhost`,
 * `127.0.0.1`, and `0.0.0.0` so that browsers and WebSocket
 * clients accept it during local development.
 */
export function generateSelfSignedCert(): TlsCert {
  const attrs = [{ name: 'commonName', value: 'CopilotBridge' }];

  const pems = selfsigned.generate(attrs, {
    days: 365,
    keySize: 2048,
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },   // DNS
          { type: 7, ip: '127.0.0.1' },      // IP
          { type: 7, ip: '0.0.0.0' },        // IP
        ],
      },
    ],
  });

  console.log('[security] self-signed TLS certificate generated (365 d)');
  return { cert: pems.cert, key: pems.private };
}

// ── 2. Pairing Token Management ──

/**
 * Manages cryptographically random pairing tokens used to
 * authenticate mobile clients connecting over WebSocket.
 */
export class PairingTokenManager {
  private readonly tokens = new Map<string, PairingToken>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly cleanupIntervalMs = 60_000) {
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), this.cleanupIntervalMs);
    // Allow the process to exit even if the timer is alive.
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  /**
   * Generate a cryptographically random pairing token (32 bytes, hex-encoded).
   *
   * @param ttlMs - Time-to-live in milliseconds.
   * @returns The generated {@link PairingToken}.
   */
  generateToken(ttlMs: number): PairingToken {
    const token = randomBytes(32).toString('hex');
    const now = new Date();
    const record: PairingToken = {
      token,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      used: false,
    };
    this.tokens.set(token, record);
    console.log(`[security] pairing token generated (expires in ${ttlMs} ms)`);
    return record;
  }

  /**
   * Validate a pairing token — it must exist, not be expired, and
   * not have been previously used.  A valid token is marked as used.
   */
  validateToken(token: string): boolean {
    const record = this.tokens.get(token);
    if (!record) return false;
    if (record.used) return false;
    if (new Date() > record.expiresAt) return false;

    record.used = true;
    console.log('[security] pairing token validated and consumed');
    return true;
  }

  /**
   * Revoke (mark as used) a specific token.
   */
  revokeToken(token: string): void {
    const record = this.tokens.get(token);
    if (record) {
      record.used = true;
      console.log('[security] pairing token revoked');
    }
  }

  /**
   * Remove all expired tokens from storage.
   */
  cleanupExpired(): void {
    const now = new Date();
    let removed = 0;
    for (const [key, record] of this.tokens) {
      if (now > record.expiresAt) {
        this.tokens.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      console.log(`[security] cleaned up ${removed} expired token(s)`);
    }
  }

  /**
   * Return information about the current active (unused, non-expired)
   * token suitable for QR-code generation.
   *
   * @param bridgeUrl - The WebSocket URL the client should connect to.
   */
  getActiveTokenInfo(bridgeUrl: string): { token: string; url: string } | null {
    const now = new Date();
    for (const record of this.tokens.values()) {
      if (!record.used && now < record.expiresAt) {
        return { token: record.token, url: bridgeUrl };
      }
    }
    return null;
  }

  /** Stop the periodic cleanup timer. */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// ── 3. QR Code Generation ──

/**
 * Generate a QR code that encodes pairing information as JSON.
 *
 * The encoded payload is `{ url, token }` so the mobile app can
 * connect and authenticate in a single scan.
 *
 * @returns An object containing terminal-friendly ASCII art and a
 *          base-64 data-URL (PNG) for web display.
 */
export async function generatePairingQR(
  bridgeUrl: string,
  token: string,
): Promise<QRResult> {
  const payload = JSON.stringify({ url: bridgeUrl, token });

  const [ascii, dataUrl] = await Promise.all([
    QRCode.toString(payload, { type: 'terminal', small: true }),
    QRCode.toDataURL(payload),
  ]);

  console.log('[security] pairing QR code generated');
  return { ascii, dataUrl };
}

// ── 4. Connection Authentication ──

/**
 * Authenticates incoming WebSocket connections using pairing tokens.
 *
 * Tokens may be supplied via:
 * 1. `Authorization: Bearer <token>` header on the WS upgrade request.
 * 2. `?token=<token>` query parameter on the WS URL.
 * 3. First message after connection: `{ type: 'auth', payload: { token } }`.
 */
export class ConnectionAuthenticator {
  /** clientId → true for authenticated sessions. */
  private readonly authenticated = new Map<string, boolean>();

  constructor(private readonly tokenManager: PairingTokenManager) {}

  /**
   * Authenticate a WebSocket upgrade request.
   *
   * Extracts the token from the `Authorization` header or the URL
   * query string, validates it, and records the client.
   */
  authenticateConnection(token: string, req: IncomingMessage): AuthResult {
    const clientId = uuidv4();

    const valid = this.tokenManager.validateToken(token);
    if (!valid) {
      console.log(`[security] authentication failed for ${clientId}`);
      return { authenticated: false, clientId };
    }

    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    this.authenticated.set(clientId, true);
    console.log(
      `[security] client ${clientId} authenticated (ip=${clientIp}, ua=${userAgent})`,
    );
    return { authenticated: true, clientId };
  }

  /**
   * Extract the pairing token from an HTTP upgrade request.
   *
   * Checks the `Authorization: Bearer` header first, then falls
   * back to the `?token=` query parameter.
   */
  extractToken(req: IncomingMessage): string | null {
    // 1. Authorization header
    const auth = req.headers['authorization'];
    if (auth?.startsWith('Bearer ')) {
      return auth.slice(7).trim();
    }

    // 2. Query parameter
    try {
      const url = new URL(req.url ?? '', `http://${req.headers.host}`);
      const qToken = url.searchParams.get('token');
      if (qToken) return qToken;
    } catch {
      // Malformed URL — ignore
    }

    return null;
  }

  /**
   * Check whether a previously authenticated client is still valid.
   */
  isAuthenticated(clientId: string): boolean {
    return this.authenticated.get(clientId) === true;
  }

  /**
   * Remove a client from the authenticated set (e.g. on disconnect).
   */
  removeClient(clientId: string): void {
    this.authenticated.delete(clientId);
    console.log(`[security] client ${clientId} removed`);
  }
}

// ── 5. Rate Limiting ──

/** Internal bucket record for the token-bucket algorithm. */
interface Bucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Simple token-bucket rate limiter — 60 messages per minute per client.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly maxTokens: number;
  private readonly refillRateMs: number;

  /**
   * @param maxPerMinute - Maximum messages allowed per minute (default 60).
   */
  constructor(maxPerMinute = 60) {
    this.maxTokens = maxPerMinute;
    // Refill one token every (60 000 / max) ms.
    this.refillRateMs = 60_000 / maxPerMinute;
  }

  /**
   * Check whether the client is within rate limits.
   *
   * @returns `true` if the message is allowed, `false` if throttled.
   */
  checkLimit(clientId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(clientId);

    if (!bucket) {
      bucket = { tokens: this.maxTokens - 1, lastRefill: now };
      this.buckets.set(clientId, bucket);
      return true;
    }

    // Refill tokens based on elapsed time.
    const elapsed = now - bucket.lastRefill;
    const refill = Math.floor(elapsed / this.refillRateMs);
    if (refill > 0) {
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + refill);
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }

    console.log(`[security] rate limit exceeded for client ${clientId}`);
    return false;
  }

  /**
   * Reset the bucket for a client (e.g. on disconnect).
   */
  reset(clientId: string): void {
    this.buckets.delete(clientId);
  }
}
