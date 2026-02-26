import { describe, it, expect } from 'vitest';
import {
  ClientMessageSchema,
  InitializeRequestSchema,
  SessionNewRequestSchema,
  SessionPromptRequestSchema,
  ToolResponseMessageSchema,
  McpAddRequestSchema,
} from './types.js';

describe('Zod schemas', () => {
  // ── ClientMessage discriminated union ──

  it('valid initialize message passes validation', () => {
    const msg = {
      type: 'initialize',
      id: 'req-1',
      payload: { clientVersion: '1.0.0', capabilities: ['streaming'] },
    };
    expect(ClientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('valid session.new message passes', () => {
    const msg = { type: 'session.new', id: 'req-2', payload: { model: 'gpt-4o' } };
    expect(ClientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('valid session.prompt message passes', () => {
    const msg = {
      type: 'session.prompt',
      id: 'req-3',
      payload: { sessionId: 's-1', message: 'Hello' },
    };
    expect(ClientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('valid tool.response message passes', () => {
    const msg = {
      type: 'tool.response',
      id: 'req-4',
      payload: { sessionId: 's-1', toolCallId: 'tc-1', result: { response: 'yes' } },
    };
    expect(ClientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('valid mcp.add message passes', () => {
    const msg = {
      type: 'mcp.add',
      id: 'req-5',
      payload: { name: 'srv', command: 'node', args: ['a.js'] },
    };
    expect(ClientMessageSchema.parse(msg)).toEqual(msg);
  });

  // ── Invalid messages ──

  it('invalid message type fails validation', () => {
    const msg = { type: 'unknown.type', id: 'req-x', payload: {} };
    expect(() => ClientMessageSchema.parse(msg)).toThrow();
  });

  it('missing required id field fails validation', () => {
    const msg = { type: 'initialize', payload: { clientVersion: '1.0' } };
    expect(() => ClientMessageSchema.parse(msg)).toThrow();
  });

  it('missing required payload field fails', () => {
    const msg = { type: 'session.prompt', id: 'req-x' };
    expect(() => ClientMessageSchema.parse(msg)).toThrow();
  });

  it('session.prompt without sessionId fails', () => {
    const msg = { type: 'session.prompt', id: 'req-x', payload: { message: 'hi' } };
    expect(() => ClientMessageSchema.parse(msg)).toThrow();
  });

  it('session.prompt without message fails', () => {
    const msg = { type: 'session.prompt', id: 'req-x', payload: { sessionId: 's-1' } };
    expect(() => ClientMessageSchema.parse(msg)).toThrow();
  });

  // ── Discriminated union correctness ──

  it('discriminated union selects correct schema', () => {
    const initMsg = {
      type: 'initialize' as const,
      id: 'r1',
      payload: { clientVersion: '1.0' },
    };
    const parsed = ClientMessageSchema.parse(initMsg);
    expect(parsed.type).toBe('initialize');

    // Verify the parsed type matches InitializeRequest shape
    const init = InitializeRequestSchema.parse(parsed);
    expect(init.payload.clientVersion).toBe('1.0');
  });

  it('optional fields are correctly handled', () => {
    // session.new with no model or systemPrompt
    const msg = { type: 'session.new', id: 'r2', payload: {} };
    const parsed = SessionNewRequestSchema.parse(msg);
    expect(parsed.payload.model).toBeUndefined();
    expect(parsed.payload.systemPrompt).toBeUndefined();
  });

  it('mcp.add with env passes', () => {
    const msg = {
      type: 'mcp.add',
      id: 'r3',
      payload: { name: 'test', command: 'npx', env: { KEY: 'val' } },
    };
    const parsed = McpAddRequestSchema.parse(msg);
    expect(parsed.payload.env).toEqual({ KEY: 'val' });
  });

  it('tool.response with approved field passes', () => {
    const msg = {
      type: 'tool.response',
      id: 'r4',
      payload: { sessionId: 's', toolCallId: 'tc', result: null, approved: true },
    };
    const parsed = ToolResponseMessageSchema.parse(msg);
    expect(parsed.payload.approved).toBe(true);
  });
});
