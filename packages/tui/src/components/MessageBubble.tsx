import React from 'react';
import { Box, Text } from 'ink';
import type { MessageState } from '../hooks/useAgent.js';

interface MessageBubbleProps {
  message: MessageState;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      paddingX={1}
      borderStyle="single"
      borderColor={isUser ? 'blue' : 'green'}
    >
      <Text bold color={isUser ? 'blue' : 'green'}>
        {isUser ? '> You' : '◆ COD'}
        {message.isStreaming ? <Text color="yellow"> ●</Text> : null}
      </Text>
      <Text wrap="wrap">{message.text || (message.isStreaming ? '...' : '')}</Text>
    </Box>
  );
}
