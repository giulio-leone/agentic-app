/**
 * ScreenWatcherService — Gemini Nano Image Description change detection.
 *
 * Flow per tick:
 * 1. Capture frame → base64
 * 2. Gemini Nano Image Description → text description
 * 3. Compare description with previous using word-level Jaccard similarity
 * 4. If DIFFERENT × CONFIRM_COUNT → change confirmed
 */

import { ImageDiffEngine } from './ImageDiffEngine';
import type { CaptureResult } from '../components/camera/SmartCameraView';

export type WatcherStatus =
    | 'idle'
    | 'loading_model'
    | 'watching'
    | 'change_detected'
    | 'stabilizing'
    | 'processing';

export interface WatcherCallbacks {
    captureFrame: () => Promise<CaptureResult | null>;
    onScreenChanged: (base64: string, captureNumber: number) => void;
    onStatusChange: (status: WatcherStatus) => void;
}

const POLL_INTERVAL_MS = 3_000;   // 3s to account for on-device inference
const CONFIRM_COUNT = 2;

const DEBUG = __DEV__;

export class ScreenWatcherService {
    private _status: WatcherStatus = 'idle';
    private _pollTimer: ReturnType<typeof setInterval> | null = null;
    private _prevDesc: string | null = null;
    private _captureCount = 0;
    private _frameCount = 0;
    private _consecutiveChanges = 0;
    private _cb: WatcherCallbacks | null = null;
    private _stopped = false;
    private _ticking = false;

    get status(): WatcherStatus { return this._status; }
    get captureCount(): number { return this._captureCount; }

    async start(callbacks: WatcherCallbacks): Promise<void> {
        if (this._status !== 'idle') return;
        this._cb = callbacks;
        this._stopped = false;
        this._prevDesc = null;
        this._captureCount = 0;
        this._frameCount = 0;
        this._consecutiveChanges = 0;
        this._ticking = false;

        // Load Gemini Nano Image Description
        this._setStatus('loading_model');
        try {
            await ImageDiffEngine.ensureModel();
        } catch (err) {
            console.error('[SW] ❌ Gemini Nano init failed:', err);
            this._setStatus('idle');
            return;
        }

        this._setStatus('watching');
        // Disable the legacy polling loop since we use Native Pixel Diffing
        // this._pollTimer = setInterval(() => this._tick(), POLL_INTERVAL_MS);
        DEBUG && console.log(`[SW] Started — Native Pixel Diffing detection initialized`);
    }

    stop(): void {
        this._stopped = true;
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
        this._prevDesc = null;
        this._consecutiveChanges = 0;
        this._ticking = false;
        this._setStatus('idle');
    }

    processingComplete(): void {
        if (this._status === 'processing') {
            this._consecutiveChanges = 0;
            this._prevDesc = null;
            this._setStatus('watching');
            DEBUG && console.log('[SW] Processing complete → watching');
        }
    }

    private _setStatus(s: WatcherStatus): void {
        this._status = s;
        this._cb?.onStatusChange(s);
    }

    private async _tick(): Promise<void> {
        if (this._status !== 'watching' || this._stopped || this._ticking) return;
        this._ticking = true;

        try {
            const capture = await this._cb?.captureFrame();
            if (!capture?.base64 || this._stopped) return;

            this._frameCount++;

            // Step 1: Extract text from current frame
            const desc = await ImageDiffEngine.extractTextFromFrame(capture.base64);

            // First frame: store text as baseline
            if (!this._prevDesc) {
                this._prevDesc = desc;
                DEBUG && console.log(`[SW] #${this._frameCount} baseline: "${desc.substring(0, 60)}..."`);
                return;
            }

            // Step 2: Compare descriptions
            const changed = ImageDiffEngine.descriptionsAreDifferent(this._prevDesc, desc);

            if (changed) {
                this._consecutiveChanges++;
                DEBUG && console.log(
                    `[SW] #${this._frameCount} DIFFERENT` +
                    ` (${this._consecutiveChanges}/${CONFIRM_COUNT})`
                );

                if (this._consecutiveChanges >= CONFIRM_COUNT) {
                    DEBUG && console.log(`[SW] ✅ CONFIRMED change — capture #${this._captureCount + 1}`);
                    this._captureCount++;
                    this._prevDesc = desc;
                    this._consecutiveChanges = 0;
                }
            } else {
                if (this._consecutiveChanges > 0) {
                    DEBUG && console.log(
                        `[SW] #${this._frameCount} SAME — false alarm reset (was ${this._consecutiveChanges})`
                    );
                } else {
                    DEBUG && console.log(`[SW] #${this._frameCount} SAME ✓`);
                }
                this._consecutiveChanges = 0;
                this._prevDesc = desc;
            }
        } catch (err) {
            console.warn('[SW] tick error:', err);
        } finally {
            this._ticking = false;
        }
    }
}
