/**
 * Main application store – combines domain slices.
 * Each slice lives in ./slices/ and owns its own state + actions.
 */

import { create } from 'zustand';
import {
  ACPConnectionState,
  ACPServerConfiguration,
  AgentProfile,
  ChatMessage,
  SessionSummary,
} from '../acp/models/types';
import { ACPService } from '../acp/ACPService';
import type { MCPServerConfig, MCPServerStatus } from '../mcp/types';

import { createServerSlice } from './slices/serverSlice';
import { createSessionSlice } from './slices/sessionSlice';
import { createChatSlice } from './slices/chatSlice';
import { createMCPSlice } from './slices/mcpSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createScreenWatcherSlice } from './slices/screenWatcherSlice';
import type { WatcherStatus } from '../services/ScreenWatcherService';

// ─── Store State ───

export interface AppState {
  // Servers
  servers: ACPServerConfiguration[];
  selectedServerId: string | null;

  // Connection
  connectionState: ACPConnectionState;
  isInitialized: boolean;
  agentInfo: AgentProfile | null;
  connectionError: string | null;

  // Sessions
  sessions: SessionSummary[];
  selectedSessionId: string | null;
  chatMessages: ChatMessage[];
  streamingMessageId: string | null;
  stopReason: string | null;
  isStreaming: boolean;
  promptText: string;

  // MCP Servers
  mcpServers: MCPServerConfig[];
  mcpStatuses: MCPServerStatus[];

  // Settings
  devModeEnabled: boolean;
  developerLogs: string[];
  agentModeEnabled: boolean;
  consensusModeEnabled: boolean;
  consensusConfig: import('../ai/types').ConsensusConfig;
  yoloModeEnabled: boolean;
  autoStartVisionDetect: boolean;
  themeMode: 'system' | 'light' | 'dark' | 'amoled';
  accentColor: import('../utils/theme').AccentColorKey;
  fontScale: number; // 0.8 to 1.4
  hapticsEnabled: boolean;
  terminalEngine: 'xterm' | 'ghostty';

  // Screen Watcher
  isWatching: boolean;
  watcherStatus: WatcherStatus;
  captureCount: number;
  lastCaptureUri: string | null;
  isAutoMode: boolean;
  zoomLevel: number;
  customPrompt: string;
  isRemoteLLMEnabled: boolean;
  localAIResponse: string | null;
  isWatcherProcessing: boolean;
  screenWatcherVisible: boolean;
  terminalVisible: boolean;
  chatSearchVisible: boolean;
  motionThreshold: number;
  stableThreshold: number;
  bookmarkedMessageIds: Set<string>;
}

// ─── Store Actions ───

export interface AppActions {
  // Server management
  loadServers: () => Promise<void>;
  addServer: (server: Omit<ACPServerConfiguration, 'id'>) => Promise<string>;
  updateServer: (server: ACPServerConfiguration) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  selectServer: (id: string | null) => void;

  // Connection
  connect: () => void;
  disconnect: () => void;
  initialize: () => Promise<void>;

  // Sessions
  loadSessions: () => Promise<void>;
  createSession: (cwd?: string) => Promise<void>;
  selectSession: (id: string) => void | Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  loadSessionMessages: (sessionId: string) => Promise<void>;

  // Chat
  sendPrompt: (text: string, attachments?: import('../acp/models/types').Attachment[]) => Promise<void>;
  cancelPrompt: () => Promise<void>;
  setPromptText: (text: string) => void;
  editMessage: (id: string, newContent: string) => Promise<void>;
  deleteMessage: (id: string) => void;
  regenerateMessage: (id: string) => Promise<void>;

  // MCP Servers
  loadMCPServers: () => Promise<void>;
  addMCPServer: (config: Omit<MCPServerConfig, 'id'>) => Promise<string>;
  removeMCPServer: (id: string) => Promise<void>;
  connectMCPServer: (id: string) => Promise<void>;
  disconnectMCPServer: (id: string) => Promise<void>;
  refreshMCPStatuses: () => void;

  // Settings
  toggleDevMode: () => void;
  toggleAgentMode: () => void;
  toggleConsensusMode: () => void;
  updateConsensusConfig: (config: Partial<import('../ai/types').ConsensusConfig>) => void;
  toggleYoloMode: () => void;
  toggleAutoStartVisionDetect: () => void;
  setThemeMode: (mode: 'system' | 'light' | 'dark' | 'amoled') => void;
  setAccentColor: (color: import('../utils/theme').AccentColorKey) => void;
  setFontScale: (scale: number) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  clearAppCache: () => Promise<void>;
  setTerminalEngine: (engine: 'xterm' | 'ghostty') => void;
  appendLog: (log: string) => void;
  clearLogs: () => void;

  // Screen Watcher
  setWatching: (on: boolean) => void;
  setWatcherStatus: (status: WatcherStatus) => void;
  incrementCapture: (uri?: string) => void;
  setAutoMode: (v: boolean) => void;
  setZoomLevel: (z: number) => void;
  setCustomPrompt: (p: string) => void;
  setRemoteLLMEnabled: (v: boolean) => void;
  setLocalAIResponse: (text: string | null) => void;
  setWatcherProcessing: (on: boolean) => void;
  setScreenWatcherVisible: (v: boolean) => void;
  setTerminalVisible: (v: boolean) => void;
  toggleChatSearch: () => void;
  setMotionThreshold: (v: number) => void;
  setStableThreshold: (v: number) => void;
  toggleBookmark: (messageId: string) => void;
  loadBookmarks: () => Promise<void>;

  // Internal
  _getService: () => ACPService | null;
}

// ─── Combined Store ───

export const useAppStore = create<AppState & AppActions>((...a) => ({
  ...createServerSlice(...a),
  ...createSessionSlice(...a),
  ...createChatSlice(...a),
  ...createMCPSlice(...a),
  ...createSettingsSlice(...a),
  ...createScreenWatcherSlice(...a),
}));
