/**
 * Main application store – manages servers, connections, and sessions.
 * Replaces AppViewModel + ServerViewModel + ACPSessionViewModel from Swift.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  ACPConnectionState,
  ACPServerConfiguration,
  AgentProfile,
  ChatMessage,
  SessionSummary,
  ServerType,
} from '../acp/models/types';
import {
  ACPService,
  ACPServiceListener,
} from '../acp/ACPService';
import { ACPClientConfig } from '../acp/ACPClient';
import {
  parseSessionUpdate,
  applySessionUpdate,
} from '../acp/SessionUpdateHandler';
import { JSONValue, isNotification, ACPWireMessage } from '../acp/models';
import { SessionStorage } from '../storage/SessionStorage';
import { streamChat } from '../ai/AIService';
import { getApiKey } from '../storage/SecureStorage';
import { getProviderInfo } from '../ai/providers';

// ─── Store State ───

interface AppState {
  // Servers
  servers: ACPServerConfiguration[];
  selectedServerId: string | null;

  // Connection
  connectionState: ACPConnectionState;
  isInitialized: boolean;
  agentInfo: AgentProfile | null;
  connectionError: string | null;

  // Sessions
  sessions: SessionSummary[];
  selectedSessionId: string | null;
  chatMessages: ChatMessage[];
  streamingMessageId: string | null;
  stopReason: string | null;
  isStreaming: boolean;
  promptText: string;

  // Settings
  devModeEnabled: boolean;
  developerLogs: string[];
}

// ─── Store Actions ───

interface AppActions {
  // Server management
  loadServers: () => Promise<void>;
  addServer: (server: Omit<ACPServerConfiguration, 'id'>) => Promise<string>;
  updateServer: (server: ACPServerConfiguration) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  selectServer: (id: string | null) => void;

  // Connection
  connect: () => void;
  disconnect: () => void;
  initialize: () => Promise<void>;

  // Sessions
  loadSessions: () => Promise<void>;
  createSession: (cwd?: string) => Promise<void>;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  loadSessionMessages: (sessionId: string) => Promise<void>;

  // Chat
  sendPrompt: (text: string) => Promise<void>;
  cancelPrompt: () => Promise<void>;
  setPromptText: (text: string) => void;

  // Settings
  toggleDevMode: () => void;
  appendLog: (log: string) => void;
  clearLogs: () => void;

  // Internal
  _getService: () => ACPService | null;
}

// ─── Private state ───
let _service: ACPService | null = null;
let _aiAbortController: AbortController | null = null;

// ─── Store ───

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  // Initial state
  servers: [],
  selectedServerId: null,
  connectionState: ACPConnectionState.Disconnected,
  isInitialized: false,
  agentInfo: null,
  connectionError: null,
  sessions: [],
  selectedSessionId: null,
  chatMessages: [],
  streamingMessageId: null,
  stopReason: null,
  isStreaming: false,
  promptText: '',
  devModeEnabled: false,
  developerLogs: [],

  // --- Server Management ---

  loadServers: async () => {
    const servers = await SessionStorage.fetchServers();
    set({ servers });
  },

  addServer: async (serverData) => {
    const server: ACPServerConfiguration = {
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
      _service = null;
    }
  },

  selectServer: (id) => {
    const state = get();
    if (state.selectedServerId === id) return;
    // Disconnect from current
    _service?.disconnect();
    _service = null;
    set({
      selectedServerId: id,
      connectionState: ACPConnectionState.Disconnected,
      isInitialized: false,
      agentInfo: null,
      connectionError: null,
      sessions: [],
      selectedSessionId: null,
      chatMessages: [],
      streamingMessageId: null,
      stopReason: null,
      isStreaming: false,
    });
    if (id) {
      get().loadSessions();
    }
  },

  // --- Connection ---

  connect: () => {
    const state = get();
    const server = state.servers.find(s => s.id === state.selectedServerId);
    if (!server) return;

    // AI Provider servers don't need WebSocket — mark as connected immediately
    if (server.serverType === ServerType.AIProvider) {
      const providerInfo = server.aiProviderConfig
        ? getProviderInfo(server.aiProviderConfig.providerType)
        : null;
      set({
        connectionState: ACPConnectionState.Connected,
        isInitialized: true,
        connectionError: null,
        agentInfo: {
          name: providerInfo ? `${providerInfo.icon} ${providerInfo.name}` : 'AI Provider',
          version: server.aiProviderConfig?.modelId ?? '',
          capabilities: { promptCapabilities: { image: false } },
          modes: [],
        },
      });
      get().loadSessions();
      return;
    }

    const endpoint = `${server.scheme}://${server.host}`;
    const config: ACPClientConfig = {
      endpoint,
      authToken: server.token || undefined,
      appendNewline: true,
    };

    const listener: ACPServiceListener = {
      onStateChange: (newState) => {
        set({ connectionState: newState });
        if (newState === ACPConnectionState.Connected) {
          set({ connectionError: null });
          // Auto-initialize after connect
          get().initialize();
        }
        if (newState === ACPConnectionState.Disconnected || newState === ACPConnectionState.Failed) {
          set({ isInitialized: false });
        }
      },
      onNotification: (method, params) => {
        get().appendLog(`← notification: ${method}`);
        // Handle session/update notifications
        if (method === 'session/update' || method === 'notifications/session/update') {
          const actions = parseSessionUpdate(params);
          const state = get();
          const { messages, streamingMessageId, stopReason } = applySessionUpdate(
            state.chatMessages,
            actions,
            state.streamingMessageId,
          );
          set({
            chatMessages: messages,
            streamingMessageId,
            isStreaming: streamingMessageId !== null,
            ...(stopReason ? { stopReason } : {}),
          });

          // Persist messages
          if (state.selectedServerId && state.selectedSessionId) {
            SessionStorage.saveMessages(messages, state.selectedServerId, state.selectedSessionId);
          }
        }
      },
      onMessage: (message) => {
        if (get().devModeEnabled) {
          get().appendLog(`← ${JSON.stringify(message).substring(0, 200)}`);
        }
      },
      onError: (error) => {
        set({ connectionError: error.message });
        get().appendLog(`ERROR: ${error.message}`);
      },
    };

    _service = new ACPService(config, listener);
    _service.connect();
    set({ connectionError: null });
  },

  disconnect: () => {
    _service?.disconnect();
    _service = null;
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
        // Parse agent info
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

        // Fetch sessions after init
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

  // --- Sessions ---

  loadSessions: async () => {
    const state = get();
    if (!state.selectedServerId) return;

    // Load from local storage
    const stored = await SessionStorage.fetchSessions(state.selectedServerId);
    set({ sessions: stored });

    // Try to fetch from server if connected
    if (_service && state.isInitialized) {
      try {
        const response = await _service.listSessions();
        const result = response.result as Record<string, JSONValue> | undefined;
        if (result) {
          const sessionsList = (result.sessions as Array<Record<string, JSONValue>>) ?? [];
          const sessions: SessionSummary[] = sessionsList.map(s => ({
            id: (s.id as string) ?? (s.sessionId as string) ?? '',
            title: s.title as string | undefined,
            cwd: s.cwd as string | undefined,
            updatedAt: s.updatedAt as string | undefined,
          }));
          set({ sessions });
          // Persist
          for (const session of sessions) {
            await SessionStorage.saveSession(session, state.selectedServerId!);
          }
        }
      } catch {
        // session/list not supported by all agents – that's fine
        get().appendLog('session/list not supported, using local sessions');
      }
    }
  },

  createSession: async (cwd?) => {
    const state = get();
    const server = state.servers.find(s => s.id === state.selectedServerId);
    if (!server) return;

    // AI Provider: create a local-only session (no server call)
    if (server.serverType === ServerType.AIProvider) {
      const sessionId = uuidv4();
      const newSession: SessionSummary = {
        id: sessionId,
        title: undefined,
        updatedAt: new Date().toISOString(),
      };
      set(s => ({
        sessions: [newSession, ...s.sessions],
        selectedSessionId: sessionId,
        chatMessages: [],
        streamingMessageId: null,
        stopReason: null,
        isStreaming: false,
      }));
      if (state.selectedServerId) {
        await SessionStorage.saveSession(newSession, state.selectedServerId);
      }
      get().appendLog(`✓ AI session created: ${sessionId}`);
      return;
    }

    if (!_service) return;
    try {
      get().appendLog('→ session/new');
      const response = await _service.createSession({
        cwd: cwd || server.workingDirectory,
      });
      const result = response.result as Record<string, JSONValue> | undefined;
      const sessionId = (result?.id as string) ?? (result?.sessionId as string);
      if (sessionId) {
        const newSession: SessionSummary = {
          id: sessionId,
          title: undefined,
          cwd: cwd,
          updatedAt: new Date().toISOString(),
        };
        set(s => ({
          sessions: [newSession, ...s.sessions],
          selectedSessionId: sessionId,
          chatMessages: [],
          streamingMessageId: null,
          stopReason: null,
          isStreaming: false,
        }));
        if (state.selectedServerId) {
          await SessionStorage.saveSession(newSession, state.selectedServerId);
        }
        get().appendLog(`✓ Session created: ${sessionId}`);
      }
    } catch (error) {
      get().appendLog(`✗ Create session failed: ${(error as Error).message}`);
    }
  },

  selectSession: (id) => {
    set({
      selectedSessionId: id,
      chatMessages: [],
      streamingMessageId: null,
      stopReason: null,
      isStreaming: false,
    });
    get().loadSessionMessages(id);
  },

  deleteSession: async (id) => {
    const state = get();
    if (state.selectedServerId) {
      await SessionStorage.deleteSession(id, state.selectedServerId);
    }
    set(s => ({
      sessions: s.sessions.filter(sess => sess.id !== id),
      ...(s.selectedSessionId === id
        ? { selectedSessionId: null, chatMessages: [], streamingMessageId: null }
        : {}),
    }));
  },

  loadSessionMessages: async (sessionId) => {
    const state = get();
    if (!state.selectedServerId) return;
    const messages = await SessionStorage.fetchMessages(state.selectedServerId, sessionId);
    set({ chatMessages: messages });
  },

  // --- Chat ---

  sendPrompt: async (text) => {
    const state = get();
    const server = state.servers.find(s => s.id === state.selectedServerId);
    if (!server || !state.selectedSessionId) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    set(s => ({
      chatMessages: [...s.chatMessages, userMessage],
      promptText: '',
      isStreaming: true,
      stopReason: null,
    }));

    // Persist user message & update session title
    const allMessages = [...state.chatMessages, userMessage];
    if (state.selectedServerId && state.selectedSessionId) {
      SessionStorage.saveMessages(allMessages, state.selectedServerId, state.selectedSessionId);
      if (state.chatMessages.length === 0) {
        const title = text.substring(0, 50);
        const session = state.sessions.find(s => s.id === state.selectedSessionId);
        if (session) {
          SessionStorage.saveSession(
            { ...session, title, updatedAt: new Date().toISOString() },
            state.selectedServerId,
          );
          set(s => ({
            sessions: s.sessions.map(sess =>
              sess.id === state.selectedSessionId ? { ...sess, title } : sess
            ),
          }));
        }
      }
    }

    // ── AI Provider path ──
    if (server.serverType === ServerType.AIProvider && server.aiProviderConfig) {
      const config = server.aiProviderConfig;
      try {
        const apiKey = await getApiKey(`${server.id}_${config.providerType}`);
        if (!apiKey) {
          throw new Error('API key not found. Please configure your API key in server settings.');
        }

        // Create assistant streaming message
        const assistantId = uuidv4();
        set(s => ({
          chatMessages: [...s.chatMessages, {
            id: assistantId,
            role: 'assistant' as const,
            content: '',
            isStreaming: true,
            timestamp: new Date().toISOString(),
          }],
          streamingMessageId: assistantId,
        }));

        // Get all messages for context (excluding the streaming placeholder)
        const contextMessages = get().chatMessages.filter(m => m.id !== assistantId);

        _aiAbortController = streamChat(
          contextMessages,
          config,
          apiKey,
          // onChunk
          (chunk) => {
            set(s => ({
              chatMessages: s.chatMessages.map(m =>
                m.id === assistantId
                  ? { ...m, content: m.content + chunk }
                  : m
              ),
            }));
          },
          // onComplete
          (stopReason) => {
            _aiAbortController = null;
            set(s => ({
              chatMessages: s.chatMessages.map(m =>
                m.id === assistantId ? { ...m, isStreaming: false } : m
              ),
              isStreaming: false,
              streamingMessageId: null,
              stopReason,
            }));
            // Persist final messages
            const finalState = get();
            if (finalState.selectedServerId && finalState.selectedSessionId) {
              SessionStorage.saveMessages(
                finalState.chatMessages,
                finalState.selectedServerId,
                finalState.selectedSessionId,
              );
            }
          },
          // onError
          (error) => {
            _aiAbortController = null;
            const errorMessage: ChatMessage = {
              id: uuidv4(),
              role: 'system',
              content: `⚠️ Error: ${error.message}`,
              timestamp: new Date().toISOString(),
            };
            set(s => ({
              chatMessages: [
                ...s.chatMessages.filter(m => m.id !== assistantId),
                errorMessage,
              ],
              isStreaming: false,
              streamingMessageId: null,
            }));
          },
        );
        return;
      } catch (error) {
        const errorMsg = (error as Error).message;
        get().appendLog(`✗ AI prompt failed: ${errorMsg}`);
        const errorMessage: ChatMessage = {
          id: uuidv4(),
          role: 'system',
          content: `⚠️ Error: ${errorMsg}`,
          timestamp: new Date().toISOString(),
        };
        set(s => ({
          chatMessages: [...s.chatMessages, errorMessage],
          isStreaming: false,
        }));
        return;
      }
    }

    // ── ACP path (existing) ──
    if (!_service) return;

    try {
      get().appendLog(`→ session/prompt: ${text.substring(0, 80)}`);
      const response = await _service.sendPrompt({
        sessionId: state.selectedSessionId,
        text,
      });
      const result = response.result as Record<string, JSONValue> | undefined;
      const stopReason = result?.stopReason as string | undefined;
      const currentState = get();
      if (currentState.streamingMessageId) {
        const idx = currentState.chatMessages.findIndex(m => m.id === currentState.streamingMessageId);
        if (idx !== -1) {
          const updatedMessages = [...currentState.chatMessages];
          updatedMessages[idx] = { ...updatedMessages[idx], isStreaming: false };
          set({ chatMessages: updatedMessages, isStreaming: false, streamingMessageId: null, stopReason: stopReason ?? 'end_turn' });
        } else {
          set({ isStreaming: false, streamingMessageId: null, stopReason: stopReason ?? 'end_turn' });
        }
      } else {
        set({ isStreaming: false, stopReason: stopReason ?? 'end_turn' });
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      get().appendLog(`✗ Prompt failed: ${errorMsg}`);
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: 'system',
        content: `⚠️ Error: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      };
      set(s => ({
        chatMessages: [...s.chatMessages, errorMessage],
        isStreaming: false,
      }));
    }
  },

  cancelPrompt: async () => {
    const state = get();

    // AI Provider: abort via controller
    if (_aiAbortController) {
      _aiAbortController.abort();
      _aiAbortController = null;
      set({ isStreaming: false });
      return;
    }

    // ACP path
    if (!_service || !state.selectedSessionId) return;
    try {
      await _service.cancelSession({ sessionId: state.selectedSessionId });
      set({ isStreaming: false });
      get().appendLog('→ session/cancel');
    } catch {
      // ignore
    }
  },

  setPromptText: (text) => {
    set({ promptText: text });
  },

  // --- Settings ---

  toggleDevMode: () => {
    set(s => ({ devModeEnabled: !s.devModeEnabled }));
  },

  appendLog: (log) => {
    const timestamp = new Date().toLocaleTimeString();
    set(s => ({
      developerLogs: [...s.developerLogs.slice(-499), `[${timestamp}] ${log}`],
    }));
  },

  clearLogs: () => {
    set({ developerLogs: [] });
  },

  _getService: () => _service,
}));
