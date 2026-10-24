# 22 — Productivity Benchmarks and Evidence Protocol

**Founder goal:** at most 25 NAJA lines for an equivalent 100-line Rust/C++ task, plus less development time. **Status:** protocol and proposed cases only; no measured advantage exists in this package.

## 1. Freeze comparisons before measuring

Before implementing benchmark-specific solutions, record each scenario's behavior, target, inputs, error cases, accepted libraries/versions, formatter/counting rules, timing design and resource budgets. Obtain independent review when available. Store the registration hash and commit. New test cases may strengthen behavior; they must not selectively penalize a baseline.

A reversible implementation detail can change by ADR. Dropping a required case, weakening behavior or relaxing the 25% target requires explicit founder approval. Publish any such change and rerun all affected implementations. Never tune the rule after viewing scores to make a failure disappear.

## 2. Six required matched cases

| ID | Scenario | Required behavior in all three languages |
|---|---|---|
| DX01 | Freestanding microkernel | Same documented x86-64 QEMU machine/boot protocol; serial startup; inspect boot memory information; configure a bounded periodic timer interrupt; emit a fixed tick sequence and halt cleanly. No hosted OS or mock timer. |
| DX02 | Framed TCP echo application | Loopback server, capped length-prefixed frames, partial read/write handling, several clients, malformed/oversized input, deadlines and graceful cancellation. |
| DX03 | HTTP JSON application | Health route plus validated JSON request route, correct statuses/response shape, bounded input, malformed-input rejection, logging and clean shutdown. |
| DX04 | CLI file utility | Parse arguments, stream a declared text transformation, validate options/input, handle Unicode/I/O errors and cancellation, commit output through the declared replacement policy. |
| DX05 | CSV aggregation pipeline | Explicit region/amount schema, validation, filter, bounded grouping, sum, deterministic output and no silently dropped malformed rows. Check negative values, quoted fields, large records and group-limit behavior. |
| DX06 | JSONL-to-CSV validation pipeline | Stream records, validate a pinned schema, project/transform fields, produce deterministic CSV, report invalid-record policy, cap memory/record size, close resources and handle output errors/cancellation. |

DX01 proves a bounded microkernel demonstration, not a complete OS. Its reference execution is the same emulated machine regardless of the host OS. Hosted cases must function on the three product targets; designate one pinned reference machine for line/time/resource comparisons and publish other-platform tests separately. Do not require identical performance across OSes.

Freeze exact payloads, data sizes, output ordering, overflow rules, clock policy and failure thresholds in `benchmarks/productivity/cases.json` before implementation. Initial proposed data workloads should include tiny, normal and deliberately resource-exceeding inputs; choose values before results, not afterwards.

## 3. Baselines: idiomatic, not deliberately verbose

For each case provide both real Rust and real C++ solutions, reviewed for idiomatic code and correctness. Same observable features and error/security/resource requirements. Allow normal reusable libraries/frameworks and target support at pinned versions; do not grant NAJA a standard-library framework while forcing competitors to manually reimplement the entire TCP or boot stack.

Report two comparison tracks when useful: standard/minimal-SDK-only and normal idiomatic ecosystem libraries. **The required 25% gate uses the normal idiomatic track against both languages**, not only an artificially long baseline. Identify the reviewer and disclose self-review. Do not pad comments, boilerplate, wrappers or unused features.

Where no equivalent implementation or matching capability exists, mark the case blocked/non-comparable and explain; do not record a pass or quietly remove it.

Rust/C++ benchmark toolchains are comparison infrastructure only and must not enter NAJA's distribution or autonomous build closure.

## 4. What counts as developer-maintained code

For each language record:

- **Formatted source lines (FLOC):** nonblank, noncomment lines after the pinned readable formatter, with imports, declarations, executable code and required handlers. Report delimiter-only lines separately.
- **Normalized authored lines (NLOC):** the primary fair-comparison measure. Ignore lines containing only structural delimiters; count each logical statement/declaration, each independently meaningful chain/pipeline operation and each task-specific configuration entry. One logical item cannot be packed with others to reduce the score. Multiline formatting alone cannot multiply or shrink the count.
- **Total task footprint:** all developer-owned source/helper files, required custom glue, macros/DSL rules, target shims, build/linker configuration and manifest settings specific to the task. Apply the same normalization to all languages. This total is the NLOC numerator/denominator used by the gate.

Publish a file-by-file count ledger and the versioned counting specification/tool. Ambiguous syntax gets a reviewed rule fixed before scoring, not a language-favoring exception. Retain physical-line totals so readers can inspect the actual “100 lines to 25” source examples.

