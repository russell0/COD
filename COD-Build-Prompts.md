# COD: Build Prompts for a Real AI Coding Agent

## How to Use This Document

These prompts are designed to be fed sequentially to Claude Code (or COD itself, once bootstrapped). Each phase builds on the previous one. **Do not skip phases** — the system prompt and agent loop are the heart of the product; the rest is plumbing.

Run each prompt as a separate Claude Code session from the root of your `cod/` monorepo. After each phase, commit your work before moving on.

---

## PHASE 0: Monorepo Scaffold

**Purpose:** Set up the workspace structure so every subsequent prompt has a place to land.

```
Initialize a pnpm workspace monorepo with Turborepo for an AI coding assistant
called "cod". Use TypeScript 5.x, ESM-only, Node.js >= 20.

Create this exact structure:

cod/
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── package.json (root — private, scripts: build, test, typecheck, lint)
├── packages/
│   ├── types/        → @cod/types
│   ├── config/       → @cod/config
│   ├── llm/          → @cod/llm
│   ├── tools/        → @cod/tools
│   ├── permissions/  → @cod/permissions
│   ├── hooks/        → @cod/hooks
│   ├── mcp/          → @cod/mcp
│   ├── memory/       → @cod/memory
│   ├── session/      → @cod/session
│   ├── agent/        → @cod/agent
│   └── tui/          → @cod/tui
└── apps/
    └── cli/          → cod (the published binary)

Each package gets:
- package.json with "type": "module", correct @cod/* peer/dev dependencies
- tsconfig.json extending the root tsconfig.base.json
- src/index.ts exporting a placeholder
- vitest.config.ts

turbo.json should define build, test, typecheck, lint tasks with proper
dependency ordering. The dependency graph is strictly acyclic:

@cod/types → @cod/config → @cod/llm, @cod/permissions, @cod/hooks,
@cod/mcp, @cod/memory, @cod/tools → @cod/session → @cod/agent → @cod/tui
→ apps/cli

Use tsup for building each package. The CLI app bundles all @cod/* packages
into a single dist/index.js with a #!/usr/bin/env node banner.

Do NOT install LLM SDKs yet — just set up the workspace structure and verify
`pnpm install` and `pnpm turbo build` succeed with the placeholder exports.
```

---

## PHASE 1: The Type System (The Contract)

**Purpose:** Define every interface, type, and enum the system needs. This is the API contract — get it right and everything else falls into place.

```
Read the attached file COD-Program-Specification.pdf, specifically Section 5.1
(@cod/types). Implement the complete @cod/types package with these exact
exports. I'm listing every type — implement them ALL with full JSDoc comments:

## Core LLM Types

interface LLMAdapter {
  readonly providerId: string;
  stream(options: LLMRequestOptions): AsyncIterable<LLMStreamEvent>;
  countTokens(messages: Message[]): Promise<number>;
}

interface LLMRequestOptions {
  model: string;
  messages: Message[];
  systemPrompt: string;
  tools: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

// Message follows the Anthropic format as the canonical internal format:
interface Message {
  role: 'user' | 'assistant';
  content: ContentBlock[] | string;
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

type LLMStreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_input_delta'; id: string; delta: string }
  | { type: 'tool_use_complete'; id: string; name: string; input: unknown }
  | { type: 'message_complete'; usage: TokenUsage; stopReason: StopReason }
  | { type: 'error'; error: Error };

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'error';

## Agent Types

type AgentEvent =
  | { type: 'thinking_start' }
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call_start'; call: ToolCall }
  | { type: 'tool_call_permission_request'; call: ToolCall; request: PermissionRequest }
  | { type: 'tool_call_executing'; call: ToolCall }
  | { type: 'tool_call_complete'; call: ToolCall; result: ToolResult; durationMs: number }
  | { type: 'tool_call_denied'; call: ToolCall; reason?: string }
  | { type: 'subagent_start'; taskId: string; description: string }
  | { type: 'subagent_complete'; taskId: string; result: string }
  | { type: 'turn_complete'; usage: TokenUsage; stopReason: StopReason }
  | { type: 'context_compressed'; before: number; after: number }
  | { type: 'error'; error: Error; fatal: boolean };

type AgentEventStream = AsyncGenerator<AgentEvent>;

type AgentStatus = 'idle' | 'thinking' | 'responding' | 'tool_executing'
  | 'waiting_permission' | 'error';

## Tool Types

interface ToolDefinition<TInput = unknown> {
  name: string;
  description: string;
  inputSchema: ZodTypeAny;  // from zod
  annotations?: {
    readOnly?: boolean;
    destructive?: boolean;
    requiresShell?: boolean;
    idempotent?: boolean;
  };
  execute(input: TInput, context: ToolExecutionContext): Promise<ToolResult>;
}

interface ToolExecutionContext {
  workingDirectory: string;
  signal: AbortSignal;
  log: (message: string) => void;
}

interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

interface ToolResult {
  type: 'text' | 'error';
  text: string;
}

## Permission Types

enum PermissionMode {
  Default = 'default',
  AcceptEdits = 'acceptEdits',
  Plan = 'plan',
  DontAsk = 'dontAsk',
  BypassPermissions = 'bypassPermissions',
}

interface PermissionRequest {
  toolName: string;
  toolInput: unknown;
  annotations: ToolDefinition['annotations'];
  mode: PermissionMode;
}

type PermissionDecision =
  | { type: 'allow'; rememberForSession?: boolean }
  | { type: 'deny'; reason?: string }
  | { type: 'allow_always' };

type PromptCallback = (request: PermissionRequest) => Promise<PermissionDecision>;

## Hook Types

interface HookConfig {
  command: string;
  timeout?: number;
}

interface HookEvent {
  type: 'preToolUse' | 'postToolUse' | 'subagentStart' | 'stop';
  call?: ToolCall;
  result?: ToolResult;
  workingDirectory: string;
}

type HookDecision =
  | { type: 'allow' }
  | { type: 'deny'; reason?: string }
  | { type: 'modify'; modifiedInput: unknown };

## Config Types

interface CodSettings {
  model: string;
  provider: 'anthropic' | 'openai' | 'gemini' | 'ollama';
  permissionMode: PermissionMode;
  maxTokens?: number;
  temperature?: number;
  autoCompact: boolean;
  compactThreshold: number;
  historySize: number;
  blockedCommands: string[];
  apiKeys: {
    anthropic?: string;
    openai?: string;
    gemini?: string;
  };
  ollamaBaseUrl: string;
  mcpServers: Record<string, MCPServerConfig>;
  hooks: HooksConfig;
}

interface MCPServerConfig {
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

interface HooksConfig {
  preToolUse?: Record<string, HookConfig[]>;
  postToolUse?: Record<string, HookConfig[]>;
  subagentStart?: HookConfig[];
  stop?: HookConfig[];
}

Export everything from src/index.ts. Every type should have JSDoc comments
explaining its purpose. Run `pnpm turbo typecheck` to verify everything compiles.
```

