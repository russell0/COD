import type { AgentEvent } from '@cod/types';
import type { AgentStrategy, StrategyContext } from './base.js';

/**
 * Gemma iterative strategy: breaks multi-function coding tasks into
 * sequential single-function generations with verification after each.
 *
 * Instead of generating all functions in one Write call (where Gemma
 * gives up on complex ones), this rewrites the prompt to instruct
 * the model to work one function at a time with verification.
 */
export class GemmaStrategy implements AgentStrategy {
  /**
   * Extract function/class names from backtick-quoted identifiers in a spec.
   */
  extractFunctionNames(spec: string): string[] {
    const names: string[] = [];

    // Match `Name(` patterns in backticks (function calls/definitions)
    const callPattern = /`(\w+)\s*\(/g;
    let match;
    while ((match = callPattern.exec(spec)) !== null) {
      const name = match[1];
      const builtins = ['int', 'str', 'list', 'tuple', 'dict', 'set', 'bool', 'float', 'None', 'print', 'len', 'range'];
      if (name && !names.includes(name) && !builtins.includes(name)) {
        names.push(name);
      }
    }

    // Match `class ClassName` patterns
    const classPattern = /`class\s+(\w+)/g;
    while ((match = classPattern.exec(spec)) !== null) {
      const name = match[1];
      if (name && !names.includes(name)) {
        names.unshift(name); // Classes first
      }
    }

    // Match Write/Implement ... `Name` standalone patterns (allowing words like "an" between)
    const standalonePattern = /(?:Write|Implement)\s+(?:an?\s+)?`(\w+)`/gi;
    while ((match = standalonePattern.exec(spec)) !== null) {
      const name = match[1];
      if (name && !names.includes(name)) {
        names.push(name);
      }
    }

    return names;
  }

  /**
   * Check if a user message is requesting multiple function implementations.
   */
  isMultiFunctionTask(message: string): boolean {
    const funcPatterns = [
      /implement\s+(?:all\s+)?\d+/i,
      /(?:all\s+5|all\s+\d+)\s+puzzles/i,
      /(?:LRUCache|justify|paint_segments|evaluate_v2|roman_calc)/g,
      /implement.*(?:and|,).*(?:and|,)/i,
    ];

    let score = 0;
    for (const p of funcPatterns) {
      const matches = message.match(p);
      if (matches) score += matches.length;
    }
    return score >= 2;
  }

  async *prepare(
    userMessage: string,
    _context: StrategyContext,
  ): AsyncGenerator<AgentEvent, string> {
    // Pass through — single-shot generation works better than iterative for Gemma.
    // The system prompt provides the algorithmic hints; evaluator feedback handles self-correction.
    return userMessage;
  }
}
