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
export const useStopReason = () => useAppStore(s => s.stopReason);
export const useBookmarkedMessageIds = () => useAppStore(s => s.bookmarkedMessageIds);

// ── MCP selectors ────────────────────────────────────────────────────────────

export const useMCPServers = () => useAppStore(s => s.mcpServers);
export const useMCPStatuses = () => useAppStore(s => s.mcpStatuses);

// ── UI selectors ─────────────────────────────────────────────────────────────

export const useChatSearchVisible = () => useAppStore(s => s.chatSearchVisible);
export const useThemeMode = () => useAppStore(s => s.themeMode);

// ── Settings selectors ───────────────────────────────────────────────────────

export const useDevMode = () => useAppStore(s => s.devModeEnabled);
export const useDeveloperLogs = () => useAppStore(s => s.developerLogs);
export const useYoloMode = () => useAppStore(s => s.yoloModeEnabled);
export const useAutoStartVisionDetect = () => useAppStore(s => s.autoStartVisionDetect);

// ── Action selectors (stable references via useShallow) ──────────────────────

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

export const useChatActions = () => useAppStore(useShallow(s => ({
  editMessage: s.editMessage,
  deleteMessage: s.deleteMessage,
  regenerateMessage: s.regenerateMessage,
  toggleBookmark: s.toggleBookmark,
  loadBookmarks: s.loadBookmarks,
  toggleChatSearch: s.toggleChatSearch,
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
  toggleAgentMode: s.toggleAgentMode,
  toggleYoloMode: s.toggleYoloMode,
  toggleAutoStartVisionDetect: s.toggleAutoStartVisionDetect,
  setThemeMode: s.setThemeMode,
  setAccentColor: s.setAccentColor,
  appendLog: s.appendLog,
  clearLogs: s.clearLogs,
})));
