import React, { useCallback, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import { useAgent } from './hooks/useAgent.js';
import { MessageList } from './components/MessageList.js';
import { InputBox } from './components/InputBox.js';
import { StatusBar } from './components/StatusBar.js';
import { PermissionPrompt } from './components/PermissionPrompt.js';
import type { CodAgent } from '@cod/agent';
import type { CodSettings } from '@cod/config';
import type { PermissionRequest, PermissionDecision } from '@cod/types';

interface AppProps {
  agent: CodAgent;
  settings: CodSettings;
  initialMessage?: string;
}

interface PendingPermission {
  request: PermissionRequest;
  resolve: (decision: PermissionDecision) => void;
}

export function App({ agent, settings, initialMessage }: AppProps) {
  const { exit } = useApp();
  const { state, sendMessage, abort, clearMessages } = useAgent(agent);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);

  // Wire up permission prompts
  React.useEffect(() => {
    agent.setPermissionCallback(async (request: PermissionRequest): Promise<PermissionDecision> => {
      return new Promise<PermissionDecision>((resolve) => {
        setPendingPermission({ request, resolve });
      });
    });
  }, [agent]);

  // Send initial message if provided
  React.useEffect(() => {
    if (initialMessage) {
      void sendMessage(initialMessage);
    }
  }, []);

  const handlePermissionDecide = useCallback(
    (decision: 'allow' | 'allow_always' | 'deny') => {
      if (!pendingPermission) return;
      setPendingPermission(null);
      pendingPermission.resolve(
        decision === 'allow'
          ? { type: 'allow' }
          : decision === 'allow_always'
            ? { type: 'allow_always' }
            : { type: 'deny' },
      );
    },
    [pendingPermission],
  );

  const isWaiting = pendingPermission !== null;
  const isDisabled = state.status !== 'idle' || isWaiting;

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar
        settings={settings}
        status={state.status}
        inputTokens={state.totalInputTokens}
        outputTokens={state.totalOutputTokens}
      />

      <MessageList messages={state.messages} toolCalls={state.toolCalls} />

      {state.error && (
        <Box borderStyle="single" borderColor="red" paddingX={1}>
          <Text color="red">Error: {state.error.message}</Text>
        </Box>
      )}

      {isWaiting && pendingPermission ? (
        <PermissionPrompt
          request={pendingPermission.request}
          onDecide={handlePermissionDecide}
        />
      ) : (
        <InputBox
          onSubmit={sendMessage}
          onAbort={abort}
          onClear={clearMessages}
          disabled={isDisabled}
        />
      )}
    </Box>
  );
}
