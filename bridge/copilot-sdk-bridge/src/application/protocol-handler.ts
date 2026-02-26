/**
 * Application-layer protocol handler — orchestrates domain and
 * infrastructure layers in response to client messages.
 *
 * Every incoming {@link ClientMessage} is dispatched through
 * {@link ProtocolHandler.handleMessage}, which delegates to the
 * appropriate domain service and sends a typed response back over
 * the WebSocket.
 */

import type { ResilientCopilotClient } from '../domain/copilot-client.js';
import type { SessionManager } from '../domain/session-manager.js';
import { ToolManager, createAllTools } from '../domain/tools.js';
import type { SendNotification } from '../domain/tools.js';
import type { McpRegistry } from '../domain/mcp-registry.js';
import type { BridgeWebSocketServer } from '../infrastructure/ws-server.js';
import type { ConnectionAuthenticator, RateLimiter } from '../infrastructure/security.js';
import type {
  ClientMessage,
  BridgeMessage,
  InitializeResponse,
  ModelsListResponse,
  SessionNewResponse,
  SessionListResponse,
  StreamingAckResponse,
  StreamEventNotification,
  ErrorResponse,
  McpListResponse,
  AuthStatusNotification,
  SessionCancelResponse,
} from '../types.js';
import { BridgeError, errorMessage } from '../errors.js';

// ── Constants ──

const TAG = '[protocol]';
const BRIDGE_VERSION = '1.0.0';
const CAPABILITIES = ['streaming', 'tools', 'mcp', 'sessions'];

// ── ProtocolHandler ──

/**
 * Orchestrator that handles all client messages and coordinates the
 * domain + infrastructure layers.
 *
 * The WebSocket server reference is set after construction via
 * {@link setWebSocketServer} to break the circular dependency
 * (the WS server needs handler callbacks at construction time).
 */
export class ProtocolHandler {
  private wss: BridgeWebSocketServer | null = null;
  private readonly toolManagers = new Map<string, ToolManager>();
  private readonly authenticatedClients = new Set<string>();

  constructor(
    private readonly client: ResilientCopilotClient,
    private readonly sessions: SessionManager,
    private readonly mcpRegistry: McpRegistry,
    private readonly authenticator: ConnectionAuthenticator,
    private readonly rateLimiter: RateLimiter,
  ) {}

  // ── Late binding ──

  /**
   * Bind the WebSocket server after construction.
   * Must be called before the first message is handled.
   */
  setWebSocketServer(wss: BridgeWebSocketServer): void {
    this.wss = wss;
  }

  // ── Message dispatch ──

  /**
   * Route a validated client message to the appropriate handler.
   * Wraps every handler in a try/catch that sends an {@link ErrorResponse}.
   */
  async handleMessage(clientId: string, message: ClientMessage): Promise<void> {
    // Auth guard: reject all messages from unauthenticated clients
    if (!this.authenticatedClients.has(clientId)) {
      this.sendError(clientId, message.id, 'UNAUTHORIZED', 'Client not authenticated');
      return;
    }

    if (!this.rateLimiter.checkLimit(clientId)) {
      this.sendError(clientId, message.id, 'RATE_LIMITED', 'Too many requests');
      return;
    }

    try {
      switch (message.type) {
        case 'initialize':
          return this.handleInitialize(clientId, message);
        case 'models.list':
          return await this.handleModelsList(clientId, message);
        case 'session.new':
          return await this.handleSessionNew(clientId, message);
        case 'session.list':
          return this.handleSessionList(clientId, message);
        case 'session.prompt':
          return await this.handleSessionPrompt(clientId, message);
        case 'session.cancel':
          return await this.handleSessionCancel(clientId, message);
        case 'session.destroy':
          return await this.handleSessionDestroy(clientId, message);
        case 'tool.response':
          return this.handleToolResponse(clientId, message);
        case 'mcp.list':
          return this.handleMcpList(clientId, message);
        case 'mcp.toggle':
          return await this.handleMcpToggle(clientId, message);
        case 'mcp.add':
          return await this.handleMcpAdd(clientId, message);
        case 'mcp.remove':
          return await this.handleMcpRemove(clientId, message);
        default:
          this.sendError(
            clientId,
            (message as { id?: string }).id,
            'UNKNOWN_TYPE',
            `Unknown message type: ${(message as { type: string }).type}`,
          );
      }
    } catch (err: unknown) {
      const code = err instanceof BridgeError ? err.code : 'INTERNAL_ERROR';
      this.sendError(clientId, message.id, code, errorMessage(err));
    }
  }

  // ── Connection lifecycle ──

  /**
   * Called when a new WebSocket client connects.
   * Logs the event and sends the current auth status.
   */
  handleConnect(clientId: string): void {
    this.authenticatedClients.add(clientId);
    console.log(`${TAG} client connected: ${clientId}`);
    const authenticated = this.authenticator.isAuthenticated(clientId);
    const notification: AuthStatusNotification = {
      type: 'auth.status',
      payload: { authenticated },
    };
    this.send(clientId, notification);
  }

