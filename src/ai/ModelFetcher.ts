/**
 * Fetches available models from provider APIs.
 */

import { AIProviderType } from './types';
import { getProviderInfo } from './providers';

export interface FetchedModel {
  id: string;
  name: string;
  contextWindow?: number;
  supportsReasoning: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportedParameters: string[];
}

// ── OpenAI format ────────────────────────────────────────────────────────────

interface OpenAIModelEntry {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

const OPENAI_CHAT_KEYWORDS = ['gpt', 'o1', 'o3', 'o4', 'chatgpt'];
const OPENAI_EXCLUDE_KEYWORDS = [
  'embed', 'whisper', 'tts', 'dall-e', 'davinci', 'babbage',
  'curie', 'ada', 'moderation', 'search', 'instruct', 'audio',
  'realtime', 'transcribe',
];
const REASONING_MODEL_PATTERNS = [/^o1/, /^o3/, /^o4/, /deepseek-reasoner/];

function isOpenAIChatModel(id: string): boolean {
  const lower = id.toLowerCase();
  if (OPENAI_EXCLUDE_KEYWORDS.some(kw => lower.includes(kw))) return false;
  return OPENAI_CHAT_KEYWORDS.some(kw => lower.includes(kw));
}

function looksLikeReasoningModel(id: string): boolean {
  return REASONING_MODEL_PATTERNS.some(p => p.test(id));
}

function openAIEntryToFetched(entry: OpenAIModelEntry): FetchedModel {
  return {
    id: entry.id,
    name: entry.id,
    supportsReasoning: looksLikeReasoningModel(entry.id),
    supportsTools: !looksLikeReasoningModel(entry.id),
    supportsVision: false,
    supportedParameters: [],
  };
}

// ── Provider-specific fetchers ───────────────────────────────────────────────

async function fetchOpenAIModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const json = await res.json();
  const entries: OpenAIModelEntry[] = json.data ?? [];
  return entries
    .filter(e => isOpenAIChatModel(e.id))
    .map(openAIEntryToFetched)
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchGoogleModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models',
    { headers: { 'x-goog-api-key': apiKey } },
  );
  if (!res.ok) throw new Error(`Google API error: ${res.status}`);
  const json = await res.json();
  const models: Array<{
    name: string;
    displayName: string;
    description?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    supportedGenerationMethods?: string[];
  }> = json.models ?? [];

  return models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => {
      const id = m.name.replace(/^models\//, '');
      return {
        id,
        name: m.displayName || id,
        contextWindow: m.inputTokenLimit,
        supportsReasoning: false,
        supportsTools: true,
        supportsVision: true,
        supportedParameters: [],
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchXAIModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch('https://api.x.ai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`xAI API error: ${res.status}`);
  const json = await res.json();
  const entries: OpenAIModelEntry[] = json.data ?? [];
  return entries.map(e => ({
    id: e.id,
    name: e.id,
    supportsReasoning: false,
    supportsTools: true,
    supportsVision: false,
    supportedParameters: [],
  })).sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchOpenRouterModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`);
  const json = await res.json();
  const entries: Array<{
    id: string;
    name?: string;
    context_length?: number;
    supported_parameters?: string[];
    architecture?: { input_modalities?: string[] };
  }> = json.data ?? [];

  return entries.map(e => {
    const params = e.supported_parameters ?? [];
    return {
      id: e.id,
      name: e.name || e.id,
      contextWindow: e.context_length,
      supportsReasoning: params.some(p =>
        ['reasoning', 'reasoning_effort', 'include_reasoning'].includes(p),
      ),
      supportsTools: params.includes('tools'),
      supportsVision: e.architecture?.input_modalities?.includes('image') ?? false,
      supportedParameters: params,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchOpenAICompatibleModels(
  apiKey: string,
  baseUrl: string,
): Promise<FetchedModel[]> {
  const url = baseUrl.replace(/\/+$/, '') + '/models';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  const entries: OpenAIModelEntry[] = json.data ?? [];
  return entries.map(e => ({
    id: e.id,
    name: e.id,
    supportsReasoning: looksLikeReasoningModel(e.id),
    supportsTools: true,
    supportsVision: false,
    supportedParameters: [],
  })).sort((a, b) => a.id.localeCompare(b.id));
}

// Static list for Anthropic (no public models endpoint)
function getAnthropicStaticModels(): FetchedModel[] {
  const info = getProviderInfo(AIProviderType.Anthropic);
  return info.models.map(m => ({
    id: m.id,
    name: m.name,
    contextWindow: m.contextWindow,
    supportsReasoning: m.supportsReasoning,
    supportsTools: m.supportsTools,
    supportsVision: m.supportsVision,
    supportedParameters: m.supportedParameters,
  }));
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function fetchModelsFromProvider(
  providerType: AIProviderType,
  apiKey: string,
  baseUrl?: string,
): Promise<FetchedModel[]> {
  switch (providerType) {
    case AIProviderType.OpenAI:
      return fetchOpenAIModels(apiKey);

    case AIProviderType.Anthropic:
      return getAnthropicStaticModels();

    case AIProviderType.Google:
      return fetchGoogleModels(apiKey);

    case AIProviderType.xAI:
      return fetchXAIModels(apiKey);

    case AIProviderType.OpenRouter:
      return fetchOpenRouterModels(apiKey);

    // All OpenAI-compatible providers
    case AIProviderType.Kimi:
    case AIProviderType.MiniMax:
    case AIProviderType.GLM:
    case AIProviderType.DeepSeek:
    case AIProviderType.Groq:
    case AIProviderType.Together:
    case AIProviderType.Mistral:
    case AIProviderType.Perplexity:
    case AIProviderType.Custom: {
      const effectiveUrl =
        baseUrl ?? getProviderInfo(providerType).defaultBaseUrl;
      if (!effectiveUrl) {
        throw new Error(`Base URL is required for provider "${providerType}".`);
      }
      return fetchOpenAICompatibleModels(apiKey, effectiveUrl);
    }

    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}
