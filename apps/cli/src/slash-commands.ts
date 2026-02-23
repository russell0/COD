import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getGlobalCommandsDir, getProjectCommandsDir } from '@cod/config';
import type { CodAgent } from '@cod/agent';
import type { CodSettings } from '@cod/config';

export interface SlashCommand {
  name: string;
  description: string;
  execute: (args: string, agent: CodAgent, settings: CodSettings) => Promise<string | null>;
}

export function getBuiltinCommands(): SlashCommand[] {
  return [
    {
      name: 'help',
      description: 'Show available slash commands',
      async execute(_args, _agent, _settings) {
        const builtins = getBuiltinCommands();
        const lines = ['Available commands:', ...builtins.map((c) => `  /${c.name} - ${c.description}`)];
        return lines.join('\n');
      },
    },
    {
      name: 'clear',
      description: 'Clear the conversation history',
      async execute(_args, agent, _settings) {
        agent.getSession().clear();
        return 'Conversation cleared.';
      },
    },
    {
      name: 'compact',
      description: 'Manually trigger context compression',
      async execute(_args, _agent, _settings) {
        return 'Context compression will run automatically when needed. Use /clear to start fresh.';
      },
    },
    {
      name: 'model',
      description: 'Show or switch the current model',
      async execute(args, _agent, settings) {
        if (!args.trim()) {
          return `Current model: ${settings.provider}/${settings.model}`;
        }
        return `Model switching requires restart. Set model in config: cod config set model ${args.trim()}`;
      },
    },
    {
      name: 'mode',
      description: 'Show or switch permission mode',
      async execute(args, agent, settings) {
        if (!args.trim()) {
          return `Current mode: ${agent.getPermissionEngine().getMode()}`;
        }
        const validModes = ['default', 'acceptEdits', 'plan', 'dontAsk', 'bypassPermissions'];
        const mode = args.trim();
        if (!validModes.includes(mode)) {
          return `Invalid mode. Valid modes: ${validModes.join(', ')}`;
        }
        agent.getPermissionEngine().setMode(mode as import('@cod/types').PermissionMode);
        return `Permission mode set to: ${mode}`;
      },
    },
    {
      name: 'cost',
      description: 'Show token usage and estimated cost for this session',
      async execute(_args, agent, settings) {
        return 'Token usage tracking is shown in the status bar.';
      },
    },
    {
      name: 'status',
      description: 'Show current status',
      async execute(_args, agent, settings) {
        return [
          `Model: ${settings.provider}/${settings.model}`,
          `Permission mode: ${agent.getPermissionEngine().getMode()}`,
          `Session ID: ${agent.getSession().id}`,
          `Messages: ${agent.getSession().getMessageCount()}`,
          `Tools registered: ${agent.getToolRegistry().getAll().length}`,
        ].join('\n');
      },
    },
    {
      name: 'memory',
      description: 'Add a note to project memory (COD.md)',
      async execute(args, _agent, settings) {
        if (!args.trim()) return 'Usage: /memory <text to remember>';
        const { writeFile, readFile, mkdir } = await import('node:fs/promises');
        const { getProjectMemoryPath } = await import('@cod/config');
        const memPath = getProjectMemoryPath(process.cwd());
        let existing = '';
        try { existing = await readFile(memPath, 'utf8'); } catch { /**/ }
        const updated = existing + (existing ? '\n' : '') + `- ${args.trim()}`;
        await writeFile(memPath, updated, 'utf8');
        return `Added to COD.md: ${args.trim()}`;
      },
    },
  ];
}

/**
 * Load custom markdown slash commands from .cod/commands/ directories.
 */
export async function loadCustomCommands(cwd: string): Promise<SlashCommand[]> {
  const commands: SlashCommand[] = [];
  const dirs = [getProjectCommandsDir(cwd), getGlobalCommandsDir()];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      const files = await readdir(dir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const name = file.slice(0, -3);
        const content = await readFile(join(dir, file), 'utf8');
        commands.push({
          name,
          description: extractDescription(content) ?? `Custom command: ${name}`,
          async execute(_args, agent, _settings) {
            // Inject the command content as a user message
            return null; // Signal: use content as prompt
          },
        });
      }
    } catch {
      // Ignore
    }
  }

  return commands;
}

function extractDescription(content: string): string | null {
  // Look for YAML frontmatter: `description: ...`
  const match = content.match(/^---[\s\S]*?description:\s*(.+?)[\n\r]/m);
  return match ? match[1]?.trim() ?? null : null;
}

export async function handleSlashCommand(
  input: string,
  agent: CodAgent,
  settings: CodSettings,
  cwd: string,
): Promise<{ handled: boolean; output?: string; prompt?: string }> {
  if (!input.startsWith('/')) return { handled: false };

  const [commandName, ...argParts] = input.slice(1).split(' ');
  const args = argParts.join(' ');

  const builtins = getBuiltinCommands();
  const builtin = builtins.find((c) => c.name === commandName);

  if (builtin) {
    const output = await builtin.execute(args, agent, settings);
    return { handled: true, output: output ?? undefined };
  }

  // Check custom commands
  const custom = await loadCustomCommands(cwd);
  const customCmd = custom.find((c) => c.name === commandName);

  if (customCmd) {
    return { handled: true, prompt: args || input.slice(1) };
  }

  return { handled: true, output: `Unknown command: /${commandName}. Type /help for available commands.` };
}
