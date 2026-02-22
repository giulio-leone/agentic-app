/**
 * ACP Protocol Handler — processes JSON-RPC messages from the mobile app.
 *
 * Maps ACP methods to CopilotClient/SessionManager operations:
 *   initialize       → agent profile + capabilities
 *   models/list      → client.listModels()
 *   session/new      → sessionManager.create()
 *   session/list     → sessionManager.list()
 *   session/prompt   → session.sendAndWait() with streaming
 *   session/cancel   → session.abort()
 *   session/destroy  → sessionManager.destroy()
 *   tool/ask_user_response → resolve pending ask_user
 */

import type { Socket } from 'net';
import type { JSONRPCRequest, JSONRPCNotification, AgentProfile, BridgeConfig } from './types.js';
import type { ResilientCopilotClient } from './client.js';
import type { SessionManager } from './session-manager.js';
import type { createAskUserTool, createAllTools } from './tools.js';

// ── Helpers ──

function send(socket: Socket, msg: Record<string, unknown>): void {
  if (!socket.writable) return;
  socket.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
}

function sendResponse(socket: Socket, id: string | number, result: unknown): void {
  send(socket, { id, result });
}

function sendError(socket: Socket, id: string | number, code: number, message: string): void {
  send(socket, { id, error: { code, message } });
}

function sendNotification(socket: Socket, method: string, params: Record<string, unknown>): void {
  send(socket, { method, params });
}

// ── Connection state ──

interface ConnectionState {
  activeSessionId: string | null;
  askUser: ReturnType<typeof createAskUserTool> | null;
}

// ── Handler ──

export function createProtocolHandler(
  client: ResilientCopilotClient,
  sessions: SessionManager,
  config: BridgeConfig,
  socket: Socket,
  toolsFactory: typeof createAllTools
) {
  const state: ConnectionState = {
    activeSessionId: null,
    askUser: null,
  };

  async function handle(msg: JSONRPCRequest): Promise<void> {
    const { method, id, params } = msg;

    try {
      switch (method) {
        case 'initialize':
          await handleInitialize(socket, id);
          break;

        case 'models/list':
          await handleModelsList(socket, id);
          break;

        case 'session/new':
          await handleSessionNew(socket, id, params);
          break;

        case 'session/list':
          handleSessionList(socket, id);
          break;

        case 'session/prompt':
          await handleSessionPrompt(socket, id, params);
          break;

        case 'session/cancel':
          await handleSessionCancel(socket, id, params);
          break;

        case 'session/destroy':
          await handleSessionDestroy(socket, id, params);
          break;

        case 'session/set_mode':
          sendResponse(socket, id, { success: true });
          break;

        case 'tool/ask_user_response':
          handleAskUserResponse(params);
          if (id !== undefined) sendResponse(socket, id, { success: true });
          break;

        default:
          sendError(socket, id, -32601, `Method not found: ${method}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[protocol] Error in ${method}:`, message);
      if (id !== undefined) sendError(socket, id, -32000, message);
    }
  }

  // ── Method handlers ──

  async function handleInitialize(socket: Socket, id: string | number): Promise<void> {
    const models = await client.listModels();
    const profile: AgentProfile = {
      name: `Copilot SDK (${config.model})`,
      version: '2.0.0',
      capabilities: {
        promptCapabilities: { image: false },
        modelListing: true,
        multiSession: true,
        cancel: true,
      },
      modes: [],
      models: models.map((m) => ({ id: m, name: m })),
    };
    sendResponse(socket, id, { agentInfo: profile });
  }

  async function handleModelsList(socket: Socket, id: string | number): Promise<void> {
    const models = await client.listModels();
    sendResponse(socket, id, { models: models.map((m) => ({ id: m, name: m })) });
  }

  async function handleSessionNew(
    socket: Socket,
    id: string | number,
    params?: Record<string, unknown>
  ): Promise<void> {
    const c = await client.ensureClient();
    const model = (params?.model as string) || config.model;

    // Create tools for this connection
    const { tools, askUser } = toolsFactory(config.workingDirectory, socket);
    state.askUser = askUser;

    const { sessionId } = await sessions.create(c, model, tools, config.workingDirectory);
    state.activeSessionId = sessionId;

    sendResponse(socket, id, { sessionId });
  }

  function handleSessionList(socket: Socket, id: string | number): void {
    sendResponse(socket, id, { sessions: sessions.list() });
  }

  async function handleSessionPrompt(
    socket: Socket,
    id: string | number,
    params?: Record<string, unknown>
  ): Promise<void> {
    const sessionId = (params?.sessionId as string) || state.activeSessionId;
    if (!sessionId) {
      sendError(socket, id, -32602, 'No active session. Call session/new first.');
      return;
    }

    const entry = sessions.get(sessionId);
    if (!entry) {
      sendError(socket, id, -32602, `Session not found: ${sessionId}`);
      return;
    }

    const prompt = (params?.prompt as string) ?? (params?.message as string) ?? '';
    if (!prompt) {
      sendError(socket, id, -32602, 'Missing prompt parameter');
      return;
    }

    // Ack immediately
    sendResponse(socket, id, { status: 'streaming' });

    // Stream start
    sendNotification(socket, 'session/update', {
      update: { sessionUpdate: 'agent_message_start', content: {} },
    });

    try {
      // Listen for delta events
      const deltaHandler = (event: { data: { deltaContent: string } }) => {
        sendNotification(socket, 'session/update', {
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: event.data.deltaContent },
          },
        });
      };
      entry.session.on('assistant.message_delta', deltaHandler);

      await entry.session.sendAndWait({ prompt });

      // Clean up listener (removeListener may not exist — use try/catch)
      try {
        (entry.session as any).removeListener?.('assistant.message_delta', deltaHandler);
      } catch { /* streaming done, listener no longer needed */ }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendNotification(socket, 'session/update', {
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: `\n\n⚠️ Error: ${message}` },
        },
      });
    }

    // Stream end
    sendNotification(socket, 'session/update', {
      update: { sessionUpdate: 'agent_message_end', content: {} },
    });
  }

  async function handleSessionCancel(
    socket: Socket,
    id: string | number,
    params?: Record<string, unknown>
  ): Promise<void> {
    const sessionId = (params?.sessionId as string) || state.activeSessionId;
    if (!sessionId) {
      sendResponse(socket, id, { success: false });
      return;
    }

    const entry = sessions.get(sessionId);
    if (entry) {
      try {
        await entry.session.abort();
        sendResponse(socket, id, { success: true });
      } catch {
        sendResponse(socket, id, { success: false });
      }
    } else {
      sendResponse(socket, id, { success: false });
    }
  }

  async function handleSessionDestroy(
    socket: Socket,
    id: string | number,
    params?: Record<string, unknown>
  ): Promise<void> {
    const sessionId = (params?.sessionId as string) || state.activeSessionId;
    if (!sessionId) {
      sendResponse(socket, id, { success: false });
      return;
    }

    const success = await sessions.destroy(sessionId);
    if (state.activeSessionId === sessionId) {
      state.activeSessionId = null;
    }
    sendResponse(socket, id, { success });
  }

  function handleAskUserResponse(params?: Record<string, unknown>): void {
    const answer = params?.answer as string;
    if (answer && state.askUser) {
      state.askUser.resolveResponse(answer);
    }
  }

  // ── Cleanup ──

  async function cleanup(): Promise<void> {
    await sessions.destroyAll();
    state.activeSessionId = null;
    state.askUser = null;
  }

  return { handle, cleanup };
}
