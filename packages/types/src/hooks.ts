import type { ToolCall, ToolResult } from './tools.js';

export type HookEvent =
  | { type: 'preToolUse'; call: ToolCall; workingDirectory: string }
  | { type: 'postToolUse'; call: ToolCall; result: ToolResult; workingDirectory: string }
  | { type: 'subagentStart'; taskId: string; description: string }
  | { type: 'stop'; sessionId: string };

export type HookDecision =
  | { type: 'allow' }
  | { type: 'deny'; reason: string }
  | { type: 'modify'; modifiedInput: unknown };

export interface HookOutput {
  decision?: HookDecision;
  metadata?: Record<string, unknown>;
}
