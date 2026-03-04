/**
 * Raw Text Parser — transforms raw CLI terminal output into chat messages.
 *
 * Used for CLIs that don't support structured output (Copilot CLI, Codex).
 * Accumulates text and emits as assistant_chunk messages.
 *
 * Simple heuristics:
 * - Lines starting with common tool-use patterns are emitted as tool_use
 * - Everything else is assistant_chunk text
 */

import type { MessageSink } from '../session/manager.js';
import type { ServerMsg } from '../protocol/messages.js';

const TOOL_PATTERNS = [
  { pattern: /^(?:Running|Executing):\s*(.+)/i, toolName: 'terminal_command' },
  { pattern: /^(?:Reading|Opening)\s+file:\s*(.+)/i, toolName: 'file_read' },
  { pattern: /^(?:Writing|Editing|Creating)\s+(?:file\s+)?(.+)/i, toolName: 'file_edit' },
  { pattern: /^(?:Searching|Grep)(?:ing)?\s+(.+)/i, toolName: 'search' },
];

export class RawTextParser {
  private buffer = '';
  private chunkTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private sessionId: string,
    private messageId: string,
    private sink: MessageSink,
  ) {}

  /** Feed raw terminal output */
  feed(data: string): void {
    this.buffer += data;
    // Debounce: emit after small pause to batch rapid small chunks
    if (this.chunkTimer) clearTimeout(this.chunkTimer);
    this.chunkTimer = setTimeout(() => this.emitBuffer(), 50);
  }

  /** Flush remaining buffer */
  flush(): void {
    if (this.chunkTimer) {
      clearTimeout(this.chunkTimer);
      this.chunkTimer = null;
    }
    this.emitBuffer();
  }

  private emitBuffer(): void {
    if (!this.buffer) return;
    const text = this.buffer;
    this.buffer = '';

    // Check for tool-use patterns line by line
    const lines = text.split('\n');
    let textAccum = '';

    for (const line of lines) {
      let matched = false;
      for (const { pattern, toolName } of TOOL_PATTERNS) {
        const m = line.match(pattern);
        if (m) {
          // Flush accumulated text first
          if (textAccum) {
            this.sink({
              type: 'assistant_chunk',
              sessionId: this.sessionId,
              messageId: this.messageId,
              text: textAccum,
            });
            textAccum = '';
          }
          this.sink({
            type: 'tool_use',
            sessionId: this.sessionId,
            messageId: this.messageId,
            toolName,
            input: { command: m[1] ?? line },
          });
          matched = true;
          break;
        }
      }
      if (!matched) {
        textAccum += line + '\n';
      }
    }

    // Emit remaining text
    if (textAccum) {
      this.sink({
        type: 'assistant_chunk',
        sessionId: this.sessionId,
        messageId: this.messageId,
        text: textAccum,
      });
    }
  }
}
