#!/usr/bin/env python3
"""Analyze benchmark results across multiple runs."""
import json
import sys
import os
import glob


def main():
    results_dir = sys.argv[1] if len(sys.argv) > 1 else "results"

    pattern = os.path.join(results_dir, "solution_*_score.json")
    files = sorted(glob.glob(pattern))

    if not files:
        print("No result files found.")
        return

    print(f"\n{'='*60}")
    print(f"  Benchmark Analysis: {len(files)} runs")
    print(f"{'='*60}\n")

    scores = []
    category_scores = {}

    for f in files:
        with open(f) as fh:
            data = json.load(fh)
        scores.append(data["percentage"])
        for cat, cs in data.get("categories", {}).items():
            if cat not in category_scores:
                category_scores[cat] = []
            pct = (cs["pass"] / cs["total"] * 100) if cs["total"] > 0 else 0
            category_scores[cat].append(pct)
        print(f"  {os.path.basename(f)}: {data['total_pass']}/{data['total_tests']} ({data['percentage']}%)")

    if scores:
        avg = sum(scores) / len(scores)
        best = max(scores)
        worst = min(scores)
        print(f"\n  Average: {avg:.1f}%")
        print(f"  Best:    {best:.1f}%")
        print(f"  Worst:   {worst:.1f}%")
        print(f"  Spread:  {best - worst:.1f}%")

    if category_scores:
        print(f"\n  Category Averages:")
        cat_names = {
            "1": "Data Structures", "2": "Strings", "3": "Sort/Search",
            "4": "Dynamic Prog", "5": "Graphs", "7": "Math",
            "9": "Simulation", "10": "Utilities"
        }
        for cat in sorted(category_scores.keys(), key=lambda x: int(x)):
            vals = category_scores[cat]
            avg = sum(vals) / len(vals) if vals else 0
            name = cat_names.get(cat, f"Cat {cat}")
            bar = "#" * int(avg / 5)
            print(f"    Cat {cat:>2} ({name:15s}): {avg:5.1f}% {bar}")

    # Write summary
    summary_path = os.path.join(results_dir, "summary.json")
    with open(summary_path, "w") as f:
        json.dump({
            "num_runs": len(scores),
            "average": round(sum(scores)/len(scores), 1) if scores else 0,
            "best": max(scores) if scores else 0,
            "worst": min(scores) if scores else 0,
            "category_averages": {
                cat: round(sum(vals)/len(vals), 1)
                for cat, vals in category_scores.items()
            }
        }, f, indent=2)

    print(f"\n  Summary written to {summary_path}")


if __name__ == "__main__":
    main()
