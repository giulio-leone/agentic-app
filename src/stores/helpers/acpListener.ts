/**
 * createACPListener — Factory for the ACPService event listener.
 * Handles state changes (with auto-retry), notifications, messages, and errors.
 */
import type { AppState, AppActions } from '../appStore';
import { ACPConnectionState } from '../../acp/models/types';
import { ACPServiceListener } from '../../acp/ACPService';
import { parseSessionUpdate, applySessionUpdate } from '../../acp/SessionUpdateHandler';
import { JSONValue } from '../../acp/models';
import { SessionStorage } from '../../storage/SessionStorage';
import { showErrorToast, showInfoToast } from '../../utils/toast';
import { _service } from '../storePrivate';

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
}
