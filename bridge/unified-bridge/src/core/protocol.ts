/**
 * ACP Protocol Handler — multi-provider routing.
 *
 * Routes ACP methods to the correct provider based on session ID prefix:
 *   - 'copilot-xxx' → CopilotProvider
 *   - 'codex-xxx'   → CodexProvider
 *
 * Initialize aggregates all providers. Models are tagged with provider origin.
 */

import type { Socket } from 'net';
import type {
  JSONRPCRequest,
  AgentProfile,
  ModelInfo,
  BridgeConfig,
} from './types.js';
import type { ProviderRegistry } from './provider-registry.js';
import { createStreamCallbacks } from './event-mapper.js';
import type { CopilotProvider } from '../providers/copilot/adapter.js';
import type { TerminalManager } from '../terminal/manager.js';

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

// ── Connection state ──

interface ConnectionState {
  activeSessionId: string | null;
}

// ── Handler ──

export function createProtocolHandler(
  registry: ProviderRegistry,
  config: BridgeConfig,
  socket: Socket,
  terminalManager?: TerminalManager,
) {
  const state: ConnectionState = {
    activeSessionId: null,
  };

  async function handle(msg: JSONRPCRequest): Promise<void> {
    const { method, id, params } = msg;

    try {
      switch (method) {
        case 'initialize':
          await handleInitialize(id);
          break;
        case 'models/list':
          await handleModelsList(id);
          break;
        case 'session/new':
          await handleSessionNew(id, params);
          break;
        case 'session/list':
          await handleSessionList(id);
          break;
        case 'session/prompt':
          await handleSessionPrompt(id, params);
          break;
        case 'session/cancel':
          await handleSessionCancel(id, params);
          break;
        case 'session/destroy':
          await handleSessionDestroy(id, params);
          break;
        case 'session/set_mode':
          sendResponse(socket, id, { success: true });
          break;
        case 'tool/ask_user_response':
          handleAskUserResponse(params);
          if (id !== undefined) sendResponse(socket, id, { success: true });
          break;

        // ── Terminal methods ──
        case 'terminal/spawn':
          handleTerminalSpawn(id, params ?? {});
          break;
        case 'terminal/list':
          handleTerminalList(id);
          break;
        case 'terminal/connect_tmux':
          handleTerminalConnectTmux(id, params ?? {});
          break;
        case 'terminal/input':
          handleTerminalInput(id, params ?? {});
          break;
        case 'terminal/resize':
          handleTerminalResize(id, params ?? {});
          break;
        case 'terminal/close':
          handleTerminalClose(id, params ?? {});
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

  async function handleInitialize(id: string | number): Promise<void> {
    // Aggregate models from all providers
    const allModels: ModelInfo[] = [];
    const providerNames: Array<{ id: string; name: string }> = [];

    for (const providerId of registry.list()) {
      const info = registry.getInfo(providerId);
      if (info) {
        allModels.push(...info.models);
        providerNames.push({ id: info.id, name: info.name });
      }
    }

    const profile: AgentProfile = {
      name: 'Agentic Unified Bridge',
      version: '1.0.0',
      capabilities: {
        promptCapabilities: { image: false },
        modelListing: true,
        multiSession: true,
        cancel: true,
        agentEvents: true,
      },
      modes: [],
      models: allModels,
      providers: providerNames,
    };

    sendResponse(socket, id, { agentInfo: profile });
  }

  async function handleModelsList(id: string | number): Promise<void> {
    const allModels: ModelInfo[] = [];
    for (const providerId of registry.list()) {
      const provider = registry.get(providerId);
      if (provider) {
        const models = await provider.listModels();
        allModels.push(...models);
      }
    }
    sendResponse(socket, id, { models: allModels });
  }

  async function handleSessionNew(
    id: string | number,
    params?: Record<string, unknown>
  ): Promise<void> {
    // Determine which provider to use
    const requestedProvider = params?.provider as string | undefined;
    const requestedModel = params?.model as string | undefined;

    let provider = requestedProvider
      ? registry.get(requestedProvider)
      : undefined;

    // Auto-detect provider from model name if not explicitly specified
    if (!provider && requestedModel) {
      provider = detectProviderFromModel(requestedModel);
    }

    // Fallback to first available provider
    if (!provider) {
      const firstId = registry.list()[0];
      if (firstId) provider = registry.get(firstId);
    }

    if (!provider) {
      sendError(socket, id, -32602, 'No providers available');
      return;
    }

    // CopilotProvider needs socket reference for tools
    const isCopilot = provider.id === 'copilot';
    const session = isCopilot
      ? await (provider as CopilotProvider).createSession(
          { model: requestedModel, cwd: params?.cwd as string },
          socket
        )
      : await provider.createSession({
          model: requestedModel,
          cwd: params?.cwd as string,
        });

    state.activeSessionId = session.id;
    sendResponse(socket, id, { sessionId: session.id, provider: session.provider });
  }

  async function handleSessionList(id: string | number): Promise<void> {
    const allSessions = [];
    for (const providerId of registry.list()) {
      const provider = registry.get(providerId);
      if (provider) {
        const sessions = await provider.listSessions();
        allSessions.push(...sessions);
      }
    }
    sendResponse(socket, id, { sessions: allSessions });
  }

  async function handleSessionPrompt(
    id: string | number,
    params?: Record<string, unknown>
  ): Promise<void> {
    const sessionId = (params?.sessionId as string) || state.activeSessionId;
    if (!sessionId) {
      sendError(socket, id, -32602, 'No active session. Call session/new first.');
      return;
    }

    const provider = registry.resolveSession(sessionId);
    if (!provider) {
      sendError(socket, id, -32602, `No provider found for session: ${sessionId}`);
      return;
    }

    const prompt = (params?.prompt as string) ?? (params?.message as string) ?? '';
    if (!prompt) {
      sendError(socket, id, -32602, 'Missing prompt parameter');
      return;
    }

    // Ack immediately
    sendResponse(socket, id, { status: 'streaming' });

    // Stream via EventMapper callbacks
    const callbacks = createStreamCallbacks(socket);
    await provider.prompt(sessionId, prompt, callbacks);
  }

  async function handleSessionCancel(
    id: string | number,
    params?: Record<string, unknown>
  ): Promise<void> {
    const sessionId = (params?.sessionId as string) || state.activeSessionId;
    if (!sessionId) {
      sendResponse(socket, id, { success: false });
      return;
    }

    const provider = registry.resolveSession(sessionId);
    if (!provider) {
      sendResponse(socket, id, { success: false });
      return;
    }

    const success = await provider.cancel(sessionId);
    sendResponse(socket, id, { success });
  }

  async function handleSessionDestroy(
    id: string | number,
    params?: Record<string, unknown>
  ): Promise<void> {
    const sessionId = (params?.sessionId as string) || state.activeSessionId;
    if (!sessionId) {
      sendResponse(socket, id, { success: false });
      return;
    }

    const provider = registry.resolveSession(sessionId);
    if (!provider) {
      sendResponse(socket, id, { success: false });
      return;
    }

    const success = await provider.destroySession(sessionId);
    if (state.activeSessionId === sessionId) {
      state.activeSessionId = null;
    }
    sendResponse(socket, id, { success });
  }

  function handleAskUserResponse(params?: Record<string, unknown>): void {
    const answer = params?.answer as string;
    if (!answer) return;

    // Route to Copilot provider (only one that supports ask_user tools)
    const copilot = registry.get('copilot') as CopilotProvider | undefined;
    if (copilot) {
      copilot.resolveAskUser(socket, answer);
    }
  }

  /** Detect provider from model name heuristics. */
  function detectProviderFromModel(model: string): ReturnType<typeof registry.get> {
    const lower = model.toLowerCase();
    if (lower.includes('codex') || lower.includes('o4') || lower.includes('o3')) {
      return registry.get('codex');
    }
    if (lower.includes('gpt') || lower.includes('claude') || lower.includes('gemini')) {
      return registry.get('copilot');
    }
    return undefined;
  }

  // ── Cleanup ──

  async function cleanup(): Promise<void> {
    const copilot = registry.get('copilot') as CopilotProvider | undefined;
    copilot?.cleanupSocket(socket);
    state.activeSessionId = null;
  }

  // ── Terminal handlers ──

  function handleTerminalSpawn(id: string | number, params: Record<string, unknown>): void {
    if (!terminalManager) return sendError(socket, id, -32000, 'Terminal not available');
    const shell = params?.shell as string | undefined;
    const cwd = params?.cwd as string | undefined;
    const cols = (params?.cols as number) || 80;
    const rows = (params?.rows as number) || 24;
    const info = terminalManager.spawn(shell, cwd, cols, rows);
    wireTerminal(info.id);
    sendResponse(socket, id, info);
  }

  function handleTerminalList(id: string | number): void {
    if (!terminalManager) return sendError(socket, id, -32000, 'Terminal not available');
    const active = terminalManager.listActive();
    const tmuxSessions = terminalManager.listTmuxSessions();
    sendResponse(socket, id, { active, tmuxSessions });
  }

  function handleTerminalConnectTmux(id: string | number, params: Record<string, unknown>): void {
    if (!terminalManager) return sendError(socket, id, -32000, 'Terminal not available');
    const sessionName = params?.session as string;
    if (!sessionName) return sendError(socket, id, -32602, 'Missing session name');
    const cols = (params?.cols as number) || 80;
    const rows = (params?.rows as number) || 24;
    const info = terminalManager.connectTmux(sessionName, cols, rows);
    wireTerminal(info.id);
    sendResponse(socket, id, info);
  }

  function handleTerminalInput(id: string | number, params: Record<string, unknown>): void {
    if (!terminalManager) return sendError(socket, id, -32000, 'Terminal not available');
    const termId = params?.id as string;
    const data = params?.data as string;
    if (!termId || data === undefined) return sendError(socket, id, -32602, 'Missing id or data');
    const ok = terminalManager.write(termId, data);
    sendResponse(socket, id, { success: ok });
  }

  function handleTerminalResize(id: string | number, params: Record<string, unknown>): void {
    if (!terminalManager) return sendError(socket, id, -32000, 'Terminal not available');
    const termId = params?.id as string;
    const cols = params?.cols as number;
    const rows = params?.rows as number;
    if (!termId || !cols || !rows) return sendError(socket, id, -32602, 'Missing id, cols, or rows');
    const ok = terminalManager.resize(termId, cols, rows);
    sendResponse(socket, id, { success: ok });
  }

  function handleTerminalClose(id: string | number, params: Record<string, unknown>): void {
    if (!terminalManager) return sendError(socket, id, -32000, 'Terminal not available');
    const termId = params?.id as string;
    if (!termId) return sendError(socket, id, -32602, 'Missing id');
    const ok = terminalManager.close(termId);
    sendResponse(socket, id, { success: ok });
  }

  /** Wire PTY data/exit events to ACP notifications on this socket. */
  function wireTerminal(termId: string): void {
    if (!terminalManager) return;
    const onData = (id: string, data: string) => {
      if (id !== termId) return;
      send(socket, { method: 'terminal/data', params: { id: termId, data } });
    };
    const onExit = (id: string, code: number) => {
      if (id !== termId) return;
      send(socket, { method: 'terminal/exit', params: { id: termId, code } });
      terminalManager!.off('data', onData);
      terminalManager!.off('exit', onExit);
    };
    terminalManager.on('data', onData);
    terminalManager.on('exit', onExit);
  }

  return { handle, cleanup };
}
