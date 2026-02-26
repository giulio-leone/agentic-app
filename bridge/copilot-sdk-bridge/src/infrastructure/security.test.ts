import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PairingTokenManager,
  ConnectionAuthenticator,
  RateLimiter,
} from './security.js';
import type { IncomingMessage } from 'http';

// ── PairingTokenManager ──

describe('PairingTokenManager', () => {
  let mgr: PairingTokenManager;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    // Use a very large interval to avoid interference
    mgr = new PairingTokenManager(999_999_999);
  });

  afterEach(() => {
    mgr.dispose();
  });

  it('generateToken returns a valid token', () => {
    const record = mgr.generateToken(60_000);
    expect(record.token).toHaveLength(64); // 32 bytes hex
    expect(record.used).toBe(false);
    expect(record.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('validateToken succeeds for valid token', () => {
    const record = mgr.generateToken(60_000);
    expect(mgr.validateToken(record.token)).toBe(true);
  });

  it('validateToken marks token as used (single-use)', () => {
    const record = mgr.generateToken(60_000);
    expect(mgr.validateToken(record.token)).toBe(true);
    // Second validation fails — already used
    expect(mgr.validateToken(record.token)).toBe(false);
  });

  it('validateToken fails for expired token', async () => {
    const record = mgr.generateToken(1); // 1ms TTL
    await new Promise((r) => setTimeout(r, 10)); // wait for expiry
    expect(mgr.validateToken(record.token)).toBe(false);
  });

  it('validateToken fails for nonexistent token', () => {
    expect(mgr.validateToken('nonexistent-token')).toBe(false);
  });

  it('revokeToken marks token as used', () => {
    const record = mgr.generateToken(60_000);
    mgr.revokeToken(record.token);
    expect(mgr.validateToken(record.token)).toBe(false);
  });

  it('cleanupExpired removes expired tokens', async () => {
    mgr.generateToken(1); // 1ms TTL
    mgr.generateToken(60_000); // long TTL

    // Wait for the short one to expire
    await new Promise((r) => setTimeout(r, 10));
    mgr.cleanupExpired();

    // The active token info should still return the long-lived one
    const info = mgr.getActiveTokenInfo('ws://localhost:3030');
    expect(info).not.toBeNull();
  });

  it('getActiveTokenInfo returns null when no active tokens', () => {
    expect(mgr.getActiveTokenInfo('ws://localhost')).toBeNull();
  });

  it('getActiveTokenInfo returns active token', () => {
    const record = mgr.generateToken(60_000);
    const info = mgr.getActiveTokenInfo('ws://localhost:3030');
    expect(info?.token).toBe(record.token);
    expect(info?.url).toBe('ws://localhost:3030');
  });
});

// ── ConnectionAuthenticator ──

describe('ConnectionAuthenticator', () => {
  let tokenMgr: PairingTokenManager;
  let auth: ConnectionAuthenticator;

  function fakeReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
    return {
      headers: {},
      url: '/',
      socket: { remoteAddress: '127.0.0.1' },
      ...overrides,
    } as unknown as IncomingMessage;
  }

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    tokenMgr = new PairingTokenManager(999_999_999);
    auth = new ConnectionAuthenticator(tokenMgr);
  });

  afterEach(() => {
    tokenMgr.dispose();
  });

  it('authenticates with valid token', () => {
    const record = tokenMgr.generateToken(60_000);
    const result = auth.authenticateConnection(record.token, fakeReq());
    expect(result.authenticated).toBe(true);
    expect(result.clientId).toBeTruthy();
  });

  it('rejects invalid token', () => {
    const result = auth.authenticateConnection('bad-token', fakeReq());
    expect(result.authenticated).toBe(false);
  });

  it('isAuthenticated returns correct state', () => {
    const record = tokenMgr.generateToken(60_000);
    const result = auth.authenticateConnection(record.token, fakeReq());
    expect(auth.isAuthenticated(result.clientId)).toBe(true);
    expect(auth.isAuthenticated('random-id')).toBe(false);
  });

  it('removeClient clears authentication', () => {
    const record = tokenMgr.generateToken(60_000);
    const result = auth.authenticateConnection(record.token, fakeReq());
    auth.removeClient(result.clientId);
    expect(auth.isAuthenticated(result.clientId)).toBe(false);
  });

  it('extractToken reads from Authorization header', () => {
    const req = fakeReq({ headers: { authorization: 'Bearer my-token-123' } });
    expect(auth.extractToken(req)).toBe('my-token-123');
  });

  it('extractToken reads from query parameter', () => {
    const req = fakeReq({ url: '/?token=query-tok', headers: { host: 'localhost' } });
    expect(auth.extractToken(req)).toBe('query-tok');
  });

  it('extractToken returns null when no token present', () => {
    expect(auth.extractToken(fakeReq({ headers: { host: 'localhost' } }))).toBeNull();
  });
});

// ── RateLimiter ──

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('allows requests under limit', () => {
    const limiter = new RateLimiter(5);
    for (let i = 0; i < 5; i++) {
      expect(limiter.checkLimit('client-1')).toBe(true);
    }
  });

  it('blocks requests over limit', () => {
    const limiter = new RateLimiter(3);
    expect(limiter.checkLimit('client-1')).toBe(true);
    expect(limiter.checkLimit('client-1')).toBe(true);
    expect(limiter.checkLimit('client-1')).toBe(true);
    expect(limiter.checkLimit('client-1')).toBe(false);
  });

  it('different clients have independent buckets', () => {
    const limiter = new RateLimiter(2);
    expect(limiter.checkLimit('a')).toBe(true);
    expect(limiter.checkLimit('a')).toBe(true);
    expect(limiter.checkLimit('a')).toBe(false);
    // Client b still has full quota
    expect(limiter.checkLimit('b')).toBe(true);
  });

  it('reset restores limit', () => {
    const limiter = new RateLimiter(2);
    expect(limiter.checkLimit('c')).toBe(true);
    expect(limiter.checkLimit('c')).toBe(true);
    expect(limiter.checkLimit('c')).toBe(false);

    limiter.reset('c');
    expect(limiter.checkLimit('c')).toBe(true);
  });
});
