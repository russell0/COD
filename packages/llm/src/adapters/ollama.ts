/**
 * Ollama adapter — uses the OpenAI-compatible endpoint that Ollama exposes.
 * Default base URL: http://localhost:11434/v1
 */
import { OpenAIAdapter } from './openai.js';
import type { LLMAdapter, LLMRequestOptions, LLMStreamEvent, Message } from '@cod/types';

export class OllamaAdapter implements LLMAdapter {
  readonly providerId = 'ollama';
  private inner: OpenAIAdapter;

  constructor(baseUrl = 'http://localhost:11434/v1') {
    // Ollama doesn't need a real API key
    this.inner = new OpenAIAdapter('ollama', baseUrl);
  }

  stream(options: LLMRequestOptions): AsyncIterable<LLMStreamEvent> {
    return this.inner.stream(options);
  }

  countTokens(messages: Message[]): Promise<number> {
    return this.inner.countTokens(messages);
  }
}
