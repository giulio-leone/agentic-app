import {
  type ConnectionState,
  type TransportType,
  eventBus,
} from '../../domain';
import { ConnectionStateMachineImpl } from './ConnectionStateMachine';

// ─── Duck-typed inner transport ──────────────────────────────────────────────

interface InnerTransport {
  readonly state: ConnectionState;
  connect(): void;
  disconnect(): void;
  send(data: string): void;
}

// ─── Configuration ───────────────────────────────────────────────────────────

interface ReconnectionConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

interface CircuitBreakerConfig {
  maxFailures: number;
  resetTimeoutMs: number;
}

interface HeartbeatConfig {
  intervalMs: number;
  timeoutMs: number;
  createPing: () => string;
}

export interface ResilientTransportConfig {
  reconnection: ReconnectionConfig;
  circuitBreaker: CircuitBreakerConfig;
  heartbeat?: HeartbeatConfig;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_RECONNECTION: ReconnectionConfig = {
  maxRetries: Infinity,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
};

const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  maxFailures: 5,
  resetTimeoutMs: 30_000,
};

// ─── ResilientTransport ──────────────────────────────────────────────────────

export class ResilientTransport {
  private readonly inner: InnerTransport;
  private readonly transportType: TransportType;
  private readonly config: Required<Pick<ResilientTransportConfig, 'reconnection' | 'circuitBreaker'>> &
    Pick<ResilientTransportConfig, 'heartbeat'>;
  private readonly stateMachine: ConnectionStateMachineImpl;

  private retryCount = 0;
  private consecutiveFailures = 0;
  private intentionalDisconnect = false;

  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private circuitTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  private unsubStateChanged: (() => void) | null = null;
  private unsubError: (() => void) | null = null;

