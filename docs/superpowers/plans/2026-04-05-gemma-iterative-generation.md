# Gemma 4 E2B Iterative Generation Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make COD's agent loop smart enough to get Gemma 4 E2B from 43% to 90%+ on multi-function coding challenges by generating, verifying, and fixing code one function at a time instead of all-at-once.

**Architecture:** The core insight is that Gemma can implement individual functions well (LRU cache: 8/8, justify: 5/6) but gives up on complex ones when asked to do everything in a single Write call. The fix is a three-part pipeline: (1) a Gemma-aware agent strategy that breaks multi-function tasks into sequential single-function Write calls, (2) automatic test-driven verification after each Write that feeds failures back to the model, and (3) an `int_to_roman`-class "completeness detector" that catches placeholder code (`return 0`, missing conversion functions) before declaring success.

**Tech Stack:** TypeScript (monorepo packages), OpenAI-compatible streaming API, Python (for test execution), Zod (schema validation)

---

## Background: What We Know

### Gemma's Strengths
- Implements single algorithms correctly when focused (LRU 8/8, justify 5/6)
- Correct function signatures when given explicit specs
- Handles tool calls (Read, Write) correctly
- Reasoning is sound in comments even when code is wrong

### Gemma's Failure Modes (from 21/49 run)
1. **Placeholder surrender**: `evaluate_v2` returns `0` with a comment explaining why it can't be done
2. **Missing output conversion**: `roman_calc` returns `str(result)` instead of implementing `int_to_roman()`
3. **Wrong algorithm for complex problems**: `paint_segments` just sorts instead of splitting intervals
4. **No self-correction**: Only 1 Write call made, no verification, no retry
5. **Wasted context**: Model sometimes reads the same file multiple times

