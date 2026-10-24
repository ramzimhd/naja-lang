# 19 — Native Interactivity Validation Plan

**Scenarios to implement. No NAJA execution result is supplied by this documentation package.**

## Evidence setup

Link each case to requirement, commit, target, profile, backend/protocol version and sanitized log/source inputs. Positive and negative tests are required. Unit protocol tests may use identified doubles; R16 end-to-end acceptance must execute actual native binaries, not mocks.

Use the supported HATCH semantics shared with ordinary builds. Unsupported constructs fail explicitly.

## Functional cases

| Case | Verification | Requirements |
|---|---|---|
| C01 | Three cells define values, calculate average and use persistent state | INT-01, INT-03 |
| C02 | Fresh session and AOT preserve observable results/errors | INT-02, INT-04 |
| C03 | Rerunning a mutating cell repeats its own effect, not hidden prior cells | INT-04 |
| C04 | Unexecuted earlier cells do not supply missing names | INT-01, INT-03 |
| C05 | Function redefinition preserves old references and new binding | INT-05 |
| C06 | Permitted type change invalidates dependent specialization | INT-05 |
| C07 | Parse/type/link failure preserves committed state; no initializer runs | INT-06 |
| C08 | Mutation then exception reports partial state without rollback claim | INT-07 |
| C09 | Temporary-file effect before failure remains visible and explained | INT-07 |
| C10 | Infinite loop can be interrupted/force-stopped; editor survives | INT-08 |
| C11 | Disposable intentional native crash loses session, not editor | INT-08 |
| C12 | Old messages/callbacks cannot attach output after reset | INT-08, INT-11 |
| C13 | Partial if/try/decorator/string selections fail without rewriting | INT-01 |
| C14 | False nested conditions print nothing; extracted body rejected | INT-01, INT-04 |
| C15 | # %% inside strings/nested blocks does not split incorrectly | INT-01 |
| C16 | Alias/marker/Unicode/spaced-path diagnostics retain source positions | INT-11 |
| C17 | Alias changes require a new session; old cache is not misused | INT-10, INT-11 |
| C18 | Corrupted cache or wrong ABI/target/CPU/flags rejected safely | INT-10 |
| C19 | Cache deletion changes neither correctness nor prior side effects | INT-10 |
| C20 | Untrusted open runs no cell/import/build script | INT-09, INT-13 |
| C21 | Excess output/recursive values truncate safely; protocol intact | INT-08, INT-11 |
| C22 | Inspection does not call effectful user __repr__ implicitly | INT-09, INT-13 |
| C23 | Stop/reset cleans owned sockets/tasks or reports exact limitations | INT-08 |
| C24 | Imports/globals follow semantics after redefinition, not snapshots | INT-03, INT-05 |
| C25 | New class does not reinterpret old instance layouts | INT-05 |
| C26 | CLI REPL/stdio work without editor/Python/LLVM/Rust | INT-02, INT-12 |
| C27 | Clean VSIX runs cells/selections/all, stop/reset/inspect/export/errors | INT-13 |
| C28 | Export then fresh session/release contains no captured state/output | INT-14, PERF-04 |
| C29 | Run All follows source order; different manual order is visible | INT-04, INT-14 |
| C30 | Separate concurrent sessions do not leak bindings/value caches | INT-03, INT-11 |
| C31 | Memory/version limits require explicit refusal/reset; live code survives | INT-05, INT-08 |
| C32 | Actual Windows x64/Linux x64/macOS arm64 execution and limits | INT-15 |
| C33 | Interactive tools rebuild in NAJA and run without original seed | INT-16 |
| C34 | No private history/values sent to network or accidentally committed | INT-09 |

## Separate timing dimensions

**Cold:** new worker and cold cache; report project load, analysis, generation, link/load, execution, display and end-to-end time. A pre-populated cache is a separate scenario.

**Warm:** already compiled functions; separate native calls from editor/protocol submissions. Include tiny/large computations, mutable globals and redefinition/invalidation costs rather than hiding them.

**Release:** build source in a fresh environment without history and compare the registered AOT baseline with identical types/checks/options/machine. Executing a cell must never be a build prerequisite. Compilation and execution timing must not be conflated. [S28]

## P01 — No imposed interactive controller

Inspect link manifests, symbols, imports and actual dependencies of noninteractive applications. Exclude session tables, REPL loop/protocol, replacement engine and cache agents. Shared NAJA runtime required by semantics remains allowed.

With the same source/compiler/options, compare deterministic unsigned AOT artifacts with the interactive component present/absent and previously used/unused. Normalize only published nondeterministic metadata; never discard machine-code differences as noise.

## P02 — Pre/post integration baseline

Before connecting the session, commit actual AOT corpus, hardware, hashes, times, memory, size and safety checks. Re-run after integration; a shared frontend can regress despite architectural separation.

Pre-register budgets and statistical method before viewing results. Use adequate repetitions and report median/dispersion, CPU state and competing workloads. An agent cannot raise tolerance after failure to make a gate pass. Variation inside measurement resolution is inconclusive, not proof of universal zero overhead.

Significant support-induced degradation beyond the budget blocks R17 until corrected or explicitly addressed by the founder. This gate introduces no universal “faster than C++” threshold.

## P03 — No implicit session capture

Create a history-only variable, then build a source that references it without defining it. The build must fail under normal semantics rather than read session memory. Session values/order/output cannot alter artifacts from identical declared inputs.

## P04 — Honest workloads

Use numerical, collection, object, small/large call and bounded-I/O workloads with equivalent integer/overflow/bounds/exception behavior. Include memory and compilation costs, not just the best warm throughput.

## Safety test boundaries

Source checks, types, Workspace Trust and a separate process reduce specific risks but do not demonstrate complete confinement. Crash/destructive tests use disposable environments and dedicated temporary data. Do not modify personal files or contact external services without authorization.

No automatically opened control port. Normal process permissions still apply. Do not replay physical/network effects. Respect executable-memory/loading protections; document unsupported/blocked targets and adapt legally instead of disabling protections.

## Reports to create during development

`reports/interactive/CONFORMANCE.md` covers C01–C34; `AOT_NON_REGRESSION.md` covers P01–P04; `PERFORMANCE.json` contains actual raw measurements; `DEPENDENCIES.md` records loading/compiler/OS dependencies and process traces. Link these to R16/R17 and INT/PERF requirements. All prose is English; original sanitized machine outputs may remain faithful to their source.

Revision 1.2 productivity tests add separate measurements. They do not replace these correctness and AOT-protection tests or convert shorter code into a performance guarantee.
