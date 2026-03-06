/**
 * Unit tests for CopilotJsonlParser
 *
 * Validates NDJSON event parsing from `copilot -p --output-format json`
 * and correct mapping to the ServerMsg WebSocket protocol.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CopilotJsonlParser } from '../parser/copilot-jsonl.js';
import type { ServerMsg } from '../protocol/messages.js';

function createParser() {
  const messages: ServerMsg[] = [];
  const sink = vi.fn((msg: ServerMsg) => messages.push(msg));
  const parser = new CopilotJsonlParser('sess-1', 'msg-1', sink);
  return { parser, sink, messages };
}

// Helper: feed a JSON event as a single NDJSON line
function feedEvent(parser: CopilotJsonlParser, event: Record<string, unknown>) {
  parser.feed(JSON.stringify(event) + '\n');
}

describe('CopilotJsonlParser', () => {
  describe('streaming text deltas', () => {
    it('emits assistant_chunk for message_delta events', () => {
      const { parser, messages } = createParser();

      feedEvent(parser, {
        type: 'assistant.message_delta',
        data: { messageId: 'mid-1', deltaContent: 'Hello ' },
        id: 'e1',
        timestamp: '2026-03-06T12:00:00Z',
        ephemeral: true,
      });
      feedEvent(parser, {
        type: 'assistant.message_delta',
        data: { messageId: 'mid-1', deltaContent: 'world!' },
        id: 'e2',
        timestamp: '2026-03-06T12:00:01Z',
        ephemeral: true,
      });

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({
        type: 'assistant_chunk',
        sessionId: 'sess-1',
        messageId: 'msg-1',
        text: 'Hello ',
      });
      expect(messages[1]).toEqual({
        type: 'assistant_chunk',
        sessionId: 'sess-1',
        messageId: 'msg-1',
        text: 'world!',
      });
    });

    it('skips empty deltaContent', () => {
      const { parser, messages } = createParser();

      feedEvent(parser, {
        type: 'assistant.message_delta',
        data: { messageId: 'mid-1', deltaContent: '' },
        id: 'e1',
        timestamp: '2026-03-06T12:00:00Z',
      });

      expect(messages).toHaveLength(0);
    });
  });

  describe('tool calls', () => {
    it('emits tool_use on tool.execution_start', () => {
      const { parser, messages } = createParser();

      feedEvent(parser, {
        type: 'tool.execution_start',
        data: {
          toolCallId: 'tc-1',
          toolName: 'bash',
          arguments: { command: 'ls -la', description: 'List files' },
        },
        id: 'e1',
        timestamp: '2026-03-06T12:00:00Z',
      });

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        type: 'tool_use',
        sessionId: 'sess-1',
        messageId: 'msg-1',
        toolName: 'bash',
        input: { command: 'ls -la', description: 'List files' },
      });
    });

    it('emits tool_result on tool.execution_complete with name resolution', () => {
      const { parser, messages } = createParser();

      // Start first — this registers the tool name mapping
      feedEvent(parser, {
        type: 'tool.execution_start',
        data: { toolCallId: 'tc-1', toolName: 'bash', arguments: { command: 'echo hi' } },
        id: 'e1',
        timestamp: '2026-03-06T12:00:00Z',
      });
      // Complete — resolves name via toolCallId
      feedEvent(parser, {
        type: 'tool.execution_complete',
        data: {
          toolCallId: 'tc-1',
          success: true,
          result: { content: 'hi', detailedContent: 'hi\n<exited with exit code 0>' },
          toolTelemetry: {},
        },
        id: 'e2',
        timestamp: '2026-03-06T12:00:01Z',
      });

      expect(messages).toHaveLength(2);
      expect(messages[1]).toEqual({
        type: 'tool_result',
        sessionId: 'sess-1',
        messageId: 'msg-1',
        toolName: 'bash',
        output: 'hi\n<exited with exit code 0>',
        isError: false,
      });
    });

    it('marks failed tools with isError', () => {
      const { parser, messages } = createParser();

      feedEvent(parser, {
        type: 'tool.execution_start',
        data: { toolCallId: 'tc-fail', toolName: 'bash', arguments: { command: 'exit 1' } },
        id: 'e1',
        timestamp: '2026-03-06T12:00:00Z',
      });
      feedEvent(parser, {
        type: 'tool.execution_complete',
        data: {
          toolCallId: 'tc-fail',
          success: false,
          result: { content: 'command failed' },
        },
        id: 'e2',
        timestamp: '2026-03-06T12:00:01Z',
      });

      expect(messages[1]).toMatchObject({
        type: 'tool_result',
        isError: true,
      });
    });
  });

  describe('internal tool filtering', () => {
    it('filters out report_intent tool calls', () => {
      const { parser, messages } = createParser();

      feedEvent(parser, {
        type: 'tool.execution_start',
        data: { toolCallId: 'tc-int', toolName: 'report_intent', arguments: { intent: 'Testing' } },
        id: 'e1',
        timestamp: '2026-03-06T12:00:00Z',
      });
      feedEvent(parser, {
        type: 'tool.execution_complete',
        data: {
          toolCallId: 'tc-int',
          success: true,
          result: { content: 'Intent logged' },
        },
        id: 'e2',
        timestamp: '2026-03-06T12:00:01Z',
      });

      expect(messages).toHaveLength(0);
    });
  });

  describe('result event', () => {
    it('extracts usage from result event', () => {
      const { parser } = createParser();

      feedEvent(parser, {
        type: 'result',
        timestamp: '2026-03-06T12:00:05Z',
        sessionId: 'copilot-sess-123',
        exitCode: 0,
        usage: {
          premiumRequests: 3,
          totalApiDurationMs: 9585,
          sessionDurationMs: 16917,
          codeChanges: { linesAdded: 0, linesRemoved: 0, filesModified: [] },
        },
      });

      const usage = parser.getUsage();
      expect(usage).toBeDefined();
      expect(usage!.durationMs).toBe(16917);
      expect(parser.getCopilotSessionId()).toBe('copilot-sess-123');
    });
  });

  describe('buffer handling', () => {
    it('handles split lines across multiple feed calls', () => {
      const { parser, messages } = createParser();

      const event = JSON.stringify({
        type: 'assistant.message_delta',
        data: { messageId: 'mid-1', deltaContent: 'split test' },
        id: 'e1',
        timestamp: '2026-03-06T12:00:00Z',
        ephemeral: true,
      });

      // Feed in two halves
      parser.feed(event.substring(0, 20));
      expect(messages).toHaveLength(0);

      parser.feed(event.substring(20) + '\n');
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({ text: 'split test' });
    });

    it('flush processes remaining buffer', () => {
      const { parser, messages } = createParser();

      const event = JSON.stringify({
        type: 'assistant.message_delta',
        data: { messageId: 'mid-1', deltaContent: 'flush me' },
        id: 'e1',
        timestamp: '2026-03-06T12:00:00Z',
      });

      parser.feed(event); // No trailing newline
      expect(messages).toHaveLength(0);

      parser.flush();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({ text: 'flush me' });
    });

    it('emits non-JSON lines as text chunks', () => {
      const { parser, messages } = createParser();

      parser.feed('Some verbose log output\n');

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        type: 'assistant_chunk',
        sessionId: 'sess-1',
        messageId: 'msg-1',
        text: 'Some verbose log output\n',
      });
    });
  });

  describe('ignored events', () => {
    it('ignores user.message events', () => {
      const { parser, messages } = createParser();

      feedEvent(parser, {
        type: 'user.message',
        data: { content: 'hello', interactionId: 'int-1' },
        id: 'e1',
        timestamp: '2026-03-06T12:00:00Z',
      });

      expect(messages).toHaveLength(0);
    });

    it('ignores assistant.turn_start and assistant.turn_end', () => {
      const { parser, messages } = createParser();

      feedEvent(parser, {
        type: 'assistant.turn_start',
        data: { turnId: '0', interactionId: 'int-1' },
        id: 'e1',
        timestamp: '2026-03-06T12:00:00Z',
      });
      feedEvent(parser, {
        type: 'assistant.turn_end',
        data: { turnId: '0' },
        id: 'e2',
        timestamp: '2026-03-06T12:00:01Z',
      });

      expect(messages).toHaveLength(0);
    });
  });

  describe('full interaction scenario', () => {
    it('processes a complete copilot response with tools and text', () => {
      const { parser, messages } = createParser();

      // Turn start
      feedEvent(parser, {
        type: 'assistant.turn_start',
        data: { turnId: '0', interactionId: 'int-1' },
        id: 'e1',
        timestamp: '2026-03-06T12:00:00Z',
      });

      // Assistant decides to use a tool
      feedEvent(parser, {
        type: 'assistant.message',
        data: {
          messageId: 'mid-1',
          content: '',
          toolRequests: [
            { toolCallId: 'tc-1', name: 'bash', arguments: { command: 'echo hello' }, type: 'function' },
          ],
          interactionId: 'int-1',
          outputTokens: 42,
        },
        id: 'e2',
        timestamp: '2026-03-06T12:00:01Z',
      });

      // Tool execution
      feedEvent(parser, {
        type: 'tool.execution_start',
        data: { toolCallId: 'tc-1', toolName: 'bash', arguments: { command: 'echo hello' } },
        id: 'e3',
        timestamp: '2026-03-06T12:00:01Z',
      });
      feedEvent(parser, {
        type: 'tool.execution_complete',
        data: {
          toolCallId: 'tc-1',
          success: true,
          result: { content: 'hello', detailedContent: 'hello\n<exited with exit code 0>' },
        },
        id: 'e4',
        timestamp: '2026-03-06T12:00:02Z',
      });

      // Turn end + new turn with text response
      feedEvent(parser, {
        type: 'assistant.turn_end',
        data: { turnId: '0' },
        id: 'e5',
        timestamp: '2026-03-06T12:00:02Z',
      });
      feedEvent(parser, {
        type: 'assistant.turn_start',
        data: { turnId: '1', interactionId: 'int-1' },
        id: 'e6',
        timestamp: '2026-03-06T12:00:02Z',
      });
      feedEvent(parser, {
        type: 'assistant.message_delta',
        data: { messageId: 'mid-2', deltaContent: 'Done! The output is: hello' },
        id: 'e7',
        timestamp: '2026-03-06T12:00:03Z',
        ephemeral: true,
      });

      // Result
      feedEvent(parser, {
        type: 'result',
        timestamp: '2026-03-06T12:00:05Z',
        sessionId: 'sess-abc',
        exitCode: 0,
        usage: { premiumRequests: 2, sessionDurationMs: 5000 },
      });

      // Verify sequence: tool_use → tool_result → text chunk
      const types = messages.map((m) => m.type);
      expect(types).toEqual([
        'tool_use',     // from tool.execution_start
        'tool_result',  // from tool.execution_complete
        'assistant_chunk', // streaming text
      ]);

      expect(parser.getUsage()?.durationMs).toBe(5000);
      expect(parser.getCopilotSessionId()).toBe('sess-abc');
    });
  });
});
