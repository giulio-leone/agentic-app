/**
 * AI streaming helper — creates and wires up the AI streaming pipeline.
 * Extracted from chatSlice to reduce slice complexity.
 */

import { v4 as uuidv4 } from 'uuid';
import { Alert } from 'react-native';
import type { ChatMessage, MessageSegment } from '../../acp/models/types';
import type { AIProviderConfig, ConsensusDetails } from '../../ai/types';
import { streamChat, streamConsensusChat } from '../../ai/AIService';
import { updateMessageById, detectArtifacts } from '../helpers';
import { SessionStorage } from '../../storage/SessionStorage';
import { isAppInBackground, notifyResponseComplete } from '../../services/notifications';
import { setAiAbortController } from '../storePrivate';

import type { AppState, AppActions } from '../stores/appStore';

export interface StreamContext {
  set: (partial: Partial<AppState> | ((s: AppState & AppActions) => Partial<AppState>)) => void;
  get: () => AppState & AppActions;
  chatStorageId: () => string | null;
}

/** Maps agent event types to user-visible labels. */
export function agentEventLabel(type: string, data: unknown): string | null {
  const d = data as Record<string, unknown> | undefined;
  switch (type) {
    case 'planning:update':
      return '📋 Planning updated';
    case 'subagent:spawn':
      return '🔀 Sub-agent started';
    case 'subagent:complete':
      return '✅ Sub-agent completed';
    case 'step:start':
      return `⚡ Step ${((d?.stepIndex as number) ?? 0) + 1}`;
    case 'context:summarize':
      return '📝 Context summarized';
    case 'checkpoint:save':
      return '💾 Checkpoint saved';
    case 'terminal_command':
      return `🖥️ ${(d?.name as string) || 'command'}`;
    case 'terminal_output': {
      const name = (d?.name as string) || 'command';
      const exitCode = (d?.exitCode as number | undefined);
      return exitCode === 0 || exitCode === undefined ? `📤 ${name}` : `❌ ${name} (exit ${exitCode})`;
    }
    case 'file_edit':
      return `✏️ ${(d?.name as string) || 'file'}`;
    case 'file_read':
      return `📄 ${(d?.name as string) || 'file'}`;
    case 'reasoning':
      return '💭 Reasoning';
    case 'tool_call':
      return `🔧 ${(d?.name as string) || 'tool'}`;
    case 'tool_result':
      return '✅ Tool completed';
    default:
      return type ? `📎 ${type}` : null;
  }
}

/**
 * Starts AI streaming (normal or consensus mode).
 * Creates assistant message, wires callbacks, starts the stream.
 */
