import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const ConnectionStateSchema = z.enum([
  'Disconnected',
  'Connecting',
  'Connected',
  'Reconnecting',
  'CircuitOpen',
  'HalfOpen',
  'Failed',
]);
export type ConnectionState = z.infer<typeof ConnectionStateSchema>;

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const SessionTypeSchema = z.enum(['acp', 'cli', 'codex']);
export type SessionType = z.infer<typeof SessionTypeSchema>;

export const TransportTypeSchema = z.enum(['websocket', 'tcp']);
export type TransportType = z.infer<typeof TransportTypeSchema>;

// ─── Branded Identifiers ─────────────────────────────────────────────────────

const CLI_SESSION_PREFIX = 'cli:';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SessionIdSchema = z
  .string()
  .refine(
    (v) => v.startsWith(CLI_SESSION_PREFIX) || UUID_RE.test(v),
    { message: 'SessionId must be "cli:<id>" or a valid UUID' },
  )
  .brand('SessionId');
export type SessionId = z.infer<typeof SessionIdSchema>;

export const MessageIdSchema = z
  .string()
  .min(1)
  .brand('MessageId');
export type MessageId = z.infer<typeof MessageIdSchema>;

// ─── Server Endpoint ─────────────────────────────────────────────────────────

export const ServerEndpointSchema = z.object({
  scheme: z.enum(['ws', 'wss', 'tcp']),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65_535),
  authToken: z.string().optional(),
});
export type ServerEndpoint = z.infer<typeof ServerEndpointSchema>;

// ─── Factory Functions ───────────────────────────────────────────────────────

export function createSessionId(raw: string): SessionId {
  return SessionIdSchema.parse(raw);
}

export function createMessageId(raw: string): MessageId {
  return MessageIdSchema.parse(raw);
}

export function createServerEndpoint(
  input: z.input<typeof ServerEndpointSchema>,
): ServerEndpoint {
  return ServerEndpointSchema.parse(input);
}

// ─── Type Guards / Helpers ───────────────────────────────────────────────────

export function isCliSessionId(id: SessionId): boolean {
  return (id as string).startsWith(CLI_SESSION_PREFIX);
}
