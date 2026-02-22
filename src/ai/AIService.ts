/**
 * Core AI service — streams chat completions using DeepAgent.
 * Provider factory and consensus chat are in separate modules.
 */

import { type JSONValue } from 'ai';
import { buildMCPTools } from '../mcp/MCPToolAdapter';
import { buildSearchTools } from '../search/SearchTools';
import {
  DeepAgent,
  ApproximateTokenCounter,
  VirtualFilesystemRN,
  AsyncStorageMemoryAdapter,
} from '../deep-agents';
import type { AgentEvent } from '../deep-agents';

import { AIProviderType, type AIProviderConfig } from './types';
import { createModel } from './providerFactory';
import { toCoreMessages } from './messageUtils';
import type { ChatMessage } from '../acp/models/types';

// Re-export for consumers that import from AIService
export { createModel } from './providerFactory';
export { streamConsensusChat } from './consensusChat';

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
