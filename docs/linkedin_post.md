We got Gemma 4 E2B coding at 97% accuracy on a 29-task programming benchmark. Running locally on an M1 Max. No API calls. No cloud. No cost per query.

Full report: https://github.com/russell0/COD/blob/main/docs/Gemma_Coding_Full_Report.docx

The journey started at 0%. Not because Gemma can't code -- it turns out the model already knew the algorithms. It wrote correct comments about recursive descent parsers and then returned `return 0` as a placeholder. The problem was infrastructure: broken CLI flag parsing, a 4K default context window (on a 131K model), a Node.js v25 breaking change, and a streaming API that silently ignored the reasoning_effort parameter.

Fix the plumbing, add algorithmic hints (not solutions -- just "use greedy subtraction for Roman numerals"), feed test results back to the model, and suddenly a 27B parameter model running on your laptop is implementing merge sort, topological sort, dynamic programming, graph traversal, and matrix multiplication correctly. Every time.

What 97% accuracy on local inference actually means:

This isn't a party trick. A local coding model that reliably implements standard algorithms opens real workflows:

Automation scripts -- ETL pipelines, file processors, data transformers. The kind of code that's 80% boilerplate and 20% domain logic. Gemma handles the 80% without sending your proprietary data to anyone's API.

Prototype-to-production -- Spin up working implementations of data structures, search algorithms, graph algorithms. Test locally, iterate fast, no rate limits.

Offline development -- Planes, trains, restricted networks. Your coding assistant doesn't need WiFi.

Privacy-sensitive codebases -- Healthcare, finance, defense. Code that can't leave your machine now has an AI pair programmer that never phones home.

Content generation pipelines -- Build the automation that builds your content. Scrapers, formatters, analyzers, publishers -- all generated and tested locally.

Education and research -- Students and researchers get a capable coding assistant without subscription costs. Run experiments on model behavior without API billing anxiety.

What it can't do (yet):

Recursive descent parsers with 6 precedence levels. Regex engines from scratch. Complex multi-constraint problems where 5 rules must be satisfied simultaneously. These require 70B+ models or cloud inference. The boundary is clear and measurable -- which is the whole point of running a benchmark.

The real finding:

The gap between local and cloud AI coding is not a capability gap -- it's an infrastructure gap. Four one-line bug fixes accounted for more improvement than all the prompt engineering combined. The model was always capable. We just had to stop breaking its environment.

29 tasks. 8 categories. 160+ automated tests. 4 runs. All open source.

COD repo: https://github.com/russell0/COD
Benchmark: /benchmark/challenge_v3.md
Evaluator: /benchmark/evaluate_v3.py

#LocalAI #Gemma #OpenSource #CodingBenchmark #AIEngineering #LMStudio #OnDevice
