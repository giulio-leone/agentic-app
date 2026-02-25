import type { ConnectionState } from '../../domain';

type Trigger =
  | 'connect'
  | 'connected'
  | 'disconnect'
  | 'error'
  | 'retry'
  | 'circuit_open'
  | 'circuit_half_open'
  | 'circuit_close';

const TRANSITIONS = new Map<string, ConnectionState>([
  // disconnected
  ['Disconnected:connect', 'Connecting'],

  // connecting
  ['Connecting:connected', 'Connected'],
  ['Connecting:error', 'Failed'],
  ['Connecting:disconnect', 'Disconnected'],

  // connected
  ['Connected:disconnect', 'Disconnected'],
  ['Connected:error', 'Reconnecting'],

  // reconnecting
  ['Reconnecting:connected', 'Connected'],
  ['Reconnecting:error', 'Reconnecting'],
  ['Reconnecting:disconnect', 'Disconnected'],
  ['Reconnecting:circuit_open', 'CircuitOpen'],

  // failed
  ['Failed:retry', 'Reconnecting'],
  ['Failed:disconnect', 'Disconnected'],
  ['Failed:connect', 'Connecting'],

  // circuit_open
  ['CircuitOpen:circuit_half_open', 'HalfOpen'],
  ['CircuitOpen:disconnect', 'Disconnected'],

  // half_open
  ['HalfOpen:connected', 'Connected'],
  ['HalfOpen:error', 'CircuitOpen'],
  ['HalfOpen:disconnect', 'Disconnected'],
]);

export class ConnectionStateMachineImpl {
  private _current: ConnectionState;
  private _retryCount = 0;
  private readonly _maxRetries: number;

  constructor(
    initialState: ConnectionState = 'Disconnected',
    maxRetries = 3,
  ) {
    this._current = initialState;
    this._maxRetries = maxRetries;
  }

  get current(): ConnectionState {
    return this._current;
  }

  get retryCount(): number {
    return this._retryCount;
  }

  transition(trigger: Trigger): ConnectionState {
    const key = `${this._current}:${trigger}`;
    const next = TRANSITIONS.get(key);

    if (!next) {
      throw new Error(`Invalid transition: ${this._current} + ${trigger}`);
    }

    // Reconnecting + error: promote to Failed after max retries
    if (this._current === 'Reconnecting' && trigger === 'error') {
      this._retryCount++;
      if (this._retryCount >= this._maxRetries) {
        this._current = 'Failed';
        return this._current;
      }
    }

    // Reset retry counter on successful connection or manual reset paths
    if (trigger === 'connected' || trigger === 'connect') {
      this._retryCount = 0;
    }

    this._current = next;
    return this._current;
  }

  canTransition(trigger: Trigger): boolean {
    return TRANSITIONS.has(`${this._current}:${trigger}`);
  }

  reset(): void {
    this._current = 'Disconnected';
    this._retryCount = 0;
  }
}
