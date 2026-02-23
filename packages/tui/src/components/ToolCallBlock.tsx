import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { ToolCallState } from '../hooks/useAgent.js';

interface ToolCallBlockProps {
  toolCall: ToolCallState;
}

const STATUS_ICONS = {
  pending: '○',
  executing: '→',
  complete: '✓',
  denied: '✗',
} as const;

const STATUS_COLORS = {
  pending: 'gray',
  executing: 'yellow',
  complete: 'green',
  denied: 'red',
} as const;

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const { call, status, result, durationMs } = toolCall;

  return (
    <Box flexDirection="column" marginY={0} paddingX={1}>
      <Box>
        <Text color={STATUS_COLORS[status]}>
          {STATUS_ICONS[status]}{' '}
        </Text>
        <Text bold>{call.name}</Text>
        {durationMs !== undefined && (
          <Text color="gray"> ({durationMs}ms)</Text>
        )}
        {status === 'denied' && <Text color="red"> [DENIED]</Text>}
      </Box>

      {status === 'complete' && result && (
        <Box marginLeft={2} flexDirection="column">
          {result.type === 'error' ? (
            <Text color="red">Error: {result.message}</Text>
          ) : result.type === 'text' ? (
            <Text color="gray" dimColor>
              {result.text.slice(0, 200)}
              {result.text.length > 200 ? '...' : ''}
            </Text>
          ) : (
            <Text color="gray">[image]</Text>
          )}
        </Box>
      )}
    </Box>
  );
}
