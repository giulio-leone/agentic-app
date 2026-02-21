/**
 * Deep Agents — React Native adapters and re-exports.
 */

// RN-specific adapters
export { AsyncStorageMemoryAdapter } from './AsyncStorageMemoryAdapter';
export { VirtualFilesystemRN } from './VirtualFilesystemRN';

// Re-export core from @onegenui/deep-agents
export {
  DeepAgent,
  DeepAgentBuilder,
  EventBus,
  ApprovalManager,
  ApproximateTokenCounter,
  InMemoryAdapter,
  TokenTracker,
  ContextManager,
  RollingSummarizer,
  createFilesystemTools,
  createPlanningTools,
  createAsyncSubagentTools,
  MajorityVoteConsensus,
  LlmJudgeConsensus,
  DebateConsensus,
  AgentGraph,
  AgentGraphBuilder,
} from '@giulio-leone/gaussflow-agent';

export type {
  DeepAgentConfig,
  AgentEvent,
  AgentEventType,
  AgentEventHandler,
  MemoryPort,
  FilesystemPort,
  TokenCounterPort,
  McpPort,
  Message as DeepAgentMessage,
  ConsensusPort,
  GraphStreamEvent,
} from '@giulio-leone/gaussflow-agent';
