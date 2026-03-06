/**
 * chatBridgeCallbacks — Connects ChatBridgeClient events to the Zustand store.
 *
 * Translates bridge server messages into ChatMessage updates and session management.
 */

import type { ChatBridgeCallbacks } from './ChatBridgeClient';
import type { CliAgent, SessionInfo, NetworkInfo, UsageInfo } from './types';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, MessageSegment, SessionSummary } from '../../acp-hex/domain/types';
import { SessionStorage } from '../../storage/SessionStorage';
import {
  setActiveBridgeSessionId,
  getActiveBridgeSessionId,
  getPendingBridgeMessage,
  setPendingBridgeMessage,
  getBridgeClient,
} from '../../stores/storePrivate';

// ── Store interface (injected to avoid circular deps) ──

export interface ChatBridgeStoreApi {
  get(): {
    chatMessages: ChatMessage[];
    sessions: SessionSummary[];
    selectedSessionId: string | null;
    selectedServerId: string | null;
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
  const mapBridgeSession = (s: SessionInfo): SessionSummary => ({
    id: `bridge:${s.id}`,
    title: s.title || `${s.cli} • ${s.cwd.split('/').pop() || s.cwd}`,
    description: `${s.cli} • ${s.cwd}`,
    cwd: s.cwd,
    createdAt: s.createdAt,
    updatedAt: s.lastActivity || s.createdAt,
    isAlive: s.alive,
  });
  const mergeBridgeSessions = (incoming: SessionSummary[]): SessionSummary[] => {
    const current = store.get().sessions;
    const local = current.filter((s) => !s.id.startsWith('bridge:'));
    return [...incoming, ...local];
  };

  /** Persist current chatMessages to AsyncStorage under the active session. */
  function persistMessages(sessionIdOverride?: string) {
    const { chatMessages, selectedSessionId, selectedServerId } = store.get();
    const sid = selectedServerId;
    const sessionId = sessionIdOverride ?? selectedSessionId;
    if (!sid || !sessionId || chatMessages.length === 0) return;
    // Strip base64 from attachments to avoid overflowing storage
    const clean = chatMessages.map(m =>
      m.attachments ? { ...m, attachments: m.attachments.map(a => ({ ...a, base64: undefined })) } : m,
    );
    console.log(`[CB:cb] persistMessages: sid=${sid} sessionId=${sessionId} count=${clean.length}`);
    SessionStorage.saveMessages(clean, sid, sessionId).catch(() => {});
  }

  /** Migrate messages stored under oldId to newId in AsyncStorage. */
  async function migrateMessages(oldId: string, newId: string) {
    const { selectedServerId } = store.get();
    if (!selectedServerId) return;
    try {
      const msgs = await SessionStorage.fetchMessages(selectedServerId, oldId);
      if (msgs.length > 0) {
        console.log(`[CB:cb] migrateMessages: ${oldId} → ${newId} (${msgs.length} msgs)`);
        await SessionStorage.saveMessages(msgs, selectedServerId, newId);
        await SessionStorage.deleteMessages(selectedServerId, oldId);
      }
    } catch (e) {
      console.warn('[CB:cb] migrateMessages failed:', e);
    }
  }

  return {
    onConnected() {
      store.appendLog('✓ Connected to Chat Bridge');
      console.log('[CB:cb] onConnected');
    },

    onDisconnected() {
      store.appendLog('✗ Disconnected from Chat Bridge');
      console.log('[CB:cb] onDisconnected');
      setPendingBridgeMessage(null);
      store.set({ isStreaming: false, streamingMessageId: null });
    },

    onError(error: string) {
      store.appendLog(`✗ Bridge error: ${error}`);
      console.warn('[CB:cb] onError:', error);
    },

    onSessionCreated(sessionId: string, cli: CliAgent, cwd: string) {
      setActiveBridgeSessionId(sessionId);
      store.appendLog(`✓ Session created: ${sessionId} (${cli} in ${cwd})`);
      console.log(`[CB:cb] onSessionCreated id=${sessionId} cli=${cli} cwd=${cwd}`);
      const bridgeId = `bridge:${sessionId}`;
      const now = new Date().toISOString();
      const state = store.get();
      const summary: SessionSummary = {
        id: bridgeId,
        title: `${cli} • ${cwd.split('/').pop() || cwd}`,
        description: `${cli} • ${cwd}`,
        cwd,
        createdAt: now,
        updatedAt: now,
        isAlive: true,
      };

      // Replace the local placeholder session (non-bridge: ID) with the real bridge session,
      // and update selectedSessionId to point to the bridge session
      const currentSelected = state.selectedSessionId;
      const isPlaceholder = currentSelected && !currentSelected.startsWith('bridge:') && !currentSelected.startsWith('cli:');
      const updatedSessions = isPlaceholder
        ? [summary, ...state.sessions.filter(s => s.id !== currentSelected && s.id !== bridgeId)]
        : state.sessions.some(s => s.id === bridgeId)
          ? state.sessions.map(s => (s.id === bridgeId ? { ...s, ...summary } : s))
          : [summary, ...state.sessions];

      store.set({
        sessions: updatedSessions,
        ...(isPlaceholder ? { selectedSessionId: bridgeId } : {}),
      });
      console.log(`[CB:cb] onSessionCreated: placeholder=${!!isPlaceholder}, selectedId=${isPlaceholder ? bridgeId : state.selectedSessionId}, sessions=${updatedSessions.length}`);

      // Migrate persisted messages from placeholder ID → bridge:xxx ID
      if (isPlaceholder && currentSelected) {
        migrateMessages(currentSelected, bridgeId);
      }

      // Persist bridge session to AsyncStorage
      const serverId = state.selectedServerId;
      if (serverId) {
        SessionStorage.saveSession(summary, serverId).catch(() => {});
        // Also remove the old placeholder session from storage
        if (isPlaceholder && currentSelected) {
          SessionStorage.deleteSession(currentSelected, serverId).catch(() => {});
        }
      }

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
      const bridgeId = `bridge:${sessionId}`;
      const state = store.get();
      if (state.selectedSessionId === bridgeId) {
        setActiveBridgeSessionId(null);
        store.set({ selectedSessionId: null, chatMessages: [] });
      } else if (getActiveBridgeSessionId() === sessionId) {
        setActiveBridgeSessionId(null);
      }
      setPendingBridgeMessage(null);
      store.set({ sessions: state.sessions.filter((s) => s.id !== bridgeId) });
      store.appendLog(`Session destroyed: ${sessionId}`);
    },

    onSessionList(sessions: SessionInfo[]) {
      const merged = mergeBridgeSessions(sessions.map(mapBridgeSession));
      store.set({ sessions: merged });
      store.appendLog(`Sessions: ${sessions.length} active`);
      console.log(`[CB:cb] onSessionList: ${sessions.length} bridge sessions, ${merged.length} total`);
    },

    onSessionEvent(sessionId: string, event: string, detail?: string) {
      store.appendLog(`Session ${sessionId}: ${event}${detail ? ` — ${detail}` : ''}`);
      console.log(`[CB:cb] onSessionEvent: ${sessionId} ${event} ${detail || ''}`);
    },

    onAssistantStart(_sessionId: string, messageId: string) {
      console.log(`[CB:cb] onAssistantStart: session=${_sessionId} msg=${messageId}`);
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
      console.log(`[CB:cb] onAssistantEnd: session=${_sessionId} msg=${messageId} chatId=${chatId} reason=${stopReason}`);

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

      // Persist messages to AsyncStorage so they survive session re-selection
      persistMessages();
    },

    onStatus(network: NetworkInfo, sessions: SessionInfo[], uptime: number) {
      store.set({ sessions: mergeBridgeSessions(sessions.map(mapBridgeSession)) });
      store.appendLog(
        `Bridge status: ${sessions.length} sessions, uptime ${Math.round(uptime)}s` +
        (network.tailscale?.enabled ? `, tailscale: ${network.tailscale.ip}` : '') +
        (network.meshnet?.enabled ? `, meshnet: ${network.meshnet.ip}` : ''),
      );
    },
  };
}
