import { StateCreator } from 'zustand';
import type { AppState, AppActions } from '../appStore';
import { v4 as uuidv4 } from 'uuid';
import {
  SessionSummary,
  ChatMessage,
  ServerType,
} from '../../acp/models/types';
import { JSONValue } from '../../acp/models';
import { SessionStorage } from '../../storage/SessionStorage';
import { _service } from '../storePrivate';

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
    if (!state.selectedServerId) return;

    const stored = await SessionStorage.fetchSessions(state.selectedServerId);
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
            await SessionStorage.saveSession(session, state.selectedServerId!);
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
});
