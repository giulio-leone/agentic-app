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
export const useAccentColor = () => useAppStore(s => s.accentColor);
export const useFontScale = () => useAppStore(s => s.fontScale);
export const useHapticsEnabled = () => useAppStore(s => s.hapticsEnabled);
export const useTerminalEngine = () => useAppStore(s => s.terminalEngine);

// ── Settings selectors ───────────────────────────────────────────────────────

export const useDevMode = () => useAppStore(s => s.devModeEnabled);
export const useDeveloperLogs = () => useAppStore(s => s.developerLogs);
export const useYoloMode = () => useAppStore(s => s.yoloModeEnabled);
export const useAutoStartVisionDetect = () => useAppStore(s => s.autoStartVisionDetect);

// ── Screen Watcher selectors ─────────────────────────────────────────────────

export const useScreenWatcherVisible = () => useAppStore(s => s.screenWatcherVisible);
export const useIsWatching = () => useAppStore(s => s.isWatching);
export const useWatcherStatus = () => useAppStore(s => s.watcherStatus);
export const useCaptureCount = () => useAppStore(s => s.captureCount);
export const useIsAutoMode = () => useAppStore(s => s.isAutoMode);
export const useZoomLevel = () => useAppStore(s => s.zoomLevel);
export const useCustomPrompt = () => useAppStore(s => s.customPrompt);
export const useIsRemoteLLMEnabled = () => useAppStore(s => s.isRemoteLLMEnabled);
export const useMotionThreshold = () => useAppStore(s => s.motionThreshold);
export const useStableThreshold = () => useAppStore(s => s.stableThreshold);

export const useScreenWatcherActions = () => useAppStore(useShallow(s => ({
  setScreenWatcherVisible: s.setScreenWatcherVisible,
  setWatching: s.setWatching,
  setWatcherStatus: s.setWatcherStatus,
  incrementCapture: s.incrementCapture,
  setAutoMode: s.setAutoMode,
  setZoomLevel: s.setZoomLevel,
  setCustomPrompt: s.setCustomPrompt,
  setRemoteLLMEnabled: s.setRemoteLLMEnabled,
  setWatcherProcessing: s.setWatcherProcessing,
  setMotionThreshold: s.setMotionThreshold,
  setStableThreshold: s.setStableThreshold,
})));

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
  setFontScale: s.setFontScale,
  setHapticsEnabled: s.setHapticsEnabled,
  clearAppCache: s.clearAppCache,
  setTerminalEngine: s.setTerminalEngine,
  appendLog: s.appendLog,
  clearLogs: s.clearLogs,
})));
