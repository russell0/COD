import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import {
  getGlobalMemoryPath,
  getProjectMemoryPath,
  getClaudeMemoryPath,
} from '@cod/config';

/**
 * Resolve @-imports in memory files.
 * Syntax: `@path/to/file.md` on its own line imports that file's content.
 */
async function resolveImports(content: string, basePath: string): Promise<string> {
  const lines = content.split('\n');
  const resolved: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('@') && !trimmed.includes(' ')) {
      const importPath = resolve(basePath, trimmed.slice(1));
      if (existsSync(importPath)) {
        try {
          const imported = await readFile(importPath, 'utf8');
          resolved.push(imported);
          continue;
        } catch {
          // Fall through: keep original line
        }
      }
    }
    resolved.push(line);
  }

  return resolved.join('\n');
}

async function loadMemoryFile(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) return null;
  try {
    const content = await readFile(filePath, 'utf8');
    return resolveImports(content, dirname(filePath));
  } catch {
    return null;
  }
}

export interface LoadedMemory {
  globalMemory: string | null;
  projectMemory: string | null;
}

export async function loadMemory(cwd: string): Promise<LoadedMemory> {
  const [globalMemory, projectCodMemory, claudeMemory] = await Promise.all([
    loadMemoryFile(getGlobalMemoryPath()),
    loadMemoryFile(getProjectMemoryPath(cwd)),
    loadMemoryFile(getClaudeMemoryPath(cwd)),
  ]);

  // Prefer COD.md, fall back to CLAUDE.md
  const projectMemory = projectCodMemory ?? claudeMemory;

  return { globalMemory, projectMemory };
}

export function buildSystemPrompt(
  memory: LoadedMemory,
  extraContext?: string,
): string {
  const parts: string[] = [];

  parts.push(
    `You are COD, an AI coding assistant. You help users with software engineering tasks.

You have access to tools for reading and writing files, executing shell commands, searching code, and more.
Always prefer reading existing code before modifying it. Write clean, correct, minimal code.
When uncertain about requirements, ask clarifying questions.`,
  );

  if (memory.globalMemory) {
    parts.push(`\n<global_memory>\n${memory.globalMemory}\n</global_memory>`);
  }

  if (memory.projectMemory) {
    parts.push(`\n<project_memory>\n${memory.projectMemory}\n</project_memory>`);
  }

  if (extraContext) {
    parts.push(`\n${extraContext}`);
  }

  return parts.join('\n');
}
