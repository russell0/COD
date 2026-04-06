#!/bin/bash
# Run COD+Gemma on the benchmark N times and collect results.
# Usage: ./run_study.sh [num_runs] [provider] [model]

NUM_RUNS=${1:-3}
PROVIDER=${2:-lm-studio}
MODEL=${3:-google/gemma-4-e2b}
BENCHMARK_DIR="$(cd "$(dirname "$0")" && pwd)"
COD_CLI="$(dirname "$BENCHMARK_DIR")/apps/cli/dist/index.js"
RESULTS_DIR="$BENCHMARK_DIR/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$RESULTS_DIR"

echo "========================================"
echo "  Gemma Benchmark Study"
echo "  Runs: $NUM_RUNS"
echo "  Provider: $PROVIDER"
echo "  Model: $MODEL"
echo "  Time: $TIMESTAMP"
echo "========================================"

for i in $(seq 1 $NUM_RUNS); do
    echo ""
    echo "--- Run $i/$NUM_RUNS ---"
    SOLUTION="$RESULTS_DIR/solution_${TIMESTAMP}_run${i}.py"

    # Run COD
    node "$COD_CLI" run \
        --provider "$PROVIDER" \
        --model "$MODEL" \
        --fafo \
        --cwd "$BENCHMARK_DIR" \
        "Read challenge_v3.md once. Write solution.py with complete implementations of ALL tasks listed. Match exact function signatures." \
        2>&1 | tail -3

    # Copy solution
    if [ -f "$BENCHMARK_DIR/solution.py" ]; then
        cp "$BENCHMARK_DIR/solution.py" "$SOLUTION"
        echo "Evaluating run $i..."
        python3 "$BENCHMARK_DIR/evaluate_v3.py" "$SOLUTION" "${PROVIDER}_run${i}" 2>&1 | grep -E "RESULT:|Cat "
        rm -f "$BENCHMARK_DIR/solution.py"
    else
        echo "Run $i: SOLUTION NOT CREATED"
    fi
done

echo ""
echo "========================================"
echo "  Study Complete"
echo "  Results in: $RESULTS_DIR"
echo "========================================"

# Analyze
python3 "$BENCHMARK_DIR/analyze.py" "$RESULTS_DIR" 2>/dev/null
