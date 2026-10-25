# NAJA implementation progress — October 25, 2026

Revision 1.3; NAJA edition 2026.1; sole integrator /root. FC1 and HATCH remain
incomplete. All 19 inherited gates and all L/C/FC1 contracts remain open.
The 147 inherited requirements and 38 tasks retain their identifiers/history.

Current retained compiler source is a51c2808bae4b57596f7f957ce53530004a504f8.
Sixteen reports/checks/v13-files-*.json records passed:253 Rust tests,
formatting/Clippy,70 native file/UTF-8 checks with48 conversion outputs,
fixed-i64 source36, integer source23, values/functions/index/tuple/list source
108/76/83/137/167, CLI43, project23, compiler boundaries25, structured JSON21,
and editor12 unit tests/nine real-compiler groups. The emitted target is Linux
x86-64 through explicit local WSL; the seed host is Windows x64.

The separately frozen file-source suite passed all121 cases at that source:
96 real ELF executions,25 check/build rejections,zero not_run. Check/build left
all private fixture inventories unchanged; native output files matched independent
hashes. Exact16 MiB/4095-byte limits, conversion views beyond the file cap,
strict UTF-8, imports/Unicode aliases, path-then-data effects, exclusive foreign-file
preservation and two changed-file controls passed. See tests/files-source/
RUN_2026-10-25.md and RESULTS_2026-10-25.json. Independent FILES_V13 review passed
350 cases, including 312 UTF-8 inputs, low-FD reads and depth/call boundaries;
its original reserved-print alias assumption failure remains failed.

The native API uses direct Linux syscalls and strict conversions. Reads require
regular opened handles, writes exclusively create new files, known preflight
failures create no output and later OS errors may retain partial output. Source
imports are explicit static naja.io/naja.text bindings, rather than an ambient
module loader. File operation attempts/EINTR, arena, stack and source budgets
remain fixed. Tests/files/CONTRACT.md records the exact limits. Full IO/modules,
recoverable exceptions and filesystem confinement remain open.

Private integrity audit/checkpoint 14 advanced retained source to a51c280 and
assessed ready at clean HEAD1c7e4c4 before later metadata edits. The public
observation is historical; an ordinary private checkpoint follows publication.
Account-shared quota was observed59%used/41%remaining at2026-10-25T21:25:48Z,
reset 2026-11-01T08:14:13Z. Context/rate/deadline/spend telemetry remain unknown.
Public 4a9fe89 passed all three CI hosts at run 40234704254; the next publication
needs its own exact-SHA observation. Classes/objects and compiler distribution
are active separately and have no result borrowed from these file checks.

Historical collection/editor evidence follows, with original pins preserved.

Exact compiler source 91d94d15ec273e5c71ec6c8d95e5baa824861148 passed 26 retained
command records in reports/checks/v13-collections-integrated-*.json and paired
sanitized raw logs:

| Executed scope | Actual result |
| --- | --- |
| Locked/offline Rust workspace | 247 passed; zero failed or ignored |
| Fixed i64 / hosted integer IR / integer source | 36 / 14 / 23 checks |
| Tagged values/division / direct function IR | 85 / 43 checks; 8,194 / 294 oracle outputs |
| Scalar indexing / tuple / mutable list IR | 72 / 76 / 97 checks; 2,107 / 259 / 385 oracle outputs |
| Actual values / functions / indexing source | 108 / 76 / 83 checks |
| Actual tuple / mutable list source | 137 / 167 checks; zero not_run |
| Native run/test CLI / compiler boundaries | 43 / 25 checks |
| Original UTF-16 structured diagnostics | 21 checks |
| Full init/doctor project workflow | 23 checks; zero not_run |
| Explicit compile-only project workflow | 20 passed; 3 native cases not_run |
| Formatting, Clippy, build, three validators, scoped whitespace | Passed |

Windows x64 built the temporary Rust seed; actual emitted programs ran on local
Linux x86-64 WSL. Compile-only modes do not claim Windows/macOS emitted-target
execution. The 126 Node planning/recovery/recorder cases separately passed at
aba7307; they were not relabeled or needlessly repeated after fixture-only work.
Public a65dddf passed all three CI hosts at run40232200667; later4a9fe89
also passed at run 40234704254. These are historical source-specific results.

Private integrity audit/checkpoint 12 advanced retained compiler source to
91d94d1 under actual fence 2 and assessed ready before these metadata edits.
A later ordinary checkpoint must capture publication state. Integrity auditing
checks selected report consistency, not coverage, log honesty or gate acceptance.
Later adapter/review/evidence commits keep their separate tested identities.

