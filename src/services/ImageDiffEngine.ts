/**
 * ImageDiffEngine — Gemini Nano on-device Image Description for change detection.
 *
 * Flow:
 * 1. extractTextFromFrame() — sends image to ML Kit Text Recognition, gets raw text
 * 2. descriptionsAreDifferent() — simple string comparison of descriptions
 *
 * Uses ML Kit GenAI Image Description API (supported on S25 Ultra).
 */

import * as GeminiNano from '../../modules/gemini-nano';

let _initialized = false;

/** Initialize Gemini Nano model. Call once at startup. */
export async function ensureModel(): Promise<void> {
    if (_initialized) return;

    console.log('[ImageDiff] Checking Gemini Nano status...');
    const status = await GeminiNano.checkStatus();
    console.log(`[ImageDiff] Gemini Nano status: ${status} (0=unavailable, 1=downloadable, 2=available)`);

    console.log('[ImageDiff] Initializing Gemini Nano Image Description...');
    const t0 = Date.now();
    await GeminiNano.initialize();
    console.log(`[ImageDiff] ✅ Gemini Nano ready in ${Date.now() - t0}ms`);
    _initialized = true;
}

let _isExtracting = false;

/**
 * Extract raw text from a screen capture using ML Kit.
 * Returns a text string containing all recognized text on screen.
 */
export async function extractTextFromFrame(base64: string): Promise<string> {
    if (!_initialized) throw new Error('Call ensureModel() first');
    if (_isExtracting) throw new Error('ImageDiffEngine is currently busy extracting text from another frame');

    _isExtracting = true;
    try {
        const t0 = Date.now();
        // The GeminiNano native module is now mapped to ML Kit Text Recognition
        const extractedText = await GeminiNano.describeImage(base64);
        console.log(`[ImageDiff] extract=${Date.now() - t0}ms: "${extractedText.substring(0, 80)}..."`);
        return extractedText;
    } finally {
        _isExtracting = false;
    }
}

/**
 * Compare two frame descriptions using simple text comparison.
 * Returns true if the descriptions are meaningfully different.
 */
export function descriptionsAreDifferent(descA: string, descB: string): boolean {
    // Normalize
    const a = descA.trim().toLowerCase();
    const b = descB.trim().toLowerCase();

    // Exact match = same
    if (a === b) return false;

    // Word-level Jaccard similarity
    const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
    const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));

    if (wordsA.size === 0 && wordsB.size === 0) return false;

    let intersection = 0;
    for (const w of wordsA) {
        if (wordsB.has(w)) intersection++;
    }
    const union = new Set([...wordsA, ...wordsB]).size;
    const jaccard = union > 0 ? intersection / union : 0;

    // If less than 75% word overlap → content changed physically
    // This makes it more sensitive to small lines of code / code scrolling
    const changed = jaccard < 0.75;
    console.log(
        `[ImageDiff] jaccard=${(jaccard * 100).toFixed(1)}% ` +
        `(${intersection}/${union} words) → ${changed ? 'DIFFERENT' : 'SAME'}`
    );
    return changed;
}

export const ImageDiffEngine = {
    ensureModel,
    extractTextFromFrame,
    descriptionsAreDifferent,
};