export function startAIStream(
  config: AIProviderConfig,
  apiKey: string,
  ctx: StreamContext,
) {
  const assistantId = uuidv4();
  const forceAgentMode = ctx.get().agentModeEnabled;
  const server = ctx.get().servers.find((s) => s.id === ctx.get().selectedServerId);

  ctx.set((s) => ({
    chatMessages: [...s.chatMessages, {
      id: assistantId,
      role: 'assistant' as const,
      content: '',
      isStreaming: true,
      timestamp: new Date().toISOString(),
      serverId: server?.id,
      serverName: server?.name,
    }],
    streamingMessageId: assistantId,
    isStreaming: true,
  }));

  const contextMessages = ctx.get().chatMessages.filter((m: ChatMessage) => m.id !== assistantId);
  const isConsensusMode = ctx.get().consensusModeEnabled;

  const onChunk = (chunk: string) => {
    ctx.set((s) => ({
      chatMessages: updateMessageById(s.chatMessages, assistantId, (m: ChatMessage) => ({
        ...m, content: m.content + chunk,
      })),
    }));
  };

  const onComplete = (stopReason: string) => {
    setAiAbortController(null);
    const finalMessage = ctx.get().chatMessages.find((m: ChatMessage) => m.id === assistantId);
    const artifacts = finalMessage ? detectArtifacts(finalMessage.content) : [];
    const normalized = typeof stopReason === 'string' && stopReason.trim().length > 0
      ? stopReason : 'unknown';
    const finalContent = finalMessage?.content.trim() ?? '';

    ctx.set((s) => ({
      chatMessages: updateMessageById(s.chatMessages, assistantId, (m: ChatMessage) => ({
        ...m,
        content: finalContent.length === 0
          ? `⚠️ Empty response from model (stop reason: ${normalized}).`
          : m.content,
        isStreaming: false,
        ...(artifacts.length > 0 ? { artifacts } : {}),
      })),
      isStreaming: false,
      streamingMessageId: null,
      stopReason: normalized,
    }));

    if (finalContent.length === 0) {
      ctx.get().appendLog(`✗ AI stream ended with empty response (stop reason: ${normalized})`);
    }
    const finalState = ctx.get();
    const sid = ctx.chatStorageId();
    if (sid && finalState.selectedSessionId) {
      SessionStorage.saveMessages(finalState.chatMessages, sid, finalState.selectedSessionId)
        .catch(e => ctx.get().appendLog(`✗ Save messages failed: ${e.message}`));
    }
    if (isAppInBackground() && finalContent.length > 0) {
      notifyResponseComplete(finalContent)
        .catch(() => { /* notification failure is non-critical */ });
    }
  };

  const onError = (error: Error) => {
    setAiAbortController(null);
    ctx.get().appendLog(`✗ AI stream error: ${error.message}`);
    ctx.set((s) => ({
      chatMessages: [
        ...s.chatMessages.filter((m: ChatMessage) => m.id !== assistantId),
        { id: uuidv4(), role: 'system', content: `⚠️ Error: ${error.message}`, timestamp: new Date().toISOString() },
      ],
      isStreaming: false,
      streamingMessageId: null,
    }));
  };

  const onReasoning = (chunk: string) => {
    ctx.set((s) => ({
      chatMessages: updateMessageById(s.chatMessages, assistantId, (m: ChatMessage) => ({
        ...m, reasoning: (m.reasoning ?? '') + chunk,
      })),
    }));
  };

  const onToolCall = (toolName: string, args: string) => {
    ctx.set((s) => ({
      chatMessages: updateMessageById(s.chatMessages, assistantId, (m: ChatMessage) => {
        const segs = m.segments ?? [];
        const last = segs[segs.length - 1];
        if (last && last.type === 'toolCall' && last.toolName === toolName && !last.isComplete) {
          const updated = [...segs];
          updated[segs.length - 1] = { ...last, callCount: (last.callCount ?? 1) + 1, input: args };
          return { ...m, segments: updated };
        }
        const seg: MessageSegment = {
          type: 'toolCall', toolName, input: args, isComplete: false, callCount: 1, completedCount: 0,
        };
        return { ...m, segments: [...segs, seg] };
      }),
    }));
  };

  const onToolResult = (toolName: string, result: string) => {
    ctx.set((s) => ({
      chatMessages: updateMessageById(s.chatMessages, assistantId, (m: ChatMessage) => {
        let matched = false;
        const segments = (m.segments ?? []).map((seg: MessageSegment) => {
          if (!matched && seg.type === 'toolCall' && seg.toolName === toolName && !seg.isComplete) {
            matched = true;
            const completed = (seg.completedCount ?? 0) + 1;
            return { ...seg, result, completedCount: completed, isComplete: completed >= (seg.callCount ?? 1) };
          }
          return seg;
        });
        return { ...m, segments };
      }),
    }));
  };

  const onAgentEvent = (event: { type: string; data: Record<string, unknown> }) => {
    const label = agentEventLabel(event.type, event.data);
    if (!label) return;
    const segment: MessageSegment = {
      type: 'agentEvent', eventType: event.type, label,
      detail: typeof event.data === 'object' ? JSON.stringify(event.data) : undefined,
    };
    ctx.set((s) => ({
      chatMessages: updateMessageById(s.chatMessages, assistantId, (m: ChatMessage) => ({
        ...m, segments: [...(m.segments ?? []), segment],
      })),
    }));
  };

  const onConsensusUpdate = (details: ConsensusDetails) => {
    ctx.set((s) => ({
      chatMessages: updateMessageById(s.chatMessages, assistantId, (m: ChatMessage) => ({
        ...m, consensusDetails: details,
      })),
    }));
  };

  if (isConsensusMode) {
    setAiAbortController(streamConsensusChat(
      contextMessages, config, apiKey,
      onChunk, onComplete, onError, onReasoning,
      onToolCall, onToolResult, onAgentEvent,
      ctx.get().consensusConfig, onConsensusUpdate,
    ));
  } else {
    setAiAbortController(streamChat(
      contextMessages, config, apiKey,
      onChunk, onComplete, onError, onReasoning,
      onToolCall, onToolResult, onAgentEvent,
      forceAgentMode,
      (req) => new Promise((resolve) => {
        if (ctx.get().yoloModeEnabled) return resolve(true);
        Alert.alert(
          'Tool Execution Approval',
          `The agent wants to run '${req.toolName}'.\n\nArguments:\n${JSON.stringify(req.args, null, 2)}`,
          [
            { text: 'Deny', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Approve', style: 'default', onPress: () => resolve(true) },
          ],
          { cancelable: false },
        );
      }),
    ));
  }
}
