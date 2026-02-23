import { StateCreator } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState, AppActions } from '../appStore';
import { DEFAULT_CONSENSUS_CONFIG, type ConsensusConfig } from '../../ai/types';

const CONSENSUS_CONFIG_KEY = '@agentic/consensusConfig';
const THEME_MODE_KEY = '@agentic/themeMode';

export type SettingsSlice = Pick<AppState, 'devModeEnabled' | 'developerLogs' | 'agentModeEnabled' | 'consensusModeEnabled' | 'consensusConfig' | 'yoloModeEnabled' | 'autoStartVisionDetect' | 'themeMode' | 'accentColor' | 'fontScale' | 'hapticsEnabled' | 'terminalEngine'>
  & Pick<AppActions, 'toggleDevMode' | 'appendLog' | 'clearLogs' | 'toggleAgentMode' | 'toggleConsensusMode' | 'updateConsensusConfig' | 'toggleYoloMode' | 'toggleAutoStartVisionDetect' | 'setThemeMode' | 'setAccentColor' | 'setFontScale' | 'setHapticsEnabled' | 'clearAppCache' | 'setTerminalEngine'>;

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
    if (raw === 'light' || raw === 'dark' || raw === 'system' || raw === 'amoled') set({ themeMode: raw });
  });

  // Hydrate accent color
  const ACCENT_KEY = '@agentic/accentColor';
  AsyncStorage.getItem(ACCENT_KEY).then(raw => {
    if (raw) set({ accentColor: raw as import('../../utils/theme').AccentColorKey });
  });

  // Hydrate font scale
  AsyncStorage.getItem('@agentic/fontScale').then(raw => {
    if (raw) { const n = parseFloat(raw); if (n >= 0.8 && n <= 1.4) set({ fontScale: n }); }
  });

  // Hydrate haptics
  AsyncStorage.getItem('@agentic/hapticsEnabled').then(raw => {
    if (raw !== null) set({ hapticsEnabled: raw === 'true' });
  });

  // Hydrate terminal engine
  AsyncStorage.getItem('@agentic/terminalEngine').then(raw => {
    if (raw === 'xterm' || raw === 'ghostty') set({ terminalEngine: raw });
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
  themeMode: 'system' as 'system' | 'light' | 'dark' | 'amoled',
  accentColor: 'green' as import('../../utils/theme').AccentColorKey,
  fontScale: 1.0,
  hapticsEnabled: true,
  terminalEngine: 'xterm' as 'xterm' | 'ghostty',

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

  setAccentColor: (color) => {
    set({ accentColor: color });
    AsyncStorage.setItem('@agentic/accentColor', color).catch(e => console.warn('[AsyncStorage] Save accent failed:', e));
  },

  setFontScale: (scale) => {
    const clamped = Math.max(0.8, Math.min(1.4, scale));
    set({ fontScale: clamped });
    AsyncStorage.setItem('@agentic/fontScale', String(clamped)).catch(e => console.warn('[AsyncStorage] Save fontScale failed:', e));
  },

  setHapticsEnabled: (enabled) => {
    set({ hapticsEnabled: enabled });
    AsyncStorage.setItem('@agentic/hapticsEnabled', String(enabled)).catch(e => console.warn('[AsyncStorage] Save haptics failed:', e));
  },

  clearAppCache: async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith('@agentic/session/') || k.startsWith('@agentic/messages/'));
      if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
    } catch (e) {
      console.warn('[AsyncStorage] Clear cache failed:', e);
    }
  },

  setTerminalEngine: (engine) => {
    set({ terminalEngine: engine });
    AsyncStorage.setItem('@agentic/terminalEngine', engine).catch(e => console.warn('[AsyncStorage] Save terminalEngine failed:', e));
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
