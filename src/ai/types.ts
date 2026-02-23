/**
 * AI provider types for direct AI SDK integration.
 */

export enum AIProviderType {
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  Google = 'google',
  xAI = 'xai',
  OpenRouter = 'openrouter',
  // OpenAI-compatible providers
  Kimi = 'kimi',
  MiniMax = 'minimax',
  GLM = 'glm',
  DeepSeek = 'deepseek',
  Groq = 'groq',
  Together = 'together',
  Mistral = 'mistral',
  Perplexity = 'perplexity',
  Custom = 'custom',
}

import type { LucideIcon } from 'lucide-react-native';

/** Provider metadata for the UI. */
export interface AIProviderInfo {
  type: AIProviderType;
  name: string;
  icon: LucideIcon;
  models: AIModelInfo[];
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  defaultBaseUrl?: string;
}

/** Model metadata. */
export interface AIModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsReasoning: boolean;
  supportedParameters: string[];
}

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/** Configuration stored per AI Provider "server". */
export interface AIProviderConfig {
  providerType: AIProviderType;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  systemPrompt?: string;
  temperature?: number;
  reasoningEnabled?: boolean;
  reasoningEffort?: ReasoningEffort;
  webSearchEnabled?: boolean;
}

// ── Unified Provider + Model Selection ──────────────────────────

/** Cross-provider model reference. Used in consensus and as default selection. */
export interface ProviderModelSelection {
  serverId: string;
  providerType: AIProviderType;
  modelId: string;
}

// ── Consensus Mode Configuration ─────────────────────────────────

export interface ConsensusAgentConfig {
  id: string;
  role: string;           // e.g. "Optimistic Analyst"
  instructions: string;
  modelId?: string;       // legacy: override per-agent model; undefined = use shared
  provider?: ProviderModelSelection; // cross-provider override
}

export interface ConsensusConfig {
  agents: ConsensusAgentConfig[];
  reviewerModelId?: string;   // legacy: undefined = use server's default model
  reviewerProvider?: ProviderModelSelection; // cross-provider reviewer
  useSharedModel: boolean;    // true = all agents + reviewer use the same model
}

export const DEFAULT_CONSENSUS_AGENTS: ConsensusAgentConfig[] = [
  { id: 'optimistic', role: 'Optimistic Analyst', instructions: 'Focus on positive aspects, opportunities, and creative solutions.' },
  { id: 'critical', role: 'Critical Analyst', instructions: 'Focus on risks, edge cases, potential failures, and constraints.' },
  { id: 'pragmatic', role: 'Pragmatic Analyst', instructions: 'Focus on facts, straightforward implementations, and step-by-step reasoning.' },
];

export const DEFAULT_CONSENSUS_CONFIG: ConsensusConfig = {
  agents: DEFAULT_CONSENSUS_AGENTS,
  useSharedModel: true,
};

// Re-export ConsensusDetails from the canonical message types
export type { ConsensusDetails } from '../acp/models/types';
