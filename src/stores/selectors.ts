/**
 * Zustand selectors — granular subscriptions to prevent unnecessary re-renders.
 * Use these instead of destructuring the entire store.
 */

import { useAppStore } from './appStore';
import { useShallow } from 'zustand/shallow';

// ── Server selectors ─────────────────────────────────────────────────────────

export const useServers = () => useAppStore(s => s.servers);
export const useSelectedServerId = () => useAppStore(s => s.selectedServerId);
export const useSelectedServer = () => useAppStore(s => s.servers.find(sv => sv.id === s.selectedServerId) ?? null);
export const useConnectionState = () => useAppStore(s => s.connectionState);
export const useIsInitialized = () => useAppStore(s => s.isInitialized);
export const useAgentInfo = () => useAppStore(s => s.agentInfo);
export const useConnectionError = () => useAppStore(s => s.connectionError);

// ── Session selectors ────────────────────────────────────────────────────────

export const useSessions = () => useAppStore(s => s.sessions);
export const useSelectedSessionId = () => useAppStore(s => s.selectedSessionId);
export const useChatMessages = () => useAppStore(s => s.chatMessages);
export const useIsStreaming = () => useAppStore(s => s.isStreaming);
export const usePromptText = () => useAppStore(s => s.promptText);

// ── MCP selectors ────────────────────────────────────────────────────────────

export const useMCPServers = () => useAppStore(s => s.mcpServers);
export const useMCPStatuses = () => useAppStore(s => s.mcpStatuses);

// ── Settings selectors ───────────────────────────────────────────────────────

export const useDevMode = () => useAppStore(s => s.devModeEnabled);
export const useDeveloperLogs = () => useAppStore(s => s.developerLogs);

// ── Action selectors (stable references) ─────────────────────────────────────

export const useServerActions = () => useAppStore(useShallow(s => ({
  loadServers: s.loadServers,
  addServer: s.addServer,
  updateServer: s.updateServer,
  deleteServer: s.deleteServer,
  selectServer: s.selectServer,
  connect: s.connect,
  disconnect: s.disconnect,
  initialize: s.initialize,
})));

export const useSessionActions = () => useAppStore(useShallow(s => ({
  loadSessions: s.loadSessions,
  createSession: s.createSession,
  selectSession: s.selectSession,
  deleteSession: s.deleteSession,
  loadSessionMessages: s.loadSessionMessages,
  sendPrompt: s.sendPrompt,
  cancelPrompt: s.cancelPrompt,
  setPromptText: s.setPromptText,
})));

export const useMCPActions = () => useAppStore(useShallow(s => ({
  loadMCPServers: s.loadMCPServers,
  addMCPServer: s.addMCPServer,
  removeMCPServer: s.removeMCPServer,
  connectMCPServer: s.connectMCPServer,
  disconnectMCPServer: s.disconnectMCPServer,
  refreshMCPStatuses: s.refreshMCPStatuses,
})));

export const useSettingsActions = () => useAppStore(useShallow(s => ({
  toggleDevMode: s.toggleDevMode,
  appendLog: s.appendLog,
  clearLogs: s.clearLogs,
})));