---

## PHASE 2: Configuration and Memory

```
Implement two packages: @cod/config and @cod/memory.

## @cod/config

Create a Zod schema (CodSettingsSchema) that validates the full CodSettings
interface from @cod/types. Implement:

1. loadConfig(options?: { cliOverrides?: Partial<CodSettings> }): CodSettings
   - Merges sources in priority order:
     Built-in defaults → ~/.cod/config.json → .cod/config.json → env vars → CLI flags
   - Use Zod .default() for built-in defaults
   - Defaults: model="claude-sonnet-4-6", provider="anthropic",
     permissionMode="default", autoCompact=true, compactThreshold=0.85,
     historySize=1000, ollamaBaseUrl="http://localhost:11434/v1"

2. resolveApiKey(provider: string, settings: CodSettings): string | undefined
   - Check settings.apiKeys[provider] first
   - Then check env vars: ANTHROPIC_API_KEY, OPENAI_API_KEY,
     GEMINI_API_KEY / GOOGLE_API_KEY, OLLAMA_BASE_URL

3. Path helpers:
   - getCodDir(): string → ~/.cod/
   - getProjectCodDir(): string → .cod/ (relative to cwd)
   - getGlobalConfigPath(): string
   - getProjectConfigPath(): string
   - getHistoryPath(): string
   - ensureCodDir(): void → create ~/.cod/ if missing

Write tests for: schema validation, default merging, env var resolution,
missing config files (should not throw), CLI override priority.

## @cod/memory

Implement the system prompt builder:

1. loadMemory(workingDirectory: string): Promise<MemoryContext>
   Returns: { globalMemory?: string; projectMemory?: string; gitContext?: string }

   - Global memory: read ~/.cod/MEMORY.md if it exists
   - Project memory: read COD.md (preferred) or CLAUDE.md (fallback) from
     workingDirectory
   - Resolve @-imports: lines matching /^@(.+\.md)$/ are replaced with
     the contents of that file (path relative to the memory file's directory)
   - Git context: run `git branch --show-current` and
     `git status --short` in workingDirectory (catch errors for non-git dirs)

2. buildSystemPrompt(memory: MemoryContext): string
   This is THE MOST CRITICAL FUNCTION IN THE ENTIRE PROJECT.
   The system prompt is what turns a dumb LLM API call into a coding agent.

   Assemble the system prompt from these sections:

   === BEGIN SYSTEM PROMPT TEMPLATE ===

   You are COD, an expert AI coding assistant running as a CLI tool in the
   user's terminal. You have direct access to their filesystem and can
   execute shell commands.

   ## Your Core Capabilities
   - Read, write, and edit files in the user's project
   - Execute shell commands (bash)
   - Search files with glob patterns and regex
   - Fetch web URLs for documentation
   - Spawn subtasks for parallel work
   - Track todos for complex multi-step work

   ## How You Work
   You operate in an agentic loop. When the user gives you a task:
   1. Understand the full scope of what's needed
   2. Read relevant files to understand the codebase
   3. Plan your approach (for complex tasks, use TodoWrite to track steps)
   4. Execute changes incrementally, verifying as you go
   5. Run tests or linters if available to verify your work
   6. Report what you did and any issues found

   ## Critical Rules

   ### File Editing
   - ALWAYS read a file before editing it. Never edit blind.
   - Use the Edit tool for surgical changes (preferred) — it requires an
     exact unique string match, which prevents you from accidentally
     modifying the wrong part of a file.
   - Use Write only for new files or complete rewrites.
   - Use MultiEdit when you need multiple changes to the same file — this
     is atomic and more efficient than multiple Edit calls.

   ### Shell Commands
   - Be mindful of the user's OS and shell environment.
   - Prefer non-destructive commands. Never run rm -rf / or equivalent.
   - For long-running processes, set appropriate timeouts.
   - If a command fails, read the error output carefully before retrying.

   ### Code Quality
   - Match the existing code style of the project (indentation, naming
     conventions, import style).
   - When making changes, keep them minimal and focused. Don't refactor
     unrelated code unless asked.
   - If the project has a linter or formatter config, respect it.
   - Write tests when adding new functionality, unless told otherwise.

   ### Communication
   - Be concise. Don't narrate what you're about to do — just do it.
   - When you encounter ambiguity, make a reasonable choice and note it
     rather than asking for clarification (unless the ambiguity could lead
     to data loss or is fundamental to the task).
   - After completing a task, give a brief summary of what changed.
   - If you hit an error you can't resolve, explain what you tried and
     suggest next steps.

   ### Context Awareness
   - Pay attention to the project's tech stack, package manager, and
     conventions from the project memory below.
   - Check for existing patterns before introducing new ones.
   - Respect .gitignore — don't create files in ignored directories.

   ### Safety
   - Never commit changes to git unless explicitly asked.
   - Never push to remote repositories unless explicitly asked.
   - Never expose secrets, API keys, or credentials in file contents.
   - If asked to do something destructive, confirm with the user first.

   <global_memory>
   {globalMemory content, or omit this block if none}
   </global_memory>

   <project_memory>
   {projectMemory content, or omit this block if none}
   </project_memory>

   <git_context>
   Branch: {branch}
   Status:
   {git status output}
   </git_context>

   === END SYSTEM PROMPT TEMPLATE ===

   IMPORTANT: The system prompt above is the difference between a toy and a
   real coding agent. The instructions about reading before editing, using
   Edit for surgical changes, matching code style, being concise — these are
   learned from thousands of hours of real usage. Do not simplify them.

Write tests for: memory loading with @-imports, missing files, git context
extraction, system prompt assembly with all combinations of present/absent
memory sections.
```

---

## PHASE 3: The LLM Adapters (Making the AI Talk)

