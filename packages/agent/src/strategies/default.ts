import type { AgentEvent } from '@cod/types';
import type { AgentStrategy, StrategyContext } from './base.js';

/**
 * Default strategy: no hints, pass the user message through unchanged.
 * Used for capable cloud models (Claude, GPT-4, GLM-5) that handle
 * multi-function tasks without algorithmic scaffolding.
 */
export class DefaultStrategy implements AgentStrategy {
  getSystemPromptHints(): string {
    return '';
  }

  async *prepare(
    userMessage: string,
    _context: StrategyContext,
  ): AsyncGenerator<AgentEvent, string> {
    return userMessage;
  }
}
