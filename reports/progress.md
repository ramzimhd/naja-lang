# NAJA implementation progress — October 25, 2026

Contract revision: 1.3. Language edition: 2026.1. Integration owner: `/root`.
FC1 and HATCH remain incomplete; all 19 inherited release gates remain open.
The 147 inherited requirements, 38 tasks and historical evidence are preserved.
All new L/C/FC1 contract statuses remain open. Partial implementations and passing
commands do not establish complete requirement acceptance.

At exact source `4f93a39b678ca25a4372af6571b5a60617f33c80`, 14 retained checks
passed with a stable source at command boundaries:

| Executed scope | Actual result |
| --- | --- |
| Locked/offline Rust workspace | 153 passed, no failures |
| Node planning/foundation/continuity/recorder suites | 126 passed, no failures or skips |
| Checked-i64 native harness | 36 checks passed |
| Hosted integer IR harness | 14 checks; 394 arithmetic/metamorphic and 150 comparison outputs matched |
| Ordinary integer source harness | 23 checks passed |
| Tagged native value IR harness | 34 checks; 3,886 independent outputs matched |
| Native run/test CLI harness | 43 checks passed, including the reviewed filter defect regression |
| Formatting, Clippy, build, three validators and scoped authored whitespace | Passed |

Exact commands, versions, exit codes, source identities, raw sanitized logs and
SHA-256 hashes are in `reports/checks/v13-source-*.json` and paired logs. The host
was Windows x64; emitted programs actually ran on Linux x86-64 through explicit
Ubuntu WSL. These results do not verify direct Linux process-adapter behavior,
native Windows/macOS output, a clean host, self-hosting or human productivity.
The 126 Node cases use disposable repositories and synthetic mutation fixtures;
their synthetic success records are not product acceptance evidence.

The retained set was explicitly audited under the actual integration fence 2,
then private checkpoint 2 advanced retained source to `4f93a39`. Its evidence-only
dirty snapshot assessed ready with explicit acknowledgement before later public
metadata edits. The audit verifies record/source/log integrity, not log honesty,
complete coverage or milestone acceptance. Earlier checkpoint fingerprints and
all old evidence remain historical. A subsequent metadata HEAD is not silently
substituted for this tested source.

Implemented source slices include edition-aware brace/named/depth suites,
ordinary decimal multi-limb integers, checked explicit i64, definite initialization,
Unicode 17 XID/NFKC names, original spans and native comparison assertions.
Bounded native run/test preserves observed status and raw output bytes. Independent
CLI review at `18ca704` reproduced a filter-text defect; root fixed it in `c72060b`
and the retained harness verifies that later fix. See
`reports/reviews/CLI_EXECUTION_V13.md` for exact review limits. Earlier hosted
review remains pinned to `551214d` in `reports/reviews/HOSTED_NATIVE_V13.md`.

Shared text/bytes literal decoding and contextual alias configuration services
are integrated. A direct native tagged Int/Text/Bytes/Bool/None backend supports
exact arithmetic, sequence concatenation, comparisons, truthiness and short
circuiting, using shared integer kernels and a temporary 64 MiB arena. Those
values are still development IR support at this tested source; ordinary source
integration continues. Exhaustion exits 103, I/O failure 102, assertions 104 and
unsupported dynamic operand types 105. There is no reclamation, catchable exception
system, loop quota or sandbox claim. General floats, repetition, collections,
functions/classes, full grammar and module semantics remain incomplete.

Confirmed contributors use separate branches/worktrees and scoped paths in
`planning/assignments.json`. Work now adds explicit project-root alias loading,
then native positive/length/comparison-chain/type-boundary operations while root
integrates the shared source parser. Productive libraries, B1–B3, the reference
backend/linker source closure in NAJA, cells, LSP/DAP/VSIX and measured human
productivity remain required. The original seed independence inventory remains
historical; expanded dependencies require renewed closure evidence.

The previous baseline `05df505` passed hosted Windows/Linux/macOS CI at
https://github.com/ramzimhd/naja-lang/actions/runs/40098333023. Current publication
must be checked at its own new CI source. The separate fresh-agent drill was
local and synthetic; it neither transferred production ownership nor simulated a
provider outage. No unattended provider runner, scheduled service or automatic
transfer is running. Unknown budget categories stay unknown; manual relaunch is
required after client/machine exit. Continue engineering after this recovery
boundary while authorized work and execution capacity remain.
