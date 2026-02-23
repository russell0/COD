import { readdir, stat } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { z } from 'zod';
import type { ToolDefinition, ToolResult, ToolExecutionContext } from '@cod/types';

const GlobInputSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files against'),
  path: z
    .string()
    .optional()
    .describe('Directory to search in (defaults to working directory)'),
});

type GlobInput = z.infer<typeof GlobInputSchema>;

function matchGlob(pattern: string, filePath: string): boolean {
  // Convert glob pattern to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex chars
    .replace(/\*\*/g, '<<<DOUBLE_STAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<DOUBLE_STAR>>>/g, '.*')
    .replace(/\?/g, '[^/]');
  try {
    return new RegExp(`^${regexStr}$`).test(filePath);
  } catch {
    return false;
  }
}

async function* walkDir(dir: string): AsyncGenerator<string> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.cod') continue;
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* walkDir(full);
      } else {
        yield full;
      }
    }
  } catch {
    // Ignore unreadable dirs
  }
}

export const GlobTool: ToolDefinition<GlobInput> = {
  name: 'Glob',
  description:
    'Find files matching a glob pattern. Returns matching file paths sorted by modification time.',
  inputSchema: GlobInputSchema,
  annotations: { readOnly: true },

  async execute(input: GlobInput, context: ToolExecutionContext): Promise<ToolResult> {
    const searchDir = input.path
      ? resolve(context.workingDirectory, input.path)
      : context.workingDirectory;

    const matches: { path: string; mtime: number }[] = [];

    for await (const filePath of walkDir(searchDir)) {
      const relPath = relative(searchDir, filePath);
      if (matchGlob(input.pattern, relPath) || matchGlob(input.pattern, filePath)) {
        try {
          const s = await stat(filePath);
          matches.push({ path: filePath, mtime: s.mtimeMs });
        } catch {
          matches.push({ path: filePath, mtime: 0 });
        }
      }
    }

    matches.sort((a, b) => b.mtime - a.mtime);

    if (matches.length === 0) {
      return { type: 'text', text: 'No files found matching the pattern.' };
    }

    return {
      type: 'text',
      text: matches.map((m) => m.path).join('\n'),
    };
  },
};
