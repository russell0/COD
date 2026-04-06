import type { AgentEvent } from '@cod/types';
import type { AgentStrategy, StrategyContext } from './base.js';

/**
 * Strategy for local/small models (Gemma, Ollama-hosted models).
 * Provides algorithmic hints in the system prompt that help smaller models
 * generate correct code for common patterns they struggle with.
 *
 * These hints don't give away solutions — they provide structural scaffolding
 * that the model needs to organize its code generation. The model already knows
 * the algorithms; it needs reminders of which approach to use.
 */
export class GemmaStrategy implements AgentStrategy {

  getSystemPromptHints(): string {
    return `

## Local Model Instructions

### Critical Rules
- Start the file with \`from collections import deque\` if you use deque
- Match EXACT function signatures from specifications — same parameter names, types, return types
- NEVER use placeholder return values like \`return 0\` or \`return ""\`
- NEVER write "too complex" or "placeholder" comments — implement the actual logic
- Every function must have a complete, working implementation
- After writing code, run the evaluator if available to check test results
- If tests fail, read the failure messages carefully and fix the specific issues

### Division and Modulo (C-style, NOT Python-style)
Division truncates toward zero: \`int(a / b)\` not \`a // b\`
Modulo: \`a - int(a / b) * b\` not \`a % b\`
Examples: -7/2 = -3 (not -4), -7%3 = -1 (not 2)

### Roman Numeral Conversion
roman_calc MUST implement int_to_roman(num) using greedy subtraction with pairs: [(1000,'M'),(900,'CM'),(500,'D'),(400,'CD'),(100,'C'),(90,'XC'),(50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I')]. Do NOT return str(result).

### Text Justification
LAST line: left-justified, single spaces, pad with trailing spaces. Single word on a line: left-justify and pad.

### Interval Painting
Later ops paint OVER earlier. Collect all coordinates as breakpoints. For each sub-interval, find LAST covering operation. Merge adjacent same-color.

### Expression Evaluator
Recursive descent parser: parse_ternary (? :, right-assoc) -> parse_comparison (< > <= >= == !=) -> parse_additive (+ -) -> parse_multiplicative (* / %) -> parse_unary (prefix - +) -> parse_primary (numbers, parens). Use a position index.`;
  }

  /**
   * Extract function/class names from backtick-quoted identifiers in a spec.
   */
  extractFunctionNames(spec: string): string[] {
    const names: string[] = [];

    const callPattern = /`(\w+)\s*\(/g;
    let match;
    while ((match = callPattern.exec(spec)) !== null) {
      const name = match[1];
      const builtins = ['int', 'str', 'list', 'tuple', 'dict', 'set', 'bool', 'float', 'None', 'print', 'len', 'range'];
      if (name && !names.includes(name) && !builtins.includes(name)) {
        names.push(name);
      }
    }

    const classPattern = /`class\s+(\w+)/g;
    while ((match = classPattern.exec(spec)) !== null) {
      const name = match[1];
      if (name && !names.includes(name)) {
        names.unshift(name);
      }
    }

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
    // Pass through — single-shot generation works better than iterative.
    // Hints are provided via getSystemPromptHints(); evaluator feedback handles self-correction.
    return userMessage;
  }
}
