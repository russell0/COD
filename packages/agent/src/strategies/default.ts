import type { AgentEvent } from '@cod/types';
import type { AgentStrategy, StrategyContext } from './base.js';

/**
 * Default strategy: pass the user message through unchanged.
 * Used for capable models (Claude, GPT-4, GLM-5) that handle
 * multi-function tasks in a single generation.
 */
export class DefaultStrategy implements AgentStrategy {
  async *prepare(
    userMessage: string,
    _context: StrategyContext,
  ): AsyncGenerator<AgentEvent, string> {
    return userMessage;
  }
}
