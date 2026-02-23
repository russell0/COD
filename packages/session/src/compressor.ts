import type { LLMAdapter, Message } from '@cod/types';
import type { Session } from './session.js';

const KEEP_LAST_TURNS = 10;

export class SlidingWindowCompressor {
  private adapter: LLMAdapter;
  private model: string;
  private contextWindowTokens: number;
  private threshold: number; // 0-1 fraction of context window

  constructor(
    adapter: LLMAdapter,
    model: string,
    contextWindowTokens: number,
    threshold = 0.85,
  ) {
    this.adapter = adapter;
    this.model = model;
    this.contextWindowTokens = contextWindowTokens;
    this.threshold = threshold;
  }

  async needsCompression(session: Session): Promise<boolean> {
    const messages = session.getMessages();
    if (messages.length < 4) return false;

    const tokenCount = await this.adapter.countTokens(messages);
    return tokenCount > this.contextWindowTokens * this.threshold;
  }

  async compress(
    session: Session,
    systemPrompt: string,
  ): Promise<{ before: number; after: number }> {
    const messages = session.getMessages();
    const before = await this.adapter.countTokens(messages);

    // Ask the LLM to summarize the conversation
    const summary = await this.generateSummary(messages, systemPrompt);

    // Keep the last KEEP_LAST_TURNS * 2 messages (user + assistant pairs)
    const keepCount = KEEP_LAST_TURNS * 2;
    session.replaceWithSummary(summary, keepCount);

    const after = await this.adapter.countTokens(session.getMessages());
    return { before, after };
  }

  private async generateSummary(messages: Message[], systemPrompt: string): Promise<string> {
    const summaryMessages: Message[] = [
      ...messages,
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Please provide a concise summary of our conversation so far, including: key decisions made, files modified, tasks completed, and important context. Be specific about file paths, code changes, and any unresolved issues.',
          },
        ],
      },
    ];

    let summary = '';

    try {
      for await (const event of this.adapter.stream({
        model: this.model,
        messages: summaryMessages,
        systemPrompt,
        maxTokens: 2048,
      })) {
        if (event.type === 'text_delta') {
          summary += event.delta;
        }
      }
    } catch {
      // Fallback: just note that messages were compressed
      summary = `[Conversation compressed. ${messages.length} messages were summarized.]`;
    }

    return summary;
  }
}
