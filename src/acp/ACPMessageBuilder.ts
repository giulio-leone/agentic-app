/**
 * Builds JSON-RPC param objects for ACP requests.
 * Mirrors the Swift ACPMessageBuilder / ACPServiceModels.
 */

import { JSONValue } from './models';
import { ACP_CLIENT_NAME, ACP_CLIENT_VERSION } from '../constants/app';

export interface InitializeParams {
  clientInfo?: { name: string; version: string };
  capabilities?: {
    filesystem?: { read?: boolean; write?: boolean };
    terminal?: boolean;
  };
}

export interface SessionNewParams {
  cwd?: string;
  modeId?: string;
  model?: string;
  reasoningEffort?: string;
  mcpServers?: Array<{ name: string; url: string }>;
}

export interface SessionLoadParams {
  sessionId: string;
  cwd?: string;
}

export interface SessionResumeParams {
  sessionId: string;
  cwd?: string;
}

export interface SessionPromptParams {
  sessionId: string;
  text: string;
  images?: Array<{ data: string; mimeType: string }>;
  commandName?: string;
}

export interface SessionCancelParams {
  sessionId: string;
}

export interface SessionSetModeParams {
  sessionId: string;
  modeId: string;
}

export function buildInitializeParams(opts?: InitializeParams): JSONValue {
  const params: Record<string, JSONValue> = {};

  params.protocolVersion = 1;

  const clientInfo = opts?.clientInfo ?? { name: ACP_CLIENT_NAME, version: ACP_CLIENT_VERSION };
  params.clientInfo = clientInfo as unknown as JSONValue;

  const capabilities = opts?.capabilities ?? {
    filesystem: { read: true, write: true },
    terminal: true,
  };
  params.capabilities = capabilities as unknown as JSONValue;

  return params as unknown as JSONValue;
}

export function buildSessionNewParams(opts?: SessionNewParams): JSONValue {
  const params: Record<string, JSONValue> = {};
  params.cwd = opts?.cwd || '/tmp';
  params.mcpServers = (opts?.mcpServers ?? []) as unknown as JSONValue;
  if (opts?.modeId) params.modeId = opts.modeId;
  if (opts?.model) params.model = opts.model;
  if (opts?.reasoningEffort) params.reasoningEffort = opts.reasoningEffort;
  return params as unknown as JSONValue;
}

export function buildSessionLoadParams(opts: SessionLoadParams): JSONValue {
  const params: Record<string, JSONValue> = { sessionId: opts.sessionId };
  if (opts.cwd) params.cwd = opts.cwd;
  return params as unknown as JSONValue;
}

export function buildSessionResumeParams(opts: SessionResumeParams): JSONValue {
  const params: Record<string, JSONValue> = { sessionId: opts.sessionId };
  if (opts.cwd) params.cwd = opts.cwd;
  return params as unknown as JSONValue;
}

export function buildSessionPromptParams(opts: SessionPromptParams): JSONValue {
  const promptArray: JSONValue[] = [
    { type: 'text', text: opts.text },
  ];

  if (opts.images && opts.images.length > 0) {
    for (const img of opts.images) {
      promptArray.push({ type: 'image', mimeType: img.mimeType, data: img.data });
    }
  }

  const params: Record<string, JSONValue> = {
    sessionId: opts.sessionId,
    prompt: promptArray,
  };
  if (opts.commandName) params.commandName = opts.commandName;
  return params as unknown as JSONValue;
}

export function buildSessionCancelParams(opts: SessionCancelParams): JSONValue {
  return { sessionId: opts.sessionId } as unknown as JSONValue;
}

export function buildSessionSetModeParams(opts: SessionSetModeParams): JSONValue {
  return { sessionId: opts.sessionId, modeId: opts.modeId } as unknown as JSONValue;
}
