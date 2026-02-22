import { StateCreator } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState, AppActions } from '../appStore';
import { DEFAULT_CONSENSUS_CONFIG, type ConsensusConfig } from '../../ai/types';

const CONSENSUS_CONFIG_KEY = '@agentic/consensusConfig';

export type SettingsSlice = Pick<AppState, 'devModeEnabled' | 'developerLogs' | 'agentModeEnabled' | 'consensusModeEnabled' | 'consensusConfig' | 'yoloModeEnabled' | 'autoStartVisionDetect'>
  & Pick<AppActions, 'toggleDevMode' | 'appendLog' | 'clearLogs' | 'toggleAgentMode' | 'toggleConsensusMode' | 'updateConsensusConfig' | 'toggleYoloMode' | 'toggleAutoStartVisionDetect'>;

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

  return {
  // State
  devModeEnabled: false,
  developerLogs: [],
  agentModeEnabled: false,
  consensusModeEnabled: false,
  consensusConfig: DEFAULT_CONSENSUS_CONFIG,
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

  updateConsensusConfig: (partial) => {
    set(s => {
      const updated = { ...s.consensusConfig, ...partial };
      AsyncStorage.setItem(CONSENSUS_CONFIG_KEY, JSON.stringify(updated)).catch(() => {});
      return { consensusConfig: updated };
    });
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
  };
};
