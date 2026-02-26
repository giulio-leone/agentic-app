/**
 * Core type definitions for the Copilot SDK Bridge protocol.
 *
 * All messages exchanged over the WebSocket are JSON objects.
 * WebSocket frames handle framing — no NDJSON needed.
 *
 * Uses Zod for runtime validation of incoming client messages.
 */

import { z } from 'zod';

// ══════════════════════════════════════════════════════════════════
//  Shared primitives
// ══════════════════════════════════════════════════════════════════

/** Unique identifier for a chat session. */
export type SessionId = string;

/** Unique identifier for a request/response pair. */
export type MessageId = string;

// ── Base envelope ──

/** Every wire message carries at least a `type` and optional `id`. */
export const BaseMessageSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
});

// ══════════════════════════════════════════════════════════════════
//  Client → Bridge messages
// ══════════════════════════════════════════════════════════════════

// ── initialize ──

export const InitializeRequestSchema = z.object({
  type: z.literal('initialize'),
  id: z.string(),
  payload: z.object({
    clientVersion: z.string(),
    capabilities: z.array(z.string()).optional(),
  }),
});
export type InitializeRequest = z.infer<typeof InitializeRequestSchema>;

// ── session.new ──

export const SessionNewRequestSchema = z.object({
  type: z.literal('session.new'),
  id: z.string(),
  payload: z.object({
    model: z.string().optional(),
    systemPrompt: z.string().optional(),
  }),
});
export type SessionNewRequest = z.infer<typeof SessionNewRequestSchema>;

// ── session.list ──

export const SessionListRequestSchema = z.object({
  type: z.literal('session.list'),
  id: z.string(),
  payload: z.object({}).optional(),
});
export type SessionListRequest = z.infer<typeof SessionListRequestSchema>;

// ── session.prompt ──

export const SessionPromptRequestSchema = z.object({
  type: z.literal('session.prompt'),
  id: z.string(),
  payload: z.object({
    sessionId: z.string(),
    message: z.string(),
    model: z.string().optional(),
  }),
});
export type SessionPromptRequest = z.infer<typeof SessionPromptRequestSchema>;

// ── session.cancel ──

export const SessionCancelRequestSchema = z.object({
  type: z.literal('session.cancel'),
  id: z.string(),
  payload: z.object({
    sessionId: z.string(),
  }),
});
export type SessionCancelRequest = z.infer<typeof SessionCancelRequestSchema>;

// ── session.destroy ──

export const SessionDestroyRequestSchema = z.object({
  type: z.literal('session.destroy'),
  id: z.string(),
  payload: z.object({
    sessionId: z.string(),
  }),
});
export type SessionDestroyRequest = z.infer<typeof SessionDestroyRequestSchema>;

// ── models.list ──

export const ModelsListRequestSchema = z.object({
  type: z.literal('models.list'),
  id: z.string(),
  payload: z.object({}).optional(),
});
export type ModelsListRequest = z.infer<typeof ModelsListRequestSchema>;

// ── tool.response ──

export const ToolResponseMessageSchema = z.object({
  type: z.literal('tool.response'),
  id: z.string(),
  payload: z.object({
    sessionId: z.string(),
    toolCallId: z.string(),
    result: z.unknown(),
    approved: z.boolean().optional(),
  }),
});
export type ToolResponseMessage = z.infer<typeof ToolResponseMessageSchema>;

// ── mcp.list ──

export const McpListRequestSchema = z.object({
  type: z.literal('mcp.list'),
  id: z.string(),
  payload: z.object({}).optional(),
});
export type McpListRequest = z.infer<typeof McpListRequestSchema>;

// ── mcp.toggle ──

export const McpToggleRequestSchema = z.object({
  type: z.literal('mcp.toggle'),
  id: z.string(),
  payload: z.object({
    serverId: z.string(),
    enabled: z.boolean(),
  }),
});
export type McpToggleRequest = z.infer<typeof McpToggleRequestSchema>;

// ── mcp.add ──

export const McpAddRequestSchema = z.object({
  type: z.literal('mcp.add'),
  id: z.string(),
  payload: z.object({
    name: z.string(),
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
  }),
});
export type McpAddRequest = z.infer<typeof McpAddRequestSchema>;

