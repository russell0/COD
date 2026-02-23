import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '@cod/types';

const GrepInputSchema = z.object({
  pattern: z.string().describe('Regular expression pattern to search for'),
  path: z.string().optional().describe('File or directory to search in'),
  glob: z.string().optional().describe('Glob pattern to filter files'),
  output_mode: z
    .enum(['content', 'files_with_matches', 'count'])
    .optional()
    .default('files_with_matches')
    .describe('Output mode'),
  case_insensitive: z.boolean().optional().default(false),
  context: z.number().int().nonnegative().optional().describe('Lines of context around matches'),
  head_limit: z.number().int().nonnegative().optional().describe('Max results to return'),
});

type GrepInput = z.infer<typeof GrepInputSchema>;

function matchGlob(pattern: string, filePath: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<<DOUBLE_STAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<DOUBLE_STAR>>>/g, '.*')
    .replace(/\?/g, '[^/]');
  try {
    return new RegExp(`(^|/)${regexStr}$`).test(filePath);
  } catch {
    return false;
  }
}

async function* walkDir(dir: string): AsyncGenerator<string> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* walkDir(full);
      } else {
        yield full;
      }
    }
  } catch {
    // ignore
  }
}

export const GrepTool: ToolDefinition<GrepInput> = {
  name: 'Grep',
  description:
    'Search file contents using regular expressions. Supports content output, file listing, and count modes.',
  inputSchema: GrepInputSchema,
  annotations: { readOnly: true },

  async execute(input: GrepInput, context: ToolExecutionContext): Promise<ToolResult> {
    const searchPath = input.path
      ? resolve(context.workingDirectory, input.path)
      : context.workingDirectory;

    const flags = input.case_insensitive ? 'gi' : 'g';
    let regex: RegExp;
    try {
      regex = new RegExp(input.pattern, flags);
    } catch (err) {
      return { type: 'error', message: `Invalid regex: ${input.pattern}` };
    }

    const filesToSearch: string[] = [];

    // Determine if path is a file or directory
    try {
      const { stat } = await import('node:fs/promises');
      const s = await stat(searchPath);
      if (s.isFile()) {
        filesToSearch.push(searchPath);
      } else {
        for await (const f of walkDir(searchPath)) {
          if (!input.glob || matchGlob(input.glob, f)) {
            filesToSearch.push(f);
          }
        }
      }
    } catch {
      return { type: 'error', message: `Path not found: ${searchPath}` };
    }

    const outputMode = input.output_mode ?? 'files_with_matches';
    const maxResults = input.head_limit ?? 1000;
    const results: string[] = [];

    for (const filePath of filesToSearch) {
      if (results.length >= maxResults) break;
      try {
        const content = await readFile(filePath, 'utf8');
        const lines = content.split('\n');

        if (outputMode === 'files_with_matches') {
          if (regex.test(content)) {
            results.push(filePath);
          }
          regex.lastIndex = 0;
        } else if (outputMode === 'count') {
          let count = 0;
          for (const line of lines) {
            regex.lastIndex = 0;
            if (regex.test(line)) count++;
          }
          if (count > 0) {
            results.push(`${filePath}: ${count}`);
          }
        } else {
          // content mode
          const ctx = input.context ?? 0;
          const matchedLines: Set<number> = new Set();
          lines.forEach((line, i) => {
            regex.lastIndex = 0;
            if (regex.test(line)) {
              for (let j = Math.max(0, i - ctx); j <= Math.min(lines.length - 1, i + ctx); j++) {
                matchedLines.add(j);
              }
            }
          });

          for (const lineIdx of [...matchedLines].sort((a, b) => a - b)) {
            const line = lines[lineIdx];
            if (line !== undefined) {
              results.push(`${filePath}:${lineIdx + 1}:${line}`);
            }
          }
        }
      } catch {
        // skip unreadable files
      }
    }

    if (results.length === 0) {
      return { type: 'text', text: 'No matches found.' };
    }

    return { type: 'text', text: results.join('\n') };
  },
};
