/**
 * WebSocket Chat Protocol — Message Types
 *
 * Defines all client→server and server→client message types
 * for the chat bridge WebSocket protocol.
 *
 * Design: flat JSON messages with a `type` discriminator.
 * No JSON-RPC, no envelope — just simple chat messages.
 */

// ── CLI Agent Types ──

export type CliAgent = 'claude' | 'copilot' | 'codex';

// ── Client → Server Messages ──

export interface ClientCreateSession {
  type: 'create_session';
  cli: CliAgent;
  cwd?: string;
  model?: string;
  args?: string[];
}

export interface ClientMessage {
  type: 'message';
  sessionId: string;
  content: string;
}

export interface ClientStop {
  type: 'stop';
  sessionId: string;
}

export interface ClientDestroySession {
  type: 'destroy_session';
  sessionId: string;
}

export interface ClientListSessions {
  type: 'list_sessions';
}

export interface ClientResumeSession {
  type: 'resume_session';
  sessionId: string;
}

export interface ClientPing {
  type: 'ping';
}

export interface ClientGetStatus {
  type: 'get_status';
}

export type ClientMsg =
  | ClientCreateSession
  | ClientMessage
  | ClientStop
  | ClientDestroySession
  | ClientListSessions
  | ClientResumeSession
  | ClientPing
  | ClientGetStatus;

// ── Server → Client Messages ──

export interface ServerSessionCreated {
  type: 'session_created';
  sessionId: string;
  cli: CliAgent;
  cwd: string;
  model?: string;
}

export interface ServerSessionDestroyed {
  type: 'session_destroyed';
  sessionId: string;
}

export interface ServerSessionList {
  type: 'session_list';
  sessions: SessionInfo[];
}

/** Start of an assistant response */
export interface ServerAssistantStart {
  type: 'assistant_start';
  sessionId: string;
  messageId: string;
}

/** Streaming text chunk */
export interface ServerAssistantChunk {
  type: 'assistant_chunk';
  sessionId: string;
  messageId: string;
  text: string;
}

/** Tool use notification (file edit, terminal command, etc.) */
export interface ServerToolUse {
  type: 'tool_use';
  sessionId: string;
  messageId: string;
  toolName: string;
  input: Record<string, unknown>;
}

/** Tool result notification */
export interface ServerToolResult {
  type: 'tool_result';
  sessionId: string;
  messageId: string;
  toolName: string;
  output: string;
  isError?: boolean;
}

/** Thinking/reasoning content */
export interface ServerThinking {
  type: 'thinking';
  sessionId: string;
  messageId: string;
  text: string;
}

/** End of assistant response */
export interface ServerAssistantEnd {
  type: 'assistant_end';
  sessionId: string;
  messageId: string;
  stopReason?: string;
  usage?: UsageInfo;
}

/** System-level status update */
export interface ServerStatus {
  type: 'status';
  network: NetworkInfo;
  sessions: SessionInfo[];
  uptime: number;
}

/** Error message */
export interface ServerError {
  type: 'error';
  message: string;
  sessionId?: string;
  code?: string;
}

/** Pong (heartbeat response) */
export interface ServerPong {
  type: 'pong';
  timestamp: number;
}

/** Session activity notification (session resumed, stopped, etc.) */
export interface ServerSessionEvent {
  type: 'session_event';
  sessionId: string;
  event: 'started' | 'stopped' | 'resumed' | 'error' | 'idle' | 'user_message';
  detail?: string;
}

export type ServerMsg =
  | ServerSessionCreated
  | ServerSessionDestroyed
  | ServerSessionList
  | ServerAssistantStart
  | ServerAssistantChunk
  | ServerToolUse
  | ServerToolResult
  | ServerThinking
  | ServerAssistantEnd
  | ServerStatus
  | ServerError
  | ServerPong
  | ServerSessionEvent;

// ── Shared Types ──

export interface SessionInfo {
  id: string;
  cli: CliAgent;
  cwd: string;
  model?: string;
  alive: boolean;
  createdAt: string;
  lastActivity?: string;
  title?: string;
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  cost?: number;
  durationMs?: number;
}

export interface NetworkInfo {
  tailscale?: {
    enabled: boolean;
    ip?: string;
    dnsName?: string;
    url?: string;
    funnel?: boolean;
  };
  meshnet?: {
    enabled: boolean;
    ip?: string;
    hostname?: string;
  };
  local: {
    ip: string;
    port: number;
  };
}

// ── Auth ──

export interface AuthConfig {
  token?: string;
}
