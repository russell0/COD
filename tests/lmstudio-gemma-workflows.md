# COD + LM Studio + Gemma 4 E2B: Workflow Test Inventory

## Happy Paths
1. **Basic connection** — COD connects to LM Studio at localhost:1234
2. **Simple prompt** — COD sends a prompt, Gemma responds with text
3. **Tool calling: Read** — Gemma calls the Read tool to read a file
4. **Tool calling: Bash** — Gemma calls the Bash tool to run a command
5. **Tool calling: Glob** — Gemma calls the Glob tool to find files
6. **Tool calling: Grep** — Gemma calls the Grep tool to search content
7. **Tool calling: Write** — Gemma calls the Write tool to create a file
8. **Tool calling: Edit** — Gemma calls the Edit tool to modify a file
9. **Multi-turn conversation** — Multiple back-and-forth exchanges
10. **Streaming** — Response streams token-by-token (not all at once)

## Edge Cases
11. **Empty prompt** — What happens with an empty string prompt
12. **Very long prompt** — Prompt near context window limit
13. **Model identifier variants** — google/gemma-4-e2b vs gemma-4-e2b
14. **Context window lookup** — Gemma models return 131072 not the 100K default
15. **No tools needed** — Simple question that doesn't require tool use

## Error Paths
16. **LM Studio not running** — Connection refused error handled gracefully
17. **Wrong model name** — Invalid model identifier
18. **Tool call with bad JSON** — Malformed tool arguments from model
19. **API timeout** — Slow response handling

## Integration Seams
20. **Provider switching** — CLI flag --provider lm-studio works
21. **Config file** — JSON config with provider: "lm-studio" works
22. **Env var** — LM_STUDIO_BASE_URL environment variable works
23. **Non-interactive mode** — `cod run "prompt" --provider lm-studio` works

## State Transitions
24. **Tool execution loop** — Model calls tool → gets result → continues
25. **Multi-tool sequence** — Model chains multiple tool calls
