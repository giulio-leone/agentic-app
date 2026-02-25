import { z } from 'zod';

// ─── Base JSON-RPC ──────────────────────────────────────────────────────────

export const JsonRpcIdSchema = z.union([z.string(), z.number()]);

export const JsonRpcErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
});

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: JsonRpcIdSchema,
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: JsonRpcIdSchema,
  result: z.unknown().optional(),
  error: JsonRpcErrorSchema.optional(),
});

export const JsonRpcNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

// ─── Helper / Domain Types ──────────────────────────────────────────────────

export const SessionSummarySchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  cwd: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  isCliSession: z.boolean().optional(),
  isAlive: z.boolean().optional(),
});

export const TurnSchema = z.object({
  turnIndex: z.number(),
  userMessage: z.string(),
  assistantResponse: z.string(),
});

export const TerminalInfoSchema = z.object({
  id: z.string(),
  pid: z.number().optional(),
  shell: z.string().optional(),
  cwd: z.string().optional(),
  isActive: z.boolean(),
});

export const PtyInfoSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  pid: z.number().optional(),
  isAlive: z.boolean(),
});

export const FsEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.literal(['file', 'directory']),
  size: z.number().optional(),
});

export const WireCliSessionInfoSchema = z.object({
  id: z.string(),
  cwd: z.string().optional(),
  branch: z.string().optional(),
  summary: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  pid: z.number().optional(),
  tty: z.string().optional(),
  isAlive: z.boolean().optional(),
});

export const AttachmentSchema = z.object({
  type: z.string(),
  data: z.unknown(),
});

export const SuccessResultSchema = z.object({ success: z.boolean() });

// ─── Session Method Schemas ─────────────────────────────────────────────────

export const SessionNewParamsSchema = z.object({
  title: z.string().optional(),
  cwd: z.string().optional(),
  mode: z.string().optional(),
});
export const SessionNewResultSchema = z.object({ sessionId: z.string() });

export const SessionLoadParamsSchema = z.object({ sessionId: z.string() });
export const SessionLoadResultSchema = z.object({ session: SessionSummarySchema });

export const SessionListParamsSchema = z.object({});
export const SessionListResultSchema = z.object({ sessions: z.array(SessionSummarySchema) });

export const SessionPromptParamsSchema = z.object({
  sessionId: z.string(),
  message: z.string(),
  attachments: z.array(AttachmentSchema).optional(),
});
export const SessionPromptResultSchema = SuccessResultSchema;

export const SessionCancelParamsSchema = z.object({ sessionId: z.string() });
export const SessionCancelResultSchema = SuccessResultSchema;

export const SessionSetModeParamsSchema = z.object({
  sessionId: z.string(),
  mode: z.string(),
});
export const SessionSetModeResultSchema = SuccessResultSchema;

export const SessionResumeParamsSchema = z.object({ sessionId: z.string() });
export const SessionResumeResultSchema = SuccessResultSchema;

// ─── Terminal Method Schemas ────────────────────────────────────────────────

export const TerminalSpawnParamsSchema = z.object({
  shell: z.string().optional(),
  cwd: z.string().optional(),
  cols: z.number().optional(),
  rows: z.number().optional(),
});
export const TerminalSpawnResultSchema = z.object({
  terminalId: z.string(),
  pid: z.number(),
});

export const TerminalInputParamsSchema = z.object({
  terminalId: z.string(),
  data: z.string(),
});
export const TerminalInputResultSchema = SuccessResultSchema;

export const TerminalResizeParamsSchema = z.object({
  terminalId: z.string(),
  cols: z.number(),
  rows: z.number(),
});
export const TerminalResizeResultSchema = SuccessResultSchema;

export const TerminalCloseParamsSchema = z.object({ terminalId: z.string() });
export const TerminalCloseResultSchema = SuccessResultSchema;

export const TerminalListParamsSchema = z.object({});
export const TerminalListResultSchema = z.object({ terminals: z.array(TerminalInfoSchema) });

// ─── Copilot CLI Method Schemas ─────────────────────────────────────────────

export const CopilotDiscoverParamsSchema = z.object({});
export const CopilotDiscoverResultSchema = z.object({ sessions: z.array(WireCliSessionInfoSchema) });

export const CopilotSpawnParamsSchema = z.object({
  command: z.string().optional(),
  cwd: z.string().optional(),
});
export const CopilotSpawnResultSchema = z.object({
  sessionId: z.string(),
  ptyId: z.string(),
});

export const CopilotWriteParamsSchema = z.object({
  sessionId: z.string(),
  input: z.string(),
  closeStdin: z.boolean().optional(),
});
export const CopilotWriteResultSchema = SuccessResultSchema;

export const CopilotKillParamsSchema = z.object({ sessionId: z.string() });
export const CopilotKillResultSchema = SuccessResultSchema;

export const CopilotSessionsTurnsParamsSchema = z.object({ sessionId: z.string() });
export const CopilotSessionsTurnsResultSchema = z.object({ turns: z.array(TurnSchema) });

export const CopilotWatchStartParamsSchema = z.object({});
export const CopilotWatchStartResultSchema = SuccessResultSchema;

export const CopilotWatchStopParamsSchema = z.object({});
export const CopilotWatchStopResultSchema = SuccessResultSchema;

export const CopilotPtyListParamsSchema = z.object({});
export const CopilotPtyListResultSchema = z.object({ ptys: z.array(PtyInfoSchema) });

// ─── Filesystem Method Schemas ──────────────────────────────────────────────

export const FsListParamsSchema = z.object({ path: z.string() });
export const FsListResultSchema = z.object({ entries: z.array(FsEntrySchema) });

// ─── System Method Schemas ──────────────────────────────────────────────────