```
Implement @cod/llm with four provider adapters that all emit identical
LLMStreamEvent sequences. This is the package that actually calls the AI.

Install the SDKs:
- @anthropic-ai/sdk (^0.26.0)
- openai (^4.52.0)
- @google/generative-ai (^0.15.0)

## LLMRegistry

class LLMRegistry {
  private adapters = new Map<string, LLMAdapter>();

  register(adapter: LLMAdapter): void;
  get(providerId: string): LLMAdapter | undefined;
  listProviders(): string[];

  static createFromConfig(settings: CodSettings): {
    registry: LLMRegistry;
    adapter: LLMAdapter;  // the active adapter for settings.provider
  };
}

createFromConfig should:
- Only register adapters whose API keys are present
- Always register OllamaAdapter (no key required)
- Throw a clear error if the requested provider has no API key
- Return the active adapter matching settings.provider

## AnthropicAdapter

Use @anthropic-ai/sdk. This is the reference adapter — get it perfect.

Key implementation details:
- Use client.messages.stream() for streaming
- Map Anthropic's SSE events to LLMStreamEvent:
  - 'content_block_start' with type 'text' → nothing (wait for deltas)
  - 'content_block_delta' with type 'text_delta' → { type: 'text_delta', delta }
  - 'content_block_start' with type 'tool_use' → { type: 'tool_use_start', id, name }
  - 'content_block_delta' with type 'input_json_delta' → { type: 'tool_use_input_delta', id, delta }
  - 'content_block_stop' for tool_use → parse accumulated JSON, emit
    { type: 'tool_use_complete', id, name, input }
  - 'message_stop' → { type: 'message_complete', usage, stopReason }

CRITICAL BUG TO AVOID (from spec v1.1 known issues):
- Do NOT emit message_complete from BOTH 'message_delta' and 'message_stop'.
  Use ONLY 'message_stop' as the trigger. Track whether you've already
  emitted it with a boolean flag.

- Track content block indices to correctly associate input_json_delta
  events with their tool_use block (multiple tool calls can be in flight).
- Accumulate JSON input deltas per tool call ID, parse on block_stop.
- Convert tool definitions to Anthropic format: { name, description,
  input_schema: zodToJsonSchema(tool.inputSchema) }
- Convert Anthropic's stop_reason to our StopReason enum.
- Wrap everything in try/catch — emit { type: 'error' } on failure,
  never throw from the async iterable.
- Support AbortSignal — pass it to the SDK.

For countTokens: use client.messages.countTokens() if available,
otherwise estimate at 4 chars per token.

## OpenAIAdapter

Use the openai npm package with stream: true.

Key differences from Anthropic:
- OpenAI uses role: 'system' for system prompts (not a separate param)
- Tool calls stream via delta.tool_calls array with index-based accumulation
- CRITICAL BUG TO AVOID: Use the actual tool_call.id from the delta,
  NOT the array index. OpenAI's streaming sends tool call deltas with
  index fields — you need to track by index but emit the real ID.

Message format translation:
- Our internal format uses Anthropic-style messages (user/assistant with
  content blocks). Convert to OpenAI format:
  - tool_use content blocks → assistant message with tool_calls array
  - tool_result content blocks → messages with role: 'tool'

- Convert tool definitions to OpenAI format:
  { type: 'function', function: { name, description, parameters: jsonSchema } }

## GeminiAdapter

Use @google/generative-ai with sendMessageStream.

Key differences:
- Gemini uses a different message format (parts-based)
- Tool use is called "function calling" in Gemini
- Convert our messages to Gemini's Content[] format
- Convert Gemini's FunctionCall/FunctionResponse to our event types
- Gemini doesn't stream tool call inputs character by character — emit
  tool_use_start and tool_use_complete back-to-back when a function call
  is in the response.

## OllamaAdapter

Delegate to OpenAIAdapter entirely. Ollama exposes an OpenAI-compatible
API at /v1. Create an OpenAIAdapter with:
- baseURL: settings.ollamaBaseUrl (default: http://localhost:11434/v1)
- apiKey: 'ollama' (dummy value, Ollama ignores it)

## Testing

For EACH adapter, create tests using MSW (Mock Service Worker) that:
1. Mock the provider's SSE/streaming endpoint
2. Replay recorded response fixtures for:
   - Text-only response
   - Single tool call response
   - Multiple tool calls in one response
   - Error response (API error, rate limit)
   - AbortSignal cancellation
3. Assert the adapter produces the EXACT same LLMStreamEvent sequence
   regardless of provider

Create a shared test helper: assertEventSequence(events, expected) that
compares event types and key fields.

The adapter tests are your integration contract — if these pass, the rest
of the system works with any provider.
```

---

## PHASE 4: The Tool Suite (Hands and Eyes)

