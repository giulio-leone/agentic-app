import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface BridgeConfig {
  port: number;
  cwd: string;
  copilot: boolean;
  codex: boolean;
  model: string;
  reasoningEffort: 'low' | 'medium' | 'high' | '';
  codexModel: string;
  codexPath: string;
}

export const DEFAULT_CONFIG: BridgeConfig = {
  port: 3020,
  cwd: process.env.HOME || '/',
  copilot: true,
  codex: false,
  model: 'gpt-4.1',
  reasoningEffort: '',
  codexModel: 'codex-mini',
  codexPath: 'codex',
};

export type BridgeStatus = 'stopped' | 'starting' | 'running' | 'error';

/**
 * Manages the unified-bridge child process lifecycle.
 * Emits: 'status', 'log', 'error', 'clients'
 */
export class BridgeManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private _status: BridgeStatus = 'stopped';
  private _logs: string[] = [];
  private _clients = 0;

  private static readonly MAX_LOGS = 500;

  get status(): BridgeStatus { return this._status; }
  get logs(): readonly string[] { return this._logs; }
  get clients(): number { return this._clients; }

  start(config: BridgeConfig): void {
    if (this.process) this.stop();

    this.setStatus('starting');

    // Resolve bridge path: packaged (extraResources) vs dev (monorepo)
    const isDev = !app.isPackaged;
    const bridgePath = isDev
      ? resolve(__dirname, '../../../unified-bridge/src/index.ts')
      : join(process.resourcesPath!, 'bridge', 'bridge.mjs');

    const nodePtyDir = isDev
      ? undefined
      : join(process.resourcesPath!, 'bridge', 'node_modules');

    let args: string[];
    if (isDev) {
      args = ['--import', 'tsx', bridgePath, '--port', String(config.port)];
    } else {
      args = [bridgePath, '--port', String(config.port)];
    }
    if (config.cwd) args.push('--cwd', config.cwd);
    if (!config.copilot) args.push('--no-copilot');
    if (config.codex) args.push('--codex');
    if (config.model) args.push('--model', config.model);
    if (config.reasoningEffort) args.push('--reasoning-effort', config.reasoningEffort);
    if (config.codexModel) args.push('--codex-model', config.codexModel);
    if (config.codexPath) args.push('--codex-path', config.codexPath);

    this.appendLog(`[bridge] Starting: node ${args.join(' ')}`);

    const env = { ...process.env };
    // In packaged mode, help Node find native modules (node-pty)
    if (nodePtyDir) {
      env.NODE_PATH = nodePtyDir;
    }

    const spawnCwd = isDev
      ? resolve(__dirname, '../../../unified-bridge')
      : config.cwd;

    this.process = spawn('node', args, {
      cwd: spawnCwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (!line) return;
      this.appendLog(line);
      if (line.includes('listening on') || line.includes('Unified Bridge')) {
        this.setStatus('running');
      }
      // Track client connections
      const clientMatch = line.match(/clients?:\s*(\d+)/i);
      if (clientMatch) {
        this._clients = parseInt(clientMatch[1], 10);
        this.emit('clients', this._clients);
      }
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) this.appendLog(`[stderr] ${line}`);
    });

    this.process.on('exit', (code) => {
      this.appendLog(`[bridge] Exited with code ${code}`);
      this.process = null;
      this.setStatus(code === 0 ? 'stopped' : 'error');
    });

    this.process.on('error', (err) => {
      this.appendLog(`[bridge] Error: ${err.message}`);
      this.process = null;
      this.setStatus('error');
    });
  }

  stop(): void {
    if (!this.process) return;
    this.appendLog('[bridge] Stopping...');
    this.process.kill('SIGTERM');
    // Force kill after 3s
    const pid = this.process.pid;
    setTimeout(() => {
      if (this.process && pid) {
        try { process.kill(pid, 'SIGKILL'); } catch { /* already dead */ }
      }
    }, 3000);
    this.process = null;
    this.setStatus('stopped');
  }

  restart(config: BridgeConfig): void {
    this.stop();
    setTimeout(() => this.start(config), 500);
  }

  clearLogs(): void {
    this._logs = [];
    this.emit('log', '');
  }

  private setStatus(status: BridgeStatus): void {
    this._status = status;
    this.emit('status', status);
  }

  private appendLog(line: string): void {
    const stamped = `[${new Date().toLocaleTimeString()}] ${line}`;
    this._logs.push(stamped);
    if (this._logs.length > BridgeManager.MAX_LOGS) {
      this._logs = this._logs.slice(-BridgeManager.MAX_LOGS);
    }
    this.emit('log', stamped);
  }
}