export const InitializeParamsSchema = z.object({
  clientName: z.string(),
  clientVersion: z.string(),
});
export const InitializeResultSchema = z.object({
  serverName: z.string(),
  version: z.string(),
  capabilities: z.record(z.string(), z.unknown()),
  models: z.array(z.string()).optional(),
});

// ─── Notification Param Schemas ─────────────────────────────────────────────

export const SessionUpdateNotifParamsSchema = z.object({
  sessionId: z.string(),
  action: z.string(),
  content: z.string().optional(),
}).passthrough();

export const TerminalDataNotifParamsSchema = z.object({
  terminalId: z.string(),
  data: z.string(),
});

export const TerminalExitNotifParamsSchema = z.object({
  terminalId: z.string(),
  exitCode: z.number().optional(),
});

export const CopilotPtyOutputNotifParamsSchema = z.object({
  ptyId: z.string(),
  data: z.string(),
});

export const CopilotPtyExitNotifParamsSchema = z.object({
  ptyId: z.string(),
  exitCode: z.number().optional(),
});

export const CopilotDeltaNotifParamsSchema = z.object({
  type: z.literal(['new_turn', 'session_updated', 'new_session']),
  sessionId: z.string().optional(),
}).passthrough();

// ─── Method Registry ────────────────────────────────────────────────────────

const methodSchemas = {
  'session/new':            { params: SessionNewParamsSchema,            result: SessionNewResultSchema },
  'session/load':           { params: SessionLoadParamsSchema,           result: SessionLoadResultSchema },
  'session/list':           { params: SessionListParamsSchema,           result: SessionListResultSchema },
  'session/prompt':         { params: SessionPromptParamsSchema,         result: SessionPromptResultSchema },
  'session/cancel':         { params: SessionCancelParamsSchema,         result: SessionCancelResultSchema },
  'session/set_mode':       { params: SessionSetModeParamsSchema,        result: SessionSetModeResultSchema },
  'session/resume':         { params: SessionResumeParamsSchema,         result: SessionResumeResultSchema },
  'terminal/spawn':         { params: TerminalSpawnParamsSchema,         result: TerminalSpawnResultSchema },
  'terminal/input':         { params: TerminalInputParamsSchema,         result: TerminalInputResultSchema },
  'terminal/resize':        { params: TerminalResizeParamsSchema,        result: TerminalResizeResultSchema },
  'terminal/close':         { params: TerminalCloseParamsSchema,         result: TerminalCloseResultSchema },
  'terminal/list':          { params: TerminalListParamsSchema,          result: TerminalListResultSchema },
  'copilot/discover':       { params: CopilotDiscoverParamsSchema,       result: CopilotDiscoverResultSchema },
  'copilot/spawn':          { params: CopilotSpawnParamsSchema,          result: CopilotSpawnResultSchema },
  'copilot/write':          { params: CopilotWriteParamsSchema,          result: CopilotWriteResultSchema },
  'copilot/kill':           { params: CopilotKillParamsSchema,           result: CopilotKillResultSchema },
  'copilot/sessions/turns': { params: CopilotSessionsTurnsParamsSchema,  result: CopilotSessionsTurnsResultSchema },
  'copilot/watch/start':    { params: CopilotWatchStartParamsSchema,     result: CopilotWatchStartResultSchema },
  'copilot/watch/stop':     { params: CopilotWatchStopParamsSchema,      result: CopilotWatchStopResultSchema },
  'copilot/pty/list':       { params: CopilotPtyListParamsSchema,        result: CopilotPtyListResultSchema },
  'fs/list':                { params: FsListParamsSchema,                result: FsListResultSchema },
  'initialize':             { params: InitializeParamsSchema,            result: InitializeResultSchema },
} as const;

const notificationSchemas = {
  'session/update':     SessionUpdateNotifParamsSchema,
  'terminal/data':      TerminalDataNotifParamsSchema,
  'terminal/exit':      TerminalExitNotifParamsSchema,
  'copilot/pty/output': CopilotPtyOutputNotifParamsSchema,
  'copilot/pty/exit':   CopilotPtyExitNotifParamsSchema,
  'copilot/delta':      CopilotDeltaNotifParamsSchema,
} as const;

export { methodSchemas, notificationSchemas };

// ─── Derived Types ──────────────────────────────────────────────────────────

export type AcpMethod = keyof typeof methodSchemas;
export type AcpNotification = keyof typeof notificationSchemas;

export type MethodParamsOf<M extends AcpMethod> = z.infer<(typeof methodSchemas)[M]['params']>;
export type MethodResultOf<M extends AcpMethod> = z.infer<(typeof methodSchemas)[M]['result']>;
export type NotificationParamsOf<N extends AcpNotification> = z.infer<(typeof notificationSchemas)[N]>;

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;
export type JsonRpcNotification = z.infer<typeof JsonRpcNotificationSchema>;
export type JsonRpcError = z.infer<typeof JsonRpcErrorSchema>;

export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type Turn = z.infer<typeof TurnSchema>;
export type TerminalInfo = z.infer<typeof TerminalInfoSchema>;
export type PtyInfo = z.infer<typeof PtyInfoSchema>;
export type FsEntry = z.infer<typeof FsEntrySchema>;
export type WireCliSessionInfo = z.infer<typeof WireCliSessionInfoSchema>;

// ─── Validation Helpers ─────────────────────────────────────────────────────

export function validateRequest<M extends AcpMethod>(
  method: M,
  params: unknown,
) {
  return methodSchemas[method].params.safeParse(params);
}

export function validateResponse<M extends AcpMethod>(
  method: M,
  result: unknown,
) {
  return methodSchemas[method].result.safeParse(result);
}

export function validateNotification<N extends AcpNotification>(
  method: N,
  params: unknown,
) {
  return notificationSchemas[method].safeParse(params);
}
