/**
 * tmux Session Manager — create, list, kill tmux sessions for CLI agents.
 *
 * Each CLI session gets its own tmux session for persistence.
 * If the bridge restarts, we can re-discover running sessions.
 */

import { execSync, execFile } from 'child_process';
import { Logger } from '../utils/logger.js';

const log = new Logger('tmux');

const TMUX_PREFIX = 'cb-'; // chat-bridge session prefix

export class TmuxManager {
  /** Check if tmux is available */
  static isAvailable(): boolean {
    try {
      execSync('which tmux', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /** Create a new tmux session running a command, returns session name */
  createSession(name: string, command: string, cwd: string): string {
    const sessionName = `${TMUX_PREFIX}${name}`;
    try {
      execSync(
        `tmux new-session -d -s ${this.esc(sessionName)} -c ${this.esc(cwd)} ${this.esc(command)}`,
        { stdio: 'pipe' },
      );
      log.info(`Created tmux session: ${sessionName}`, { command, cwd });
      return sessionName;
    } catch (err) {
      const msg = (err as Error).message;
      log.error(`Failed to create tmux session: ${msg}`);
      throw new Error(`tmux create failed: ${msg}`);
    }
  }

  /** List all chat-bridge tmux sessions */
  listSessions(): Array<{ name: string; created: string; alive: boolean }> {
    try {
      const output = execSync(
        `tmux list-sessions -F "#{session_name}|#{session_created}" 2>/dev/null || true`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      ).trim();

      if (!output) return [];

      return output
        .split('\n')
        .filter((line) => line.startsWith(TMUX_PREFIX))
        .map((line) => {
          const [name, created] = line.split('|');
          return {
            name: name!,
            created: created ? new Date(parseInt(created) * 1000).toISOString() : '',
            alive: true,
          };
        });
    } catch {
      return [];
    }
  }

  /** Check if a tmux session is alive */
  isAlive(sessionName: string): boolean {
    try {
      execSync(`tmux has-session -t ${this.esc(sessionName)} 2>/dev/null`, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /** Send keys (input) to a tmux session */
  sendKeys(sessionName: string, input: string): void {
    try {
      execSync(`tmux send-keys -t ${this.esc(sessionName)} ${this.esc(input)} Enter`, {
        stdio: 'pipe',
      });
    } catch (err) {
      log.warn(`sendKeys failed for ${sessionName}: ${(err as Error).message}`);
    }
  }

  /** Send raw text to a tmux session (no Enter) */
  sendRaw(sessionName: string, text: string): void {
    try {
      execSync(`tmux send-keys -t ${this.esc(sessionName)} -l ${this.esc(text)}`, {
        stdio: 'pipe',
      });
    } catch (err) {
      log.warn(`sendRaw failed for ${sessionName}: ${(err as Error).message}`);
    }
  }

  /** Kill a tmux session */
  killSession(sessionName: string): void {
    try {
      execSync(`tmux kill-session -t ${this.esc(sessionName)}`, { stdio: 'pipe' });
      log.info(`Killed tmux session: ${sessionName}`);
    } catch {
      log.warn(`Session ${sessionName} already dead or not found`);
    }
  }

  /** Capture pane content (for re-reading output) */
  capturePaneContent(sessionName: string, lines = 2000): string {
    try {
      return execSync(
        `tmux capture-pane -t ${this.esc(sessionName)} -p -S -${lines}`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
    } catch {
      return '';
    }
  }

  /** Get PID of the process running in a tmux session */
  getSessionPid(sessionName: string): number | undefined {
    try {
      const pid = execSync(
        `tmux list-panes -t ${this.esc(sessionName)} -F "#{pane_pid}"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      ).trim();
      return pid ? parseInt(pid, 10) : undefined;
    } catch {
      return undefined;
    }
  }

  /** Escape shell argument */
  private esc(arg: string): string {
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
}
