import { StateCreator } from 'zustand';
import type { AppState, AppActions } from '../appStore';

export type SettingsSlice = Pick<AppState, 'devModeEnabled' | 'developerLogs'>
  & Pick<AppActions, 'toggleDevMode' | 'appendLog' | 'clearLogs'>;

export const createSettingsSlice: StateCreator<AppState & AppActions, [], [], SettingsSlice> = (set, get) => ({
  // State
  devModeEnabled: false,
  developerLogs: [],

  // Actions

  toggleDevMode: () => {
    set(s => ({ devModeEnabled: !s.devModeEnabled }));
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
