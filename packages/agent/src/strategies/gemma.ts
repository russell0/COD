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
- Start with \`from collections import deque, defaultdict\` if needed
- Match EXACT function signatures — same parameter names, types, return types
- NEVER use placeholder return values like \`return 0\` or \`return ""\`
- NEVER write "too complex" or "placeholder" — implement the actual logic
- Implement ALL requested functions, not a subset
- After writing, run the evaluator if available; if tests fail, fix them

### Data Structures
- MinStack: maintain a parallel stack tracking min at each depth
- Queue from stacks: use two stacks, transfer on pop/peek when output stack empty
- HashMap: array of buckets, hash % len for index, handle collisions with chaining or probing
- PriorityQueue/heap: list-based, parent=i//2, children=2i+1/2i+2, sift up/down

### String & Parsing
- Balanced brackets: stack — push on open, pop+compare on close
- Regex with . and *: dynamic programming or recursive backtracking
- Calculator/evaluator: recursive descent — one function per precedence level
- Division truncates toward zero: use \`int(a / b)\` not \`a // b\`
- Roman numerals: int_to_roman uses greedy subtraction with value-symbol pairs

### Sorting & Searching
- Binary search for range: two separate binary searches (first and last occurrence)
- Merge K sorted lists: use a heap of (value, list_index, element_index)
- Count inversions: modified merge sort, count when right element placed before left

### Dynamic Programming
- Base cases first (empty, zero, n<=1)
- LCS/edit distance: 2D table bottom-up, dp[i][j] depends on dp[i-1][j-1], dp[i-1][j], dp[i][j-1]
- Knapsack 0/1: dp[i][w] = max(exclude item, include if fits)
- Coin change: dp[amount] = min coins, iterate coins then amounts

### Graphs
- BFS shortest path: queue of (node, path), track visited
- Cycle detection (directed): three states — unvisited, in-progress, done
- Topological sort: Kahn's algorithm — track in-degree, process zero-degree nodes

### Math
- Prime sieve: mark multiples starting from i*i up to n
- GCD: Euclidean — gcd(a,b) = gcd(b, a%b), base case b==0
- Matrix multiply: result[i][j] = sum(a[i][k] * b[k][j] for k)

### Simulation
- Game of Life: count neighbors on ORIGINAL grid, apply rules to NEW grid
- Flood fill: BFS/DFS from start cell, skip if same color as new_color (prevents infinite loop)

### Utilities
- Base conversion: parse input string to int, then repeatedly divmod to build output digits
- Use uppercase for digits A-Z (bases > 10)`;
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
