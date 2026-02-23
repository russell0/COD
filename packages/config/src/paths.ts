import { homedir } from 'node:os';
import { join } from 'node:path';

export function getGlobalConfigDir(): string {
  return join(homedir(), '.cod');
}

export function getGlobalConfigPath(): string {
  return join(getGlobalConfigDir(), 'config.json');
}

export function getGlobalMemoryPath(): string {
  return join(getGlobalConfigDir(), 'MEMORY.md');
}

export function getGlobalHistoryPath(): string {
  return join(getGlobalConfigDir(), 'history');
}

export function getGlobalCommandsDir(): string {
  return join(getGlobalConfigDir(), 'commands');
}

export function getGlobalSkillsDir(): string {
  return join(getGlobalConfigDir(), 'skills');
}

export function getGlobalKeybindingsPath(): string {
  return join(getGlobalConfigDir(), 'keybindings.json');
}

export function getProjectConfigDir(cwd: string): string {
  return join(cwd, '.cod');
}

export function getProjectConfigPath(cwd: string): string {
  return join(getProjectConfigDir(cwd), 'config.json');
}

export function getProjectMemoryPath(cwd: string): string {
  return join(cwd, 'COD.md');
}

export function getClaudeMemoryPath(cwd: string): string {
  return join(cwd, 'CLAUDE.md');
}

export function getProjectMcpConfigPath(cwd: string): string {
  return join(cwd, '.mcp.json');
}

export function getProjectCommandsDir(cwd: string): string {
  return join(getProjectConfigDir(cwd), 'commands');
}