  /**
   * Called when a WebSocket client disconnects.
   * Cleans up tool managers, auth state, and rate-limiter buckets.
   */
  handleDisconnect(clientId: string): void {
    console.log(`${TAG} client disconnected: ${clientId}`);
    this.authenticatedClients.delete(clientId);

    const tm = this.toolManagers.get(clientId);
    if (tm) {
      tm.cancelAll('Client disconnected');
      this.toolManagers.delete(clientId);
    }

    this.authenticator.removeClient(clientId);
    this.rateLimiter.reset(clientId);
  }

  // ── 1. initialize ──

  /** Return bridge version, capabilities, and auth status. */
  private handleInitialize(
    clientId: string,
    message: Extract<ClientMessage, { type: 'initialize' }>,
  ): void {
    const authenticated = this.authenticator.isAuthenticated(clientId);
    const response: InitializeResponse = {
      type: 'initialize.result',
      id: message.id,
      payload: {
        bridgeVersion: BRIDGE_VERSION,
        capabilities: CAPABILITIES,
        authenticated,
      },
    };
    console.log(
      `${TAG} initialize — client=${clientId}, v=${message.payload.clientVersion}, auth=${authenticated}`,
    );
    this.send(clientId, response);
  }

  // ── 2. models.list ──

  /** List available Copilot models. */
  private async handleModelsList(
    clientId: string,
    message: Extract<ClientMessage, { type: 'models.list' }>,
  ): Promise<void> {
    const models = await this.client.listModels();
    const response: ModelsListResponse = {
      type: 'models.list.result',
      id: message.id,
      payload: { models },
    };
    this.send(clientId, response);
  }

  // ── 3. session.new ──

  /** Create a new chat session with custom tools and MCP servers. */
  private async handleSessionNew(
    clientId: string,
    message: Extract<ClientMessage, { type: 'session.new' }>,
  ): Promise<void> {
    let tm = this.toolManagers.get(clientId);
    if (!tm) {
      tm = new ToolManager();
      this.toolManagers.set(clientId, tm);
    }

    const sendNotification: SendNotification = (notification) => {
      this.send(clientId, notification);
    };

    const tools = createAllTools(sendNotification, tm, {
      allowedDirs: [process.cwd()],
    });
    const mcpServers = this.mcpRegistry.getEnabledServers();
    const sdkClient = this.client.getClient();

    const { sessionId, model } = await this.sessions.createSession({
      client: sdkClient,
      model: message.payload.model,
      systemMessage: message.payload.systemPrompt,
      tools,
      mcpServers,
    });

    const response: SessionNewResponse = {
      type: 'session.new.result',
      id: message.id,
      payload: { sessionId, model },
    };
    console.log(`${TAG} session.new — id=${sessionId}, model=${model}`);
    this.send(clientId, response);
  }

  // ── 4. session.list ──

  /** Return all active sessions. */
  private handleSessionList(
    clientId: string,
    message: Extract<ClientMessage, { type: 'session.list' }>,
  ): void {
    const sessions = this.sessions.listSessions().map((s) => ({
      sessionId: s.sessionId,
      model: s.model,
      createdAt: s.createdAt.toISOString(),
      lastActivity: s.lastActivity.toISOString(),
    }));

    const response: SessionListResponse = {
      type: 'session.list.result',
      id: message.id,
      payload: { sessions },
    };
    this.send(clientId, response);
  }

  // ── 5. session.prompt ──

  /**
   * Send a prompt to a session and stream SDK events back to the client.
   *
   * Flow:
   * 1. Touch session (bump LRU timestamp)
   * 2. Send {@link StreamingAckResponse}
   * 3. Subscribe to SDK events → forward as {@link StreamEventNotification}
   * 4. Call `session.send()`
   * 5. Clean up event subscriptions on completion or error
   */
  private async handleSessionPrompt(
    clientId: string,
    message: Extract<ClientMessage, { type: 'session.prompt' }>,
  ): Promise<void> {
    const { sessionId, message: prompt } = message.payload;

    this.sessions.touchSession(sessionId);

    const ack: StreamingAckResponse = {
      type: 'session.prompt.ack',
      id: message.id,
      payload: { sessionId },
    };
    this.send(clientId, ack);

    const entry = this.sessions.getSession(sessionId);
    const sdkSession = entry.session as any;

    // ── Subscribe to SDK events ──

    const forwardEvent = (
      sdkEvent: string,
      kind: StreamEventNotification['payload']['kind'],
    ): (() => void) => {
      const handler = (data: unknown) => {
        const notification: StreamEventNotification = {
          type: 'stream.event',
          payload: { sessionId, kind, data },
        };
        this.send(clientId, notification);
      };
      sdkSession.on(sdkEvent, handler);
      return () => sdkSession.off?.(sdkEvent, handler);
    };

    const unsubs = [
      forwardEvent('assistant.message.delta', 'message.delta'),
      forwardEvent('assistant.message', 'message.end'),
      forwardEvent('tool.call', 'tool.call'),
      forwardEvent('session.idle', 'session.idle'),
    ];

    try {
      await sdkSession.send({ prompt });
    } catch (err: unknown) {
      this.sendError(clientId, message.id, 'PROMPT_ERROR', errorMessage(err), sessionId);
    } finally {
      unsubs.forEach((fn) => fn());
    }
  }

