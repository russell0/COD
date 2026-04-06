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
      expect(names).toContain('LRUCache');
      expect(names).toContain('justify');
      expect(names).toContain('paint_segments');
      expect(names.length).toBeGreaterThanOrEqual(3);
    });

    it('returns empty array when no functions found', () => {
      const strategy = new GemmaStrategy();
      const names = strategy.extractFunctionNames('just some text');
      expect(names).toEqual([]);
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

  describe('prepare', () => {
    it('passes through non-multi-function messages unchanged', async () => {
      const strategy = new GemmaStrategy();
      const context = {} as any;

      const gen = strategy.prepare('read the file', context);
      let result: string | undefined;
      while (true) {
        const next = await gen.next();
        if (next.done) { result = next.value; break; }
      }

      expect(result).toBe('read the file');
    });

    it('passes through multi-function messages unchanged (single-shot is more reliable)', async () => {
      const strategy = new GemmaStrategy();
      const context = {} as any;
      const msg = 'implement LRUCache, justify, paint_segments, evaluate_v2, and roman_calc in solution.py';

      const gen = strategy.prepare(msg, context);
      let result: string | undefined;
      while (true) {
        const next = await gen.next();
        if (next.done) { result = next.value; break; }
      }

      expect(result).toBe(msg);
    });

    it('provides system prompt hints for local models', () => {
      const strategy = new GemmaStrategy();
      const hints = strategy.getSystemPromptHints();
      expect(hints).toContain('int_to_roman');
      expect(hints).toContain('Recursive descent parser');
      expect(hints).toContain('placeholder');
    });
  });
});