```
Implement @cod/tools — the eleven built-in tools that let the agent
interact with the filesystem, shell, and web. These are the agent's
hands and eyes. Without good tools, the smartest LLM is useless.

## ToolRegistry

class ToolRegistry {
  register(tool: ToolDefinition): void;
  get(name: string): ToolDefinition | undefined;
  getAll(): ToolDefinition[];
  toProviderFormat(): object[];  // for passing to LLM API
}

## Tool Implementations

For EACH tool, implement:
1. A Zod input schema (not just TypeScript types — runtime validation)
2. The execute() function
3. Proper annotations (readOnly, destructive, requiresShell)
4. A clear, concise description that helps the LLM use it correctly

### Read Tool
- annotations: { readOnly: true }
- Read file contents with line numbers prepended (important for Edit tool)
- Support offset (1-indexed start line) and limit (max lines)
- Return error result for non-existent files (don't throw)
- Cap output at ~100KB to avoid flooding context
- description: "Read file contents. Returns numbered lines. Use offset
  and limit to read specific sections of large files."

### Glob Tool
- annotations: { readOnly: true }
- Use fast-glob or similar for pattern matching
- Return paths sorted by modification time (newest first)
- Respect .gitignore patterns (use ignore option)
- Cap results at 200 files, note if truncated
- description: "Find files matching a glob pattern. Results sorted by
  modification time (newest first). Respects .gitignore."

### Grep Tool
- annotations: { readOnly: true }
- Three output modes: "content" (matching lines with context),
  "files_with_matches" (just filenames), "count" (match counts per file)
- Support case_insensitive flag
- Support context lines (before/after)
- Support head_limit to cap results
- Use Node.js built-in for now (v1.2 will add ripgrep)
- description: "Search file contents with regex. Use output_mode
  'files_with_matches' to find which files match, 'content' to see
  matching lines with context."

### Write Tool
- annotations: { destructive: true }
- Create parent directories with fs.mkdir(recursive: true)
- Write full file contents
- Return the number of bytes written
- description: "Write content to a file. Creates parent directories if
  needed. Use for new files or complete rewrites. For surgical edits to
  existing files, prefer the Edit tool."

### Edit Tool (CRITICAL — this is the most-used tool)
- annotations: { destructive: false }  // it's a modification, not full destructive
- The LLM provides old_string (exact text to find) and new_string
  (replacement)
- MUST validate that old_string appears EXACTLY ONCE in the file
  (unless replace_all: true)
- If old_string is not found → return error with helpful message
  ("String not found. Did you read the file first?")
- If old_string appears more than once → return error with count
  ("Found 3 occurrences. Provide more surrounding context to make the
  match unique, or use replace_all: true.")
- On success, return a unified diff showing the change
- description: "Replace exact text in a file. The old_string must match
  exactly one location in the file (case-sensitive, whitespace-sensitive).
  Always Read the file first. Returns a diff of the change."

### MultiEdit Tool
- annotations: { destructive: false }
- Apply multiple {old_string, new_string} edits to a single file ATOMICALLY
- Read the file once, apply all edits sequentially, write once
- If ANY edit fails (no match or ambiguous match), NONE are applied
- Return a combined diff
- description: "Apply multiple edits to a single file atomically. If any
  edit fails, none are applied. More efficient than multiple Edit calls."

### Bash Tool (CRITICAL — this is the second-most-used tool)
- annotations: { requiresShell: true, destructive: true }
- Use execa to execute commands with:
  - Configurable timeout (default 120s)
  - AbortSignal support (passed from agent)
  - Combined stdout + stderr capture
  - Non-zero exit codes are NOT errors — return the output with the
    exit code so the LLM can interpret failures
- Cap output at ~100KB, truncate with "[output truncated]" message
- description: "Execute a shell command. Returns stdout, stderr, and
  exit code. Non-zero exit is not necessarily an error — read the output."

### WebFetch Tool
- annotations: { readOnly: true }
- Fetch URL with native fetch()
- Convert HTML to readable text (use @mozilla/readability or turndown
  for HTML → markdown conversion)
- Support max_length to truncate
- Support optional prompt parameter (hint for what to extract — passed
  to the LLM as context, not used in fetch)
- Set a reasonable User-Agent header
- Handle errors gracefully (HTTP errors, timeouts, invalid URLs)
- description: "Fetch a URL and return its contents as readable text.
  HTML is converted to markdown. Use for documentation, error lookups, etc."

### Task Tool (Subagent)
- annotations: { readOnly: false }
- This tool doesn't directly do anything — it returns a description that
  the agent orchestrator intercepts to spawn a subagent
- The execute() just returns the prompt as text; the actual subagent
  spawning happens in @cod/agent
- description: "Spawn a subtask with its own context. Use for
  self-contained work that doesn't need the main conversation history.
  The subtask has access to all tools but a fresh context window."

### TodoWrite + TodoRead
- annotations: { readOnly: false / true respectively }
- In-memory todo list scoped to the session
- TodoWrite: accept full todo list array, replace in memory
- TodoRead: return current list
- These help the agent track multi-step tasks
- Store state in the ToolExecutionContext or a module-level Map

## Testing

Test each tool with REAL filesystem operations in temp directories:
- Use fs.mkdtemp() for isolated test directories
- Clean up after each test
- Test the happy path AND every error path
- For Edit: test unique match, no match, multiple matches, replace_all
- For Bash: test success, failure, timeout, abort
- For WebFetch: mock HTTP responses with MSW

The tool suite is the agent's interface to the real world. If the error
messages are bad, the agent will flail. Make error messages specific and
actionable — they're instructions to the LLM, not to a human.
```

---

## PHASE 5: Permission Engine and Hook System

```
Implement @cod/permissions and @cod/hooks.

## @cod/permissions

class PermissionEngine {
  constructor(settings: CodSettings);

  async check(
    toolDef: ToolDefinition,
    toolInput: unknown,
    promptCallback?: PromptCallback
  ): Promise<PermissionDecision>;

  setMode(mode: PermissionMode): void;
  getMode(): PermissionMode;
  addToSessionAllowList(toolName: string): void;
  clearSessionAllowList(): void;
}

Decision flow (in order):

1. BLOCKED COMMAND CHECK
   If tool has requiresShell: true, check the input command against
   settings.blockedCommands patterns. Use simple string includes matching
   (not regex — keep it predictable). If matched → immediate deny.

2. MODE-SPECIFIC POLICY (implement this exact matrix):

   | Tool Annotation  | bypass | dontAsk | acceptEdits | default | plan |
   |-----------------|--------|---------|-------------|---------|------|
   | readOnly: true  | allow  | allow   | allow       | allow   | allow|
   | destructive     | allow  | allow   | allow       | prompt  | deny |
   | requiresShell   | allow  | allow*  | prompt      | prompt  | deny |
   | else (edits)    | allow  | allow   | allow       | prompt  | deny |

   *dontAsk + requiresShell: allow UNLESS it's in blockedCommands

3. SESSION ALLOW LIST
   If we'd need to prompt, but this tool name is in the session allow list,
   skip the prompt → allow.

4. PROMPT CALLBACK
   If a prompt callback is registered, invoke it and return its decision.
   If the decision includes rememberForSession, add to the allow list.
   If it's allow_always, add to allow list.

5. DEFAULT DENY
   If no callback is registered and we'd need a prompt → deny.
   This makes non-interactive mode safe by default.

## @cod/hooks

class HookRunner {
  constructor(settings: CodSettings);

  async runPreToolUse(call: ToolCall, cwd: string): Promise<HookDecision>;
  async runPostToolUse(call: ToolCall, result: ToolResult, cwd: string): Promise<HookDecision>;
  async runSubagentStart(taskId: string, description: string, cwd: string): Promise<HookDecision>;
  async runStop(cwd: string): Promise<void>;
}

For each hook invocation:
1. Find matching hooks: check for hooks[eventType][toolName] AND
   hooks[eventType]["*"] (wildcard). Run tool-specific hooks first,
   then wildcard hooks.
2. For each matching hook config:
   a. Spawn the command with execa
   b. Write the event JSON to its stdin
   c. Wait for exit (with timeout from config, default 10000ms)
   d. Parse stdout as JSON if present
   e. If exit code != 0 → deny
   f. If stdout has { decision: { type: "deny" } } → deny
   g. If stdout has { decision: { type: "modify", modifiedInput } } → return modify
   h. Otherwise → allow
3. If the hook times out or crashes → LOG WARNING and allow (fail-open).
   Hooks are operator-facing infrastructure. A broken hook should not
   silently break the user experience.
4. If ANY hook denies, stop running remaining hooks and return deny.
5. If a hook modifies input, use modified input for subsequent hooks.

Testing:
- Permission engine: exhaustive tests for all 5 modes × all annotation
  combinations. Test session allow list. Test blocked commands.
- Hooks: test with real shell commands (echo, exit 1, etc.). Test timeout.
  Test JSON parsing. Test wildcard matching.
```

