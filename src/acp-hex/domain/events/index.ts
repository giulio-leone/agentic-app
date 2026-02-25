import { z } from 'zod';

declare const __DEV__: boolean | undefined;

import {
  ConnectionStateSchema,
  SessionIdSchema,
  MessageIdSchema,
  TransportTypeSchema,
  type ConnectionState,
  type SessionId,
  type MessageId,
  type TransportType,
} from '../value-objects';

import {
  MessageSchema,
  SessionSchema,
  CliSessionInfoSchema,
  type Message,
  type Session,
  type Terminal,
  type CliSessionInfo,
} from '../entities';

// ─── Event Schemas ───────────────────────────────────────────────────────────

export const ConnectionStateChangedSchema = z.object({
  type: z.literal('connection:stateChanged'),
  state: ConnectionStateSchema,
  previousState: ConnectionStateSchema,
  transport: TransportTypeSchema,
  timestamp: z.number(),
});

export const MessageReceivedSchema = z.object({
  type: z.literal('message:received'),
  message: MessageSchema,
  sessionId: SessionIdSchema,
  timestamp: z.number(),
});

export const MessageUpdatedSchema = z.object({
  type: z.literal('message:updated'),
  messageId: MessageIdSchema,
  sessionId: SessionIdSchema,
  updates: MessageSchema.partial(),
  timestamp: z.number(),
});

export const SessionCreatedSchema = z.object({
  type: z.literal('session:created'),
  session: SessionSchema,
  timestamp: z.number(),
});

export const SessionUpdatedSchema = z.object({
  type: z.literal('session:updated'),
  sessionId: SessionIdSchema,
  updates: SessionSchema.partial(),
  timestamp: z.number(),
});

export const SessionDeletedSchema = z.object({
  type: z.literal('session:deleted'),
  sessionId: SessionIdSchema,
  timestamp: z.number(),
});

export const TerminalOutputSchema = z.object({
  type: z.literal('terminal:output'),
  terminalId: z.string().min(1),
  data: z.string(),
  timestamp: z.number(),
});

export const TerminalExitedSchema = z.object({
  type: z.literal('terminal:exited'),
  terminalId: z.string().min(1),
  exitCode: z.number().int().optional(),
  timestamp: z.number(),
});

export const CliSessionDiscoveredSchema = z.object({
  type: z.literal('cli:discovered'),
  sessions: z.array(CliSessionInfoSchema),
  timestamp: z.number(),
});

export const CliDeltaReceivedSchema = z.object({
  type: z.literal('cli:delta'),
  sessionId: z.string().min(1),
  deltaType: z.enum(['new_turn', 'session_updated', 'new_session']),
  payload: z.unknown(),
  timestamp: z.number(),
});

export const ErrorOccurredSchema = z.object({
  type: z.literal('error:occurred'),
  code: z.string().min(1),
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.number(),
});

export const WatchStartedSchema = z.object({
  type: z.literal('watch:started'),
  timestamp: z.number(),
});

export const WatchStoppedSchema = z.object({
  type: z.literal('watch:stopped'),
  timestamp: z.number(),
});

// ─── Discriminated Union ─────────────────────────────────────────────────────

export const DomainEventSchema = z.discriminatedUnion('type', [
  ConnectionStateChangedSchema,
  MessageReceivedSchema,
  MessageUpdatedSchema,
  SessionCreatedSchema,
  SessionUpdatedSchema,
  SessionDeletedSchema,
  TerminalOutputSchema,
  TerminalExitedSchema,
  CliSessionDiscoveredSchema,
  CliDeltaReceivedSchema,
  ErrorOccurredSchema,
  WatchStartedSchema,
  WatchStoppedSchema,
]);

export type DomainEvent = z.infer<typeof DomainEventSchema>;
export type DomainEventType = DomainEvent['type'];

// ─── Per-event inferred types ────────────────────────────────────────────────

export type ConnectionStateChanged = z.infer<typeof ConnectionStateChangedSchema>;
export type MessageReceived = z.infer<typeof MessageReceivedSchema>;
export type MessageUpdated = z.infer<typeof MessageUpdatedSchema>;
export type SessionCreated = z.infer<typeof SessionCreatedSchema>;
export type SessionUpdated = z.infer<typeof SessionUpdatedSchema>;
export type SessionDeleted = z.infer<typeof SessionDeletedSchema>;
export type TerminalOutput = z.infer<typeof TerminalOutputSchema>;
export type TerminalExited = z.infer<typeof TerminalExitedSchema>;
export type CliSessionDiscovered = z.infer<typeof CliSessionDiscoveredSchema>;
export type CliDeltaReceived = z.infer<typeof CliDeltaReceivedSchema>;
export type ErrorOccurred = z.infer<typeof ErrorOccurredSchema>;
export type WatchStarted = z.infer<typeof WatchStartedSchema>;
export type WatchStopped = z.infer<typeof WatchStoppedSchema>;

// ─── EventBus ────────────────────────────────────────────────────────────────

export type EventHandler<T extends DomainEventType> = (
  event: Extract<DomainEvent, { type: T }>,
) => void;

type WildcardHandler = (event: DomainEvent) => void;

const WILDCARD = '*' as const;

export class EventBus {
  private listeners = new Map<string, Set<Function>>();

  on<T extends DomainEventType>(type: T, handler: EventHandler<T>): () => void;
  on(type: typeof WILDCARD, handler: WildcardHandler): () => void;
  on(type: string, handler: Function): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(handler);
    return () => this.off(type as DomainEventType, handler as any);
  }

  off<T extends DomainEventType>(type: T, handler: EventHandler<T>): void;
  off(type: typeof WILDCARD, handler: WildcardHandler): void;
  off(type: string, handler: Function): void {
    this.listeners.get(type)?.delete(handler);
  }

  emit(event: DomainEvent): void {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      DomainEventSchema.parse(event);
    }

    const typed = this.listeners.get(event.type);
    if (typed) {
      typed.forEach((h) => h(event));
    }

    const wildcard = this.listeners.get(WILDCARD);
    if (wildcard) {
      wildcard.forEach((h) => h(event));
    }
  }

  once<T extends DomainEventType>(type: T, handler: EventHandler<T>): () => void {
    const wrapped: EventHandler<T> = (event) => {
      unsub();
      handler(event);
    };
    const unsub = this.on(type, wrapped);
    return unsub;
  }

  removeAllListeners(type?: DomainEventType): void {
    if (type) {
      this.listeners.delete(type);
    } else {
      this.listeners.clear();
    }
  }
}

export const eventBus = new EventBus();
