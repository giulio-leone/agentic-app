/**
 * CopilotProvider — ProviderAdapter implementation for GitHub Copilot SDK.
 *
 * Wraps ResilientCopilotClient + CopilotSessionManager + Tools.
 * Maps Copilot SDK events (assistant.message_delta) to StreamCallbacks.
 */

import type { Socket } from 'net';
import type {
  ProviderAdapter,
  ProviderInfo,
  ModelInfo,
  SessionInfo,
  SessionSummary,
  CreateSessionOpts,
  StreamCallbacks,
  ProviderConfig,
} from '../../core/types.js';
import { ResilientCopilotClient } from './client.js';
import { CopilotSessionManager } from './sessions.js';
import { createAllTools, createAskUserTool } from './tools.js';

export class CopilotProvider implements ProviderAdapter {
  readonly id = 'copilot';
  readonly name = 'GitHub Copilot';

  private client: ResilientCopilotClient;
  private sessions = new CopilotSessionManager();
  private defaultModel: string;
  private workingDirectory: string;
  private cachedModels: ModelInfo[] = [];

  /** Per-socket ask_user instances for tool/ask_user_response routing */
  private askUserMap = new Map<Socket, ReturnType<typeof createAskUserTool>>();

  constructor(config: ProviderConfig, workingDirectory: string) {
    this.defaultModel = config.model || 'gpt-4.1';
    this.workingDirectory = workingDirectory;
    this.client = new ResilientCopilotClient({ cliPath: config.cliPath });
  }

  async initialize(): Promise<ProviderInfo> {
    await this.client.ensureClient();
    const modelIds = await this.client.listModels();
    this.cachedModels = modelIds.map((id) => ({ id, name: id, provider: 'copilot' }));

    return {
      id: this.id,
      name: this.name,
      version: '2.0.0',
      models: this.cachedModels,
      capabilities: {
        streaming: true,
        cancel: true,
        multiSession: true,
        agentEvents: false,
      },
    };
  }

  async shutdown(): Promise<void> {
    await this.sessions.destroyAll();
    await this.client.stop();
    this.askUserMap.clear();
  }

  async listModels(): Promise<ModelInfo[]> {
    if (this.cachedModels.length === 0) {
      const ids = await this.client.listModels();
      this.cachedModels = ids.map((id) => ({ id, name: id, provider: 'copilot' }));
    }
    return this.cachedModels;
  }

  async createSession(opts: CreateSessionOpts, socket?: Socket): Promise<SessionInfo> {
    const c = await this.client.ensureClient();
    const model = opts.model || this.defaultModel;
    const cwd = opts.cwd || this.workingDirectory;

    let tools: import('@github/copilot-sdk').Tool[];
    if (socket) {
      const { tools: t, askUser } = createAllTools(cwd, socket);
      tools = t;
      this.askUserMap.set(socket, askUser);
    } else {
      tools = [];
    }

    const { sessionId } = await this.sessions.create(c, model, tools, cwd);

    return {
      id: sessionId,
      provider: this.id,
      model,
      cwd,
    };
  }

  async listSessions(): Promise<SessionSummary[]> {
    return this.sessions.list().map((s) => ({
      ...s,
      provider: this.id,
    }));
  }

  async destroySession(sessionId: string): Promise<boolean> {
    return this.sessions.destroy(sessionId);
  }

  async prompt(
    sessionId: string,
    text: string,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      callbacks.onError(`Session not found: ${sessionId}`);
      return;
    }

    callbacks.onMessageStart();

    try {
      const deltaHandler = (event: { data: { deltaContent: string } }) => {
        callbacks.onMessageChunk(event.data.deltaContent);
      };
      entry.session.on('assistant.message_delta', deltaHandler);

      await entry.session.sendAndWait({ prompt: text });

      // Clean up listener
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entry.session as any).removeListener?.('assistant.message_delta', deltaHandler);
      } catch { /* streaming done */ }
    } catch (err) {
      callbacks.onError(err instanceof Error ? err.message : String(err));
    }

    callbacks.onMessageEnd();
  }

  async cancel(sessionId: string): Promise<boolean> {
    const entry = this.sessions.get(sessionId);
    if (!entry) return false;
    try {
      await entry.session.abort();
      return true;
    } catch {
      return false;
    }
  }

  /** Resolve a pending ask_user response for a given socket. */
  resolveAskUser(socket: Socket, answer: string): void {
    const askUser = this.askUserMap.get(socket);
    if (askUser) {
      askUser.resolveResponse(answer);
    }
  }

  /** Clean up resources for a disconnecting socket. */
  cleanupSocket(socket: Socket): void {
    this.askUserMap.delete(socket);
  }
}
