import { z } from 'zod';

import {
  SessionIdSchema,
  MessageIdSchema,
  ServerEndpointSchema,
  ConnectionStateSchema,
  MessageRoleSchema,
  SessionTypeSchema,
  TransportTypeSchema,
  type SessionId,
  type MessageId,
  type MessageRole,
  type SessionType,
  type ConnectionState,
  type TransportType,
  type ServerEndpoint,
} from '../value-objects';

// ─── MessageSegment (discriminated union) ────────────────────────────────────

const TextSegmentSchema = z.object({
  type: z.literal('text'),
  content: z.string(),
});

const ToolCallSegmentSchema = z.object({
  type: z.literal('toolCall'),
  toolName: z.string().min(1),
  args: z.record(z.string(), z.unknown()),
  result: z.string().optional(),
});

const ThoughtSegmentSchema = z.object({
  type: z.literal('thought'),
  content: z.string(),
});

const ArtifactSegmentSchema = z.object({
  type: z.literal('artifact'),
  title: z.string().min(1),
  language: z.string().optional(),
  content: z.string(),
});

export const MessageSegmentSchema = z.discriminatedUnion('type', [
  TextSegmentSchema,
  ToolCallSegmentSchema,
  ThoughtSegmentSchema,
  ArtifactSegmentSchema,
]);

export type MessageSegment = Readonly<z.infer<typeof MessageSegmentSchema>>;

// ─── Message ─────────────────────────────────────────────────────────────────

export const MessageSchema = z.object({
  id: MessageIdSchema,
  role: MessageRoleSchema,
  content: z.string(),
  timestamp: z.number(),
  sessionId: SessionIdSchema,
  segments: z.array(MessageSegmentSchema).optional(),
  isStreaming: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type Message = Readonly<z.infer<typeof MessageSchema>>;

// ─── Session ─────────────────────────────────────────────────────────────────

export const SessionSchema = z.object({
  id: SessionIdSchema,
  type: SessionTypeSchema,
  title: z.string().optional(),
  description: z.string().optional(),
  cwd: z.string().optional(),
  messages: z.array(MessageSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
  isAlive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type Session = Readonly<z.infer<typeof SessionSchema>>;

// ─── Terminal ────────────────────────────────────────────────────────────────

export const TerminalSchema = z.object({
  id: z.string().min(1),
  sessionId: SessionIdSchema.optional(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
  isActive: z.boolean(),
  pid: z.number().int().positive().optional(),
});

export type Terminal = Readonly<z.infer<typeof TerminalSchema>>;

// ─── Connection ──────────────────────────────────────────────────────────────

export const ConnectionSchema = z.object({
  endpoint: ServerEndpointSchema,
  transport: TransportTypeSchema,
  state: ConnectionStateSchema,
  lastConnectedAt: z.number().optional(),
  retryCount: z.number().int().nonnegative(),
  circuitBreakerFailures: z.number().int().nonnegative(),
});

export type Connection = Readonly<z.infer<typeof ConnectionSchema>>;

// ─── CliSessionInfo ──────────────────────────────────────────────────────────

export const CliSessionInfoSchema = z.object({
  id: z.string().min(1),
  cwd: z.string().optional(),
  branch: z.string().optional(),
  summary: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  pid: z.number().int().positive().optional(),
  tty: z.string().optional(),
  isAlive: z.boolean().optional(),
});

export type CliSessionInfo = Readonly<z.infer<typeof CliSessionInfoSchema>>;

// ─── Factory Functions ───────────────────────────────────────────────────────

export function createMessage(input: z.input<typeof MessageSchema>): Message {
  return Object.freeze(MessageSchema.parse(input));
}

export function createSession(input: z.input<typeof SessionSchema>): Session {
  return Object.freeze(SessionSchema.parse(input));
}

export function createTerminal(input: z.input<typeof TerminalSchema>): Terminal {
  return Object.freeze(TerminalSchema.parse(input));
}

export function createConnection(input: z.input<typeof ConnectionSchema>): Connection {
  return Object.freeze(ConnectionSchema.parse(input));
}

export function createCliSessionInfo(
  input: z.input<typeof CliSessionInfoSchema>,
): CliSessionInfo {
  return Object.freeze(CliSessionInfoSchema.parse(input));
}
