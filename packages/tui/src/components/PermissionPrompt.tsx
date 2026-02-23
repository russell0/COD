import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { PermissionRequest } from '@cod/types';

interface PermissionPromptProps {
  request: PermissionRequest;
  onDecide: (decision: 'allow' | 'allow_always' | 'deny') => void;
}

const OPTIONS = [
  { key: 'y', label: 'Yes (once)', value: 'allow' as const },
  { key: 'a', label: 'Always (session)', value: 'allow_always' as const },
  { key: 'n', label: 'No (deny)', value: 'deny' as const },
];

export function PermissionPrompt({ request, onDecide }: PermissionPromptProps) {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (input === 'y') { onDecide('allow'); return; }
    if (input === 'a') { onDecide('allow_always'); return; }
    if (input === 'n') { onDecide('deny'); return; }

    if (key.upArrow) setSelected((prev) => Math.max(0, prev - 1));
    if (key.downArrow) setSelected((prev) => Math.min(OPTIONS.length - 1, prev + 1));
    if (key.return) {
      const opt = OPTIONS[selected];
      if (opt) onDecide(opt.value);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="yellow" padding={1}>
      <Text bold color="yellow">⚠ Permission Required</Text>
      <Box marginTop={1}>
        <Text>Tool: </Text>
        <Text bold color="cyan">{request.toolName}</Text>
      </Box>
      <Text color="gray">{request.description}</Text>
      {request.isDestructive && <Text color="red">⚠ This operation may be destructive</Text>}
      {request.requiresShell && <Text color="yellow">⚠ This executes shell commands</Text>}
      <Box marginTop={1} flexDirection="column">
        {OPTIONS.map((opt, i) => (
          <Box key={opt.key}>
            <Text color={i === selected ? 'cyan' : 'white'}>
              {i === selected ? '▶ ' : '  '}[{opt.key}] {opt.label}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