// ── mcp.remove ──

export const McpRemoveRequestSchema = z.object({
  type: z.literal('mcp.remove'),
  id: z.string(),
  payload: z.object({
    serverId: z.string(),
  }),
});
export type McpRemoveRequest = z.infer<typeof McpRemoveRequestSchema>;

// ── Client message discriminated union ──

/** All valid client → bridge message schemas. */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  InitializeRequestSchema,
  SessionNewRequestSchema,
  SessionListRequestSchema,
  SessionPromptRequestSchema,
  SessionCancelRequestSchema,
  SessionDestroyRequestSchema,
  ModelsListRequestSchema,
  ToolResponseMessageSchema,
  McpListRequestSchema,
  McpToggleRequestSchema,
  McpAddRequestSchema,
  McpRemoveRequestSchema,
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ══════════════════════════════════════════════════════════════════
//  Bridge → Client messages (TypeScript-only, no runtime validation)
// ══════════════════════════════════════════════════════════════════

// ── initialize response ──

export interface InitializeResponse {
  type: 'initialize.result';
  id: string;
  payload: {
    bridgeVersion: string;
    capabilities: string[];
    authenticated: boolean;
  };
}

// ── session.new response ──

export interface SessionNewResponse {
  type: 'session.new.result';
  id: string;
  payload: {
    sessionId: SessionId;
    model: string;
  };
}

// ── session.list response ──

export interface SessionListResponse {
  type: 'session.list.result';
  id: string;
  payload: {
    sessions: Array<{
      sessionId: SessionId;
      model: string;
      createdAt: string;
      lastActivity: string;
    }>;
  };
}

// ── models.list response ──

export interface ModelsListResponse {
  type: 'models.list.result';
  id: string;
  payload: {
    models: Array<{
      id: string;
      name: string;
      vendor: string;
    }>;
  };
}

// ── streaming ack ──

export interface StreamingAckResponse {
  type: 'session.prompt.ack';
  id: string;
  payload: {
    sessionId: SessionId;
  };
}

// ── session.destroy response ──

export interface SessionDestroyResponse {
  type: 'session.destroy.result';
  id: string;
  payload: { sessionId: string; destroyed: boolean };
}

// ── session.cancel response ──

export interface SessionCancelResponse {
  type: 'session.cancel.result';
  id: string;
  payload: { sessionId: string; cancelled: boolean };
}

// ── error response ──

export interface ErrorResponse {
  type: 'error';
  id?: string;
  payload: {
    code: string;
    message: string;
    sessionId?: SessionId;
  };
}

// ── auth status notification ──

export interface AuthStatusNotification {
  type: 'auth.status';
  payload: {
    authenticated: boolean;
    username?: string;
    loginUrl?: string;
    userCode?: string;
  };
}

// ── stream event notification ──

export type StreamEventKind =
  | 'message.start'
  | 'message.delta'
  | 'message.end'
  | 'tool.call'
  | 'tool.result'
  | 'thinking'
  | 'error'
  | 'session.idle';

export interface StreamEventNotification {
  type: 'stream.event';
  payload: {
    sessionId: SessionId;
    kind: StreamEventKind;
    data: unknown;
  };
}

// ── tool request notification ──

export type ToolRequestKind = 'ask_user' | 'approve_action';

export interface ToolRequestNotification {
  type: 'tool.request';
  payload: {
    sessionId: SessionId;
    kind: ToolRequestKind;
    toolCallId: string;
    toolName: string;
    args: unknown;
    message?: string;
  };
}

// ── mcp.list response ──

export interface McpListResponse {
  type: 'mcp.list.result';
  id: string;
  payload: {
    servers: Array<{
      id: string;
      name: string;
      enabled: boolean;
      tools: string[];
    }>;
  };
}

// ── Bridge message discriminated union ──

export type BridgeMessage =
  | InitializeResponse
  | SessionNewResponse
  | SessionListResponse
  | SessionCancelResponse
  | SessionDestroyResponse
  | ModelsListResponse
  | StreamingAckResponse
  | ErrorResponse
  | AuthStatusNotification
  | StreamEventNotification
  | ToolRequestNotification
  | McpListResponse;
