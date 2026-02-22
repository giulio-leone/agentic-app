import { StateCreator } from 'zustand';
import type { AppState, AppActions } from '../appStore';
import { v4 as uuidv4 } from 'uuid';
import {
  ChatMessage,
  ServerType,
} from '../../acp/models/types';
import { JSONValue } from '../../acp/models';
import { SessionStorage, AI_SHARED_SERVER_ID } from '../../storage/SessionStorage';
import { getApiKey } from '../../storage/SecureStorage';
import {
  _service, _aiAbortController,
  setAiAbortController,
} from '../storePrivate';
import type { AIProviderConfig } from '../../ai/types';
import { startAIStream, type StreamContext } from '../helpers/chatStreamHelper';

export type ChatSlice = Pick<AppState, 'streamingMessageId' | 'stopReason' | 'isStreaming' | 'promptText'>
  & Pick<AppActions, 'sendPrompt' | 'cancelPrompt' | 'setPromptText' | 'editMessage' | 'deleteMessage' | 'regenerateMessage'>;

export const createChatSlice: StateCreator<AppState & AppActions, [], [], ChatSlice> = (set, get) => {

  /** Resolve storage key: shared for AI providers, per-server for ACP/Codex. */
  function chatStorageId(): string | null {
    const state = get();
    const server = state.servers.find(s => s.id === state.selectedServerId);
    if (!server) return null;
    return server.serverType === ServerType.AIProvider ? AI_SHARED_SERVER_ID : server.id;
  }

  /** Stream context for chatStreamHelper. */
  const streamCtx: StreamContext = { set, get, chatStorageId };

  /** Persist current messages to storage. */
  function _persistMessages() {
    const s = get();
    const sid = chatStorageId();
    if (sid && s.selectedSessionId) {
      SessionStorage.saveMessages(s.chatMessages, sid, s.selectedSessionId);
    }
  }

  /** Resolve AI provider config + API key. */
  async function _resolveAIProvider(): Promise<{ config: AIProviderConfig; apiKey: string } | null> {
    const state = get();
    const server = state.servers.find(s => s.id === state.selectedServerId);
    if (!server || server.serverType !== ServerType.AIProvider || !server.aiProviderConfig) return null;
    const config = server.aiProviderConfig;
    const apiKey = await getApiKey(`${server.id}_${config.providerType}`);
    if (!apiKey) return null;
    return { config, apiKey };
  }

  return {
    // State
    streamingMessageId: null,
    stopReason: null,
    isStreaming: false,
    promptText: '',

    // Actions

    sendPrompt: async (text, attachments) => {
      const state = get();
      let server = state.servers.find(s => s.id === state.selectedServerId);

      // Fallback: If no server is selected, pick the first AI Provider server
      if (!server) {
        server = state.servers.find(s => s.serverType === ServerType.AIProvider);
        if (server) {
          get().selectServer(server.id);
        } else {
          console.warn('[chatSlice] No AI server available to handle the prompt.');
          return;
        }
      }

      // Auto-create session if none selected
      let sessionId = state.selectedSessionId ?? get().selectedSessionId;
      if (!sessionId) {
        await get().createSession();
        sessionId = get().selectedSessionId;
        if (!sessionId) return;
      }

      // Add user message
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: text,
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
        timestamp: new Date().toISOString(),
        serverId: server.id,
        serverName: server.name,
      };

      set(s => ({
        chatMessages: [...s.chatMessages, userMessage],
        promptText: '',
        isStreaming: true,
        stopReason: null,
      }));

      // Persist user message & update session title  
      // Strip base64 from attachments to avoid overflowing AsyncStorage
      const stripBase64 = (msgs: ChatMessage[]): ChatMessage[] =>
        msgs.map(m => m.attachments
          ? { ...m, attachments: m.attachments.map(a => ({ ...a, base64: undefined })) }
          : m
        );
      const allMessages = [...state.chatMessages, userMessage];
      const sid = chatStorageId();
      if (sid && sessionId) {
        SessionStorage.saveMessages(stripBase64(allMessages), sid, sessionId);
        if (state.chatMessages.length === 0) {
          const title = text.substring(0, 50);
          const session = state.sessions.find(s => s.id === sessionId);
          if (session) {
            SessionStorage.saveSession(
              { ...session, title, updatedAt: new Date().toISOString() },
              sid,
            );
            set(s => ({
              sessions: s.sessions.map(sess =>
                sess.id === sessionId ? { ...sess, title } : sess
              ),
            }));
          }
        }
      }

      // ── AI Provider path ──
      const isAI = server.serverType === ServerType.AIProvider
        || (!server.serverType && !server.host);
      if (isAI && server.aiProviderConfig) {
        const config = server.aiProviderConfig;
        try {
          const secureKey = await getApiKey(`${server.id}_${config.providerType}`);
          const apiKey = secureKey || config.apiKey || null;
          if (!apiKey) {
            throw new Error('API key not found. Please configure your API key in server settings.');
          }
          startAIStream(config, apiKey, streamCtx);
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

      // ── ACP path ──
      if (!_service) {
        const errMsg: ChatMessage = {
          id: uuidv4(),
          role: 'system',
          content: '⚠️ Not connected to server. Please reconnect.',
          timestamp: new Date().toISOString(),
        };
        set(s => ({ chatMessages: [...s.chatMessages, errMsg], isStreaming: false }));
        return;
      }

      try {
        get().appendLog(`→ session/prompt: ${text.substring(0, 80)}`);
        const response = await _service.sendPrompt({
          sessionId: sessionId,
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
            set({
              chatMessages: updatedMessages,
              isStreaming: false,
              streamingMessageId: null,
              stopReason: stopReason ?? null,
            });
          } else {
            set({ isStreaming: false, streamingMessageId: null, stopReason: stopReason ?? null });
          }
        } else if (stopReason) {
          set({ isStreaming: false, stopReason });
        }
        // Persist final message state
        _persistMessages();
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

      if (_aiAbortController) {
        _aiAbortController.abort();
        setAiAbortController(null);
        set({ isStreaming: false });
        return;
      }

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

    editMessage: async (id, newContent) => {
      const state = get();
      const idx = state.chatMessages.findIndex(m => m.id === id);
      if (idx === -1) return;

      const message = state.chatMessages[idx];

      if (message.role === 'user') {
        // User edit: truncate messages after this one, update content, re-trigger AI
        const editedMessage: ChatMessage = {
          ...message,
          content: newContent,
          timestamp: new Date().toISOString(),
        };
        const truncated = [...state.chatMessages.slice(0, idx), editedMessage];
        set({ chatMessages: truncated, isStreaming: false, streamingMessageId: null, stopReason: null });
        _persistMessages();

        const provider = await _resolveAIProvider();
        if (provider) {
          set({ isStreaming: true, stopReason: null });
          startAIStream(provider.config, provider.apiKey, streamCtx);
        }
      } else if (message.role === 'assistant') {
        // Assistant edit: update content in-place, context is updated for future messages
        const editedMessage: ChatMessage = {
          ...message,
          content: newContent,
          timestamp: new Date().toISOString(),
          segments: undefined, // clear tool call segments since content was manually edited
        };
        const updated = [...state.chatMessages];
        updated[idx] = editedMessage;
        set({ chatMessages: updated });
        _persistMessages();
      }
    },

    deleteMessage: (id) => {
      set(s => ({
        chatMessages: s.chatMessages.filter(m => m.id !== id),
      }));
      _persistMessages();
    },

    regenerateMessage: async (id) => {
      const state = get();
      const idx = state.chatMessages.findIndex(m => m.id === id);
      if (idx === -1 || state.chatMessages[idx].role !== 'assistant') return;

      // Remove the assistant message (keep everything before it)
      const truncated = state.chatMessages.slice(0, idx);

      set({ chatMessages: truncated, isStreaming: false, streamingMessageId: null, stopReason: null });
      _persistMessages();

      // Re-trigger AI response using the existing context
      const provider = await _resolveAIProvider();
      if (provider) {
        set({ isStreaming: true, stopReason: null });
        startAIStream(provider.config, provider.apiKey, streamCtx);
      }
    },
  };
};

