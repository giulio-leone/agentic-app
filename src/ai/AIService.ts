/**
 * Core AI service — creates provider models and streams chat completions.
 * Provider SDKs are lazily loaded to reduce initial bundle size.
 */

import { type ModelMessage, type LanguageModel, type JSONValue } from 'ai';
import { buildMCPTools } from '../mcp/MCPToolAdapter';
import { buildSearchTools } from '../search/SearchTools';
import {
  DeepAgent,
  ApproximateTokenCounter,
  VirtualFilesystemRN,
  AsyncStorageMemoryAdapter,
  AgentGraph,
  LlmJudgeConsensus,
} from '../deep-agents';
import type { AgentEvent } from '../deep-agents';

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
 * Stream a chat completion using DeepAgent. Returns an `AbortController` the
 * caller can use to cancel. The AI autonomously decides whether to use
 * planning, subagents, or simple response based on task complexity.
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
  onAgentEvent?: (event: AgentEvent) => void,
  forceAgentMode?: boolean,
  onApprovalRequired?: (req: any) => Promise<boolean>,
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const model = await createModel(config, apiKey);
      const coreMessages = toCoreMessages(messages);
      const providerOptions = buildProviderOptions(config);

      // Build tools (MCP + search)
      const mcpTools = buildMCPTools();
      const searchTools = config.webSearchEnabled !== false ? buildSearchTools() : {};
      const externalTools = { ...mcpTools, ...searchTools };
      const hasTools = Object.keys(externalTools).length > 0;

      // Build system prompt
      const systemPrompt = buildSystemPrompt(config, externalTools, forceAgentMode);

      // Create DeepAgent with all capabilities
      const builder = DeepAgent.create({
        model,
        instructions: systemPrompt,
        maxSteps: 15,
      })
        .withFilesystem(new VirtualFilesystemRN())
        .withMemory(new AsyncStorageMemoryAdapter())
        .withTokenCounter(new ApproximateTokenCounter())
        .withPlanning()
        .withSubagents({ maxDepth: 2, timeoutMs: 120_000 });

      if (onApprovalRequired) {
        builder.withApproval({
          defaultMode: 'approve-all',
          // Always ask for potentially destructive or impactful actions
          requireApproval: ['write_file', 'edit_file', 'delete_file', 'web_search', 'run_command'],
          onApprovalRequired,
        });
      }

      // Add external tools (search + MCP)
      if (hasTools) {
        builder.withTools(externalTools);
      }

      // Wire event bus for UI updates
      if (onAgentEvent) {
        builder.on('*', onAgentEvent);
      }

      const agent = builder.build();

      // Use DeepAgent.stream() — returns StreamTextResult (same as streamText)
      // Cast needed: DeepAgent types are narrow but ToolLoopAgent.stream() accepts full AgentStreamParameters
      const result = await agent.stream({
        messages: coreMessages as Array<{ role: string; content: unknown }>,
        abortSignal: controller.signal,
        ...(Object.keys(providerOptions).length > 0 ? { providerOptions } : {}),
      } as any);

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
      await agent.dispose();
      onComplete(reason ?? 'unknown');
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        onComplete('abort');
        return;
      }
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

// ── consensus streaming chat ─────────────────────────────────────────────────

/**
 * Stream a chat completion using an AgentGraph that forks 3 parallel analysts
 * and merges their outputs using LlmJudgeConsensus.
 */
