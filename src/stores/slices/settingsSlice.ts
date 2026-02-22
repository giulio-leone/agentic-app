import { StateCreator } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState, AppActions } from '../appStore';
import { DEFAULT_CONSENSUS_CONFIG, type ConsensusConfig } from '../../ai/types';

const CONSENSUS_CONFIG_KEY = '@agentic/consensusConfig';
const THEME_MODE_KEY = '@agentic/themeMode';

export type SettingsSlice = Pick<AppState, 'devModeEnabled' | 'developerLogs' | 'agentModeEnabled' | 'consensusModeEnabled' | 'consensusConfig' | 'yoloModeEnabled' | 'autoStartVisionDetect' | 'themeMode'>
  & Pick<AppActions, 'toggleDevMode' | 'appendLog' | 'clearLogs' | 'toggleAgentMode' | 'toggleConsensusMode' | 'updateConsensusConfig' | 'toggleYoloMode' | 'toggleAutoStartVisionDetect' | 'setThemeMode'>;

export const createSettingsSlice: StateCreator<AppState & AppActions, [], [], SettingsSlice> = (set, get) => {
  // Hydrate consensus config from AsyncStorage on slice creation
  AsyncStorage.getItem(CONSENSUS_CONFIG_KEY).then(raw => {
    if (raw) {
      try {
        const saved = JSON.parse(raw) as ConsensusConfig;
        if (saved.agents?.length >= 2) set({ consensusConfig: saved });
      } catch { /* ignore corrupt data */ }
    }
  });

  // Hydrate theme mode
  AsyncStorage.getItem(THEME_MODE_KEY).then(raw => {
    if (raw === 'light' || raw === 'dark' || raw === 'system') set({ themeMode: raw });
  });

  return {
  // State
  devModeEnabled: false,
  developerLogs: [],
  agentModeEnabled: false,
  consensusModeEnabled: false,
  consensusConfig: DEFAULT_CONSENSUS_CONFIG,
  yoloModeEnabled: true,
  autoStartVisionDetect: false,
  themeMode: 'system' as 'system' | 'light' | 'dark',

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

  updateConsensusConfig: (partial) => {
    set(s => {
      const updated = { ...s.consensusConfig, ...partial };
      AsyncStorage.setItem(CONSENSUS_CONFIG_KEY, JSON.stringify(updated)).catch(e => console.warn('[AsyncStorage] Save consensus config failed:', e));
      return { consensusConfig: updated };
    });
  },

  toggleYoloMode: () => {
    set(s => ({ yoloModeEnabled: !s.yoloModeEnabled }));
  },

  toggleAutoStartVisionDetect: () => {
    set(s => ({ autoStartVisionDetect: !s.autoStartVisionDetect }));
  },

  setThemeMode: (mode) => {
    set({ themeMode: mode });
    AsyncStorage.setItem(THEME_MODE_KEY, mode).catch(e => console.warn('[AsyncStorage] Save theme failed:', e));
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
  };
};
