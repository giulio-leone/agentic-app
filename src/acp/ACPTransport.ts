/**
 * Transport abstraction for ACP connections.
 * Implemented by WebSocket (ACPClient) and TCP NDJSON (TCPClient).
 */

import { ACPWireMessage } from './models';
import { ACPConnectionState } from './models/types';

export interface ACPTransportConfig {
  /** For WS: "ws://host:port", for TCP: "tcp://host:port" */
  endpoint: string;
  authToken?: string;
  additionalHeaders?: Record<string, string>;
}

export type ACPTransportListener = {
  onStateChange?: (state: ACPConnectionState) => void;
  onMessage?: (message: ACPWireMessage) => void;
  onError?: (error: Error) => void;
};

export interface ACPTransport {
  readonly state: ACPConnectionState;
  connect(): void;
  disconnect(): void;
  send(message: ACPWireMessage): void;
}
