import { execa } from 'execa';

/**
 * Inject git context (branch + status) into system prompt.
 */
export async function getGitContext(cwd: string): Promise<string | null> {
  try {
    const [branchResult, statusResult] = await Promise.allSettled([
      execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, reject: false }),
      execa('git', ['status', '--short'], { cwd, reject: false }),
    ]);

    const branch =
      branchResult.status === 'fulfilled' && branchResult.value.exitCode === 0
        ? branchResult.value.stdout.trim()
        : null;

    const status =
      statusResult.status === 'fulfilled' && statusResult.value.exitCode === 0
        ? statusResult.value.stdout.trim()
        : null;

    if (!branch) return null;

    const lines = [`Git branch: ${branch}`];
    if (status) {
      lines.push(`Git status:\n${status}`);
    }

    return lines.join('\n');
  } catch {
    return null;
  }
}