  constructor(
    inner: InnerTransport,
    transportType: TransportType,
    config: Partial<ResilientTransportConfig> = {},
  ) {
    this.inner = inner;
    this.transportType = transportType;
    this.config = {
      reconnection: { ...DEFAULT_RECONNECTION, ...config.reconnection },
      circuitBreaker: { ...DEFAULT_CIRCUIT_BREAKER, ...config.circuitBreaker },
      heartbeat: config.heartbeat,
    };
    this.stateMachine = new ConnectionStateMachineImpl('Disconnected');
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  get state(): ConnectionState {
    return this.stateMachine.current;
  }

  connect(): void {
    if (this.state !== 'Disconnected' && this.state !== 'Failed') return;

    this.intentionalDisconnect = false;
    this.retryCount = 0;
    this.consecutiveFailures = 0;
    this.subscribe();
    this.transitionAndEmit('connect');
    this.inner.connect();
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.clearAllTimers();
    this.stopHeartbeat();
    this.unsubscribe();
    this.inner.disconnect();

    if (this.stateMachine.canTransition('disconnect')) {
      this.transitionAndEmit('disconnect');
    } else {
      this.stateMachine.reset();
      this.emitStateChanged('Disconnected');
    }
  }

  send(data: string): void {
    if (this.state !== 'Connected') {
      throw new Error(`Cannot send: state is ${this.state}`);
    }
    this.inner.send(data);
  }

  dispose(): void {
    this.disconnect();
  }

  // ─── EventBus subscription (filtered by transport type) ──────────────────

  private subscribe(): void {
    this.unsubscribe();

    this.unsubStateChanged = eventBus.on(
      'connection:stateChanged',
      (event) => {
        if (event.transport !== this.transportType) return;
        this.handleInnerStateChanged(event.state, event.previousState);
      },
    );

    this.unsubError = eventBus.on('error:occurred', (event) => {
      if (event.context?.transport !== this.transportType) return;
      this.onConnectionLost(new Error(event.message));
    });
  }

  private unsubscribe(): void {
    this.unsubStateChanged?.();
    this.unsubStateChanged = null;
    this.unsubError?.();
    this.unsubError = null;
  }

  // ─── Inner transport state handling ──────────────────────────────────────

  private handleInnerStateChanged(
    innerState: ConnectionState,
    _previousState: ConnectionState,
  ): void {
    switch (innerState) {
      case 'Connected':
        this.onConnected();
        break;
      case 'Disconnected':
        if (!this.intentionalDisconnect) {
          this.onConnectionLost();
        }
        break;
      case 'Failed':
        this.onConnectionLost(new Error('Inner transport failed'));
        break;
      // Connecting state is handled internally by inner transport
    }
  }

  private onConnected(): void {
    this.retryCount = 0;
    this.consecutiveFailures = 0;

    if (this.stateMachine.canTransition('connected')) {
      this.transitionAndEmit('connected');
    }

    this.startHeartbeat();
  }

  private onConnectionLost(_error?: Error): void {
    this.stopHeartbeat();
    this.consecutiveFailures++;

    // Circuit breaker: too many consecutive failures → open circuit
    if (this.consecutiveFailures >= this.config.circuitBreaker.maxFailures) {
      this.openCircuit();
      return;
    }

    // Retry limit reached → transition to Failed
    if (this.retryCount >= this.config.reconnection.maxRetries) {
      if (this.stateMachine.canTransition('error')) {
        this.transitionAndEmit('error');
      }
      return;
    }

    this.scheduleRetry();
  }

  // ─── Reconnection with exponential backoff ───────────────────────────────

  private scheduleRetry(): void {
    const { baseDelayMs, backoffMultiplier, maxDelayMs } =
      this.config.reconnection;

    const delay = Math.min(
      baseDelayMs * Math.pow(backoffMultiplier, this.retryCount),
      maxDelayMs,
    );
    this.retryCount++;

    // Transition to Reconnecting if possible
    if (this.stateMachine.canTransition('retry')) {
      this.transitionAndEmit('retry');
    } else if (
      this.state === 'Connected' &&
      this.stateMachine.canTransition('error')
    ) {
      // Connected → error → Reconnecting
      this.transitionAndEmit('error');
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.intentionalDisconnect) return;
      this.inner.disconnect();
      this.inner.connect();
    }, delay);
  }

  // ─── Circuit breaker ─────────────────────────────────────────────────────

  private openCircuit(): void {
    if (this.stateMachine.canTransition('circuit_open')) {
      this.transitionAndEmit('circuit_open');
    }

    this.inner.disconnect();
    this.clearRetryTimer();

    // Schedule half-open probe
    this.circuitTimer = setTimeout(() => {
      this.circuitTimer = null;
      if (this.intentionalDisconnect) return;

      if (this.stateMachine.canTransition('circuit_half_open')) {
        this.transitionAndEmit('circuit_half_open');
      }

      this.consecutiveFailures = 0;
      this.inner.connect();
    }, this.config.circuitBreaker.resetTimeoutMs);
  }

  // ─── Heartbeat / keep-alive ──────────────────────────────────────────────

  private startHeartbeat(): void {
    if (!this.config.heartbeat) return;
    this.stopHeartbeat();

    const { intervalMs, timeoutMs, createPing } = this.config.heartbeat;

    this.heartbeatTimer = setInterval(() => {
      if (this.state !== 'Connected') {
        this.stopHeartbeat();
        return;
      }

      try {
        this.inner.send(createPing());
      } catch {
        this.stopHeartbeat();
        this.onConnectionLost(new Error('Heartbeat send failed'));
        return;
      }

      // Start response timeout — if no data arrives within timeoutMs,
      // treat as connection lost. A one-shot listener on any incoming
      // connection:stateChanged or message clears the timeout.
      this.heartbeatTimeoutTimer = setTimeout(() => {
        this.heartbeatTimeoutTimer = null;
        if (this.state === 'Connected') {
          this.stopHeartbeat();
          this.onConnectionLost(new Error('Heartbeat timeout'));
        }
      }, timeoutMs);
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /** Call when any data is received to acknowledge heartbeat liveness. */
  acknowledgeHeartbeat(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  // ─── State machine + event emission ──────────────────────────────────────

  private transitionAndEmit(
    trigger: Parameters<ConnectionStateMachineImpl['transition']>[0],
  ): void {
    const previous = this.stateMachine.current;
    const next = this.stateMachine.transition(trigger);
    if (next !== previous) {
      this.emitStateChanged(next, previous);
    }
  }

  private emitStateChanged(
    state: ConnectionState,
    previousState: ConnectionState = 'Disconnected',
  ): void {
    eventBus.emit({
      type: 'connection:stateChanged',
      state,
      previousState,
      transport: this.transportType,
      timestamp: Date.now(),
    });
  }

  // ─── Timer cleanup ──────────────────────────────────────────────────────

  private clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private clearAllTimers(): void {
    this.clearRetryTimer();
    if (this.circuitTimer) {
      clearTimeout(this.circuitTimer);
      this.circuitTimer = null;
    }
  }
}
