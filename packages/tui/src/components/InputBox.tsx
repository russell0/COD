import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { useHistory } from '../hooks/useHistory.js';

interface InputBoxProps {
  onSubmit: (text: string) => void;
  onAbort?: () => void;
  onClear?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function InputBox({
  onSubmit,
  onAbort,
  onClear,
  disabled = false,
  placeholder = 'Type a message... (Enter to send, Ctrl+C to abort)',
}: InputBoxProps) {
  const [value, setValue] = useState('');
  const { add: addToHistory, navigateUp, navigateDown } = useHistory();

  useInput(
    (input, key) => {
      if (disabled) return;

      if (key.ctrl && input === 'c') {
        onAbort?.();
        return;
      }

      if (key.ctrl && input === 'l') {
        onClear?.();
        return;
      }

      if (key.upArrow) {
        const prev = navigateUp();
        if (prev !== undefined) setValue(prev);
        return;
      }

      if (key.downArrow) {
        const next = navigateDown();
        setValue(next ?? '');
        return;
      }

      if (key.return) {
        if (value.trim()) {
          addToHistory(value);
          onSubmit(value);
          setValue('');
        }
        return;
      }

      if (key.backspace || key.delete) {
        setValue((prev) => prev.slice(0, -1));
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        setValue((prev) => prev + input);
      }
    },
    { isActive: !disabled },
  );

  return (
    <Box borderStyle="round" borderColor={disabled ? 'gray' : 'cyan'} paddingX={1}>
      <Text color={disabled ? 'gray' : 'white'}>
        {value || <Text color="gray">{placeholder}</Text>}
        {!disabled && <Text color="cyan">█</Text>}
      </Text>
    </Box>
  );
}
