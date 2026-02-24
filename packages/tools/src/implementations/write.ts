import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '@cod/types';

const WriteInputSchema = z.object({
  file_path: z.string().describe('Absolute path to the file to write'),
  content: z.string().describe('Content to write to the file'),
});

type WriteInput = z.infer<typeof WriteInputSchema>;

export const WriteTool: ToolDefinition<WriteInput> = {
  name: 'Write',
  description:
    'Write content to a file, creating it and any parent directories if needed. Overwrites existing files.',
  inputSchema: WriteInputSchema,
  annotations: { destructive: true },

  async execute(input: WriteInput, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const filePath = resolve(context.workingDirectory, input.file_path);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, input.content, 'utf8');
      return { type: 'text', text: `Successfully wrote ${filePath}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { type: 'error', text: `Failed to write file: ${msg}` };
    }
  },
};
