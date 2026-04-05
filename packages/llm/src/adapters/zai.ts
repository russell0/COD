/**
 * Z.ai adapter for GLM-5 and other Zhipu AI models.
 * Uses the OpenAI-compatible API at https://api.z.ai/api/paas/v4/
 *
 * GLM-5: 744B total / 40B active parameters, 200K context, 128K max output.
 * Supports tool/function calling natively.
 *
 * Requires a Z.ai API key: https://docs.z.ai
 */
import { OpenAIAdapter } from './openai.js';
import type { LLMAdapter, LLMRequestOptions, LLMStreamEvent, Message } from '@cod/types';

export class ZaiAdapter implements LLMAdapter {
  readonly providerId = 'zai';
  private inner: OpenAIAdapter;

  constructor(apiKey: string, baseUrl = 'https://api.z.ai/api/paas/v4/') {
    this.inner = new OpenAIAdapter(apiKey, baseUrl);
  }

  stream(options: LLMRequestOptions): AsyncIterable<LLMStreamEvent> {
    return this.inner.stream(options);
  }

  countTokens(messages: Message[]): Promise<number> {
    return this.inner.countTokens(messages);
  }
}
