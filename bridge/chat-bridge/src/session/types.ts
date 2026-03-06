/**
 * Session types — represents a running CLI session managed by the bridge.
 */

import type { CliAgent } from '../protocol/messages.js';

export interface Session {
  id: string;
  cli: CliAgent;
  cwd: string;
  model?: string;
  tmuxSession: string;
  pid?: number;
  alive: boolean;
  createdAt: Date;
  lastActivity: Date;
  title?: string;
  /** True for externally-detected sessions (from ~/.copilot/session-state/) */
  external?: boolean;
  /** External sessions are read-only — no stdin/message sending */
  readonly?: boolean;
  /** Git branch from workspace.yaml */
  branch?: string;
  /** GitHub repository from workspace.yaml */
  repository?: string;
}

export interface SpawnOptions {
  cli: CliAgent;
  cwd: string;
  model?: string;
  args?: string[];
}
