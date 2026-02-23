import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '@cod/types';

const ReadInputSchema = z.object({
  file_path: z.string().describe('Absolute path to the file to read'),
  offset: z.number().int().nonnegative().optional().describe('Line number to start reading from (1-indexed)'),
  limit: z.number().int().positive().optional().describe('Maximum number of lines to read'),
});

type ReadInput = z.infer<typeof ReadInputSchema>;

export const ReadTool: ToolDefinition<ReadInput> = {
  name: 'Read',
  description:
    'Read the contents of a file. Returns file content with line numbers.',
  inputSchema: ReadInputSchema,
  annotations: { readOnly: true },

  async execute(input: ReadInput, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const filePath = resolve(context.workingDirectory, input.file_path);
      const content = await readFile(filePath, 'utf8');
      const lines = content.split('\n');

      const start = input.offset !== undefined ? input.offset - 1 : 0;
      const end = input.limit !== undefined ? start + input.limit : lines.length;
      const slice = lines.slice(Math.max(0, start), end);

      const numbered = slice
        .map((line, i) => {
          const lineNum = start + i + 1;
          return `${String(lineNum).padStart(6)}  ${line}`;
        })
        .join('\n');

      return { type: 'text', text: numbered };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { type: 'error', message: `Failed to read file: ${msg}` };
    }
  },
};
