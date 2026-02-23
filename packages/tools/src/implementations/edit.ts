import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '@cod/types';

const EditInputSchema = z.object({
  file_path: z.string().describe('Path to the file to edit'),
  old_string: z.string().describe('Exact string to replace'),
  new_string: z.string().describe('Replacement string'),
  replace_all: z
    .boolean()
    .optional()
    .default(false)
    .describe('Replace all occurrences (default: false, fails if not unique)'),
});

type EditInput = z.infer<typeof EditInputSchema>;

export const EditTool: ToolDefinition<EditInput> = {
  name: 'Edit',
  description:
    'Perform an exact string replacement in a file. Fails if old_string is not found or is not unique (unless replace_all is true).',
  inputSchema: EditInputSchema,
  annotations: { destructive: false },

  async execute(input: EditInput, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const filePath = resolve(context.workingDirectory, input.file_path);
      const content = await readFile(filePath, 'utf8');

      const occurrences = countOccurrences(content, input.old_string);

      if (occurrences === 0) {
        return {
          type: 'error',
          message: `old_string not found in file. Make sure it matches exactly (including whitespace and indentation).`,
        };
      }

      if (!input.replace_all && occurrences > 1) {
        return {
          type: 'error',
          message: `old_string is not unique: found ${occurrences} occurrences. Use replace_all: true or provide more surrounding context.`,
        };
      }

      const newContent = input.replace_all
        ? content.split(input.old_string).join(input.new_string)
        : content.replace(input.old_string, input.new_string);

      await writeFile(filePath, newContent, 'utf8');
      return { type: 'text', text: `Successfully edited ${filePath}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { type: 'error', message: `Failed to edit file: ${msg}` };
    }
  },
};

function countOccurrences(str: string, sub: string): number {
  if (sub.length === 0) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(sub, pos)) !== -1) {
    count++;
    pos += sub.length;
  }
  return count;
}

// MultiEdit tool — apply multiple edits atomically
const MultiEditInputSchema = z.object({
  file_path: z.string().describe('Path to the file to edit'),
  edits: z.array(
    z.object({
      old_string: z.string(),
      new_string: z.string(),
      replace_all: z.boolean().optional().default(false),
    }),
  ).min(1).describe('List of edits to apply in order'),
});

type MultiEditInput = z.infer<typeof MultiEditInputSchema>;

export const MultiEditTool: ToolDefinition<MultiEditInput> = {
  name: 'MultiEdit',
  description:
    'Apply multiple exact string replacements to a single file atomically.',
  inputSchema: MultiEditInputSchema,
  annotations: { destructive: false },

  async execute(input: MultiEditInput, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const filePath = resolve(context.workingDirectory, input.file_path);
      let content = await readFile(filePath, 'utf8');

      for (let i = 0; i < input.edits.length; i++) {
        const edit = input.edits[i];
        if (!edit) continue;
        const occurrences = countOccurrences(content, edit.old_string);

        if (occurrences === 0) {
          return {
            type: 'error',
            message: `Edit ${i + 1}: old_string not found. Make sure it matches exactly.`,
          };
        }

        if (!edit.replace_all && occurrences > 1) {
          return {
            type: 'error',
            message: `Edit ${i + 1}: old_string is not unique (${occurrences} occurrences). Use replace_all or add context.`,
          };
        }

        content = edit.replace_all
          ? content.split(edit.old_string).join(edit.new_string)
          : content.replace(edit.old_string, edit.new_string);
      }

      await writeFile(filePath, content, 'utf8');
      return { type: 'text', text: `Successfully applied ${input.edits.length} edit(s) to ${filePath}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { type: 'error', message: `Failed to edit file: ${msg}` };
    }
  },
};
