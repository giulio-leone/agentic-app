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
    zoomLevel: number;        // 0.0–1.0
    customPrompt: string;
    isWatcherProcessing: boolean;
    screenWatcherVisible: boolean;
}

export interface ScreenWatcherActions {
    setWatching: (on: boolean) => void;
    setWatcherStatus: (status: WatcherStatus) => void;
    incrementCapture: (uri?: string) => void;
    setAutoMode: (v: boolean) => void;
    setZoomLevel: (z: number) => void;
    setCustomPrompt: (p: string) => void;
    setWatcherProcessing: (on: boolean) => void;
    setScreenWatcherVisible: (v: boolean) => void;
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
    zoomLevel: 0.0,
    customPrompt: 'Analizza la domanda o il contenuto mostrato sullo schermo e fornisci una risposta dettagliata.',
    isWatcherProcessing: false,
    screenWatcherVisible: false,

    // Actions
    setWatching: (on) => set({ isWatching: on, captureCount: on ? 0 : 0 }),
    setWatcherStatus: (status) => set({ watcherStatus: status }),
    incrementCapture: (uri) =>
        set((s) => ({
            captureCount: s.captureCount + 1,
            lastCaptureUri: uri ?? s.lastCaptureUri,
        })),
    setAutoMode: (v) => set({ isAutoMode: v }),
    setZoomLevel: (z) => set({ zoomLevel: Math.max(0, Math.min(1, z)) }),
    setCustomPrompt: (p) => set({ customPrompt: p }),
    setWatcherProcessing: (on) => set({ isWatcherProcessing: on }),
    setScreenWatcherVisible: (v) => set({ screenWatcherVisible: v }),
});
