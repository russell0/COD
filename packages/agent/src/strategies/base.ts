import type { AgentEvent } from '@cod/types';

export interface StrategyContext {
  adapter: unknown;
  toolRegistry: unknown;
  workingDirectory: string;
  model: string;
  systemPrompt: string;
}

/**
 * An AgentStrategy can transform a user message into a sequence of
 * messages + tool invocations before the normal agent loop takes over.
 *
 * The default strategy is a pass-through. The Gemma strategy intercepts
 * multi-function coding tasks and generates code one function at a time.
 */
export interface AgentStrategy {
  prepare(
    userMessage: string,
    context: StrategyContext,
  ): AsyncGenerator<AgentEvent, string>;
}
