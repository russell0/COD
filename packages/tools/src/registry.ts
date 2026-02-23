import type { ToolDefinition, LLMToolDefinition } from '@cod/types';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from './zod-to-json.js';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getAll(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  /**
   * Get tool definitions formatted for the LLM API.
   */
  toLLMTools(): LLMToolDefinition[] {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.inputSchema),
    }));
  }

  /**
   * Register an MCP tool with namespaced name: "serverName__toolName"
   */
  registerMcpTool(serverName: string, tool: ToolDefinition): void {
    const namespacedName = `${serverName}__${tool.name}`;
    this.tools.set(namespacedName, { ...tool, name: namespacedName });
  }
}
