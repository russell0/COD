import { useState, useCallback, useRef } from 'react';
import type { AgentEvent, AgentStatus, ToolCall, ToolResult } from '@cod/types';
import type { CodAgent } from '@cod/agent';

export interface ToolCallState {
  call: ToolCall;
  status: 'pending' | 'executing' | 'complete' | 'denied';
  result?: ToolResult;
  durationMs?: number;
}

export interface AgentState {
  status: AgentStatus;
  messages: MessageState[];
  toolCalls: ToolCallState[];
  totalInputTokens: number;
  totalOutputTokens: number;
  error: Error | null;
}

export interface MessageState {
  role: 'user' | 'assistant';
  text: string;
  isStreaming: boolean;
}

export function useAgent(agent: CodAgent) {
  const [state, setState] = useState<AgentState>({
    status: 'idle',
    messages: [],
    toolCalls: [],
    totalInputTokens: 0,
    totalOutputTokens: 0,
    error: null,
  });

  const currentStreamRef = useRef<string>('');
  const abortRef = useRef<(() => void) | null>(null);

  const sendMessage = useCallback(
    async (userText: string) => {
      // Add user message to display
      setState((prev) => ({
        ...prev,
        status: 'thinking',
        error: null,
        messages: [
          ...prev.messages,
          { role: 'user', text: userText, isStreaming: false },
          { role: 'assistant', text: '', isStreaming: true },
        ],
        toolCalls: [],
      }));

      currentStreamRef.current = '';

      let aborted = false;
      abortRef.current = () => {
        aborted = true;
        agent.abort();
      };

      try {
        for await (const event of agent.run(userText)) {
          if (aborted) break;
          handleEvent(event);
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      } finally {
        abortRef.current = null;
        // Finalize streaming message
        setState((prev) => ({
          ...prev,
          status: 'idle',
          messages: prev.messages.map((m, i) =>
            i === prev.messages.length - 1 ? { ...m, isStreaming: false } : m,
          ),
        }));
      }
    },
    [agent],
  );

  const handleEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.type) {
        case 'thinking_start':
          setState((prev) => ({ ...prev, status: 'thinking' }));
          break;

        case 'text_delta':
          currentStreamRef.current += event.text;
          setState((prev) => ({
            ...prev,
            status: 'responding',
            messages: prev.messages.map((m, i) =>
              i === prev.messages.length - 1 && m.isStreaming
                ? { ...m, text: currentStreamRef.current }
                : m,
            ),
          }));
          break;

        case 'tool_call_start':
          setState((prev) => ({
            ...prev,
            status: 'tool_executing',
            toolCalls: [
              ...prev.toolCalls,
              { call: event.call, status: 'pending' },
            ],
          }));
          break;

        case 'tool_call_executing':
          setState((prev) => ({
            ...prev,
            toolCalls: prev.toolCalls.map((tc) =>
              tc.call.id === event.call.id ? { ...tc, status: 'executing' } : tc,
            ),
          }));
          break;

        case 'tool_call_complete':
          setState((prev) => ({
            ...prev,
            toolCalls: prev.toolCalls.map((tc) =>
              tc.call.id === event.call.id
                ? { ...tc, status: 'complete', result: event.result, durationMs: event.durationMs }
                : tc,
            ),
          }));
          break;

        case 'tool_call_denied':
          setState((prev) => ({
            ...prev,
            toolCalls: prev.toolCalls.map((tc) =>
              tc.call.id === event.call.id ? { ...tc, status: 'denied' } : tc,
            ),
          }));
          break;

        case 'turn_complete':
          setState((prev) => ({
            ...prev,
            totalInputTokens: prev.totalInputTokens + event.usage.inputTokens,
            totalOutputTokens: prev.totalOutputTokens + event.usage.outputTokens,
          }));
          break;

        case 'error':
          if (event.fatal) {
            setState((prev) => ({
              ...prev,
              status: 'error',
              error: event.error,
            }));
          }
          break;
      }
    },
    [],
  );

  const abort = useCallback(() => {
    abortRef.current?.();
  }, []);

  const clearMessages = useCallback(() => {
    currentStreamRef.current = '';
    setState({
      status: 'idle',
      messages: [],
      toolCalls: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      error: null,
    });
  }, []);

  return { state, sendMessage, abort, clearMessages };
}
