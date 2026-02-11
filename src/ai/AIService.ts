/**
 * Core AI service — creates provider models and streams chat completions.
 */

import { streamText, type ModelMessage, type LanguageModel } from 'ai';
import { createOpenAI as createOpenAIProvider } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { AIProviderType, type AIProviderConfig } from './types';
import { getProviderInfo } from './providers';
import type { ChatMessage } from '../acp/models/types';

// ── model factory ────────────────────────────────────────────────────────────

/**
 * Build an AI SDK `LanguageModel` from the given config + API key.
 */
export function createModel(
  config: AIProviderConfig,
  apiKey: string,
): LanguageModel {
  const { providerType, modelId, baseUrl } = config;

  switch (providerType) {
    case AIProviderType.OpenAI: {
      const provider = createOpenAIProvider({ apiKey });
      return provider(modelId);
    }

    case AIProviderType.Anthropic: {
      const provider = createAnthropic({ apiKey });
      return provider(modelId);
    }

    case AIProviderType.Google: {
      const provider = createGoogleGenerativeAI({ apiKey });
      return provider(modelId);
    }

    case AIProviderType.xAI: {
      const provider = createXai({ apiKey });
      return provider(modelId);
    }

    case AIProviderType.OpenRouter: {
      const provider = createOpenRouter({ apiKey });
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
      const provider = createOpenAICompatible({
        baseURL: effectiveBaseUrl,
        apiKey,
        name: providerType,
      });
      return provider(modelId);
    }

    default: {
      const _exhaustive: never = providerType;
      throw new Error(`Unhandled provider type: ${_exhaustive}`);
    }
  }
}

// ── message conversion ───────────────────────────────────────────────────────

function toCoreMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
}

// ── streaming chat ───────────────────────────────────────────────────────────

/**
 * Stream a chat completion. Returns an `AbortController` the caller can use to
 * cancel the request.
 */
export function streamChat(
  messages: ChatMessage[],
  config: AIProviderConfig,
  apiKey: string,
  onChunk: (text: string) => void,
  onComplete: (stopReason: string) => void,
  onError: (error: Error) => void,
): AbortController {
  const controller = new AbortController();

  const model = createModel(config, apiKey);
  const coreMessages = toCoreMessages(messages);

  // Fire-and-forget async IIFE — errors are forwarded via onError.
  (async () => {
    try {
      const result = streamText({
        model,
        messages: coreMessages,
        system: config.systemPrompt,
        temperature: config.temperature,
        abortSignal: controller.signal,
      });

      for await (const chunk of result.textStream) {
        if (controller.signal.aborted) break;
        onChunk(chunk);
      }

      const reason = await result.finishReason;
      onComplete(reason ?? 'unknown');
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        onComplete('abort');
        return;
      }
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return controller;
}
