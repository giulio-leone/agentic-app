import { StateCreator } from 'zustand';
import type { AppState, AppActions } from '../appStore';
import { v4 as uuidv4 } from 'uuid';
import {
  SessionSummary,
  ChatMessage,
  ServerType,
} from '../../acp-hex/domain/types';
import { SessionStorage, AI_SHARED_SERVER_ID } from '../../storage/SessionStorage';
import { _service, getBridgeClient, setActiveBridgeSessionId } from '../storePrivate';
import { getAcpHex } from '../../acp-hex/integration/bootstrap';

/** Returns the storage key for a server: shared for AI providers, per-server for ACP/Codex. */
function storageId(state: AppState & AppActions): string | null {
  const server = state.servers.find(s => s.id === state.selectedServerId);
  if (!server) return null;
  return server.serverType === ServerType.AIProvider ? AI_SHARED_SERVER_ID : server.id;
}

export type SessionSlice = Pick<AppState, 'sessions' | 'selectedSessionId' | 'chatMessages'>
  & Pick<AppActions, 'loadSessions' | 'createSession' | 'selectSession' | 'deleteSession' | 'loadSessionMessages'>;

export const createSessionSlice: StateCreator<AppState & AppActions, [], [], SessionSlice> = (set, get) => ({
  // State
  sessions: [],
  selectedSessionId: null,
  chatMessages: [],

  // Actions

  loadSessions: async () => {
    const state = get();
    const sid = storageId(state);
    if (!sid) return;
    const server = state.servers.find(s => s.id === state.selectedServerId);

    const stored = await SessionStorage.fetchSessions(sid);
    set({ sessions: stored });

    const hex = _service ?? getAcpHex();
    if (server?.serverType === ServerType.ACP && hex && state.isInitialized) {
      try {
        const sessions = await hex.session.list.execute();
        set({ sessions });
        for (const session of sessions) {
          await SessionStorage.saveSession(session, sid);
        }
      } catch {
        get().appendLog('session/list not supported, using local sessions');
      }
    }
  },

  createSession: async (cwd?) => {
    const state = get();
    const server = state.servers.find(s => s.id === state.selectedServerId);
    if (!server) return;
    const sid = storageId(state)!;

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
      await SessionStorage.saveSession(newSession, sid);
      get().appendLog(`✓ AI session created: ${sessionId}`);
      return;
    }

    if (server.serverType === ServerType.ChatBridge) {
      const sessionId = uuidv4();
      const newSession: SessionSummary = {
        id: sessionId,
        title: undefined,
        updatedAt: new Date().toISOString(),
        cwd: get().selectedCwd || cwd || server.workingDirectory || undefined,
      };
      set(s => ({
        sessions: [newSession, ...s.sessions],
        selectedSessionId: sessionId,
        chatMessages: [],
        streamingMessageId: null,
        stopReason: null,
        isStreaming: false,
      }));
      setActiveBridgeSessionId(null);
      await SessionStorage.saveSession(newSession, sid);
      get().appendLog(`✓ Chat Bridge session created: ${sessionId}`);
      return;
    }

    const hex = _service ?? getAcpHex();
    if (!hex) return;
    try {
      get().appendLog('→ session/new');
      const result = await hex.gateway.request<{ id?: string; sessionId?: string }>(
        'session/new',
        {
          cwd: get().selectedCwd || cwd || server.workingDirectory,
          model: get().selectedBridgeModel ?? undefined,
          reasoningEffort: get().selectedReasoningEffort ?? undefined,
        },
      );
      const sessionId = result.id ?? result.sessionId;
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
        await SessionStorage.saveSession(newSession, sid);
        get().appendLog(`✓ Session created: ${sessionId}`);
      }
    } catch (error) {
      get().appendLog(`✗ Create session failed: ${(error as Error).message}`);
    }
  },

  selectSession: async (id) => {
    set({
      selectedSessionId: id,
      chatMessages: [],
      streamingMessageId: null,
      stopReason: null,
      isStreaming: false,
    });

    // CLI sessions are loaded via loadCliSessionTurns — skip ACP/local flows
    if (id?.startsWith('cli:')) return;

    const server = get().servers.find(s => s.id === get().selectedServerId);
    if (server?.serverType === ServerType.ChatBridge) {
      if (id.startsWith('bridge:')) {
        const bridgeSessionId = id.replace(/^bridge:/, '');
        setActiveBridgeSessionId(bridgeSessionId);
        const bridgeClient = getBridgeClient();
        if (bridgeClient && bridgeClient.state === 'connected') {
          bridgeClient.resumeSession(bridgeSessionId);
          get().appendLog(`→ bridge/resume_session (${bridgeSessionId})`);
        }
      } else {
        // Local/new chat session: force a new bridge session on first prompt
        setActiveBridgeSessionId(null);
      }
      await get().loadSessionMessages(id);
      return;
    }

    // For ACP servers, try server-side session replay first
    const hex = _service ?? getAcpHex();
    if (hex && id) {
      try {
        await hex.session.load.execute(id);
        if (get().chatMessages.length > 0) return;
      } catch (e: unknown) {
        // loadSession not supported or failed
        get().appendLog(`⚠ loadSession failed: ${e instanceof Error ? e.message : 'unknown'}`);
      }

      // Try local storage
      const sid = storageId(get());
      if (sid) {
        const localMessages = await SessionStorage.fetchMessages(sid, id);
        if (localMessages.length > 0) {
          set({ chatMessages: localMessages });
          return;
        }
      }

      // No messages from server or local — show info banner
      set({
        chatMessages: [{
          id: `info-${id}`,
          role: 'system' as const,
          content: '📋 Cronologia non disponibile — questa sessione è stata creata nel terminale. Puoi continuare la conversazione da qui.',
          timestamp: new Date().toISOString(),
        }],
      });
      return;
    }

    // AI providers: load from AsyncStorage
    get().loadSessionMessages(id);
  },

  deleteSession: async (id) => {
    const state = get();
    const sid = storageId(state);
    if (sid) {
      await SessionStorage.deleteSession(id, sid);
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
    const sid = storageId(state);
    if (!sid) return;
    const messages = await SessionStorage.fetchMessages(sid, sessionId);
    set({ chatMessages: messages });
  },
});
