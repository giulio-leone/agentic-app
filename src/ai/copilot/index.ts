export { CopilotBridgeService } from './CopilotBridgeService';
export type { ConnectionStateListener } from './CopilotBridgeService';
export {
  parsePairingUrl,
  discoverBridgesViaMdns,
  validateBridgeConnection,
  saveBridgeConfig,
  loadBridgeConfig,
} from './discovery';
export type {
  PairingParams,
  DiscoveredBridge,
  ValidationResult,
} from './discovery';
export type {
  CopilotBridgeConfig,
  CopilotConnectionState,
  StreamCallbacks,
  ToolRequest,
  SessionId,
  ModelInfo,
  SessionInfo,
  McpServerInfo,
  StreamEventKind,
  ToolRequestKind,
} from './types';
