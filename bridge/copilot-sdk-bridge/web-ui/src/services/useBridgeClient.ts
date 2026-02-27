import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { BridgeClient } from './BridgeClient';
import type { ConnectionState, ConsoleLogEntry } from './types';

// ── External store adapters for useSyncExternalStore ─────────────────────────

function subscribeToState(callback: () => void): () => void {
  return BridgeClient.getInstance().onConnectionStateChange(callback);
}

function getStateSnapshot(): ConnectionState {
  return BridgeClient.getInstance().connectionState;
}

function subscribeToLog(callback: () => void): () => void {
  return BridgeClient.getInstance().onConsoleLogChange(callback);
}

function getLogSnapshot(): ReadonlyArray<ConsoleLogEntry> {
  return BridgeClient.getInstance().consoleLog;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBridgeClient() {
  const clientRef = useRef(BridgeClient.getInstance());
  const client = clientRef.current;

  const connectionState = useSyncExternalStore(subscribeToState, getStateSnapshot);
  const consoleLog = useSyncExternalStore(subscribeToLog, getLogSnapshot);

  const connect = useCallback((url: string) => {
    client.connect(url);
  }, [client]);

  const disconnect = useCallback(() => {
    client.disconnect();
  }, [client]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't disconnect the singleton on unmount — other components may use it
    };
  }, []);

  return { client, connectionState, consoleLog, connect, disconnect };
}
