/**
 * LM Studio adapter — uses the OpenAI-compatible endpoint that LM Studio exposes.
 * Default base URL: http://localhost:1234/v1
 *
 * Designed for running local models (e.g., Gemma 4 E2B) on Mac Metal GPU.
 * No API key required.
 */
import { OpenAIAdapter } from './openai.js';
import type { LLMAdapter, LLMRequestOptions, LLMStreamEvent, Message } from '@cod/types';

export class LMStudioAdapter implements LLMAdapter {
  readonly providerId = 'lm-studio';
  private inner: OpenAIAdapter;

  constructor(baseUrl = 'http://localhost:1234/v1') {
    // LM Studio doesn't need a real API key
    this.inner = new OpenAIAdapter('lm-studio', baseUrl);
  }

  stream(options: LLMRequestOptions): AsyncIterable<LLMStreamEvent> {
    return this.inner.stream(options);
  }

  countTokens(messages: Message[]): Promise<number> {
    return this.inner.countTokens(messages);
  }
}
