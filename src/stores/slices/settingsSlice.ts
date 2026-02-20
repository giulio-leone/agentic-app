import { StateCreator } from 'zustand';
import type { AppState, AppActions } from '../appStore';

export type SettingsSlice = Pick<AppState, 'devModeEnabled' | 'developerLogs' | 'agentModeEnabled'>
  & Pick<AppActions, 'toggleDevMode' | 'appendLog' | 'clearLogs' | 'toggleAgentMode'>;

export const createSettingsSlice: StateCreator<AppState & AppActions, [], [], SettingsSlice> = (set, get) => ({
  // State
  devModeEnabled: false,
  developerLogs: [],
  agentModeEnabled: false,

  // Actions

  toggleDevMode: () => {
    set(s => ({ devModeEnabled: !s.devModeEnabled }));
  },

  toggleAgentMode: () => {
    set(s => ({ agentModeEnabled: !s.agentModeEnabled }));
  },

  appendLog: (log) => {
    const timestamp = new Date().toLocaleTimeString();
    set(s => ({
      developerLogs: [...s.developerLogs.slice(-499), `[${timestamp}] ${log}`],
    }));
  },

  clearLogs: () => {
    set({ developerLogs: [] });
  },
});
