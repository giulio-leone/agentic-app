/**
 * Type definitions for the web-ui BridgeClient.
 * Mirrors the copilot-sdk-bridge WebSocket protocol without Zod.
 */

// ── Connection state ─────────────────────────────────────────────────────────

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'authenticated';

// ── Wire envelope ────────────────────────────────────────────────────────────

export interface BridgeMessage {
  type: string;
  id?: string;
  payload?: unknown;
}

// ── Response payloads ────────────────────────────────────────────────────────

export interface InitializeResult {
  bridgeVersion: string;
  capabilities: string[];
  authenticated: boolean;
}

export interface Model {
  id: string;
  name: string;
  vendor: string;
  family: string;
  version: string;
  capabilities: { chat: boolean; reasoning: boolean };
}

export interface ModelsListResult {
  models: Model[];
}

export interface Session {
  sessionId: string;
  model: string;
  cwd: string;
}

export interface SessionListResult {
  sessions: Session[];
}

export interface SessionNewResult {
  sessionId: string;
  model: string;
}

// ── CLI session types ────────────────────────────────────────────────────────

export interface CliSessionMetadata {
  sessionId: string;
  startTime: string;
  modifiedTime: string;
  summary?: string;
  isRemote: boolean;
  context?: {
    cwd?: string;
    gitRoot?: string;
    repository?: string;
    branch?: string;
  };
}

export interface CliSessionsListResult {
  sessions: CliSessionMetadata[];
}

export interface CliSessionsResumeResult {
  sessionId: string;
  bridgeSessionId: string;
  model: string;
}

export interface CliSessionMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  type: string;
}

export interface CliSessionsMessagesResult {
  messages: CliSessionMessage[];
}

export interface CliSessionFilter {
  cwd?: string;
  gitRoot?: string;
  repository?: string;
  branch?: string;
}

// ── Stream callbacks ─────────────────────────────────────────────────────────

export interface StreamCallbacks {
  onContent: (text: string) => void;
  onComplete: () => void;
  onError: (err: string | Error) => void;
  onReasoning?: (text: string) => void;
  onToolCall?: (name: string, args: string) => void;
  onToolResult?: (result: string) => void;
}

// ── Console log ──────────────────────────────────────────────────────────────

export interface ConsoleLogEntry {
  timestamp: number;
  direction: 'in' | 'out';
  type: string;
  raw: string;
  id?: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

export type StreamEventKind =
  | 'message.start'
  | 'message.delta'
  | 'message.end'
  | 'tool.call'
  | 'tool.result'
  | 'thinking'
  | 'error'
  | 'session.idle';

export interface StreamEventPayload {
  sessionId: string;
  kind: StreamEventKind;
  data: Record<string, unknown>;
}

export interface ErrorPayload {
  code: string;
  message: string;
  sessionId?: string;
}

export interface AuthStatusPayload {
  authenticated: boolean;
  username?: string;
  loginUrl?: string;
  userCode?: string;
}
