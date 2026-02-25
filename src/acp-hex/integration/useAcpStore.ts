import { create } from 'zustand';
import { eventBus } from '../domain';
import type { Message, ConnectionState, CliSessionInfo } from '../domain';
import { getAcpHex } from './bootstrap';

interface AcpState {
  // Connection
  connectionState: ConnectionState;
  connectionError: string | null;

  // Messages per session
  messages: Message[];
  isStreaming: boolean;
  streamingMessageId: string | null;

  // CLI Sessions
  cliSessions: CliSessionInfo[];
  isDiscoveringCli: boolean;

  // Watch state
  isWatching: boolean;

  // Selected session
  selectedSessionId: string | null;
}

interface AcpActions {
  // Connection
  connect(endpoint: string, transportType: 'websocket' | 'tcp'): Promise<void>;
  disconnect(): void;

  // Session
  selectSession(sessionId: string | null): Promise<void>;

  // Chat (unified — works for both ACP and CLI!)
  sendPrompt(text: string, attachments?: unknown[]): Promise<void>;
  cancelPrompt(): Promise<void>;

  // CLI
  discoverCliSessions(): Promise<void>;
  startCliWatch(): Promise<void>;
  stopCliWatch(): Promise<void>;
  spawnCliSession(command?: string, cwd?: string): Promise<{ sessionId: string; ptyId: string }>;
  killCliSession(sessionId: string): Promise<void>;

  // Terminal
  spawnTerminal(opts?: { shell?: string; cwd?: string; cols?: number; rows?: number }): Promise<{ terminalId: string; pid: number }>;
  sendTerminalInput(terminalId: string, data: string): Promise<void>;

  // Internal
  _subscribeToEvents(): () => void;
}

export const useAcpStore = create<AcpState & AcpActions>()((set, get) => {
  return {
    // Initial state
    connectionState: 'Disconnected',
    connectionError: null,
    messages: [],
    isStreaming: false,
    streamingMessageId: null,
    cliSessions: [],
    isDiscoveringCli: false,
    isWatching: false,
    selectedSessionId: null,

    // Actions
    async connect(endpoint, transportType) {
      const { createAcpHex } = await import('./bootstrap');
      const hex = createAcpHex({ endpoint, transportType });

      // Subscribe to events
      get()._subscribeToEvents();

      try {
        await hex.connect();
      } catch (error) {
        set({ connectionError: (error as Error).message });
        throw error;
      }
    },

    disconnect() {
      const hex = getAcpHex();
      hex?.disconnect();
      set({ connectionState: 'Disconnected', connectionError: null });
    },

    async selectSession(sessionId) {
      set({ selectedSessionId: sessionId, messages: [], isStreaming: false, streamingMessageId: null });

      if (!sessionId) return;

      const hex = getAcpHex();
      if (!hex) return;

      try {
        const messages = await hex.router.loadMessages(sessionId);
        if (messages.length > 0) {
          set({ messages });
        }
      } catch {
        // Messages may come via events instead
      }
    },

    async sendPrompt(text, attachments) {
      const { selectedSessionId } = get();
      if (!selectedSessionId) return;

      const hex = getAcpHex();
      if (!hex) return;

      set({ isStreaming: true });

      try {
        await hex.router.sendPrompt(selectedSessionId, text, attachments);
      } catch (error) {
        set({ isStreaming: false, connectionError: (error as Error).message });
      }
    },

    async cancelPrompt() {
      const { selectedSessionId } = get();
      if (!selectedSessionId) return;

      const hex = getAcpHex();
      if (!hex) return;

      try {
        await hex.session.cancel.execute(selectedSessionId);
      } catch {
        // Ignore cancel errors
      }
      set({ isStreaming: false });
    },

    async discoverCliSessions() {
      const hex = getAcpHex();
      if (!hex) return;

      set({ isDiscoveringCli: true });
      try {
        const sessions = await hex.cli.discover.execute();
        set({ cliSessions: sessions, isDiscoveringCli: false });
      } catch {
        set({ isDiscoveringCli: false });
      }
    },

    async startCliWatch() {
      const hex = getAcpHex();
      if (!hex) return;
      await hex.cli.watch.start();
      set({ isWatching: true });
    },

    async stopCliWatch() {
      const hex = getAcpHex();
      if (!hex) return;
      await hex.cli.watch.stop();
      set({ isWatching: false });
    },

    async spawnCliSession(command, cwd) {
      const hex = getAcpHex();
      if (!hex) throw new Error('Not connected');
      return hex.cli.spawn.execute(command, cwd);
    },

    async killCliSession(sessionId) {
      const hex = getAcpHex();
      if (!hex) return;
      await hex.cli.kill.execute(sessionId);
    },

    async spawnTerminal(opts) {
      const hex = getAcpHex();
      if (!hex) throw new Error('Not connected');
      return hex.terminal.spawn.execute(opts);
    },

    async sendTerminalInput(terminalId, data) {
      const hex = getAcpHex();
      if (!hex) return;
      await hex.terminal.input.execute(terminalId, data);
    },

    _subscribeToEvents() {
      const unsubs: Array<() => void> = [];

      // Connection state
      unsubs.push(eventBus.on('connection:stateChanged', (event) => {
        set({ connectionState: event.state, connectionError: null });

        // On reconnect, auto-restart CLI watch if was watching
        if (event.state === 'Connected' && get().isWatching) {
          get().discoverCliSessions();
        }
      }));

      // Messages received
      unsubs.push(eventBus.on('message:received', (event) => {
        const { selectedSessionId, messages } = get();
        if (String(event.sessionId) === selectedSessionId) {
          // Deduplicate
          const hex = getAcpHex();
          if (hex?.deduplicator.isDuplicate(String(event.sessionId), String(event.message.id))) return;

          set({ messages: [...messages, event.message] });
        }
      }));

      // Message updated (streaming chunks)
      unsubs.push(eventBus.on('message:updated', (event) => {
        const { selectedSessionId, messages } = get();
        if (String(event.sessionId) === selectedSessionId) {
          set({
            messages: messages.map(m =>
              String(m.id) === String(event.messageId) ? { ...m, ...event.updates } : m
            ),
          });
        }
      }));

      // Session updated (streaming state changes)
      unsubs.push(eventBus.on('session:updated', (event) => {
        const params = event.updates as Record<string, unknown>;
        if (params?.action === 'stop') {
          set({ isStreaming: false, streamingMessageId: null });
        }
      }));

      // CLI sessions discovered
      unsubs.push(eventBus.on('cli:discovered', (event) => {
        set({ cliSessions: event.sessions, isDiscoveringCli: false });
      }));

      // CLI delta (real-time updates)
      unsubs.push(eventBus.on('cli:delta', (event) => {
        const { selectedSessionId } = get();
        if (event.deltaType === 'new_turn' && selectedSessionId === `cli:${event.sessionId}`) {
          get().discoverCliSessions();
        } else if (event.deltaType === 'session_updated' || event.deltaType === 'new_session') {
          get().discoverCliSessions();
        }
      }));

      // Errors
      unsubs.push(eventBus.on('error:occurred', (event) => {
        set({ connectionError: event.message });
      }));

      // Watch state
      unsubs.push(eventBus.on('watch:started', () => set({ isWatching: true })));
      unsubs.push(eventBus.on('watch:stopped', () => set({ isWatching: false })));

      return () => unsubs.forEach(u => u());
    },
  };
});
