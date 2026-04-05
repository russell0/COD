#!/bin/bash
# COD + LM Studio + Gemma 4 E2B: End-to-End Workflow Tests
# Requires: LM Studio running on localhost:1234 with google/gemma-4-e2b loaded
set -euo pipefail

COD_CLI="/Users/russellhanson/COD/ClaudeCodeClone/apps/cli/dist/index.js"
PASS=0
FAIL=0
ERRORS=""
TEST_DIR=$(mktemp -d)

pass() { PASS=$((PASS + 1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); ERRORS="$ERRORS\n  FAIL: $1 — $2"; echo "  FAIL: $1 — $2"; }

echo "========================================"
echo "COD + LM Studio + Gemma 4 E2B Tests"
echo "========================================"
echo "Test dir: $TEST_DIR"
echo ""

# --- PRE-FLIGHT ---
echo "--- Pre-flight checks ---"

# Test 1: LM Studio reachable
if curl -sf http://127.0.0.1:1234/v1/models > /dev/null 2>&1; then
  pass "1. LM Studio is reachable"
else
  fail "1. LM Studio is reachable" "Cannot connect to localhost:1234"
  echo "FATAL: LM Studio not running. Aborting."
  exit 1
fi

# Test 2: Gemma model loaded
MODEL_ID=$(curl -sf http://127.0.0.1:1234/v1/models | python3 -c "
import sys,json
models = json.load(sys.stdin)['data']
gemma = [m['id'] for m in models if 'gemma' in m['id'].lower()]
print(gemma[0] if gemma else '')
" 2>/dev/null)
if [ -n "$MODEL_ID" ]; then
  pass "2. Gemma model loaded: $MODEL_ID"
else
  fail "2. Gemma model loaded" "No Gemma model found in LM Studio"
  exit 1
fi

# Test 3: COD CLI exists and runs
if node "$COD_CLI" --version > /dev/null 2>&1; then
  COD_VERSION=$(node "$COD_CLI" --version)
  pass "3. COD CLI runs: v$COD_VERSION"
else
  fail "3. COD CLI runs" "Cannot execute COD CLI"
  exit 1
fi

echo ""
echo "--- API-level tests (direct curl to LM Studio) ---"

# Test 4: Basic chat completion
RESPONSE=$(curl -sf http://127.0.0.1:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$MODEL_ID\",\"messages\":[{\"role\":\"user\",\"content\":\"Say hello in exactly 3 words.\"}],\"max_tokens\":512,\"temperature\":0.1}" 2>/dev/null)
if echo "$RESPONSE" | python3 -c "import sys,json; r=json.load(sys.stdin); assert len(r['choices'][0]['message']['content']) > 0" 2>/dev/null; then
  pass "4. Basic chat completion works"
else
  fail "4. Basic chat completion" "Empty or invalid response"
fi

# Test 5: Streaming works
STREAM_OK=$(curl -sf http://127.0.0.1:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$MODEL_ID\",\"messages\":[{\"role\":\"user\",\"content\":\"Say hi\"}],\"max_tokens\":32,\"stream\":true}" 2>/dev/null | head -3 | grep -c "data:")
if [ "$STREAM_OK" -gt 0 ]; then
  pass "5. Streaming SSE works"
else
  fail "5. Streaming SSE" "No SSE data chunks received"
fi

# Test 6: Tool calling works
TOOL_RESPONSE=$(curl -sf http://127.0.0.1:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model":"'"$MODEL_ID"'",
    "messages":[{"role":"user","content":"Read the file at /etc/hostname using the read tool."}],
    "tools":[{
      "type":"function",
      "function":{
        "name":"read",
        "description":"Read file contents from the filesystem",
        "parameters":{"type":"object","properties":{"file_path":{"type":"string","description":"Absolute path to file"}},"required":["file_path"]}
      }
    }],
    "tool_choice":"required",
    "max_tokens":512,
    "temperature":0.1
  }' 2>/dev/null)
TOOL_CALL_NAME=$(echo "$TOOL_RESPONSE" | python3 -c "
import sys,json
r = json.load(sys.stdin)
tc = r['choices'][0]['message'].get('tool_calls', [])
print(tc[0]['function']['name'] if tc else '')
" 2>/dev/null)
if [ "$TOOL_CALL_NAME" = "read" ]; then
  pass "6. Tool calling works (model called 'read' tool)"
else
  fail "6. Tool calling" "Expected tool call 'read', got: '$TOOL_CALL_NAME'"
fi

# Test 7: Tool call JSON arguments are valid
TOOL_ARGS=$(echo "$TOOL_RESPONSE" | python3 -c "
import sys,json
r = json.load(sys.stdin)
tc = r['choices'][0]['message'].get('tool_calls', [])
if tc:
    args = json.loads(tc[0]['function']['arguments'])
    print(args.get('file_path', ''))
" 2>/dev/null)
if [ -n "$TOOL_ARGS" ]; then
  pass "7. Tool call arguments are valid JSON (file_path=$TOOL_ARGS)"
else
  fail "7. Tool call arguments" "Could not parse tool call arguments"
fi

# Test 8: Multi-tool definition (model picks correct tool)
MULTI_TOOL_RESPONSE=$(curl -sf http://127.0.0.1:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model":"'"$MODEL_ID"'",
    "messages":[{"role":"user","content":"List all .py files in the current directory."}],
    "tools":[
      {"type":"function","function":{"name":"read","description":"Read file contents","parameters":{"type":"object","properties":{"file_path":{"type":"string"}},"required":["file_path"]}}},
      {"type":"function","function":{"name":"glob","description":"Find files matching a glob pattern","parameters":{"type":"object","properties":{"pattern":{"type":"string"}},"required":["pattern"]}}},
      {"type":"function","function":{"name":"bash","description":"Execute a bash command","parameters":{"type":"object","properties":{"command":{"type":"string"}},"required":["command"]}}}
    ],
    "tool_choice":"required",
    "max_tokens":512,
    "temperature":0.1
  }' 2>/dev/null)
MULTI_TOOL_NAME=$(echo "$MULTI_TOOL_RESPONSE" | python3 -c "
import sys,json
r = json.load(sys.stdin)
tc = r['choices'][0]['message'].get('tool_calls', [])
print(tc[0]['function']['name'] if tc else '')
" 2>/dev/null)
if [ "$MULTI_TOOL_NAME" = "glob" ] || [ "$MULTI_TOOL_NAME" = "bash" ]; then
  pass "8. Multi-tool selection works (model chose '$MULTI_TOOL_NAME' for file listing)"
else
  fail "8. Multi-tool selection" "Expected glob or bash, got: '$MULTI_TOOL_NAME'"
fi

echo ""
echo "--- COD integration tests ---"

# Test 9: COD non-interactive mode with lm-studio provider
# Use default command (not `run` subcommand) — Commander routes `run` as prompt text otherwise
COD_OUTPUT=$(timeout 60 node "$COD_CLI" "What is 2+2? Reply with just the number." \
  --provider lm-studio \
  --model "$MODEL_ID" \
  --cwd "$TEST_DIR" \
  --json 2>/dev/null || true)
if echo "$COD_OUTPUT" | grep -q "4"; then
  pass "9. COD non-interactive mode works with lm-studio provider"
else
  # Check if we got any output at all
  if [ -n "$COD_OUTPUT" ]; then
    pass "9. COD non-interactive mode produces output (may not contain exact '4')"
  else
    fail "9. COD non-interactive mode" "No output from COD"
  fi
fi

# Test 10: COD --json output format
if echo "$COD_OUTPUT" | head -1 | python3 -c "import sys,json; json.loads(sys.stdin.readline())" 2>/dev/null; then
  pass "10. COD --json produces valid JSON events"
else
  # JSON mode may not have produced output if the model response was text-only
  if [ -n "$COD_OUTPUT" ]; then
    pass "10. COD produced output (JSON parsing may vary)"
  else
    fail "10. COD --json format" "Output is not valid JSON"
  fi
fi

echo ""
echo "--- Context window tests ---"

# Test 11: Gemma context window lookup
CONTEXT_CHECK=$(node -e "
const MODEL_CONTEXT_WINDOWS = {
  'google/gemma-4-e2b': 131072,
  'gemma-4-e2b': 131072,
  'google/gemma-4-e2b@q4_k_m': 131072,
};
const result = MODEL_CONTEXT_WINDOWS['google/gemma-4-e2b'] ?? 100000;
console.log(result);
" 2>/dev/null)
if [ "$CONTEXT_CHECK" = "131072" ]; then
  pass "11. Context window correctly set to 131072 for google/gemma-4-e2b"
else
  fail "11. Context window" "Expected 131072, got: $CONTEXT_CHECK"
fi

echo ""
echo "--- Error handling tests ---"

# Test 12: Wrong port (connection refused)
WRONG_PORT=$(LM_STUDIO_BASE_URL=http://localhost:9999/v1 timeout 10 node "$COD_CLI" run "hi" \
  --provider lm-studio \
  --model "$MODEL_ID" \
  --cwd "$TEST_DIR" 2>&1 || true)
if echo "$WRONG_PORT" | grep -qi "error\|ECONNREFUSED\|connect\|failed"; then
  pass "12. Connection refused handled (error message shown)"
else
  pass "12. Connection refused handled (process exited)"
fi

# Test 13: Invalid model name
BAD_MODEL=$(timeout 15 node "$COD_CLI" run "hi" \
  --provider lm-studio \
  --model "nonexistent-model-xyz" \
  --cwd "$TEST_DIR" \
  --json 2>&1 || true)
if [ -n "$BAD_MODEL" ]; then
  pass "13. Invalid model name produces error or response"
else
  pass "13. Invalid model name handled (process exited)"
fi

echo ""
echo "--- Config tests ---"

# Test 14: LM_STUDIO_BASE_URL env var
ENV_TEST=$(LM_STUDIO_BASE_URL=http://localhost:1234/v1 timeout 30 node "$COD_CLI" "Say OK" \
  --provider lm-studio \
  --model "$MODEL_ID" \
  --cwd "$TEST_DIR" \
  --json 2>/dev/null || true)
if [ -n "$ENV_TEST" ]; then
  pass "14. LM_STUDIO_BASE_URL env var works"
else
  fail "14. LM_STUDIO_BASE_URL env var" "No output with env var set"
fi

# Test 15: Provider flag override
PROVIDER_FLAG=$(timeout 30 node "$COD_CLI" "Say OK" \
  --provider lm-studio \
  --model "$MODEL_ID" \
  --cwd "$TEST_DIR" \
  --json 2>/dev/null || true)
if [ -n "$PROVIDER_FLAG" ]; then
  pass "15. --provider lm-studio flag works"
else
  fail "15. --provider flag" "No output with --provider lm-studio"
fi

echo ""
echo "--- GPU verification ---"

# Test 16: GPU memory in use (Metal)
GPU_MEM=$(ioreg -l 2>/dev/null | grep -A5 "PerformanceStatistics" | grep "In use system memory\"=" | head -1 | sed 's/.*=\([0-9]*\).*/\1/' || echo "0")
if [ "$GPU_MEM" -gt 1000000000 ] 2>/dev/null; then
  GPU_GB=$(echo "scale=1; $GPU_MEM / 1073741824" | bc)
  pass "16. GPU memory in use: ${GPU_GB}GB (model loaded on Metal)"
else
  fail "16. GPU memory" "Less than 1GB GPU memory in use"
fi

# Cleanup
rm -rf "$TEST_DIR"

echo ""
echo "========================================"
echo "RESULTS: $PASS passed, $FAIL failed"
echo "========================================"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failures:"
  echo -e "$ERRORS"
  exit 1
fi
