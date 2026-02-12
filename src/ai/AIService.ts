/**
 * Core AI service — creates provider models and streams chat completions.
 * Provider SDKs are lazily loaded to reduce initial bundle size.
 */

import { streamText, stepCountIs, type ModelMessage, type LanguageModel, type JSONValue } from 'ai';
import { buildMCPTools } from '../mcp/MCPToolAdapter';
import { buildSearchTools } from '../search/SearchTools';

// React Native needs expo/fetch for streaming support
let expoFetch: typeof globalThis.fetch | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  expoFetch = require('expo/fetch').fetch;
} catch {
  // fallback to global fetch (web)
}

import { AIProviderType, type AIProviderConfig } from './types';
import { getProviderInfo } from './providers';
import type { ChatMessage } from '../acp/models/types';

// ── lazy provider cache ──────────────────────────────────────────────────────

type ProviderFactory = (opts: Record<string, unknown>) => (modelId: string) => LanguageModel;
const _providerCache = new Map<string, ProviderFactory>();

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

async function getOpenRouterProvider(): Promise<any> {
  if (!_providerCache.has('openrouter')) {
    const { createOpenRouter } = await import('@openrouter/ai-sdk-provider');
    _providerCache.set('openrouter', createOpenRouter as unknown as ProviderFactory);
  }
  return _providerCache.get('openrouter')!;
}

async function getOpenAICompatibleProvider(): Promise<any> {
  if (!_providerCache.has('openai-compatible')) {
    const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
    _providerCache.set('openai-compatible', createOpenAICompatible as unknown as ProviderFactory);
  }
  return _providerCache.get('openai-compatible')!;
}

// ── model factory ────────────────────────────────────────────────────────────

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

// ── message conversion ───────────────────────────────────────────────────────

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string; mediaType?: string }
  | { type: 'file'; data: string; mediaType: string; filename?: string };

function toCoreMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
    .map((msg) => {
      const hasAttachments = msg.attachments && msg.attachments.length > 0;

      if (!hasAttachments || msg.role !== 'user') {
        return { role: msg.role, content: msg.content };
      }

      // Build multimodal content array for messages with attachments
      const parts: ContentPart[] = [];

      // Add text part if present
      if (msg.content.trim()) {
        parts.push({ type: 'text', text: msg.content });
      }

      // Add attachment parts
      for (const att of msg.attachments!) {
        if (!att.base64) continue;

        if (att.mediaType.startsWith('image/')) {
          // Use data URI format for maximum provider compatibility
          parts.push({
            type: 'image',
            image: `data:${att.mediaType};base64,${att.base64}`,
            mediaType: att.mediaType,
          });
        } else {
          parts.push({
            type: 'file',
            data: att.base64,
            mediaType: att.mediaType,
            filename: att.name,
          });
        }
      }

      if (parts.length === 0) {
        return { role: msg.role, content: msg.content };
      }

      return { role: msg.role, content: parts as unknown as string };
    });
}

// ── streaming chat ───────────────────────────────────────────────────────────

/**
 * Stream a chat completion. Returns an `AbortController` the caller can use to
 * cancel the request. Captures both text and reasoning stream parts.
 */
export function streamChat(
  messages: ChatMessage[],
  config: AIProviderConfig,
  apiKey: string,
  onChunk: (text: string) => void,
  onComplete: (stopReason: string) => void,
  onError: (error: Error) => void,
  onReasoning?: (text: string) => void,
  onToolCall?: (toolName: string, args: string) => void,
  onToolResult?: (toolName: string, result: string) => void,
): AbortController {
  const controller = new AbortController();

  // Fire-and-forget async IIFE — errors are forwarded via onError.
  (async () => {
    try {
      const model = await createModel(config, apiKey);
      const coreMessages = toCoreMessages(messages);
      const providerOptions = buildProviderOptions(config);

      // Build tools (MCP + search)
      const mcpTools = buildMCPTools();
      const searchTools = config.webSearchEnabled !== false ? buildSearchTools() : {};
      const allTools = { ...mcpTools, ...searchTools };
      const hasTools = Object.keys(allTools).length > 0;

      const result = streamText({
        model,
        messages: coreMessages,
        system: config.systemPrompt,
        temperature: config.temperature,
        abortSignal: controller.signal,
        ...(hasTools ? { tools: allTools, stopWhen: stepCountIs(10) } : {}),
        ...(Object.keys(providerOptions).length > 0 ? { providerOptions } : {}),
      });

      for await (const part of result.fullStream) {
        if (controller.signal.aborted) break;
        switch (part.type) {
          case 'text-delta':
            onChunk(part.text);
            break;
          case 'reasoning-delta':
            if (onReasoning) {
              onReasoning((part as { type: string; text: string }).text);
            }
            break;
          case 'tool-call':
            if (onToolCall) {
              const tc = part as { toolName: string; input: unknown };
              onToolCall(
                tc.toolName,
                JSON.stringify(tc.input, null, 2),
              );
            }
            break;
          case 'tool-result':
            if (onToolResult) {
              const tr = part as { toolName: string; output: unknown };
              onToolResult(
                tr.toolName,
                typeof tr.output === 'string'
                  ? tr.output
                  : JSON.stringify(tr.output),
              );
            }
            break;
        }
      }

      const reason = await result.finishReason;
      onComplete(reason ?? 'unknown');
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        onComplete('abort');
        return;
      }
      // Provide user-friendly error messages for common issues
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('image input')) {
        onError(new Error(`This model doesn't support image input. Try a vision model (e.g. gpt-4o, gemini-2.5-flash, claude-sonnet-4).`));
      } else {
        onError(err instanceof Error ? err : new Error(msg));
      }
    }
  })();

  return controller;
}

// ── provider options builder ─────────────────────────────────────────────────

function buildProviderOptions(config: AIProviderConfig): Record<string, Record<string, JSONValue>> {
  const opts: Record<string, Record<string, JSONValue>> = {};

  if (!config.reasoningEnabled) return opts;

  switch (config.providerType) {
    case AIProviderType.OpenAI:
      opts.openai = {
        reasoningSummary: 'detailed',
        ...(config.reasoningEffort ? { reasoningEffort: config.reasoningEffort } : {}),
      };
      break;

    case AIProviderType.Google:
      opts.google = {
        thinkingConfig: { includeThoughts: true },
      };
      break;

    case AIProviderType.Anthropic:
      opts.anthropic = {
        thinking: { type: 'enabled', budgetTokens: 10000 },
      };
      break;

    case AIProviderType.xAI:
      opts.xai = {
        reasoningEffort: config.reasoningEffort ?? 'high',
      };
      break;

    // OpenAI-compatible providers that support reasoning
    case AIProviderType.DeepSeek:
    case AIProviderType.Groq:
    case AIProviderType.Together:
    case AIProviderType.Mistral:
      if (config.reasoningEffort) {
        opts[config.providerType] = {
          reasoningEffort: config.reasoningEffort,
        };
      }
      break;

    default:
      break;
  }

  return opts;
}
