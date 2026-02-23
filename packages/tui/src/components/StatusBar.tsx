import React from 'react';
import { Box, Text } from 'ink';
import type { AgentStatus } from '@cod/types';
import type { CodSettings } from '@cod/config';

interface StatusBarProps {
  settings: CodSettings;
  status: AgentStatus;
  inputTokens: number;
  outputTokens: number;
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'ready',
  thinking: 'thinking...',
  responding: 'responding...',
  tool_executing: 'using tool...',
  waiting_permission: 'waiting for permission',
  error: 'error',
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: 'green',
  thinking: 'yellow',
  responding: 'cyan',
  tool_executing: 'magenta',
  waiting_permission: 'red',
  error: 'red',
};

function estimateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): string {
  // Rough pricing per 1M tokens (as of early 2026)
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
    'claude-opus-4-6': { input: 15.0, output: 75.0 },
    'claude-haiku-4-5': { input: 0.8, output: 4.0 },
    'gpt-4o': { input: 5.0, output: 15.0 },
    'gemini-1.5-pro': { input: 3.5, output: 10.5 },
  };

  const prices = pricing[model] ?? { input: 3.0, output: 15.0 };
  const cost = (inputTokens / 1_000_000) * prices.input + (outputTokens / 1_000_000) * prices.output;

  if (cost < 0.001) return '<$0.001';
  return `$${cost.toFixed(3)}`;
}

export function StatusBar({ settings, status, inputTokens, outputTokens }: StatusBarProps) {
  const cost = estimateCost(settings.provider, settings.model, inputTokens, outputTokens);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Box gap={2}>
        <Text color="cyan" bold>COD</Text>
        <Text color="gray">{settings.provider}/{settings.model}</Text>
        <Text color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Text>
      </Box>
      <Box gap={2}>
        <Text color="gray">mode: {settings.permissionMode}</Text>
        <Text color="gray">tokens: {(inputTokens + outputTokens).toLocaleString()}</Text>
        <Text color="gray">est. cost: {cost}</Text>
      </Box>
    </Box>
  );
}
