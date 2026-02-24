import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '@cod/types';
import type { McpServerConfig } from '@cod/config';
import { z } from 'zod';

interface McpConnection {
  client: Client;
  serverName: string;
}

export class MCPClientManager {
  private connections = new Map<string, McpConnection>();

  async connectAll(servers: Record<string, McpServerConfig>): Promise<void> {
    const entries = Object.entries(servers);
    await Promise.allSettled(
      entries.map(([name, config]) => this.connect(name, config)),
    );
  }

  async connect(serverName: string, config: McpServerConfig): Promise<void> {
    try {
      const client = new Client(
        { name: 'cod', version: '0.1.0' },
        { capabilities: {} },
      );

      let transport;

      if (config.type === 'stdio') {
        if (!config.command) throw new Error('stdio server requires command');
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args ?? [],
          env: { ...process.env, ...(config.env ?? {}) } as Record<string, string>,
        });
      } else if (config.type === 'sse' || config.type === 'http') {
        if (!config.url) throw new Error(`${config.type} server requires url`);
        transport = new SSEClientTransport(new URL(config.url));
      } else {
        throw new Error(`Unknown MCP server type`);
      }

      await client.connect(transport);
      this.connections.set(serverName, { client, serverName });
    } catch (err) {
      console.error(`Failed to connect MCP server "${serverName}": ${err instanceof Error ? err.message : err}`);
    }
  }

  async disconnect(serverName: string): Promise<void> {
    const conn = this.connections.get(serverName);
    if (conn) {
      await conn.client.close();
      this.connections.delete(serverName);
    }
  }

  async disconnectAll(): Promise<void> {
    await Promise.allSettled(
      [...this.connections.keys()].map((name) => this.disconnect(name)),
    );
  }

  async getAllTools(): Promise<{ serverName: string; tool: ToolDefinition }[]> {
    const results: { serverName: string; tool: ToolDefinition }[] = [];

    for (const [serverName, { client }] of this.connections) {
      try {
        const { tools } = await client.listTools();
        for (const mcpTool of tools) {
          results.push({
            serverName,
            tool: this.mcpToolToDefinition(serverName, mcpTool, client),
          });
        }
      } catch (err) {
        console.error(`Failed to list tools from "${serverName}": ${err instanceof Error ? err.message : err}`);
      }
    }

    return results;
  }

  private mcpToolToDefinition(
    serverName: string,
    mcpTool: { name: string; description?: string; inputSchema: unknown },
    client: Client,
  ): ToolDefinition {
    // Build a Zod schema from the JSON schema (passthrough for MCP tools)
    const inputSchema = z.record(z.unknown()).describe(mcpTool.description ?? mcpTool.name);

    return {
      name: mcpTool.name,
      description: mcpTool.description ?? `MCP tool from ${serverName}`,
      inputSchema,
      async execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult> {
        try {
          const result = await client.callTool({
            name: mcpTool.name,
            arguments: input as Record<string, unknown>,
          });

          const textContent = (result.content as Array<{ type: string; text?: string }>)
            .filter((c) => c.type === 'text')
            .map((c) => c.text ?? '')
            .join('\n');

          return { type: 'text', text: textContent || '(no output)' };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { type: 'error', text: `MCP tool error: ${msg}` };
        }
      },
    };
  }

  getConnectedServers(): string[] {
    return [...this.connections.keys()];
  }

  isConnected(serverName: string): boolean {
    return this.connections.has(serverName);
  }
}
