import { StateCreator } from 'zustand';
import type { AppState, AppActions } from '../appStore';
import { v4 as uuidv4 } from 'uuid';
import {
  SessionSummary,
  ChatMessage,
  ServerType,
} from '../../acp/models/types';
import { JSONValue } from '../../acp/models';
import { SessionStorage, AI_SHARED_SERVER_ID } from '../../storage/SessionStorage';
import { _service } from '../storePrivate';

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

    const stored = await SessionStorage.fetchSessions(sid);
    set({ sessions: stored });

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
          for (const session of sessions) {
            await SessionStorage.saveSession(session, sid);
          }
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

    if (!_service) return;
    try {
      get().appendLog('→ session/new');
      const response = await _service.createSession({
        cwd: get().selectedCwd || cwd || server.workingDirectory,
        model: get().selectedBridgeModel ?? undefined,
        reasoningEffort: get().selectedReasoningEffort ?? undefined,
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

    // For ACP servers, try server-side session replay first
    if (_service && id) {
      const session = get().sessions.find(s => s.id === id);
      try {
        await _service.loadSession({
          sessionId: id,
          cwd: session?.cwd,
        });
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
