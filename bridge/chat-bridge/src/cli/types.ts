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

// ── Copilot CLI JSONL event types (`copilot -p --output-format json`) ──

/** Base envelope for all Copilot JSONL events */
export interface CopilotEventBase {
  type: string;
  id: string;
  timestamp: string;
  parentId?: string;
  ephemeral?: boolean;
}

export interface CopilotUserMessage extends CopilotEventBase {
  type: 'user.message';
  data: {
    content: string;
    transformedContent?: string;
    attachments?: unknown[];
    interactionId: string;
  };
}

export interface CopilotTurnStart extends CopilotEventBase {
  type: 'assistant.turn_start';
  data: {
    turnId: string;
    interactionId: string;
  };
}

export interface CopilotMessageDelta extends CopilotEventBase {
  type: 'assistant.message_delta';
  data: {
    messageId: string;
    deltaContent: string;
  };
}

export interface CopilotToolRequest {
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  type: 'function';
}

export interface CopilotAssistantMessage extends CopilotEventBase {
  type: 'assistant.message';
  data: {
    messageId: string;
    content: string;
    toolRequests: CopilotToolRequest[];
    interactionId: string;
    outputTokens?: number;
  };
}

export interface CopilotToolStart extends CopilotEventBase {
  type: 'tool.execution_start';
  data: {
    toolCallId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  };
}

export interface CopilotToolComplete extends CopilotEventBase {
  type: 'tool.execution_complete';
  data: {
    toolCallId: string;
    model?: string;
    interactionId?: string;
    success: boolean;
    result: {
      content: string;
      detailedContent?: string;
    };
    toolTelemetry?: Record<string, unknown>;
  };
}

export interface CopilotTurnEnd extends CopilotEventBase {
  type: 'assistant.turn_end';
  data: {
    turnId: string;
  };
}

export interface CopilotResult extends CopilotEventBase {
  type: 'result';
  sessionId: string;
  exitCode: number;
  usage?: {
    premiumRequests?: number;
    totalApiDurationMs?: number;
    sessionDurationMs?: number;
    codeChanges?: {
      linesAdded: number;
      linesRemoved: number;
      filesModified: string[];
    };
  };
}

export type CopilotStreamEvent =
  | CopilotUserMessage
  | CopilotTurnStart
  | CopilotMessageDelta
  | CopilotAssistantMessage
  | CopilotToolStart
  | CopilotToolComplete
  | CopilotTurnEnd
  | CopilotResult;
