import { StateCreator } from 'zustand';
import type { AppState, AppActions } from '../appStore';
import {
  ACPConnectionState,
  ServerType,
} from '../../acp/models/types';
import type { ACPTransportConfig } from '../../acp/ACPTransport';
import { JSONValue } from '../../acp/models';
import { SessionStorage } from '../../storage/SessionStorage';
import { getProviderInfo } from '../../ai/providers';
import { v4 as uuidv4 } from 'uuid';
import { ACPService } from '../../acp/ACPService';
import type { AgentProfile } from '../../acp/models/types';
import {
  _service, _aiAbortController,
  setService, setAiAbortController,
} from '../storePrivate';
import type { ACPServerConfiguration } from '../../acp/models/types';
import { createACPListener, clearRetry } from '../helpers/acpListener';

/** Detect AI provider servers, including legacy entries without serverType. */
const isAIServer = (s?: ACPServerConfiguration) =>
  s?.serverType === ServerType.AIProvider || (!s?.serverType && !s?.host);

export type ServerSlice = Pick<AppState, 'servers' | 'selectedServerId' | 'connectionState' | 'isInitialized' | 'agentInfo' | 'connectionError'>
  & Pick<AppActions, 'loadServers' | 'addServer' | 'updateServer' | 'deleteServer' | 'selectServer' | 'connect' | 'disconnect' | 'initialize' | '_getService'>;

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

  setSelectedBridgeModel: (modelId) => set({ selectedBridgeModel: modelId }),
  setSelectedReasoningEffort: (level) => set({ selectedReasoningEffort: level }),
  setSelectedCwd: (path) => set({ selectedCwd: path }),

  listDirectory: async (path?: string) => {
    if (!_service) return null;
    try {
      const response = await _service.fsList(path);
      const result = response.result as Record<string, unknown> | undefined;
      if (!result) return null;
      return {
        path: result.path as string,
        entries: (result.entries as Array<{ name: string; path: string; isDirectory: boolean }>) ?? [],
      };
    } catch (err) {
      get().appendLog(`fs/list error: ${(err as Error).message}`);
      return null;
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
          }
        : {}),
    });
    if (state.selectedServerId === id) {
      _service?.disconnect();
      setService(null);
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
    _aiAbortController?.abort();
    setAiAbortController(null);

    set({
      selectedServerId: id,
      connectionState: ACPConnectionState.Disconnected,
      isInitialized: false,
      agentInfo: null,
      connectionError: null,
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

    const config: ACPTransportConfig = {
      endpoint,
      authToken: server.token || undefined,
    };

    const listener = createACPListener(get, set);

    // TCP→WS auto-fallback: if TCP fails, retry with WS on port+1
    if (scheme === 'tcp') {
      const originalOnError = listener.onError;
      let triedFallback = false;
      listener.onError = (error: Error) => {
        if (!triedFallback && error.message.includes('TCP')) {
          triedFallback = true;
          // Extract host and port, build WS endpoint on port+1
          const hostPort = cleanHost;
          const colonIdx = hostPort.lastIndexOf(':');
          if (colonIdx !== -1) {
            const host = hostPort.substring(0, colonIdx);
            const tcpPort = parseInt(hostPort.substring(colonIdx + 1), 10);
            const wsEndpoint = `ws://${host}:${tcpPort + 1}`;
            get().appendLog(`TCP failed, trying WebSocket fallback: ${wsEndpoint}`);
            _service?.disconnect();
            const wsConfig: ACPTransportConfig = { endpoint: wsEndpoint, authToken: server.token || undefined };
            const wsListener = createACPListener(get, set);
            setService(new ACPService(wsConfig, wsListener));
            _service!.connect();
            return;
          }
        }
        originalOnError?.(error);
      };
    }

    setService(new ACPService(config, listener));
    clearRetry();
    _service!.connect();
    set({ connectionError: null });
  },

  disconnect: () => {
    clearRetry();
    _service?.disconnect();
    setService(null);
    set({
      connectionState: ACPConnectionState.Disconnected,
      isInitialized: false,
    });
  },

  initialize: async () => {
    if (!_service) return;
    try {
      get().appendLog('→ initialize');
      const response = await _service.initialize();
      const result = response.result as Record<string, JSONValue> | undefined;
      if (result) {
        const serverInfo = result.serverInfo as Record<string, JSONValue> | undefined;
        const capabilities = result.capabilities as Record<string, JSONValue> | undefined;
        const modes = (result.modes as Array<Record<string, JSONValue>> | undefined) ?? [];

        const agentInfo: AgentProfile = {
          name: (serverInfo?.name as string) ?? 'Unknown Agent',
          version: (serverInfo?.version as string) ?? '',
          capabilities: {
            promptCapabilities: {
              image: !!(capabilities?.promptCapabilities as Record<string, JSONValue>)?.image,
            },
          },
          modes: modes.map(m => ({
            id: (m.id as string) ?? '',
            name: (m.name as string) ?? '',
            description: m.description as string | undefined,
          })),
        };
        set({ isInitialized: true, agentInfo });
        get().appendLog(`✓ Initialized: ${agentInfo.name} ${agentInfo.version}`);

        // Extract bridge models from initialize response
        const rawModels = result.models as Array<Record<string, JSONValue>> | undefined;
        if (rawModels && rawModels.length > 0) {
          const bridgeModels = rawModels.map(m => ({
            id: (m.id as string) ?? '',
            name: (m.name as string) ?? (m.id as string) ?? '',
            provider: (m.provider as string) ?? 'bridge',
          }));
          set({ bridgeModels });
          get().appendLog(`✓ Bridge models: ${bridgeModels.length}`);
        }

        // Extract reasoning effort levels
        const rawLevels = result.reasoningEffortLevels as string[] | undefined;
        if (rawLevels && rawLevels.length > 0) {
          set({ reasoningEffortLevels: rawLevels });
          get().appendLog(`✓ Reasoning effort levels: ${rawLevels.join(', ')}`);
        }

        get().loadSessions();
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
