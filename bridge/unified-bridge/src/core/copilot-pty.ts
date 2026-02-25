/**
 * CopilotPtyManager — Spawn Copilot CLI processes with STDIO piping.
 *
 * Uses child_process.spawn (not node-pty) for maximum compatibility.
 * All I/O is emitted as events for the protocol layer to forward via WebSocket.
 */

import { spawn, execSync, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync, readFileSync, realpathSync } from 'fs';

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
  private sessions = new Map<string, { proc: ChildProcess; info: CopilotPtySession }>();
  private nextId = 1;

  /** Spawn a new Copilot CLI process in --yolo mode */
  spawnSession(cwd: string, args: string[] = []): CopilotPtySession {
    const copilotPath = this.findCopilotBinary();
    const id = `pty-copilot-${this.nextId++}`;
    const defaultArgs = ['--yolo'];

    const resolved = this.resolveScript(copilotPath);
    const command = resolved.useNode ? process.execPath : resolved.path;
    const allArgs = resolved.useNode
      ? [resolved.path, ...defaultArgs, ...args]
      : [...defaultArgs, ...args];

    const proc = spawn(command, allArgs, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, TERM: 'dumb', FORCE_COLOR: '0' },
    });

    const info: CopilotPtySession = {
      id,
      pid: proc.pid ?? 0,
      tty: '',
      cwd,
      mode: 'spawn',
      alive: true,
    };

    proc.stdout?.on('data', (chunk: Buffer) => {
      this.emit('output', { sessionId: id, data: chunk.toString() } satisfies PtyOutputEvent);
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      this.emit('output', { sessionId: id, data: chunk.toString() } satisfies PtyOutputEvent);
    });

    proc.on('exit', (code: number | null) => {
      info.alive = false;
      this.emit('exit', { sessionId: id, exitCode: code ?? 1 });
      this.sessions.delete(id);
    });

    proc.on('error', (err: Error) => {
      info.alive = false;
      this.emit('output', { sessionId: id, data: `\n[Error: ${err.message}]\n` });
      this.emit('exit', { sessionId: id, exitCode: 1 });
      this.sessions.delete(id);
    });

    this.sessions.set(id, { proc, info });
    console.log(`[pty] Spawned copilot (PID ${proc.pid}) in ${cwd}`);
    return { ...info };
  }

  /** Write input to a session's stdin. Close stdin after to trigger processing. */
  write(sessionId: string, input: string, closeStdin = false): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.info.alive || !session.proc.stdin?.writable) return false;
    session.proc.stdin.write(input);
    if (closeStdin) session.proc.stdin.end();
    return true;
  }

  /** Terminate a session */
  dispose(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.info.alive = false;
    session.proc.stdin?.end();
    session.proc.kill('SIGTERM');
    this.sessions.delete(sessionId);
    console.log(`[pty] Disposed ${sessionId}`);
  }

  /** Get info about a specific session */
  getSession(sessionId: string): CopilotPtySession | undefined {
    const info = this.sessions.get(sessionId)?.info;
    return info ? { ...info } : undefined;
  }

  /** List all active sessions */
  listSessions(): CopilotPtySession[] {
    return Array.from(this.sessions.values()).map(s => ({ ...s.info }));
  }

  /** Dispose all sessions */
  disposeAll(): void {
    for (const [id] of this.sessions) {
      this.dispose(id);
    }
  }

  // ── Private ──

  private findCopilotBinary(): string {
    const candidates = [
      `${process.env.HOME}/.npm-global/bin/copilot`,
      '/usr/local/bin/copilot',
      '/opt/homebrew/bin/copilot',
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    try {
      return execSync('which copilot', { encoding: 'utf-8', timeout: 2000 }).trim();
    } catch {
      throw new Error('Copilot CLI binary not found');
    }
  }

  /** Resolve symlinks and detect Node.js scripts */
  private resolveScript(binPath: string): { path: string; useNode: boolean } {
    try {
      const resolved = realpathSync(binPath);
      if (resolved.endsWith('.js') || resolved.endsWith('.mjs')) {
        return { path: resolved, useNode: true };
      }
      const head = readFileSync(resolved, { encoding: 'utf-8', flag: 'r' }).slice(0, 128);
      if (head.startsWith('#!/usr/bin/env node') || head.startsWith('#!/usr/bin/node')) {
        return { path: resolved, useNode: true };
      }
    } catch { /* fall through */ }
    return { path: binPath, useNode: false };
  }
}
