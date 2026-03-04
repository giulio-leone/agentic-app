/**
 * CLI types — abstraction for spawnable CLI agents.
 */

import type { CliAgent } from '../protocol/messages.js';

export interface CliBinary {
  agent: CliAgent;
  path: string;
  /** Args for structured (stream-json) output mode */
  structuredArgs: string[];
  /** Args for interactive mode */
  interactiveArgs: string[];
  /** Whether this CLI supports structured JSON output */
  supportsStreamJson: boolean;
}

/** Claude Code stream-json event types (from `claude -p --output-format stream-json`) */
export type ClaudeStreamEvent =
  | ClaudeMessageStart
  | ClaudeContentBlockStart
  | ClaudeContentBlockDelta
  | ClaudeContentBlockStop
  | ClaudeMessageDelta
  | ClaudeMessageStop
  | ClaudeResult;

export interface ClaudeMessageStart {
  type: 'message_start';
  message: {
    id: string;
    role: string;
    model?: string;
  };
}

export interface ClaudeContentBlockStart {
  type: 'content_block_start';
  index: number;
  content_block: {
    type: 'text' | 'tool_use' | 'thinking';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  };
}

export interface ClaudeContentBlockDelta {
  type: 'content_block_delta';
  index: number;
  delta: {
    type: 'text_delta' | 'input_json_delta' | 'thinking_delta';
    text?: string;
    partial_json?: string;
    thinking?: string;
  };
}

export interface ClaudeContentBlockStop {
  type: 'content_block_stop';
  index: number;
}

export interface ClaudeMessageDelta {
  type: 'message_delta';
  delta: {
    stop_reason?: string;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export interface ClaudeMessageStop {
  type: 'message_stop';
}

export interface ClaudeResult {
  type: 'result';
  result?: string;
  is_error?: boolean;
  duration_ms?: number;
  cost_usd?: number;
  total_cost_usd?: number;
  session_id?: string;
  num_turns?: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}
