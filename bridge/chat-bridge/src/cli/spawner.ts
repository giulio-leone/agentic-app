/**
 * CLI Spawner — spawn CLI agents and capture their output.
 *
 * Two modes:
 * 1. Structured mode (Claude Code): spawn with --output-format stream-json,
 *    capture stdout as structured JSON events.
 * 2. Interactive mode (Copilot CLI): spawn in tmux, capture via PTY.
 *
 * This module handles spawning and I/O piping. Parsing is done by the
 * stream parser layer.
 */

import { spawn, execSync, type ChildProcess } from 'child_process';
import { existsSync, readFileSync, realpathSync } from 'fs';
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger.js';
import type { CliAgent } from '../protocol/messages.js';

const log = new Logger('cli-spawner');

// ── Types ──

export interface CliProcess {
  id: string;
  proc: ChildProcess;
  agent: CliAgent;
  cwd: string;
  alive: boolean;
}

export interface CliOutputEvent {
  sessionId: string;
  data: string;
  stream: 'stdout' | 'stderr';
}

export interface CliExitEvent {
  sessionId: string;
  exitCode: number;
}

// ── Binary Resolution ──

function findBinary(name: string, candidates: string[]): string {
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  try {
    return execSync(`which ${name}`, { encoding: 'utf-8', timeout: 3000 }).trim();
  } catch {
    throw new Error(`${name} binary not found. Install it first.`);
  }
}

function resolveScript(binPath: string): { path: string; useNode: boolean } {
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

// ── CLI Config ──

interface CliConfig {
  binary: string;
  structuredArgs: (prompt: string, model?: string) => string[];
  supportsStreamJson: boolean;
}

function getCliConfig(agent: CliAgent): CliConfig {
  switch (agent) {
    case 'claude':
      return {
        binary: findBinary('claude', [
          `${process.env.HOME}/.npm-global/bin/claude`,
          '/usr/local/bin/claude',
          '/opt/homebrew/bin/claude',
        ]),
        structuredArgs: (prompt: string, model?: string) => {
          const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose'];
          if (model) args.push('--model', model);
          return args;
        },
        supportsStreamJson: true,
      };
    case 'copilot':
      return {
        binary: findBinary('copilot', [
          `${process.env.HOME}/.npm-global/bin/copilot`,
          '/usr/local/bin/copilot',
          '/opt/homebrew/bin/copilot',
        ]),
        structuredArgs: (prompt: string, model?: string) => {
          const args = ['-p', prompt, '--output-format', 'json', '--allow-all-tools'];
          if (model) args.push('--model', model);
          return args;
        },
        supportsStreamJson: true,
      };
    case 'codex':
      return {
        binary: findBinary('codex', [
          `${process.env.HOME}/.npm-global/bin/codex`,
          '/usr/local/bin/codex',
          '/opt/homebrew/bin/codex',
        ]),
        structuredArgs: (prompt: string, model?: string) => {
          const args = ['--full-auto', '-q', prompt];
          if (model) args.push('-m', model);
          return args;
        },
        supportsStreamJson: false,
      };
  }
}

// ── Spawner ──

export class CliSpawner extends EventEmitter {
  private processes = new Map<string, CliProcess>();
  private nextId = 1;

  /** Spawn a CLI agent with a prompt. Returns process info. */
  spawn(
    sessionId: string,
    agent: CliAgent,
    prompt: string,
    cwd: string,
    model?: string,
  ): CliProcess {
    const config = getCliConfig(agent);
    const args = config.structuredArgs(prompt, model);

    const resolved = resolveScript(config.binary);
    const command = resolved.useNode ? process.execPath : resolved.path;
    const allArgs = resolved.useNode ? [resolved.path, ...args] : args;

    log.info(`Spawning ${agent}`, { command, args: allArgs.join(' '), cwd });

    const proc = spawn(command, allArgs, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, TERM: 'dumb', FORCE_COLOR: '0', NO_COLOR: '1' },
    });

    // Close stdin for structured CLI agents — the prompt is passed via args,
    // so stdin must be closed to signal "no more input".
    if (config.supportsStreamJson) {
      proc.stdin?.end();
    }

    const info: CliProcess = {
      id: sessionId,
      proc,
      agent,
      cwd,
      alive: true,
    };

    proc.stdout?.on('data', (chunk: Buffer) => {
      this.emit('output', {
        sessionId,
        data: chunk.toString('utf-8'),
        stream: 'stdout',
      } satisfies CliOutputEvent);
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      this.emit('output', {
        sessionId,
        data: chunk.toString('utf-8'),
        stream: 'stderr',
      } satisfies CliOutputEvent);
    });

    proc.on('exit', (code: number | null) => {
      info.alive = false;
      this.processes.delete(sessionId);
      this.emit('exit', { sessionId, exitCode: code ?? 1 } satisfies CliExitEvent);
      log.info(`CLI exited`, { sessionId, agent, code: code ?? 1 });
    });

    proc.on('error', (err: Error) => {
      info.alive = false;
      this.processes.delete(sessionId);
      this.emit('output', {
        sessionId,
        data: `\n[Spawn Error: ${err.message}]\n`,
        stream: 'stderr',
      } satisfies CliOutputEvent);
      this.emit('exit', { sessionId, exitCode: 1 } satisfies CliExitEvent);
      log.error(`CLI spawn error`, { sessionId, error: err.message });
    });

    this.processes.set(sessionId, info);
    return info;
  }

  /** Write to a process stdin */
  write(sessionId: string, input: string): boolean {
    const p = this.processes.get(sessionId);
    if (!p?.alive || !p.proc.stdin?.writable) return false;
    p.proc.stdin.write(input);
    return true;
  }

  /** Kill a CLI process */
  kill(sessionId: string): void {
    const p = this.processes.get(sessionId);
    if (!p) return;
    p.alive = false;
    p.proc.stdin?.end();
    p.proc.kill('SIGTERM');
    this.processes.delete(sessionId);
    log.info(`Killed CLI process`, { sessionId });
  }

  /** Check if a process is alive */
  isAlive(sessionId: string): boolean {
    return this.processes.get(sessionId)?.alive ?? false;
  }

  /** Kill all processes */
  killAll(): void {
    for (const [id] of this.processes) {
      this.kill(id);
    }
  }
}
