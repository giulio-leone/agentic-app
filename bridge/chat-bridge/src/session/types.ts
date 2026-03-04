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
}

export interface SpawnOptions {
  cli: CliAgent;
  cwd: string;
  model?: string;
  args?: string[];
}
