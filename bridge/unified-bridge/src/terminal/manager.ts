import * as pty from 'node-pty';
import { execSync } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface TerminalInfo {
  id: string;
  name: string;
  pid: number;
  cols: number;
  rows: number;
  source: 'pty' | 'tmux';
}

export interface TmuxSession {
  name: string;
  windows: number;
  created: string;
  attached: boolean;
}

/**
 * Manages PTY terminals and tmux session discovery.
 * Emits: 'data' (id, data), 'exit' (id, code)
 */
export class TerminalManager extends EventEmitter {
  private terminals = new Map<string, pty.IPty>();
  private nextId = 1;

  /** Spawn a new PTY shell. */
  spawn(shell?: string, cwd?: string, cols = 80, rows = 24): TerminalInfo {
    const id = `pty-${this.nextId++}`;
    const defaultShell = shell || process.env.SHELL || '/bin/zsh';

    const term = pty.spawn(defaultShell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: cwd || process.env.HOME || '/',
      env: { ...process.env } as Record<string, string>,
    });

    term.onData((data: string) => this.emit('data', id, data));
    term.onExit(({ exitCode }) => {
      this.terminals.delete(id);
      this.emit('exit', id, exitCode);
    });

    this.terminals.set(id, term);
    return { id, name: defaultShell, pid: term.pid, cols, rows, source: 'pty' };
  }

  /** Connect to a tmux session by spawning a PTY running `tmux attach`. */
  connectTmux(sessionName: string, cols = 80, rows = 24): TerminalInfo {
    const id = `tmux-${this.nextId++}`;

    const term = pty.spawn('tmux', ['attach-session', '-t', sessionName], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME || '/',
      env: { ...process.env } as Record<string, string>,
    });

    term.onData((data: string) => this.emit('data', id, data));
    term.onExit(({ exitCode }) => {
      this.terminals.delete(id);
      this.emit('exit', id, exitCode);
    });

    this.terminals.set(id, term);
    return { id, name: `tmux:${sessionName}`, pid: term.pid, cols, rows, source: 'tmux' };
  }

  /** Send input to a terminal. */
  write(id: string, data: string): boolean {
    const term = this.terminals.get(id);
    if (!term) return false;
    term.write(data);
    return true;
  }

  /** Resize a terminal. */
  resize(id: string, cols: number, rows: number): boolean {
    const term = this.terminals.get(id);
    if (!term) return false;
    term.resize(cols, rows);
    return true;
  }

  /** Close a terminal. */
  close(id: string): boolean {
    const term = this.terminals.get(id);
    if (!term) return false;
    term.kill();
    this.terminals.delete(id);
    return true;
  }

  /** List active PTY terminals. */
  listActive(): TerminalInfo[] {
    return Array.from(this.terminals.entries()).map(([id, term]) => ({
      id,
      name: id.startsWith('tmux-') ? `tmux:${id}` : 'shell',
      pid: term.pid,
      cols: term.cols,
      rows: term.rows,
      source: id.startsWith('tmux-') ? 'tmux' as const : 'pty' as const,
    }));
  }

  /** List available tmux sessions on this machine. */
  listTmuxSessions(): TmuxSession[] {
    try {
      const raw = execSync('tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_created}|#{session_attached}"', {
        encoding: 'utf-8',
        timeout: 3000,
      }).trim();
      if (!raw) return [];
      return raw.split('\n').map((line) => {
        const [name, windows, created, attached] = line.split('|');
        return {
          name,
          windows: parseInt(windows, 10),
          created,
          attached: attached === '1',
        };
      });
    } catch {
      return [];
    }
  }

  /** Clean up all terminals. */
  shutdown(): void {
    for (const [, term] of this.terminals) {
      try { term.kill(); } catch { /* already dead */ }
    }
    this.terminals.clear();
  }
}
