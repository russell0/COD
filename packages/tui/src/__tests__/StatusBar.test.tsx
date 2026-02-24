import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { StatusBar } from '../components/StatusBar.js';
import { PermissionMode } from '@cod/types';
import type { CodSettings } from '@cod/config';

function makeSettings(overrides: Partial<CodSettings> = {}): CodSettings {
  return {
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    permissionMode: PermissionMode.Default,
    apiKeys: {},
    mcpServers: {},
    hooks: {},
    blockedCommands: [],
    autoCompact: true,
    compactThreshold: 0.85,
    historySize: 1000,
    ...overrides,
  };
}

describe('StatusBar', () => {
  it('renders provider and model', () => {
    const { lastFrame } = render(
      <StatusBar
        settings={makeSettings()}
        status="idle"
        inputTokens={0}
        outputTokens={0}
      />,
    );
    expect(lastFrame()).toContain('anthropic/claude-sonnet-4-6');
  });

  it('renders ready status when idle', () => {
    const { lastFrame } = render(
      <StatusBar
        settings={makeSettings()}
        status="idle"
        inputTokens={0}
        outputTokens={0}
      />,
    );
    expect(lastFrame()).toContain('ready');
  });

  it('renders thinking status', () => {
    const { lastFrame } = render(
      <StatusBar
        settings={makeSettings()}
        status="thinking"
        inputTokens={0}
        outputTokens={0}
      />,
    );
    expect(lastFrame()).toContain('thinking');
  });

  it('renders permission mode', () => {
    const { lastFrame } = render(
      <StatusBar
        settings={makeSettings({ permissionMode: PermissionMode.AcceptEdits })}
        status="idle"
        inputTokens={0}
        outputTokens={0}
      />,
    );
    expect(lastFrame()).toContain('acceptEdits');
  });

  it('renders token count', () => {
    const { lastFrame } = render(
      <StatusBar
        settings={makeSettings()}
        status="idle"
        inputTokens={500}
        outputTokens={200}
      />,
    );
    expect(lastFrame()).toContain('700');
  });

  it('renders cost estimate', () => {
    const { lastFrame } = render(
      <StatusBar
        settings={makeSettings()}
        status="idle"
        inputTokens={100_000}
        outputTokens={50_000}
      />,
    );
    // Should have a cost estimate containing a dollar sign
    expect(lastFrame()).toContain('$');
  });
});
