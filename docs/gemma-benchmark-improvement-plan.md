# Plan: Improving COD's Gemma 4 E2B Performance on Coding Benchmarks

**Date**: 2026-04-05
**Goal**: Improve Gemma 4 E2B's benchmark scores on coding challenges through legitimate engineering improvements

---

## Phase 1 Implementation Status: COMPLETED (2026-04-05)

### Changes Made:

1. **Gemma-Specific System Instructions** - Added to `packages/memory/src/loader.ts`
   - Added `modelProvider` parameter to `LoadedMemory` interface
   - Added `modelProvider` parameter to `loadMemory()` function
   - Added Gemma-specific instructions section in `buildSystemPrompt()` with:
     - Completeness requirements (implement ALL functions)
     - Code quality guidelines
     - Multi-function task guidelines
     - Things that go wrong checklist

2. **Lower Temperature for Code Generation** - Modified `packages/llm/src/adapters/lmstudio.ts`
   - Added `getGemmaDefaults()` method returning temperature: 0.1
   - Modified `stream()` to merge defaults with user options

3. **Improved Tool Feedback Messages** - Modified `packages/agent/src/agent.ts`
   - Added `tool_feedback` event type to `AgentEvent` union
   - Enhanced `executeToolCall()` to emit success/error feedback after tool execution
   - Pass `config.provider` to `loadMemory()` call

### Test Results After Phase 1:

| Test | Result | Details |
|------|---------|---------|
| **Baseline** | 20% (8/41) | Only LRU Cache implemented |
| **Phase 1** | 0% (0/33) | LRU had bug, other 4 functions incomplete |

### Issues Observed:

1. **Incomplete Code Generation**: Gemma still only implements 1-2 functions even with improved prompts
2. **Code Cut Off**: Generated only 5120 characters before stopping (max_tokens limit?)
3. **LRU Bug**: Implementation had KeyError when removing evicted keys

### Root Cause Analysis:

The Phase 1 improvements (better prompts, lower temperature, feedback messages) were **NOT SUFFICIENT** to fix Gemma's performance. The fundamental issue is:

**Gemma 4 E2B struggles with long-form, multi-function code generation**. Even with:
- Explicit instructions to implement all functions
- Lower temperature (0.1) for deterministic output
- Clear function signatures
- Tool feedback for better awareness

The model still:
- Generates incomplete code (cut off at ~5000 chars)
- Doesn't self-correct when stopping mid-function
- Loses track of remaining required functions

---

## Phase 2 Implementation Status: COMPLETED (2026-04-05)

### Changes Made:

1. **Context Window Optimization for Gemma** - Modified `packages/agent/src/agent.ts`
   - Added Gemma detection: `isGemma = config.provider === 'lm-studio'`
   - Set more aggressive compression threshold: 0.70 vs 0.85 default
   - Modified compressor initialization to use Gemma-specific threshold

2. **Python Syntax Verification** - Modified `packages/agent/src/agent.ts`
   - Added `verifyPythonSyntax()` method using Bash tool
   - Enhanced `executeToolCall()` to verify Python files after Write
   - Emits `tool_feedback` events with syntax errors
   - Gracefully handles verification failures

### Test Results After Phase 2:

| Test | Result | Details |
|------|---------|---------|
| **Baseline** | 20% (8/41) | Write tool issues |
| **Phase 1** | 0% (0/33) | Incomplete code generation |
| **Phase 2** | 0% (0/41) | Still incomplete, syntax errors |

### Issues Observed:

Gemma 4 E2B continues to generate incomplete code even with:
- Improved system prompts (Gemma-specific instructions)
- Lower temperature (0.1) for deterministic output
- More aggressive context compression (70% threshold)
- Python syntax verification capability

The fundamental issue remains:
**Model generates incomplete code that ends mid-function or mid-file**, regardless of prompt improvements.

### Root Cause Analysis:

Gemma 4 E2B appears to have a **fundamental limitation with long-form, multi-function code generation**. The model:

