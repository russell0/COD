import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import type {
  LLMAdapter,
  LLMRequestOptions,
  LLMStreamEvent,
  Message,
  TokenUsage,
  StopReason,
} from '@cod/types';

function toGeminiContents(messages: Message[]): { role: string; parts: { text: string }[] }[] {
  return messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: msg.content
      .filter((c) => c.type === 'text')
      .map((c) => ({ text: c.type === 'text' ? c.text : '' })),
  }));
}

function toStopReason(reason: string | undefined): StopReason {
  switch (reason) {
    case 'STOP': return 'end_turn';
    case 'MAX_TOKENS': return 'max_tokens';
    default: return 'end_turn';
  }
}

export class GeminiAdapter implements LLMAdapter {
  readonly providerId = 'gemini';
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async *stream(options: LLMRequestOptions): AsyncIterable<LLMStreamEvent> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: options.model,
        systemInstruction: options.systemPrompt,
      });

      const contents = toGeminiContents(options.messages);
      const lastContent = contents.pop();
      const history = contents;
      const userMessage = lastContent?.parts.map((p) => p.text).join('') ?? '';

      const chat = model.startChat({
        history,
        generationConfig: {
          maxOutputTokens: options.maxTokens ?? 8096,
          temperature: options.temperature,
        },
      });

      const result = await chat.sendMessageStream(userMessage);

      let totalText = '';
      for await (const chunk of result.stream) {
        if (options.signal?.aborted) break;
        const text = chunk.text();
        if (text) {
          yield { type: 'text_delta', delta: text };
          totalText += text;
        }
      }

      const finalResponse = await result.response;
      const usage: TokenUsage = {
        inputTokens: finalResponse.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: finalResponse.usageMetadata?.candidatesTokenCount ?? 0,
      };

      const stopReason = toStopReason(
        finalResponse.candidates?.[0]?.finishReason?.toString(),
      );

      yield { type: 'message_complete', usage, stopReason };
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async countTokens(messages: Message[]): Promise<number> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const contents = toGeminiContents(messages);
      const result = await model.countTokens({ contents });
      return result.totalTokens;
    } catch {
      const text = messages
        .map((m) => m.content.map((c) => ('text' in c ? c.text : '')).join(''))
        .join('');
      return Math.ceil(text.length / 4);
    }
  }
}
