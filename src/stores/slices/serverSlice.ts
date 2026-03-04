import { StateCreator } from 'zustand';
import type { AppState, AppActions } from '../appStore';
import {
  ACPConnectionState,
  ServerType,
} from '../../acp-hex/domain/types';
import { SessionStorage } from '../../storage/SessionStorage';
import { getProviderInfo } from '../../ai/providers';
import { v4 as uuidv4 } from 'uuid';
import { createAcpHex, getAcpHex } from '../../acp-hex/integration/bootstrap';
import type { AgentProfile } from '../../acp-hex/domain/types';
import { eventBus } from '../../acp-hex/domain';
import {
  _service, _aiAbortController, _bridgeClient,
  setService, setAiAbortController, setBridgeClient, setActiveBridgeSessionId,
} from '../storePrivate';
import { ChatBridgeClient } from '../../ai/chatbridge/ChatBridgeClient';
import { createChatBridgeCallbacks } from '../../ai/chatbridge/chatBridgeCallbacks';
import { ACPConnectionState as BridgeState } from '../../acp-hex/domain/types';
import type { ACPServerConfiguration } from '../../acp-hex/domain/types';
import { createACPListener, clearRetry } from '../helpers/acpListener';
import { showInfoToast, showErrorToast } from '../../utils/toast';

/** Detect AI provider servers, including legacy entries without serverType. */
const isAIServer = (s?: ACPServerConfiguration) =>
  s?.serverType === ServerType.AIProvider || (!s?.serverType && !s?.host);

/** Detect ChatBridge servers. */
const isChatBridgeServer = (s?: ACPServerConfiguration) =>
  s?.serverType === ServerType.ChatBridge;

export type ServerSlice = Pick<AppState, 'servers' | 'selectedServerId' | 'connectionState' | 'isInitialized' | 'agentInfo' | 'connectionError' | 'bridgeModels' | 'reasoningEffortLevels' | 'selectedBridgeModel' | 'selectedReasoningEffort' | 'selectedCwd' | 'cliSessions' | 'isDiscoveringCli' | 'activePtySessionId' | 'ptyOwnerCliSessionId'>
  & Pick<AppActions, 'loadServers' | 'addServer' | 'updateServer' | 'deleteServer' | 'selectServer' | 'connect' | 'disconnect' | 'initialize' | '_getService' | 'setSelectedBridgeModel' | 'setSelectedReasoningEffort' | 'setSelectedCwd' | 'listDirectory' | 'discoverCliSessions' | 'loadCliSessionTurns' | 'startCliWatch' | 'stopCliWatch' | 'spawnCopilotCli' | 'writeToCopilotPty' | 'killCopilotPty'>;