---

## PHASE 6: Session and Context Compression

```
Implement @cod/session — the conversation history manager with automatic
context compression.

## Session

class Session {
  private messages: Message[] = [];

  addUserMessage(text: string): void;
  addAssistantMessage(content: ContentBlock[]): void;
  addToolResults(results: Array<{ tool_use_id: string; content: string; is_error?: boolean }>): void;
  getMessages(): Message[];
  clear(): void;
  getMessageCount(): number;
}

Messages use the Anthropic format internally because it's the most
expressive (content blocks for mixed text + tool_use + tool_result).
The LLM adapters are responsible for converting to their native format.

## SlidingWindowCompressor

class SlidingWindowCompressor {
  constructor(
    private adapter: LLMAdapter,
    private settings: Pick<CodSettings, 'autoCompact' | 'compactThreshold' | 'model'>
  );

  async compressIfNeeded(
    session: Session,
    systemPrompt: string
  ): Promise<{ compressed: boolean; beforeTokens?: number; afterTokens?: number }>;
}

Implementation:
1. Get approximate context window size for the model:
   - claude-sonnet-4-6, claude-opus-4-6: 200000
   - gpt-4o: 128000
   - gpt-4-turbo: 128000
   - gemini-1.5-pro: 1000000
   - gemini-1.5-flash: 1000000
   - Default for unknown models: 128000

2. Count tokens: adapter.countTokens(messages) + estimate for system prompt

3. If count > compactThreshold × windowSize:
   a. Send ALL messages to the LLM with this summarization prompt:

   "Summarize this conversation concisely. Include:
   - Key decisions made
   - Files that were read, created, or modified
   - Current state of any in-progress tasks
   - Any errors encountered and their resolutions
   - Important context the user provided
   Format as a structured summary the assistant can use to continue working."

   b. Replace session messages with:
      [0] User message: "<context_summary>\n{summary}\n</context_summary>\n
           The above is a summary of our conversation so far."
      [1] Assistant: "Understood. I have the context from our previous
           discussion. How can I continue helping you?"
      [2..n] The last 10 actual messages (preserved verbatim)

4. Return compression stats so the agent can emit context_compressed event.

Testing:
- Message accumulation, ordering, clear
- Compression trigger at threshold
- Verify last 10 messages are preserved after compression
- Verify summary request format
```

---

## PHASE 7: The Agent Orchestrator (The Brain)

**This is the most important phase. The agent loop is what makes COD a coding agent vs. a chatbot.**

