import type { ZodTypeAny } from 'zod';
import type { PermissionRequest } from './permissions.js';

export type ToolResult =
  | { type: 'text'; text: string }
  | { type: 'error'; message: string }
  | { type: 'image'; base64: string; mimeType: string };

export interface ToolExecutionContext {
  workingDirectory: string;
  signal?: AbortSignal;
  sessionId: string;
  requestPermission?: (request: PermissionRequest) => Promise<boolean>;
  spawnSubagent?: (config: SubagentConfig) => Promise<string>;
}

export interface SubagentConfig {
  taskId: string;
  description: string;
  prompt: string;
  model?: string;
  workingDirectory?: string;
}

export interface ToolDefinition<TInput = unknown> {
  name: string;
  description: string;
  // Use ZodTypeAny to allow ZodDefault, ZodOptional, etc. without type errors
  inputSchema: ZodTypeAny;
  annotations?: {
    readOnly?: boolean;
    destructive?: boolean;
    requiresShell?: boolean;
  };
  execute(input: TInput, context: ToolExecutionContext): Promise<ToolResult>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}
