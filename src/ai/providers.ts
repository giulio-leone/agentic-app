/**
 * Provider registry — every supported AI provider and its models.
 */

import { AIProviderType, AIProviderInfo, AIModelInfo } from './types';

// ── helpers ──────────────────────────────────────────────────────────────────

function m(
  id: string,
  name: string,
  opts: Partial<Pick<AIModelInfo, 'contextWindow' | 'supportsStreaming' | 'supportsTools' | 'supportsVision'>> = {},
): AIModelInfo {
  return {
    id,
    name,
    contextWindow: opts.contextWindow,
    supportsStreaming: opts.supportsStreaming ?? true,
    supportsTools: opts.supportsTools ?? true,
    supportsVision: opts.supportsVision ?? false,
  };
}

// ── provider definitions ─────────────────────────────────────────────────────

const openai: AIProviderInfo = {
  type: AIProviderType.OpenAI,
  name: 'OpenAI',
  icon: '🤖',
  requiresApiKey: true,
  requiresBaseUrl: false,
  models: [
    m('gpt-4o', 'GPT-4o', { contextWindow: 128_000, supportsVision: true }),
    m('gpt-4o-mini', 'GPT-4o Mini', { contextWindow: 128_000, supportsVision: true }),
    m('gpt-4-turbo', 'GPT-4 Turbo', { contextWindow: 128_000, supportsVision: true }),
    m('o1', 'o1', { contextWindow: 200_000, supportsTools: false }),
    m('o1-mini', 'o1-mini', { contextWindow: 128_000, supportsTools: false }),
    m('o3-mini', 'o3-mini', { contextWindow: 200_000, supportsTools: false }),
  ],
};

const anthropicProvider: AIProviderInfo = {
  type: AIProviderType.Anthropic,
  name: 'Anthropic',
  icon: '🧠',
  requiresApiKey: true,
  requiresBaseUrl: false,
  models: [
    m('claude-sonnet-4-20250514', 'Claude Sonnet 4', { contextWindow: 200_000, supportsVision: true }),
    m('claude-3-5-haiku-20241022', 'Claude 3.5 Haiku', { contextWindow: 200_000, supportsVision: true }),
    m('claude-3-opus-20240229', 'Claude 3 Opus', { contextWindow: 200_000, supportsVision: true }),
  ],
};

const googleProvider: AIProviderInfo = {
  type: AIProviderType.Google,
  name: 'Google',
  icon: '🔷',
  requiresApiKey: true,
  requiresBaseUrl: false,
  models: [
    m('gemini-2.5-flash', 'Gemini 2.5 Flash', { contextWindow: 1_000_000, supportsVision: true }),
    m('gemini-2.5-pro', 'Gemini 2.5 Pro', { contextWindow: 1_000_000, supportsVision: true }),
    m('gemini-2.0-flash', 'Gemini 2.0 Flash', { contextWindow: 1_000_000, supportsVision: true }),
  ],
};

const xaiProvider: AIProviderInfo = {
  type: AIProviderType.xAI,
  name: 'xAI',
  icon: '✖️',
  requiresApiKey: true,
  requiresBaseUrl: false,
  models: [
    m('grok-3', 'Grok 3', { contextWindow: 131_072 }),
    m('grok-3-mini', 'Grok 3 Mini', { contextWindow: 131_072 }),
    m('grok-2', 'Grok 2', { contextWindow: 131_072 }),
  ],
};

const openRouter: AIProviderInfo = {
  type: AIProviderType.OpenRouter,
  name: 'OpenRouter',
  icon: '🔀',
  requiresApiKey: true,
  requiresBaseUrl: false,
  models: [
    m('auto', 'Auto (best available)', { contextWindow: 128_000, supportsVision: true }),
    m('openai/gpt-4o', 'GPT-4o (via OpenRouter)', { contextWindow: 128_000, supportsVision: true }),
    m('anthropic/claude-sonnet-4-20250514', 'Claude Sonnet 4 (via OpenRouter)', { contextWindow: 200_000, supportsVision: true }),
    m('google/gemini-2.5-flash', 'Gemini 2.5 Flash (via OpenRouter)', { contextWindow: 1_000_000, supportsVision: true }),
  ],
};

const kimi: AIProviderInfo = {
  type: AIProviderType.Kimi,
  name: 'Kimi (Moonshot)',
  icon: '🌙',
  requiresApiKey: true,
  requiresBaseUrl: false,
  defaultBaseUrl: 'https://api.moonshot.cn/v1',
  models: [
    m('moonshot-v1-128k', 'Moonshot v1 128K', { contextWindow: 128_000 }),
    m('moonshot-v1-32k', 'Moonshot v1 32K', { contextWindow: 32_000 }),
    m('moonshot-v1-8k', 'Moonshot v1 8K', { contextWindow: 8_000 }),
  ],
};

