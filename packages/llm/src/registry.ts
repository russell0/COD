import type { LLMAdapter } from '@cod/types';
import type { CodSettings } from '@cod/config';
import { AnthropicAdapter } from './adapters/anthropic.js';
import { OpenAIAdapter } from './adapters/openai.js';
import { GeminiAdapter } from './adapters/gemini.js';
import { OllamaAdapter } from './adapters/ollama.js';
import { LMStudioAdapter } from './adapters/lmstudio.js';

export class LLMRegistry {
  private adapters = new Map<string, LLMAdapter>();

  register(adapter: LLMAdapter): void {
    this.adapters.set(adapter.providerId, adapter);
  }

  get(providerId: string): LLMAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new Error(
        `LLM provider "${providerId}" not registered. Available: ${[...this.adapters.keys()].join(', ')}`,
      );
    }
    return adapter;
  }

  has(providerId: string): boolean {
    return this.adapters.has(providerId);
  }

  static createFromConfig(settings: CodSettings): { registry: LLMRegistry; adapter: LLMAdapter } {
    const registry = new LLMRegistry();

    if (settings.apiKeys.anthropic) {
      registry.register(new AnthropicAdapter(settings.apiKeys.anthropic));
    }

    if (settings.apiKeys.openai) {
      registry.register(new OpenAIAdapter(settings.apiKeys.openai));
    }

    if (settings.apiKeys.gemini) {
      registry.register(new GeminiAdapter(settings.apiKeys.gemini));
    }

    // Ollama always available (no key needed)
    registry.register(new OllamaAdapter(settings.ollamaBaseUrl));

    // LM Studio always available (no key needed)
    registry.register(new LMStudioAdapter(settings.lmstudioBaseUrl));

    const adapter = registry.get(settings.provider);
    return { registry, adapter };
  }
}
