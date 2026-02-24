import type { Message, MessageContent } from '@cod/types';
import type { ToolCall, ToolResult } from '@cod/types';

export interface ConversationTurn {
  userMessage: Message;
  assistantMessage: Message;
}

export class Session {
  readonly id: string;
  private messages: Message[] = [];

  constructor(id?: string) {
    this.id = id ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  addUserMessage(text: string): void {
    this.messages.push({
      role: 'user',
      content: [{ type: 'text', text }],
    });
  }

  addAssistantMessage(content: MessageContent[]): void {
    this.messages.push({ role: 'assistant', content });
  }

  addToolResults(results: { toolCallId: string; result: ToolResult }[]): void {
    const content: MessageContent[] = results.map(({ toolCallId, result }) => {
      const resultContent =
        result.type === 'error'
          ? [{ type: 'text' as const, text: `Error: ${result.text}` }]
          : [{ type: 'text' as const, text: result.text }];

      return {
        type: 'tool_result' as const,
        tool_use_id: toolCallId,
        content: resultContent,
      };
    });

    this.messages.push({ role: 'user', content });
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  clear(): void {
    this.messages = [];
  }

  /**
   * Replace messages with a compressed summary.
   */
  replaceWithSummary(summary: string, keepLastN: number): void {
    const toKeep = this.messages.slice(-keepLastN);
    this.messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `[Previous conversation summary]\n${summary}`,
          },
        ],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Understood. I have the context from our previous conversation.' }],
      },
      ...toKeep,
    ];
  }
}