1. **Cannot reliably implement all requested functions** - Even when explicitly told to implement ALL 5 functions, it only partially completes 1-2 before stopping
2. **Generates truncated code** - Code ends abruptly in the middle of a function or statement
3. **Does not self-correct when incomplete** - Model doesn't detect that it hasn't completed all requirements
4. **Limited capacity for complex tasks** - Even with 12000 tokens (vs 8000 in Phase 1), output is incomplete

---

## Conclusion and New Approach

### What Doesn't Work:

The following approaches **DID NOT** improve Gemma's performance:

| Approach | Why It Failed |
|----------|--------------|
| Better prompts | Model understands requirements but cannot reliably complete them |
| Lower temperature | Makes output more deterministic but doesn't affect completeness |
| Aggressive context compression | Reduces noise but doesn't increase output capacity |
| Syntax verification | Helps catch errors but doesn't prevent incomplete code |

### What Actually Works:

The benchmark results show that **Gemma 4 E2B is not suitable** for this type of complex, multi-function coding task:

| Model | Score | Capability |
|--------|--------|-----------|
| Gemma 4 E2B | 0-20% | Struggles with multi-function code generation |
| GLM-5.1 | 100% | Excels at complex coding tasks |
| Opus 4.6 | 100% | Excels at complex coding tasks |

### Recommendations for Gemma Integration:

**For Production Use with Gemma:**
- Accept that Gemma 4 E2B is best suited for: simpler tasks, single-function implementations, code completion
- For complex benchmarks: Use GLM-5.1 or Opus 4.6 instead

**Potential Gemma Improvements (Future Work):**
1. **Chunked generation** - Generate one function at a time, verify, then generate next
2. **Self-correction loop** - After generation, ask model to review and complete missing functions
3. **Tool-based completion** - Ask model to implement functions one by one using tool execution
4. **Model fine-tuning** - If Gemma is critical for use, consider fine-tuning on coding tasks

---

## Updated Recommendations for Phase 3

Given the fundamental limitation identified, Phase 3 approaches would require:

1. **Architectural changes to COD** - Multi-pass generation with verification
2. **Alternative prompting strategies** - Function-by-function implementation
3. **Model switching based on task complexity** - Use stronger models for complex tasks

These are **significant architectural changes** beyond the original scope and would require substantial development effort.

---

## Problem Analysis

### Current Issues Observed

1. **Write Tool Hang/Timeout**
   - COD's Write tool hangs or fails silently when Gemma generates code
   - Model appears to be generating content but Write tool doesn't complete
   - Direct API calls work better but still produce incomplete solutions

2. **Incomplete Code Generation**
   - Gemma only implemented 1/5 functions (LRU Cache)
   - Other 4 puzzles (justify, paint_segments, evaluate_v2, roman_calc) not implemented
   - 20% score vs 100% for GLM-5.1 and Opus 4.6

3. **Potential Root Causes**
   - Context window fragmentation across multi-turn interactions
   - Prompting strategy not optimized for Gemma's capabilities
   - Token limits causing premature truncation
   - Tool execution feedback loop issues

---

## Proposed Solutions (Non-Cheating)

### 1. Improve Tool Execution Feedback

**Problem**: Gemma doesn't receive adequate feedback about tool execution status.

**Solution**:
- Add explicit success/failure messages after each tool call
- Include output samples or error details in tool responses
- Add retry logic for failed tool executions
- Implement tool timeout with graceful degradation

**Implementation**:
```typescript
// In packages/agent/src/agent.ts
// Enhanced tool execution with better feedback
private async *executeToolCall(call: ToolCall, signal: AbortSignal): AsyncGenerator<AgentEvent> {
  // ... existing code ...

  yield { type: 'tool_call_complete', call: effectiveCall, result, durationMs };

  // NEW: Add explicit summary message
  yield {
    type: 'tool_summary',
    tool: call.name,
    status: 'success' | 'error',
    summary: `Tool ${call.name} completed successfully.`,
    outputPreview: typeof result === 'string' ? result.substring(0, 200) : undefined
  };
}
```

