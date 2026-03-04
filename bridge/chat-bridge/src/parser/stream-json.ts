/**
 * Claude Stream JSON Parser — transforms `claude -p --output-format stream-json`
 * output into chat-style WebSocket messages.
 *
 * Claude Code outputs NDJSON events:
 * - message_start, content_block_start, content_block_delta,
 *   content_block_stop, message_delta, message_stop, result
 *
 * We transform these into our chat protocol:
 * - assistant_chunk (text streaming)
 * - tool_use (tool call start)
 * - tool_result (tool call end)
 * - thinking (reasoning)
 * - assistant_end (with usage)
 */

import type { MessageSink } from '../session/manager.js';
import type { UsageInfo, ServerMsg } from '../protocol/messages.js';
import type {
  ClaudeStreamEvent,
  ClaudeContentBlockStart,
  ClaudeContentBlockDelta,
  ClaudeContentBlockStop,
  ClaudeMessageDelta,
  ClaudeResult,
} from '../cli/types.js';
import { Logger } from '../utils/logger.js';

const log = new Logger('claude-parser');

interface ActiveBlock {
  index: number;
  type: 'text' | 'tool_use' | 'thinking';
  toolName?: string;
  toolInput: string;
}

export class ClaudeStreamParser {
  private buffer = '';
  private activeBlocks = new Map<number, ActiveBlock>();
  private usage: UsageInfo | undefined;
  private resultInfo: { cost?: number; sessionId?: string } = {};

  constructor(
    private sessionId: string,
    private messageId: string,
    private sink: MessageSink,
  ) {}

  /** Feed raw stdout data into the parser */
  feed(data: string): void {
    this.buffer += data;
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.substring(0, idx).trim();
      this.buffer = this.buffer.substring(idx + 1);
      if (!line) continue;
      this.parseLine(line);
    }
  }

  /** Flush remaining buffer */
  flush(): void {
    const line = this.buffer.trim();
    this.buffer = '';
    if (line) this.parseLine(line);
  }

  /** Get accumulated usage info */
  getUsage(): UsageInfo | undefined {
    return this.usage;
  }

  private parseLine(line: string): void {
    try {
      const event = JSON.parse(line) as ClaudeStreamEvent;
      this.handleEvent(event);
    } catch {
      // Not JSON — treat as raw text (e.g., claude verbose output)
      if (line.startsWith('{') || line.startsWith('[')) {
        log.warn('Malformed JSON line', { line: line.substring(0, 100) });
      }
      // Emit as text chunk for non-JSON lines (verbose output, etc.)
      this.sink({
        type: 'assistant_chunk',
        sessionId: this.sessionId,
        messageId: this.messageId,
        text: line + '\n',
      });
    }
  }

  private handleEvent(event: ClaudeStreamEvent): void {
    switch (event.type) {
      case 'message_start':
        // Already sent assistant_start from session manager
        break;

      case 'content_block_start':
        this.handleBlockStart(event);
        break;

      case 'content_block_delta':
        this.handleBlockDelta(event);
        break;

      case 'content_block_stop':
        this.handleBlockStop(event);
        break;

      case 'message_delta':
        this.handleMessageDelta(event);
        break;

      case 'message_stop':
        // Will be handled by CLI exit event
        break;

      case 'result':
        this.handleResult(event);
        break;
    }
  }

  private handleBlockStart(event: ClaudeContentBlockStart): void {
    const block = event.content_block;
    const active: ActiveBlock = {
      index: event.index,
      type: block.type as 'text' | 'tool_use' | 'thinking',
      toolName: block.name,
      toolInput: '',
    };
    this.activeBlocks.set(event.index, active);

    if (block.type === 'tool_use' && block.name) {
      this.sink({
        type: 'tool_use',
        sessionId: this.sessionId,
        messageId: this.messageId,
        toolName: block.name,
        input: block.input ?? {},
      });
    }

    // Emit initial text if present
    if (block.type === 'text' && block.text) {
      this.sink({
        type: 'assistant_chunk',
        sessionId: this.sessionId,
        messageId: this.messageId,
        text: block.text,
      });
    }
  }

  private handleBlockDelta(event: ClaudeContentBlockDelta): void {
    const block = this.activeBlocks.get(event.index);
    if (!block) return;

    const delta = event.delta;

    switch (delta.type) {
      case 'text_delta':
        if (delta.text) {
          this.sink({
            type: 'assistant_chunk',
            sessionId: this.sessionId,
            messageId: this.messageId,
            text: delta.text,
          });
        }
        break;

      case 'thinking_delta':
        if (delta.thinking) {
          this.sink({
            type: 'thinking',
            sessionId: this.sessionId,
            messageId: this.messageId,
            text: delta.thinking,
          });
        }
        break;

      case 'input_json_delta':
        if (delta.partial_json) {
          block.toolInput += delta.partial_json;
        }
        break;
    }
  }

  private handleBlockStop(event: ClaudeContentBlockStop): void {
    const block = this.activeBlocks.get(event.index);
    if (!block) return;

    if (block.type === 'tool_use' && block.toolName) {
      // Parse accumulated tool input
      let input: Record<string, unknown> = {};
      try {
        if (block.toolInput) input = JSON.parse(block.toolInput);
      } catch { /* ignore parse errors */ }

      this.sink({
        type: 'tool_result',
        sessionId: this.sessionId,
        messageId: this.messageId,
        toolName: block.toolName,
        output: JSON.stringify(input),
      });
    }

    this.activeBlocks.delete(event.index);
  }

  private handleMessageDelta(event: ClaudeMessageDelta): void {
    if (event.usage) {
      this.usage = {
        inputTokens: event.usage.input_tokens,
        outputTokens: event.usage.output_tokens,
        cacheReadTokens: event.usage.cache_read_input_tokens,
        cacheWriteTokens: event.usage.cache_creation_input_tokens,
      };
    }
  }

  private handleResult(event: ClaudeResult): void {
    if (event.usage) {
      this.usage = {
        inputTokens: event.usage.input_tokens,
        outputTokens: event.usage.output_tokens,
        cacheReadTokens: event.usage.cache_read_input_tokens,
        cacheWriteTokens: event.usage.cache_creation_input_tokens,
        cost: event.cost_usd,
        durationMs: event.duration_ms,
      };
    }
    if (event.cost_usd !== undefined) {
      this.resultInfo.cost = event.cost_usd;
    }
    if (event.session_id) {
      this.resultInfo.sessionId = event.session_id;
    }

    // Emit result text if present
    if (event.result) {
      this.sink({
        type: 'assistant_chunk',
        sessionId: this.sessionId,
        messageId: this.messageId,
        text: event.result,
      });
    }
  }
}
