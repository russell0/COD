import { z } from 'zod';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '@cod/types';

const BashInputSchema = z.object({
  command: z.string().describe('The shell command to execute'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .default(120000)
    .describe('Timeout in milliseconds (default 120000 = 2 minutes)'),
  description: z.string().optional().describe('Description of what the command does'),
});

type BashInput = z.infer<typeof BashInputSchema>;

export const BashTool: ToolDefinition<BashInput> = {
  name: 'Bash',
  description:
    'Execute a shell command. Returns stdout and stderr. Times out after the specified duration.',
  inputSchema: BashInputSchema,
  annotations: { requiresShell: true, destructive: true },

  async execute(input: BashInput, context: ToolExecutionContext): Promise<ToolResult> {
    const { execa } = await import('execa');

    const timeoutMs = input.timeout ?? 120000;

    // Create a combined abort signal from context signal and timeout
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    const signal = context.signal
      ? AbortSignal.any([context.signal, timeoutController.signal])
      : timeoutController.signal;

    try {
      const result = await execa('bash', ['-c', input.command], {
        cwd: context.workingDirectory,
        env: process.env as Record<string, string>,
        reject: false,
        cancelSignal: signal,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      clearTimeout(timeoutId);

      const stdout = result.stdout ?? '';
      const stderr = result.stderr ?? '';

      let output = '';
      if (stdout) output += stdout;
      if (stderr) output += (output ? '\n' : '') + `[stderr]\n${stderr}`;
      if (result.exitCode !== 0) {
        output += `\n[Exit code: ${result.exitCode}]`;
      }

      if (!output) output = '(no output)';

      // Truncate very long output
      const MAX_OUTPUT = 100_000;
      if (output.length > MAX_OUTPUT) {
        output = output.slice(0, MAX_OUTPUT) + `\n... [truncated, ${output.length - MAX_OUTPUT} more chars]`;
      }

      return { type: 'text', text: output };
    } catch (err) {
      clearTimeout(timeoutId);
      if (signal.aborted) {
        if (context.signal?.aborted) {
          return { type: 'error', text: 'Command was aborted.' };
        }
        return { type: 'error', text: `Command timed out after ${timeoutMs}ms.` };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { type: 'error', text: `Command failed: ${msg}` };
    }
  },
};
