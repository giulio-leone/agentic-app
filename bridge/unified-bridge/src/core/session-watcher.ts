/**
 * CopilotSessionWatcher — watches ~/.copilot/session-store.db for live sessions.
 *
 * Uses fs.watch on the WAL file for near-instant change detection.
 * Emits delta events when new turns/sessions appear.
 */

import { existsSync, watch, type FSWatcher } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

// ── Types ──

export interface CliSession {
  id: string;
  cwd: string | null;
  branch: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  pid: number | null;
  tty: string | null;
  isAlive: boolean;
}

export interface CliTurn {
  sessionId: string;
  turnIndex: number;
  userMessage: string | null;
  assistantResponse: string | null;
  timestamp: string;
}

export interface SessionDelta {
  type: 'new_session' | 'new_turn' | 'session_updated';
  session?: CliSession;
  turn?: CliTurn;
}

// ── Process scanner ──

interface CopilotProcess {
  pid: number;
  cwd: string;
  tty: string;
}

function scanCopilotProcesses(): CopilotProcess[] {
  try {
    // Match only the native binary (not the node wrapper) to avoid duplicates
    const output = execSync(
      "ps -eo pid,tty,command | grep '[c]opilot-darwin\\|[c]opilot-linux' | head -20",
      { encoding: 'utf-8', timeout: 3000 },
    );
    const procs: CopilotProcess[] = [];
    const seenTTYs = new Set<string>();
    for (const line of output.trim().split('\n')) {
      if (!line.trim()) continue;
      const match = line.trim().match(/^(\d+)\s+(\S+)\s+(.+)/);
      if (!match) continue;
      const pid = parseInt(match[1], 10);
      if (!Number.isInteger(pid) || pid <= 0) continue;
      const tty = match[2]!;
      // Deduplicate by TTY — one session per terminal
      if (seenTTYs.has(tty)) continue;
      seenTTYs.add(tty);
      // Get cwd via lsof
      let cwd = '';
      try {
        cwd = execSync(`lsof -p ${pid} -Fn 2>/dev/null | grep '^n/' | head -1 | cut -c2-`, {
          encoding: 'utf-8',
          timeout: 2000,
        }).trim();
      } catch { /* skip */ }
      procs.push({ pid, tty, cwd });
    }
    return procs;
  } catch {
    return [];
  }
}

// ── Watcher class ──

export class CopilotSessionWatcher extends EventEmitter {
  private dbPath: string;
  private walPath: string;
  private db: Database.Database | null = null;
  private watcher: FSWatcher | null = null;
  private lastTurnId = 0;
  private lastSessionUpdate = '';
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private watching = false;

  constructor() {
    super();
    this.dbPath = join(homedir(), '.copilot', 'session-store.db');
    this.walPath = this.dbPath + '-wal';
  }

  /** Discover all active Copilot CLI sessions */
  discover(): CliSession[] {
    const procs = scanCopilotProcesses();
    const sessions = this.readRecentSessions();

    // Match processes to sessions: only the MOST RECENT session per cwd gets marked alive
    // (multiple old sessions may share the same cwd)
    const claimedCwds = new Set<string>();
    // Sessions are already sorted by updated_at DESC from readRecentSessions
    for (const session of sessions) {
      if (!session.cwd || claimedCwds.has(session.cwd)) continue;
      const proc = procs.find(p => p.cwd === session.cwd);
      if (proc) {
        session.pid = proc.pid;
        session.tty = proc.tty;
        session.isAlive = true;
        claimedCwds.add(session.cwd);
      }
    }

    return sessions;
  }