export const createServerSlice: StateCreator<AppState & AppActions, [], [], ServerSlice> = (set, get) => ({
  // State
  servers: [],
  selectedServerId: null,
  connectionState: ACPConnectionState.Disconnected,
  isInitialized: false,
  agentInfo: null,
  bridgeModels: [],
  reasoningEffortLevels: [],
  selectedBridgeModel: null,
  selectedReasoningEffort: null,
  selectedCwd: null,
  connectionError: null,

  setSelectedBridgeModel: (modelId: string | null) => set({ selectedBridgeModel: modelId }),
  setSelectedReasoningEffort: (level: string | null) => set({ selectedReasoningEffort: level }),
  setSelectedCwd: (path: string | null) => set({ selectedCwd: path }),

  listDirectory: async (path?: string) => {
    const hex = _service ?? getAcpHex();
    if (!hex) return null;
    try {
      const entries = await hex.filesystem.browse.execute(path ?? '/');
      return {
        path: path ?? '/',
        entries: entries.map(e => ({ name: e.name, path: e.path, isDirectory: e.type === 'directory' })),
      };
    } catch (err) {
      get().appendLog(`fs/list error: ${(err as Error).message}`);
      return null;
    }
  },

  // ── Copilot CLI session discovery ──
  cliSessions: [],
  isDiscoveringCli: false,
  activePtySessionId: null,
  ptyOwnerCliSessionId: null as string | null,

  discoverCliSessions: async () => {
    const server = get().servers.find(s => s.id === get().selectedServerId);
    if (isChatBridgeServer(server)) {
      set({ isDiscoveringCli: true });
      try {
        if (_bridgeClient && _bridgeClient.state === 'connected') {
          _bridgeClient.listSessions();
          _bridgeClient.getStatus();
          get().appendLog('→ bridge/list_sessions');
        } else {
          get().appendLog('bridge/discover: not connected');
        }
      } finally {
        set({ isDiscoveringCli: false });
      }
      return;
    }

    const hex = _service ?? getAcpHex();
    if (!hex) {
      get().appendLog('copilot/discover: no service');
      showErrorToast('CLI Discovery', 'No service');
      return;
    }
    set({ isDiscoveringCli: true });
    try {
      const sessions = await hex.cli.discover.execute();
      set({ cliSessions: sessions as unknown as AppState['cliSessions'] });
      showInfoToast('CLI Discovery', `${sessions.length} sessions found`);
    } catch (err) {
      const msg = (err as Error).message;
      get().appendLog(`copilot/discover error: ${msg}`);
      showErrorToast('CLI Discovery', msg);
    } finally {
      set({ isDiscoveringCli: false });
    }
  },

  loadCliSessionTurns: async (sessionId: string) => {
    const server = get().servers.find(s => s.id === get().selectedServerId);
    if (isChatBridgeServer(server)) return;

    const hex = _service ?? getAcpHex();
    if (!hex) return;
    // Show loading state
    set({ chatMessages: [{
      id: `cli-loading-${sessionId}`,
      role: 'system' as const,
      content: '⏳ Caricamento sessione CLI...',
      timestamp: new Date().toISOString(),
    }] });
    try {
      const turns = await hex.cli.loadTurns.execute(sessionId);
      // Convert CLI turns (Message[]) to ChatMessage format
      const messages = turns.flatMap(t => {
        const msgs: import('../../acp-hex/domain/types').ChatMessage[] = [];
        const turn = t as unknown as {
          role: string;
          content: string;
          id: string;
          timestamp?: string;
          turnIndex?: number;
          userMessage?: string | null;
          assistantResponse?: string | null;
        };
        // Handle both Message format and legacy turn format
        if (turn.userMessage !== undefined) {
          if (turn.userMessage) {
            msgs.push({
              id: `cli-${sessionId}-user-${turn.turnIndex ?? 0}`,
              role: 'user',
              content: turn.userMessage,
              timestamp: turn.timestamp ?? new Date().toISOString(),
            });
          }
          if (turn.assistantResponse) {
            msgs.push({
              id: `cli-${sessionId}-assistant-${turn.turnIndex ?? 0}`,
              role: 'assistant',
              content: turn.assistantResponse,
              timestamp: turn.timestamp ?? new Date().toISOString(),
            });
          }
        } else if (turn.role && turn.content) {
          msgs.push({
            id: turn.id ?? `cli-${sessionId}-${turn.role}-${msgs.length}`,
            role: turn.role as 'user' | 'assistant' | 'system',
            content: turn.content,
            timestamp: turn.timestamp ?? new Date().toISOString(),
          });
        }
        return msgs;
      });
      set({ chatMessages: messages.length > 0 ? messages : [{
        id: `cli-empty-${sessionId}`,
        role: 'system' as const,
        content: '📋 Sessione CLI senza messaggi — solo checkpoint disponibili.',
        timestamp: new Date().toISOString(),
      }] });
    } catch (err) {
      get().appendLog(`copilot/turns error: ${(err as Error).message}`);
      set({ chatMessages: [{
        id: `cli-error-${sessionId}`,
        role: 'system' as const,
        content: `❌ Errore caricamento: ${(err as Error).message}`,
        timestamp: new Date().toISOString(),
      }] });
    }
  },

  startCliWatch: async () => {
    const server = get().servers.find(s => s.id === get().selectedServerId);
    if (isChatBridgeServer(server)) {
      if (_bridgeClient && _bridgeClient.state === 'connected') {
        _bridgeClient.listSessions();
      }
      return;
    }

    const hex = _service ?? getAcpHex();
    if (!hex) return;
    try {
      await hex.cli.watch.start();
    } catch (err) {
      get().appendLog(`copilot/watch/start error: ${(err as Error).message}`);
    }
  },

  stopCliWatch: async () => {
    const server = get().servers.find(s => s.id === get().selectedServerId);
    if (isChatBridgeServer(server)) return;

    const hex = _service ?? getAcpHex();
    if (!hex) return;
    try {
      await hex.cli.watch.stop();
    } catch (err) {
      get().appendLog(`copilot/watch/stop error: ${(err as Error).message}`);
    }
  },

  // ── Copilot PTY interaction ──

  spawnCopilotCli: async (cwd: string, cliSessionId?: string, args?: string[]) => {
    const hex = _service ?? getAcpHex();
    if (!hex) {
      showErrorToast('PTY: no service connected');
      return null;
    }
    try {
      // Dispose any existing PTY before spawning a new one
      const existingPty = get().activePtySessionId;
      if (existingPty) {
        try { await hex.cli.kill.execute(existingPty); } catch { /* best effort */ }
        set({ activePtySessionId: null, ptyOwnerCliSessionId: null });
      }
      showInfoToast(`PTY: spawning in ${cwd.split('/').pop()}...`);
      const result = await hex.cli.spawn.execute(args?.join(' '), cwd);
      if (result?.ptyId) {
        const ptyId = result.ptyId;
        set({ activePtySessionId: ptyId, ptyOwnerCliSessionId: cliSessionId ?? null });
        showInfoToast(`✓ Copilot CLI spawned (${ptyId})`);
        get().appendLog(`✓ Copilot CLI spawned: ${ptyId}`);
        return ptyId;
      }
      showErrorToast(`PTY: spawn response missing id: ${JSON.stringify(result)}`);
      return null;
    } catch (err) {
      showErrorToast(`PTY spawn error: ${(err as Error).message}`);
      get().appendLog(`copilot/spawn error: ${(err as Error).message}`);
      return null;
    }
  },

  writeToCopilotPty: async (sessionId: string, input: string, closeStdin = false) => {
    const hex = _service ?? getAcpHex();
    if (!hex) return false;
    try {
      const result = await hex.gateway.request<{ success: boolean }>('copilot/write', { sessionId, input, closeStdin });
      return !!(result?.success);
    } catch (err) {
      get().appendLog(`copilot/write error: ${(err as Error).message}`);
      return false;
    }
  },

  killCopilotPty: async (sessionId: string) => {
    const hex = _service ?? getAcpHex();
    if (!hex) return;
    try {
      await hex.cli.kill.execute(sessionId);
      if (get().activePtySessionId === sessionId) {
        set({ activePtySessionId: null, ptyOwnerCliSessionId: null });
      }
    } catch (err) {
      get().appendLog(`copilot/kill error: ${(err as Error).message}`);
    }
  },

  // Actions

  loadServers: async () => {
    const servers = await SessionStorage.fetchServers();
    set({ servers });

    // Migrate per-server AI sessions to shared storage (one-time)
    const aiIds = servers
      .filter(s => s.serverType === ServerType.AIProvider)
      .map(s => s.id);
    if (aiIds.length > 0) {
      SessionStorage.migrateAISessionsToShared(aiIds).catch(e => console.warn('[SessionStorage] Migration failed:', e));
    }

    // Restore active server from storage, or auto-select first
    const state = get();
    if (!state.selectedServerId && servers.length > 0) {
      const savedId = await SessionStorage.getActiveServerId();
      const target = savedId && servers.find(s => s.id === savedId) ? savedId : servers[0]!.id;
      get().selectServer(target);
    }
  },

  addServer: async (serverData) => {
    const server = {
      ...serverData,
      id: uuidv4(),
    };
    await SessionStorage.saveServer(server);
    set(state => ({ servers: [...state.servers, server] }));
    return server.id;
  },

  updateServer: async (server) => {
    await SessionStorage.saveServer(server);
    set(state => ({
      servers: state.servers.map(s => (s.id === server.id ? server : s)),
    }));
  },

  deleteServer: async (id) => {
    await SessionStorage.deleteServer(id);
    const state = get();
      set({
        servers: state.servers.filter(s => s.id !== id),
        ...(state.selectedServerId === id
        ? {
            selectedServerId: null,
            connectionState: ACPConnectionState.Disconnected,
            isInitialized: false,
            sessions: [],
            selectedSessionId: null,
            chatMessages: [],
            cliSessions: [],
            isDiscoveringCli: false,
            activePtySessionId: null,
            ptyOwnerCliSessionId: null,
          }
        : {}),
      });
    if (state.selectedServerId === id) {
      _service?.disconnect();
      setService(null);
      _bridgeClient?.disconnect();
      setBridgeClient(null);
      setActiveBridgeSessionId(null);
    }
  },

  selectServer: (id) => {
    const state = get();
    const server = id ? state.servers.find(s => s.id === id) : undefined;
    const prevServer = state.selectedServerId
      ? state.servers.find(s => s.id === state.selectedServerId)
      : undefined;

    // If same server is already selected, just ensure it's connected
    if (state.selectedServerId === id) {
      if (isAIServer(server) && !state.isInitialized) {
        get().connect();
      }
      return;
    }

    const bothAI = isAIServer(prevServer) && isAIServer(server);

    _service?.disconnect();
    setService(null);
    _bridgeClient?.disconnect();
    setBridgeClient(null);
    setActiveBridgeSessionId(null);
    _aiAbortController?.abort();
    setAiAbortController(null);

    set({
      selectedServerId: id,
      connectionState: ACPConnectionState.Disconnected,
      isInitialized: false,
      agentInfo: null,
      connectionError: null,
      cliSessions: [],
      isDiscoveringCli: false,
      activePtySessionId: null,
      ptyOwnerCliSessionId: null,
      // Preserve sessions/messages when switching between AI providers (unified storage)
      ...(bothAI ? {} : {
        sessions: [],
        selectedSessionId: null,
        chatMessages: [],
      }),
      streamingMessageId: null,
      stopReason: null,
      isStreaming: false,
    });
    // Persist selection
    if (id) SessionStorage.saveActiveServerId(id).catch(e => console.warn('[SessionStorage] Save active ID failed:', e));
    if (id) {
      if (isAIServer(server)) {
        get().connect();
      }
      if (!bothAI) {
        get().loadSessions();
      }
    }
  },

  connect: () => {
    const state = get();
    const server = state.servers.find(s => s.id === state.selectedServerId);
    if (!server) return;

    // Treat servers with aiProviderConfig OR legacy format (no serverType + no host) as AI providers
    if (isAIServer(server)) {
      let providerInfo: ReturnType<typeof getProviderInfo> | null = null;
      try {
        if (server.aiProviderConfig?.providerType) {
          providerInfo = getProviderInfo(server.aiProviderConfig.providerType);
        }
      } catch { /* legacy server with unknown provider type */ }
      set({
        connectionState: ACPConnectionState.Connected,
        isInitialized: true,
        connectionError: null,
        agentInfo: {
          name: providerInfo?.name ?? 'AI Provider',
          version: server.aiProviderConfig?.modelId ?? '',
          capabilities: { promptCapabilities: { image: false } },
          modes: [],
        },
      });
      get().loadSessions();
      return;
    }

    // ── Chat Bridge path ──
    if (isChatBridgeServer(server)) {
      if (!server.host) {
        set({ connectionError: 'Server has no host configured' });
        return;
      }
      const cleanHost = server.host
        .replace(/^(wss?|https?):\/\//i, '')
        .replace(/\/+$/, '');
      const scheme = server.scheme === 'wss' ? 'wss' : 'ws';
      const endpoint = `${scheme}://${cleanHost}`;
      get().appendLog(`Chat Bridge: connecting to ${endpoint}`);

      set({ connectionState: ACPConnectionState.Connecting, connectionError: null });

      const storeApi = {
        get: () => ({
          chatMessages: get().chatMessages,
          sessions: get().sessions,
          selectedSessionId: get().selectedSessionId,
          isStreaming: get().isStreaming,
          streamingMessageId: get().streamingMessageId,
        }),
        set: (partial: Record<string, unknown>) => set(partial as any),
        appendLog: (msg: string) => get().appendLog(msg),
      };

      const callbacks = createChatBridgeCallbacks(storeApi);
      let bridgeClientRef: ChatBridgeClient | null = null;
      const wrappedCallbacks = {
        ...callbacks,
        onConnected: () => {
          callbacks.onConnected();
          const modelChoices = [
            { id: 'claude', name: 'Claude Code', provider: 'chat-bridge' },
            { id: 'copilot', name: 'Copilot CLI', provider: 'chat-bridge' },
            { id: 'codex', name: 'Codex CLI', provider: 'chat-bridge' },
          ];
          const defaultBridgeModel = server.aiProviderConfig?.modelId ?? 'claude';
          const currentBridgeModel = get().selectedBridgeModel;
          const selectedBridgeModel = modelChoices.some(m => m.id === currentBridgeModel)
            ? currentBridgeModel
            : defaultBridgeModel;
          set({
            connectionState: ACPConnectionState.Connected,
            isInitialized: true,
            connectionError: null,
            bridgeModels: modelChoices,
            selectedBridgeModel,
            reasoningEffortLevels: ['low', 'medium', 'high', 'xhigh'],
            selectedReasoningEffort: get().selectedReasoningEffort ?? server.aiProviderConfig?.reasoningEffort ?? null,
            agentInfo: {
              name: 'Chat Bridge',
              version: server.host ?? '',
              capabilities: { promptCapabilities: { image: false } },
              modes: [],
            },
          });
          setActiveBridgeSessionId(null);
          get().loadSessions();
          bridgeClientRef?.listSessions();
          bridgeClientRef?.getStatus();
        },
        onDisconnected: () => {
          callbacks.onDisconnected();
          setActiveBridgeSessionId(null);
          set({ connectionState: ACPConnectionState.Disconnected, isInitialized: false });
        },
        onError: (error: string) => {
          callbacks.onError(error);
          set({ connectionError: error });
        },
      };

      const client = new ChatBridgeClient(wrappedCallbacks);
      bridgeClientRef = client;
      setBridgeClient(client);
      client.connect(endpoint, server.token || undefined);
      return;
    }

    // ── ACP path ──
    // Sanitize host: strip accidental protocol prefix
    if (!server.host) {
      set({ connectionError: 'Server has no host configured' });
      return;
    }
    const cleanHost = server.host
      .replace(/^(wss?|https?|tcp):\/\//i, '')
      .replace(/\/+$/, '');
    const scheme = server.scheme || 'ws';
    const endpoint = `${scheme}://${cleanHost}`;
    get().appendLog(`Connecting to ${endpoint}`);

    // Validate endpoint format (skip URL validation for tcp:// which isn't a valid URL scheme)
    if (scheme !== 'tcp') {
      try { new URL(endpoint); } catch {
        set({ connectionError: `Invalid endpoint: ${endpoint}` });
        get().appendLog(`✗ Invalid endpoint: ${endpoint}`);
        return;
      }
    }

    const transportType: 'websocket' | 'tcp' = scheme === 'tcp' ? 'tcp' : 'websocket';

    // Compute TCP fallback port (WS on port+1)
    let tcpFallbackPort: number | undefined;
    if (scheme === 'tcp') {
      const colonIdx = cleanHost.lastIndexOf(':');
      if (colonIdx !== -1) {
        const tcpPort = parseInt(cleanHost.substring(colonIdx + 1), 10);
        if (!isNaN(tcpPort)) tcpFallbackPort = tcpPort + 1;
      }
    }

    const hex = createAcpHex({ endpoint, transportType, tcpFallbackPort });
    setService(hex);

    // Subscribe to EventBus for connection state changes → drive acpListener
    const listener = createACPListener(get, set);
    eventBus.on('connection:stateChanged', (event) => {
      // Map domain ConnectionState (PascalCase) to ACPConnectionState (lowercase)
      const stateMap: Record<string, ACPConnectionState> = {
        Disconnected: ACPConnectionState.Disconnected,
        Connecting: ACPConnectionState.Connecting,
        Connected: ACPConnectionState.Connected,
        Reconnecting: ACPConnectionState.Connecting,
        CircuitOpen: ACPConnectionState.Failed,
        HalfOpen: ACPConnectionState.Connecting,
        Failed: ACPConnectionState.Failed,
      };
      const mapped = stateMap[event.state] ?? ACPConnectionState.Disconnected;
      listener.onStateChange?.(mapped);
    });

    // Forward gateway notifications to acpListener
    eventBus.on('*' as any, (event: any) => {
      // The gateway emits notification-type events; forward raw ACP notifications
      if (event.type === 'error:occurred') {
        listener.onError?.(new Error(event.message));
      }
    });

    clearRetry();
    hex.gateway.connect();
    set({ connectionError: null });
  },

  disconnect: () => {
    clearRetry();
    const hex = _service ?? getAcpHex();
    hex?.disconnect();
    setService(null);
    _bridgeClient?.disconnect();
    setBridgeClient(null);
    setActiveBridgeSessionId(null);
    set({
      connectionState: ACPConnectionState.Disconnected,
      isInitialized: false,
      cliSessions: [],
      isDiscoveringCli: false,
      activePtySessionId: null,
      ptyOwnerCliSessionId: null,
    });
  },

  initialize: async () => {
    const hex = _service ?? getAcpHex();
    if (!hex) return;
    try {
      get().appendLog('→ initialize');
      const result = await hex.session.initialize.execute('AgmenteRN', '3.18.0');
      if (result) {
        const agentInfo: AgentProfile = {
          name: result.serverName ?? 'Unknown Agent',
          version: result.version ?? '',
          capabilities: {
            promptCapabilities: {
              image: !!(result.capabilities?.promptCapabilities as Record<string, unknown>)?.image,
            },
          },
          modes: ((result as any).modes ?? []).map((m: any) => ({
            id: m.id ?? '',
            name: m.name ?? '',
            description: m.description,
          })),
        };
        set({ isInitialized: true, agentInfo });
        get().appendLog(`✓ Initialized: ${agentInfo.name} ${agentInfo.version}`);

        // Extract bridge models from initialize response
        if (result.models && result.models.length > 0) {
          const bridgeModels = result.models.map(m => ({
            id: m.id ?? '',
            name: m.name ?? m.id ?? '',
            provider: m.provider ?? 'bridge',
          }));
          set({ bridgeModels });
          get().appendLog(`✓ Bridge models: ${bridgeModels.length}`);
        }

        // Extract reasoning effort levels
        const rawLevels = (result as any).reasoningEffortLevels as string[] | undefined;
        if (rawLevels && rawLevels.length > 0) {
          set({ reasoningEffortLevels: rawLevels });
          get().appendLog(`✓ Reasoning effort levels: ${rawLevels.join(', ')}`);
        }

        get().loadSessions();
        get().discoverCliSessions();
      } else {
        set({ isInitialized: true });
      }
    } catch (error) {
      const msg = (error as Error).message;
      set({ connectionError: `Initialize failed: ${msg}` });
      get().appendLog(`✗ Initialize failed: ${msg}`);
    }
  },

  _getService: () => _service,
});