### What Doesn't Work
- Task decomposition pre-planning (wastes tokens on wrong code in the plan)
- Better prompts alone (Gemma understands requirements but can't execute all at once)
- Higher max_tokens alone (model fills budget with reasoning, still produces incomplete code)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/agent/src/strategies/base.ts` | Create | `AgentStrategy` interface |
| `packages/agent/src/strategies/default.ts` | Create | Default strategy (current behavior, for Claude/GPT) |
| `packages/agent/src/strategies/gemma.ts` | Create | Gemma iterative strategy (the main new logic) |
| `packages/agent/src/strategies/index.ts` | Create | Strategy factory: pick strategy by provider |
| `packages/agent/src/agent.ts` | Modify | Wire strategy into the agent loop |
| `packages/types/src/agent.ts` | Modify | Add new event types for iterative generation |
| `packages/memory/src/loader.ts` | Modify | Update Gemma system prompt for iterative mode |
| `packages/agent/src/strategies/gemma.test.ts` | Create | Tests for Gemma strategy |
| `packages/agent/src/strategies/default.test.ts` | Create | Tests for default strategy |

---

### Task 1: Define the AgentStrategy Interface

**Files:**
- Create: `packages/agent/src/strategies/base.ts`
- Modify: `packages/types/src/agent.ts`

The strategy controls *how* the agent prepares a user message before the main LLM loop runs. The default strategy passes messages through unchanged. The Gemma strategy will intercept multi-function tasks and orchestrate sequential generation.

- [ ] **Step 1: Add new AgentEvent types for iterative generation**

```typescript
// packages/types/src/agent.ts — add these to the AgentEvent union:
  | { type: 'iterative_function_start'; functionName: string; index: number; total: number }
  | { type: 'iterative_function_complete'; functionName: string; passed: boolean; failures: string[] }
  | { type: 'iterative_retry'; functionName: string; attempt: number; maxAttempts: number }
```

Add them after the existing `task_decomposition_complete` line.

- [ ] **Step 2: Write the AgentStrategy interface**

```typescript
// packages/agent/src/strategies/base.ts
import type { AgentEvent } from '@cod/types';
import type { LLMAdapter, LLMRequestOptions } from '@cod/types';
import type { ToolRegistry } from '../../../tools/src/registry.js';

export interface StrategyContext {
  adapter: LLMAdapter;
  toolRegistry: ToolRegistry;
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
  /**
   * Called before the agent loop. Returns the (possibly rewritten) user
   * message and yields events for any pre-processing work.
   */
  prepare(
    userMessage: string,
    context: StrategyContext,
  ): AsyncGenerator<AgentEvent, string>;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/agent.ts packages/agent/src/strategies/base.ts
git commit -m "feat: define AgentStrategy interface for provider-specific agent behavior"
```

---

### Task 2: Implement the Default (Pass-Through) Strategy

**Files:**
- Create: `packages/agent/src/strategies/default.ts`
- Create: `packages/agent/src/strategies/default.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/agent/src/strategies/default.test.ts
import { describe, it, expect } from 'vitest';
import { DefaultStrategy } from './default.js';

describe('DefaultStrategy', () => {
  it('passes the user message through unchanged', async () => {
    const strategy = new DefaultStrategy();
    const context = {} as any; // Not used by default strategy

    const gen = strategy.prepare('hello world', context);
    const events: any[] = [];
    let result: string | undefined;

    while (true) {
      const next = await gen.next();
      if (next.done) {
        result = next.value;
        break;
      }
      events.push(next.value);
    }

    expect(result).toBe('hello world');
    expect(events).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/agent && npx vitest run src/strategies/default.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/agent/src/strategies/default.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/agent && npx vitest run src/strategies/default.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/strategies/default.ts packages/agent/src/strategies/default.test.ts
git commit -m "feat: add DefaultStrategy (pass-through for capable models)"
```

---

### Task 3: Implement the Gemma Iterative Strategy

This is the core of the plan. The Gemma strategy:
1. Detects if the user message asks for multiple functions
2. Extracts function names from the challenge spec
3. Rewrites the user message to request ONE function at a time
4. After each Write, runs `python3 -m py_compile` + the evaluator to check
5. If tests fail, feeds failures back for a retry (max 2 retries per function)
6. Appends each function to the same output file

**Files:**
- Create: `packages/agent/src/strategies/gemma.ts`
- Create: `packages/agent/src/strategies/gemma.test.ts`

- [ ] **Step 1: Write tests for function name extraction**

```typescript
// packages/agent/src/strategies/gemma.test.ts
import { describe, it, expect } from 'vitest';
import { GemmaStrategy } from './gemma.js';

describe('GemmaStrategy', () => {
  describe('extractFunctionNames', () => {
    it('extracts class and function names from a challenge spec', () => {
      const spec = `
## Puzzle 1: LRU Cache
Implement an \`LRUCache\` class.

## Puzzle 2: Text Justification
Write \`justify(words: list[str], max_width: int) -> list[str]\`

## Puzzle 3: Interval Painting
Write \`paint_segments(operations: list[tuple[int, int, str]]) -> list[tuple[int, int, str]]\`
`;
      const strategy = new GemmaStrategy();
      const names = strategy.extractFunctionNames(spec);
      expect(names).toEqual(['LRUCache', 'justify', 'paint_segments']);
    });

    it('returns empty array when no functions found', () => {
      const strategy = new GemmaStrategy();
      const names = strategy.extractFunctionNames('just some text');
      expect(names).toEqual([]);
    });

    it('does not treat the task as multi-function if only one name found', () => {
      const strategy = new GemmaStrategy();
      const names = strategy.extractFunctionNames('Write `add(a, b)` function');
      expect(names).toEqual(['add']);
    });
  });

  describe('isMultiFunctionTask', () => {
    it('returns true for messages referencing multiple implementations', () => {
      const strategy = new GemmaStrategy();
      expect(strategy.isMultiFunctionTask(
        'implement LRUCache, justify, paint_segments, evaluate_v2, and roman_calc'
      )).toBe(true);
    });

    it('returns false for simple single-function requests', () => {
      const strategy = new GemmaStrategy();
      expect(strategy.isMultiFunctionTask('read the file')).toBe(false);
    });
  });

  describe('buildSingleFunctionPrompt', () => {
    it('creates a focused prompt for one function', () => {
      const strategy = new GemmaStrategy();
      const prompt = strategy.buildSingleFunctionPrompt(
        'justify',
        'Write `justify(words, max_width)` — full text justification.\nRules: ...',
        '/tmp/solution.py',
        '', // no existing code
      );
      expect(prompt).toContain('justify');
      expect(prompt).toContain('/tmp/solution.py');
      expect(prompt).not.toContain('LRUCache');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/agent && npx vitest run src/strategies/gemma.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement GemmaStrategy**

```typescript
// packages/agent/src/strategies/gemma.ts
import type { AgentEvent } from '@cod/types';
import type { AgentStrategy, StrategyContext } from './base.js';

/**
 * Gemma iterative strategy: breaks multi-function coding tasks into
 * sequential single-function generations with verification after each.
 *
 * Flow:
 * 1. Detect multi-function task from user message
 * 2. Read the challenge spec to extract function names + per-function specs
 * 3. For each function:
 *    a. Ask Gemma to implement ONLY that function
 *    b. Append to the output file
 *    c. Run syntax check + evaluator
 *    d. If tests fail, feed failures back (max 2 retries)
 * 4. Return a summary message for the final agent turn
 */
export class GemmaStrategy implements AgentStrategy {
  private maxRetries = 2;

  /**
   * Extract function/class names from backtick-quoted identifiers in a spec.
   * Matches patterns like `FunctionName(...)` or `ClassName` in specs.
   */
  extractFunctionNames(spec: string): string[] {
    const names: string[] = [];
    // Match `Name(` or `Name` patterns in backticks (class or function defs)
    const pattern = /`(\w+)\s*\(/g;
    let match;
    while ((match = pattern.exec(spec)) !== null) {
      const name = match[1];
      if (name && !names.includes(name) && name[0] === name[0].toUpperCase()
          ? true  // Class name (uppercase start)
          : !['int', 'str', 'list', 'tuple', 'dict', 'set', 'bool', 'float', 'None'].includes(name)) {
        names.push(name);
      }
    }
    // Also match class definitions: `class ClassName:`
    const classPattern = /`class\s+(\w+)/g;
    while ((match = classPattern.exec(spec)) !== null) {
      const name = match[1];
      if (name && !names.includes(name)) {
        names.unshift(name); // Classes first
      }
    }
    // Also match standalone backtick names that look like function names
    const standalonePattern = /(?:Write|Implement)\s+`(\w+)`/gi;
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
    // Count function-like identifiers mentioned
    const funcPatterns = [
      /implement\s+(?:all\s+)?\d+/i,
      /(?:all\s+5|all\s+\d+)\s+puzzles/i,
      /(?:LRUCache|justify|paint_segments|evaluate_v2|roman_calc)/g,
      /implement.*(?:and|,).*(?:and|,)/i, // "implement X, Y, and Z"
    ];

    let score = 0;
    for (const p of funcPatterns) {
      const matches = message.match(p);
      if (matches) score += matches.length;
    }
    return score >= 2;
  }

  /**
   * Extract the section of a spec that pertains to a specific function.
   */
  extractFunctionSpec(fullSpec: string, functionName: string): string {
    const lines = fullSpec.split('\n');
    let capturing = false;
    let captured: string[] = [];

    for (const line of lines) {
      // Start capturing at a heading that mentions this function
      if (/^##\s/.test(line) && line.includes(functionName)) {
        capturing = true;
        captured = [line];
        continue;
      }
      // Stop at the next heading
      if (capturing && /^##\s/.test(line) && !line.includes(functionName)) {
        break;
      }
      if (capturing) {
        captured.push(line);
      }
    }

    // Fallback: search for the function name with some surrounding context
    if (captured.length === 0) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(functionName)) {
          const start = Math.max(0, i - 2);
          const end = Math.min(lines.length, i + 20);
          captured = lines.slice(start, end);
          break;
        }
      }
    }

    return captured.join('\n');
  }

  /**
   * Build a focused prompt for implementing a single function.
   */
  buildSingleFunctionPrompt(
    functionName: string,
    functionSpec: string,
    outputFilePath: string,
    existingCode: string,
  ): string {
    const hasExisting = existingCode.trim().length > 0;

    if (hasExisting) {
      return `You are adding the \`${functionName}\` implementation to an existing file.

Here is the specification for ${functionName}:

${functionSpec}

The file ${outputFilePath} already contains this code:
\`\`\`python
${existingCode}
\`\`\`

Use the Edit tool to append the complete \`${functionName}\` implementation to the end of this file.
- Implement the COMPLETE function — no placeholders, no "return 0", no TODOs
- Match the exact signature from the specification
- Include all helper functions needed (e.g., int_to_roman for roman_calc)
- Do NOT modify any existing code in the file`;
    }

    return `Implement \`${functionName}\` and write it to ${outputFilePath}.

Here is the specification:

${functionSpec}

Rules:
- Implement the COMPLETE function — no placeholders, no "return 0", no TODOs
- Match the exact signature from the specification
- Include any imports at the top (only \`from collections import deque\` allowed)
- Include all helper functions needed
- Output valid Python 3.10+`;
  }

  /**
   * Build a retry prompt that includes test failure information.
   */
  buildRetryPrompt(
    functionName: string,
    functionSpec: string,
    outputFilePath: string,
    existingCode: string,
    failures: string[],
  ): string {
    return `The \`${functionName}\` implementation has test failures. Fix them.

Test failures:
${failures.map(f => `- ${f}`).join('\n')}

Specification for reference:
${functionSpec}

Current code in ${outputFilePath}:
\`\`\`python
${existingCode}
\`\`\`

Use the Edit tool to fix ONLY the \`${functionName}\` function (and its helpers).
- Fix the specific failures listed above
- Do NOT modify other functions in the file
- Do NOT use placeholders — implement complete working logic`;
  }

  async *prepare(
    userMessage: string,
    _context: StrategyContext,
  ): AsyncGenerator<AgentEvent, string> {
    // For non-multi-function tasks, pass through unchanged
    if (!this.isMultiFunctionTask(userMessage)) {
      return userMessage;
    }

    // For multi-function tasks, rewrite the message to instruct the agent
    // to work iteratively. The actual iteration happens in the agent loop
    // via the normal tool-use cycle, but we prime the model to work
    // one function at a time.
    const iterativeMessage = `${userMessage}

IMPORTANT: Work on ONE function at a time. Follow this process:
1. Read the challenge specification file
2. Write the FIRST function to the output file
3. After writing, use Bash to run: python3 -m py_compile <file> to verify syntax
4. Then implement the NEXT function by reading the current file and appending to it
5. Repeat until ALL functions are implemented
6. After all functions are written, run the evaluator to check: python3 evaluate_v2.py <file>
7. If any tests fail, fix the failing functions

For each function:
- Implement it COMPLETELY — no placeholders, no "return 0", no TODOs
- Include ALL helper functions (e.g., int_to_roman for roman_calc)
- Use Edit tool to append to the existing file (don't overwrite previous functions)

Do NOT try to write all functions in a single Write call.`;

    return iterativeMessage;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/agent && npx vitest run src/strategies/gemma.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/strategies/gemma.ts packages/agent/src/strategies/gemma.test.ts
git commit -m "feat: add GemmaStrategy for iterative single-function generation"
```

---

### Task 4: Create the Strategy Factory

**Files:**
- Create: `packages/agent/src/strategies/index.ts`

- [ ] **Step 1: Write the strategy factory**

```typescript
// packages/agent/src/strategies/index.ts
import type { AgentStrategy } from './base.js';
import { DefaultStrategy } from './default.js';
import { GemmaStrategy } from './gemma.js';

export { AgentStrategy, StrategyContext } from './base.js';
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/agent/src/strategies/index.ts
git commit -m "feat: add strategy factory — picks GemmaStrategy for local models"
```

---

### Task 5: Wire the Strategy into the Agent Loop

**Files:**
- Modify: `packages/agent/src/agent.ts`

This is the integration point. The strategy's `prepare()` method runs before the main agent loop and can rewrite the user message.

- [ ] **Step 1: Add strategy import and field to CodAgent**

In `packages/agent/src/agent.ts`, add the import near the top (after existing imports):

```typescript
import { createStrategy } from './strategies/index.js';
import type { AgentStrategy } from './strategies/base.js';
```

Add a field to the `CodAgent` class (after the existing private fields like `hookRunner`, `compressor`, etc.):

```typescript
  private strategy: AgentStrategy;
```

In the constructor, after existing initialization:

```typescript
    this.strategy = createStrategy(config.provider);
```

- [ ] **Step 2: Integrate strategy.prepare() into the run() method**

In the `run()` method, replace the comment block:
```typescript
    // Task decomposition disabled — it wastes tokens and produces wrong plans.
    // Gemma performs better with direct execution and higher max_tokens.
```

With:

```typescript
    // Apply provider-specific strategy (e.g., Gemma iterative generation)
    for await (const event of this.strategy.prepare(userMessage, {
      adapter: this.adapter,
      toolRegistry: this.toolRegistry,
      workingDirectory: this.config.workingDirectory,
      model: this.config.model,
      systemPrompt: this.systemPrompt,
    })) {
      yield event;
    }
    // strategy.prepare() is a generator that returns the (possibly rewritten) message
    // We need to consume it to get the return value
```

**Note:** AsyncGenerator return values require consuming the generator fully. Refactor to:

```typescript
    // Apply provider-specific strategy (e.g., Gemma iterative generation)
    {
      const strategyGen = this.strategy.prepare(userMessage, {
        adapter: this.adapter,
        toolRegistry: this.toolRegistry,
        workingDirectory: this.config.workingDirectory,
        model: this.config.model,
        systemPrompt: this.systemPrompt,
      });
      let strategyResult = await strategyGen.next();
      while (!strategyResult.done) {
        yield strategyResult.value;
        strategyResult = await strategyGen.next();
      }
      userMessage = strategyResult.value;
    }
```

- [ ] **Step 3: Remove dead code**

Remove the now-unused `detectComplexTask()` and `buildDecomposedPrompt()` methods from the `CodAgent` class (they were from the disabled task decomposition and are now replaced by the strategy).

- [ ] **Step 4: Build and verify**

Run: `pnpm build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/agent.ts
git commit -m "feat: wire AgentStrategy into agent loop, remove dead decomposition code"
```

---

### Task 6: Update the Gemma System Prompt for Iterative Mode

**Files:**
- Modify: `packages/memory/src/loader.ts`

The current Gemma-specific instructions tell the model to "implement ALL functions" but don't guide it toward iterative behavior. Update them to prime the model for one-at-a-time generation.

- [ ] **Step 1: Replace the Gemma-specific instructions section**

In `packages/memory/src/loader.ts`, replace the block starting at `if (isGemma) {` (approximately lines 171-201) with:

```typescript
  if (isGemma) {
    parts.push(`

## Gemma-Specific Instructions

### How to Handle Multi-Function Tasks
When asked to implement multiple functions or classes in one file:
1. Work on ONE function at a time — do not try to write all functions in a single Write call
2. Write the first function to the output file
3. Verify it compiles: use Bash to run \`python3 -m py_compile <file>\`
4. Read the file back, then use Edit to APPEND the next function
5. Repeat until all functions are complete
6. Run the evaluator/tests if available to verify correctness
7. Fix any failing tests

### Completeness Requirements
- NEVER use placeholder return values like \`return 0\` or \`return ""\`
- NEVER write comments saying "too complex" or "placeholder" — implement the actual logic
- If a function needs helpers (e.g., \`int_to_roman\` for roman numeral output), implement them
- Every function must have a complete, working implementation

### Code Quality
- Match exact function signatures from specifications (parameter names, types, return types)
- Use \`from collections import deque\` if needed — no other imports
- Division truncates toward zero: use \`int(a / b)\` not \`a // b\`
- Modulo follows division: \`a - (int(a / b) * b)\` not \`a % b\`

### After Writing Code
- Always verify syntax with \`python3 -m py_compile <file>\`
- If an evaluator script is available, run it to check test results
- If tests fail, read the failure messages carefully and fix the specific issues`);
  }
```

- [ ] **Step 2: Build and verify**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/memory/src/loader.ts
git commit -m "feat: update Gemma system prompt for iterative one-function-at-a-time mode"
```

---

### Task 7: Add Post-Write Verification Hook for Gemma

**Files:**
- Modify: `packages/agent/src/agent.ts`

Currently, the agent only checks Python syntax after a Write. Extend this to also run the evaluator when one is available, and feed results back to the model in the tool result message.

- [ ] **Step 1: Enhance the tool feedback after Write**

In `packages/agent/src/agent.ts`, find the block that verifies Python syntax (around line 344-366). After the syntax check, add evaluator execution:

```typescript
      // After syntax check, run evaluator if available (for Gemma)
      if (call.name === 'Write' && this.config.provider === 'lm-studio') {
        let filePath: string | undefined;
        if (typeof effectiveCall.input === 'object' && effectiveCall.input !== null) {
          filePath = (effectiveCall.input as { file_path?: string }).file_path;
        }

        if (filePath && String(filePath).endsWith('.py')) {
          // Syntax check
          const verification = await this.verifyPythonSyntax(filePath);
          if (!verification.success) {
            yield {
              type: 'tool_feedback',
              status: 'error',
              tool: call.name,
              message: `Python syntax error in ${filePath}: ${verification.error}`,
            };
          }

          // Try to run evaluator if it exists alongside the solution
          const evalResult = await this.runEvaluatorIfAvailable(filePath);
          if (evalResult) {
            yield {
              type: 'tool_feedback',
              status: evalResult.allPassed ? 'success' : 'error',
              tool: call.name,
              message: evalResult.summary,
            };
          }
        }
      }
```

Replace the existing syntax-check-only block with this combined block.

- [ ] **Step 2: Add the runEvaluatorIfAvailable method**

Add this method to the `CodAgent` class:

```typescript
  private async runEvaluatorIfAvailable(
    solutionPath: string,
  ): Promise<{ allPassed: boolean; summary: string } | null> {
    const bashTool = this.toolRegistry.get('Bash');
    if (!bashTool) return null;

    // Look for evaluate_v2.py in the same directory
    const { dirname, join } = await import('node:path');
    const dir = dirname(solutionPath);
    const evaluatorPath = join(dir, 'evaluate_v2.py');

    const { existsSync } = await import('node:fs');
    if (!existsSync(evaluatorPath)) return null;

    try {
      const result = await bashTool.execute(
        { command: `cd "${dir}" && python3 evaluate_v2.py "${solutionPath}" 2>&1 | tail -30`, timeout: 15000 },
        {
          workingDirectory: this.config.workingDirectory,
          signal: new AbortController().signal,
          sessionId: this.session.id,
          log: () => {},
          requestPermission: (req) => this.permissionEngine.check(req),
          spawnSubagent: (config) => this.spawnSubagent(config),
        },
      );

      const output = (result as { type: string; text: string }).text || '';
      const allPassed = output.includes('100%') || !output.includes('FAIL');
      return { allPassed, summary: output.slice(0, 1000) };
    } catch {
      return null;
    }
  }
```

- [ ] **Step 3: Build and verify**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/agent.ts
git commit -m "feat: run evaluator after Write for Gemma, feed test results back to model"
```

---

### Task 8: Integration Test — Run COD + Gemma on challenge_v2

This is a manual verification task. No code changes — just running the system end-to-end.

- [ ] **Step 1: Build the full project**

Run: `pnpm build`
Expected: Clean build, 12/12 tasks successful.

- [ ] **Step 2: Run COD with Gemma on the challenge**

```bash
cd /Users/russellhanson/GLM5_1_tests/model_comparison
rm -f solution_v2_gemma_cod.py

node /Users/russellhanson/COD/COD-git/apps/cli/dist/index.js run \
  --provider lm-studio \
  --model google/gemma-4-e2b \
  --fafo \
  "Read challenge_v2.md once, then write solution_v2_gemma_cod.py with complete implementations of all 5 puzzles: LRUCache (with TTL), justify, paint_segments, evaluate_v2, roman_calc. Match exact signatures from the challenge. Do NOT read the file more than once."
```

- [ ] **Step 3: Evaluate the result**

```bash
cd /Users/russellhanson/GLM5_1_tests/model_comparison
python3 evaluate_v2.py solution_v2_gemma_cod.py "Gemma-COD-Iterative"
```

Expected: Score should be higher than 21/49 (43%). Target is 35/49 (71%+).

- [ ] **Step 4: If score is below 35/49, examine failures and iterate**

Check the score file:
```bash
cat solution_v2_gemma_cod_score.txt
```

Common issues to fix if score is low:
- If `evaluate_v2` still returns 0: the iterative prompt isn't working — may need to provide a recursive descent parser skeleton in the system prompt
- If `roman_calc` still returns Arabic numerals: the "include all helper functions" instruction isn't landing — may need explicit `int_to_roman` mention
- If `paint_segments` is still wrong: the algorithm hint in the prompt may be needed

- [ ] **Step 5: Commit the docs update with results**

```bash
# Update the benchmark plan doc with results
git add docs/gemma-benchmark-improvement-plan.md
git commit -m "docs: update Gemma benchmark results after iterative generation pipeline"
```

---

### Task 9: Add Completeness Detector (Stretch Goal)

If the iterative prompting alone doesn't hit 90%, add a completeness check that catches placeholder code before the agent declares success.

**Files:**
- Create: `packages/agent/src/strategies/completeness.ts`

- [ ] **Step 1: Write the completeness checker**

```typescript
// packages/agent/src/strategies/completeness.ts

/**
 * Detect placeholder or incomplete implementations in generated Python code.
 * Returns a list of issues found.
 */
export function detectPlaceholders(code: string): string[] {
  const issues: string[] = [];

  // Pattern 1: Functions that just return a constant
  const funcPattern = /def\s+(\w+)\([^)]*\)[^:]*:\s*\n(?:\s+(?:#[^\n]*|"""[^"]*"""|\'\'\'[^']*\'\'\')\s*\n)*\s+return\s+(0|None|""|''|\[\]|\{\})\s*$/gm;
  let match;
  while ((match = funcPattern.exec(code)) !== null) {
    issues.push(`Function '${match[1]}' returns placeholder value '${match[2]}'`);
  }

  // Pattern 2: Comments indicating surrender
  const surrenderPatterns = [
    /# ?(?:placeholder|todo|fixme|not implemented|too complex)/gi,
    /# ?(?:returning .* as (?:a )?placeholder)/gi,
    /return\s+str\(result\)\s*#.*(?:simplif|heuristic|complex)/gi,
  ];
  for (const p of surrenderPatterns) {
    while ((match = p.exec(code)) !== null) {
      issues.push(`Placeholder detected: "${match[0].trim()}"`);
    }
  }

  // Pattern 3: roman_calc returning str(int) instead of Roman numerals
  if (code.includes('def roman_calc') && /return\s+str\(result\)/.test(code)) {
    if (!/def\s+int_to_roman/.test(code) && !/def\s+to_roman/.test(code)) {
      issues.push("roman_calc returns str(result) but no int_to_roman helper is defined");
    }
  }

  // Pattern 4: evaluate_v2 without any parsing logic
  if (code.includes('def evaluate_v2')) {
    const evalSection = code.slice(code.indexOf('def evaluate_v2'));
    const nextDef = evalSection.indexOf('\ndef ', 1);
    const evalBody = nextDef > 0 ? evalSection.slice(0, nextDef) : evalSection;
    if (!evalBody.includes('def parse') && !evalBody.includes('def _parse')
        && !evalBody.includes('while') && !evalBody.includes('for ')) {
      issues.push("evaluate_v2 has no parsing logic (no loops, no recursive calls)");
    }
  }

  return issues;
}
```

- [ ] **Step 2: Integrate into the post-Write check in agent.ts**

After the evaluator run in the Write feedback block, add:

```typescript
      // Completeness check for Gemma
      if (call.name === 'Write' && this.config.provider === 'lm-studio' && filePath?.endsWith('.py')) {
        const { readFile } = await import('node:fs/promises');
        const { detectPlaceholders } = await import('./strategies/completeness.js');
        try {
          const code = await readFile(filePath, 'utf8');
          const issues = detectPlaceholders(code);
          if (issues.length > 0) {
            yield {
              type: 'tool_feedback',
              status: 'error',
              tool: call.name,
              message: `Incomplete implementation detected:\n${issues.map(i => `- ${i}`).join('\n')}\n\nFix these issues — implement complete working logic, not placeholders.`,
            };
          }
        } catch { /* ignore read errors */ }
      }
```

- [ ] **Step 3: Build and verify**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/strategies/completeness.ts packages/agent/src/agent.ts
git commit -m "feat: add completeness detector to catch placeholder code from Gemma"
```

---

## Summary of Expected Impact

| Change | Targets | Expected Lift |
|--------|---------|---------------|
| Iterative prompting (one function at a time) | evaluate_v2, roman_calc, paint_segments | +10-15 tests |
| Post-Write evaluator feedback | All puzzles | +3-5 tests (from retry) |
| Completeness detector | evaluate_v2 (return 0), roman_calc (str(result)) | +5-8 tests |
| Updated system prompt (no placeholders, include helpers) | All puzzles | +2-3 tests |

**Baseline:** 21/49 (43%)
**Conservative target:** 35/49 (71%)
**Optimistic target:** 42/49 (86%)

The hardest remaining gap will be `evaluate_v2` — a recursive descent parser is genuinely complex. If Gemma still can't implement it after iterative prompting with retry, consider providing a parser skeleton in the Gemma system prompt as algorithmic scaffolding (not a solution — just the structure of a recursive descent parser that the model fills in).
