/**
 * Chat Bridge Protocol Types — shared between bridge server and app client.
 *
 * These types mirror bridge/chat-bridge/src/protocol/messages.ts
 * but are kept self-contained for the React Native app.
 */

export type CliAgent = 'claude' | 'copilot' | 'codex';

// ── Client → Server ──

export type ClientMsg =
  | { type: 'create_session'; cli: CliAgent; cwd?: string; model?: string; args?: string[] }
  | { type: 'message'; sessionId: string; content: string }
  | { type: 'stop'; sessionId: string }
  | { type: 'destroy_session'; sessionId: string }
  | { type: 'list_sessions' }
  | { type: 'resume_session'; sessionId: string }
  | { type: 'ping' }
  | { type: 'get_status' };

// ── Server → Client ──

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
  tailscale?: { enabled: boolean; ip?: string; dnsName?: string; url?: string; funnel?: boolean };
  meshnet?: { enabled: boolean; ip?: string; hostname?: string };
  local: { ip: string; port: number };
}

export type ServerMsg =
  | { type: 'session_created'; sessionId: string; cli: CliAgent; cwd: string; model?: string }
  | { type: 'session_destroyed'; sessionId: string }
  | { type: 'session_list'; sessions: SessionInfo[] }
  | { type: 'assistant_start'; sessionId: string; messageId: string }
  | { type: 'assistant_chunk'; sessionId: string; messageId: string; text: string }
  | { type: 'tool_use'; sessionId: string; messageId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'tool_result'; sessionId: string; messageId: string; toolName: string; output: string; isError?: boolean }
  | { type: 'thinking'; sessionId: string; messageId: string; text: string }
  | { type: 'assistant_end'; sessionId: string; messageId: string; stopReason?: string; usage?: UsageInfo }
  | { type: 'status'; network: NetworkInfo; sessions: SessionInfo[]; uptime: number }
  | { type: 'error'; message: string; sessionId?: string; code?: string }
  | { type: 'pong'; timestamp: number }
  | { type: 'session_event'; sessionId: string; event: string; detail?: string };
