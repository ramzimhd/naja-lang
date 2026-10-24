# 12 — HATCH Roadmap and Implementation Gates

These are verifiable milestones, not promised dates or durations. Agents must execute ready work, not repeatedly generate plans. A real session limit requires a precise checkpoint.

## H0 · 0.0 — Foundation and environment

Inspect/install safely; create the authorized public repository; establish English charter, licenses, pinned manifests, honest state and real bootstrap CI. Execute the first useful test. Reversible technical choices use small measured spikes and ADRs, not endless approval loops.

## H1 · 0.1 — Real frontend

Lexer/CST/AST, indentation, source maps, pinned standard grammar, contextual aliases and block markers; early LSP diagnostics and conservative formatting. Test positive/negative corpora, ambiguous same-line suites, chained comparisons and incomplete files. Regex plus Python execution is not a production frontend.

## H2 · 0.2 — Semantics and types

Names/modules/functions, values/objects, error/memory policy, validated HIR/MIR and supported-feature diagnostics. Preserve behavior before optimizing. Track parsed/supported/verified independently. Define cell boundaries/protocol through T29.

## H3 · 0.3 — Initial independent native executable

Reference backend, native ELF emission/linking, stack/calls/branches/structures. Produce a nontrivial executable and start compiler modules in NAJA. LLVM may proceed separately but is never the only path. A hello-world step does not complete the milestone.

## H4 · 0.4 — Useful language and library

Deliver the executable HATCH set, memory/cycles/resources, classes/collections/errors/modules, files, Unicode, JSON/TOML and CLI tools with offline lockfiles. Include generators/async needed by declared uses. T30 provides the first native session after capturing an AOT baseline.

Revision 1.2 adds reusable native data foundations through T37: CSV/JSONL schema/stream/error handling and bounded transformations. These libraries must preserve independent execution and documented effects.

## H5 · 0.5 — Hardware and platforms

Test Windows x64, Linux x64 and macOS arm64 products. Provide hardware/memory/FFI/intrinsics and a real freestanding QEMU demonstration. Negative tests cover permissions, ABI, allocation and overflow. Cross-compiling alone is not target support. T31 validates native session lifecycle/cache/portability.

## H6 · 0.6 — Productive applications

Deliver two-line TCP/HTTP defaults plus callbacks, framing, limits, backpressure, errors and clean shutdown. Test real local clients on all supported targets. T37 also develops explicit microkernel/app/data facades against preregistered behavior contracts, not hard-coded benchmark outputs.

## H7 · 0.7 — End-to-end VS Code

Deliver semantic LSP, navigation/rename/format, project tasks, Test Explorer, actual native debugging and installable VSIX. T32 adds native cells, state inspection and export; T21 includes that evidence. No Python extension dependency or simulated debugger.

## H8 · 0.8 — Self-hosted build closure

Port compiler, required runtime/tools/LSP/DAP/backend to NAJA. T33 includes interactive loading/protocol/cache. T23 proves B1/B2/B3 on strict Linux x86-64 without Python, Rust/Cargo, LLVM or an external C compiler. Demonstrate a compiler change entirely in NAJA. Porting starts earlier; H8 is acceptance, not its first attempt.

## H9 · 0.9 — Extensions, audits and release

Deliver native numerical and bounded quantum-library examples, freestanding proof, versioned extension contracts, fuzz/negative tests, public compatibility/performance limits, licenses, distributions and VSIX. T34 proves cell correctness and AOT isolation. T38 proves productivity and reports development-time evidence. Final T27 audit includes all gates; T28 publishes only after required gates pass.

A preliminary release may be explicitly experimental. It is not “HATCH complete.”

## Revision tasks

| Revision | Tasks | Scope |
|---|---|---|
| 1.1 | T29–T34 | Native cells, lifecycle/cache, VS Code, self-hosted closure and AOT protection |
| 1.2 | T35 | English migration, language-policy audit and non-destructive state merge |
| 1.2 | T36 | Preregister equivalent benchmarks, baseline policy and measurement rules |
| 1.2 | T37 | Reusable system/application/data productivity libraries |
| 1.2 | T38 | Measure code/time/behavior/resources; publish all results and gate R19 |

T36 precedes benchmark-driven implementation; do not select rules after observing results. T37 follows required core/network capabilities. T38 must not run before equivalent real baseline and NAJA implementations exist. Existing task IDs remain stable.

## Parallel work and acceptance entry points

Frontend/source maps precede generation/debugging. LSP contracts, editor wrapper, documentation and independent protocol tests may advance in parallel. Independent tests must not alter semantics to match an implementation. Keep native/self-hosting foundations ahead of heavy domain expansions.

When actually implemented, use documented `naja test`, `naja bootstrap --verify` and release tasks as entry points. Record real commands/versions/results. Never print “passed” for an unimplemented command.

## No silent reduction

English policy, code-reduction benchmarks, measured time evidence, interactive behavior and independence are part of the revised completion contract. A miss is not waived by an appealing demo, an average that hides a failing domain or a session limit. Continue independent ready work and report exact blockers.
