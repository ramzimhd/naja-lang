# 14 — Verifiable Definition of HATCH Completion

## General rule

Every `release_required=true` requirement must be verified on the release commit with retained reproducible evidence. Tests must detect injected violations; a permanently green suite proves nothing. Documentation tests do not validate a runtime.

Future full-domain/Python-ecosystem objectives remain separate. Only the founder may reduce mandatory scope. Revision 1.2 adds English-language delivery and bounded productivity acceptance without removing previous gates.

| Gate | Required proof |
|---|---|
| R01 | Authorized public repository, license/notices, honest origin/status |
| R02 | Real user installation on Windows x64, Linux x64, macOS arm64 |
| R03 | No Python for install, compile, normal tests or execution |
| R04 | Pinned grammar parsing and parsed/supported/verified matrix |
| R05 | Correct block depths, six comparison aliases, diagnostics/source maps |
| R06 | Executable HATCH semantics and independent runtime/library |
| R07 | Native tools, modules, memory/errors and basic workflows |
| R08 | Autonomous Linux x86-64 backend/linking; no hidden C translator |
| R09 | NAJA build closure, B1/B2/B3 and a compiler evolution written in NAJA |
| R10 | Typed hardware APIs, permissions and freestanding QEMU execution |
| R11 | Real two-line TCP/HTTP and robust failure/lifecycle behavior |
| R12 | Installable VSIX, semantic LSP, tests, navigation, formatting, actual debug |
| R13 | Numerical/quantum extension examples without parser changes |
| R14 | Negative safety tests, fuzzing, dependency/publication review |
| R15 | Reproducible performance evidence, limitations, docs, artifacts/hashes |
| R16 | Native cells, state/lifetimes, CLI/VS Code, safety, targets, self-hosting |
| R17 | AOT session independence and separately measured interactive overhead |
| R18 | English official/public surfaces and preserved existing evidence/IDs |
| R19 | Six equivalent productivity tasks, <=25% code target, time evidence, safety/resource parity |

## Clean-host workflows

Use disposable environments, not destructive modifications to the owner's computer. Python, Rust/Cargo and LLVM are absent from the user scenario; declared OS libraries remain. Install NAJA, create/build/run/test, exercise the server and repeat in a clean VS Code profile. Include an offline scenario with prepared artifacts.

Autonomous rebuild scenarios separately use an identified NAJA seed, sources and allowed OS services without the original bootstrap toolchain. Removing a tool from PATH while invoking its absolute path does not prove independence.

## Compatibility, memory and safety

Publish recognized grammar, executed semantic cases, available modules, exclusions, failures and skips. A suite pass rate is not a universal percentage of Python. Promised semantic failures block release.

Test bounds, safe-mode use-after-free/double-free, cycles, allocation exceptions, resource closure, FFI buffers and concurrent access under the claimed guarantees. Review all unsafe scopes. Auxiliary fuzz/sanitizer tools must not become user dependencies.

## Performance and reproducibility

Publish hardware/OS/compiler versions/flags, source, repetitions, statistics, memory and artifact sizes. Match algorithms, numeric types, overflow/bounds/error behavior. Separate compile/startup/throughput/latency/allocation costs. Do not hide poor performance or claim universal C++ superiority.

Pin non-regression budgets before results; unexplained or unapproved meaningful regressions block the relevant gate. Publish target manifests, source commit, dependency/SBOM notices, checksums, signature state and release notes. Compare unsigned deterministic bootstrap artifacts before signing; never normalize away code differences.

## Cells and productivity

Execute C01–C34/P01–P04 from document 19 and DX01–DX06 from document 22. All results need real artifacts and logs. Cold/warm/AOT results are distinct; no zero-risk universal claim follows from bounded tests.

R19 is per-scenario, against both approved baselines; averaging cannot conceal a failed microkernel, application or data task. Count task-specific helpers/configuration and report supporting-library cost separately. Measure real task/change-request time; do not equate 75% less code with 75% less time. Missing/failed measurements are not success.

## Final adversarial audit

Inspect hidden Python/delegated compilation, opaque runtimes, false tests, required-path TODOs, silent diagnostics, simulated LSP/debug, unbounded callbacks, uncompiled examples and ignored CI failures. Also search for French official surfaces, inflated Rust/C++ baselines, hidden task code, hard-coded outputs, weakened validation and undocumented benchmark exclusions.

Write `reports/HATCH_RELEASE_AUDIT.md` with `PASS`, `FAIL` or `BLOCKED` for R01–R19. One mandatory FAIL/BLOCKED prevents overall PASS. Disclose self-review when no independent reviewer is available. No review or product tests were performed by this documentation package itself.
