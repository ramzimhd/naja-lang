# NAJA implementation progress — October 25, 2026

Contract revision: 1.3. Language edition: 2026.1. Integration owner: /root.
FC1 and HATCH remain incomplete. All 19 inherited release gates and all new
L/C/FC1 contracts remain open. The 147 inherited requirements, 38 tasks and
historical evidence are preserved. Passing scoped checks do not establish full
requirement acceptance.

Exact source 865a0d2a6a0e5509e7870d1620d1bcebac054d6b passed 15 retained
checks with stable source identities at command boundaries:

| Executed scope | Actual result |
| --- | --- |
| Locked/offline Rust workspace | 178 passed, no failures |
| Checked-i64 native harness | 36 checks passed |
| Hosted integer IR harness | 14 checks; 394 arithmetic and 150 comparison outputs matched |
| Ordinary integer source harness | 23 checks passed |
| Tagged native value IR harness | 58 checks; 5,855 independent outputs matched |
| Ordinary native value/alias source harness | 84 checks passed, zero not_run |
| Native run/test CLI harness | 43 checks passed |
| Main-process compiler depth/input boundaries | 25 checks passed |
| Formatting, Clippy, build, three validators, scoped authored whitespace | Passed |

Commands, versions, exit codes, sanitized raw logs and SHA-256 hashes are in
reports/checks/v13-boundaries-*.json and paired logs. Windows x64 compiled the
seed; emitted Linux x86-64 programs actually ran through explicit Ubuntu WSL.
This does not verify native Windows/macOS program output, a clean host,
self-hosting or human productivity. The earlier 126 Node planning/foundation/
continuity/recorder cases remain pinned to source4f93a39; they were not relabeled
as a new local run. The new public CI will execute them again.

The 15-record integrity audit under integration fence2 advanced private
checkpoint5 to source865a0d2. Its evidence-only dirty snapshot assessed ready
with explicit acknowledgement before metadata edits. Integrity audits verify
record/source/log consistency, not log honesty, coverage or milestone acceptance.
Later review/evidence/metadata commits do not inherit the tested source identity.
The earlier v13-source and v13-values records remain intact at their own sources.

Ordinary source now uses native tagged Int/Text/Bytes/Bool/None values with exact
multi-limb +, -, *, unary signs, sequence concatenation, comparison values and
chains, short-circuit truthiness, len, assertions, assignment and branch/loop
initialization checks. Explicit i64 remains checked. The shared frontend supports
edition-aware brace/named/depth suites, Unicode17 XID/NFKC names and bounded
literal decoding with original spans. Contextual comparison/unbound-builtin
aliases activate only with an explicit owning project root. NAJA int annotations
perform noncoercing runtime guards; Python annotations remain informational.
General floats, division source syntax, repetition, collections, functions/classes,
full grammar, imports and modules are still incomplete at this source.

Independent review at bccb609 retained real Windows compiler stack aborts and
source-stream IO ordering failures. Annotation shadowing was fixed separately.
Fix865a0d2 reserves a joined 8 MiB compilation-worker stack and checks project
ownership/local-disk namespace/regular-file metadata before reading source.
The independent unchanged 75-input review rerun observed zero stack aborts and
normal named-pipe rejection with zero connections at the same1500ms cutoff.
See reports/reviews/DYNAMIC_SOURCE_FIXES_V13.md. OS worker failures, hostile
filesystem races and universal IO deadlines were not tested or claimed.

The native temporary arena is64MiB with no reclamation or loop quota. Runtime
exhaustion exits103, IO failure102, assertion104 and invalid dynamic types105.
Process isolation is not a sandbox. The bounded CLI preserves actual status and
raw output. Earlier runtime/CLI reviews retain their original pins and findings.

CI at public source5c555bc passed Windows/Linux and failed on macOS15.7.9 arm64
while creating an invalid-UTF8 filename fixture (EILSEQ). The actual failed step
is retained in reports/checks/v13-ci-macos-failure.json and its raw log. A portable
OsString guard test and an explicit macOS fixture capability branch were added;
other errors still fail. The new publication needs its own CI result. Historical
all-host baseline05df505 remains a separate observation.

Confirmed contributors work in separate branches/worktrees with scoped paths.
Native div/rem core is complete in its contributor branch and awaits integration.
Direct native functions and the bounded pure project-manifest parser continue in
parallel. Root integrates reviewed source and records actual combined checks.
Productive libraries, B1–B3, reference backend/linker closure in NAJA, native cells,
LSP/DAP/VSIX and real human productivity sessions remain required. The original
seed independence inventory is historical and needs expanded-closure revalidation.

No unattended provider runner, scheduled service or automatic ownership transfer
is running. Unknown budgets remain unknown; manual client relaunch is needed
after exit. Continue engineering after each recovery boundary while authorized
work and execution capacity remain.
