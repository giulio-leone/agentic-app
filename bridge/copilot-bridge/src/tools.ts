/**
 * SDK Tools — filesystem operations + ask_user forwarding.
 *
 * These tools are passed to CopilotClient.createSession() so that the
 * Copilot CLI agent can interact with the local filesystem and request
 * user input (forwarded to the mobile app via ACP notifications).
 */

import { defineTool, type Tool, type ZodSchema } from '@github/copilot-sdk';
import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { Socket } from 'net';
import type { JSONRPCNotification } from './types.js';

// ── Helpers ──

function send(socket: Socket, msg: JSONRPCNotification): void {
  if (!socket.writable) return;
  socket.write(JSON.stringify(msg) + '\n');
}

/**
 * Validates that a path stays within the allowed working directory.
 */
function isPathSafe(filePath: string, cwd: string): boolean {
  const resolved = path.resolve(cwd, filePath);
  return resolved.startsWith(path.resolve(cwd));
}

// ── Tool factories ──

export function createReadFileTool(cwd: string): Tool {
  return defineTool('read_file', {
    description: 'Read the contents of a file by path (relative to working directory).',
    parameters: z.object({
      path: z.string().describe('Relative file path'),
    }) as unknown as ZodSchema<{ path: string }>,
    handler: async ({ path: filePath }: { path: string }) => {
      if (!isPathSafe(filePath, cwd)) {
        return { error: 'Path traversal not allowed' };
      }
      const resolved = path.resolve(cwd, filePath);
      try {
        const content = await fs.readFile(resolved, 'utf8');
        return { content, path: filePath, size: content.length };
      } catch (err) {
        return { error: `Cannot read: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  }) as Tool;
}

export function createWriteFileTool(cwd: string): Tool {
  return defineTool('write_file', {
    description: 'Write content to a file (creates parent directories if needed).',
    parameters: z.object({
      path: z.string().describe('Relative file path'),
      content: z.string().describe('File content to write'),
    }) as unknown as ZodSchema<{ path: string; content: string }>,
    handler: async ({ path: filePath, content }: { path: string; content: string }) => {
      if (!isPathSafe(filePath, cwd)) {
        return { error: 'Path traversal not allowed' };
      }
      const resolved = path.resolve(cwd, filePath);
      try {
        await fs.mkdir(path.dirname(resolved), { recursive: true });
        await fs.writeFile(resolved, content, 'utf8');
        return { success: true, path: filePath, bytesWritten: content.length };
      } catch (err) {
        return { error: `Cannot write: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  }) as Tool;
}

export function createListFilesTool(cwd: string): Tool {
  return defineTool('list_files', {
    description: 'List files and directories at a path (relative to working directory).',
    parameters: z.object({
      path: z.string().optional().describe('Relative directory path (default: .)'),
    }) as unknown as ZodSchema<{ path?: string }>,
    handler: async ({ path: dirPath }: { path?: string }) => {
      const target = dirPath || '.';
      if (!isPathSafe(target, cwd)) {
        return { error: 'Path traversal not allowed' };
      }
      const resolved = path.resolve(cwd, target);
      try {
        const entries = await fs.readdir(resolved, { withFileTypes: true });
        const items = entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file',
        }));
        return { path: target, entries: items };
      } catch (err) {
        return { error: `Cannot list: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  }) as Tool;
}

/**
 * Creates an ask_user tool that forwards the question to the mobile app
 * via an ACP notification and waits for a response.
 *
 * The mobile app receives a `tool/ask_user` notification and replies
 * with a `tool/ask_user_response` request.
 */
export function createAskUserTool(socket: Socket): {
  tool: Tool;
  resolveResponse: (answer: string) => void;
  hasPending: () => boolean;
} {
  let pendingResolve: ((value: string) => void) | null = null;
  const TIMEOUT_MS = 120_000;

  const tool: Tool = defineTool('ask_user', {
    description: 'Ask the user a question and wait for their response.',
    parameters: z.object({
      question: z.string().describe('The question to ask'),
      options: z.array(z.string()).optional().describe('Optional choices'),
    }) as unknown as ZodSchema<{ question: string; options?: string[] }>,
    handler: async ({ question, options }: { question: string; options?: string[] }) => {
      // Forward to mobile app
      send(socket, {
        jsonrpc: '2.0',
        method: 'tool/ask_user',
        params: { question, options },
      });

      // Wait for response from app
      const answer = await new Promise<string>((resolve, reject) => {
        pendingResolve = resolve;
        const timeout = setTimeout(() => {
          pendingResolve = null;
          reject(new Error('ask_user timeout: no response from app'));
        }, TIMEOUT_MS);
        // Clean up on resolve
        const orig = resolve;
        pendingResolve = (val: string) => {
          clearTimeout(timeout);
          orig(val);
        };
      });

      return { userResponse: answer };
    },
  }) as unknown as Tool;

  return {
    tool,
    resolveResponse: (answer: string) => {
      if (pendingResolve) {
        pendingResolve(answer);
        pendingResolve = null;
      }
    },
    hasPending: () => pendingResolve !== null,
  };
}

/**
 * Creates all tools for a connection.
 */
export function createAllTools(
  cwd: string,
  socket: Socket
): { tools: Tool[]; askUser: ReturnType<typeof createAskUserTool> } {
  const askUser = createAskUserTool(socket);
  return {
    tools: [
      createReadFileTool(cwd),
      createWriteFileTool(cwd),
      createListFilesTool(cwd),
      askUser.tool,
    ],
    askUser,
  };
}
