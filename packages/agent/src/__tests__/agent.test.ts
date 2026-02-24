import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodAgent } from '../agent.js';
import type { LLMAdapter, LLMStreamEvent, LLMRequestOptions, Message } from '@cod/types';
import { PermissionMode } from '@cod/types';
import type { CodSettings } from '@cod/config';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal CodSettings suitable for tests. */
function makeSettings(overrides: Partial<CodSettings> = {}): CodSettings {
  return {
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    permissionMode: PermissionMode.BypassPermissions,
    apiKeys: {},
    mcpServers: {},
    hooks: {},
    blockedCommands: [],
    autoCompact: false,
    compactThreshold: 0.85,
    historySize: 1000,
    ...overrides,
  };
}

/** Create a mock LLMAdapter that yields a scripted sequence of events. */
function mockAdapter(eventSequences: LLMStreamEvent[][]): LLMAdapter {
  let callCount = 0;
  return {
    providerId: 'mock',
    async *stream(_options: LLMRequestOptions): AsyncIterable<LLMStreamEvent> {
      const sequence = eventSequences[callCount] ?? eventSequences[eventSequences.length - 1];
      callCount++;
      for (const event of sequence) {
        yield event;
      }
    },
    async countTokens(_messages: Message[]): Promise<number> {
      return 100;
    },
  };
}

/** Collect all AgentEvents from a run. */
async function runAndCollect(agent: CodAgent, prompt: string) {
  const events = [];
  for await (const event of agent.run(prompt)) {
    events.push(event);
  }
  return events;
}

// ---------------------------------------------------------------------------
// Event sequence fixtures
// ---------------------------------------------------------------------------

const TEXT_TURN: LLMStreamEvent[] = [
  { type: 'text_delta', delta: 'Hello' },
  { type: 'text_delta', delta: ' world' },
  { type: 'message_complete', usage: { inputTokens: 10, outputTokens: 5 }, stopReason: 'end_turn' },
];

