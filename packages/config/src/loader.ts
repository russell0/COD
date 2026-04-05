import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { CodSettingsSchema, type CodSettings } from './schema.js';
import {
  getGlobalConfigPath,
  getProjectConfigPath,
} from './paths.js';
import { PermissionMode } from '@cod/types';

const DEFAULTS: CodSettings = {
  model: 'claude-sonnet-4-6',
  provider: 'anthropic',
  permissionMode: PermissionMode.Default,
  apiKeys: {},
  mcpServers: {},
  hooks: {},
  blockedCommands: [],
  autoCompact: true,
  compactThreshold: 0.85,
  historySize: 1000,
};

async function loadJsonFile(path: string): Promise<Record<string, unknown>> {
  if (!existsSync(path)) return {};
  try {
    const content = await readFile(path, 'utf8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function resolveApiKeys(settings: CodSettings): CodSettings {
  return {
    ...settings,
    apiKeys: {
      anthropic:
        settings.apiKeys.anthropic ?? process.env['ANTHROPIC_API_KEY'] ?? undefined,
      openai:
        settings.apiKeys.openai ?? process.env['OPENAI_API_KEY'] ?? undefined,
      gemini:
        settings.apiKeys.gemini ?? process.env['GEMINI_API_KEY'] ?? process.env['GOOGLE_API_KEY'] ?? undefined,
    },
    ollamaBaseUrl:
      settings.ollamaBaseUrl ?? process.env['OLLAMA_BASE_URL'] ?? undefined,
    lmstudioBaseUrl:
      settings.lmstudioBaseUrl ?? process.env['LM_STUDIO_BASE_URL'] ?? undefined,
  };
}

export interface LoadConfigOptions {
  cwd?: string;
  overrides?: Partial<CodSettings>;
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<CodSettings> {
  const cwd = options.cwd ?? process.cwd();

  const [globalRaw, projectRaw] = await Promise.all([
    loadJsonFile(getGlobalConfigPath()),
    loadJsonFile(getProjectConfigPath(cwd)),
  ]);

  const merged = {
    ...DEFAULTS,
    ...globalRaw,
    ...projectRaw,
    ...(options.overrides ?? {}),
    apiKeys: {
      ...(typeof globalRaw['apiKeys'] === 'object' && globalRaw['apiKeys'] !== null
        ? (globalRaw['apiKeys'] as Record<string, string>)
        : {}),
      ...(typeof projectRaw['apiKeys'] === 'object' && projectRaw['apiKeys'] !== null
        ? (projectRaw['apiKeys'] as Record<string, string>)
        : {}),
      ...(options.overrides?.apiKeys ?? {}),
    },
    mcpServers: {
      ...(typeof globalRaw['mcpServers'] === 'object' && globalRaw['mcpServers'] !== null
        ? (globalRaw['mcpServers'] as Record<string, unknown>)
        : {}),
      ...(typeof projectRaw['mcpServers'] === 'object' && projectRaw['mcpServers'] !== null
        ? (projectRaw['mcpServers'] as Record<string, unknown>)
        : {}),
      ...(options.overrides?.mcpServers ?? {}),
    },
  };

  const parsed = CodSettingsSchema.parse(merged);
  return resolveApiKeys(parsed);
}

export async function saveGlobalConfig(settings: Partial<CodSettings>): Promise<void> {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { getGlobalConfigDir } = await import('./paths.js');
  const dir = getGlobalConfigDir();
  await mkdir(dir, { recursive: true });
  const existing = await loadJsonFile(getGlobalConfigPath());
  const merged = { ...existing, ...settings };
  await writeFile(getGlobalConfigPath(), JSON.stringify(merged, null, 2), 'utf8');
}
