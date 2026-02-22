import { StateCreator } from 'zustand';
import type { AppState, AppActions } from '../appStore';
import { DEFAULT_CONSENSUS_CONFIG, type ConsensusConfig } from '../../ai/types';

export type SettingsSlice = Pick<AppState, 'devModeEnabled' | 'developerLogs' | 'agentModeEnabled' | 'consensusModeEnabled' | 'consensusConfig' | 'yoloModeEnabled' | 'autoStartVisionDetect'>
  & Pick<AppActions, 'toggleDevMode' | 'appendLog' | 'clearLogs' | 'toggleAgentMode' | 'toggleConsensusMode' | 'updateConsensusConfig' | 'toggleYoloMode' | 'toggleAutoStartVisionDetect'>;

export const createSettingsSlice: StateCreator<AppState & AppActions, [], [], SettingsSlice> = (set, get) => ({
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
    set(s => ({ consensusConfig: { ...s.consensusConfig, ...partial } }));
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
