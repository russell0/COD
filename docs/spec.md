---
title: "COD: Open-Source AI Coding Assistant"
subtitle: "Program Specification — Version 1.0"
author: "COD Engineering"
date: "February 2026"
geometry: "margin=1.1in"
fontsize: 11pt
mainfont: "DejaVu Serif"
sansfont: "DejaVu Sans"
monofont: "DejaVu Sans Mono"
linestretch: 1.25
toc: true
toc-depth: 3
numbersections: true
colorlinks: true
linkcolor: "blue"
urlcolor: "blue"
toccolor: "black"
header-includes:
  - \usepackage{fancyhdr}
  - \pagestyle{fancy}
  - \fancyhf{}
  - \fancyhead[L]{\small COD Program Specification v1.0}
  - \fancyhead[R]{\small Confidential}
  - \fancyfoot[C]{\thepage}
  - \usepackage{titling}
  - \usepackage{xcolor}
  - \definecolor{codblue}{RGB}{0, 90, 180}
  - \usepackage{mdframed}
  - \usepackage{booktabs}
  - \usepackage{longtable}
  - \renewcommand{\arraystretch}{1.3}
---

\newpage

# Executive Summary

**COD** is a fully open-source, npm-publishable command-line AI coding assistant designed to give development teams a self-hostable, auditable, and extensible alternative to proprietary AI coding tools. COD is multi-provider by design: it works with Anthropic Claude, OpenAI GPT-4, Google Gemini, and locally-hosted Ollama models through a single unified interface and binary.

The product ships as `npm install -g cod` and launches immediately with a streaming interactive terminal UI. It supports the same core workflows as leading proprietary tools — file reading and editing, shell execution, web fetching, context memory, subagent task delegation — while adding capabilities that proprietary tools lack: pluggable LLM backends, a structured permission engine with five granular modes, a shell-hook system for CI/CD integration, and full Model Context Protocol (MCP) support for third-party tool servers.

COD is architected as a TypeScript monorepo with eleven independently versioned packages. This structure allows organizations to embed individual subsystems (the LLM adapter layer, the permission engine, the tool registry) into their own tooling without taking a dependency on the full CLI. The published npm package bundles all internal packages into a single self-contained binary with no build step required for end users.

**Target users:** Software engineering teams at companies that need auditability of AI tool behavior, developers who want to use locally-hosted models, open-source contributors who want to extend AI coding workflows, and platform teams building internal AI tooling on top of a well-defined API.

**Key differentiators vs. proprietary alternatives:**

- No vendor lock-in: switch between four LLM providers with one config line
- Full auditability: every tool call, permission decision, and hook invocation is observable
- Embeddable: individual packages can be used in other Node.js applications
- MCP-native: any MCP-compatible tool server extends COD without code changes
- Apache-2.0 license: permissive, compatible with commercial use

\newpage

# Problem Statement and Market Context

## The Gap in the Current AI Coding Tool Landscape

AI coding assistants have reached mainstream adoption in software development. However, the leading tools share a common set of limitations that create friction for teams with specific operational, security, or workflow requirements.

**Vendor lock-in.** Current market leaders are tightly coupled to a single LLM provider. Switching providers — for cost, capability, latency, or data-residency reasons — requires switching tools entirely rather than changing a configuration value.

**Limited auditability.** Proprietary tools do not expose a structured event stream for tool calls and permission decisions. This makes it difficult for security-conscious organizations to audit what the AI assistant has done, integrate AI actions into existing observability stacks, or enforce custom access policies.

**No local model support.** Many enterprise environments require on-premises or air-gapped inference. Existing tools offer no pathway to replace the cloud inference backend with a locally-hosted model (e.g., via Ollama).

**Closed extension model.** Adding new tool capabilities to proprietary assistants requires waiting for vendor updates. COD supports the Model Context Protocol (MCP), an open standard that allows any MCP-compatible server — for databases, APIs, internal services — to register tools that the assistant can invoke.

**No hook system.** DevOps and platform teams cannot intercept tool calls to enforce policies, log actions to audit systems, or modify inputs without modifying source code. COD provides a structured pre/post hook system that runs shell commands with full context before and after every tool invocation.

## Target Audience

| Persona | Pain Point Addressed |
|---|---|
| Security-focused engineering teams | Full tool-call auditability via hooks and permission modes |
| Enterprises with data-residency requirements | Ollama adapter for on-premises LLM inference |
| Platform / DevOps teams | Hook system for policy enforcement and audit logging |
| Open-source maintainers | Apache-2.0 license, extensible architecture |
| Individual developers | Free to use, multi-provider, competitive feature set |
| Teams building internal AI tooling | Embeddable packages via `@cod/*` npm scoped packages |

\newpage

# Product Overview

## Core Capabilities

### Multi-Provider LLM Support

COD communicates with four LLM backends through a unified streaming adapter interface. The same agent loop, tool execution pipeline, and TUI run identically regardless of which provider is active. Switching providers requires one configuration value change.

| Provider | Environment Variable | Representative Models |
|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-6, claude-opus-4-6 |
| OpenAI | `OPENAI_API_KEY` | gpt-4o, gpt-4-turbo, gpt-3.5-turbo |
| Google Gemini | `GEMINI_API_KEY` | gemini-1.5-pro, gemini-1.5-flash |
| Ollama (local) | `OLLAMA_BASE_URL` | llama3, codestral, mistral, deepseek-coder |

### Built-In Tool Suite

COD ships with eleven built-in tools covering the full range of coding-assistant operations:

| Tool | Category | Description |
|---|---|---|
| `Read` | File I/O | Read file contents with line numbers, offset, and limit |
| `Glob` | File I/O | Find files matching a glob pattern, sorted by modification time |
| `Grep` | Search | Regex search across files; content, file-list, or count modes |
| `Write` | File I/O | Write file contents, creating parent directories as needed |
| `Edit` | File I/O | Exact-string replacement; fails if not unique (prevents silent errors) |
| `MultiEdit` | File I/O | Apply multiple edits atomically to a single file |
| `Bash` | Shell | Execute shell commands with timeout and abort-signal support |
| `WebFetch` | Network | Fetch a URL; convert HTML to readable markdown |
| `Task` | Orchestration | Spawn a subagent with an independent context and tools |
| `TodoWrite` | Productivity | Write the session todo list |
| `TodoRead` | Productivity | Read the current session todo list |

