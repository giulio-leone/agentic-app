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
  reasoning?: string;
  segments?: MessageSegment[];
  attachments?: Attachment[];
  artifacts?: Artifact[];
  consensusDetails?: ConsensusDetails;
  isStreaming?: boolean;
  timestamp: string;
}

/** Consensus details embedded in a chat message for real-time tracking. */
export interface ConsensusDetails {
  agentResults: Array<{
    agentId: string;
    role: string;
    output: string;
    modelId?: string;
    status: 'pending' | 'running' | 'complete' | 'error';
    error?: string;
  }>;
  reviewerVerdict?: string;
  reviewerModelId?: string;
  status: 'agents_running' | 'consensus_running' | 'complete' | 'error';
}

export interface Attachment {
  id: string;
  name: string;
  mediaType: string;      // e.g. 'image/jpeg', 'application/pdf'
  uri: string;            // local file URI for preview
  base64?: string;        // base64 encoded data for sending to AI
  size?: number;          // file size in bytes
}

export type ArtifactType = 'code' | 'html' | 'svg' | 'mermaid' | 'csv' | 'markdown' | 'image';

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;        // raw content (code, HTML, SVG, etc.)
  language?: string;       // for code: 'typescript', 'python', etc.
  mediaType?: string;      // for images: 'image/png', etc.
}

export type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'toolCall'; toolName: string; input: string; result?: string; isComplete: boolean; callCount?: number; completedCount?: number }
  | { type: 'thought'; content: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'artifact'; artifactId: string }
  | { type: 'agentEvent'; eventType: string; label: string; detail?: string };

export interface ACPClientError {
  code: string;
  message: string;
}

export interface ACPModesInfo {
  available: AgentModeOption[];
  defaultModeId?: string;
}
