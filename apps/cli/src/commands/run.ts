import type { CodAgent } from '@cod/agent';

/**
 * Non-interactive "run" mode: stream the agent response to stdout.
 */
export async function runNonInteractive(agent: CodAgent, prompt: string): Promise<void> {
  await agent.initialize();

  let hasOutput = false;

  for await (const event of agent.run(prompt)) {
    switch (event.type) {
      case 'text_delta':
        process.stdout.write(event.text);
        hasOutput = true;
        break;

      case 'tool_call_start':
        process.stderr.write(`\n[tool: ${event.call.name}]\n`);
        break;

      case 'tool_call_complete': {
        const result = event.result;
        if (result.type === 'text') {
          const preview = result.text.slice(0, 200);
          process.stderr.write(
            `[tool: ${event.call.name} complete in ${event.durationMs}ms]\n${preview}${result.text.length > 200 ? '...' : ''}\n`,
          );
        } else if (result.type === 'error') {
          process.stderr.write(`[tool: ${event.call.name} error: ${result.message}]\n`);
        }
        break;
      }

      case 'tool_call_denied':
        process.stderr.write(`[tool: ${event.call.name} denied]\n`);
        break;

      case 'context_compressed':
        process.stderr.write(`[context compressed: ${event.before} → ${event.after} tokens]\n`);
        break;

      case 'error':
        process.stderr.write(`\nError: ${event.error.message}\n`);
        if (event.fatal) process.exit(1);
        break;
    }
  }

  if (hasOutput) process.stdout.write('\n');
  await agent.cleanup();
}
