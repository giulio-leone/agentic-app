/**
 * Custom tools registered with `@github/copilot-sdk` via `defineTool()`.
 *
 * When the LLM wants to interact with the user (ask a question, send
 * a notification, request approval, or share a file) it invokes one of
 * these tools.  The bridge forwards the request to the RN app over
 * WebSocket and (where needed) awaits the response.
 */

import { defineTool, type Tool, type ToolInvocation } from '@github/copilot-sdk';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { ToolRequestNotification, SessionId } from '../types.js';
import { SecurityError, TimeoutError } from '../errors.js';

const TAG = '[tools]';

// ── Constants ──────────────────────────────────────────────────────

/** Default timeout for user interaction tools (ms). */
const DEFAULT_TIMEOUT_MS = 120_000;

/** Extended timeout for high-risk approval actions (ms). */
const HIGH_RISK_TIMEOUT_MS = 300_000;

/** Maximum file size for `send_file` (10 MB). */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ── Tool argument types ────────────────────────────────────────────

/** Arguments for the `ask_user` tool. */
interface AskUserArgs {
  question: string;
  choices?: string[];
}

/** Arguments for the `notify` tool. */
interface NotifyArgs {
  message: string;
  level?: 'info' | 'warning' | 'error';
}

/** Arguments for the `send_file` tool. */
interface SendFileArgs {
  path: string;
  description?: string;
}

/** Arguments for the `approve_action` tool. */
interface ApproveActionArgs {
  action: string;
  description: string;
  risk_level: 'low' | 'medium' | 'high';
}

// ── PendingToolCall tracker ────────────────────────────────────────

/**
 * Represents a tool call awaiting a response from the RN client.
 */
export interface PendingToolCall {
  toolCallId: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

// ── ToolManager ────────────────────────────────────────────────────

/**
 * Manages the lifecycle of pending tool calls.
 *
 * Holds a map of in-flight requests so that incoming `tool.response`
 * messages from the RN client can be matched to the correct Promise.
 */
export class ToolManager {
  private readonly pending = new Map<string, PendingToolCall>();

  /** Number of in-flight tool calls. */
  get size(): number {
    return this.pending.size;
  }

  /**
   * Register a new pending tool call.
   * @internal — called by tool handlers, not by consumers.
   */
  register(entry: PendingToolCall): void {
    this.pending.set(entry.toolCallId, entry);
    console.log(`${TAG} registered pending call ${entry.toolCallId}`);
  }

  /**
   * Resolve a pending tool call with the client's result.
   */
  resolveToolCall(toolCallId: string, result: unknown): void {
    const entry = this.pending.get(toolCallId);
    if (!entry) {
      console.warn(`${TAG} no pending call for ${toolCallId} — ignoring`);
      return;
    }
    clearTimeout(entry.timeout);
    this.pending.delete(toolCallId);
    console.log(`${TAG} resolved call ${toolCallId}`);
    entry.resolve(result);
  }

  /**
   * Reject a pending tool call with an error message.
   */
  rejectToolCall(toolCallId: string, error: string): void {
    const entry = this.pending.get(toolCallId);
    if (!entry) {
      console.warn(`${TAG} no pending call for ${toolCallId} — ignoring`);
      return;
    }
    clearTimeout(entry.timeout);
    this.pending.delete(toolCallId);
    console.log(`${TAG} rejected call ${toolCallId}: ${error}`);
    entry.reject(new Error(error));
  }

  /**
   * Cancel all pending tool calls (e.g. on session teardown).
   */
  cancelAll(reason = 'Session closed'): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timeout);
      entry.reject(new Error(reason));
      console.log(`${TAG} cancelled call ${id}: ${reason}`);
    }
    this.pending.clear();
  }
}

// ── SendNotification callback type ─────────────────────────────────

/**
 * Callback used by tool handlers to push a notification to the RN
 * client via WebSocket.
 */
export type SendNotification = (notification: ToolRequestNotification) => void;

// ── Path safety ────────────────────────────────────────────────────

