import type { TokenUsage, StopReason } from './llm.js';
import type { ToolCall, ToolResult } from './tools.js';
import type { PermissionRequest } from './permissions.js';

export type AgentEvent =
  | { type: 'thinking_start' }
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call_start'; call: ToolCall }
  | { type: 'tool_call_permission_request'; call: ToolCall; request: PermissionRequest }
  | { type: 'tool_call_executing'; call: ToolCall }
  | { type: 'tool_call_complete'; call: ToolCall; result: ToolResult; durationMs: number }
  | { type: 'tool_call_denied'; call: ToolCall; reason?: string }
  | { type: 'subagent_start'; taskId: string; description: string }
  | { type: 'subagent_complete'; taskId: string; result: string }
  | { type: 'turn_complete'; usage: TokenUsage; stopReason: StopReason }
  | { type: 'context_compressed'; before: number; after: number }
  | { type: 'error'; error: Error; fatal: boolean };

export type AgentEventStream = AsyncGenerator<AgentEvent>;

export type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'responding'
  | 'tool_executing'
  | 'waiting_permission'
  | 'error';

export interface AgentConfig {
  model: string;
  provider: string;
  workingDirectory: string;
  sessionId?: string;
  maxTokens?: number;
  temperature?: number;
}
