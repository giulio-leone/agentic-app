/**
 * Module-level private state shared across store slices.
 * Kept separate so slices can access service/controller without circular imports.
 */

import { ACPService } from '../acp/ACPService';

export let _service: ACPService | null = null;
export let _aiAbortController: AbortController | null = null;

export function setService(s: ACPService | null) { _service = s; }
export function setAiAbortController(c: AbortController | null) { _aiAbortController = c; }
