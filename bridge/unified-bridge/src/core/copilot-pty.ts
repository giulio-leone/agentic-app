/**
 * CopilotPtyManager — Spawn and connect to Copilot CLI processes via PTY.
 *
 * Spawn: Creates new copilot CLI processes (--yolo mode) with full STDIO piping.
 * Connect: Pipes into an existing copilot process's TTY for output streaming.
 *
 * All I/O is emitted as events for the protocol layer to forward via WebSocket.
 */

import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

// ── Types ──

export interface CopilotPtySession {
  id: string;
  pid: number;
  tty: string;
  cwd: string;
  mode: 'spawn' | 'connect';
  alive: boolean;
}

export interface PtyOutputEvent {
  sessionId: string;
  data: string;
}

// ── Manager ──

export class CopilotPtyManager extends EventEmitter {
  private sessions = new Map<string, { pty: pty.IPty; info: CopilotPtySession }>();
  private nextId = 1;

  /** Spawn a new Copilot CLI process in --yolo mode */
  spawn(cwd: string, args: string[] = []): CopilotPtySession {
    const copilotPath = this.findCopilotBinary();
    const id = `pty-copilot-${this.nextId++}`;
    const defaultArgs = ['--yolo'];
    const allArgs = [...defaultArgs, ...args];

    const term = pty.spawn(copilotPath, allArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    const info: CopilotPtySession = {
      id,
      pid: term.pid,
      tty: '',
      cwd,
      mode: 'spawn',
      alive: true,
    };

    term.onData((data: string) => {
      this.emit('output', { sessionId: id, data } satisfies PtyOutputEvent);
    });

    term.onExit(({ exitCode }: { exitCode: number }) => {
      info.alive = false;
      this.emit('exit', { sessionId: id, exitCode });
      this.sessions.delete(id);
    });

    this.sessions.set(id, { pty: term, info });
    console.log(`[pty] Spawned copilot (PID ${term.pid}) in ${cwd}`);
    return info;
  }

  /** Write input to a PTY session */
  write(sessionId: string, input: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.info.alive) return false;
    session.pty.write(input);
    return true;
  }

  /** Resize a PTY session */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) session.pty.resize(cols, rows);
  }

  /** Kill a PTY session */
  dispose(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.info.alive = false;
    session.pty.kill();
    this.sessions.delete(sessionId);
    console.log(`[pty] Disposed ${sessionId}`);
  }

  /** Get info about a specific session */
  getSession(sessionId: string): CopilotPtySession | undefined {
    return this.sessions.get(sessionId)?.info;
  }

  /** List all active PTY sessions */
  listSessions(): CopilotPtySession[] {
    return Array.from(this.sessions.values()).map(s => s.info);
  }

  /** Dispose all sessions */
  disposeAll(): void {
    for (const [id] of this.sessions) {
      this.dispose(id);
    }
  }

  // ── Private ──

  private findCopilotBinary(): string {
    // Try known paths
    const candidates = [
      `${process.env.HOME}/.npm-global/bin/copilot`,
      '/usr/local/bin/copilot',
      '/opt/homebrew/bin/copilot',
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    // Try which
    try {
      return execSync('which copilot', { encoding: 'utf-8', timeout: 2000 }).trim();
    } catch {
      throw new Error('Copilot CLI binary not found');
    }
  }
}
