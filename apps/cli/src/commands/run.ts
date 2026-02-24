import type { CodAgent } from '@cod/agent';

/**
 * Non-interactive "run" mode: stream the agent response to stdout.
 * When json=true, emit each AgentEvent as a newline-delimited JSON object
 * (useful for scripting / piping into other tools).
 */
export async function runNonInteractive(agent: CodAgent, prompt: string, json = false): Promise<void> {
  await agent.initialize();

  let hasOutput = false;

  for await (const event of agent.run(prompt)) {
    if (json) {
      process.stdout.write(JSON.stringify(event) + '\n');
      continue;
    }

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
          process.stderr.write(`[tool: ${event.call.name} error: ${result.text}]\n`);
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

  if (!json && hasOutput) process.stdout.write('\n');
  await agent.cleanup();
}
