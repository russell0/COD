import type { z } from 'zod';

export interface Message {
  role: 'user' | 'assistant';
  content: MessageContent[];
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: ToolResultContent[] }
  | { type: 'image'; source: ImageSource };

export type ToolResultContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: ImageSource };

export interface ImageSource {
  type: 'base64';
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'error';

export interface LLMToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LLMRequestOptions {
  model: string;
  messages: Message[];
  systemPrompt?: string;
  tools?: LLMToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export type LLMStreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_input_delta'; id: string; delta: string }
  | { type: 'tool_use_complete'; id: string; name: string; input: unknown }
  | { type: 'message_complete'; usage: TokenUsage; stopReason: StopReason }
  | { type: 'error'; error: Error };

export interface LLMAdapter {
  readonly providerId: string;
  stream(options: LLMRequestOptions): AsyncIterable<LLMStreamEvent>;
  countTokens(messages: Message[]): Promise<number>;
}

export interface ModelInfo {
  id: string;
  name: string;
  providerId: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsImages: boolean;
  inputCostPer1kTokens?: number;
  outputCostPer1kTokens?: number;
}
