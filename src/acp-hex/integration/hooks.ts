import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAcpStore } from './useAcpStore';

// Connection state hook
export function useAcpConnection() {
  return useAcpStore(
    useShallow((s) => ({
      connectionState: s.connectionState,
      connectionError: s.connectionError,
      isConnected: s.connectionState === 'Connected',
      isConnecting: s.connectionState === 'Connecting' || s.connectionState === 'Reconnecting',
      connect: s.connect,
      disconnect: s.disconnect,
    }))
  );
}

// Chat messaging hook (unified for ACP + CLI)
export function useAcpChat() {
  return useAcpStore(
    useShallow((s) => ({
      messages: s.messages,
      isStreaming: s.isStreaming,
      selectedSessionId: s.selectedSessionId,
      sendPrompt: s.sendPrompt,
      cancelPrompt: s.cancelPrompt,
      selectSession: s.selectSession,
    }))
  );
}

// CLI sessions hook
export function useCliSessions() {
  const store = useAcpStore(
    useShallow((s) => ({
      cliSessions: s.cliSessions,
      isDiscoveringCli: s.isDiscoveringCli,
      isWatching: s.isWatching,
      discoverCliSessions: s.discoverCliSessions,
      startCliWatch: s.startCliWatch,
      stopCliWatch: s.stopCliWatch,
      spawnCliSession: s.spawnCliSession,
      killCliSession: s.killCliSession,
    }))
  );

  return store;
}

// Auto-discover CLI sessions on mount + start watching
export function useCliSessionsAutoWatch() {
  const { discoverCliSessions, startCliWatch, stopCliWatch, isWatching } = useCliSessions();

  useEffect(() => {
    discoverCliSessions();
    if (!isWatching) {
      startCliWatch();
    }
    return () => {
      // Don't stop watch on unmount — let it run
    };
  }, []);

  return useCliSessions();
}

// Send prompt with optimistic UI update
export function useSendPrompt() {
  const sendPrompt = useAcpStore((s) => s.sendPrompt);
  const selectedSessionId = useAcpStore((s) => s.selectedSessionId);
  const isStreaming = useAcpStore((s) => s.isStreaming);

  const send = useCallback(async (text: string, attachments?: unknown[]) => {
    if (!selectedSessionId || isStreaming) return;
    await sendPrompt(text, attachments);
  }, [selectedSessionId, isStreaming, sendPrompt]);

  return { send, canSend: !!selectedSessionId && !isStreaming };
}

// Terminal hook
export function useAcpTerminal() {
  return useAcpStore(
    useShallow((s) => ({
      spawnTerminal: s.spawnTerminal,
      sendTerminalInput: s.sendTerminalInput,
    }))
  );
}

// Connection state as a derived boolean set
export function useConnectionStatus() {
  const state = useAcpStore((s) => s.connectionState);
  return {
    state,
    isDisconnected: state === 'Disconnected',
    isConnecting: state === 'Connecting',
    isConnected: state === 'Connected',
    isReconnecting: state === 'Reconnecting',
    isCircuitOpen: state === 'CircuitOpen',
    isFailed: state === 'Failed',
  };
}
