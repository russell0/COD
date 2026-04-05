# Bug Fix Log: COD + LM Studio + Gemma 4 E2B

## Bug 1: Duplicate shebang in CLI output
- **Symptom:** `node apps/cli/dist/index.js --version` threw `SyntaxError: Invalid or unexpected token`
- **Root cause:** `apps/cli/src/index.ts` had `#!/usr/bin/env node` on line 1, AND `tsup.config.ts` added another via `banner: { js: '#!/usr/bin/env node' }`. The built output had two shebangs.
- **Fix:** Removed the shebang from `src/index.ts` since tsup adds it automatically.
- **Test:** Test 3 now passes — COD CLI executes correctly.

## Bug 2: Gemma chat completion returning empty content with low max_tokens
- **Symptom:** API returned `content: ""` for simple prompts with `max_tokens: 64`.
- **Root cause:** Gemma 4 E2B uses `reasoning_content` (internal chain-of-thought). With only 64 tokens, all budget went to reasoning, leaving nothing for the actual response.
- **Fix:** Increased test `max_tokens` to 512 to accommodate reasoning + response.
- **Test:** Test 4 now passes.

## Bug 3: No LM Studio adapter existed
- **Symptom:** No way to connect COD to LM Studio.
- **Root cause:** COD only supported Anthropic, OpenAI, Gemini, and Ollama as providers.
- **Fix:** Created `packages/llm/src/adapters/lmstudio.ts` (wraps OpenAIAdapter with `localhost:1234/v1`), registered in `LLMRegistry`, added `lm-studio` to provider enum, added `lmstudioBaseUrl` config field, added `LM_STUDIO_BASE_URL` env var support.
- **Test:** Tests 9, 14, 15 all pass — COD talks to LM Studio via `--provider lm-studio`.

## Bug 4: Gemma models not in context window map
- **Symptom:** Gemma models would use the 100K default instead of their actual 128K context.
- **Root cause:** `MODEL_CONTEXT_WINDOWS` in `agent.ts` didn't include any Gemma model entries.
- **Fix:** Added `google/gemma-4-e2b`, `gemma-4-e2b`, `google/gemma-4-e2b@q4_k_m`, and 27B variants with 131,072 context.
- **Test:** Test 11 passes — context window correctly returns 131072.

## Files Modified
1. `packages/llm/src/adapters/lmstudio.ts` — NEW: LM Studio adapter
2. `packages/llm/src/index.ts` — Added lmstudio export
3. `packages/llm/src/registry.ts` — Registered LMStudioAdapter
4. `packages/config/src/schema.ts` — Added `lm-studio` provider, `lmstudioBaseUrl` field
5. `packages/config/src/loader.ts` — Added `LM_STUDIO_BASE_URL` env var
6. `packages/agent/src/agent.ts` — Added Gemma model context windows
7. `apps/cli/src/index.ts` — Removed duplicate shebang, added `lm-studio` to provider options, added LM Studio to first-run help
8. `apps/cli/src/bootstrap.ts` — Added `lm-studio` to provider type