```
Implement @cod/agent — the orchestrator that binds everything together
into a coherent agentic loop.

## CodAgent

class CodAgent {
  constructor(options: {
    settings: CodSettings;
    llmAdapter: LLMAdapter;
    toolRegistry: ToolRegistry;
    permissionEngine: PermissionEngine;
    hookRunner: HookRunner;
    session: Session;
    compressor: SlidingWindowCompressor;
    memoryContext: MemoryContext;
    workingDirectory: string;
    promptCallback?: PromptCallback;
  });

  async initialize(): Promise<void>;
  run(userMessage: string): AsyncGenerator<AgentEvent>;
  abort(): void;
  getSession(): Session;
  getStatus(): AgentStatus;
}

## Initialization (called once before first run)

async initialize():
  1. Connect all configured MCP servers (MCPClientManager.connectAll())
  2. Register MCP tools in the tool registry with namespace prefix
  3. Build the system prompt from memory context
  4. Set initialized = true
  Note: initialize() is idempotent — second call is a no-op.

## The Agent Loop (the core algorithm)

async *run(userMessage: string): AsyncGenerator<AgentEvent> {
  // 1. Add user message to session
  this.session.addUserMessage(userMessage);

  // 2. Check context compression
  const compressResult = await this.compressor.compressIfNeeded(
    this.session, this.systemPrompt
  );
  if (compressResult.compressed) {
    yield { type: 'context_compressed',
            before: compressResult.beforeTokens!,
            after: compressResult.afterTokens! };
  }

  // 3. Agentic loop — continues until LLM says "done" or all tools denied
  yield { type: 'thinking_start' };

  while (true) {
    // 3a. Call the LLM
    const contentBlocks: ContentBlock[] = [];
    let stopReason: StopReason = 'end_turn';
    let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

    for await (const event of this.llmAdapter.stream({
      model: this.settings.model,
      messages: this.session.getMessages(),
      systemPrompt: this.systemPrompt,
      tools: this.toolRegistry.getAll(),
      maxTokens: this.settings.maxTokens,
      temperature: this.settings.temperature,
      signal: this.abortController.signal,
    })) {
      switch (event.type) {
        case 'text_delta':
          yield { type: 'text_delta', text: event.delta };
          break;
        case 'tool_use_start':
          yield { type: 'tool_call_start', call: { id: event.id, name: event.name, input: undefined } };
          break;
        case 'tool_use_complete':
          contentBlocks.push({ type: 'tool_use', id: event.id, name: event.name, input: event.input });
          break;
        case 'message_complete':
          usage = event.usage;
          stopReason = event.stopReason;
          // Also capture any accumulated text as a content block
          break;
        case 'error':
          yield { type: 'error', error: event.error, fatal: true };
          return;
      }
    }

    // Don't forget to capture text content blocks too
    // (accumulate text_delta into a text content block)

    // 3b. Add assistant message to session
    this.session.addAssistantMessage(contentBlocks);

    // 3c. If no tool calls, we're done
    if (stopReason !== 'tool_use') {
      yield { type: 'turn_complete', usage, stopReason };
      return;
    }

    // 3d. Execute each tool call
    const toolCalls = contentBlocks.filter(b => b.type === 'tool_use');
    const toolResults: Array<{ tool_use_id: string; content: string; is_error: boolean }> = [];
    let allDenied = true;

    for (const block of toolCalls) {
      const call: ToolCall = { id: block.id, name: block.name, input: block.input };
      const tool = this.toolRegistry.get(call.name);

      if (!tool) {
        toolResults.push({ tool_use_id: call.id, content: `Unknown tool: ${call.name}`, is_error: true });
        continue;
      }

      // Run pre-tool hook
      const hookDecision = await this.hookRunner.runPreToolUse(call, this.workingDirectory);
      if (hookDecision.type === 'deny') {
        yield { type: 'tool_call_denied', call, reason: hookDecision.reason };
        toolResults.push({ tool_use_id: call.id, content: `Denied by hook: ${hookDecision.reason || 'policy'}`, is_error: true });
        continue;
      }
      if (hookDecision.type === 'modify') {
        call.input = hookDecision.modifiedInput;
      }

      // Check permissions
      const permDecision = await this.permissionEngine.check(
        tool, call.input, this.promptCallback
      );
      if (permDecision.type === 'deny') {
        yield { type: 'tool_call_denied', call, reason: permDecision.reason };
        toolResults.push({ tool_use_id: call.id, content: `Denied by user: ${permDecision.reason || 'permission denied'}`, is_error: true });
        continue;
      }

      // Execute the tool
      allDenied = false;
      yield { type: 'tool_call_executing', call };
      const startTime = Date.now();

      try {
        // Special case: Task tool spawns a subagent
        if (call.name === 'Task') {
          const result = await this.spawnSubagent(call);
          const durationMs = Date.now() - startTime;
          yield { type: 'tool_call_complete', call, result, durationMs };
          toolResults.push({ tool_use_id: call.id, content: result.text, is_error: result.type === 'error' });
        } else {
          const result = await tool.execute(call.input, {
            workingDirectory: this.workingDirectory,
            signal: this.abortController.signal,
            log: (msg) => { /* hook into logging */ },
          });
          const durationMs = Date.now() - startTime;

          // Run post-tool hook
          await this.hookRunner.runPostToolUse(call, result, this.workingDirectory);

          yield { type: 'tool_call_complete', call, result, durationMs };
          toolResults.push({ tool_use_id: call.id, content: result.text, is_error: result.type === 'error' });
        }
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const result: ToolResult = { type: 'error', text: String(error) };
        yield { type: 'tool_call_complete', call, result, durationMs };
        toolResults.push({ tool_use_id: call.id, content: result.text, is_error: true });
      }
    }

    // 3e. Add tool results to session
    this.session.addToolResults(toolResults);

    // 3f. If all tool calls were denied, stop the loop
    // (otherwise we'd loop forever with the LLM trying the same tools)
    if (allDenied) {
      yield { type: 'turn_complete', usage, stopReason: 'end_turn' };
      return;
    }

    // 3g. Loop back — the LLM will see the tool results and decide next action
  }
}

## Subagent Spawning

async spawnSubagent(call: ToolCall): Promise<ToolResult> {
  const input = call.input as { description: string; prompt: string };
  const taskId = crypto.randomUUID();

  yield { type: 'subagent_start', taskId, description: input.description };
  // NOTE: yield won't work inside an async function, need to restructure
  // to emit events through a callback or event emitter. This is pseudocode.

  // Create a fresh agent with same settings but isolated session
  const subagent = new CodAgent({
    ...this.options,
    session: new Session(),
    promptCallback: undefined,  // subagents don't prompt — they run in dontAsk mode
  });
  subagent.permissionEngine.setMode(PermissionMode.DontAsk);

  await subagent.initialize();

  // Collect all text output from the subagent
  let output = '';
  for await (const event of subagent.run(input.prompt)) {
    if (event.type === 'text_delta') output += event.text;
  }

  yield { type: 'subagent_complete', taskId, result: output };

  return { type: 'text', text: output || 'Subtask completed with no text output.' };
}

## Abort Handling

abort(): void {
  this.abortController.abort();
  // Create a new controller so the agent can be reused
  this.abortController = new AbortController();
}

## IMPORTANT IMPLEMENTATION NOTES:

1. The agent loop MUST handle the case where the LLM makes multiple tool
   calls in a single response. All tool results are collected and sent
   back in one message.

2. Text content must be accumulated into a content block. Track a
   currentText string that gets appended on text_delta events, then
   push { type: 'text', text: currentText } to contentBlocks when
   the message completes.

3. The agent must handle the permission prompt being asynchronous —
   the entire loop suspends while waiting for the user's decision.
   This is handled naturally by the async generator pattern.

4. AbortSignal propagation: the same signal is passed to LLM.stream()
   and to tool.execute(). Aborting mid-stream should cleanly stop both.

5. Error handling: non-fatal errors (tool execution failure) should be
   reported as tool results so the LLM can recover. Fatal errors (LLM
   API failure) should yield an error event and return from the generator.

Write comprehensive tests using a MockLLMAdapter that returns scripted
event sequences. Test:
- Text-only response (no tools)
- Single tool call round-trip
- Multiple tool calls in one turn
- Multi-turn loop (tool use → more tool use → end_turn)
- Permission denial (tool call denied, loop terminates)
- Hook denial
- Context compression trigger
- Abort mid-stream
- Unknown tool name
- Tool execution error (caught, reported as tool result)
```

---

## PHASE 8: Terminal UI