Do not exclude task-specific logic by moving it into an extra library, template, string, code generator or checked-in generated file. Developer-edited generated code counts. Fully generator-owned output may be excluded from authored NLOC only when its generator is a general released library; count its task-specific input and disclose generated output size. Generic untouched project scaffold and external reusable libraries are reported separately under identical rules for all three languages.

Acceptance-test code is reported separately, with shared behavior coverage; it is not erased from development-time measurement. Standard-library internals and their engineering cost are reported separately, never described as work that disappeared.

## 5. Code-size acceptance equation

Let `N`, `R`, `C` be the total normalized developer-maintained footprint for NAJA, Rust and C++ on one equivalent case:

```text
N / R <= 0.25
N / C <= 0.25
Equivalent: N <= 0.25 * min(R, C)
```

For a best baseline of 100, N must be <=25; for a best baseline of 60, N must be <=15. These are arithmetic illustrations, not measurements. All six cases must pass individually. Do not round a failing ratio down or use a cross-case average to hide a miss.

The target cannot meaningfully guarantee fourfold shortening of every one-line expression. Public claims must name the cases and counting method. This is not an instruction to golf the language or conceal required code.

## 6. Measure actual development time separately

Record both initial implementation and a preregistered realistic change request, such as adding a validated field, a filter or a bounded event handler. Start from the same supplied task description and allowed templates, not a completed answer in one language and a blank project in another.

Record wall-clock time, active authoring/debugging time, compile/test waiting, setup/learning and review time separately. Publish first-use and steady-state scenarios. Include failed attempts; do not stop clocks at the first green compile if acceptance still fails.

Use matched experience/tooling and counterbalanced order where possible. At minimum perform a controlled pilot with three independent runs per language per scenario; publish sample size, variability and prior exposure. Three runs are not enough for universal human-productivity claims. Pre-register uncertainty handling; an inconclusive result is not a demonstrated time reduction.

For the pilot acceptance, NAJA must demonstrate a lower measured median time to accepted solution and to accepted change than both baselines under the declared protocol, with differences distinguishable from the protocol's stated timing/variation limits. Otherwise mark the time target unmet or inconclusive and improve/retest; do not infer it from line counts.

If coding agents perform the pilot, hold model/version/tool permissions/task prompts and compute budgets comparable, record retries/cache/context and label results **AI-assisted implementation sessions**, not human developer productivity. Do not fabricate human participants or use token counts as elapsed time. Tool installation/initial library construction costs remain separately visible.

No 4x time-reduction threshold is imposed by the founder's code-line example. Report the actual time ratio, whether favorable or not.

## 7. Behavior, safety and execution performance are gates too

Run shared black-box correctness/error/resource tests against all implementations. Confirm native execution, actual bare-metal behavior for DX01, and absence of Python/delegated execution in NAJA. Verify bounds, validation, concurrency/cancellation, cleanup and equivalent numeric semantics.

Pre-register acceptable execution budgets for each scenario: startup, throughput/latency, peak memory, allocations, binary size and build time where relevant. Set these from use requirements, not after measuring. A code-size win is invalid if correctness or a required safety/resource budget fails. Keep document 19's AOT protection tests; the short API does not waive them.

For data pipelines test truly bounded input processing and declared aggregation limits, not only a tiny all-in-memory file. For the kernel count custom boot/assembly/link scripts and use identical support assumptions. Do not hide a hosted process behind a microkernel label.

## 8. Evidence artifacts and R19

Create `benchmarks/productivity/` with cases, three-language sources, fixed inputs, pinned dependencies/formatters, counted-file ledger, counting tool and shared tests. Publish:

- `reports/productivity/RESULTS.json`: raw counts/times/resources, hashes, commit and statuses; no invented zero values for unmeasured results.
- `reports/productivity/REPORT.md`: per-case table, method, successes, misses, limits and reviewer.
- `reports/productivity/LIBRARY_COST.md`: reusable library implementation/maintenance footprint, dependency and unsafe-surface inventory.

Link to PROD requirements and R19. Start results as `not_run` with `null` measurements. Passing a schema validator is not a passing benchmark. A missing baseline, unexecuted timing pilot, incomparable semantics or any mandatory failed case blocks full HATCH completion under this revision.

## 9. Allowed public statement after evidence

“On the published HATCH tasks, NAJA required X% fewer normalized developer-maintained lines than the stated Rust and C++ baselines. Timed [human or AI-assisted] sessions and runtime measurements are reported separately.”

Until then: “NAJA targets at least 75% less task-specific code through its standard library; the comparison suite is under implementation.”
