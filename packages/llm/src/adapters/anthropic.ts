import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMAdapter,
  LLMRequestOptions,
  LLMStreamEvent,
  Message,
  TokenUsage,
  StopReason,
} from '@cod/types';

function toAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content.map((c) => {
      if (c.type === 'text') return { type: 'text' as const, text: c.text };
      if (c.type === 'tool_use') {
        return {
          type: 'tool_use' as const,
          id: c.id,
          name: c.name,
          input: c.input as Record<string, unknown>,
        };
      }
      if (c.type === 'tool_result') {
        return {
          type: 'tool_result' as const,
          tool_use_id: c.tool_use_id,
          content: c.content.map((rc) => {
            if (rc.type === 'text') return { type: 'text' as const, text: rc.text };
            return {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: rc.source.media_type,
                data: rc.source.data,
              },
            };
          }),
        };
      }
      if (c.type === 'image') {
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: c.source.media_type,
            data: c.source.data,
          },
        };
      }
      throw new Error(`Unknown message content type`);
    }),
  }));
}

function toStopReason(reason: string | null | undefined): StopReason {
  switch (reason) {
    case 'end_turn': return 'end_turn';
    case 'tool_use': return 'tool_use';
    case 'max_tokens': return 'max_tokens';
    case 'stop_sequence': return 'stop_sequence';
    default: return 'error';
  }
}

export class AnthropicAdapter implements LLMAdapter {
  readonly providerId = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *stream(options: LLMRequestOptions): AsyncIterable<LLMStreamEvent> {
    const tools: Anthropic.Tool[] = (options.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }));

    // Build params, only including optional fields when they have values
    const params: Anthropic.MessageStreamParams = {
      model: options.model,
      max_tokens: options.maxTokens ?? 8096,
      messages: toAnthropicMessages(options.messages),
      ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
      ...(tools.length > 0 ? { tools } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    };

    try {
      const stream = this.client.messages.stream(params, { signal: options.signal });

      const toolInputBuffers = new Map<string, string>();
      const toolNames = new Map<number, string>();
      const toolIds = new Map<number, string>();

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            toolInputBuffers.set(event.content_block.id, '');
            toolNames.set(event.index, event.content_block.name);
            toolIds.set(event.index, event.content_block.id);
            yield {
              type: 'tool_use_start',
              id: event.content_block.id,
              name: event.content_block.name,
            };
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield { type: 'text_delta', delta: event.delta.text };
          } else if (event.delta.type === 'input_json_delta') {
            const toolId = toolIds.get(event.index);
            if (toolId !== undefined) {
              toolInputBuffers.set(
                toolId,
                (toolInputBuffers.get(toolId) ?? '') + event.delta.partial_json,
              );
              yield {
                type: 'tool_use_input_delta',
                id: toolId,
                delta: event.delta.partial_json,
              };
            }
          }
        } else if (event.type === 'content_block_stop') {
          const toolId = toolIds.get(event.index);
          const toolName = toolNames.get(event.index);
          if (toolId !== undefined && toolName !== undefined) {
            const rawInput = toolInputBuffers.get(toolId) ?? '{}';
            let parsedInput: unknown = {};
            try {
              parsedInput = JSON.parse(rawInput);
            } catch {
              parsedInput = {};
            }
            yield { type: 'tool_use_complete', id: toolId, name: toolName, input: parsedInput };
          }
        } else if (event.type === 'message_delta') {
          if (event.delta.stop_reason !== null && event.delta.stop_reason !== undefined) {
            const usage: TokenUsage = {
              inputTokens: 0,
              outputTokens: event.usage.output_tokens,
            };
            yield {
              type: 'message_complete',
              usage,
              stopReason: toStopReason(event.delta.stop_reason),
            };
          }
        } else if (event.type === 'message_start') {
          // Could capture initial input token count here if needed
        }
      }

      // Emit final usage
      const finalMsg = await stream.finalMessage().catch(() => null);
      if (finalMsg) {
        const rawUsage = finalMsg.usage as unknown as Record<string, number>;
        const usage: TokenUsage = {
          inputTokens: rawUsage['input_tokens'] ?? 0,
          outputTokens: rawUsage['output_tokens'] ?? 0,
          cacheReadTokens: rawUsage['cache_read_input_tokens'],
          cacheWriteTokens: rawUsage['cache_creation_input_tokens'],
        };
        yield {
          type: 'message_complete',
          usage,
          stopReason: toStopReason(finalMsg.stop_reason),
        };
      }
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async countTokens(messages: Message[]): Promise<number> {
    // Estimate: ~4 chars per token (countTokens API may not be available in all SDK versions)
    try {
      const response = await (this.client.messages as unknown as {
        countTokens?: (params: unknown) => Promise<{ input_tokens: number }>;
      }).countTokens?.({
        model: 'claude-sonnet-4-6',
        messages: toAnthropicMessages(messages),
      });
      if (response) return response.input_tokens;
    } catch {
      // fall through to estimate
    }
    const text = messages.map((m) => m.content.map((c) => ('text' in c ? c.text : '')).join('')).join('');
    return Math.ceil(text.length / 4);
  }
}
