import { PermissionMode, type PermissionRequest, type PermissionDecision } from '@cod/types';

export class PermissionEngine {
  private mode: PermissionMode;
  private sessionAllowList = new Set<string>();
  private blockedCommands: string[];
  private promptCallback: ((request: PermissionRequest) => Promise<PermissionDecision>) | null;

  constructor(
    mode: PermissionMode,
    blockedCommands: string[] = [],
    promptCallback?: (request: PermissionRequest) => Promise<PermissionDecision>,
  ) {
    this.mode = mode;
    this.blockedCommands = blockedCommands;
    this.promptCallback = promptCallback ?? null;
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  getMode(): PermissionMode {
    return this.mode;
  }

  setPromptCallback(cb: (request: PermissionRequest) => Promise<PermissionDecision>): void {
    this.promptCallback = cb;
  }

  /**
   * Check if a tool call is allowed.
   * Returns true if allowed, false if denied.
   * May prompt the user if needed.
   */
  async check(request: PermissionRequest): Promise<boolean> {
    // Check blocked commands first (regardless of mode)
    if (request.requiresShell && this.isBlockedCommand(request.input)) {
      return false;
    }

    switch (this.mode) {
      case PermissionMode.BypassPermissions:
        return true;

      case PermissionMode.DontAsk:
        // Allow everything that isn't blocked by the blocked list
        return true;

      case PermissionMode.AcceptEdits:
        // Allow read-only and file edits, prompt for shell/destructive
        if (request.isReadOnly) return true;
        if (!request.requiresShell && !request.isDestructive) return true;
        return this.promptUser(request);

      case PermissionMode.Plan:
        // Only allow read-only operations
        if (request.isReadOnly) return true;
        return false;

      case PermissionMode.Default:
      default:
        // Read-only tools never need permission
        if (request.isReadOnly) return true;
        // Check session allow list
        const key = this.allowListKey(request);
        if (this.sessionAllowList.has(key)) return true;
        // Prompt for everything else
        return this.promptUser(request);
    }
  }

  private async promptUser(request: PermissionRequest): Promise<boolean> {
    if (!this.promptCallback) {
      // No callback: default deny for safety
      return false;
    }

    const decision = await this.promptCallback(request);

    switch (decision.type) {
      case 'allow':
        if (decision.rememberForSession) {
          this.sessionAllowList.add(this.allowListKey(request));
        }
        return true;
      case 'allow_always':
        this.sessionAllowList.add(this.allowListKey(request));
        return true;
      case 'deny':
        return false;
    }
  }

  private allowListKey(request: PermissionRequest): string {
    return `${request.toolName}`;
  }

  private isBlockedCommand(input: unknown): boolean {
    if (typeof input !== 'object' || input === null) return false;
    const cmd = (input as Record<string, unknown>)['command'];
    if (typeof cmd !== 'string') return false;

    for (const blocked of this.blockedCommands) {
      if (cmd.includes(blocked) || cmd.startsWith(blocked)) {
        return true;
      }
    }
    return false;
  }

  allowForSession(toolName: string): void {
    this.sessionAllowList.add(toolName);
  }

  clearSessionAllowList(): void {
    this.sessionAllowList.clear();
  }
}
