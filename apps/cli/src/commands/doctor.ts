import { execSync } from 'node:child_process';

interface Check {
  label: string;
  pass: boolean;
  detail?: string;
}

function check(label: string, fn: () => string | boolean): Check {
  try {
    const result = fn();
    if (typeof result === 'boolean') {
      return { label, pass: result };
    }
    return { label, pass: true, detail: result };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { label, pass: false, detail };
  }
}

export async function runDoctor(): Promise<void> {
  const checks: Check[] = [];

  // Node.js version >= 20
  checks.push(
    check('Node.js >= 20', () => {
      const major = parseInt(process.versions.node.split('.')[0] ?? '0', 10);
      if (major < 20) throw new Error(`Node.js ${process.versions.node} found (need >= 20)`);
      return `Node.js ${process.versions.node}`;
    }),
  );

  // API keys
  const anthropicKey = process.env['ANTHROPIC_API_KEY'];
  checks.push({
    label: 'ANTHROPIC_API_KEY',
    pass: !!anthropicKey,
    detail: anthropicKey ? `set (${anthropicKey.slice(0, 8)}...)` : 'not set',
  });

  const openaiKey = process.env['OPENAI_API_KEY'];
  checks.push({
    label: 'OPENAI_API_KEY',
    pass: !!openaiKey,
    detail: openaiKey ? `set (${openaiKey.slice(0, 8)}...)` : 'not set (optional)',
  });

  const geminiKey = process.env['GOOGLE_GENERATIVE_AI_API_KEY'];
  checks.push({
    label: 'GOOGLE_GENERATIVE_AI_API_KEY',
    pass: !!geminiKey,
    detail: geminiKey ? `set (${geminiKey.slice(0, 8)}...)` : 'not set (optional)',
  });

  // git in PATH
  checks.push(
    check('git in PATH', () => {
      const version = execSync('git --version', { encoding: 'utf8' }).trim();
      return version;
    }),
  );

  // MCP server config (if any)
  checks.push(
    await (async () => {
      try {
        const { loadConfig } = await import('@cod/config');
        const settings = await loadConfig(process.cwd());
        const serverCount = Object.keys(settings.mcpServers ?? {}).length;
        return {
          label: 'MCP servers configured',
          pass: true,
          detail: serverCount === 0 ? 'none configured' : `${serverCount} server(s)`,
        };
      } catch (err) {
        return {
          label: 'MCP servers configured',
          pass: false,
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    })(),
  );

  // LLM connectivity (only if an API key is set)
  if (anthropicKey) {
    checks.push(
      await (async () => {
        try {
          const { LLMRegistry } = await import('@cod/llm');
          const { loadConfig } = await import('@cod/config');
          const settings = await loadConfig(process.cwd());
          const { adapter } = LLMRegistry.createFromConfig(settings);

          let gotResponse = false;
          for await (const event of adapter.stream({
            model: settings.model,
            messages: [{ role: 'user', content: [{ type: 'text', text: 'Say "ok"' }] }],
            systemPrompt: 'You are a health check. Reply with only "ok".',
            tools: [],
            maxTokens: 10,
          })) {
            if (event.type === 'text_delta' || event.type === 'message_complete') {
              gotResponse = true;
              break;
            }
          }

          return { label: 'Anthropic LLM connectivity', pass: gotResponse, detail: gotResponse ? 'ok' : 'no response' };
        } catch (err) {
          return {
            label: 'Anthropic LLM connectivity',
            pass: false,
            detail: err instanceof Error ? err.message : String(err),
          };
        }
      })(),
    );
  }

  // Print results
  console.log('\nCOD Doctor\n----------');
  let allPassed = true;
  for (const c of checks) {
    const icon = c.pass ? '✓' : '✗';
    const color = c.pass ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    const detail = c.detail ? `  (${c.detail})` : '';
    console.log(`${color}${icon}${reset} ${c.label}${detail}`);
    if (!c.pass) allPassed = false;
  }

  console.log('');
  if (allPassed) {
    console.log('\x1b[32mAll checks passed!\x1b[0m');
  } else {
    console.log('\x1b[33mSome checks failed. See details above.\x1b[0m');
    process.exit(1);
  }
}