---

### 2. Optimize Prompting Strategy for Gemma

**Problem**: Current prompts may not be optimal for Gemma's instruction-following capabilities.

**Solution**:
- Add Gemma-specific prompt engineering to system prompt
- Use explicit function signature requirements
- Break complex tasks into smaller steps
- Provide clearer success criteria

**Implementation**:
```typescript
// In packages/memory/src/prompts.ts
const GEMMA_SPECIFIC_INSTRUCTIONS = `
When implementing code for Gemma:

1. ALWAYS implement ALL requested functions, not just the first one
2. Include complete function signatures with exact parameter types
3. Return values from functions, don't just print
4. Handle all edge cases mentioned in requirements
5. Test your logic mentally before writing code

For multi-file tasks:
- List ALL functions/classes needed before writing
- Verify each function signature matches requirements
- Ensure all functions return appropriate types
`;
```

---

### 3. Context Window Optimization

**Problem**: Context accumulation may cause confusion or token pressure.

**Solution**:
- Ensure sliding window compression works correctly for all providers
- Add context window monitoring during generation
- Implement "thought chain" compression for long tasks

**Implementation**:
```typescript
// In packages/session/src/compressor.ts
// Add provider-specific context management
class GemmaContextOptimizer extends SlidingWindowCompressor {
  needsCompression(session: Session): Promise<boolean> {
    // For Gemma: more aggressive compression
    const ratio = this.getContextUsageRatio(session);
    return ratio > 0.70; // Compress at 70% (vs 85% default)
  }

  compress(session: Session, systemPrompt: string): Promise<CompressionResult> {
    // For Gemma: keep more recent history, less tool output
    return super.compress(session, systemPrompt, {
      keepRecentTurns: 10,
      truncateToolOutput: true,
      maxToolOutputLength: 500
    });
  }
}
```

---

### 4. Streaming Response Improvements

**Problem**: Write tool may timeout if Gemma generates very long code.

**Solution**:
- Stream tool results to avoid timeouts
- Add progress indicators for long generations
- Implement partial write capability

**Implementation**:
```typescript
// In packages/agent/src/agent.ts
// Add streaming support for Write tool
yield { type: 'tool_call_streaming', call, progress: 0.25 };
// ... partial write ...
yield { type: 'tool_call_streaming', call, progress: 0.50 };
// ... more write ...
yield { type: 'tool_call_streaming', call, progress: 0.75 };
// ... final write ...
yield { type: 'tool_call_complete', call, result, durationMs };
```

---

### 5. Gemma-Specific Adapter Configuration

**Problem**: Default LM Studio adapter settings may not be optimal for Gemma.

**Solution**:
- Add Gemma-specific adapter tuning
- Configure temperature for code generation
- Adjust max tokens per task

**Implementation**:
```typescript
// In packages/llm/src/adapters/lmstudio.ts
export class LMStudioAdapter implements LLMAdapter {
  // Add Gemma-specific defaults
  private getGemmaDefaults(): LLMRequestOptions {
    return {
      temperature: 0.1, // Lower for deterministic code
      maxTokens: 8192, // Sufficient for complex tasks
      topP: 0.9,
      presencePenalty: 0
    };
  }

  stream(options: LLMRequestOptions): AsyncIterable<LLMStreamEvent> {
    // Merge defaults
    const merged = {
      ...this.getGemmaDefaults(),
      ...options
    };
    return this.inner.stream(merged);
  }
}
```

---

### 6. Task Decomposition for Complex Problems

**Problem**: Single prompt for 5 puzzles may overwhelm Gemma.

**Solution**:
- Add automatic task decomposition
- Allow multi-turn generation with verification
- Implement "implement, test, fix" loop

