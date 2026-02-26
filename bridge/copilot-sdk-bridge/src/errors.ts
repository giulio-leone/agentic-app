/**
 * Domain-specific error classes for the Copilot SDK Bridge.
 *
 * Follows hexagonal architecture — these are domain errors that
 * infrastructure and application layers translate into protocol
 * responses.
 */

// ── Base Error ──

/**
 * Base class for all bridge domain errors.
 * Carries an error `code` suitable for wire-protocol responses.
 */
export class BridgeError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'BRIDGE_ERROR') {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Authentication ──

/**
 * Raised when the user is not authenticated with GitHub Copilot
 * or when an auth token has expired / been revoked.
 */
export class AuthenticationError extends BridgeError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

// ── Session ──

/**
 * Raised for session lifecycle problems: creation failure,
 * session not found, max-sessions exceeded, etc.
 */
export class SessionError extends BridgeError {
  public readonly sessionId?: string;

  constructor(message: string, sessionId?: string) {
    super(message, 'SESSION_ERROR');
    this.name = 'SessionError';
    this.sessionId = sessionId;
  }
}

// ── Security ──

/**
 * Raised when a security constraint is violated — invalid pairing
 * token, TLS required but missing, origin mismatch, etc.
 */
export class SecurityError extends BridgeError {
  constructor(message = 'Security violation') {
    super(message, 'SECURITY_ERROR');
    this.name = 'SecurityError';
  }
}

// ── Timeout ──

/**
 * Raised when an operation exceeds its allowed duration — prompt
 * completion, tool approval wait, heartbeat miss, etc.
 */
export class TimeoutError extends BridgeError {
  public readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number) {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

// ── Utility ──

/**
 * Extract a human-readable message from an unknown thrown value.
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