  /** Get turns for a specific session. Falls back to events.jsonl → checkpoints. */
  getSessionTurns(sessionId: string): CliTurn[] {
    this.ensureDb();
    if (!this.db) return [];

    // Try turns table first
    const rows = this.db.prepare(
      'SELECT session_id, turn_index, user_message, assistant_response, timestamp FROM turns WHERE session_id = ? ORDER BY turn_index',
    ).all(sessionId) as Array<{
      session_id: string;
      turn_index: number;
      user_message: string | null;
      assistant_response: string | null;
      timestamp: string;
    }>;

    if (rows.length > 0) {
      return rows.map(r => ({
        sessionId: r.session_id,
        turnIndex: r.turn_index,
        userMessage: r.user_message,
        assistantResponse: r.assistant_response,
        timestamp: r.timestamp,
      }));
    }

    // Fallback: read from events.jsonl (actual conversation data)
    const eventsPath = join(homedir(), '.copilot', 'session-state', sessionId, 'events.jsonl');
    if (existsSync(eventsPath)) {
      const jsonlTurns = this.parseEventsJsonl(sessionId, eventsPath);
      if (jsonlTurns.length > 0) return jsonlTurns;
    }

    // Last fallback: synthesize turns from checkpoints
    const checkpoints = this.db.prepare(
      'SELECT checkpoint_number, title, overview, history, work_done FROM checkpoints WHERE session_id = ? ORDER BY checkpoint_number',
    ).all(sessionId) as Array<{
      checkpoint_number: number;
      title: string;
      overview: string | null;
      history: string | null;
      work_done: string | null;
    }>;

    if (checkpoints.length === 0) return [];

    const session = this.db.prepare('SELECT created_at FROM sessions WHERE id = ?').get(sessionId) as { created_at: string } | undefined;
    const ts = session?.created_at ?? new Date().toISOString();

    return checkpoints.map((cp, i) => {
      const parts: string[] = [];
      if (cp.overview) parts.push(cp.overview);
      if (cp.history) parts.push(`\n**History:**\n${cp.history}`);
      if (cp.work_done) parts.push(`\n**Work Done:**\n${cp.work_done}`);

      return {
        sessionId,
        turnIndex: i,
        userMessage: null,
        assistantResponse: `## Checkpoint ${cp.checkpoint_number}: ${cp.title}\n\n${parts.join('\n')}`,
        timestamp: ts,
      };
    });
  }