const minimax: AIProviderInfo = {
  type: AIProviderType.MiniMax,
  name: 'MiniMax',
  icon: '🔶',
  requiresApiKey: true,
  requiresBaseUrl: false,
  defaultBaseUrl: 'https://api.minimax.chat/v1',
  models: [
    m('MiniMax-Text-01', 'MiniMax Text 01', { contextWindow: 1_000_000 }),
    m('abab6.5s-chat', 'Abab 6.5s Chat', { contextWindow: 245_760 }),
  ],
};

const glm: AIProviderInfo = {
  type: AIProviderType.GLM,
  name: 'GLM (Zhipu AI)',
  icon: '🟢',
  requiresApiKey: true,
  requiresBaseUrl: false,
  defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4/',
  models: [
    m('glm-4-plus', 'GLM-4 Plus', { contextWindow: 128_000 }),
    m('glm-4-flash', 'GLM-4 Flash', { contextWindow: 128_000 }),
  ],
};

const deepseek: AIProviderInfo = {
  type: AIProviderType.DeepSeek,
  name: 'DeepSeek',
  icon: '🐋',
  requiresApiKey: true,
  requiresBaseUrl: false,
  defaultBaseUrl: 'https://api.deepseek.com/v1',
  models: [
    m('deepseek-chat', 'DeepSeek Chat', { contextWindow: 64_000 }),
    m('deepseek-reasoner', 'DeepSeek Reasoner', { contextWindow: 64_000, supportsTools: false }),
  ],
};

const groq: AIProviderInfo = {
  type: AIProviderType.Groq,
  name: 'Groq',
  icon: '⚡',
  requiresApiKey: true,
  requiresBaseUrl: false,
  defaultBaseUrl: 'https://api.groq.com/openai/v1',
  models: [
    m('llama-3.3-70b-versatile', 'Llama 3.3 70B', { contextWindow: 128_000 }),
    m('mixtral-8x7b-32768', 'Mixtral 8x7B', { contextWindow: 32_768 }),
  ],
};

const together: AIProviderInfo = {
  type: AIProviderType.Together,
  name: 'Together',
  icon: '🤝',
  requiresApiKey: true,
  requiresBaseUrl: false,
  defaultBaseUrl: 'https://api.together.xyz/v1',
  models: [
    m('meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Llama 3.3 70B Instruct Turbo', { contextWindow: 128_000 }),
  ],
};

const mistral: AIProviderInfo = {
  type: AIProviderType.Mistral,
  name: 'Mistral',
  icon: '🌀',
  requiresApiKey: true,
  requiresBaseUrl: false,
  defaultBaseUrl: 'https://api.mistral.ai/v1',
  models: [
    m('mistral-large-latest', 'Mistral Large', { contextWindow: 128_000, supportsVision: true }),
    m('mistral-small-latest', 'Mistral Small', { contextWindow: 128_000 }),
  ],
};

const perplexity: AIProviderInfo = {
  type: AIProviderType.Perplexity,
  name: 'Perplexity',
  icon: '🔍',
  requiresApiKey: true,
  requiresBaseUrl: false,
  defaultBaseUrl: 'https://api.perplexity.ai',
  models: [
    m('sonar-pro', 'Sonar Pro', { contextWindow: 200_000, supportsTools: false }),
    m('sonar', 'Sonar', { contextWindow: 127_072, supportsTools: false }),
  ],
};

const custom: AIProviderInfo = {
  type: AIProviderType.Custom,
  name: 'Custom',
  icon: '🔧',
  requiresApiKey: true,
  requiresBaseUrl: true,
  models: [
    m('custom', 'Custom Model', {}),
  ],
};

// ── exports ──────────────────────────────────────────────────────────────────

export const ALL_PROVIDERS: AIProviderInfo[] = [
  openai,
  anthropicProvider,
  googleProvider,
  xaiProvider,
  openRouter,
  kimi,
  minimax,
  glm,
  deepseek,
  groq,
  together,
  mistral,
  perplexity,
  custom,
];

const providerMap = new Map<AIProviderType, AIProviderInfo>(
  ALL_PROVIDERS.map((p) => [p.type, p]),
);

export function getProviderInfo(type: AIProviderType): AIProviderInfo {
  const info = providerMap.get(type);
  if (!info) {
    throw new Error(`Unknown AI provider type: ${type}`);
  }
  return info;
}
