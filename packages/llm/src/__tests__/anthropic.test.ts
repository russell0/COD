import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { AnthropicAdapter } from '../adapters/anthropic.js';
import type { LLMStreamEvent } from '@cod/types';

// Build a minimal SSE stream body from a list of JSON objects
function buildSSEBody(events: object[]): string {
  return events
    .map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`)
    .join('') + 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
}

const TEXT_ONLY_EVENTS = [
  {
    type: 'message_start',
    message: {
      id: 'msg_01',
      type: 'message',
      role: 'assistant',
      content: [],
      model: 'claude-sonnet-4-6',
      stop_reason: null,
      usage: { input_tokens: 10, output_tokens: 0 },
    },
  },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' world' } },
  { type: 'content_block_stop', index: 0 },
  {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: { output_tokens: 5 },
  },
];

const TOOL_USE_EVENTS = [
  {
    type: 'message_start',
    message: {
      id: 'msg_02',
      type: 'message',
      role: 'assistant',
      content: [],
      model: 'claude-sonnet-4-6',
      stop_reason: null,
      usage: { input_tokens: 20, output_tokens: 0 },
    },
  },
  {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'tool_use', id: 'tool_abc', name: 'Read', input: {} },
  },
  {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'input_json_delta', partial_json: '{"file_path":"/tmp/' },
  },
  {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'input_json_delta', partial_json: 'foo.txt"}' },
  },
  { type: 'content_block_stop', index: 0 },
  {
    type: 'message_delta',
    delta: { stop_reason: 'tool_use', stop_sequence: null },
    usage: { output_tokens: 15 },
  },
];

// The SDK calls /v1/messages — we intercept it
const server = setupServer(
  http.post('https://api.anthropic.com/v1/messages', ({ request }) => {
    // Peek at the request to decide which fixture to serve
    return new HttpResponse(buildSSEBody(TEXT_ONLY_EVENTS), {
      headers: {
        'Content-Type': 'text/event-stream',
        'X-Request-Id': 'req_test',
      },
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const FAKE_MSG = (events: object[]) =>
  http.post('https://api.anthropic.com/v1/messages', () =>
    new HttpResponse(buildSSEBody(events), {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  );

async function collectEvents(adapter: AnthropicAdapter, prompt: string): Promise<LLMStreamEvent[]> {
  const events: LLMStreamEvent[] = [];
  for await (const e of adapter.stream({
    model: 'claude-sonnet-4-6',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  })) {
    events.push(e);
  }
  return events;
}

describe('AnthropicAdapter', () => {
  const adapter = new AnthropicAdapter('test-api-key');

  it('emits text_delta events for a text-only response', async () => {
    const events = await collectEvents(adapter, 'Say hello');
    const textEvents = events.filter((e) => e.type === 'text_delta');
    const texts = textEvents.map((e) => (e as { type: 'text_delta'; delta: string }).delta);
    expect(texts.join('')).toBe('Hello world');
  });

  it('emits exactly one message_complete event', async () => {
    const events = await collectEvents(adapter, 'Say hello');
    const completeEvents = events.filter((e) => e.type === 'message_complete');
    expect(completeEvents).toHaveLength(1);
  });

  it('message_complete carries correct stopReason for text turn', async () => {
    const events = await collectEvents(adapter, 'Say hello');
    const complete = events.find((e) => e.type === 'message_complete') as Extract<
      LLMStreamEvent,
      { type: 'message_complete' }
    >;
    expect(complete.stopReason).toBe('end_turn');
  });

  it('emits tool_use_start / tool_use_input_delta / tool_use_complete for tool calls', async () => {
    server.use(FAKE_MSG(TOOL_USE_EVENTS));
    const events = await collectEvents(adapter, 'Read a file');

    const start = events.find((e) => e.type === 'tool_use_start') as Extract<
      LLMStreamEvent,
      { type: 'tool_use_start' }
    >;
    expect(start).toBeDefined();
    expect(start.id).toBe('tool_abc');
    expect(start.name).toBe('Read');

    const deltas = events.filter((e) => e.type === 'tool_use_input_delta') as Array<
      Extract<LLMStreamEvent, { type: 'tool_use_input_delta' }>
    >;
    // All deltas must carry the real tool id, not an index
    for (const d of deltas) {
      expect(d.id).toBe('tool_abc');
    }

    const complete = events.find((e) => e.type === 'tool_use_complete') as Extract<
      LLMStreamEvent,
      { type: 'tool_use_complete' }
    >;
    expect(complete).toBeDefined();
    expect(complete.id).toBe('tool_abc');
    expect(complete.name).toBe('Read');
    expect((complete.input as { file_path: string }).file_path).toBe('/tmp/foo.txt');
  });

  it('message_complete carries tool_use stopReason', async () => {
    server.use(FAKE_MSG(TOOL_USE_EVENTS));
    const events = await collectEvents(adapter, 'Read a file');
    const complete = events.find((e) => e.type === 'message_complete') as Extract<
      LLMStreamEvent,
      { type: 'message_complete' }
    >;
    expect(complete.stopReason).toBe('tool_use');
  });

  it('message_complete includes input token count from message_start', async () => {
    const events = await collectEvents(adapter, 'Say hello');
    const complete = events.find((e) => e.type === 'message_complete') as Extract<
      LLMStreamEvent,
      { type: 'message_complete' }
    >;
    // The mock message_start sets input_tokens: 10
    expect(complete.usage.inputTokens).toBe(10);
  });
});
