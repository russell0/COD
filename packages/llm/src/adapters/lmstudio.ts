/**
 * LM Studio adapter — uses the OpenAI-compatible endpoint that LM Studio exposes.
 * Default base URL: http://localhost:1234/v1
 *
 * Implements streaming-with-fallback: tries OpenAI SDK streaming first,
 * and if the result is max_tokens (common with thinking models where
 * reasoning_effort is ignored in streaming mode), automatically retries
 * with a non-streaming fetch call where reasoning_effort works reliably.
 */
import { OpenAIAdapter } from './openai.js';
import type {
  LLMAdapter,
  LLMRequestOptions,
  LLMStreamEvent,
  LLMToolDefinition,
  Message,
  TokenUsage,
  StopReason,
} from '@cod/types';

function toOpenAIMessages(
  messages: Message[],
  systemPrompt?: string,
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of messages) {
    if (msg.role === 'user') {
      const toolResults = msg.content.filter((c) => c.type === 'tool_result');
      if (toolResults.length > 0) {
        for (const tr of toolResults) {
          if (tr.type === 'tool_result') {
            result.push({
              role: 'tool',
              tool_call_id: tr.tool_use_id,
              content: tr.content
                .filter((c) => c.type === 'text')
                .map((c) => (c.type === 'text' ? c.text : ''))
                .join('\n'),
            });
          }
        }
      } else {
        const content = msg.content
          .filter((c) => c.type === 'text')
          .map((c) => (c.type === 'text' ? c.text : ''))
          .join('\n');
        result.push({ role: 'user', content });
      }
    } else {
      const toolUses = msg.content.filter((c) => c.type === 'tool_use');
      const texts = msg.content.filter((c) => c.type === 'text');

      if (toolUses.length > 0) {
        result.push({
          role: 'assistant',
          content: texts.length > 0
            ? texts.map((c) => (c.type === 'text' ? c.text : '')).join('\n')
            : null,
          tool_calls: toolUses.map((tu) => {
            if (tu.type !== 'tool_use') throw new Error('Expected tool_use');
            return {
              id: tu.id,
              type: 'function' as const,
              function: { name: tu.name, arguments: JSON.stringify(tu.input) },
            };
          }),
        });
      } else {
        result.push({
          role: 'assistant',
          content: msg.content
            .filter((c) => c.type === 'text')
            .map((c) => (c.type === 'text' ? c.text : ''))
            .join('\n'),
        });
      }
    }
  }

  return result;
}

function toStopReason(reason: string | null | undefined): StopReason {
  switch (reason) {
    case 'stop': return 'end_turn';
    case 'tool_calls': return 'tool_use';
    case 'length': return 'max_tokens';
    default: return 'error';
  }
}

export class LMStudioAdapter implements LLMAdapter {
  readonly providerId = 'lm-studio';
  private inner: OpenAIAdapter;
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:1234/v1') {
    this.baseUrl = baseUrl;
    this.inner = new OpenAIAdapter('lm-studio', baseUrl);
  }

  private getDefaults(): Partial<LLMRequestOptions> {
    return {
      temperature: 0.1,
      maxTokens: 100000,
      reasoningEffort: 'low',
    };
  }

  /**
   * Streaming-with-fallback: try streaming via OpenAI SDK first.
   * If the result is max_tokens (thinking model consumed the budget on reasoning),
   * retry with non-streaming fetch where reasoning_effort works reliably.
   */
  async *stream(options: LLMRequestOptions): AsyncIterable<LLMStreamEvent> {
    const merged: LLMRequestOptions = { ...this.getDefaults(), ...options };

    // First attempt: streaming via OpenAI SDK
    const events: LLMStreamEvent[] = [];
    let hitMaxTokens = false;

    for await (const event of this.inner.stream(merged)) {
      events.push(event);
      if (event.type === 'message_complete' && event.stopReason === 'max_tokens') {
        hitMaxTokens = true;
      }
    }

    // If streaming worked (didn't hit max_tokens), yield all events
    if (!hitMaxTokens) {
      for (const event of events) {
        yield event;
      }
      return;
    }

    // Fallback: non-streaming fetch with reasoning_effort
    yield* this.nonStreamingFallback(merged);
  }

  /**
   * Non-streaming fallback using fetch directly.
   * reasoning_effort works reliably in non-streaming mode on LM Studio.
   */
  private async *nonStreamingFallback(options: LLMRequestOptions): AsyncIterable<LLMStreamEvent> {
    const tools: Record<string, unknown>[] = (options.tools ?? []).map((t: LLMToolDefinition) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    const body: Record<string, unknown> = {
      model: options.model,
      max_tokens: options.maxTokens ?? 100000,
      messages: toOpenAIMessages(options.messages, options.systemPrompt),
      tools: tools.length > 0 ? tools : undefined,
      temperature: options.temperature ?? 0.1,
      reasoning_effort: options.reasoningEffort ?? 'low',
      stream: false,
    };

    try {
      const resp = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: options.signal,
      });

      if (!resp.ok) {
        yield { type: 'error', error: new Error(`LM Studio returned ${resp.status}: ${await resp.text()}`) };
        return;
      }

      const data = await resp.json() as {
        choices: Array<{
          message: {
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              function: { name: string; arguments: string };
            }>;
          };
          finish_reason: string;
        }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      const choice = data.choices[0];
      if (!choice) {
        yield { type: 'error', error: new Error('No choices in response') };
        return;
      }

      if (choice.message.content) {
        yield { type: 'text_delta', delta: choice.message.content };
      }

      if (choice.message.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          yield { type: 'tool_use_start', id: tc.id, name: tc.function.name };
          yield { type: 'tool_use_input_delta', id: tc.id, delta: tc.function.arguments };
          let parsedInput: unknown = {};
          try { parsedInput = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
          yield { type: 'tool_use_complete', id: tc.id, name: tc.function.name, input: parsedInput };
        }
      }

      const usage: TokenUsage = {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      };

      yield { type: 'message_complete', usage, stopReason: toStopReason(choice.finish_reason) };
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async countTokens(messages: Message[]): Promise<number> {
    return this.inner.countTokens(messages);
  }
}
