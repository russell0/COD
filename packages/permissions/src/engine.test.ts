import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionEngine } from './engine.js';
import { PermissionMode } from '@cod/types';

const makeRequest = (overrides = {}) => ({
  toolName: 'Bash',
  input: { command: 'ls' },
  description: 'List files',
  isDestructive: false,
  isReadOnly: false,
  requiresShell: true,
  ...overrides,
});

describe('PermissionEngine', () => {
  describe('BypassPermissions mode', () => {
    it('allows everything', async () => {
      const engine = new PermissionEngine(PermissionMode.BypassPermissions);
      expect(await engine.check(makeRequest())).toBe(true);
      expect(await engine.check(makeRequest({ isDestructive: true }))).toBe(true);
    });
  });

  describe('DontAsk mode', () => {
    it('allows all non-blocked tools', async () => {
      const engine = new PermissionEngine(PermissionMode.DontAsk);
      expect(await engine.check(makeRequest())).toBe(true);
    });

    it('blocks blocked commands', async () => {
      const engine = new PermissionEngine(PermissionMode.DontAsk, ['rm -rf']);
      expect(await engine.check(makeRequest({ input: { command: 'rm -rf /' } }))).toBe(false);
    });
  });

  describe('Plan mode', () => {
    it('allows read-only operations', async () => {
      const engine = new PermissionEngine(PermissionMode.Plan);
      expect(await engine.check(makeRequest({ isReadOnly: true, requiresShell: false }))).toBe(true);
    });

    it('blocks non-read-only operations', async () => {
      const engine = new PermissionEngine(PermissionMode.Plan);
      expect(await engine.check(makeRequest({ isReadOnly: false }))).toBe(false);
    });
  });

  describe('AcceptEdits mode', () => {
    it('allows read-only tools', async () => {
      const engine = new PermissionEngine(PermissionMode.AcceptEdits);
      expect(await engine.check(makeRequest({ isReadOnly: true, requiresShell: false }))).toBe(true);
    });

    it('allows file edits without prompting', async () => {
      const engine = new PermissionEngine(PermissionMode.AcceptEdits);
      expect(
        await engine.check(makeRequest({ isReadOnly: false, requiresShell: false, isDestructive: false })),
      ).toBe(true);
    });

    it('denies shell commands when no callback', async () => {
      const engine = new PermissionEngine(PermissionMode.AcceptEdits);
      expect(await engine.check(makeRequest({ requiresShell: true }))).toBe(false);
    });

    it('prompts for shell commands via callback', async () => {
      const engine = new PermissionEngine(PermissionMode.AcceptEdits, [], async () => ({ type: 'allow' }));
      expect(await engine.check(makeRequest({ requiresShell: true }))).toBe(true);
    });
  });

  describe('Default mode', () => {
    it('allows read-only tools without prompting', async () => {
      const engine = new PermissionEngine(PermissionMode.Default);
      expect(await engine.check(makeRequest({ isReadOnly: true }))).toBe(true);
    });

    it('denies shell commands when no callback is set', async () => {
      const engine = new PermissionEngine(PermissionMode.Default);
      expect(await engine.check(makeRequest({ isReadOnly: false }))).toBe(false);
    });

    it('remembers allow-for-session decisions', async () => {
      let callCount = 0;
      const engine = new PermissionEngine(PermissionMode.Default, [], async () => {
        callCount++;
        return { type: 'allow', rememberForSession: true };
      });

      expect(await engine.check(makeRequest())).toBe(true);
      expect(await engine.check(makeRequest())).toBe(true);
      // Only prompted once since it was remembered
      expect(callCount).toBe(1);
    });

    it('remembers allow_always decisions', async () => {
      let callCount = 0;
      const engine = new PermissionEngine(PermissionMode.Default, [], async () => {
        callCount++;
        return { type: 'allow_always' };
      });

      await engine.check(makeRequest());
      await engine.check(makeRequest());
      expect(callCount).toBe(1);
    });
  });
});
