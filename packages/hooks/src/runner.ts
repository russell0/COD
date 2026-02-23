import { execa } from 'execa';
import type { HookEvent, HookDecision, HookOutput } from '@cod/types';
import type { HooksConfig, HookConfig } from '@cod/config';

export class HookRunner {
  private config: HooksConfig;

  constructor(config: HooksConfig) {
    this.config = config;
  }

  async runPreToolUse(toolName: string, input: unknown, workingDirectory: string): Promise<HookDecision> {
    const hooks = this.config.preToolUse?.[toolName] ?? this.config.preToolUse?.['*'] ?? [];
    if (hooks.length === 0) return { type: 'allow' };

    const event: HookEvent = {
      type: 'preToolUse',
      call: { id: '', name: toolName, input },
      workingDirectory,
    };

    return this.runHooks(hooks, event);
  }

  async runPostToolUse(
    toolName: string,
    input: unknown,
    result: unknown,
    workingDirectory: string,
  ): Promise<HookDecision> {
    const hooks = this.config.postToolUse?.[toolName] ?? this.config.postToolUse?.['*'] ?? [];
    if (hooks.length === 0) return { type: 'allow' };

    const event: HookEvent = {
      type: 'postToolUse',
      call: { id: '', name: toolName, input },
      result: result as import('@cod/types').ToolResult,
      workingDirectory,
    };

    return this.runHooks(hooks, event);
  }

  async runSubagentStart(taskId: string, description: string): Promise<HookDecision> {
    const hooks = this.config.subagentStart ?? [];
    if (hooks.length === 0) return { type: 'allow' };

    const event: HookEvent = { type: 'subagentStart', taskId, description };
    return this.runHooks(hooks, event);
  }

  async runStop(sessionId: string): Promise<void> {
    const hooks = this.config.stop ?? [];
    if (hooks.length === 0) return;

    const event: HookEvent = { type: 'stop', sessionId };
    await this.runHooks(hooks, event);
  }

  private async runHooks(hooks: HookConfig[], event: HookEvent): Promise<HookDecision> {
    for (const hook of hooks) {
      const decision = await this.runSingleHook(hook, event);
      if (decision.type !== 'allow') return decision;
    }
    return { type: 'allow' };
  }

  private async runSingleHook(hook: HookConfig, event: HookEvent): Promise<HookDecision> {
    const timeout = hook.timeout ?? 30000;

    try {
      const result = await execa('bash', ['-c', hook.command], {
        input: JSON.stringify(event),
        timeout,
        reject: false,
      });

      if (result.exitCode !== 0) {
        return {
          type: 'deny',
          reason: result.stderr || `Hook exited with code ${result.exitCode}`,
        };
      }

      const stdout = result.stdout?.trim();
      if (stdout) {
        try {
          const output = JSON.parse(stdout) as HookOutput;
          if (output.decision) return output.decision;
        } catch {
          // Non-JSON output — treat as allow
        }
      }

      return { type: 'allow' };
    } catch (err) {
      console.error(`Hook execution error: ${err instanceof Error ? err.message : err}`);
      return { type: 'allow' };
    }
  }
}