### Permission Engine

A five-mode permission engine controls what operations the assistant can perform without prompting. Modes can be set globally, per-project, or overridden per-session via slash command.

| Mode | File Edits | Shell Commands | Read Operations |
|---|---|---|---|
| `bypassPermissions` | Auto | Auto | Auto |
| `dontAsk` | Auto | Auto (unless blocked) | Auto |
| `acceptEdits` | Auto | Prompt | Auto |
| `default` | Prompt | Prompt | Auto |
| `plan` | Denied | Denied | Auto |

### Interactive Terminal UI

COD's TUI is built with Ink (React for terminals) and provides:

- Streaming response rendering with live token output
- Collapsible tool-call blocks showing status, inputs, and result previews
- An interactive permission prompt that suspends the agent loop until the user responds
- A status bar showing provider, model, permission mode, cumulative token count, and estimated cost
- Input history navigation (up/down arrow), Ctrl+C abort, Ctrl+L clear

### Context Memory

COD builds an automatic system prompt from layered memory sources:

1. **Global memory** (`~/.cod/MEMORY.md`) — preferences and conventions that apply across all projects
2. **Project memory** (`COD.md` or `CLAUDE.md` in the project root) — project-specific context, tech stack, conventions
3. **`@`-imports** — project memory files can include other files with `@path/to/file.md` syntax
4. **Git context** — current branch and `git status --short` are injected automatically

### Context Compression

COD monitors token usage and, when the conversation reaches 85% of the model's context window, automatically summarizes earlier turns. The summary is generated by the LLM itself, and the last 10 conversation turns are preserved verbatim alongside it. This allows indefinitely long sessions without context overflow.

### MCP Integration

COD implements the Model Context Protocol client, allowing external tool servers to register tools that the agent can invoke. MCP servers are configured in `.mcp.json` at the project root or in the global config. Servers communicate via stdio or SSE transport. MCP tools appear in the agent's tool registry namespaced as `serverName__toolName` to avoid collisions.

### Hook System

Shell hooks can intercept every tool call. Hooks receive a JSON event on stdin and can return a JSON decision on stdout:

- **`preToolUse`** — runs before a tool executes; can allow, deny, or modify the tool input
- **`postToolUse`** — runs after a tool completes; receives the result; can allow or deny
- **`subagentStart`** — runs before a subagent is spawned
- **`stop`** — runs when the session ends

Hooks are configured per-tool-name or with a wildcard `"*"` to match all tools. This enables use cases such as audit logging, policy enforcement, and integration with external approval systems.

### Slash Commands

The interactive REPL supports slash commands for session management:

| Command | Description |
|---|---|
| `/help` | List available commands |
| `/clear` | Clear conversation history |
| `/model [name]` | Show or switch model |
| `/mode [mode]` | Show or switch permission mode |
| `/memory <text>` | Append a note to `COD.md` |
| `/cost` | Show token usage summary |
| `/status` | Show current agent status |

Custom commands can be added as Markdown files in `.cod/commands/` (project-scoped) or `~/.cod/commands/` (global). Each file becomes a `/filename` command; the file content is injected as a user message.

\newpage

# Architecture

## Monorepo Structure

COD is structured as a pnpm workspace monorepo managed by Turborepo. All packages are private scoped packages (`@cod/*`) except the published `cod` CLI binary. Internal packages are bundled into the CLI binary by tsup at build time, so end users install a single package with no internal package dependencies in their node_modules.

```
cod/
├── packages/
│   ├── types/        @cod/types        # Zero-dependency shared TypeScript interfaces
│   ├── config/       @cod/config       # Settings schema, config loader, path helpers
│   ├── llm/          @cod/llm          # LLM provider adapters + registry
│   ├── tools/        @cod/tools        # Built-in tool implementations + registry
│   ├── permissions/  @cod/permissions  # Permission engine (5 modes)
│   ├── hooks/        @cod/hooks        # Pre/post tool hook runner
│   ├── mcp/          @cod/mcp          # MCP client manager
│   ├── memory/       @cod/memory       # COD.md loader + system prompt builder
│   ├── session/      @cod/session      # Conversation history + context compression
│   ├── agent/        @cod/agent        # CodAgent orchestrator and event loop
│   └── tui/          @cod/tui          # Ink/React terminal UI components
└── apps/
    └── cli/          cod               # Published CLI binary
```

## Dependency Graph

The package dependency graph is strictly acyclic. No package may import from a package above it in the hierarchy:

```
@cod/types
    └── @cod/config
            ├── @cod/llm
            ├── @cod/permissions
            ├── @cod/hooks
            ├── @cod/mcp
            ├── @cod/memory
            └── @cod/tools
                    └── @cod/session
                            └── @cod/agent
                                    └── @cod/tui
                                            └── apps/cli
```

## Technology Stack

| Concern | Technology | Rationale |
|---|---|---|
| Language | TypeScript 5.x | Static typing, IDE support, required by Ink/MCP SDKs |
| Module system | ESM-only | Required by Ink 5.x and MCP SDK; future-proof |
| Runtime | Node.js ≥ 20 | `AbortSignal.any()`, native fetch, stable ESM |
| Package manager | pnpm 10.x | Efficient disk usage, strict hoisting, workspace support |
| Build orchestration | Turborepo 2.x | Task graph caching, parallel builds |
| Terminal UI | Ink 5.x + React 18 | Declarative terminal rendering, React hooks |
| CLI argument parsing | Commander.js 12.x | Mature, well-documented CLI framework |
| Schema validation | Zod 3.x | Runtime type safety, JSON Schema generation |
| Shell execution | execa 9.x | Promise-based, supports abort signals and streaming |
| MCP client | @modelcontextprotocol/sdk 1.x | Official MCP client implementation |
| LLM — Anthropic | @anthropic-ai/sdk 0.26+ | Official streaming SDK with tool use |
| LLM — OpenAI | openai 4.x | Official streaming SDK, also used for Ollama compat |
| LLM — Gemini | @google/generative-ai 0.15+ | Official Gemini SDK |
| Bundler | tsup 8.x | ESM bundle with shebang banner for CLI binary |
| Testing | Vitest 1.x | Fast, ESM-native, compatible with Node.js modules |
| Releases | @changesets/cli | Conventional changelog, PR-based release workflow |

