import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EditTool, MultiEditTool } from './edit.js';

const context = (dir: string) => ({
  workingDirectory: dir,
  sessionId: 'test',
  signal: undefined,
});

describe('EditTool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'cod-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('replaces unique string', async () => {
    const file = join(tmpDir, 'test.ts');
    await writeFile(file, 'const x = 1;\nconst y = 2;\n');
    const result = await EditTool.execute(
      { file_path: file, old_string: 'const x = 1;', new_string: 'const x = 42;', replace_all: false },
      context(tmpDir),
    );
    expect(result.type).toBe('text');
    const content = await readFile(file, 'utf8');
    expect(content).toContain('const x = 42;');
    expect(content).toContain('const y = 2;');
  });

  it('errors on missing string', async () => {
    const file = join(tmpDir, 'test.ts');
    await writeFile(file, 'hello world');
    const result = await EditTool.execute(
      { file_path: file, old_string: 'not found', new_string: 'replacement', replace_all: false },
      context(tmpDir),
    );
    expect(result.type).toBe('error');
  });

  it('errors on non-unique string without replace_all', async () => {
    const file = join(tmpDir, 'test.ts');
    await writeFile(file, 'foo\nfoo\nbar\n');
    const result = await EditTool.execute(
      { file_path: file, old_string: 'foo', new_string: 'baz', replace_all: false },
      context(tmpDir),
    );
    expect(result.type).toBe('error');
  });

  it('replaces all occurrences with replace_all', async () => {
    const file = join(tmpDir, 'test.ts');
    await writeFile(file, 'foo\nfoo\nbar\n');
    const result = await EditTool.execute(
      { file_path: file, old_string: 'foo', new_string: 'baz', replace_all: true },
      context(tmpDir),
    );
    expect(result.type).toBe('text');
    const content = await readFile(file, 'utf8');
    expect(content).toBe('baz\nbaz\nbar\n');
  });
});

describe('MultiEditTool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'cod-multi-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('applies multiple edits', async () => {
    const file = join(tmpDir, 'test.ts');
    await writeFile(file, 'const a = 1;\nconst b = 2;\nconst c = 3;\n');
    const result = await MultiEditTool.execute(
      {
        file_path: file,
        edits: [
          { old_string: 'const a = 1;', new_string: 'const a = 10;', replace_all: false },
          { old_string: 'const b = 2;', new_string: 'const b = 20;', replace_all: false },
        ],
      },
      context(tmpDir),
    );
    expect(result.type).toBe('text');
    const content = await readFile(file, 'utf8');
    expect(content).toContain('const a = 10;');
    expect(content).toContain('const b = 20;');
    expect(content).toContain('const c = 3;');
  });
});