/**
 * Validate that `filePath` is safe to read.
 *
 * - Resolves to an absolute path.
 * - Rejects paths containing `..` traversal.
 * - If `allowedDirs` is provided, ensures the resolved path starts
 *   with at least one of them.
 *
 * @throws {SecurityError} on any violation.
 */
export function isPathSafe(
  filePath: string,
  allowedDirs?: string[],
): string {
  const resolved = path.resolve(filePath);

  if (filePath.includes('..')) {
    throw new SecurityError(`Path traversal detected: ${filePath}`);
  }

  if (allowedDirs && allowedDirs.length > 0) {
    const inAllowed = allowedDirs.some((dir) =>
      resolved.startsWith(path.resolve(dir)),
    );
    if (!inAllowed) {
      throw new SecurityError(
        `Path ${resolved} is outside allowed directories`,
      );
    }
  }

  return resolved;
}

// ── Helper: create a pending promise ───────────────────────────────

function createPendingPromise(
  toolManager: ToolManager,
  toolCallId: string,
  timeoutMs: number,
): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      toolManager.rejectToolCall(toolCallId, 'Timeout');
      reject(
        new TimeoutError(
          `Tool call ${toolCallId} timed out after ${timeoutMs}ms`,
          timeoutMs,
        ),
      );
    }, timeoutMs);

    toolManager.register({ toolCallId, resolve, reject, timeout });
  });
}

// ── Tool 1: ask_user ───────────────────────────────────────────────

/**
 * Build the `ask_user` tool.
 *
 * The LLM invokes this when it needs to ask the user a question,
 * optionally presenting a set of choice buttons.
 */
function buildAskUser(
  sendNotification: SendNotification,
  toolManager: ToolManager,
): Tool {
  return defineTool('ask_user', {
    description:
      'Ask the user a question, optionally presenting choice buttons.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question to ask the user' },
        choices: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional set of predefined answers',
        },
      },
      required: ['question'],
    },
    async handler(unknown, invocation: ToolInvocation) {
      const args = unknown as AskUserArgs;
      const toolCallId = randomUUID();
      const sessionId: SessionId = invocation.sessionId ?? '';

      console.log(`${TAG} ask_user ${toolCallId}: "${args.question}"`);

      sendNotification({
        type: 'tool.request',
        payload: {
          sessionId,
          kind: 'ask_user',
          toolCallId,
          toolName: 'ask_user',
          args: { question: args.question, choices: args.choices },
          message: args.question,
        },
      });

      const result = await createPendingPromise(
        toolManager,
        toolCallId,
        DEFAULT_TIMEOUT_MS,
      );

      return { response: (result as Record<string, unknown>).response ?? result };
    },
  });
}

// ── Tool 2: notify ─────────────────────────────────────────────────

/**
 * Build the `notify` tool.
 *
 * The LLM sends a one-way notification to the user (no response
 * expected).
 */
function buildNotify(
  sendNotification: SendNotification,
): Tool {
  return defineTool('notify', {
    description:
      'Send a notification to the user. No response is expected.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The notification message' },
        level: {
          type: 'string',
          enum: ['info', 'warning', 'error'],
          description: 'Severity level (defaults to info)',
        },
      },
      required: ['message'],
    },
    handler(unknown, invocation: ToolInvocation) {
      const args = unknown as NotifyArgs;
      const toolCallId = randomUUID();
      const sessionId: SessionId = invocation.sessionId ?? '';

      console.log(`${TAG} notify ${toolCallId}: [${args.level ?? 'info'}] "${args.message}"`);

      sendNotification({
        type: 'tool.request',
        payload: {
          sessionId,
          kind: 'ask_user',
          toolCallId,
          toolName: 'notify',
          args: { message: args.message, level: args.level ?? 'info' },
          message: args.message,
        },
      });

      return { sent: true as const };
    },
  });
}

// ── Tool 3: send_file ──────────────────────────────────────────────

/**
 * Build the `send_file` tool.
 *
 * The LLM sends a text file to the user. The file must exist, be
 * readable, and be under the size limit.
 */
