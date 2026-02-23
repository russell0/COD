import type { PermissionMode } from './permissions.js';

export interface McpServerConfig {
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface HookConfig {
  command: string;
  timeout?: number;
}

export interface HooksConfig {
  preToolUse?: Record<string, HookConfig[]>;
  postToolUse?: Record<string, HookConfig[]>;
  subagentStart?: HookConfig[];
  stop?: HookConfig[];
}

export interface CodSettings {
  model: string;
  provider: 'anthropic' | 'openai' | 'gemini' | 'ollama';
  permissionMode: PermissionMode;
  maxTokens?: number;
  temperature?: number;
  apiKeys: {
    anthropic?: string;
    openai?: string;
    gemini?: string;
  };
  ollamaBaseUrl?: string;
  mcpServers: Record<string, McpServerConfig>;
  hooks: HooksConfig;
  blockedCommands: string[];
  autoCompact: boolean;
  compactThreshold: number;
  historySize: number;
}