  // ── 6. session.cancel ──

  /** Abort the running prompt in a session. */
  private async handleSessionCancel(
    clientId: string,
    message: Extract<ClientMessage, { type: 'session.cancel' }>,
  ): Promise<void> {
    const { sessionId } = message.payload;
    const entry = this.sessions.getSession(sessionId);

    try {
      await (entry.session as any).abort();
    } catch (err: unknown) {
      console.warn(`${TAG} session.cancel failed: ${errorMessage(err)}`);
    }

    // Send response ack first
    this.send(clientId, {
      type: 'session.cancel.result',
      id: message.id,
      payload: { sessionId, cancelled: true },
    } as SessionCancelResponse);

    const notification: StreamEventNotification = {
      type: 'stream.event',
      payload: { sessionId, kind: 'session.idle', data: { reason: 'cancelled' } },
    };
    this.send(clientId, notification);
  }

  // ── 7. session.destroy ──

  /** Destroy a session and free its resources. */
  private async handleSessionDestroy(
    clientId: string,
    message: Extract<ClientMessage, { type: 'session.destroy' }>,
  ): Promise<void> {
    const { sessionId } = message.payload;
    await this.sessions.destroySession(sessionId);
    console.log(`${TAG} session.destroy — id=${sessionId}`);
    this.send(clientId, {
      type: 'session.destroy.result',
      id: message.id,
      payload: { sessionId, destroyed: true },
    });
  }

  // ── 8. tool.response ──

  /** Route a tool response to the pending promise in the client's ToolManager. */
  private handleToolResponse(
    clientId: string,
    message: Extract<ClientMessage, { type: 'tool.response' }>,
  ): void {
    const { toolCallId, result, approved } = message.payload;
    const tm = this.toolManagers.get(clientId);

    if (!tm) {
      console.warn(`${TAG} tool.response — no ToolManager for client ${clientId}`);
      return;
    }

    if (approved === false) {
      tm.rejectToolCall(toolCallId, 'User rejected the action');
    } else {
      tm.resolveToolCall(toolCallId, result ?? { approved });
    }
  }

  // ── 9. mcp.list ──

  /** Return the list of registered MCP servers. */
  private handleMcpList(
    clientId: string,
    message: Extract<ClientMessage, { type: 'mcp.list' }>,
  ): void {
    this.sendMcpListResponse(clientId, message.id);
  }

  // ── 10. mcp.toggle ──

  /** Enable or disable an MCP server. */
  private async handleMcpToggle(
    clientId: string,
    message: Extract<ClientMessage, { type: 'mcp.toggle' }>,
  ): Promise<void> {
    await this.mcpRegistry.toggleServer(message.payload.serverId, message.payload.enabled);
    this.sendMcpListResponse(clientId, message.id);
  }

  // ── 11. mcp.add ──

  /** Register a new MCP server. */
  private async handleMcpAdd(
    clientId: string,
    message: Extract<ClientMessage, { type: 'mcp.add' }>,
  ): Promise<void> {
    const { name, command, args, env } = message.payload;
    await this.mcpRegistry.addServer(name, command, args, env);
    this.sendMcpListResponse(clientId, message.id);
  }

  // ── 12. mcp.remove ──

  /** Remove a registered MCP server. */
  private async handleMcpRemove(
    clientId: string,
    message: Extract<ClientMessage, { type: 'mcp.remove' }>,
  ): Promise<void> {
    await this.mcpRegistry.removeServer(message.payload.serverId);
    this.sendMcpListResponse(clientId, message.id);
  }

  // ── Helpers ──

  /** Send a typed message to a specific client. */
  private send(clientId: string, message: BridgeMessage): void {
    this.wss?.send(clientId, message);
  }

  /** Send an {@link ErrorResponse} to a specific client. */
  private sendError(
    clientId: string,
    id: string | undefined,
    code: string,
    message: string,
    sessionId?: string,
  ): void {
    const err: ErrorResponse = {
      type: 'error',
      ...(id ? { id } : {}),
      payload: { code, message, ...(sessionId ? { sessionId } : {}) },
    };
    this.send(clientId, err);
  }

  /** Build and send the current MCP server list. */
  private sendMcpListResponse(clientId: string, id: string): void {
    const servers = this.mcpRegistry.listServers().map((s) => ({
      id: s.id,
      name: s.name,
      enabled: s.enabled,
      tools: [] as string[],
    }));

    const response: McpListResponse = {
      type: 'mcp.list.result',
      id,
      payload: { servers },
    };
    this.send(clientId, response);
  }
}