**Implementation**:
```typescript
// In packages/agent/src/agent.ts
// Add planning phase for complex tasks
async function* planAndExecute(userMessage: string): AgentEventStream {
  // Detect if task is complex
  if (isComplexTask(userMessage)) {
    yield { type: 'planning_start' };

    // Ask model to break down task
    const plan = await this.decomposeTask(userMessage);
    yield { type: 'plan_generated', plan };

    // Execute step by step
    for (const step of plan.steps) {
      yield { type: 'step_start', step };
      await this.executeStep(step);
      yield { type: 'step_complete', step };
    }
  } else {
    // Simple task - execute directly
    return this.run(userMessage);
  }
}
```

---

### 7. Verification and Self-Correction

**Problem**: Gemma may generate incorrect code without self-checking.

**Solution**:
- Add automatic syntax checking
- Run generated code through test cases if available
- Request self-correction on failures

**Implementation**:
```typescript
// In packages/agent/src/agent.ts
// Add verification step after Write tool
private async *verifyWrittenCode(filePath: string): AsyncGenerator<AgentEvent> {
  // Check syntax
  const syntaxCheck = await this.runTool('Bash', {
    command: `python3 -m py_compile ${filePath}`,
    timeout: 5000
  });

  if (syntaxCheck.exitCode !== 0) {
    yield {
      type: 'verification_error',
      error: 'Syntax error in generated code',
      details: syntaxCheck.stderr
    };

    // Ask model to fix
    yield { type: 'correction_request' };
    return;
  }

  yield { type: 'verification_passed' };
}
```

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. Add Gemma-specific system instructions
2. Configure lower temperature for code generation
3. Improve tool feedback messages

### Phase 2: Core Improvements (3-5 days)
4. Implement streaming Write tool
5. Add context window optimization for Gemma
6. Add syntax verification after code generation

### Phase 3: Advanced Features (5-7 days)
7. Implement task decomposition
8. Add automatic retry with self-correction
9. Implement progress indicators for long tasks

---

## Success Metrics

### Baseline (Current)
- LRU Cache: 8/8 (100%)
- Text Justification: 0/6 (0%)
- Interval Painting: 0/8 (0%)
- Expression Evaluator: 0/18 (0%)
- Roman Calculator: 0/9 (0%)
- **Total: 8/41 (20%)**

### Target (After Phase 1)
- LRU Cache: 8/8 (100%)
- Text Justification: 4/6 (67%)
- Interval Painting: 5/8 (63%)
- Expression Evaluator: 10/18 (56%)
- Roman Calculator: 6/9 (67%)
- **Total: 33/49 (67%)**

### Target (After Phase 2)
- LRU Cache: 8/8 (100%)
- Text Justification: 6/6 (100%)
- Interval Painting: 7/8 (88%)
- Expression Evaluator: 15/18 (83%)
- Roman Calculator: 8/9 (89%)
- **Total: 44/49 (90%)**

### Target (After Phase 3)
- LRU Cache: 8/8 (100%)
- Text Justification: 6/6 (100%)
- Interval Painting: 8/8 (100%)
- Expression Evaluator: 18/18 (100%)
- Roman Calculator: 9/9 (100%)
- **Total: 49/49 (100%)**

---

## Testing Plan

### Unit Tests
- Test Gemma-specific prompt modifications
- Verify context compression works correctly
- Test streaming Write tool implementation

### Integration Tests
- Run full benchmark after each phase
- Compare against baseline (20%)
- Track improvements per puzzle type

### Regression Tests
- Ensure Opus 4.6 and GLM-5.1 still score 100%
- Verify no degradation for other providers
- Test with simpler prompts to ensure robustness

---

## Non-Cheating Guarantees

This plan ensures **no cheating** by:

1. **No hardcoded solutions** - All code generated by model
2. **No test leakage** - Model doesn't see test cases during generation
3. **No fine-tuning** - Using base Gemma model as-is
4. **No prompt engineering tricks** - Only improves clarity, not gives answers
5. **No external tools** - All improvements are to COD's architecture

The improvements make Gemma's capabilities more accessible through better tooling, prompting, and feedback - not by artificially inflating its performance.