The shared parser now lowers empty/singleton/multiple parenthesized tuples and
fixed-count mutable lists, len/truth/index and single-subscript assignments.
List mutation evaluates the value, sequence and index once in that order; ordinary
write-like function calls will retain their own argument order. Aliases, parameters,
returned/nested targets and shallow self/indirect cycles preserve descriptors.
Each collection has at most 128 elements. Tuple/list display, comparisons and
numeric operations explicitly fail type105 and remain required semantic work.
Resizing, iteration, unpacking and richer collection behavior remain open.

Existing exact arbitrary integers, Text/Bytes/Bool/None, signed division/remainder,
first-order calls/returns, shared suites, Unicode 17 XID/NFKC, explicit project
aliases/manifests and exclusive init/doctor remain. Structured check JSON uses
original zero-based UTF-16 ranges, a 32-diagnostic cap and an omitted count.
Check/build execute no user source. Unsupported bindings and capabilities reject.

An unsigned experimental VSIX exists locally at
editor/vscode/artifacts/naja-cli-preview-0.0.1.vsix: 15,947 bytes, SHA-256
4ec98c344702801e6195f364578c500914ad1c75e4dec18d8898dca7531759a0.
It contains nine reviewed entries and zero runtime npm dependencies. Official
vsce 4.0.0 packaged it; VS Code 1.142.0 installed/listed it in an isolated profile.
The current adapter passed 12 unit tests and nine real-compiler groups at
7c8248c, retained in reports/checks/v13-editor-integrated.json. The original
package/install observations keep their aa41435/662bcdc pins. Actual editor UI
workflows, native LSP/DAP, cells and complete tooling acceptance remain not_run
or unimplemented. This is a locally retained preview, not a published release.

Independent tuple review at b0456b6 found no actionable defect across 77 source
cases/257 outputs and 53 IR cases; list review at aba7307 found none across 91
source cases/638 outputs, separate IR corruption/resource controls and eight
focused JSON behaviors. Their failed reviewer assumptions remain failed, including
an oversized unrolled source fixture and two diagnostic-count oracles. Independent VSIX artifact/adapter review found no actionable defect across 37
groups and three output controls, including actual CLI build/run through a mock
host. Its original candidate/compiler pins remain separate; actual IDE UI was
not run.

Failures remain visible. The unchanged older indexing baseline at b0456b6 failed
an obsolete tuple-index compile rejection (79 passed, one failed, three not_run).
At aba7307, 25 combined commands passed and the older fixed-i64 harness failed
an unprefixed list rejection. Focused native proofs preceded fixture migration;
the fixed-domain replacement and all 26 integrated commands then passed at91d94d1.
See reports/migrations/COLLECTION_BASELINES_2026-10-25.md. The earlier macOS/Linux
CI failures, manifest/capture fixtures and compiler stack/input findings retain
their original records. The tuple authoring log's retained excerpt explicitly
states that its original full log was overwritten; it is not presented as raw.

Limits remain compiler stack 8 MiB; native arena 64 MiB without reclamation;
256 active calls; 2 MiB source stack plus 4 KiB helper reserve with ordinary OS
stack assumptions; and one million limb pairs for general division. No runtime
loop quota, catchable exception system, sandbox, hostile filesystem confinement
or process-tree cancellation guarantee is claimed.

Next: publish reviewed file evidence and verify exact CI, then integrate the
released object core with source classes and execute the independently frozen
source cases. Object backend/source preparation and distribution groundwork
remain in separate assigned worktrees. Classes, floats, full modules/functions/libraries,
B1–B3 and the NAJA reference closure, native cells, platform products and real
human productivity sessions remain required. The historical independence
inventory needs expanded-closure revalidation. Continue after checkpoints while
authorized work and execution capacity remain; no unattended provider runner or
paid fallback exists.

The first file-publication metadata validation failed because a detailed source
result and Markdown review were incorrectly added where formal command-record
JSON was required. Those artifacts remain retained and linked; task evidence
now names the actual command records. Both validators then passed unchanged.
The original tool output and these pre-fix reproduction logs remain, with exit1:

- target/files-metadata-planning-before-correction.log: SHA-256 1deee6319cea5e1d6c6bc9ac7f77af17e78661d4596d04ae7a28a73227a2c464

- target/files-metadata-foundations-before-correction.log: SHA-256 d0cebc573e4216679ef4a32fdeb754cc18b6d0d6c86e97c0e99c41f9ed0149ad
