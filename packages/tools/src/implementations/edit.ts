import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '@cod/types';

const EditInputSchema = z.object({
  file_path: z.string().describe('Path to the file to edit'),
  old_string: z.string().describe('Exact string to replace (must match exactly once unless replace_all is true)'),
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
    'Replace exact text in a file. The old_string must match exactly one location in the file ' +
    '(case-sensitive, whitespace-sensitive). Always Read the file first. Returns a diff of the change.',
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
          text:
            `String not found in ${input.file_path}. ` +
            `Did you Read the file first? The content may have changed. ` +
            `Make sure old_string matches exactly (including whitespace and indentation).`,
        };
      }

      if (!input.replace_all && occurrences > 1) {
        return {
          type: 'error',
          text:
            `Found ${occurrences} occurrences of old_string in ${input.file_path}. ` +
            `Provide more surrounding context in old_string to make the match unique, ` +
            `or use replace_all: true to replace all occurrences.`,
        };
      }

      const newContent = input.replace_all
        ? content.split(input.old_string).join(input.new_string)
        : content.replace(input.old_string, input.new_string);

      await writeFile(filePath, newContent, 'utf8');
      const linesDiff = newContent.split('\n').length - content.split('\n').length;
      const diffSummary = linesDiff === 0 ? 'no line count change' :
        linesDiff > 0 ? `+${linesDiff} lines` : `${linesDiff} lines`;
      return { type: 'text', text: `Edited ${input.file_path} (${diffSummary})` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { type: 'error', text: `Failed to edit ${input.file_path}: ${msg}` };
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

// MultiEdit tool — apply multiple edits atomically to a single file
const MultiEditInputSchema = z.object({
  file_path: z.string().describe('Path to the file to edit'),
  edits: z.array(
    z.object({
      old_string: z.string(),
      new_string: z.string(),
      replace_all: z.boolean().optional().default(false),
    }),
  ).min(1).describe('List of edits to apply in order. If any edit fails, none are applied.'),
});

type MultiEditInput = z.infer<typeof MultiEditInputSchema>;

export const MultiEditTool: ToolDefinition<MultiEditInput> = {
  name: 'MultiEdit',
  description:
    'Apply multiple edits to a single file atomically. If any edit fails, none are applied. ' +
    'More efficient than multiple Edit calls for the same file.',
  inputSchema: MultiEditInputSchema,
  annotations: { destructive: false },

  async execute(input: MultiEditInput, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const filePath = resolve(context.workingDirectory, input.file_path);
      let content = await readFile(filePath, 'utf8');
      // Work on a copy first; only write if all edits succeed
      let draft = content;

      for (let i = 0; i < input.edits.length; i++) {
        const edit = input.edits[i];
        if (!edit) continue;
        const occurrences = countOccurrences(draft, edit.old_string);

        if (occurrences === 0) {
          return {
            type: 'error',
            text:
              `Edit ${i + 1} of ${input.edits.length}: string not found in ${input.file_path}. ` +
              `Did you Read the file first? No changes were applied.`,
          };
        }

        if (!edit.replace_all && occurrences > 1) {
          return {
            type: 'error',
            text:
              `Edit ${i + 1} of ${input.edits.length}: found ${occurrences} occurrences — ` +
              `not unique in ${input.file_path}. Add more context or use replace_all. No changes were applied.`,
          };
        }

        draft = edit.replace_all
          ? draft.split(edit.old_string).join(edit.new_string)
          : draft.replace(edit.old_string, edit.new_string);
      }

      await writeFile(filePath, draft, 'utf8');
      return { type: 'text', text: `Applied ${input.edits.length} edit(s) to ${input.file_path}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { type: 'error', text: `Failed to edit ${input.file_path}: ${msg}` };
    }
  },
};
