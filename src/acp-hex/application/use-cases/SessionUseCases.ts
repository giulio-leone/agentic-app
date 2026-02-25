/**
 * ACP Session & Terminal use cases (non-CLI).
 *
 * Each class = one responsibility.  They delegate every I/O
 * operation to the ACPGateway port so the application layer
 * stays transport-agnostic.
 */

import { eventBus, createSession, type SessionSummary } from '../../domain';

// ─── Gateway port (to be provided by infra) ─────────────────────────────────

export interface ACPGateway {
  request<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  notify(method: string, params?: Record<string, unknown>): void;
}

// ─── Session Use Cases ───────────────────────────────────────────────────────

export class InitializeConnection {
  constructor(private gateway: ACPGateway) {}

  async execute(
    clientName: string,
    clientVersion: string,
  ): Promise<{
    serverName: string;
    version: string;
    capabilities: Record<string, unknown>;
    models?: Array<{ id: string; name: string; provider: string }>;
  }> {
    return this.gateway.request('initialize', { clientName, clientVersion });
  }
}

export class CreateSession {
  constructor(private gateway: ACPGateway) {}

  async execute(
    opts: { title?: string; cwd?: string; mode?: string } = {},
  ): Promise<string> {
    const result = await this.gateway.request<{ sessionId: string }>(
      'session/new',
      opts as Record<string, unknown>,
    );

    const now = Date.now();
    const session = createSession({
      id: result.sessionId,
      type: 'acp',
      title: opts.title,
      cwd: opts.cwd,
      messages: [],
      createdAt: now,
      updatedAt: now,
    });

    eventBus.emit({ type: 'session:created', session, timestamp: now });

    return result.sessionId;
  }
}

export class LoadSession {
  constructor(private gateway: ACPGateway) {}

  async execute(sessionId: string): Promise<{ session: SessionSummary }> {
    return this.gateway.request('session/load', { sessionId });
  }
}

export class ListSessions {
  constructor(private gateway: ACPGateway) {}

  async execute(): Promise<SessionSummary[]> {
    const result = await this.gateway.request<{
      sessions: SessionSummary[];
    }>('session/list');
    return result.sessions;
  }
}

/** Response arrives asynchronously via session/update notifications. */
export class SendPrompt {
  constructor(private gateway: ACPGateway) {}

  async execute(
    sessionId: string,
    message: string,
    attachments?: unknown[],
  ): Promise<void> {
    await this.gateway.request('session/prompt', {
      sessionId,
      message,
      attachments,
    });
  }
}

export class CancelPrompt {
  constructor(private gateway: ACPGateway) {}

  async execute(sessionId: string): Promise<void> {
    await this.gateway.request('session/cancel', { sessionId });
  }
}

export class SetSessionMode {
  constructor(private gateway: ACPGateway) {}

  async execute(sessionId: string, mode: string): Promise<void> {
    await this.gateway.request('session/set_mode', { sessionId, mode });
  }
}

// ─── Terminal Use Cases ──────────────────────────────────────────────────────

export class SpawnTerminal {
  constructor(private gateway: ACPGateway) {}

  async execute(
    opts: { shell?: string; cwd?: string; cols?: number; rows?: number } = {},
  ): Promise<{ terminalId: string; pid: number }> {
    return this.gateway.request('terminal/spawn', opts as Record<string, unknown>);
  }
}

export class SendTerminalInput {
  constructor(private gateway: ACPGateway) {}

  async execute(terminalId: string, data: string): Promise<void> {
    await this.gateway.request('terminal/input', { terminalId, data });
  }
}

export class ResizeTerminal {
  constructor(private gateway: ACPGateway) {}

  async execute(
    terminalId: string,
    cols: number,
    rows: number,
  ): Promise<void> {
    await this.gateway.request('terminal/resize', { terminalId, cols, rows });
  }
}

export class CloseTerminal {
  constructor(private gateway: ACPGateway) {}

  async execute(terminalId: string): Promise<void> {
    await this.gateway.request('terminal/close', { terminalId });
  }
}

export class ListTerminals {
  constructor(private gateway: ACPGateway) {}

  async execute(): Promise<
    Array<{
      id: string;
      pid?: number;
      shell?: string;
      cwd?: string;
      isActive: boolean;
    }>
  > {
    const result = await this.gateway.request<{
      terminals: Array<{
        id: string;
        pid?: number;
        shell?: string;
        cwd?: string;
        isActive: boolean;
      }>;
    }>('terminal/list');
    return result.terminals;
  }
}

// ─── Filesystem Use Case ────────────────────────────────────────────────────

export class BrowseFilesystem {
  constructor(private gateway: ACPGateway) {}

  async execute(
    path: string,
  ): Promise<
    Array<{ name: string; path: string; type: 'file' | 'directory'; size?: number }>
  > {
    const result = await this.gateway.request<{
      entries: Array<{
        name: string;
        path: string;
        type: 'file' | 'directory';
        size?: number;
      }>;
    }>('fs/list', { path });
    return result.entries;
  }
}