  /** Parse events.jsonl into CliTurn[] — groups user.message + assistant.message pairs */
  private parseEventsJsonl(sessionId: string, filePath: string): CliTurn[] {
    try {
      const { readFileSync } = require('fs');
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter((l: string) => l.trim());

      const turns: CliTurn[] = [];
      let turnIndex = 0;
      let currentUserMessage: string | null = null;
      let currentAssistantParts: string[] = [];
      let currentTimestamp = '';

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.type === 'user.message') {
            // Flush previous turn if exists
            if (currentUserMessage || currentAssistantParts.length > 0) {
              turns.push({
                sessionId,
                turnIndex: turnIndex++,
                userMessage: currentUserMessage,
                assistantResponse: currentAssistantParts.join('') || null,
                timestamp: currentTimestamp || event.timestamp,
              });
            }
            currentUserMessage = event.data?.content ?? '';
            currentAssistantParts = [];
            currentTimestamp = event.timestamp;
          } else if (event.type === 'assistant.message') {
            const content = event.data?.content ?? '';
            if (content) currentAssistantParts.push(content);
          }
        } catch { /* skip malformed lines */ }
      }

      // Flush last turn
      if (currentUserMessage || currentAssistantParts.length > 0) {
        turns.push({
          sessionId,
          turnIndex: turnIndex++,
          userMessage: currentUserMessage,
          assistantResponse: currentAssistantParts.join('') || null,
          timestamp: currentTimestamp,
        });
      }

      return turns;
    } catch {
      return [];
    }
  }

  /** Start watching for changes */
  startWatching(): void {
    if (this.watching) return;
    this.watching = true;

    this.ensureDb();
    // Record current state
    this.lastTurnId = this.getMaxTurnId();
    this.lastSessionUpdate = this.getLatestUpdate();

    // Watch WAL file for changes (near-instant detection)
    const pathToWatch = existsSync(this.walPath) ? this.walPath : this.dbPath;
    try {
      this.watcher = watch(pathToWatch, () => this.onFileChange());
      console.log(`[watcher] Watching ${pathToWatch} for changes`);
    } catch (err) {
      console.error('[watcher] Failed to start file watcher:', err);
    }
  }

  /** Stop watching */
  stopWatching(): void {
    this.watching = false;
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ── Private ──

  private ensureDb(): void {
    // Close and reopen each time to get fresh WAL snapshot
    if (this.db) {
      try { this.db.close(); } catch { /* ignore */ }
      this.db = null;
    }
    if (!existsSync(this.dbPath)) return;
    // Must NOT be readonly to read uncommitted WAL data from other processes
    this.db = new Database(this.dbPath, { readonly: false, fileMustExist: true });
    this.db.pragma('journal_mode = WAL');
  }

  private readRecentSessions(): CliSession[] {
    this.ensureDb();
    if (!this.db) return [];
    const rows = this.db.prepare(
      "SELECT id, cwd, branch, summary, created_at, updated_at FROM sessions WHERE updated_at > datetime('now', '-24 hours') ORDER BY updated_at DESC LIMIT 50",
    ).all() as Array<{
      id: string;
      cwd: string | null;
      branch: string | null;
      summary: string | null;
      created_at: string;
      updated_at: string;
    }>;
    return rows.map(r => ({
      id: r.id,
      cwd: r.cwd,
      branch: r.branch,
      summary: r.summary,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      pid: null,
      tty: null,
      isAlive: false,
    }));
  }

  private getMaxTurnId(): number {
    this.ensureDb();
    if (!this.db) return 0;
    const row = this.db.prepare('SELECT MAX(id) as maxId FROM turns').get() as { maxId: number | null };
    return row?.maxId ?? 0;
  }

  private getLatestUpdate(): string {
    this.ensureDb();
    if (!this.db) return '';
    const row = this.db.prepare('SELECT MAX(updated_at) as latest FROM sessions').get() as { latest: string | null };
    return row?.latest ?? '';
  }

  private onFileChange(): void {
    // Debounce: multiple WAL writes in quick succession → single check
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.checkForDeltas(), 50);
  }

  private checkForDeltas(): void {
    if (!this.db) return;

    // Check for new turns
    const newTurns = this.db.prepare(
      'SELECT id, session_id, turn_index, user_message, assistant_response, timestamp FROM turns WHERE id > ? ORDER BY id',
    ).all(this.lastTurnId) as Array<{
      id: number;
      session_id: string;
      turn_index: number;
      user_message: string | null;
      assistant_response: string | null;
      timestamp: string;
    }>;

    for (const t of newTurns) {
      this.lastTurnId = t.id;
      const delta: SessionDelta = {
        type: 'new_turn',
        turn: {
          sessionId: t.session_id,
          turnIndex: t.turn_index,
          userMessage: t.user_message,
          assistantResponse: t.assistant_response,
          timestamp: t.timestamp,
        },
      };
      this.emit('delta', delta);
    }

    // Check for updated sessions
    const latestUpdate = this.getLatestUpdate();
    if (!this.db) return;
    if (latestUpdate !== this.lastSessionUpdate) {
      const oldCursor = this.lastSessionUpdate;
      this.lastSessionUpdate = latestUpdate;
      const updatedSessions = this.db.prepare(
        'SELECT id, cwd, branch, summary, created_at, updated_at FROM sessions WHERE updated_at > ? ORDER BY updated_at DESC',
      ).all(oldCursor) as Array<{
        id: string;
        cwd: string | null;
        branch: string | null;
        summary: string | null;
        created_at: string;
        updated_at: string;
      }>;

      for (const s of updatedSessions) {
        const delta: SessionDelta = {
          type: 'session_updated',
          session: {
            id: s.id,
            cwd: s.cwd,
            branch: s.branch,
            summary: s.summary,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            pid: null,
            tty: null,
            isAlive: false,
          },
        };
        this.emit('delta', delta);
      }
    }
  }
}
