/**
 * Core types for the Unified Bridge.
 *
 * Defines the ProviderAdapter contract (ISP — Interface Segregation Principle),
 * streaming callbacks, event types, and shared JSON-RPC primitives.
 */

// ── JSON-RPC 2.0 ──

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCNotification;

// ── Model & Session ──

export interface ModelInfo {
  id: string;
  name: string;
  provider?: string;
}

export interface SessionInfo {
  id: string;
  provider: string;
  model: string;
  cwd?: string;
}

export interface SessionSummary {
  id: string;
  provider: string;
  model: string;
  createdAt: string;
  title?: string;
  cwd?: string;
}

export interface CreateSessionOpts {
  model?: string;
  cwd?: string;
  reasoningEffort?: string;
}

// ── Agent Events (terminal, file edits, tool calls) ──

export type AgentEventKind =
  | 'terminal_command'
  | 'terminal_output'
  | 'file_edit'
  | 'file_read'
  | 'tool_call'
  | 'tool_result'
  | 'reasoning';

export interface AgentEvent {
  kind: AgentEventKind;
  /** Command or tool name */
  name?: string;
  /** Command args, file path, etc. */
  data?: Record<string, unknown>;
  /** Raw output for terminal events */
  output?: string;
  /** Timestamp */
  timestamp: number;
}

// ── ACP Session Updates ──

export type SessionUpdateType =
  | 'agent_message_start'
  | 'agent_message_chunk'
  | 'agent_message_end'
  | 'agent_event';

export interface SessionUpdate {
  sessionUpdate: SessionUpdateType;
  content: {
    type?: string;
    text?: string;
    event?: AgentEvent;
  };
}

// ── Stream Callbacks (SRP — one responsibility per callback) ──

export interface StreamCallbacks {
  onMessageStart(): void;
  onMessageChunk(text: string): void;
  onMessageEnd(): void;
  onAgentEvent(event: AgentEvent): void;
  onError(error: string): void;
}

// ── Provider Info (returned on initialize) ──

export interface ProviderInfo {
  id: string;
  name: string;
  version: string;
  models: ModelInfo[];
  capabilities: {
    streaming: boolean;
    cancel: boolean;
    multiSession: boolean;
    agentEvents: boolean;
  };
}

// ── Provider Adapter (ISP — minimal contract for any provider) ──

export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;

  /** Start the provider (e.g., spawn process, connect SDK). */
  initialize(): Promise<ProviderInfo>;

  /** Gracefully shutdown. */
  shutdown(): Promise<void>;

  /** List available models. */
  listModels(): Promise<ModelInfo[]>;

  /** Create a new session/thread. Returns session info with prefixed ID. */
  createSession(opts: CreateSessionOpts): Promise<SessionInfo>;

  /** List active sessions. */
  listSessions(): Promise<SessionSummary[]>;

  /** Destroy a session by ID. */
  destroySession(sessionId: string): Promise<boolean>;

  /** Send prompt and stream response via callbacks. */
  prompt(
    sessionId: string,
    text: string,
    callbacks: StreamCallbacks
  ): Promise<void>;

  /** Cancel an in-flight prompt. */
  cancel(sessionId: string): Promise<boolean>;
}

// ── ACP Agent Profile (what app expects from initialize) ──

export interface AgentProfile {
  name: string;
  version: string;
  capabilities: {
    promptCapabilities: { image: boolean };
    modelListing?: boolean;
    multiSession?: boolean;
    cancel?: boolean;
    agentEvents?: boolean;
  };
  modes: Array<{ id: string; name: string; description?: string }>;
  models?: ModelInfo[];
  providers?: Array<{ id: string; name: string }>;
}

// ── Bridge Config ──

export interface BridgeConfig {
  port: number;
  providers: ProviderConfig[];
  workingDirectory: string;
}

export interface ProviderConfig {
  type: 'copilot' | 'codex';
  enabled: boolean;
  model?: string;
  /** Reasoning effort for supported models (low, medium, high) */
  reasoningEffort?: 'low' | 'medium' | 'high';
  /** Copilot-specific: path to CLI binary */
  cliPath?: string;
  /** Codex-specific: path to codex binary */
  codexPath?: string;
  /** Codex-specific: approval policy */
  approvalPolicy?: string;
  /** Codex-specific: sandbox mode */
  sandbox?: string;
}
