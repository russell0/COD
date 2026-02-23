export enum PermissionMode {
  Default = 'default',
  AcceptEdits = 'acceptEdits',
  Plan = 'plan',
  DontAsk = 'dontAsk',
  BypassPermissions = 'bypassPermissions',
}

export interface PermissionRequest {
  toolName: string;
  input: unknown;
  description: string;
  isDestructive: boolean;
  isReadOnly: boolean;
  requiresShell: boolean;
}

export type PermissionDecision =
  | { type: 'allow'; rememberForSession?: boolean }
  | { type: 'deny'; reason?: string }
  | { type: 'allow_always' };

export interface PermissionContext {
  mode: PermissionMode;
  sessionAllowList: Set<string>;
  blockedCommands: string[];
}
