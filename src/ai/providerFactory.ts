/**
 * Provider factory — lazily loads AI SDK providers and creates LanguageModel instances.
 * Provider SDKs are cached after first load to reduce bundle overhead.
 */

import { type LanguageModel } from 'ai';
import { AIProviderType, type AIProviderConfig } from './types';
import { getProviderInfo } from './providers';

// React Native needs expo/fetch for streaming support
let expoFetch: typeof globalThis.fetch | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  expoFetch = require('expo/fetch').fetch;
} catch {
  // fallback to global fetch (web)
}

type ProviderFactory = (opts: Record<string, unknown>) => (modelId: string) => LanguageModel;
type OpenRouterFactory = (opts: Record<string, unknown>) => { chat: (modelId: string) => LanguageModel };
const _providerCache = new Map<string, ProviderFactory>();
const _openRouterCache = new Map<string, OpenRouterFactory>();

async function getOpenAIProvider(): Promise<ProviderFactory> {
  if (!_providerCache.has('openai')) {
    const { createOpenAI } = await import('@ai-sdk/openai');
    _providerCache.set('openai', createOpenAI as unknown as ProviderFactory);
  }
  return _providerCache.get('openai')!;
}

async function getAnthropicProvider(): Promise<ProviderFactory> {
  if (!_providerCache.has('anthropic')) {
    const { createAnthropic } = await import('@ai-sdk/anthropic');
    _providerCache.set('anthropic', createAnthropic as unknown as ProviderFactory);
  }
  return _providerCache.get('anthropic')!;
}

async function getGoogleProvider(): Promise<ProviderFactory> {
  if (!_providerCache.has('google')) {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
    _providerCache.set('google', createGoogleGenerativeAI as unknown as ProviderFactory);
  }
  return _providerCache.get('google')!;
}

async function getXaiProvider(): Promise<ProviderFactory> {
  if (!_providerCache.has('xai')) {
    const { createXai } = await import('@ai-sdk/xai');
    _providerCache.set('xai', createXai as unknown as ProviderFactory);
  }
  return _providerCache.get('xai')!;
}

async function getOpenRouterProvider(): Promise<OpenRouterFactory> {
  if (!_openRouterCache.has('openrouter')) {
    const { createOpenRouter } = await import('@openrouter/ai-sdk-provider');
    _openRouterCache.set('openrouter', createOpenRouter as unknown as OpenRouterFactory);
  }
  return _openRouterCache.get('openrouter')!;
}

async function getOpenAICompatibleProvider(): Promise<ProviderFactory> {
  if (!_providerCache.has('openai-compatible')) {
    const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
    _providerCache.set('openai-compatible', createOpenAICompatible as unknown as ProviderFactory);
  }
  return _providerCache.get('openai-compatible')!;
}

/**
 * Build an AI SDK `LanguageModel` from the given config + API key.
 * Provider SDKs are loaded on first use and cached.
 */
export async function createModel(
  config: AIProviderConfig,
  apiKey: string,
): Promise<LanguageModel> {
  const { providerType, modelId, baseUrl } = config;
  const fetchOpt = expoFetch ? { fetch: expoFetch } : {};

  switch (providerType) {
    case AIProviderType.OpenAI: {
      const create = await getOpenAIProvider();
      return create({ apiKey, ...fetchOpt })(modelId);
    }

    case AIProviderType.Anthropic: {
      const create = await getAnthropicProvider();
      return create({ apiKey, ...fetchOpt })(modelId);
    }

    case AIProviderType.Google: {
      const create = await getGoogleProvider();
      return create({ apiKey, ...fetchOpt })(modelId);
    }

    case AIProviderType.xAI: {
      const create = await getXaiProvider();
      return create({ apiKey, ...fetchOpt })(modelId);
    }

    case AIProviderType.OpenRouter: {
      const create = await getOpenRouterProvider();
      const provider = create({ apiKey, ...fetchOpt });
      return provider.chat(modelId);
    }

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
      const effectiveBaseUrl =
        baseUrl ?? getProviderInfo(providerType).defaultBaseUrl;
      if (!effectiveBaseUrl) {
        throw new Error(
          `Base URL is required for provider "${providerType}".`,
        );
      }
      const create = await getOpenAICompatibleProvider();
      return create({
        baseURL: effectiveBaseUrl,
        apiKey,
        name: providerType,
        ...fetchOpt,
      })(modelId);
    }

    default: {
      const _exhaustive: never = providerType;
      throw new Error(`Unhandled provider type: ${_exhaustive}`);
    }
  }
}
