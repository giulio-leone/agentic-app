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

/** Provider metadata for the UI. */
export interface AIProviderInfo {
  type: AIProviderType;
  name: string;
  icon: string;
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
}

/** Configuration stored per AI Provider "server". */
export interface AIProviderConfig {
  providerType: AIProviderType;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  systemPrompt?: string;
  temperature?: number;
}
