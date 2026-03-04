/**
 * Chat Bridge module — app-side client for the Chat Bridge server.
 */

export { ChatBridgeClient, type ChatBridgeCallbacks, type BridgeConnectionState } from './ChatBridgeClient';
export { createChatBridgeCallbacks, type ChatBridgeStoreApi } from './chatBridgeCallbacks';
export type { ClientMsg, ServerMsg, CliAgent, SessionInfo, NetworkInfo, UsageInfo } from './types';