\newpage

# Package Specifications

## `@cod/types` — Shared Type Definitions

**Purpose:** Zero-dependency package containing all shared TypeScript interfaces. Every other package imports types from here. These interfaces form the stable API contract that must not change without coordination across all dependent packages.

**Critical exported types:**

### `LLMAdapter` Interface

```typescript
interface LLMAdapter {
  readonly providerId: string;
  stream(options: LLMRequestOptions): AsyncIterable<LLMStreamEvent>;
  countTokens(messages: Message[]): Promise<number>;
}
```

The `stream()` method returns an `AsyncIterable` of `LLMStreamEvent`. All four provider adapters must emit events of identical shape. This is the central integration contract of the system.

### `LLMStreamEvent` Union

```typescript
type LLMStreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_input_delta'; id: string; delta: string }
  | { type: 'tool_use_complete'; id: string; name: string; input: unknown }
  | { type: 'message_complete'; usage: TokenUsage; stopReason: StopReason }
  | { type: 'error'; error: Error };
```

`tool_use_start` fires when a tool call begins streaming. `tool_use_input_delta` fires for each chunk of the JSON input. `tool_use_complete` fires once the full input JSON is assembled and parsed. The agent loop processes complete events; the TUI uses start/delta events for streaming visualization.

### `AgentEvent` Union

```typescript
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
```

`AgentEventStream` is `AsyncGenerator<AgentEvent>`. Both the TUI (`useAgent` hook) and the non-interactive `run` command consume this stream.

### `ToolDefinition` Interface

```typescript
interface ToolDefinition<TInput = unknown> {
  name: string;
  description: string;
  inputSchema: ZodTypeAny;
  annotations?: {
    readOnly?: boolean;
    destructive?: boolean;
    requiresShell?: boolean;
  };
  execute(input: TInput, context: ToolExecutionContext): Promise<ToolResult>;
}
```

The `annotations` object drives permission engine decisions. A tool with `readOnly: true` is always allowed without prompting in all modes except `plan`. Tools with `requiresShell: true` are subject to blocked-command pattern matching.

### `PermissionMode` Enum

```typescript
enum PermissionMode {
  Default = 'default',
  AcceptEdits = 'acceptEdits',
  Plan = 'plan',
  DontAsk = 'dontAsk',
  BypassPermissions = 'bypassPermissions',
}
```

String-valued enum to ensure JSON config files are human-readable.

---

## `@cod/config` — Configuration Management

**Purpose:** Load, validate, and merge configuration from multiple sources. Provide canonical path helpers for the `~/.cod/` directory structure.

### Settings Schema

The `CodSettingsSchema` Zod schema defines all configurable values with defaults. Configuration merges in this order (later values override earlier ones):

1. Built-in defaults (defined in schema)
2. Global config file: `~/.cod/config.json`
3. Project config file: `.cod/config.json`
4. Environment variables (API keys)
5. CLI flags (model, provider, mode)

### Key Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `model` | string | `claude-sonnet-4-6` | LLM model identifier |
| `provider` | enum | `anthropic` | LLM provider |
| `permissionMode` | PermissionMode | `default` | Default permission mode |
| `maxTokens` | number | (provider default) | Max tokens per response |
| `temperature` | number 0–2 | (provider default) | Sampling temperature |
| `autoCompact` | boolean | `true` | Enable automatic context compression |
| `compactThreshold` | number 0–1 | `0.85` | Fraction of context window before compression |
| `historySize` | integer | `1000` | Max stored history entries |
| `blockedCommands` | string[] | `[]` | Shell command patterns that are always denied |
| `mcpServers` | Record | `{}` | MCP server configurations |
| `hooks` | HooksConfig | `{}` | Hook command configurations |

### API Key Resolution

API keys are resolved in order: config file `apiKeys` object → environment variables. The resolution map is:

| Provider | Config Key | Environment Variable |
|---|---|---|
| Anthropic | `apiKeys.anthropic` | `ANTHROPIC_API_KEY` |
| OpenAI | `apiKeys.openai` | `OPENAI_API_KEY` |
| Gemini | `apiKeys.gemini` | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| Ollama | `ollamaBaseUrl` | `OLLAMA_BASE_URL` |

### Path Structure

```
~/.cod/
├── config.json        # Global configuration
├── MEMORY.md          # Global memory (injected into all sessions)
├── history            # Input history (line-delimited)
├── keybindings.json   # Custom keybindings
└── commands/          # Global custom slash commands
    └── *.md

<project-root>/
├── COD.md             # Project memory (checked first)
├── CLAUDE.md          # Fallback project memory
├── .mcp.json          # MCP server definitions
└── .cod/
    ├── config.json    # Project-scoped configuration
    └── commands/      # Project-scoped slash commands
        └── *.md
```

---

## `@cod/llm` — LLM Provider Adapters

**Purpose:** Normalize the streaming APIs of four different LLM providers behind the unified `LLMAdapter` interface. All adapters emit identical `LLMStreamEvent` sequences for the same logical operations.

### Adapter Responsibilities

Each adapter must:

1. Accept `LLMRequestOptions` (model, messages, system prompt, tools, max tokens, temperature, abort signal)
2. Translate the provider's native API request format
3. Stream events in the normalized `LLMStreamEvent` sequence
4. Accumulate streamed JSON for tool inputs and emit `tool_use_complete` with parsed input
5. Emit a final `message_complete` with accurate `TokenUsage` and `StopReason`
6. Emit `{ type: 'error' }` on any failure (never throw from the async iterable)

### Streaming Event Sequence

For a response with one tool call, the expected event sequence is:

```
text_delta (0..n times)
tool_use_start
tool_use_input_delta (0..n times)
tool_use_complete
message_complete (stopReason: 'tool_use')
```

For a pure text response:

```
text_delta (1..n times)
message_complete (stopReason: 'end_turn')
```

### `AnthropicAdapter`

Uses `@anthropic-ai/sdk`. Streams via `client.messages.stream()` and maps the SDK's server-sent event types to the normalized event union. Content block indices are tracked to correctly associate `input_json_delta` events with their parent `tool_use` content blocks.

