import type { ACPGateway } from '../services/ACPGateway';
import {
  type SessionId,
  type MessageId,
  type Message,
  type CliSessionInfo,
  createMessage,
  eventBus,
} from '../../domain';

// ─── DiscoverCliSessions ─────────────────────────────────────────────────────

export class DiscoverCliSessions {
  constructor(private gateway: ACPGateway) {}

  async execute(): Promise<CliSessionInfo[]> {
    const result = await this.gateway.request<{ sessions: CliSessionInfo[] }>(
      'copilot/discover',
    );
    eventBus.emit({
      type: 'cli:discovered',
      sessions: result.sessions,
      timestamp: Date.now(),
    });
    return result.sessions;
  }
}

// ─── LoadCliSessionTurns ─────────────────────────────────────────────────────

interface Turn {
  turnIndex: number;
  userMessage: string;
  assistantResponse: string;
}

export class LoadCliSessionTurns {
  constructor(private gateway: ACPGateway) {}

  async execute(sessionId: string): Promise<Message[]> {
    const result = await this.gateway.request<{ turns: Turn[] }>(
      'copilot/sessions/turns',
      { sessionId },
    );

    const messages: Message[] = [];
    for (const turn of result.turns) {
      if (turn.userMessage) {
        messages.push(createUserMessage(sessionId, turn.turnIndex, turn.userMessage));
      }
      if (turn.assistantResponse) {
        messages.push(createAssistantMessage(sessionId, turn.turnIndex, turn.assistantResponse));
      }
    }
    return messages;
  }
}

// ─── SendPromptToCliSession ──────────────────────────────────────────────────
// Solves the read-only CLI problem: enables bidirectional communication
// by writing to the CLI session's stdin via copilot/write.
// The response arrives asynchronously via copilot/delta notifications
// which the ACPGateway routes to the EventBus.

export class SendPromptToCliSession {
  constructor(private gateway: ACPGateway) {}

  async execute(sessionId: string, prompt: string): Promise<void> {
    const userMessage = createMessage({
      id: `cli-${sessionId}-user-${Date.now()}` as MessageId,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      sessionId: `cli:${sessionId}` as SessionId,
    });

    eventBus.emit({
      type: 'message:received',
      message: userMessage,
      sessionId: `cli:${sessionId}` as SessionId,
      timestamp: Date.now(),
    });

    await this.gateway.request<{ success: boolean }>('copilot/write', {
      sessionId,
      input: prompt + '\n',
      closeStdin: false,
    });
  }
}

// ─── SpawnCliSession ─────────────────────────────────────────────────────────

export class SpawnCliSession {
  constructor(private gateway: ACPGateway) {}

  async execute(
    command?: string,
    cwd?: string,
  ): Promise<{ sessionId: string; ptyId: string }> {
    return this.gateway.request<{ sessionId: string; ptyId: string }>(
      'copilot/spawn',
      { command, cwd },
    );
  }
}

// ─── KillCliSession ──────────────────────────────────────────────────────────

export class KillCliSession {
  constructor(private gateway: ACPGateway) {}

  async execute(sessionId: string): Promise<void> {
    await this.gateway.request<{ success: boolean }>('copilot/kill', {
      sessionId,
    });
  }
}

// ─── WatchCliSessions ────────────────────────────────────────────────────────
// Solves the real-time problem: reconnect-aware lifecycle that
// automatically restarts the watch subscription after reconnection.

export class WatchCliSessions {
  private unsubscribeReconnect: (() => void) | null = null;

  constructor(private gateway: ACPGateway) {}

  async start(): Promise<void> {
    await this.gateway.request<{ success: boolean }>('copilot/watch/start');
    eventBus.emit({ type: 'watch:started', timestamp: Date.now() });

    this.unsubscribeReconnect = eventBus.on(
      'connection:stateChanged',
      async (event) => {
        if (
          event.state === 'Connected' &&
          event.previousState !== 'Disconnected'
        ) {
          try {
            await this.gateway.request<{ success: boolean }>(
              'copilot/watch/start',
            );
            eventBus.emit({ type: 'watch:started', timestamp: Date.now() });
          } catch {
            eventBus.emit({
              type: 'error:occurred',
              code: 'WATCH_RESTART_FAILED',
              message: 'Failed to restart CLI watch after reconnect',
              timestamp: Date.now(),
            });
          }
        }
      },
    );
  }

  async stop(): Promise<void> {
    this.unsubscribeReconnect?.();
    this.unsubscribeReconnect = null;
    await this.gateway.request<{ success: boolean }>('copilot/watch/stop');
    eventBus.emit({ type: 'watch:stopped', timestamp: Date.now() });
  }

  dispose(): void {
    this.unsubscribeReconnect?.();
    this.unsubscribeReconnect = null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createUserMessage(
  sessionId: string,
  turnIndex: number,
  content: string,
): Message {
  return createMessage({
    id: `cli-${sessionId}-user-${turnIndex}` as MessageId,
    role: 'user',
    content,
    timestamp: Date.now(),
    sessionId: `cli:${sessionId}` as SessionId,
  });
}

function createAssistantMessage(
  sessionId: string,
  turnIndex: number,
  content: string,
): Message {
  return createMessage({
    id: `cli-${sessionId}-assistant-${turnIndex}` as MessageId,
    role: 'assistant',
    content,
    timestamp: Date.now(),
    sessionId: `cli:${sessionId}` as SessionId,
  });
}
