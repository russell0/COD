import type { AgentEvent } from '@cod/types';

export interface StrategyContext {
  adapter: unknown;
  toolRegistry: unknown;
  workingDirectory: string;
  model: string;
  systemPrompt: string;
}

/**
 * An AgentStrategy controls provider-specific agent behavior:
 * - System prompt hints (algorithmic scaffolding for weaker models)
 * - Message preparation (rewriting prompts before the LLM loop)
 *
 * The default strategy is a pass-through with no hints.
 * Local model strategies (Gemma, Ollama) add algorithmic hints
 * that help smaller models generate correct code.
 */
export interface AgentStrategy {
  /**
   * Returns additional system prompt content (algorithmic hints, coding rules).
   * Called during initialization. Return empty string for no additions.
   */
  getSystemPromptHints(): string;

  /**
   * Called before the agent loop. Returns the (possibly rewritten) user
   * message and yields events for any pre-processing work.
   */
  prepare(
    userMessage: string,
    context: StrategyContext,
  ): AsyncGenerator<AgentEvent, string>;
}
