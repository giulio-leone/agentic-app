/**
 * CodexJsonRpcClient — JSON-RPC client for the Codex app-server protocol.
 *
 * Key difference from standard JSON-RPC: Codex omits the "jsonrpc":"2.0"
 * header on the wire. Messages only have { method, id, params } or { id, result }.
 *
 * Handles request/response correlation, notifications, and timeouts.
 */

import { EventEmitter } from 'events';
import { CodexProcessManager, type CodexProcessConfig } from './process.js';

export interface CodexRequest {
  method: string;
  id: number;
  params?: Record<string, unknown>;
}

export interface CodexResponse {
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface CodexNotification {
  method: string;
  params?: Record<string, unknown>;
}

type PendingRequest = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const REQUEST_TIMEOUT_MS = 60_000;

export class CodexJsonRpcClient extends EventEmitter {
  private process: CodexProcessManager;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private initialized = false;

  constructor(config: CodexProcessConfig) {
    super();
    this.process = new CodexProcessManager(config);
  }

  /** Start the process and perform the initialize handshake. */
  async start(): Promise<CodexResponse> {
    this.process.start();

    // Wire up message routing
    this.process.on('message', (msg: Record<string, unknown>) => {
      this.handleMessage(msg);
    });

    this.process.on('log', (line: string) => {
      this.emit('log', line);
    });

    this.process.on('exit', (code: number | null) => {
      // Reject all pending requests
      for (const [id, req] of this.pending) {
        req.reject(new Error(`Process exited (code=${code})`));
        clearTimeout(req.timeout);
        this.pending.delete(id);
      }
      this.initialized = false;
      this.emit('exit', code);
    });

    // Perform initialize handshake
    const initResult = await this.request('initialize', {
      clientInfo: {
        name: 'agentic_bridge',
        title: 'Agentic Unified Bridge',
        version: '1.0.0',
      },
    });

    // Send initialized notification (required by protocol)
    this.notify('initialized');
    this.initialized = true;

    console.log('[codex-rpc] Initialized successfully');
    return initResult as CodexResponse;
  }

  /** Send a request and wait for response. */
  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    const msg: CodexRequest = { method, id, ...(params !== undefined ? { params } : {}) };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method} (id=${id})`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timeout });
      const sent = this.process.send(msg as unknown as Record<string, unknown>);
      if (!sent) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(new Error('Failed to send: process not writable'));
      }
    });
  }

  /** Send a notification (no response expected). */
  notify(method: string, params?: Record<string, unknown>): void {
    const msg: Record<string, unknown> = { method };
    if (params !== undefined) msg.params = params;
    this.process.send(msg);
  }

  /** Route incoming messages to the correct handler. */
  private handleMessage(msg: Record<string, unknown>): void {
    // Response to a pending request (has 'id' + 'result' or 'error')
    if (typeof msg.id === 'number' && (msg.result !== undefined || msg.error !== undefined)) {
      const pending = this.pending.get(msg.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pending.delete(msg.id);
        if (msg.error) {
          const err = msg.error as { code: number; message: string };
          pending.reject(new Error(`Codex error ${err.code}: ${err.message}`));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    // Notification (has 'method' but no 'id', or 'id' is not a pending one)
    if (typeof msg.method === 'string') {
      this.emit('notification', msg.method, msg.params || {});
      // Also emit the specific method for convenience
      this.emit(`codex:${msg.method}`, msg.params || {});
    }
  }

  /** Check if initialized. */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /** Check if process is running. */
  get isRunning(): boolean {
    return this.process.isRunning;
  }

  /** Gracefully shutdown. */
  async stop(): Promise<void> {
    for (const [id, req] of this.pending) {
      clearTimeout(req.timeout);
      req.reject(new Error('Client shutting down'));
      this.pending.delete(id);
    }
    await this.process.stop();
    this.initialized = false;
  }
}
