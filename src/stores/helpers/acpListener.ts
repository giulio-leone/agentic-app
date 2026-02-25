/**
 * createACPListener — Factory for the ACPService event listener.
 * Handles state changes (with auto-retry), notifications, messages, and errors.
 */
import type { AppState, AppActions } from '../appStore';
import { ACPConnectionState } from '../../acp-hex/domain/types';
/** Inline listener interface — replaces old ACPService import for hex migration. */
interface ACPServiceListener {
  onStateChange?: (state: ACPConnectionState) => void;
  onNotification?: (method: string, params: Record<string, unknown>) => void;
  onMessage?: (message: unknown) => void;
  onError?: (error: Error) => void;
}
import { parseSessionUpdate, applySessionUpdate } from '../../acp-hex/application/services/SessionUpdateHandler';
type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };
import { SessionStorage } from '../../storage/SessionStorage';
import { showErrorToast, showInfoToast } from '../../utils/toast';
import { isAppInBackground, notifyResponseComplete, setBadgeCount } from '../../services/notifications';
import { _service } from '../storePrivate';
import { terminalEvents } from '../../acp-hex/infrastructure/terminalEvents';

// Retry state (module-level to avoid store bloat)
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500;
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export function clearRetry() {
  retryCount = 0;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
}

type StoreGet = () => AppState & AppActions;
type StoreSet = (partial: Partial<AppState>) => void;

export function createACPListener(get: StoreGet, set: StoreSet): ACPServiceListener {
  return {
    onStateChange: (newState) => {
      set({ connectionState: newState });
      if (newState === ACPConnectionState.Connected) {
        set({ connectionError: null });
        clearRetry();
        get().initialize();
      }
      if (newState === ACPConnectionState.Disconnected || newState === ACPConnectionState.Failed) {
        set({ isInitialized: false });
        if (newState === ACPConnectionState.Failed && retryCount < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
          retryCount++;
          get().appendLog(`Retry ${retryCount}/${MAX_RETRIES} in ${delay}ms…`);
          showInfoToast('Reconnecting…', `Attempt ${retryCount}/${MAX_RETRIES}`);
          if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
          retryTimer = setTimeout(() => {
            if (_service && get().connectionState === ACPConnectionState.Failed) {
              _service.connect();
            }
          }, delay);
        } else if (newState === ACPConnectionState.Failed && retryCount >= MAX_RETRIES) {
          showErrorToast('Connection Failed', 'Max retries reached. Tap server to reconnect.');
          clearRetry();
        }
      }
    },
    onNotification: (method, params) => {
      get().appendLog(`← notification: ${method}`);
      if (method === 'session/update' || method === 'notifications/session/update') {
        const actions = parseSessionUpdate(params as JSONValue);
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

        // Notify when streaming completes and app is backgrounded
        if (stopReason && state.streamingMessageId && !streamingMessageId && isAppInBackground()) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg?.role === 'assistant' && lastMsg.content) {
            notifyResponseComplete(lastMsg.content);
            setBadgeCount(1);
          }
        }

        if (state.selectedServerId && state.selectedSessionId) {
          SessionStorage.saveMessages(messages, state.selectedServerId, state.selectedSessionId)
            .catch(e => state.appendLog?.(`✗ Save messages failed: ${e.message}`));
        }
      }

      // Terminal notifications
      if (method === 'terminal/data') {
        const p = params as Record<string, unknown> | undefined;
        if (p?.id && p?.data) terminalEvents.emitData(p.id as string, p.data as string);
      }
      if (method === 'terminal/exit') {
        const p = params as Record<string, unknown> | undefined;
        if (p?.id !== undefined) terminalEvents.emitExit(p.id as string, (p.code as number) ?? 0);
      }

      // Copilot PTY output/exit notifications
      if (method === 'copilot/pty/output') {
        const p = params as Record<string, unknown> | undefined;
        if (p?.sessionId && typeof p.data === 'string') {
          const state = get();
          const ptyId = p.sessionId as string;
          // Append PTY output as assistant message (streaming)
          if (state.activePtySessionId === ptyId || state.selectedSessionId?.endsWith(ptyId)) {
            const newMsgs = [...state.chatMessages];
            const lastMsg = newMsgs[newMsgs.length - 1];
            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === `pty-stream-${ptyId}`) {
              const updated = { ...lastMsg, content: lastMsg.content + p.data };
              newMsgs[newMsgs.length - 1] = updated;
              set({ chatMessages: newMsgs });
            } else {
              newMsgs.push({
                id: `pty-stream-${ptyId}`,
                role: 'assistant',
                content: p.data as string,
                timestamp: new Date().toISOString(),
              });
              set({ chatMessages: newMsgs });
            }
          }
        }
      }
      if (method === 'copilot/pty/exit') {
        const p = params as Record<string, unknown> | undefined;
        if (p?.sessionId) {
          const ptyId = p.sessionId as string;
          get().appendLog(`Copilot PTY exited: ${ptyId} (code ${p.exitCode ?? 'unknown'})`);
          if (get().activePtySessionId === ptyId) {
            set({ activePtySessionId: null, ptyOwnerCliSessionId: null });
          }
        }
      }

      // Copilot CLI session delta notifications
      if (method === 'copilot/delta') {
        const delta = params as Record<string, unknown> | undefined;
        if (delta?.type === 'new_turn' && delta.turn) {
          const turn = delta.turn as {
            sessionId: string;
            turnIndex: number;
            userMessage: string | null;
            assistantResponse: string | null;
            timestamp: string;
          };
          const state = get();
          // If viewing this CLI session, append messages
          if (state.selectedSessionId === `cli:${turn.sessionId}`) {
            const newMsgs = [...state.chatMessages];
            if (turn.userMessage) {
              newMsgs.push({
                id: `cli-${turn.sessionId}-user-${turn.turnIndex}`,
                role: 'user',
                content: turn.userMessage,
                timestamp: turn.timestamp,
              });
            }
            if (turn.assistantResponse) {
              newMsgs.push({
                id: `cli-${turn.sessionId}-assistant-${turn.turnIndex}`,
                role: 'assistant',
                content: turn.assistantResponse,
                timestamp: turn.timestamp,
              });
            }
            set({ chatMessages: newMsgs });
          }
          // Refresh CLI sessions list
          get().discoverCliSessions();
        } else if (delta?.type === 'session_updated' || delta?.type === 'new_session') {
          get().discoverCliSessions();
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
}