Tool definitions are passed as `{ name, description, input_schema }` where `input_schema` is the JSON Schema object generated from the tool's Zod schema.

### `OpenAIAdapter`

Uses the `openai` npm package with `stream: true`. OpenAI's tool-call streaming uses a delta model where the tool call ID and function name may arrive in separate chunks. The adapter accumulates these across chunks and emits `tool_use_complete` once the finish reason is received.

Message history translation handles the OpenAI role model (system/user/assistant/tool) vs. the Anthropic model (user/assistant with `tool_result` content blocks).

### `GeminiAdapter`

Uses `@google/generative-ai`. Gemini's `sendMessageStream` API returns chunks with a `text()` accessor. Tool use support in Gemini is handled at the function-calling level. The adapter normalizes Gemini's `FunctionCall` responses to the standard `tool_use_*` event sequence.

### `OllamaAdapter`

Delegates entirely to `OpenAIAdapter` with the base URL set to the Ollama OpenAI-compatible endpoint (`http://localhost:11434/v1` by default). Ollama does not require an API key; the adapter passes a dummy value.

### `LLMRegistry`

The `LLMRegistry` class manages registered adapters and provides a factory method:

```typescript
LLMRegistry.createFromConfig(settings: CodSettings): {
  registry: LLMRegistry;
  adapter: LLMAdapter;
}
```

Adapters are registered only if their corresponding API key is present (except Ollama). The returned `adapter` is the one matching `settings.provider`.

---

## `@cod/permissions` — Permission Engine

**Purpose:** Enforce the configured permission policy for every tool invocation. Optionally prompt the user for decisions and cache those decisions for the session.

### Permission Decision Flow

For each tool call, the engine evaluates in order:

1. **Blocked command check** — If `requiresShell: true` and the command matches any pattern in `blockedCommands`, deny immediately regardless of mode.
2. **Mode-specific policy** — Apply the rules for the current `PermissionMode`.
3. **Session allow list** — If the user previously chose "allow always" for this tool, skip the prompt.
4. **Prompt callback** — If a prompt callback is registered, invoke it and cache the result.
5. **Default deny** — If no callback is registered and a prompt would be needed, deny.

### Mode Decision Matrix

| | readOnly tool | file edit | shell cmd | destructive |
|---|---|---|---|---|
| `bypassPermissions` | Yes | Yes | Yes | Yes |
| `dontAsk` | Yes | Yes | Yes (if not blocked) | Yes |
| `acceptEdits` | Yes | Yes | prompt | prompt |
| `default` | Yes | prompt | prompt | prompt |
| `plan` | Yes | No | No | No |

### Session Allow List

When a user responds to a prompt with "Allow for session" or "Always allow", the tool name is added to an in-memory set. Subsequent calls to the same tool skip the prompt for the duration of the session. The allow list is cleared when the session ends.

### Prompt Callback Protocol

The prompt callback receives a `PermissionRequest` and returns a `PermissionDecision`:

```typescript
type PermissionDecision =
  | { type: 'allow'; rememberForSession?: boolean }
  | { type: 'deny'; reason?: string }
  | { type: 'allow_always' };
```

In interactive mode, this callback is wired to the `PermissionPrompt` TUI component. In non-interactive mode, if no callback is set, the engine defaults to deny for safety.

---

## `@cod/hooks` — Hook Runner

**Purpose:** Execute user-configured shell hooks before and after tool calls, allowing external systems to audit, modify, or block tool invocations.

### Hook Configuration

Hooks are configured per tool name or with `"*"` to match all tools:

```json
{
  "hooks": {
    "preToolUse": {
      "Bash": [{ "command": "policy-check.sh", "timeout": 5000 }],
      "*": [{ "command": "audit-log.sh" }]
    },
    "postToolUse": {
      "Write": [{ "command": "git-stage.sh" }]
    }
  }
}
```

### Hook Invocation Protocol

1. Hook receives JSON event on **stdin**
2. Hook exits with code 0 to allow, non-zero to deny
3. Hook may optionally write JSON to **stdout**:
   - `{ "decision": { "type": "allow" } }` — explicit allow
   - `{ "decision": { "type": "deny", "reason": "..." } }` — deny with message
   - `{ "decision": { "type": "modify", "modifiedInput": {...} } }` — allow with modified input

If a hook times out or fails to execute, the runner logs a warning and allows the call (fail-open semantics, since hooks are an operator-facing feature and hook failures should not silently break the user experience).

### Hook Event Payloads

**PreToolUse event:**
```json
{
  "type": "preToolUse",
  "call": { "id": "...", "name": "Bash", "input": { "command": "ls" } },
  "workingDirectory": "/home/user/project"
}
```

**PostToolUse event:**
```json
{
  "type": "postToolUse",
  "call": { "id": "...", "name": "Bash", "input": { "command": "ls" } },
  "result": { "type": "text", "text": "file1.ts\nfile2.ts" },
  "workingDirectory": "/home/user/project"
}
```

---

## `@cod/mcp` — MCP Client Manager

**Purpose:** Manage connections to Model Context Protocol servers and expose their tools to the agent's tool registry.

### Connection Lifecycle

The `MCPClientManager` connects to all configured servers during agent initialization. Connections are established in parallel; individual connection failures are logged but do not prevent the agent from starting with the remaining servers. All connections are closed when the agent session ends.

### Transport Support

| Transport | Description | Config |
|---|---|---|
| `stdio` | Launch a local process, communicate over stdin/stdout | `command`, `args`, `env` |
| `sse` | HTTP Server-Sent Events connection | `url` |
| `http` | HTTP request/response (MCP HTTP transport) | `url` |

### Tool Registration

After connecting, the manager calls `client.listTools()` on each server and wraps each result in a `ToolDefinition`. MCP tools are registered in the `ToolRegistry` with the namespace prefix `serverName__toolName` (double underscore) to ensure no collisions with built-in tool names.

MCP tool inputs are not statically typed at registration time — the manager creates a passthrough Zod schema (`z.record(z.unknown())`) and forwards the raw input object to `client.callTool()` at execution time.

---

## `@cod/memory` — Memory and System Prompt

**Purpose:** Load project and global memory files and construct the system prompt passed to the LLM on every request.

### Memory Loading

