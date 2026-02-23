# COD — Open Source AI Coding Assistant

**COD** is a fully open source, npm-publishable CLI AI coding assistant with feature parity with Anthropic's Claude Code. It is multi-provider (Anthropic, OpenAI, Google Gemini, Ollama), built in TypeScript, and ships as the `cod` command.

## Quick Start

```bash
# Install globally
npm install -g cod

# Set your API key
export ANTHROPIC_API_KEY=your-key-here

# Interactive REPL
cod

# One-shot prompt
cod "fix all TypeScript errors in src/"

# Explicit non-interactive mode
cod run "explain this codebase"
```

## Features

- **Multi-provider**: Anthropic (Claude), OpenAI (GPT-4), Google (Gemini), Ollama (local)
- **Interactive TUI**: Streaming terminal UI with tool call visualization
- **All Claude Code tools**: Read, Glob, Grep, Write, Edit, MultiEdit, Bash, WebFetch, Task, TodoWrite, TodoRead
- **MCP support**: Connect Model Context Protocol servers (stdio, SSE, HTTP)
- **Permission modes**: 5 modes from BypassPermissions to Plan (read-only)
- **Hook system**: Pre/post tool hooks for automation and control
- **Memory**: COD.md / CLAUDE.md project memory + global `~/.cod/MEMORY.md`
- **Context compression**: Auto-compacts conversation at 85% of context window
- **Slash commands**: Built-in + custom markdown commands in `.cod/commands/`
- **Git context**: Auto-injects branch + status into system prompt

## Installation

```bash
npm install -g cod
```

Or use without installing:
```bash
npx cod "your prompt here"
```

## Configuration

COD loads configuration from (in order, later values win):
1. Built-in defaults
2. `~/.cod/config.json` (global)
3. `.cod/config.json` (project)
4. Environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`)
5. CLI flags (`--model`, `--provider`)

### Providers

| Provider | Env Var | Example Models |
|---|---|---|
| `anthropic` (default) | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6`, `claude-opus-4-6` |
| `openai` | `OPENAI_API_KEY` | `gpt-4o`, `gpt-4-turbo` |
| `gemini` | `GEMINI_API_KEY` | `gemini-1.5-pro`, `gemini-1.5-flash` |
| `ollama` | `OLLAMA_BASE_URL` | `llama3`, `codestral` |

Switch provider: `cod --provider openai --model gpt-4o`

### Permission Modes

| Mode | Description |
|---|---|
| `default` | Prompts for shell commands and destructive operations |
| `acceptEdits` | Auto-approves file edits, prompts for shell |
| `plan` | Read-only — no file changes or shell commands |
| `dontAsk` | Approves everything (except blocked commands) |
| `bypassPermissions` | Bypasses all permission checks |

```bash
cod --mode acceptEdits "refactor the auth module"
```

## CLI Commands

```bash
# Interactive REPL
cod

# One-shot prompt
cod "describe this project"
cod run "run the tests and fix failures"

# Configuration
cod config get model
cod config set model claude-opus-4-6

# MCP Servers
cod mcp list
cod mcp add github npx @modelcontextprotocol/server-github
cod mcp remove github

# Self-update
cod update
```

## Slash Commands (Interactive Mode)

| Command | Description |
|---|---|
| `/help` | Show available commands |
| `/clear` | Clear conversation history |
| `/compact` | Trigger context compression |
| `/model [name]` | Show/switch model |
| `/mode [mode]` | Show/switch permission mode |
| `/memory <text>` | Add note to COD.md |
| `/cost` | Show token usage |
| `/status` | Show current status |

### Custom Commands

Add markdown files to `.cod/commands/` (project) or `~/.cod/commands/` (global):

```markdown
---
description: Deploy to production
---
Run the deployment checklist: check tests pass, build artifacts, and deploy to prod.
```

Then use `/deploy` in the interactive REPL.

## MCP Integration

COD supports Model Context Protocol servers for extended tool capabilities:

```bash
# Add a GitHub MCP server
cod mcp add github npx @modelcontextprotocol/server-github

# Or configure in .mcp.json
```

```json
{
  "github": {
    "type": "stdio",
    "command": "npx",
    "args": ["@modelcontextprotocol/server-github"],
    "env": { "GITHUB_TOKEN": "..." }
  }
}
```

MCP tools are available as `serverName__toolName` (e.g., `github__search_repositories`).

## Hooks

Pre/post tool hooks for automation. Configure in `.cod/config.json`:

```json
{
  "hooks": {
    "preToolUse": {
      "Bash": [{ "command": "echo '{\"decision\":{\"type\":\"allow\"}}'" }]
    },
    "postToolUse": {
      "*": [{ "command": "my-audit-script.sh" }]
    }
  }
}
```

Hooks receive event JSON on stdin, return JSON with `{ "decision": { "type": "allow" | "deny", "reason": "..." } }`.

## Project Memory

Create `COD.md` in your project root:

```markdown
# My Project

## Tech Stack
- TypeScript + Node.js
- PostgreSQL for persistence
- Jest for testing

## Conventions
- Use kebab-case for file names
- All API handlers go in src/api/
```

COD automatically loads this into the system prompt.

## Architecture

```
cod/
├── packages/
│   ├── types/       @cod/types       # Shared interfaces (LLMAdapter, AgentEvent, etc.)
│   ├── config/      @cod/config      # Settings schema, config loader, paths
│   ├── llm/         @cod/llm         # Provider adapters (Anthropic, OpenAI, Gemini, Ollama)
│   ├── tools/       @cod/tools       # Built-in tool implementations + registry
│   ├── permissions/ @cod/permissions # 5-mode permission engine
│   ├── hooks/       @cod/hooks       # Pre/post tool hook runner
│   ├── mcp/         @cod/mcp         # MCP client manager
│   ├── memory/      @cod/memory      # COD.md loader + system prompt builder
│   ├── session/     @cod/session     # Conversation history + context compression
│   ├── agent/       @cod/agent       # CodAgent orchestrator + event loop
│   └── tui/         @cod/tui         # Ink/React terminal UI
└── apps/
    └── cli/         cod              # Published npm binary
```

## Development

```bash
# Clone and install
git clone https://github.com/cod-dev/cod.git
cd cod
pnpm install

# Build all packages
pnpm turbo build

# Run tests
pnpm turbo test

# Watch mode for a package
cd packages/agent
pnpm dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for your changes
4. Run `pnpm turbo build test`
5. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

Apache-2.0 — see [LICENSE](LICENSE) for details.