const TOOL_USE_THEN_TEXT: LLMStreamEvent[][] = [
  // First LLM call → requests a tool
  [
    { type: 'tool_use_start', id: 'call_1', name: 'Bash' },
    { type: 'tool_use_complete', id: 'call_1', name: 'Bash', input: { command: 'echo hi' } },
    { type: 'message_complete', usage: { inputTokens: 20, outputTokens: 8 }, stopReason: 'tool_use' },
  ],
  // Second LLM call (after tool result) → text response
  [
    { type: 'text_delta', delta: 'Done!' },
    { type: 'message_complete', usage: { inputTokens: 30, outputTokens: 3 }, stopReason: 'end_turn' },
  ],
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CodAgent', () => {
  const workingDirectory = tmpdir();

  describe('text-only turn', () => {
    it('emits text_delta events', async () => {
      const agent = new CodAgent(
        { model: 'claude-sonnet-4-6', provider: 'mock', workingDirectory, sessionId: 'test-1' },
        makeSettings(),
        mockAdapter([TEXT_TURN]),
      );
      await agent.initialize();

      const events = await runAndCollect(agent, 'Say hello');
      const textDeltas = events.filter((e) => e.type === 'text_delta');
      const text = textDeltas.map((e) => (e as { type: 'text_delta'; text: string }).text).join('');
      expect(text).toBe('Hello world');
    });

    it('emits turn_complete with usage', async () => {
      const agent = new CodAgent(
        { model: 'claude-sonnet-4-6', provider: 'mock', workingDirectory, sessionId: 'test-2' },
        makeSettings(),
        mockAdapter([TEXT_TURN]),
      );
      await agent.initialize();

      const events = await runAndCollect(agent, 'Hi');
      const turnComplete = events.find((e) => e.type === 'turn_complete') as {
        type: 'turn_complete';
        usage: { inputTokens: number; outputTokens: number };
        stopReason: string;
      };
      expect(turnComplete).toBeDefined();
      expect(turnComplete.usage.inputTokens).toBe(10);
      expect(turnComplete.stopReason).toBe('end_turn');
    });

    it('accumulates messages in session after run', async () => {
      const agent = new CodAgent(
        { model: 'claude-sonnet-4-6', provider: 'mock', workingDirectory, sessionId: 'test-3' },
        makeSettings(),
        mockAdapter([TEXT_TURN]),
      );
      await agent.initialize();
      await runAndCollect(agent, 'Say hello');

      const messages = agent.getSession().getMessages();
      // user + assistant
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });
  });

  describe('tool-use turn', () => {
    it('emits tool_call_start and tool_call_complete', async () => {
      const agent = new CodAgent(
        { model: 'claude-sonnet-4-6', provider: 'mock', workingDirectory, sessionId: 'test-4' },
        makeSettings(),
        mockAdapter(TOOL_USE_THEN_TEXT),
      );
      await agent.initialize();

      const events = await runAndCollect(agent, 'Run echo hi');
      const start = events.find((e) => e.type === 'tool_call_start');
      const complete = events.find((e) => e.type === 'tool_call_complete');

      expect(start).toBeDefined();
      expect(complete).toBeDefined();
    });

    it('final turn emits text after tool results', async () => {
      const agent = new CodAgent(
        { model: 'claude-sonnet-4-6', provider: 'mock', workingDirectory, sessionId: 'test-5' },
        makeSettings(),
        mockAdapter(TOOL_USE_THEN_TEXT),
      );
      await agent.initialize();

      const events = await runAndCollect(agent, 'Run echo hi');
      const text = events
        .filter((e) => e.type === 'text_delta')
        .map((e) => (e as { type: 'text_delta'; text: string }).text)
        .join('');
      expect(text).toBe('Done!');
    });

    it('session contains user, assistant-with-tool, and tool-result messages', async () => {
      const agent = new CodAgent(
        { model: 'claude-sonnet-4-6', provider: 'mock', workingDirectory, sessionId: 'test-6' },
        makeSettings(),
        mockAdapter(TOOL_USE_THEN_TEXT),
      );
      await agent.initialize();
      await runAndCollect(agent, 'Run echo hi');

      const messages = agent.getSession().getMessages();
      // user, assistant (tool_use), user (tool_result), assistant (text)
      expect(messages.length).toBeGreaterThanOrEqual(4);
    });

    it('tool execution is blocked in Plan mode', async () => {
      const agent = new CodAgent(
        { model: 'claude-sonnet-4-6', provider: 'mock', workingDirectory, sessionId: 'test-7' },
        makeSettings({ permissionMode: PermissionMode.Plan }),
        mockAdapter(TOOL_USE_THEN_TEXT),
      );
      await agent.initialize();

      const events = await runAndCollect(agent, 'Run echo hi');
      // Bash is a shell tool, should be denied in Plan mode
      const denied = events.filter((e) => e.type === 'tool_call_denied');
      expect(denied.length).toBeGreaterThan(0);
    });
  });

  describe('abort', () => {
    it('stops streaming when abort() is called', async () => {
      // Use a long-running adapter that would emit many events
      const manyDeltas: LLMStreamEvent[] = [
        ...Array.from({ length: 100 }, (_, i) => ({
          type: 'text_delta' as const,
          delta: `chunk${i}`,
        })),
        { type: 'message_complete', usage: { inputTokens: 5, outputTokens: 100 }, stopReason: 'end_turn' as const },
      ];

      const agent = new CodAgent(
        { model: 'claude-sonnet-4-6', provider: 'mock', workingDirectory, sessionId: 'test-8' },
        makeSettings(),
        mockAdapter([manyDeltas]),
      );
      await agent.initialize();

      const events: unknown[] = [];
      // Abort after first event
      let aborted = false;
      for await (const event of agent.run('Generate lots of text')) {
        events.push(event);
        if (!aborted) {
          aborted = true;
          agent.abort();
        }
      }

      // Should have received far fewer than 100 text_delta events
      const textDeltas = events.filter((e) => (e as { type: string }).type === 'text_delta');
      expect(textDeltas.length).toBeLessThan(100);
    });
  });

  describe('multi-turn conversation', () => {
    it('second run() builds on session from first run', async () => {
      const agent = new CodAgent(
        { model: 'claude-sonnet-4-6', provider: 'mock', workingDirectory, sessionId: 'test-9' },
        makeSettings(),
        mockAdapter([TEXT_TURN, TEXT_TURN]),
      );
      await agent.initialize();

      await runAndCollect(agent, 'First message');
      await runAndCollect(agent, 'Second message');

      const messages = agent.getSession().getMessages();
      // 2 user + 2 assistant messages
      expect(messages.length).toBe(4);
      expect(messages[2].role).toBe('user');
    });
  });
});
