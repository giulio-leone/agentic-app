/**
 * Client-side mirror of the copilot-sdk-bridge WebSocket protocol types.
 * Kept in sync with bridge/copilot-sdk-bridge/src/types.ts but without Zod
 * (no runtime validation needed on the RN client).
 */

// ── Shared primitives ────────────────────────────────────────────────────────

export type SessionId = string;
export type MessageId = string;

// ── Connection state ─────────────────────────────────────────────────────────

export type CopilotConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'authenticated';

// ── Config ───────────────────────────────────────────────────────────────────

export interface CopilotBridgeConfig {
  url: string;
  token?: string;
  reconnect?: boolean;
}

// ── Stream callbacks ─────────────────────────────────────────────────────────

export interface ToolRequest {
  kind: 'ask_user' | 'approve_action';
  toolCallId: string;
  toolName: string;
  message: string;
  args?: unknown;
  choices?: string[];
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onComplete: (stopReason: string) => void;
  onError: (error: Error) => void;
  onReasoning?: (text: string) => void;
  onToolCall?: (toolName: string, args: string) => void;
  onToolResult?: (toolName: string, result: string) => void;
  onToolRequest?: (request: ToolRequest) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Client → Bridge messages
// ══════════════════════════════════════════════════════════════════════════════

export interface InitializeRequest {
  type: 'initialize';
  id: string;
  payload: {
    clientVersion: string;
    capabilities?: string[];
  };
}

export interface SessionNewRequest {
  type: 'session.new';
  id: string;
  payload: {
    model?: string;
    systemPrompt?: string;
    reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  };
}

export interface SessionListRequest {
  type: 'session.list';
  id: string;
  payload?: Record<string, never>;
}

export interface SessionPromptRequest {
  type: 'session.prompt';
  id: string;
  payload: {
    sessionId: string;
    message: string;
    model?: string;
    reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  };
}

export interface SessionCancelRequest {
  type: 'session.cancel';
  id: string;
  payload: {
    sessionId: string;
  };
}

export interface SessionDestroyRequest {
  type: 'session.destroy';
  id: string;
  payload: {
    sessionId: string;
  };
}

export interface ModelsListRequest {
  type: 'models.list';
  id: string;
  payload?: Record<string, never>;
}

export interface ToolResponseMessage {
  type: 'tool.response';
  id: string;
  payload: {
    sessionId: string;
    toolCallId: string;
    result: unknown;
    approved?: boolean;
  };
}

export interface McpListRequest {
  type: 'mcp.list';
  id: string;
  payload?: Record<string, never>;
}

export interface McpToggleRequest {
  type: 'mcp.toggle';
  id: string;
  payload: {
    serverId: string;
    enabled: boolean;
  };
}

export type ClientMessage =
  | InitializeRequest
  | SessionNewRequest
  | SessionListRequest
  | SessionPromptRequest
  | SessionCancelRequest
  | SessionDestroyRequest
  | ModelsListRequest
  | ToolResponseMessage
  | McpListRequest
  | McpToggleRequest;

// ══════════════════════════════════════════════════════════════════════════════
//  Bridge → Client messages
// ══════════════════════════════════════════════════════════════════════════════

export interface InitializeResponsePayload {
  bridgeVersion: string;
  capabilities: string[];
  authenticated: boolean;
}

export interface SessionNewResponsePayload {
  sessionId: SessionId;
  model: string;
}

export interface SessionInfo {
  sessionId: SessionId;
  model: string;
  createdAt: string;
  lastActivity: string;
}

export interface SessionListResponsePayload {
  sessions: SessionInfo[];
}

export interface ModelInfo {
  id: string;
  name: string;
  vendor: string;
}

export interface ModelsListResponsePayload {
  models: ModelInfo[];
}

export interface McpServerInfo {
  id: string;
  name: string;
  enabled: boolean;
  tools: string[];
}

export interface McpListResponsePayload {
  servers: McpServerInfo[];
}

export interface ErrorPayload {
  code: string;
  message: string;
  sessionId?: SessionId;
}

export interface AuthStatusPayload {
  authenticated: boolean;
  username?: string;
  loginUrl?: string;
  userCode?: string;
}

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
  sessionId: SessionId;
  kind: StreamEventKind;
  data: Record<string, unknown>;
}

export type ToolRequestKind = 'ask_user' | 'approve_action';

export interface ToolRequestPayload {
  sessionId: SessionId;
  kind: ToolRequestKind;
  toolCallId: string;
  toolName: string;
  args: unknown;
  message?: string;
}

/** Inbound message from the bridge (parsed from JSON). */
export interface BridgeEnvelope {
  type: string;
  id?: string;
  payload: unknown;
}
