import { describe, it, expect } from 'vitest';
import { CodSettingsSchema } from './schema.js';
import { PermissionMode } from '@cod/types';

describe('CodSettingsSchema', () => {
  it('uses defaults when given empty object', () => {
    const result = CodSettingsSchema.parse({});
    expect(result.model).toBe('claude-sonnet-4-6');
    expect(result.provider).toBe('anthropic');
    expect(result.permissionMode).toBe(PermissionMode.Default);
    expect(result.autoCompact).toBe(true);
    expect(result.compactThreshold).toBe(0.85);
    expect(result.mcpServers).toEqual({});
    expect(result.hooks).toEqual({});
  });

  it('accepts valid config', () => {
    const result = CodSettingsSchema.parse({
      model: 'gpt-4o',
      provider: 'openai',
      permissionMode: 'plan',
      maxTokens: 4096,
      temperature: 0.7,
      blockedCommands: ['rm -rf'],
    });
    expect(result.model).toBe('gpt-4o');
    expect(result.provider).toBe('openai');
    expect(result.maxTokens).toBe(4096);
  });

  it('rejects invalid provider', () => {
    expect(() =>
      CodSettingsSchema.parse({ provider: 'invalid-provider' }),
    ).toThrow();
  });

  it('rejects temperature out of range', () => {
    expect(() => CodSettingsSchema.parse({ temperature: 3.0 })).toThrow();
    expect(() => CodSettingsSchema.parse({ temperature: -1 })).toThrow();
  });

  it('accepts stdio MCP server config', () => {
    const result = CodSettingsSchema.parse({
      mcpServers: {
        myServer: { type: 'stdio', command: 'npx', args: ['my-server'] },
      },
    });
    const server = result.mcpServers['myServer'];
    expect(server?.type).toBe('stdio');
    if (server?.type === 'stdio') {
      expect(server.command).toBe('npx');
    }
  });
});