function buildSendFile(
  sendNotification: SendNotification,
  allowedDirs?: string[],
): Tool {
  return defineTool('send_file', {
    description:
      'Send a text file to the user. Validates path safety and size limits.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative path to the file' },
        description: {
          type: 'string',
          description: 'Optional human-readable description of the file',
        },
      },
      required: ['path'],
    },
    async handler(unknown, invocation: ToolInvocation) {
      const args = unknown as SendFileArgs;
      const toolCallId = randomUUID();
      const sessionId: SessionId = invocation.sessionId ?? '';

      const safePath = isPathSafe(args.path, allowedDirs);
      console.log(`${TAG} send_file ${toolCallId}: ${safePath}`);

      const stat = await fs.stat(safePath);
      if (!stat.isFile()) {
        throw new SecurityError(`Not a regular file: ${safePath}`);
      }
      if (stat.size > MAX_FILE_SIZE) {
        throw new SecurityError(
          `File exceeds 10 MB limit: ${stat.size} bytes`,
        );
      }

      const content = await fs.readFile(safePath, 'utf-8');

      sendNotification({
        type: 'tool.request',
        payload: {
          sessionId,
          kind: 'ask_user',
          toolCallId,
          toolName: 'send_file',
          args: {
            path: safePath,
            description: args.description,
            content,
            size: stat.size,
          },
          message: args.description ?? `File: ${safePath}`,
        },
      });

      return { sent: true as const, size: stat.size };
    },
  });
}

// ── Tool 4: approve_action ─────────────────────────────────────────

/**
 * Build the `approve_action` tool.
 *
 * The LLM asks the user for explicit approval before performing a
 * potentially dangerous action.  High-risk actions get an extended
 * timeout (5 minutes).
 */
function buildApproveAction(
  sendNotification: SendNotification,
  toolManager: ToolManager,
): Tool {
  return defineTool('approve_action', {
    description:
      'Request user approval before performing a dangerous action.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Short name of the action' },
        description: {
          type: 'string',
          description: 'Detailed description of what will happen',
        },
        risk_level: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Risk level of the action',
        },
      },
      required: ['action', 'description', 'risk_level'],
    },
    async handler(unknown, invocation: ToolInvocation) {
      const args = unknown as ApproveActionArgs;
      const toolCallId = randomUUID();
      const sessionId: SessionId = invocation.sessionId ?? '';
      const timeoutMs =
        args.risk_level === 'high' ? HIGH_RISK_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

      console.log(
        `${TAG} approve_action ${toolCallId}: [${args.risk_level}] "${args.action}"`,
      );

      sendNotification({
        type: 'tool.request',
        payload: {
          sessionId,
          kind: 'approve_action',
          toolCallId,
          toolName: 'approve_action',
          args: {
            action: args.action,
            description: args.description,
            risk_level: args.risk_level,
          },
          message: `${args.action}: ${args.description}`,
        },
      });

      const result = await createPendingPromise(
        toolManager,
        toolCallId,
        timeoutMs,
      );

      const res = result as Record<string, unknown>;
      return {
        approved: Boolean(res.approved),
        ...(res.reason != null ? { reason: String(res.reason) } : {}),
      };
    },
  });
}

// ── Factory ────────────────────────────────────────────────────────

/**
 * Options for {@link createAllTools}.
 */
export interface CreateToolsOptions {
  /** Directories the `send_file` tool is allowed to read from. */
  allowedDirs?: string[];
}

/**
 * Create all bridge tools and return them as an array ready for
 * SDK registration.
 *
 * @param sendNotification — callback that pushes a {@link ToolRequestNotification} to the RN client.
 * @param toolManager      — shared {@link ToolManager} instance for pending-call tracking.
 * @param options          — optional configuration.
 */
export function createAllTools(
  sendNotification: SendNotification,
  toolManager: ToolManager,
  options: CreateToolsOptions = {},
): Tool[] {
  console.log(`${TAG} registering all custom tools`);

  return [
    buildAskUser(sendNotification, toolManager),
    buildNotify(sendNotification),
    buildSendFile(sendNotification, options.allowedDirs),
    buildApproveAction(sendNotification, toolManager),
  ];
}