```
Implement @cod/tui using Ink 5.x (React for terminals).

Install: ink, react, ink-text-input, ink-spinner

## Component Tree

<App>
  <StatusBar />       — top: provider, model, mode, tokens, cost
  <MessageList>
    <MessageBubble /> — one per turn
    <ToolCallBlock /> — one per tool invocation
  </MessageList>
  <PermissionPrompt /> — shown when permission needed (replaces InputBox)
  <InputBox />         — text input with history
</App>

## useAgent Hook (the most important hook)

function useAgent(options: {
  agent: CodAgent;
}): {
  status: AgentStatus;
  messages: MessageState[];
  toolCalls: ToolCallState[];
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  error: Error | null;
  pendingPermission: PermissionRequest | null;
  sendMessage: (text: string) => void;
  respondToPermission: (decision: PermissionDecision) => void;
  abort: () => void;
  clearMessages: () => void;
}

CRITICAL BUG TO AVOID (from spec v1.1):
When handling events in the async generator consumer, use functional
setState updates (setState(prev => ...)) to avoid stale closures.
Do NOT reference state variables directly in the event handler.

Implementation:
- sendMessage starts consuming agent.run(text) as an async generator
- Each AgentEvent updates the corresponding state
- The permission flow uses a Promise<PermissionDecision> that is held by
  the agent loop and resolved by respondToPermission()
- Wire the promptCallback to set pendingPermission state and return a
  promise that resolves when respondToPermission is called

## StatusBar
- Show: provider name | model name | permission mode | input/output tokens | est. cost
- Cost estimation: rough $/1K token rates per provider
- Use Ink's <Box> with flexDirection="row" and justifyContent="space-between"

## MessageBubble
- User messages: prefixed with "You: " in a distinct color
- Assistant messages: stream text character by character (append on text_delta)
- Use Ink's <Text> with color props

## ToolCallBlock
- Shows tool name, status indicator, and a collapsible preview
- States: pending → executing → complete/denied
- Show duration on complete
- Truncate long tool inputs/outputs to 5 lines with "..." indicator
- Use a dim color for completed tool calls

## PermissionPrompt
- Show what tool wants to run and its input
- For Bash: show the command prominently
- For Write/Edit: show the file path
- Options: [y] Allow  [n] Deny  [a] Allow for session  [A] Always allow
- Render as a distinct box with a warning color

## InputBox
- Multi-line text input
- Enter to submit, Shift+Enter for newlines
- Up/down arrow for history navigation
- Ctrl+C to abort current operation (if running) or exit (if idle)
- Ctrl+L to clear screen

## Slash Command Handler

Parse input for slash commands before sending to agent:
- /help → display command list
- /clear → clear messages
- /model [name] → show or switch model
- /mode [mode] → show or switch permission mode
- /memory <text> → append to COD.md
- /cost → show token usage breakdown
- /status → show agent status

Custom commands: scan .cod/commands/*.md and ~/.cod/commands/*.md.
Each file becomes /<filename> — inject its content as a user message.

## useHistory Hook
- Load/save from ~/.cod/history
- Line-delimited format
- Cap at settings.historySize entries
- Expose: entries, push(entry), navigateUp(), navigateDown(), resetPosition()
```

---

## PHASE 9: CLI Entry Point and MCP

```
Implement apps/cli and @cod/mcp.

## @cod/mcp — MCP Client Manager

class MCPClientManager {
  constructor(settings: CodSettings);

  async connectAll(): Promise<void>;
  async disconnectAll(): Promise<void>;
  getTools(): ToolDefinition[];
}

Use @modelcontextprotocol/sdk to:
1. Read MCP server configs from settings.mcpServers
2. Connect to each server in parallel (Promise.allSettled — individual
   failures don't block others)
3. For each connected server, call client.listTools()
4. Wrap each MCP tool as a ToolDefinition:
   - name: `${serverName}__${toolName}` (double underscore namespace)
   - description: from MCP tool description
   - inputSchema: z.record(z.unknown()) (passthrough — MCP tools aren't statically typed)
   - annotations: {} (no annotations for MCP tools — they go through permission like any other)
   - execute: calls client.callTool(toolName, input) on the connected server

Transport support:
- stdio: spawn process with execa, communicate over stdin/stdout
- sse: connect to HTTP SSE endpoint
- http: standard HTTP request/response

## apps/cli — The Published Binary

Use Commander.js 12.x for argument parsing.

### Command Structure

program
  .name('cod')
  .description('AI coding assistant')
  .version(packageJson.version)
  .argument('[prompt]', 'Optional prompt for one-shot or initial message')
  .option('-m, --model <model>', 'LLM model')
  .option('-p, --provider <provider>', 'LLM provider')
  .option('--mode <mode>', 'Permission mode')
  .option('--no-interactive', 'Non-interactive mode')
  .action(mainAction);

program.command('run <prompt>')
  .description('Run a prompt non-interactively')
  .action(runAction);

program.command('config')
  .command('get <key>').action(configGetAction);
  .command('set <key> <value>').action(configSetAction);

program.command('mcp')
  .command('list').action(mcpListAction);
  .command('add <name> <command>').action(mcpAddAction);
  .command('remove <name>').action(mcpRemoveAction);

program.command('update')
  .description('Self-update via npm')
  .action(updateAction);

### Bootstrap Sequence (mainAction)

async function mainAction(prompt?: string, options) {
  // 1. First-run setup
  ensureCodDir();

  // 2. Load config with CLI overrides
  const settings = loadConfig({ cliOverrides: {
    model: options.model,
    provider: options.provider,
    permissionMode: options.mode,
  }});

  // 3. Validate API key
  const apiKey = resolveApiKey(settings.provider, settings);
  if (!apiKey && settings.provider !== 'ollama') {
    console.error(MISSING_API_KEY_MESSAGE[settings.provider]);
    process.exit(1);
  }

  // 4. Create LLM adapter
  const { registry, adapter } = LLMRegistry.createFromConfig(settings);

  // 5. Create all subsystems
  const toolRegistry = new ToolRegistry();
  registerBuiltinTools(toolRegistry);

  const permissionEngine = new PermissionEngine(settings);
  const hookRunner = new HookRunner(settings);
  const session = new Session();
  const compressor = new SlidingWindowCompressor(adapter, settings);
  const memoryContext = await loadMemory(process.cwd());

  // 6. Create agent
  const agent = new CodAgent({
    settings, llmAdapter: adapter, toolRegistry,
    permissionEngine, hookRunner, session, compressor,
    memoryContext, workingDirectory: process.cwd(),
  });

  await agent.initialize();

  // 7. Launch UI or run non-interactively
  if (prompt && options.noInteractive) {
    // Non-interactive: consume agent.run() and print text output
    for await (const event of agent.run(prompt)) {
      if (event.type === 'text_delta') process.stdout.write(event.text);
    }
    process.stdout.write('\n');
  } else {
    // Interactive: render Ink TUI
    const { render } = await import('ink');
    render(<App agent={agent} initialPrompt={prompt} />);
  }
}

### Bundle Config (tsup.config.ts)

export default {
  entry: ['src/index.tsx'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  noExternal: [/@cod\//],  // Bundle all internal packages
  external: ['commander', 'ink', 'react', 'zod', 'execa',
    '@anthropic-ai/sdk', 'openai', '@google/generative-ai',
    '@modelcontextprotocol/sdk'],
  clean: true,
};

### First-Run Welcome Message

When ~/.cod/ doesn't exist, print:

  Welcome to COD — your AI coding assistant.

  To get started, set your API key:
    export ANTHROPIC_API_KEY=sk-ant-...   (for Claude)
    export OPENAI_API_KEY=sk-...          (for GPT-4)
    export GEMINI_API_KEY=AIza...         (for Gemini)

  Or configure it permanently:
    cod config set apiKeys.anthropic sk-ant-...

  Then run: cod "explain this codebase"

  Docs: https://github.com/your-org/cod
```

