/**
 * ACPService – high-level RPC layer over any ACP transport.
 * Mirrors the Swift ACPService: send JSON-RPC requests and await responses.
 */

import { ACPClient, ACPClientConfig } from './ACPClient';
import { TCPClient } from './TCPClient';
import type { ACPTransport, ACPTransportConfig, ACPTransportListener } from './ACPTransport';
import { ACPMethods } from './ACPMethods';
import {
  makeRequest,
  JSONRPCResponse,
  ACPWireMessage,
  RPCID,
  isResponse,
  isNotification,
  JSONValue,
} from './models';
import {
  buildInitializeParams,
  buildSessionNewParams,
  buildSessionLoadParams,
  buildSessionResumeParams,
  buildSessionPromptParams,
  buildSessionCancelParams,
  buildSessionSetModeParams,
  InitializeParams,
  SessionNewParams,
  SessionLoadParams,
  SessionResumeParams,
  SessionPromptParams,
  SessionCancelParams,
  SessionSetModeParams,
} from './ACPMessageBuilder';
import { ACPConnectionState } from './models/types';

type PendingRequest = {
  resolve: (value: JSONRPCResponse) => void;
  reject: (error: Error) => void;
};

export type ACPServiceListener = {
  onStateChange?: (state: ACPConnectionState) => void;
  onNotification?: (method: string, params?: JSONValue) => void;
  onMessage?: (message: ACPWireMessage) => void;
  onError?: (error: Error) => void;
};

export class ACPService {
  private transport: ACPTransport;
  private idCounter = 0;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private serviceListener: ACPServiceListener;

  constructor(config: ACPTransportConfig, listener: ACPServiceListener = {}) {
    this.serviceListener = listener;

    const transportListener: ACPTransportListener = {
      onStateChange: (state) => {
        if (state === ACPConnectionState.Disconnected || state === ACPConnectionState.Failed) {
          for (const [, pending] of this.pendingRequests) {
            pending.reject(new Error('Disconnected'));
          }
          this.pendingRequests.clear();
        }
        this.serviceListener.onStateChange?.(state);
      },
      onMessage: (message) => {
        this.handleMessage(message);
      },
      onError: (error) => {
        this.serviceListener.onError?.(error);
      },
    };

    // Choose transport based on endpoint scheme
    if (config.endpoint.startsWith('tcp://')) {
      this.transport = new TCPClient(config, transportListener);
    } else {
      this.transport = new ACPClient(
        { ...config, appendNewline: true } as ACPClientConfig,
        transportListener,
      );
    }
  }

  get state(): ACPConnectionState {
    return this.transport.state;
  }

  connect(): void {
    this.transport.connect();
  }

  disconnect(): void {
    this.transport.disconnect();
  }

  // --- RPC methods ---

  async initialize(opts?: InitializeParams): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.initialize, buildInitializeParams(opts));
  }

  async createSession(opts?: SessionNewParams): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.sessionNew, buildSessionNewParams(opts));
  }

  async loadSession(opts: SessionLoadParams): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.sessionLoad, buildSessionLoadParams(opts));
  }

  async resumeSession(opts: SessionResumeParams): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.sessionResume, buildSessionResumeParams(opts));
  }

  async sendPrompt(opts: SessionPromptParams): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.sessionPrompt, buildSessionPromptParams(opts));
  }

  async cancelSession(opts: SessionCancelParams): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.sessionCancel, buildSessionCancelParams(opts));
  }

  async listSessions(): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.sessionList, {} as JSONValue);
  }

  async setMode(opts: SessionSetModeParams): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.sessionSetMode, buildSessionSetModeParams(opts));
  }

  // ── Terminal methods ──

  async terminalSpawn(opts?: { shell?: string; cwd?: string; cols?: number; rows?: number }): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.terminalSpawn, (opts ?? {}) as JSONValue);
  }

  async terminalList(): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.terminalList, {} as JSONValue);
  }

  async terminalConnectTmux(session: string, cols = 80, rows = 24): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.terminalConnectTmux, { session, cols, rows } as JSONValue);
  }

  async terminalInput(id: string, data: string): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.terminalInput, { id, data } as JSONValue);
  }

  async terminalResize(id: string, cols: number, rows: number): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.terminalResize, { id, cols, rows } as JSONValue);
  }

  async terminalClose(id: string): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.terminalClose, { id } as JSONValue);
  }

  // ── Filesystem methods ──

  async fsList(path?: string): Promise<JSONRPCResponse> {
    return this.sendRequest(ACPMethods.fsList, (path ? { path } : {}) as JSONValue);
  }

  sendRawMessage(message: ACPWireMessage): void {
    this.transport.send(message);
  }

  // --- Internal ---

  private nextId(): RPCID {
    return ++this.idCounter;
  }

  private sendRequest(method: string, params?: JSONValue): Promise<JSONRPCResponse> {
    return new Promise((resolve, reject) => {
      const id = this.nextId();
      const request = makeRequest(id, method, params);
      const idKey = String(id);
      this.pendingRequests.set(idKey, { resolve, reject });

      try {
        this.transport.send(request);
      } catch (error) {
        this.pendingRequests.delete(idKey);
        reject(error);
      }
    });
  }

  private handleMessage(message: ACPWireMessage): void {
    this.serviceListener.onMessage?.(message);

    if (isResponse(message)) {
      const idKey = String(message.id);
      const pending = this.pendingRequests.get(idKey);
      if (pending) {
        this.pendingRequests.delete(idKey);
        if (message.error) {
          pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
        } else {
          pending.resolve(message);
        }
      }
    } else if (isNotification(message)) {
      this.serviceListener.onNotification?.(message.method, message.params);
    }
  }
}
