import type { SessionType, Message } from '../../domain';

// ─── Handler contracts (dependency inversion) ────────────────────────────────

interface SendPromptHandler {
  execute(sessionId: string, prompt: string, attachments?: unknown[]): Promise<void>;
}

interface LoadMessagesHandler {
  execute(sessionId: string): Promise<Message[]>;
}

// ─── Prefix → SessionType mapping ────────────────────────────────────────────

const PREFIX_MAP: Record<string, SessionType> = {
  'cli:': 'cli',
  'codex:': 'codex',
};

// ─── SessionRouter ───────────────────────────────────────────────────────────

export class SessionRouter {
  private sendPromptHandlers = new Map<SessionType, SendPromptHandler>();
  private loadMessagesHandlers = new Map<SessionType, LoadMessagesHandler>();

  registerSendPromptHandler(type: SessionType, handler: SendPromptHandler): void {
    this.sendPromptHandlers.set(type, handler);
  }

  registerLoadMessagesHandler(type: SessionType, handler: LoadMessagesHandler): void {
    this.loadMessagesHandlers.set(type, handler);
  }

  getSessionType(sessionId: string): SessionType {
    for (const [prefix, type] of Object.entries(PREFIX_MAP)) {
      if (sessionId.startsWith(prefix)) return type;
    }
    return 'acp';
  }

  async sendPrompt(
    sessionId: string,
    prompt: string,
    attachments?: unknown[],
  ): Promise<void> {
    const type = this.getSessionType(sessionId);
    const handler = this.sendPromptHandlers.get(type);
    if (!handler) {
      throw new Error(`No send prompt handler registered for session type: ${type}`);
    }
    await handler.execute(this.stripPrefix(sessionId, type), prompt, attachments);
  }

  async loadMessages(sessionId: string): Promise<Message[]> {
    const type = this.getSessionType(sessionId);
    const handler = this.loadMessagesHandlers.get(type);
    if (!handler) {
      throw new Error(`No load messages handler registered for session type: ${type}`);
    }
    return handler.execute(this.stripPrefix(sessionId, type));
  }

  canSendPrompt(sessionId: string): boolean {
    return this.sendPromptHandlers.has(this.getSessionType(sessionId));
  }

  // Strip known prefix so handlers receive the raw ID
  private stripPrefix(sessionId: string, type: SessionType): string {
    for (const [prefix, t] of Object.entries(PREFIX_MAP)) {
      if (t === type && sessionId.startsWith(prefix)) {
        return sessionId.slice(prefix.length);
      }
    }
    return sessionId;
  }
}
