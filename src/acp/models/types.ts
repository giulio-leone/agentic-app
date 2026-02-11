/**
 * ACP protocol types – mirrors the Swift ACPClient models.
 */

import type { AIProviderConfig } from '../../ai/types';

export enum ACPConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Failed = 'failed',
}

export enum ServerType {
  ACP = 'acp',
  Codex = 'codex',
  AIProvider = 'ai_provider',
}

export interface ACPServerConfiguration {
  id: string;
  name: string;
  scheme: string;
  host: string;
  token: string;
  cfAccessClientId: string;
  cfAccessClientSecret: string;
  workingDirectory: string;
  serverType: ServerType;
  aiProviderConfig?: AIProviderConfig;
}

export interface SessionSummary {
  id: string;
  title?: string;
  cwd?: string;
  updatedAt?: string; // ISO date string
}

export interface AgentCapabilities {
  promptCapabilities: {
    image: boolean;
  };
}

export interface AgentModeOption {
  id: string;
  name: string;
  description?: string;
}

export interface AgentProfile {
  name: string;
  version: string;
  capabilities: AgentCapabilities;
  modes: AgentModeOption[];
}

export interface SessionCommand {
  name: string;
  description: string;
  inputHint?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  segments?: MessageSegment[];
  isStreaming?: boolean;
  timestamp: string;
}

export type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'toolCall'; toolName: string; input: string; result?: string; isComplete: boolean }
  | { type: 'thought'; content: string };

export interface ACPClientError {
  code: string;
  message: string;
}

export interface ACPModesInfo {
  available: AgentModeOption[];
  defaultModeId?: string;
}
