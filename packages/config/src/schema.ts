import { z } from 'zod';
import { PermissionMode } from '@cod/types';

const McpServerConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stdio'),
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
  }),
  z.object({
    type: z.literal('sse'),
    url: z.string().url(),
    env: z.record(z.string()).optional(),
  }),
  z.object({
    type: z.literal('http'),
    url: z.string().url(),
    env: z.record(z.string()).optional(),
  }),
]);

const HookConfigSchema = z.object({
  command: z.string(),
  timeout: z.number().int().positive().optional(),
});

const HooksConfigSchema = z.object({
  preToolUse: z.record(z.array(HookConfigSchema)).optional(),
  postToolUse: z.record(z.array(HookConfigSchema)).optional(),
  subagentStart: z.array(HookConfigSchema).optional(),
  stop: z.array(HookConfigSchema).optional(),
});

export const CodSettingsSchema = z.object({
  model: z.string().default('claude-sonnet-4-6'),
  provider: z.enum(['anthropic', 'openai', 'gemini', 'ollama', 'lm-studio']).default('anthropic'),
  permissionMode: z.nativeEnum(PermissionMode).default(PermissionMode.Default),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  apiKeys: z
    .object({
      anthropic: z.string().optional(),
      openai: z.string().optional(),
      gemini: z.string().optional(),
    })
    .default({}),
  ollamaBaseUrl: z.string().url().optional(),
  lmstudioBaseUrl: z.string().url().optional(),
  mcpServers: z.record(McpServerConfigSchema).default({}),
  hooks: HooksConfigSchema.default({}),
  blockedCommands: z.array(z.string()).default([]),
  autoCompact: z.boolean().default(true),
  compactThreshold: z.number().min(0).max(1).default(0.85),
  historySize: z.number().int().positive().default(1000),
});

export type CodSettings = z.infer<typeof CodSettingsSchema>;
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type HookConfig = z.infer<typeof HookConfigSchema>;
export type HooksConfig = z.infer<typeof HooksConfigSchema>;
