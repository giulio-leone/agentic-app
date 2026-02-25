import {
  ConnectionState,
  TransportType,
  ServerEndpoint,
} from '../../domain';

// --- Transport configuration ---

export interface TransportConfig {
  endpoint: ServerEndpoint;
  transport: TransportType;
  pingIntervalMs?: number;
  connectionTimeoutMs?: number;
}

// --- Primary port: transport contract ---

export interface TransportPort {
  readonly state: ConnectionState;
  readonly transport: TransportType;

  connect(config: TransportConfig): void;
  disconnect(): void;
  send(data: string): void;

  // Event-based — transport emits domain events via EventBus
  // No callback pattern — clean hexagonal port
}

// --- Resilience configuration ---

export interface CircuitBreakerConfig {
  maxFailures: number;          // failures before opening circuit (default: 5)
  resetTimeoutMs: number;       // time before half-open probe (default: 30000)
  halfOpenMaxAttempts: number;  // probes before closing circuit (default: 1)
}

export interface ReconnectionConfig {
  maxRetries: number;           // max retry attempts (default: Infinity for auto-reconnect)
  baseDelayMs: number;          // initial delay (default: 1000)
  maxDelayMs: number;           // cap (default: 30000)
  backoffMultiplier: number;    // exponential factor (default: 2)
}

export interface ResilientTransportConfig extends TransportConfig {
  reconnection: ReconnectionConfig;
  circuitBreaker: CircuitBreakerConfig;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
}

// --- Connection state machine ---

export type ConnectionStateTransition = {
  from: ConnectionState;
  to: ConnectionState;
  trigger:
    | 'connect'
    | 'connected'
    | 'disconnect'
    | 'error'
    | 'retry'
    | 'circuit_open'
    | 'circuit_half_open'
    | 'circuit_close';
};

export interface ConnectionStateMachine {
  readonly current: ConnectionState;
  transition(trigger: ConnectionStateTransition['trigger']): ConnectionState;
  canTransition(trigger: ConnectionStateTransition['trigger']): boolean;
}
