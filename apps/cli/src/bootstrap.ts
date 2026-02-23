import { loadConfig } from '@cod/config';
import { LLMRegistry } from '@cod/llm';
import { CodAgent } from '@cod/agent';
import type { CodSettings } from '@cod/config';
import type { AgentConfig } from '@cod/types';

export interface BootstrapOptions {
  cwd?: string;
  model?: string;
  provider?: 'anthropic' | 'openai' | 'gemini' | 'ollama';
  permissionMode?: string;
}

export async function bootstrap(options: BootstrapOptions = {}): Promise<{
  agent: CodAgent;
  settings: CodSettings;
}> {
  const cwd = options.cwd ?? process.cwd();

  const settings = await loadConfig({
    cwd,
    overrides: {
      ...(options.model ? { model: options.model } : {}),
      ...(options.provider ? { provider: options.provider as CodSettings['provider'] } : {}),
    },
  });

  // Check for required API key
  validateApiKey(settings);

  const { adapter } = LLMRegistry.createFromConfig(settings);

  const agentConfig: AgentConfig = {
    model: settings.model,
    provider: settings.provider,
    workingDirectory: cwd,
  };

  const agent = new CodAgent(agentConfig, settings, adapter);

  return { agent, settings };
}

function validateApiKey(settings: CodSettings): void {
  const provider = settings.provider;

  if (provider === 'anthropic' && !settings.apiKeys.anthropic) {
    console.error(
      'Error: ANTHROPIC_API_KEY environment variable is not set.\n' +
        'Set it with: export ANTHROPIC_API_KEY=your-key\n' +
        'Or configure it with: cod config set apiKeys.anthropic your-key',
    );
    process.exit(1);
  }

  if (provider === 'openai' && !settings.apiKeys.openai) {
    console.error(
      'Error: OPENAI_API_KEY environment variable is not set.\n' +
        'Set it with: export OPENAI_API_KEY=your-key',
    );
    process.exit(1);
  }

  if (provider === 'gemini' && !settings.apiKeys.gemini) {
    console.error(
      'Error: GEMINI_API_KEY or GOOGLE_API_KEY environment variable is not set.',
    );
    process.exit(1);
  }

  // Ollama doesn't need a key
}
