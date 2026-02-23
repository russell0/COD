import { loadConfig, saveGlobalConfig } from '@cod/config';
import type { McpServerConfig } from '@cod/config';

export async function mcpList(): Promise<void> {
  const settings = await loadConfig();
  const servers = settings.mcpServers;

  if (Object.keys(servers).length === 0) {
    console.log('No MCP servers configured.');
    return;
  }

  console.log('Configured MCP servers:');
  for (const [name, config] of Object.entries(servers)) {
    if (config.type === 'stdio') {
      console.log(`  ${name}: ${config.type} - ${config.command} ${(config.args ?? []).join(' ')}`);
    } else {
      console.log(`  ${name}: ${config.type} - ${config.url}`);
    }
  }
}

export async function mcpAdd(
  name: string,
  type: 'stdio' | 'sse' | 'http',
  commandOrUrl: string,
  args: string[] = [],
): Promise<void> {
  const settings = await loadConfig();

  let serverConfig: McpServerConfig;

  if (type === 'stdio') {
    serverConfig = { type: 'stdio', command: commandOrUrl, args };
  } else {
    serverConfig = { type, url: commandOrUrl };
  }

  const updatedServers = {
    ...settings.mcpServers,
    [name]: serverConfig,
  };

  await saveGlobalConfig({ mcpServers: updatedServers });
  console.log(`Added MCP server "${name}" (${type})`);
}

export async function mcpRemove(name: string): Promise<void> {
  const settings = await loadConfig();

  if (!(name in settings.mcpServers)) {
    console.error(`MCP server "${name}" not found.`);
    process.exit(1);
  }

  const { [name]: _removed, ...remaining } = settings.mcpServers;
  await saveGlobalConfig({ mcpServers: remaining });
  console.log(`Removed MCP server "${name}"`);
}
