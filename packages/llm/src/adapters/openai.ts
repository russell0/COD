import OpenAI from 'openai';
import type {
  LLMAdapter,
  LLMRequestOptions,
  LLMStreamEvent,
  Message,
  TokenUsage,
  StopReason,
} from '@cod/types';

function toOpenAIMessages(
  messages: Message[],
  systemPrompt?: string,
): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of messages) {
    if (msg.role === 'user') {
      const textParts = msg.content.filter((c) => c.type === 'text' || c.type === 'tool_result');
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
              function: {
                name: tu.name,
                arguments: JSON.stringify(tu.input),
              },
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

export class OpenAIAdapter implements LLMAdapter {
  readonly providerId = 'openai';
  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async *stream(options: LLMRequestOptions): AsyncIterable<LLMStreamEvent> {
    const tools: OpenAI.ChatCompletionTool[] = (options.tools ?? []).map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema as Record<string, unknown>,
      },
    }));

    // Map from array index → { id, name, args } for accumulating streaming tool calls
    const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();
    let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
    let stopReason: StopReason = 'end_turn';

    try {
      const stream = await this.client.chat.completions.create(
        {
          model: options.model,
          max_tokens: options.maxTokens ?? 4096,
          messages: toOpenAIMessages(options.messages, options.systemPrompt),
          tools: tools.length > 0 ? tools : undefined,
          temperature: options.temperature,
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal: options.signal },
      );

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        if (choice.delta.content) {
          yield { type: 'text_delta', delta: choice.delta.content };
        }

        if (choice.delta.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const idx = tc.index;
            if (tc.id) {
              // First chunk for this tool call — has the real id and name
              const entry = { id: tc.id, name: tc.function?.name ?? '', args: '' };
              toolCallBuffers.set(idx, entry);
              yield { type: 'tool_use_start', id: tc.id, name: entry.name };
            }
            if (tc.function?.arguments) {
              const entry = toolCallBuffers.get(idx);
              if (entry) {
                entry.args += tc.function.arguments;
                // Use the real tool call ID, not the array index
                yield { type: 'tool_use_input_delta', id: entry.id, delta: tc.function.arguments };
              }
            }
          }
        }

        if (choice.finish_reason) {
          stopReason = toStopReason(choice.finish_reason);
        }

        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
          };
        }
      }

      // Emit tool_use_complete for all accumulated tool calls (ordered by index)
      for (const [, { id, name, args }] of [...toolCallBuffers.entries()].sort(([a], [b]) => a - b)) {
        let parsedInput: unknown = {};
        try {
          parsedInput = JSON.parse(args);
        } catch {
          parsedInput = {};
        }
        yield { type: 'tool_use_complete', id, name, input: parsedInput };
      }

      yield { type: 'message_complete', usage, stopReason };
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async countTokens(messages: Message[]): Promise<number> {
    // Estimate: ~4 chars per token
    const text = messages
      .map((m) => m.content.map((c) => ('text' in c ? c.text : '')).join(''))
      .join('');
    return Math.ceil(text.length / 4);
  }
}
