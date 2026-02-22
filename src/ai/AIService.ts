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

import { AIProviderType, type AIProviderConfig, type ConsensusConfig, type ConsensusDetails, DEFAULT_CONSENSUS_CONFIG } from './types';
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
  onReasoning?: (text: string) => void,
  _onToolCall?: (toolName: string, args: string) => void,
  _onToolResult?: (toolName: string, result: string) => void,
  onAgentEvent?: (event: AgentEvent) => void,
  consensusConfig?: ConsensusConfig,
  onConsensusUpdate?: (details: ConsensusDetails) => void,
): AbortController {
  const controller = new AbortController();
  const fs = new VirtualFilesystemRN();
  const cfg = consensusConfig ?? DEFAULT_CONSENSUS_CONFIG;

  (async () => {
    try {
      const defaultModel = await createModel(config, apiKey);

      // Build per-agent models (if not shared, and modelId is set)
      const agentModels = new Map<string, LanguageModel>();
      if (!cfg.useSharedModel) {
        for (const agent of cfg.agents) {
          if (agent.modelId && agent.modelId !== config.modelId) {
            agentModels.set(agent.id, await createModel({ ...config, modelId: agent.modelId }, apiKey));
          }
        }
      }
      const reviewerModel = (!cfg.useSharedModel && cfg.reviewerModelId && cfg.reviewerModelId !== config.modelId)
        ? await createModel({ ...config, modelId: cfg.reviewerModelId }, apiKey)
        : defaultModel;

      const coreMessages = toCoreMessages(messages);
      const userPrompt = coreMessages
        .filter(m => m.role === 'user')
        .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
        .join('\n');

      if (!userPrompt) throw new Error('No user prompt provided for Consensus Mode.');

      // Initialize consensus details for real-time tracking
      const details: ConsensusDetails = {
        agentResults: cfg.agents.map(a => ({
          agentId: a.id, role: a.role, output: '', status: 'pending' as const,
          modelId: cfg.useSharedModel ? config.modelId : (a.modelId ?? config.modelId),
        })),
        status: 'agents_running',
      };

      // Build analyst configs for the graph
      const analystConfigs = cfg.agents.map(agent => ({
        model: agentModels.get(agent.id) ?? defaultModel,
        maxSteps: 5,
        instructions: `You are a ${agent.role}. ${agent.instructions}`,
      }));

      // Build the Consensus Graph (analysts fork → final synthesizer, no input node)
      const graphBuilder = AgentGraph.create({ timeoutMs: 120_000, maxConcurrency: 3 })
        .withFilesystem(fs)
        .fork('analysts', analystConfigs)
        .consensus('analysts', new LlmJudgeConsensus({ model: reviewerModel }))
        .node('final', {
          model: defaultModel,
          instructions: 'You are the final synthesizer. Based on the consensus result, provide a coherent, unified response to the user. Do not explicitly mention the internal debate, just give the best answer.',
        })
        .edge('analysts', 'final');

      const graph = graphBuilder.build();
      const stream = graph.stream(userPrompt);

      for await (const event of stream) {
        if (controller.signal.aborted) break;
        const ev = event as Record<string, any>;

        switch (ev.type) {
          case 'graph:start':
            if (onReasoning) onReasoning(`🧠 Consensus graph started (${ev.nodeCount} nodes)\n`);
            break;

          case 'node:start':
            if (onReasoning) onReasoning(`▶ Node "${ev.nodeId}" started…\n`);
            break;

          case 'fork:start':
            // Mark all agents as running
            details.agentResults.forEach(a => { a.status = 'running'; });
            details.status = 'agents_running';
            onConsensusUpdate?.({ ...details, agentResults: [...details.agentResults] });
            if (onReasoning) onReasoning(`🔄 ${ev.agentCount} analysts started…\n`);
            break;

          case 'fork:partial': {
            // Update individual agents as they complete
            const partial = ev.partialResults as Array<{ nodeId: string; output: string }>;
            for (const r of partial) {
              const idx = details.agentResults.findIndex(a =>
                r.nodeId.includes(a.agentId) || details.agentResults.indexOf(
                  details.agentResults[parseInt(r.nodeId.replace(/\D/g, ''), 10)] ?? details.agentResults[0]
                ) >= 0
              );
              // Match by index (fork nodes are 0-indexed: analysts_0, analysts_1, etc.)
              const nodeIdx = parseInt(r.nodeId.replace(/\D/g, ''), 10);
              if (!isNaN(nodeIdx) && nodeIdx < details.agentResults.length) {
                details.agentResults[nodeIdx] = {
                  ...details.agentResults[nodeIdx],
                  output: r.output,
                  status: 'complete',
                };
              }
            }
            onConsensusUpdate?.({ ...details, agentResults: [...details.agentResults] });
            if (onReasoning) onReasoning(`📊 ${ev.completedCount}/${ev.totalCount} analysts complete\n`);
            break;
          }

          case 'fork:complete': {
            // All agents done - extract their outputs
            const results = ev.results as Array<{ nodeId: string; output: string }>;
            results.forEach((r, i) => {
              if (i < details.agentResults.length) {
                details.agentResults[i] = {
                  ...details.agentResults[i],
                  output: r.output,
                  status: 'complete',
                };
              }
            });
            onConsensusUpdate?.({ ...details, agentResults: [...details.agentResults] });
            // Emit full agent responses to reasoning
            if (onReasoning) {
              for (let i = 0; i < details.agentResults.length; i++) {
                const a = details.agentResults[i];
                onReasoning(`\n── ${a.role} ──\n${a.output}\n`);
              }
            }
            break;
          }

          case 'consensus:start':
            details.status = 'consensus_running';
            details.reviewerModelId = cfg.useSharedModel ? config.modelId : (cfg.reviewerModelId ?? config.modelId);
            onConsensusUpdate?.({ ...details, agentResults: [...details.agentResults] });
            if (onReasoning) onReasoning(`\n⚖️ Reviewer evaluating…\n`);
            break;

          case 'consensus:result': {
            // Build a human-readable reviewer verdict from reasoning + scores
            const reasoning = typeof ev.reasoning === 'string' ? ev.reasoning : '';
            const winnerId = typeof ev.winnerId === 'string' ? ev.winnerId : '';
            const scores = ev.scores as Record<string, number> | undefined;

            let verdictParts: string[] = [];
            if (reasoning) verdictParts.push(reasoning);
            if (scores && Object.keys(scores).length > 0) {
              const scoreLines = Object.entries(scores)
                .map(([id, score], i) => {
                  const agent = details.agentResults[i];
                  return `- **${agent?.role ?? id}**: ${score}/10`;
                }).join('\n');
              verdictParts.push(`\n**Scores:**\n${scoreLines}`);
            }
            if (winnerId) {
              const winIdx = parseInt(winnerId.replace(/\D/g, ''), 10);
              const winAgent = !isNaN(winIdx) ? details.agentResults[winIdx] : undefined;
              verdictParts.push(`\n**Winner:** ${winAgent?.role ?? winnerId}`);
            }

            details.reviewerVerdict = verdictParts.length > 0
              ? verdictParts.join('\n')
              : (typeof ev.output === 'string' ? ev.output.slice(0, 500) : '');
            details.status = 'complete';
            onConsensusUpdate?.({ ...details, agentResults: [...details.agentResults] });
            if (onReasoning && details.reviewerVerdict) {
              onReasoning(`⚖️ ${details.reviewerVerdict.slice(0, 500)}\n`);
            }
            break;
          }

          case 'node:complete':
            if (ev.nodeId === 'final' && ev.result?.output) {
              onChunk(ev.result.output);
            }
            break;

          case 'node:error': {
            // Fork sub-node errors are handled by the coordinator; only throw on critical nodes
            const failedNode = String(ev.nodeId ?? '');
            const errMsg = String(ev.error ?? 'unknown error');
            if (failedNode === 'final') {
              throw new Error(`Synthesis failed: ${errMsg}`);
            }
            // For analyst fork errors, log to reasoning but don't crash
            if (onReasoning) onReasoning(`⚠️ Node "${failedNode}" error: ${errMsg}\n`);
            break;
          }

          case 'graph:error':
            throw new Error(`Consensus graph failed: ${ev.error}`);
        }
      }

      // If we exit the loop without getting a final node result, emit whatever we have
      if (!controller.signal.aborted && details.status === 'complete' && details.reviewerVerdict) {
        onChunk(details.reviewerVerdict);
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
