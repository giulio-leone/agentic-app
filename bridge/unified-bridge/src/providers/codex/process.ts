/**
 * CodexProcessManager — spawns and manages the `codex app-server` child process.
 *
 * Handles lifecycle: spawn via stdio JSONL, health check, graceful kill.
 * The process communicates via stdin/stdout using newline-delimited JSON
 * (without the "jsonrpc":"2.0" header — Codex protocol quirk).
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface CodexProcessConfig {
  /** Path to codex binary (default: 'codex') */
  codexPath?: string;
  /** Working directory for the process */
  cwd?: string;
}

export class CodexProcessManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: CodexProcessConfig;
  private buffer = '';

  constructor(config: CodexProcessConfig) {
    super();
    this.config = config;
  }

  /** Spawn the codex app-server process. */
  start(): void {
    if (this.process) return;

    const codexPath = this.config.codexPath || 'codex';
    const args = ['app-server', '--listen', 'stdio://'];

    console.log(`[codex-process] Spawning: ${codexPath} ${args.join(' ')}`);

    this.process = spawn(codexPath, args, {
      cwd: this.config.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // JSON tracing to stderr for debugging
        LOG_FORMAT: 'json',
      },
    });

    this.process.stdout?.setEncoding('utf8');
    this.process.stderr?.setEncoding('utf8');

    // Parse JSONL from stdout
    this.process.stdout?.on('data', (data: string) => {
      this.buffer += data;
      let idx: number;
      while ((idx = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.substring(0, idx).trim();
        this.buffer = this.buffer.substring(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          this.emit('message', msg);
        } catch {
          console.warn(`[codex-process] Malformed JSON: ${line.substring(0, 100)}`);
        }
      }
    });

    // Log stderr (tracing/logs)
    this.process.stderr?.on('data', (data: string) => {
      for (const line of data.split('\n').filter(Boolean)) {
        this.emit('log', line);
      }
    });

    this.process.on('error', (err) => {
      console.error(`[codex-process] Process error:`, err.message);
      this.emit('error', err);
      this.process = null;
    });

    this.process.on('exit', (code, signal) => {
      console.log(`[codex-process] Exited (code=${code}, signal=${signal})`);
      this.emit('exit', code, signal);
      this.process = null;
    });
  }

  /** Send a JSON message to the process stdin (Codex protocol: no "jsonrpc" header). */
  send(msg: Record<string, unknown>): boolean {
    if (!this.process?.stdin?.writable) return false;
    const line = JSON.stringify(msg) + '\n';
    return this.process.stdin.write(line);
  }

  /** Check if the process is running. */
  get isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /** Gracefully stop the process. */
  async stop(): Promise<void> {
    if (!this.process) return;

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      this.process!.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      // Try SIGTERM first
      this.process!.kill('SIGTERM');
    });
  }

  /** Get the PID of the running process. */
  get pid(): number | undefined {
    return this.process?.pid;
  }
}