export function streamConsensusChat(
  messages: ChatMessage[],
  config: AIProviderConfig,
  apiKey: string,
  onChunk: (text: string) => void,
  onComplete: (stopReason: string) => void,
  onError: (error: Error) => void,
  onAgentEvent?: (event: AgentEvent) => void,
): AbortController {
  const controller = new AbortController();
  const fs = new VirtualFilesystemRN();

  (async () => {
    try {
      const model = await createModel(config, apiKey);
      const coreMessages = toCoreMessages(messages);
      const userPrompt = coreMessages
        .filter(m => m.role === 'user')
        .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
        .join('\n');

      if (!userPrompt) {
        throw new Error('No user prompt provided for Consensus Mode.');
      }

      // Base configuration for our analysts
      const baseAgentConfig = {
        model,
        maxSteps: 5,
      };

      // Define 3 diverse analysts
      const analystConfigs = [
        {
          ...baseAgentConfig,
          instructions: 'You are an optimistic analyst. Focus on the positive aspects, potential opportunities, and creative solutions to the problem.',
        },
        {
          ...baseAgentConfig,
          instructions: 'You are a critical, pessimistic analyst. Focus on risks, edge cases, potential failures, and constraints.',
        },
        {
          ...baseAgentConfig,
          instructions: 'You are a pragmatic, logical analyst. Focus on the facts, straightforward implementations, and step-by-step reasoning.',
        },
      ];

      // Build the Consensus Graph
      const graph = AgentGraph.create()
        .withFilesystem(fs)
        .node('input', {
          model,
          instructions: 'Pass the prompt directly to the analysts.',
        })
        .fork('analysts', analystConfigs)
        .consensus('analysts', new LlmJudgeConsensus({ model }))
        .edge('input', 'analysts')
        .node('final', {
          model,
          instructions: 'You are the final synthesizer. Based on the consensus result, provide a coherent, unified response to the user. Do not explicitly mention the internal debate, just give the best answer.',
        })
        .edge('analysts', 'final')
        .build();

      // Execute graph via generator
      const stream = graph.stream(userPrompt);

      for await (const event of stream) {
        if (controller.signal.aborted) break;

        switch (event.type) {
          case 'node:start':
            if (onAgentEvent) {
              onAgentEvent({
                type: 'subagent:spawn',
                data: { nodeId: event.nodeId },
                timestamp: Date.now(),
                sessionId: 'graph', // Minimal polyfill for AgentEvent requirements
              });
            }
            break;

          case 'node:complete':
            if (onAgentEvent) {
              onAgentEvent({
                type: 'subagent:complete',
                data: { nodeId: event.nodeId },
                timestamp: Date.now(),
                sessionId: 'graph',
              });
            }
            // If the final node completes, we also extract its output to the UI stream
            if (event.nodeId === 'final' && event.result?.output) {
              onChunk(event.result.output);
            }
            break;

          case 'consensus:start':
            if (onAgentEvent) {
              onAgentEvent({
                type: 'subagent:spawn',
                data: { nodeId: `consensus-${event.forkId}` },
                timestamp: Date.now(),
                sessionId: 'graph',
              });
            }
            break;

          case 'consensus:result':
            if (onAgentEvent) {
              onAgentEvent({
                type: 'subagent:complete',
                data: { nodeId: `consensus-${event.forkId}` },
                timestamp: Date.now(),
                sessionId: 'graph',
              });
            }
            break;

          case 'graph:complete':
            // Execution done
            break;

          case 'node:error':
            throw new Error(`Graph error in node ${event.nodeId}: ${event.error}`);

          case 'graph:error':
            throw new Error(`Graph execution error: ${event.error}`);
        }
      }

      onComplete('stop');
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        onComplete('abort');
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      onError(err instanceof Error ? err : new Error(msg));
    }
  })();

  return controller;
}

// ── system prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(
  config: AIProviderConfig,
  tools: Record<string, unknown>,
  forceAgentMode?: boolean,
): string {
  const toolNames = Object.keys(tools);
  const hasSearchTools = 'web_search' in tools;
  let systemPrompt = config.systemPrompt || '';

  // Current date/time from device
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (!systemPrompt) {
    const parts: string[] = [
      'You are a helpful AI assistant with agentic capabilities.',
      `Current date and time: ${dateStr}, ${timeStr} (${timezone}).`,
      'Always respond in the same language as the user\'s message unless explicitly asked to use a different language.',
      '',
      '## Task Complexity Guidelines',
      'For simple questions (greetings, quick facts, translations, small tasks), respond directly without using planning tools.',
      'For complex multi-step tasks (research, analysis, building plans, comparing multiple sources), use the write_todos and review_todos tools to decompose the work into steps and track progress.',
      'For tasks that can be parallelized, use the task tool to delegate sub-tasks to specialized sub-agents.',
      '',
      '## File Tools',
      'You can read, write, edit, and search files in a virtual workspace using ls, read_file, write_file, edit_file, glob, and grep tools.',
    ];
    if (hasSearchTools) {
      parts.push(
        '',
        '## Web Search',
        'Use web_search for current events, recent news, real-time data, or anything you\'re unsure about.',
        'Use read_webpage to get detailed content from a specific URL.',
        'Use scrape_many to read multiple pages in parallel.',
      );
    }
    const otherTools = toolNames.filter(t =>
      !['web_search', 'read_webpage', 'scrape_many'].includes(t)
    );
    if (otherTools.length > 0) {
      parts.push(`\n## Additional Tools\nYou also have: ${otherTools.join(', ')}.`);
    }
    systemPrompt = parts.join('\n');
  } else {
    // Custom prompt: prepend date/time
    systemPrompt = `Current date and time: ${dateStr}, ${timeStr} (${timezone}).\n\n${systemPrompt}`;
  }

  // Force agent mode: prepend mandatory planning instructions
  if (forceAgentMode) {
    systemPrompt += `\n\n## 🤖 AGENTIC MODE (ACTIVE)
You MUST follow this structured approach for EVERY response:

### Output Format
1. **📋 Plan** — Start EVERY response with a visible plan section:
   \`\`\`
   ## 📋 Plan
   - [ ] Step 1: description
   - [ ] Step 2: description
   ...
   \`\`\`
2. **⚡ Execution** — For each step, show your work under a header:
   \`\`\`
   ### Step 1: description
   [your work here]
   ✅ Done
   \`\`\`
3. **📊 Summary** — End with a summary of what was accomplished and updated checklist with [x] for completed items.

### Rules
- ALWAYS show the plan as a markdown checklist (- [ ] / - [x]) so the user can see progress.
- For multi-step tasks, update the checklist as you complete each step.
- Use sub-headings (###) for each step.
- If using tools, explain what you're doing before and after each tool call.
- NEVER skip the plan. Even for simple questions, show at least: Plan → Execute → Summary.
- Think step-by-step and show your reasoning.`;
  }

  return systemPrompt;
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
