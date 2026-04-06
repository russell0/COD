import type { AgentStrategy } from './base.js';
import { DefaultStrategy } from './default.js';
import { GemmaStrategy } from './gemma.js';

export type { AgentStrategy, StrategyContext } from './base.js';
export { DefaultStrategy } from './default.js';
export { GemmaStrategy } from './gemma.js';

/**
 * Pick the right agent strategy based on provider.
 * Local models (LM Studio / Gemma) get the iterative strategy.
 * Cloud models (Anthropic, OpenAI, Z.ai) get the default pass-through.
 */
export function createStrategy(provider: string): AgentStrategy {
  switch (provider) {
    case 'lm-studio':
    case 'ollama':
      return new GemmaStrategy();
    default:
      return new DefaultStrategy();
  }
}
