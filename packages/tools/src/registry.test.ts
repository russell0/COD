import { describe, it, expect } from 'vitest';
import { ToolRegistry } from './registry.js';
import { z } from 'zod';
import type { ToolDefinition, ToolResult } from '@cod/types';

const makeTool = (name: string): ToolDefinition => ({
  name,
  description: `Test tool ${name}`,
  inputSchema: z.object({ value: z.string() }),
  async execute() { return { type: 'text', text: 'ok' }; },
});

describe('ToolRegistry', () => {
  it('registers and retrieves tools', () => {
    const registry = new ToolRegistry();
    const tool = makeTool('TestTool');
    registry.register(tool);
    expect(registry.get('TestTool')).toBe(tool);
    expect(registry.has('TestTool')).toBe(true);
  });

  it('returns undefined for unknown tools', () => {
    const registry = new ToolRegistry();
    expect(registry.get('Unknown')).toBeUndefined();
  });

  it('returns all tools', () => {
    const registry = new ToolRegistry();
    registry.registerAll([makeTool('A'), makeTool('B'), makeTool('C')]);
    expect(registry.getAll()).toHaveLength(3);
  });

  it('generates LLM tool definitions', () => {
    const registry = new ToolRegistry();
    registry.register(makeTool('MyTool'));
    const llmTools = registry.toLLMTools();
    expect(llmTools).toHaveLength(1);
    expect(llmTools[0]).toMatchObject({
      name: 'MyTool',
      description: 'Test tool MyTool',
    });
    expect(llmTools[0]?.inputSchema).toBeDefined();
  });

  it('namespaces MCP tools correctly', () => {
    const registry = new ToolRegistry();
    registry.registerMcpTool('myServer', makeTool('search'));
    expect(registry.has('myServer__search')).toBe(true);
    const tool = registry.get('myServer__search');
    expect(tool?.name).toBe('myServer__search');
  });
});
