/**
 * Module-level private state shared across store slices.
 *
 * **Why module-level instead of Zustand state?**
 * These values are *imperative handles* (WebSocket service, AbortController) that
 * don't trigger React re-renders. Putting them in Zustand would cause unnecessary
 * subscriber notifications on every connect/disconnect cycle. Module-level `let`
 * keeps them out of the reactive graph while still accessible from any slice.
 *
 * Trade-off: not directly testable via store snapshots. Acceptable for a companion
 * app with a single service instance.
 */

import type { AcpHexInstance } from '../acp-hex/integration/bootstrap';
import { getAcpHex } from '../acp-hex/integration/bootstrap';
import type { ChatBridgeClient } from '../ai/chatbridge/ChatBridgeClient';

export let _service: AcpHexInstance | null = null;
export let _aiAbortController: AbortController | null = null;
export let _bridgeClient: ChatBridgeClient | null = null;

export function setService(s: AcpHexInstance | null) { _service = s; }
export function getService(): AcpHexInstance | null { return _service ?? getAcpHex(); }
export function setAiAbortController(c: AbortController | null) { _aiAbortController = c; }
export function setBridgeClient(c: ChatBridgeClient | null) { _bridgeClient = c; }
export function getBridgeClient(): ChatBridgeClient | null { return _bridgeClient; }