---

## PHASE 10: Testing, CI/CD, and Polish

```
Set up the testing infrastructure, CI/CD pipeline, and finish polish items.

## Testing Infrastructure

1. Ensure every package has co-located *.test.ts files
2. Root vitest.workspace.ts that runs all packages
3. Create shared test utilities in packages/test-utils/:
   - MockLLMAdapter: returns scripted LLMStreamEvent sequences
   - createTempDir(): creates and returns a temp directory + cleanup fn
   - assertEventSequence(): compares AgentEvent arrays by type and key fields

4. Coverage targets: 80% line, 75% branch, 85% function

## CI/CD (GitHub Actions)

### .github/workflows/ci.yml
Runs on: push to main, all PRs

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo typecheck
      - run: pnpm turbo build
      - run: pnpm turbo test -- --coverage
      - uses: codecov/codecov-action@v4

  smoke-test:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    steps:
      - ... (setup)
      - run: |
          node apps/cli/dist/index.js run "list files in current directory using Glob"

### .github/workflows/release.yml
Uses @changesets/cli for version management

### .github/workflows/publish.yml
Publishes to npm on GitHub Release

## Polish Items (v1.1 from the spec)

1. Fix Anthropic adapter: deduplicate message_complete event
   (already addressed in Phase 3 but double-check)

2. Fix OpenAI adapter: use actual tool-call IDs not array indices
   (already addressed in Phase 3 but double-check)

3. Fix useAgent hook: ensure React closure correctness
   (already addressed in Phase 8 but double-check)

4. Add --json output flag for non-interactive mode:
   In the `run` command, if --json is passed, output AgentEvents as
   newline-delimited JSON instead of text. This makes COD scriptable.

5. `cod doctor` command:
   - Check Node.js version >= 20
   - Check for API keys (which providers are configured)
   - Test LLM connectivity (send a tiny "hello" prompt)
   - Check for MCP server connectivity
   - Check for git in PATH
   - Print a summary: ✓ / ✗ for each check

## Final Verification

Run through this manual test checklist:

1. npm install -g . (from the repo root)
2. cod --version → prints version
3. cod doctor → all checks pass
4. cod "what files are in this directory?" → uses Glob, returns list
5. cod "read the README and summarize it" → uses Read, returns summary
6. cod "create a file called test.txt with 'hello world'" → uses Write
7. cod "change 'hello world' to 'goodbye world' in test.txt" → uses Edit
8. cod "run ls -la" → uses Bash (prompts in default mode)
9. /mode acceptEdits → mode changes, no more prompt for file edits
10. /cost → shows token usage
11. Ctrl+C → aborts current operation cleanly
12. Test with OpenAI: cod --provider openai "hello" → works
13. Test with Ollama: cod --provider ollama --model llama3 "hello" → works
```

---

## PHASE 11: The System Prompt Refinement (Ongoing)

**This is not a one-time prompt — this is the ongoing work that makes COD good.**

```
The system prompt in @cod/memory is the single most important piece of text
in this entire codebase. It's the difference between a coding agent that
flails and one that feels like a senior engineer pair-programming with you.

Here are refinements to add based on real usage patterns. Update
buildSystemPrompt() in @cod/memory:

## Add: Tool Selection Guidance

After the "Critical Rules" section, add:

### Tool Selection
- To understand a codebase: start with Glob to find files, then Read key
  files (package.json, README, main entry points).
- To find where something is defined: use Grep with output_mode
  "files_with_matches" first, then Read the relevant files.
- To make a change: ALWAYS Read the file first, then use Edit (not Write)
  for surgical changes.
- To verify a change worked: run the project's test command, linter, or
  type checker after making changes.
- For complex multi-file changes: use TodoWrite to plan your steps, then
  execute them one by one, checking TodoRead periodically.
- For independent subtasks: use Task to spawn a subagent so you don't
  pollute your main context.

## Add: Common Patterns

### Common Patterns
- "Fix this error" → Read the error file, understand the context, Read
  related files, then Edit the fix.
- "Add a feature" → Read existing code to understand patterns, Write new
  files, Edit existing files to integrate, run tests.
- "Refactor X" → Read all related files first, plan the changes, execute
  them incrementally, run tests between changes.
- "Explain this code" → Read the files, provide a clear explanation
  without using tools further.

## Add: Error Recovery Guidance

### When Things Go Wrong
- If Edit fails with "string not found": you probably have stale context.
  Re-Read the file — it may have changed.
- If Edit fails with "multiple matches": add more surrounding context to
  old_string to make it unique.
- If a shell command fails: read the error output carefully. Common issues
  are missing dependencies (suggest installing), wrong directory (use cd),
  or permission errors.
- If you're stuck in a loop: stop, explain to the user what's happening,
  and ask for guidance.

## Add: Project-Type-Specific Intelligence

### Project Detection
When you see the project for the first time (no project memory), quickly
identify the project type and adapt:
- package.json → Node.js project. Check for tsconfig (TypeScript),
  next.config (Next.js), vite.config (Vite), etc.
- Cargo.toml → Rust project
- pyproject.toml or setup.py → Python project
- go.mod → Go project
- Gemfile → Ruby project
- pom.xml or build.gradle → Java/Kotlin project

Adapt your tool usage accordingly:
- Use the project's package manager (npm, pnpm, yarn, pip, cargo, etc.)
- Run the project's test command (npm test, pytest, cargo test, etc.)
- Follow the project's code style conventions
```

---

## Summary: What Makes This Actually Work

The spec you have is architecturally sound. The gap between it and a real coding agent is:

1. **The system prompt** (Phase 2 + Phase 11) — This is 80% of the intelligence. The LLM needs to know HOW to use the tools, WHEN to use which tool, and how to recover from errors. Without this, it's a chatbot with file access.

2. **Tool error messages** (Phase 4) — When the Edit tool says "Found 3 occurrences, provide more context," that's teaching the LLM in real-time. Bad error messages = a confused agent.

3. **The agent loop** (Phase 7) — The loop-until-done pattern with proper tool result feeding is what makes it agentic vs. single-shot.

4. **Permission UX** (Phase 5 + 8) — This is what makes it safe enough to actually use. Without good permissions, nobody will let it edit their files.

5. **Context compression** (Phase 6) — Without this, sessions die after 10 minutes of complex work. With it, sessions can run for hours.

The TypeScript framework IS the product — combined with a great system prompt and a capable LLM on the other end of the API call.
