import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { ToolCallBlock } from '../components/ToolCallBlock.js';
import type { ToolCallState } from '../hooks/useAgent.js';

function makeToolCall(overrides: Partial<ToolCallState> = {}): ToolCallState {
  return {
    call: { id: 'call_1', name: 'Read', input: { file_path: '/tmp/foo.ts' } },
    status: 'pending',
    ...overrides,
  };
}

describe('ToolCallBlock', () => {
  it('renders tool name', () => {
    const { lastFrame } = render(<ToolCallBlock toolCall={makeToolCall()} />);
    expect(lastFrame()).toContain('Read');
  });

  it('shows [DENIED] when status is denied', () => {
    const { lastFrame } = render(
      <ToolCallBlock toolCall={makeToolCall({ status: 'denied' })} />,
    );
    expect(lastFrame()).toContain('DENIED');
  });

  it('shows duration when complete with durationMs', () => {
    const { lastFrame } = render(
      <ToolCallBlock
        toolCall={makeToolCall({
          status: 'complete',
          durationMs: 42,
          result: { type: 'text', text: 'file contents' },
        })}
      />,
    );
    expect(lastFrame()).toContain('42ms');
  });

  it('shows result text when complete', () => {
    const { lastFrame } = render(
      <ToolCallBlock
        toolCall={makeToolCall({
          status: 'complete',
          durationMs: 10,
          result: { type: 'text', text: 'hello result' },
        })}
      />,
    );
    expect(lastFrame()).toContain('hello result');
  });

  it('shows error message when result is an error', () => {
    const { lastFrame } = render(
      <ToolCallBlock
        toolCall={makeToolCall({
          status: 'complete',
          durationMs: 5,
          result: { type: 'error', text: 'file not found' },
        })}
      />,
    );
    expect(lastFrame()).toContain('file not found');
  });

  it('truncates long results to 200 characters', () => {
    const longText = 'x'.repeat(300);
    const { lastFrame } = render(
      <ToolCallBlock
        toolCall={makeToolCall({
          status: 'complete',
          durationMs: 5,
          result: { type: 'text', text: longText },
        })}
      />,
    );
    expect(lastFrame()).toContain('...');
    // Should not contain the full 300 chars
    expect((lastFrame() ?? '').includes('x'.repeat(300))).toBe(false);
  });
});
