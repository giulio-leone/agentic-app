/**
 * Consensus chat — streams a multi-agent consensus response using AgentGraph.
 * Forks parallel analyst agents, merges via LlmJudgeConsensus, synthesizes final output.
 */

import { type LanguageModel } from 'ai';
import {
  VirtualFilesystemRN,
  AgentGraph,
  LlmJudgeConsensus,
} from '../deep-agents';
import type { AgentEvent } from '../deep-agents';
import { type AIProviderConfig, type ConsensusConfig, type ConsensusDetails, DEFAULT_CONSENSUS_CONFIG } from './types';
import { createModel } from './providerFactory';
import { toCoreMessages } from './messageUtils';
import type { ChatMessage } from '../acp/models/types';

/**
 * Stream a chat completion using an AgentGraph that forks parallel analysts
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

      // Build the Consensus Graph (analysts fork → final synthesizer)
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
            details.agentResults.forEach(a => { a.status = 'running'; });
            details.status = 'agents_running';
            onConsensusUpdate?.({ ...details, agentResults: [...details.agentResults] });
            if (onReasoning) onReasoning(`🔄 ${ev.agentCount} analysts started…\n`);
            break;

          case 'fork:partial': {
            const partial = ev.partialResults as Array<{ nodeId: string; output: string }>;
            for (const r of partial) {
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
            const failedNode = String(ev.nodeId ?? '');
            const errMsg = String(ev.error ?? 'unknown error');
            if (failedNode === 'final') {
              throw new Error(`Synthesis failed: ${errMsg}`);
            }
            if (onReasoning) onReasoning(`⚠️ Node "${failedNode}" error: ${errMsg}\n`);
            break;
          }

          case 'graph:error':
            throw new Error(`Consensus graph failed: ${ev.error}`);
        }
      }

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
