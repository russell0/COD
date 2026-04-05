import { Command } from 'commander';
import { bootstrap } from './bootstrap.js';
import { runNonInteractive } from './commands/run.js';
import { configGet, configSet } from './commands/config.js';
import { mcpList, mcpAdd, mcpRemove } from './commands/mcp.js';
import { runDoctor } from './commands/doctor.js';

const program = new Command();

program
  .name('cod')
  .description('COD - Open Source AI Coding Assistant')
  .version('0.1.0');

// Default command: interactive REPL
program
  .argument('[prompt]', 'Optional prompt for non-interactive mode')
  .option('-m, --model <model>', 'Override the model to use')
  .option('-p, --provider <provider>', 'Override the provider (anthropic|openai|gemini|ollama|lm-studio)')
  .option('--mode <mode>', 'Permission mode (default|acceptEdits|plan|dontAsk|bypassPermissions)')
  .option('--fafo', 'Bypass all permission checks (alias for --mode bypassPermissions)')
  .option('--cwd <path>', 'Working directory (default: current directory)')
  .option('--json', 'Emit AgentEvents as newline-delimited JSON (non-interactive only)')
  .action(async (prompt?: string, options?: { model?: string; provider?: string; mode?: string; fafo?: boolean; cwd?: string; json?: boolean }) => {
    const { agent, settings } = await bootstrap({
      cwd: options?.cwd,
      model: options?.model,
      provider: options?.provider as 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'lm-studio' | undefined,
      permissionMode: options?.fafo ? 'bypassPermissions' : options?.mode,
    });

    if (prompt) {
      // Non-interactive mode
      await runNonInteractive(agent, prompt, options?.json ?? false);
    } else {
      // Interactive TUI
      await startInteractive(agent, settings);
    }
  });

// `cod run "prompt"` — explicit non-interactive mode
program
  .command('run <prompt>')
  .description('Run a single prompt non-interactively')
  .option('-m, --model <model>', 'Override the model')
  .option('-p, --provider <provider>', 'Override the provider')
  .option('--cwd <path>', 'Working directory')
  .option('--json', 'Emit AgentEvents as newline-delimited JSON')
  .option('--fafo', 'Bypass all permission checks')
  .action(async (prompt: string, options: { model?: string; provider?: string; cwd?: string; json?: boolean; fafo?: boolean }) => {
    const { agent } = await bootstrap({
      ...options,
      permissionMode: options.fafo ? 'bypassPermissions' : undefined,
    });
    await runNonInteractive(agent, prompt, options.json ?? false);
  });

// `cod doctor` — system health check
program
  .command('doctor')
  .description('Check system requirements and configuration')
  .action(async () => {
    await runDoctor();
  });

// `cod config get/set`
const configCmd = program.command('config').description('Manage COD configuration');

configCmd
  .command('get <key>')
  .description('Get a configuration value')
  .action(async (key: string) => {
    await configGet(key);
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(async (key: string, value: string) => {
    await configSet(key, value);
  });

// `cod mcp add/list/remove`
const mcpCmd = program.command('mcp').description('Manage MCP servers');

mcpCmd
  .command('list')
  .description('List configured MCP servers')
  .action(async () => {
    await mcpList();
  });

mcpCmd
  .command('add <name> <command-or-url> [args...]')
  .description('Add an MCP server')
  .option('--type <type>', 'Server type: stdio|sse|http', 'stdio')
  .action(async (name: string, commandOrUrl: string, args: string[], options: { type: string }) => {
    await mcpAdd(name, options.type as 'stdio' | 'sse' | 'http', commandOrUrl, args);
  });

mcpCmd
  .command('remove <name>')
  .description('Remove an MCP server')
  .action(async (name: string) => {
    await mcpRemove(name);
  });

// `cod update` — self-update
program
  .command('update')
  .description('Update COD to the latest version')
  .action(async () => {
    const { execa } = await import('execa');
    console.log('Updating COD...');
    try {
      await execa('npm', ['install', '-g', 'cod@latest'], { stdio: 'inherit' });
      console.log('COD updated successfully!');
    } catch (err) {
      console.error('Update failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

async function startInteractive(
  agent: import('@cod/agent').CodAgent,
  settings: import('@cod/config').CodSettings,
): Promise<void> {
  const { render } = await import('ink');
  const React = await import('react');
  const { App } = await import('@cod/tui');

  await agent.initialize();

  // Install Ctrl+Z handler BEFORE Ink takes over stdin.
  // Ink puts stdin in raw mode which swallows SIGTSTP, so we intercept
  // the 0x1a byte and manually suspend the process. We need to be the
  // very first 'data' listener so we see it before Ink consumes it.
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    const onData = (data: Buffer) => {
      if (data.length === 1 && data[0] === 0x1a) {
        // Save terminal state and exit raw mode
        process.stdout.write('\x1b[?25h');  // show cursor
        process.stdin.setRawMode!(false);
        process.stdin.pause();
        process.stdout.write('\r\n[COD suspended — type "fg" to resume]\r\n');

        // When we come back, restore everything
        process.once('SIGCONT', () => {
          process.stdin.setRawMode!(true);
          process.stdin.resume();
          process.stdout.write('\x1b[?25h');  // show cursor
          process.stdout.write('\r\n[COD resumed]\r\n');
        });

        // Actually suspend
        process.kill(process.pid, 'SIGTSTP');
      }
    };
    // prepend so we fire before Ink's listeners
    process.stdin.prependListener('data', onData);
  }

  const { waitUntilExit } = render(
    React.createElement(App, { agent, settings }),
  );

  // Handle Ctrl+C gracefully
  process.on('SIGINT', async () => {
    agent.abort();
    await agent.cleanup();
    process.exit(0);
  });

  await waitUntilExit();
  await agent.cleanup();
}

// First-run setup check
async function checkFirstRun(): Promise<void> {
  const { existsSync } = await import('node:fs');
  const { getGlobalConfigDir } = await import('@cod/config');
  const configDir = getGlobalConfigDir();

  if (!existsSync(configDir)) {
    // First run — create config directory
    const { mkdir } = await import('node:fs/promises');
    await mkdir(configDir, { recursive: true });

    // Check for API key
    if (!process.env['ANTHROPIC_API_KEY'] && !process.env['OPENAI_API_KEY']) {
      console.log('Welcome to COD! 🤖');
      console.log('');
      console.log('To get started, set your API key:');
      console.log('  export ANTHROPIC_API_KEY=your-key-here');
      console.log('');
      console.log('Or use a different provider:');
      console.log('  export OPENAI_API_KEY=your-key-here');
      console.log('  cod --provider openai --model gpt-4o');
      console.log('');
      console.log('Or run locally with LM Studio (no API key needed):');
      console.log('  cod --provider lm-studio --model google/gemma-4-e2b');
      console.log('');
    }
  }
}

// Main entry point
async function main(): Promise<void> {
  await checkFirstRun();
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
