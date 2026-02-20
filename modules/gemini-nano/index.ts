import { requireNativeModule } from 'expo-modules-core';

const GeminiNano = requireNativeModule('GeminiNano');

/**
 * Initialize Gemini Nano Image Description on-device model.
 * Checks feature status, downloads if needed, prepares inference engine.
 */
export async function initialize(): Promise<boolean> {
    return GeminiNano.initialize();
}

/**
 * Describe an image using Gemini Nano on-device.
 * Returns a text description of the image content.
 */
export async function describeImage(base64: string): Promise<string> {
    return GeminiNano.describeImage(base64);
}

/**
 * Check feature availability status.
 * 0 = UNAVAILABLE, 1 = DOWNLOADABLE, 2 = AVAILABLE, -1 = error.
 */
export async function checkStatus(): Promise<number> {
    return GeminiNano.checkStatus();
}
