import { StateCreator } from 'zustand';
import type { AppState, AppActions } from '../appStore';

export type SettingsSlice = Pick<AppState, 'devModeEnabled' | 'developerLogs' | 'agentModeEnabled' | 'consensusModeEnabled' | 'yoloModeEnabled' | 'autoStartVisionDetect'>
  & Pick<AppActions, 'toggleDevMode' | 'appendLog' | 'clearLogs' | 'toggleAgentMode' | 'toggleConsensusMode' | 'toggleYoloMode' | 'toggleAutoStartVisionDetect'>;

export const createSettingsSlice: StateCreator<AppState & AppActions, [], [], SettingsSlice> = (set, get) => ({
  // State
  devModeEnabled: false,
  developerLogs: [],
  agentModeEnabled: false,
  consensusModeEnabled: false,
  yoloModeEnabled: true,
  autoStartVisionDetect: false,

  // Actions

  toggleDevMode: () => {
    set(s => ({ devModeEnabled: !s.devModeEnabled }));
  },

  toggleAgentMode: () => {
    set(s => ({ agentModeEnabled: !s.agentModeEnabled }));
  },

  toggleConsensusMode: () => {
    set(s => ({ consensusModeEnabled: !s.consensusModeEnabled }));
  },

  toggleYoloMode: () => {
    set(s => ({ yoloModeEnabled: !s.yoloModeEnabled }));
  },

  toggleAutoStartVisionDetect: () => {
    set(s => ({ autoStartVisionDetect: !s.autoStartVisionDetect }));
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
