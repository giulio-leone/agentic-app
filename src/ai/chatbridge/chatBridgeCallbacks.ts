/**
 * chatBridgeCallbacks — Connects ChatBridgeClient events to the Zustand store.
 *
 * Translates bridge server messages into ChatMessage updates and session management.
 */

import type { ChatBridgeCallbacks } from './ChatBridgeClient';
import type { CliAgent, SessionInfo, NetworkInfo, UsageInfo } from './types';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, MessageSegment } from '../../acp-hex/domain/types';
import {
  setActiveBridgeSessionId,
  getPendingBridgeMessage,
  setPendingBridgeMessage,
  getBridgeClient,
} from '../../stores/storePrivate';

// ── Store interface (injected to avoid circular deps) ──

export interface ChatBridgeStoreApi {
  get(): {
    chatMessages: ChatMessage[];
    selectedSessionId: string | null;
    isStreaming: boolean;
    streamingMessageId: string | null;
  };
  set(partial: Record<string, unknown>): void;
  appendLog(msg: string): void;
}

export function createChatBridgeCallbacks(store: ChatBridgeStoreApi): ChatBridgeCallbacks {
  // Track messageId → ChatMessage.id mapping
  const msgIdMap = new Map<string, string>();
  const textAccum = new Map<string, string>();
  const segmentAccum = new Map<string, MessageSegment[]>();

  return {
    onConnected() {
      store.appendLog('✓ Connected to Chat Bridge');
    },

    onDisconnected() {
      store.appendLog('✗ Disconnected from Chat Bridge');
      store.set({ isStreaming: false, streamingMessageId: null });
    },

    onError(error: string) {
      store.appendLog(`✗ Bridge error: ${error}`);
    },

    onSessionCreated(sessionId: string, cli: CliAgent, cwd: string) {
      setActiveBridgeSessionId(sessionId);
      store.appendLog(`✓ Session created: ${sessionId} (${cli} in ${cwd})`);

      // Flush any pending message that was queued before session existed
      const pending = getPendingBridgeMessage();
      if (pending) {
        setPendingBridgeMessage(null);
        const client = getBridgeClient();
        if (client && client.state === 'connected') {
          client.sendMessage(sessionId, pending);
          store.appendLog(`→ bridge/message (flushed pending, session: ${sessionId})`);
        }
      }
    },

    onSessionDestroyed(sessionId: string) {
      setActiveBridgeSessionId(null);
      setPendingBridgeMessage(null);
      store.appendLog(`Session destroyed: ${sessionId}`);
    },

    onSessionList(sessions: SessionInfo[]) {
      store.appendLog(`Sessions: ${sessions.length} active`);
    },

    onSessionEvent(sessionId: string, event: string, detail?: string) {
      store.appendLog(`Session ${sessionId}: ${event}${detail ? ` — ${detail}` : ''}`);
    },

    onAssistantStart(_sessionId: string, messageId: string) {
      const chatId = uuidv4();
      msgIdMap.set(messageId, chatId);
      textAccum.set(messageId, '');
      segmentAccum.set(messageId, []);

      const assistantMsg: ChatMessage = {
        id: chatId,
        role: 'assistant',
        content: '',
        segments: [],
        isStreaming: true,
        timestamp: new Date().toISOString(),
      };

      const state = store.get();
      store.set({
        chatMessages: [...state.chatMessages, assistantMsg],
        isStreaming: true,
        streamingMessageId: chatId,
      });
    },

    onAssistantChunk(_sessionId: string, messageId: string, text: string) {
      const chatId = msgIdMap.get(messageId);
      if (!chatId) return;

      const accum = (textAccum.get(messageId) ?? '') + text;
      textAccum.set(messageId, accum);

      const segments = segmentAccum.get(messageId) ?? [];
      const lastSeg = segments[segments.length - 1];
      if (lastSeg?.type === 'text') {
        lastSeg.content += text;
      } else {
        segments.push({ type: 'text', content: text });
      }
      segmentAccum.set(messageId, segments);

      const state = store.get();
      store.set({
        chatMessages: state.chatMessages.map((m) =>
          m.id === chatId
            ? { ...m, content: accum, segments: [...segments] }
            : m,
        ),
      });
    },

    onToolUse(_sessionId: string, messageId: string, toolName: string, input: Record<string, unknown>) {
      const chatId = msgIdMap.get(messageId);
      if (!chatId) return;

      const segments = segmentAccum.get(messageId) ?? [];
      segments.push({
        type: 'toolCall',
        toolName,
        input: JSON.stringify(input),
        isComplete: false,
      });
      segmentAccum.set(messageId, segments);

      const state = store.get();
      store.set({
        chatMessages: state.chatMessages.map((m) =>
          m.id === chatId ? { ...m, segments: [...segments] } : m,
        ),
      });
    },

    onToolResult(_sessionId: string, messageId: string, toolName: string, output: string, _isError?: boolean) {
      const chatId = msgIdMap.get(messageId);
      if (!chatId) return;

      const segments = segmentAccum.get(messageId) ?? [];
      for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i]!;
        if (seg.type === 'toolCall' && seg.toolName === toolName && !seg.isComplete) {
          seg.result = output;
          seg.isComplete = true;
          break;
        }
      }
      segmentAccum.set(messageId, segments);

      const state = store.get();
      store.set({
        chatMessages: state.chatMessages.map((m) =>
          m.id === chatId ? { ...m, segments: [...segments] } : m,
        ),
      });
    },

    onThinking(_sessionId: string, messageId: string, text: string) {
      const chatId = msgIdMap.get(messageId);
      if (!chatId) return;

      const segments = segmentAccum.get(messageId) ?? [];
      const lastSeg = segments[segments.length - 1];
      if (lastSeg?.type === 'thought') {
        lastSeg.content += text;
      } else {
        segments.push({ type: 'thought', content: text });
      }
      segmentAccum.set(messageId, segments);

      const state = store.get();
      const currentReasoning = state.chatMessages.find(m => m.id === chatId)?.reasoning ?? '';
      store.set({
        chatMessages: state.chatMessages.map((m) =>
          m.id === chatId
            ? { ...m, reasoning: currentReasoning + text, segments: [...segments] }
            : m,
        ),
      });
    },

    onAssistantEnd(_sessionId: string, messageId: string, stopReason?: string, _usage?: UsageInfo) {
      const chatId = msgIdMap.get(messageId);
      if (!chatId) return;

      const state = store.get();
      store.set({
        chatMessages: state.chatMessages.map((m) =>
          m.id === chatId ? { ...m, isStreaming: false } : m,
        ),
        isStreaming: false,
        streamingMessageId: null,
        stopReason: stopReason ?? null,
      });

      msgIdMap.delete(messageId);
      textAccum.delete(messageId);
      segmentAccum.delete(messageId);
    },

    onStatus(network: NetworkInfo, sessions: SessionInfo[], uptime: number) {
      store.appendLog(
        `Bridge status: ${sessions.length} sessions, uptime ${Math.round(uptime)}s` +
        (network.tailscale?.enabled ? `, tailscale: ${network.tailscale.ip}` : '') +
        (network.meshnet?.enabled ? `, meshnet: ${network.meshnet.ip}` : ''),
      );
    },
  };
}
