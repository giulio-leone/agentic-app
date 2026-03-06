/**
 * SessionWatcher — Monitors ~/.copilot/session-state/ for new Copilot CLI sessions.
 *
 * When a new session directory appears with events.jsonl, tails the file and
 * forwards parsed events to connected clients via the existing protocol.
 *
 * This enables automatic detection of Copilot CLI sessions started from any
 * terminal on the Mac — no wrapper or pipe needed.
 */

import { watch, type FSWatcher } from 'fs';
import { readFile, readdir, stat, open } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';
import { parseYaml } from './yaml-mini.js';
import type { SessionManager } from '../session/manager.js';
import { Logger } from '../utils/logger.js';

const log = new Logger('watcher');

export interface WatcherConfig {
  /** Path to watch (default: ~/.copilot/session-state) */
  sessionStatePath?: string;
  /** Poll interval in ms for tailing events.jsonl (default: 1000) */
  pollIntervalMs?: number;
  /** Ignore sessions older than this many seconds (default: 300 = 5min) */
  maxSessionAgeSeconds?: number;
}

interface WatchedSession {
  id: string;
  dir: string;
  eventsPath: string;
  bytesRead: number;
  pollTimer: ReturnType<typeof setInterval> | null;
  cwd?: string;
  branch?: string;
  repository?: string;
}

export class SessionWatcher {
  private basePath: string;
  private pollInterval: number;
  private maxAge: number;
  private sessions: SessionManager;
  private watched = new Map<string, WatchedSession>();
  private dirWatcher: FSWatcher | null = null;
  private scanTimer: ReturnType<typeof setInterval> | null = null;

  constructor(sessions: SessionManager, config: WatcherConfig = {}) {
    this.sessions = sessions;
    this.basePath = config.sessionStatePath ?? join(homedir(), '.copilot', 'session-state');
    this.pollInterval = config.pollIntervalMs ?? 1000;
    this.maxAge = config.maxSessionAgeSeconds ?? 300;
  }

  /** Start watching for new sessions */
  async start(): Promise<void> {
    log.info(`Watching ${this.basePath} for Copilot sessions`);

    // Initial scan for recent sessions
    await this.scanForSessions();

    // Watch for new directories
    try {
      this.dirWatcher = watch(this.basePath, { persistent: false }, (_event, filename) => {
        if (filename) {
          this.checkNewSession(join(this.basePath, filename));
        }
      });
    } catch (err) {
      log.warn(`fs.watch failed, falling back to polling: ${(err as Error).message}`);
    }

    // Periodic scan as fallback (fs.watch can miss events)
    this.scanTimer = setInterval(() => this.scanForSessions(), 5000);
  }

  /** Stop watching */
  stop(): void {
    if (this.dirWatcher) { this.dirWatcher.close(); this.dirWatcher = null; }
    if (this.scanTimer) { clearInterval(this.scanTimer); this.scanTimer = null; }
    for (const ws of this.watched.values()) {
      if (ws.pollTimer) clearInterval(ws.pollTimer);
    }
    this.watched.clear();
    log.info('Session watcher stopped');
  }

  /** Scan for recent sessions in the directory */
  private async scanForSessions(): Promise<void> {
    try {
      const entries = await readdir(this.basePath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        if (this.watched.has(entry.name)) continue;
        const dirPath = join(this.basePath, entry.name);
        await this.checkNewSession(dirPath);
      }
    } catch {
      // Directory might not exist yet
    }
  }

  /** Check if a directory contains a valid, recent Copilot session */
  private async checkNewSession(dirPath: string): Promise<void> {
    const sessionId = basename(dirPath);
    if (this.watched.has(sessionId)) return;

    // Skip sessions already managed by the bridge (spawned sessions use short IDs)
    if (this.sessions.getSession(sessionId)) return;

    const eventsPath = join(dirPath, 'events.jsonl');
    const workspacePath = join(dirPath, 'workspace.yaml');

    try {
      const eventsStat = await stat(eventsPath);
      if (!eventsStat.isFile()) return;

      // Skip old sessions
      const ageSeconds = (Date.now() - eventsStat.mtimeMs) / 1000;
      if (ageSeconds > this.maxAge) return;

      // Read workspace metadata
      let meta: Record<string, string> = {};
      try {
        const yamlContent = await readFile(workspacePath, 'utf-8');
        meta = parseYaml(yamlContent);
      } catch { /* no workspace.yaml */ }

      const cliSessionId = `cli:${sessionId}`;

      // Skip if already registered
      if (this.sessions.getSession(cliSessionId)) return;

      log.info(`Detected Copilot session: ${sessionId} (${meta.cwd ?? 'unknown cwd'})`);

      // Register as an external session in the bridge
      const registered = this.sessions.registerExternalSession({
        id: cliSessionId,
        cli: 'copilot',
        cwd: meta.cwd ?? '~',
        title: meta.summary || `Copilot • ${meta.branch ?? sessionId.slice(0, 8)}`,
        repository: meta.repository,
        branch: meta.branch,
      });

      if (!registered) {
        log.debug(`Session ${sessionId} already registered`);
        return;
      }

      // Start tailing events.jsonl
      const ws: WatchedSession = {
        id: sessionId,
        dir: dirPath,
        eventsPath,
        bytesRead: 0,
        pollTimer: null,
        cwd: meta.cwd,
        branch: meta.branch,
        repository: meta.repository,
      };

      this.watched.set(sessionId, ws);

      // Read existing content and start polling for new events
      await this.readNewEvents(ws);
      ws.pollTimer = setInterval(() => this.readNewEvents(ws), this.pollInterval);

    } catch {
      // Not a valid session dir or file doesn't exist yet
    }
  }

  /** Read new events from the tail of events.jsonl */
  private async readNewEvents(ws: WatchedSession): Promise<void> {
    try {
      const fileStat = await stat(ws.eventsPath);
      if (fileStat.size <= ws.bytesRead) return;

      // Read only new bytes
      const fh = await open(ws.eventsPath, 'r');
      try {
        const newSize = fileStat.size - ws.bytesRead;
        const buf = Buffer.alloc(newSize);
        await fh.read(buf, 0, newSize, ws.bytesRead);
        ws.bytesRead = fileStat.size;

        const text = buf.toString('utf-8');
        const lines = text.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            this.sessions.forwardExternalEvent(`cli:${ws.id}`, event);
          } catch {
            // Skip malformed lines
          }
        }
      } finally {
        await fh.close();
      }
    } catch {
      // File may have been deleted or session ended
    }
  }
}
