/**
 * screenWatcherSlice — Zustand slice for the screen-watcher feature.
 */

import { StateCreator } from 'zustand';
import type { AppState, AppActions } from '../appStore';
import type { WatcherStatus } from '../../services/ScreenWatcherService';

export interface ScreenWatcherState {
    isWatching: boolean;
    watcherStatus: WatcherStatus;
    captureCount: number;
    lastCaptureUri: string | null;
    isAutoMode: boolean;
    zoomLevel: number;        // Optical multiplier (e.g. 0.6, 1.0, 3.0, 5.0)
    customPrompt: string;
    isRemoteLLMEnabled: boolean;
    localAIResponse: string | null;
    isWatcherProcessing: boolean;
    screenWatcherVisible: boolean;
    motionThreshold: number;
    stableThreshold: number;
}

export interface ScreenWatcherActions {
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
    setMotionThreshold: (v: number) => void;
    setStableThreshold: (v: number) => void;
}

export type ScreenWatcherSlice = ScreenWatcherState & ScreenWatcherActions;

export const createScreenWatcherSlice: StateCreator<
    AppState & AppActions,
    [],
    [],
    ScreenWatcherSlice
> = (set) => ({
    // State
    isWatching: false,
    watcherStatus: 'idle' as WatcherStatus,
    captureCount: 0,
    lastCaptureUri: null,
    isAutoMode: false,
    zoomLevel: 1.0,
    customPrompt: 'Analizza la domanda o il contenuto mostrato sullo schermo e fornisci una risposta dettagliata.',
    isRemoteLLMEnabled: false,
    localAIResponse: null,
    isWatcherProcessing: false,
    screenWatcherVisible: false,
    motionThreshold: 0.8,
    stableThreshold: 0.4,

    // Actions
    setWatching: (on) => set({ isWatching: on, captureCount: on ? 0 : 0 }),
    setWatcherStatus: (status) => set({ watcherStatus: status }),
    incrementCapture: (uri) =>
        set((s) => ({
            captureCount: s.captureCount + 1,
            lastCaptureUri: uri ?? s.lastCaptureUri,
        })),
    setAutoMode: (v) => set({ isAutoMode: v }),
    setZoomLevel: (z) => set({ zoomLevel: z }),
    setCustomPrompt: (p) => set({ customPrompt: p }),
    setRemoteLLMEnabled: (v) => set({ isRemoteLLMEnabled: v }),
    setLocalAIResponse: (text) => set({ localAIResponse: text }),
    setWatcherProcessing: (on) => set({ isWatcherProcessing: on }),
    setScreenWatcherVisible: (v) => set({ screenWatcherVisible: v }),
    setMotionThreshold: (v) => set({ motionThreshold: v }),
    setStableThreshold: (v) => set({ stableThreshold: v }),
});
