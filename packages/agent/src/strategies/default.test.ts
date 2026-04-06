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
