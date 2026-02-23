# Contributing to COD

## Development Setup

```bash
git clone https://github.com/cod-dev/cod.git
cd cod
pnpm install
pnpm turbo build
pnpm turbo test
```

## Monorepo Structure

This is a pnpm + Turborepo monorepo. Each package in `packages/` and `apps/` is independently buildable.

**Dependency order** (no cycles allowed):
```
@cod/types → @cod/config → @cod/llm, @cod/permissions, @cod/hooks
                                    ↓
                          @cod/tools → @cod/session → @cod/agent → @cod/tui → apps/cli
                                    ↑
                          @cod/mcp, @cod/memory (also feed into agent)
```

## Non-Negotiable Constraints

These cannot change without coordinating across all packages:

1. **ESM-only** — `"type": "module"` everywhere, `"module": "Node16"` in tsconfig
2. **`LLMStreamEvent` shape** — All 4 adapters and the agent loop depend on this union
3. **`AgentEvent` stream type** — TUI and agent loop both depend on it
4. **`PermissionMode` enum values** — Hardcoded in engine, tools, config, and agent
5. **Package names `@cod/*`** — Import paths baked into every file

## Adding a New LLM Provider

1. Create `packages/llm/src/adapters/myprovider.ts` implementing `LLMAdapter`
2. The adapter must emit identical `LLMStreamEvent` types as other adapters
3. Register it in `packages/llm/src/registry.ts`
4. Add the API key to `packages/config/src/schema.ts`
5. Add unit tests with MSW mock fixtures

## Adding a New Tool

1. Create `packages/tools/src/implementations/mytool.ts`
2. Implement `ToolDefinition<TInput>` with a Zod `inputSchema`
3. Set `annotations.readOnly`, `annotations.destructive`, `annotations.requiresShell` correctly
4. Export from `packages/tools/src/index.ts` and register in `createDefaultRegistry()`
5. Add unit tests using temp directories

## Testing

- Unit tests: Vitest per package, `pnpm turbo test`
- LLM adapters: use MSW to mock HTTP fixtures
- Tools: use `fs.mkdtemp` for isolated temp directories
- Coverage: 80% lines, 75% branches, 85% functions

## Changesets

We use `@changesets/cli` for versioning:

```bash
# When you have changes ready:
pnpm changeset

# Follow the prompts to describe what changed
# Commit the generated .changeset/*.md file with your PR
```

## Pull Request Process

1. Branch from `main`: `git checkout -b feat/my-feature`
2. Make changes with tests
3. Run `pnpm turbo build test`
4. Create a changeset: `pnpm changeset`
5. Submit PR with a clear description

## Code Style

- TypeScript strict mode (no `any` unless absolutely necessary)
- ESM imports with `.js` extensions: `import { foo } from './bar.js'`
- No default exports in packages (use named exports)
- Keep packages lean: don't add dependencies that aren't needed