Memory is loaded from up to three sources on every `agent.initialize()` call:

1. `~/.cod/MEMORY.md` — global memory
2. `<project>/COD.md` — project memory (preferred)
3. `<project>/CLAUDE.md` — fallback if `COD.md` is absent

### `@`-Import Resolution

Memory files can include other files by reference. A line containing only `@path/to/file.md` (relative to the memory file's directory) is replaced with the contents of that file at load time. This allows modular memory composition:

```markdown
# Project Context

@docs/architecture-overview.md
@.cod/api-conventions.md
```

Circular imports are not currently detected; files are included once per reference.

### System Prompt Construction

The final system prompt is assembled from sections:

1. **Base persona** — describes COD's role and general instructions
2. **`<global_memory>` block** — if global memory exists
3. **`<project_memory>` block** — if project memory exists
4. **Git context** — branch name and `git status --short` output (injected if the working directory is a git repo)

The system prompt is rebuilt on each `agent.initialize()` call and is immutable for the duration of the session.

---

## `@cod/session` — Conversation Session

**Purpose:** Maintain the ordered list of `Message` objects that form the conversation history, and provide context compression when the conversation approaches the model's context limit.

### Message Accumulation

The `Session` class maintains messages in the Anthropic message format (user/assistant roles with typed content blocks). Helper methods abstract the details:

- `addUserMessage(text)` — appends a user text message
- `addAssistantMessage(content[])` — appends an assistant message with mixed content blocks (text + tool_use)
- `addToolResults(results[])` — appends a user message containing tool_result content blocks

### Context Compression

The `SlidingWindowCompressor` monitors token count after each turn. When the count exceeds `compactThreshold × contextWindowSize`, it:

1. Sends the full conversation to the LLM with a summarization request
2. Receives a structured summary describing key decisions, files modified, and unresolved issues
3. Replaces the conversation history with: a synthetic summary user message, a synthetic assistant acknowledgment, and the last 10 actual turns verbatim

The compressor emits a `{ type: 'context_compressed', before, after }` agent event after compression so the TUI can notify the user.

---

## `@cod/agent` — Agent Orchestrator

**Purpose:** The central orchestrator that binds all packages into a coherent agentic loop. `CodAgent` manages the full lifecycle of a session from initialization through tool execution and context management.

### Initialization

`agent.initialize()` must be called before `agent.run()`. It:

1. Connects all configured MCP servers
2. Registers MCP tools in the tool registry
3. Loads project and global memory
4. Fetches git context
5. Assembles the system prompt

Initialization is idempotent; repeated calls are no-ops.

### Agent Loop

`agent.run(userMessage)` is an `AsyncGenerator<AgentEvent>` that implements the full agentic loop:

```
add user message to session
check if compression needed → yield context_compressed if so
yield thinking_start

loop:
  call LLM.stream() → yield text_delta, tool_call_start events
  accumulate assistant response (text + tool_use blocks)
  add assistant message to session
  if stopReason != 'tool_use': break

  for each tool call:
    run preToolUse hook → deny if rejected
    check permission engine → deny if rejected
    yield tool_call_executing
    execute tool
    run postToolUse hook
    yield tool_call_complete

  add tool results to session
  continue loop
```

The loop terminates when the LLM returns `stopReason: 'end_turn'`, when all tool calls in a turn are denied, or when `agent.abort()` is called.

### Subagent Spawning

When the `Task` tool is executed, `CodAgent.spawnSubagent()` creates a new `CodAgent` instance with a fresh session and the same settings. The subagent runs `agent.run(prompt)` to completion, accumulates the full text output, and returns it as the `Task` tool result. Subagents share the same LLM adapter and settings but have isolated sessions, memory loading, and tool registries.

### Abort Handling

`agent.abort()` triggers the underlying `AbortController`, which is passed to the active LLM stream call and to tool execution contexts. Aborting mid-stream closes the LLM connection; aborting during tool execution passes the signal to the tool (tools that support it, like `Bash`, cancel the subprocess). After aborting, a new `AbortController` is created so the agent can be reused in the same session.

---

## `@cod/tui` — Terminal User Interface

**Purpose:** Provide the Ink/React component tree and hooks that render the interactive REPL.

### Component Tree

```
<App>
  <StatusBar />           # Provider, model, mode, tokens, cost
  <MessageList>
    <MessageBubble />     # One per user/assistant turn
    <ToolCallBlock />     # One per tool invocation in current turn
  </MessageList>
  <PermissionPrompt />    # Conditional: shown when permission needed
  <InputBox />            # Text input with history navigation
```

### `useAgent` Hook

The central hook that connects the `AgentEventStream` to React state. It manages:

- `status: AgentStatus` — `idle | thinking | responding | tool_executing | waiting_permission | error`
- `messages: MessageState[]` — accumulated user and assistant messages
- `toolCalls: ToolCallState[]` — current turn's tool call states with status progression
- `totalInputTokens`, `totalOutputTokens` — cumulative usage counters
- `error: Error | null`

The hook exposes `sendMessage(text)`, `abort()`, and `clearMessages()`.

### Permission Flow

When the agent needs a permission decision, it resolves a `Promise<PermissionDecision>` that is held by the `useAgent` hook. The `App` component detects the pending decision and renders `<PermissionPrompt>` instead of `<InputBox>`. The agent loop is suspended (awaiting the promise) while the prompt is displayed. When the user makes a choice, the promise resolves and the agent continues.

### Input History

`useHistory` persists input entries to `~/.cod/history` across sessions. Up/down arrow navigation walks through history in reverse chronological order. The current history position is reset when the user submits a new message.

---

## `apps/cli` — CLI Entry Point

**Purpose:** The published npm package that wires together all internal packages and exposes the `cod` command.

### Command Structure

```
cod [prompt]              # Interactive REPL or one-shot prompt
cod run <prompt>          # Explicit non-interactive mode
cod config get <key>      # Read a config value
cod config set <key> <v>  # Write a config value
cod mcp list              # List configured MCP servers
cod mcp add <name> <cmd>  # Add an MCP server
cod mcp remove <name>     # Remove an MCP server
cod update                # Self-update via npm
```

### Bootstrap Sequence

```
checkFirstRun() → create ~/.cod/ if needed, print welcome on first run
loadConfig()    → merge global + project + env + CLI flag overrides
validateApiKey()→ exit with helpful message if required key is missing
LLMRegistry.createFromConfig() → instantiate the correct adapter
new CodAgent()  → wire all subsystems
```

### Bundle Configuration

The CLI is bundled by tsup with:

- `#!/usr/bin/env node` banner in the output file
- All `@cod/*` workspace packages inlined (no internal deps in user's node_modules)
- External runtime dependencies listed explicitly: `commander`, `ink`, `react`, `zod`, `execa`, all LLM SDKs, `@modelcontextprotocol/sdk`

The resulting `dist/index.js` is marked executable. The `"bin"` field in `package.json` points to it.

\newpage

# Security Model

## Threat Model

COD executes arbitrary shell commands, reads and writes files, and makes network requests on behalf of the user. The primary threats are:

1. **Prompt injection** — malicious content in files or web pages that instructs the LLM to take unauthorized actions
2. **Overly broad permissions** — running in a mode that allows destructive operations when the user intended read-only exploration
3. **Unintended data exfiltration** — the LLM calling `WebFetch` or `Bash` to send data to external servers
4. **Credential exposure** — the LLM reading secret files or environment variables

## Mitigations

### Permission Modes

Users should run in the most restrictive mode that meets their needs. For exploratory tasks, `plan` mode (read-only) is recommended. For code generation tasks, `acceptEdits` prevents shell access while allowing file edits.

### Blocked Command Patterns

The `blockedCommands` config array contains patterns that are checked against the shell command input before any permission prompt. Commands matching these patterns are denied regardless of mode.

### Pre-Tool Hooks for Policy Enforcement

Organizations can use `preToolUse` hooks to enforce policies via external scripts. For example, a hook can check whether a `Write` call targets a protected path, or whether a `Bash` command contains blacklisted subcommands. Hook scripts run in the user's shell environment and can perform arbitrary validation.

### API Key Handling

API keys are read from environment variables or the `~/.cod/config.json` file, never from the project directory. The tool suite includes no built-in tool for reading environment variables or arbitrary system files outside the working directory (the `Read` tool operates on file paths, not environment).

### Network Access

`WebFetch` is the only tool that makes outbound network requests. Organizations that wish to restrict network access can configure a `preToolUse` hook on `WebFetch` to deny or proxy requests.

## Audit Logging

The hook system provides a straightforward mechanism for audit logging. A `postToolUse` wildcard hook configured to write the event JSON to a log file creates a complete audit trail of every tool execution, including inputs, outputs, and timestamps.

\newpage

# Data Flow

## Request Lifecycle

The sequence from user input to response output:

```
User input
    │
    ▼
[InputBox] (TUI) or CLI argument
    │
    ▼
agent.run(message)
    │
    ├─► addUserMessage()        → Session
    ├─► needsCompression()?     → SlidingWindowCompressor
    │       └─► LLM summary request (if needed)
    │
    ▼
LLMAdapter.stream()             → LLM API (Anthropic/OpenAI/Gemini/Ollama)
    │
    ├─► text_delta events       → useAgent hook → MessageBubble streaming text
    ├─► tool_use_start          → useAgent hook → ToolCallBlock (pending)
    └─► tool_use_complete
            │
            ▼
        HookRunner.runPreToolUse()
            │
            ▼
        PermissionEngine.check()  (may invoke PermissionPrompt)
            │
            ▼
        tool.execute()
            │
            ▼
        HookRunner.runPostToolUse()
            │
            ▼
        yield tool_call_complete  → useAgent hook → ToolCallBlock (complete)
            │
            ▼
        session.addToolResults()
            │
            ▼
        [loop back to LLMAdapter.stream() if stopReason == 'tool_use']
            │
            ▼
        yield turn_complete       → useAgent hook → StatusBar token update
```

## Configuration Loading

```
CLI flags
    │
    ▼ (lowest priority wins is overridden by...)
Built-in defaults
    │
    ▼
~/.cod/config.json  (global)
    │
    ▼
.cod/config.json    (project)
    │
    ▼
Environment variables (ANTHROPIC_API_KEY, etc.)
    │
    ▼
CLI flags           (highest priority)
    │
    ▼
CodSettingsSchema.parse()  →  CodSettings
```

\newpage

# Configuration Reference

## Global Configuration (`~/.cod/config.json`)

```json
{
  "model": "claude-sonnet-4-6",
  "provider": "anthropic",
  "permissionMode": "default",
  "maxTokens": 8096,
  "temperature": 0.7,
  "apiKeys": {
    "anthropic": "sk-ant-...",
    "openai": "sk-...",
    "gemini": "AIza..."
  },
  "ollamaBaseUrl": "http://localhost:11434/v1",
  "blockedCommands": ["rm -rf /", "sudo rm"],
  "autoCompact": true,
  "compactThreshold": 0.85,
  "historySize": 1000,
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_..." }
    }
  },
  "hooks": {
    "preToolUse": {
      "Bash": [{ "command": "/usr/local/bin/policy-check", "timeout": 5000 }],
      "*": [{ "command": "logger -t cod-audit" }]
    },
    "postToolUse": {},
    "stop": [{ "command": "send-session-summary.sh" }]
  }
}
```

## MCP Server Configuration (`.mcp.json`)

```json
{
  "postgres": {
    "type": "stdio",
    "command": "npx",
    "args": ["@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
  },
  "internal-api": {
    "type": "sse",
    "url": "http://internal-mcp-server:8080/sse"
  }
}
```

## Project Memory (`COD.md`)

```markdown
# Project: E-Commerce Platform

## Tech Stack
- TypeScript, Node.js 20, Express 5
- PostgreSQL 16 with Drizzle ORM
- React 19, Vite, TailwindCSS
- Vitest for testing, ESLint + Prettier

## Conventions
- File names: kebab-case
- Exports: named exports only (no default exports)
- API handlers: src/api/<resource>/handler.ts
- Tests: co-located *.test.ts files
- Database migrations: db/migrations/ with Drizzle kit

## Important Notes
- Run `pnpm db:migrate` before running tests
- The `payments` module is PCI-scoped; avoid logging full card data
```

\newpage

# Installation and Distribution

## End-User Installation

```bash
# Global install (recommended)
npm install -g cod

# Or use without installing
npx cod "your prompt here"

# Verify installation
cod --version
```

## First-Run Experience

On first run, COD:

1. Creates `~/.cod/` if it does not exist
2. Detects whether an API key is set in the environment
3. Prints a welcome message with setup instructions if no API key is found

The first-run flow does not block; users can set their API key and immediately run `cod` again.

## Runtime Dependencies

The published `cod` package lists all runtime dependencies explicitly. Users installing `cod` globally receive all dependencies in their global node_modules. The key runtime dependencies are:

| Package | Version | Purpose |
|---|---|---|
| `commander` | ^12.0.0 | CLI argument parsing |
| `ink` | ^5.0.0 | Terminal UI rendering |
| `react` | ^18.0.0 | React runtime for Ink |
| `zod` | ^3.22.0 | Runtime schema validation |
| `execa` | ^9.3.0 | Shell command execution |
| `@anthropic-ai/sdk` | ^0.26.0 | Anthropic API client |
| `openai` | ^4.52.0 | OpenAI API client |
| `@google/generative-ai` | ^0.15.0 | Gemini API client |
| `@modelcontextprotocol/sdk` | ^1.0.0 | MCP client implementation |

## CI/CD and Release Workflow

The repository uses three GitHub Actions workflows:

**`ci.yml`** — Runs on every pull request and push to `main`:
1. Install dependencies with pnpm
2. Run `pnpm turbo typecheck` across all packages
3. Run `pnpm turbo build` to ensure all packages compile
4. Run `pnpm turbo test` to run all unit tests
5. Upload coverage reports to Codecov

**`release.yml`** — Runs on push to `main`:
- If changeset files are present: creates a "Release PR" that bumps versions and updates CHANGELOG
- If the Release PR is merged: publishes the updated packages to npm

**`publish.yml`** — Runs when a GitHub Release is published:
- Builds the project
- Publishes only the `cod` package (public) to npm with `--access public`

\newpage

# Testing Strategy

## Philosophy

Tests are co-located with their source files (`*.test.ts` in the same directory). Each package runs its own tests independently with `pnpm test`. The Turborepo task graph ensures packages are built before their dependencies are tested.

## Coverage Targets

| Metric | Target |
|---|---|
| Line coverage | 80% |
| Branch coverage | 75% |
| Function coverage | 85% |

## Unit Test Approach by Package

**`@cod/types`** — No runtime tests needed; types are validated at compile time.

**`@cod/config`** — Schema tests validate Zod parsing behavior, default application, enum rejection, and complex nested config (MCP server configs, hook configs).

**`@cod/llm`** — Each adapter is tested against MSW mock HTTP servers that replay recorded SSE fixtures from the real APIs. Tests verify that each adapter produces identical `LLMStreamEvent` sequences for the same logical operations: text-only response, single tool call, multiple tool calls, error handling, and abort signal propagation.

**`@cod/permissions`** — Exhaustive tests for all five modes: read-only tools, file edits, shell commands, destructive operations, blocked command matching, session allow list caching, and prompt callback interaction.

**`@cod/tools`** — Each tool is tested with real filesystem operations in `fs.mkdtemp` temp directories that are cleaned up after each test. Tests cover:
- `Read`: normal read, offset/limit, non-existent file
- `Glob`: pattern matching, empty result, directory exclusion
- `Grep`: regex search, all three output modes, context lines
- `Write`: create file, create parent directories, overwrite
- `Edit`: unique replacement, non-unique error, missing string error, replace_all
- `MultiEdit`: sequential edits, failure on second edit
- `Bash`: successful command, non-zero exit, timeout, abort signal
- `WebFetch`: mocked HTTP responses, HTML-to-text conversion

**`@cod/session`** — Tests for message accumulation, tool result formatting, `clear()`, and `replaceWithSummary()` with exact message count verification.

**`@cod/agent`** — Tests use a mock `LLMAdapter` that returns scripted event sequences. Tests verify: text-only turns, single tool call round-trip, multiple consecutive tool calls, permission denial flow, hook denial flow, context compression trigger, and abort handling.

**`@cod/tui`** — Uses `ink-testing-library` to render components with mock state. Tests verify: `useAgent` state transitions through the status machine, `PermissionPrompt` key handling, `InputBox` history navigation.

## End-to-End Smoke Test

A CI job that requires the `ANTHROPIC_API_KEY` secret runs:

```bash
cod run "list the files in the current directory using Glob"
```

This validates the full stack from CLI invocation through LLM API call, tool execution, and output rendering.

\newpage

# Development Roadmap

## v1.0 — Current Implementation

All core systems implemented and tested:

- [x] Monorepo foundation (pnpm + Turborepo)
- [x] `@cod/types` — all critical interfaces
- [x] `@cod/config` — Zod schema, multi-source loader
- [x] `@cod/llm` — all four provider adapters
- [x] `@cod/permissions` — five-mode engine
- [x] `@cod/hooks` — pre/post tool hook runner
- [x] `@cod/mcp` — MCP client (stdio + SSE)
- [x] `@cod/memory` — COD.md loader, `@`-imports, git context
- [x] `@cod/session` — session management, sliding window compression
- [x] `@cod/agent` — full agentic loop
- [x] `@cod/tui` — Ink TUI with streaming, tool visualization, permission prompts
- [x] `apps/cli` — Commander.js CLI, interactive + non-interactive modes
- [x] GitHub Actions CI/CD pipeline
- [x] Apache-2.0 license, README, CONTRIBUTING

## v1.1 — Robustness and Polish

- [ ] Fix Anthropic adapter: deduplicate `message_complete` event (emitted from both `message_delta` and `finalMessage()`)
- [ ] Fix OpenAI adapter: use actual tool-call IDs rather than array indices
- [ ] Fix `useAgent` hook: ensure React closure correctness in event handler
- [ ] Add MSW-based adapter unit tests with recorded SSE fixtures
- [ ] Improve `WebFetch` HTML-to-markdown conversion (consider `unified`/`rehype`)
- [ ] Add `--json` output flag for non-interactive mode (machine-readable output)
- [ ] First-run interactive setup wizard for API key configuration
- [ ] `cod doctor` command to validate configuration and connectivity

## v1.2 — Extended Tool Suite

- [ ] `NotebookEdit` tool — edit Jupyter notebook cells
- [ ] `GitDiff` tool — structured diff output
- [ ] `ImageCapture` — screenshot tool (desktop environments)
- [ ] Multi-file `Read` batching (read multiple files in one tool call)
- [ ] `Glob` improvement: proper miniglob library (currently custom implementation)
- [ ] `Grep` improvement: integrate ripgrep binary via execa for performance

## v1.3 — Collaboration Features

- [ ] Session persistence to `~/.cod/sessions/` with resumption
- [ ] Session export as Markdown transcript
- [ ] Shared project-level session history (`.cod/history`)
- [ ] `cod replay <session-id>` to review past sessions

## v2.0 — VS Code Extension

- [ ] VS Code extension (`apps/vscode`) that embeds `@cod/agent` and `@cod/tui`
- [ ] Sidebar panel with conversation UI
- [ ] Automatic workspace context injection
- [ ] Diff preview before applying file edits
- [ ] Integration with VS Code's permission prompts

\newpage

# Appendix A: Tool Input Schemas

## Read

```
{
  file_path:  string   (required) — Absolute or relative path to file
  offset:     integer  (optional) — Starting line number (1-indexed)
  limit:      integer  (optional) — Maximum lines to return
}
```

## Glob

```
{
  pattern:    string   (required) — Glob pattern, e.g. "**/*.ts"
  path:       string   (optional) — Search root directory (default: cwd)
}
```

## Grep

```
{
  pattern:         string                                (required) — Regex pattern
  path:            string                                (optional) — File or directory
  glob:            string                                (optional) — File filter pattern
  output_mode:     "content"|"files_with_matches"|"count" (default: "files_with_matches")
  case_insensitive: boolean                              (default: false)
  context:         integer                               (optional) — Lines before/after match
  head_limit:      integer                               (optional) — Max results
}
```

## Write

```
{
  file_path:  string   (required) — Path to write
  content:    string   (required) — Full file content
}
```

## Edit

```
{
  file_path:   string   (required) — Path to edit
  old_string:  string   (required) — Exact text to replace
  new_string:  string   (required) — Replacement text
  replace_all: boolean  (default: false)
}
```

## MultiEdit

```
{
  file_path:  string   (required) — Path to edit
  edits:      array    (required, min 1) — List of {old_string, new_string, replace_all?}
}
```

## Bash

```
{
  command:      string   (required) — Shell command to execute
  timeout:      integer  (default: 120000) — Timeout in milliseconds
  description:  string   (optional) — Human-readable description
}
```

## WebFetch

```
{
  url:         string   (required) — Full URL to fetch
  prompt:      string   (optional) — What to extract from the content
  max_length:  integer  (default: 50000) — Max characters to return
}
```

## Task

```
{
  description:    string   (required) — Short task description (3–5 words)
  prompt:         string   (required) — Detailed task instructions for the subagent
  subagent_type:  string   (optional) — Type of subagent to use
}
```

## TodoWrite

```
{
  todos:  array  (required) — Full todo list: [{id, content, status, priority}]
              status: "pending"|"in_progress"|"completed"
              priority: "low"|"medium"|"high"
}
```

## TodoRead

```
{}  — No inputs required
```

\newpage

# Appendix B: `AgentEvent` Reference

| Event Type | Fields | When Emitted |
|---|---|---|
| `thinking_start` | — | Before first LLM call in a turn |
| `text_delta` | `text: string` | Each text token from LLM |
| `tool_call_start` | `call: ToolCall` | When LLM begins streaming a tool call |
| `tool_call_permission_request` | `call, request` | When permission prompt is shown |
| `tool_call_executing` | `call: ToolCall` | After permission granted, before execute |
| `tool_call_complete` | `call, result, durationMs` | After tool returns |
| `tool_call_denied` | `call, reason?` | When hook or permission engine denies |
| `subagent_start` | `taskId, description` | When Task tool spawns a subagent |
| `subagent_complete` | `taskId, result` | When subagent finishes |
| `turn_complete` | `usage, stopReason` | After each LLM response |
| `context_compressed` | `before, after` | After context compression runs |
| `error` | `error, fatal` | On errors (fatal=true stops the loop) |

\newpage

# Appendix C: `LLMStreamEvent` Reference

| Event Type | Fields | Notes |
|---|---|---|
| `text_delta` | `delta: string` | One or more characters of text |
| `tool_use_start` | `id, name` | Tool call begins; input streaming starts |
| `tool_use_input_delta` | `id, delta` | Partial JSON input for a tool call |
| `tool_use_complete` | `id, name, input` | Full parsed input; safe to execute |
| `message_complete` | `usage, stopReason` | Final event; emitted once per response |
| `error` | `error: Error` | Adapter-level error; consumer should stop iterating |

Valid `StopReason` values: `end_turn`, `tool_use`, `max_tokens`, `stop_sequence`, `error`.

\newpage

# Appendix D: Glossary

**Agent loop** — The iterative LLM → tool execution → LLM cycle that continues until the model returns `end_turn` or all tool calls are denied.

**Adapter** — An implementation of `LLMAdapter` that normalizes a specific provider's streaming API to the `LLMStreamEvent` union type.

**Context window** — The maximum number of tokens the LLM can process in a single request (includes both the prompt/history and the generated response).

**Hook** — A shell command configured to run before or after a tool call. Receives event JSON on stdin and can allow, deny, or modify the call.

**MCP (Model Context Protocol)** — An open standard for LLM tool servers. Defines a wire protocol for tool discovery and invocation.

**Permission mode** — One of five operating modes that control which tool calls require explicit user approval.

**Session** — The ordered list of messages (user turns and assistant turns) that forms the conversation history sent to the LLM on each request.

**Subagent** — A nested `CodAgent` instance created by the `Task` tool to handle a self-contained subtask with its own session.

**System prompt** — The initial instruction text sent to the LLM before the conversation history. Built from the base persona, global memory, project memory, and git context.

**Tool registry** — The `ToolRegistry` instance that maps tool names to `ToolDefinition` objects. Includes both built-in tools and MCP-registered tools.

**Turborepo** — The build orchestration tool that manages the task dependency graph across packages in the monorepo, enabling parallel builds and incremental caching.
