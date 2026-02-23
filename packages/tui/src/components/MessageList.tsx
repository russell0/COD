import React from 'react';
import { Box } from 'ink';
import { MessageBubble } from './MessageBubble.js';
import { ToolCallBlock } from './ToolCallBlock.js';
import type { MessageState, ToolCallState } from '../hooks/useAgent.js';

interface MessageListProps {
  messages: MessageState[];
  toolCalls: ToolCallState[];
}

export function MessageList({ messages, toolCalls }: MessageListProps) {
  return (
    <Box flexDirection="column" flexGrow={1} overflowY="hidden">
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      {toolCalls.length > 0 && (
        <Box flexDirection="column" marginY={1}>
          {toolCalls.map((tc, i) => (
            <ToolCallBlock key={i} toolCall={tc} />
          ))}
        </Box>
      )}
    </Box>
  );
}
