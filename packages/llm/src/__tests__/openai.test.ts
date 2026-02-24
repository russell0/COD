import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { OpenAIAdapter } from '../adapters/openai.js';
import type { LLMStreamEvent } from '@cod/types';

// Build an SSE body for OpenAI streaming chunks
function buildOpenAIStream(chunks: object[]): string {
  return (
    chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n'
  );
}

const TEXT_CHUNKS = [
  {
    id: 'chatcmpl-1',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta: { role: 'assistant', content: 'Hello' }, finish_reason: null }],
  },
  {
    id: 'chatcmpl-1',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta: { content: ' world' }, finish_reason: null }],
  },
  {
    id: 'chatcmpl-1',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    usage: { prompt_tokens: 8, completion_tokens: 3 },
  },
];

const TOOL_CHUNKS = [
  {
    id: 'chatcmpl-2',
    object: 'chat.completion.chunk',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          tool_calls: [
            { index: 0, id: 'call_xyz', type: 'function', function: { name: 'Glob', arguments: '' } },
          ],
        },
        finish_reason: null,
      },
    ],
  },
  {
    id: 'chatcmpl-2',
    object: 'chat.completion.chunk',
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [{ index: 0, function: { arguments: '{"pattern":"**/' } }],
        },
        finish_reason: null,
      },
    ],
  },
  {
    id: 'chatcmpl-2',
    object: 'chat.completion.chunk',
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [{ index: 0, function: { arguments: '*.ts"}' } }],
        },
        finish_reason: null,
      },
    ],
  },
  {
    id: 'chatcmpl-2',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
    usage: { prompt_tokens: 15, completion_tokens: 10 },
  },
];

const server = setupServer(
  http.post('https://api.openai.com/v1/chat/completions', () =>
    new HttpResponse(buildOpenAIStream(TEXT_CHUNKS), {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const FAKE_CHUNKS = (chunks: object[]) =>
  http.post('https://api.openai.com/v1/chat/completions', () =>
    new HttpResponse(buildOpenAIStream(chunks), {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  );

async function collectEvents(adapter: OpenAIAdapter, prompt: string): Promise<LLMStreamEvent[]> {
  const events: LLMStreamEvent[] = [];
  for await (const e of adapter.stream({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  })) {
    events.push(e);
  }
  return events;
}

describe('OpenAIAdapter', () => {
  const adapter = new OpenAIAdapter('test-key');

  it('emits text_delta events', async () => {
    const events = await collectEvents(adapter, 'Hi');
    const text = events
      .filter((e) => e.type === 'text_delta')
      .map((e) => (e as Extract<LLMStreamEvent, { type: 'text_delta' }>).delta)
      .join('');
    expect(text).toBe('Hello world');
  });

  it('emits exactly one message_complete', async () => {
    const events = await collectEvents(adapter, 'Hi');
    expect(events.filter((e) => e.type === 'message_complete')).toHaveLength(1);
  });

  it('message_complete has end_turn stopReason', async () => {
    const events = await collectEvents(adapter, 'Hi');
    const complete = events.find((e) => e.type === 'message_complete') as Extract<
      LLMStreamEvent,
      { type: 'message_complete' }
    >;
    expect(complete.stopReason).toBe('end_turn');
  });

  it('uses real tool call ID (not array index) in all tool events', async () => {
    server.use(FAKE_CHUNKS(TOOL_CHUNKS));
    const events = await collectEvents(adapter, 'Find files');

    const start = events.find((e) => e.type === 'tool_use_start') as Extract<
      LLMStreamEvent,
      { type: 'tool_use_start' }
    >;
    expect(start.id).toBe('call_xyz');
    expect(start.name).toBe('Glob');

    const deltas = events.filter((e) => e.type === 'tool_use_input_delta') as Array<
      Extract<LLMStreamEvent, { type: 'tool_use_input_delta' }>
    >;
    for (const d of deltas) {
      // Must be the real ID, not a stringified index like "0"
      expect(d.id).toBe('call_xyz');
      expect(d.id).not.toBe('0');
    }

    const complete = events.find((e) => e.type === 'tool_use_complete') as Extract<
      LLMStreamEvent,
      { type: 'tool_use_complete' }
    >;
    expect(complete.id).toBe('call_xyz');
    expect((complete.input as { pattern: string }).pattern).toBe('**/*.ts');
  });

  it('message_complete has tool_use stopReason when tools are called', async () => {
    server.use(FAKE_CHUNKS(TOOL_CHUNKS));
    const events = await collectEvents(adapter, 'Find files');
    const complete = events.find((e) => e.type === 'message_complete') as Extract<
      LLMStreamEvent,
      { type: 'message_complete' }
    >;
    expect(complete.stopReason).toBe('tool_use');
  });

  it('message_complete includes token usage', async () => {
    const events = await collectEvents(adapter, 'Hi');
    const complete = events.find((e) => e.type === 'message_complete') as Extract<
      LLMStreamEvent,
      { type: 'message_complete' }
    >;
    expect(complete.usage.inputTokens).toBe(8);
    expect(complete.usage.outputTokens).toBe(3);
  });
});
