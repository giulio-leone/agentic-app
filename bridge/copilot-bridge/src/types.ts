/**
 * Shared types for the Copilot Bridge.
 */

// ── JSON-RPC 2.0 ──

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCNotification;

// ── ACP Session Update ──

export type SessionUpdateType =
  | 'agent_message_start'
  | 'agent_message_chunk'
  | 'agent_message_end';

export interface SessionUpdate {
  sessionUpdate: SessionUpdateType;
  content: { type?: string; text?: string };
}

// ── ACP Agent Profile ──

export interface AgentProfile {
  name: string;
  version: string;
  capabilities: {
    promptCapabilities: { image: boolean };
    modelListing?: boolean;
    multiSession?: boolean;
    cancel?: boolean;
  };
  modes: Array<{ id: string; name: string; description?: string }>;
  models?: Array<{ id: string; name: string }>;
}

// ── Config ──

export interface BridgeConfig {
  port: number;
  model: string;
  workingDirectory: string;
  cliPath?: string;
}
