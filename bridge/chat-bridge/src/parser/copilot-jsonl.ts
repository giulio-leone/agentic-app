/**
 * Copilot JSONL Parser — transforms `copilot -p --output-format json`
 * output into chat-style WebSocket messages.
 *
 * Copilot CLI 0.422+ outputs NDJSON events:
 * - user.message, assistant.turn_start, assistant.message_delta,
 *   assistant.message, tool.execution_start, tool.execution_complete,
 *   assistant.turn_end, result
 *
 * We transform these into our chat protocol:
 * - assistant_chunk (text streaming via message_delta)
 * - tool_use (tool.execution_start)
 * - tool_result (tool.execution_complete)
 * - assistant_end (with usage from result event)
 */

import type { MessageSink } from '../session/manager.js';
import type { UsageInfo, ServerMsg } from '../protocol/messages.js';
import type {
  CopilotStreamEvent,
  CopilotEventBase,
  CopilotMessageDelta,
  CopilotAssistantMessage,
  CopilotToolStart,
  CopilotToolComplete,
  CopilotResult,
} from '../cli/types.js';
import { Logger } from '../utils/logger.js';

const log = new Logger('copilot-parser');

/** Internal tool names to filter from output (Copilot's bookkeeping tools) */
const INTERNAL_TOOLS = new Set(['report_intent']);

export class CopilotJsonlParser {
  private buffer = '';
  private usage: UsageInfo | undefined;
  private resultInfo: { sessionId?: string; exitCode?: number } = {};
  private currentTurnId: string | undefined;
  private toolNameMap = new Map<string, string>();

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

  /** Get Copilot session ID (from result event) */
  getCopilotSessionId(): string | undefined {
    return this.resultInfo.sessionId;
  }

  private parseLine(line: string): void {
    try {
      const event = JSON.parse(line) as CopilotStreamEvent;
      this.handleEvent(event);
    } catch {
      if (line.startsWith('{') || line.startsWith('[')) {
        log.warn('Malformed JSON line', { line: line.substring(0, 100) });
      }
      // Non-JSON output (verbose logs, ANSI remnants) → emit as text
      this.sink({
        type: 'assistant_chunk',
        sessionId: this.sessionId,
        messageId: this.messageId,
        text: line + '\n',
      });
    }
  }

  private handleEvent(event: CopilotStreamEvent): void {
    switch (event.type) {
      case 'user.message':
        break;

      case 'assistant.turn_start':
        this.currentTurnId = event.data.turnId;
        break;

      case 'assistant.message_delta':
        this.handleDelta(event as CopilotMessageDelta);
        break;

      case 'assistant.message':
        this.handleMessage(event as CopilotAssistantMessage);
        break;

      case 'tool.execution_start':
        this.handleToolStart(event as CopilotToolStart);
        break;

      case 'tool.execution_complete':
        this.handleToolComplete(event as CopilotToolComplete);
        break;

      case 'assistant.turn_end':
        break;

      case 'result':
        this.handleResult(event as CopilotResult);
        break;

      default:
        log.debug('Unknown Copilot event type', { type: (event as CopilotEventBase).type });
    }
  }

  /** Streaming text delta — the real-time text chunks */
  private handleDelta(event: CopilotMessageDelta): void {
    if (event.data.deltaContent) {
      this.sink({
        type: 'assistant_chunk',
        sessionId: this.sessionId,
        messageId: this.messageId,
        text: event.data.deltaContent,
      });
    }
  }

  /**
   * Full assistant message — contains final content + tool requests.
   * Text content is already streamed via message_delta, so we only
   * extract tool requests that weren't covered by tool.execution_start.
   */
  private handleMessage(event: CopilotAssistantMessage): void {
    for (const req of event.data.toolRequests) {
      if (INTERNAL_TOOLS.has(req.name)) continue;
      // Track the mapping for tool.execution_complete resolution
      this.toolNameMap.set(req.toolCallId, req.name);
    }
  }

  /** Tool execution start — emit tool_use with name + arguments, track mapping */
  private handleToolStart(event: CopilotToolStart): void {
    this.toolNameMap.set(event.data.toolCallId, event.data.toolName);
    if (INTERNAL_TOOLS.has(event.data.toolName)) return;

    this.sink({
      type: 'tool_use',
      sessionId: this.sessionId,
      messageId: this.messageId,
      toolName: event.data.toolName,
      input: event.data.arguments,
    });
  }

  /** Tool execution complete — emit tool_result with output */
  private handleToolComplete(event: CopilotToolComplete): void {
    const toolName = this.toolNameMap.get(event.data.toolCallId) ?? 'unknown';
    if (INTERNAL_TOOLS.has(toolName)) return;

    this.sink({
      type: 'tool_result',
      sessionId: this.sessionId,
      messageId: this.messageId,
      toolName,
      output: event.data.result.detailedContent ?? event.data.result.content,
      isError: !event.data.success,
    });
  }

  /** Final result — session usage & metadata */
  private handleResult(event: CopilotResult): void {
    this.resultInfo.sessionId = event.sessionId;
    this.resultInfo.exitCode = event.exitCode;

    if (event.usage) {
      this.usage = {
        inputTokens: 0,
        outputTokens: 0,
        durationMs: event.usage.sessionDurationMs,
      };
    }
  }
}
