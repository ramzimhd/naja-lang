# Current class integration — October 25, 2026

FC1 and HATCH remain incomplete; all 19 inherited gates and every L/C/FC1
contract remain open. Retained compiler source is
b0e54cb2db1a2aea20b6056c05f92ea5e6b62560. Native construction, shared instance
fields, compiled methods and initializer guards execute through the shared parser.
Full private mangling, class/function/bound-method values, inheritance, descriptors,
scoped extensions and partial classes remain required work.

The frozen 170-case source suite passed at that source: 120 actual Linux x86-64
ELFs, 50 compile refusals, two changed-source controls and zero not_run outcomes.
The read-only follow-up audited 13 frozen files, 170 source identities, 120 ELF
hashes and 1,174 command capture hashes. Separate Rust tests passed 261 cases.
Read tests/objects-source/PRIVATE_FIX_RUN_2026-10-25.md for exact identities.

Independent review at earlier 564461b found a real private-name defect outside
the frozen suite: class-context __value silently used an unmangled public key.
The conservative source guard fcbe457 now rejects unsupported class-context
private names, including NFKC forms, while preserving outside-class names and
__init__. Separate targeted follow-up passed 43 outcomes. Original failed probes
remain retained; this is explicit refusal, not implementation of full mangling.
The earlier native object-as-array index dispatch defect and test-author borrow
failure also remain documented in tests/objects/README.md.

There are 27 formal class-work records: 25 passed and two failed. The failures
were old Text.Repeat and list.append compile-rejection expectations after generic
member grammar became accepted. Each unchanged original source was checked,
built and executed to native type exit 105 before its fixture moved to a runtime
guard. No method implementation is claimed; values/list suite counts remain
108/167. Source b0e54cb passed ten post-guard records: Rust261, formatting/Clippy,
class170, i64 source36, integer source23, values108/functions76/index83/tuple137.
Seven later records at e475855 passed list167, CLI43, project23, boundaries25,
JSON21, editor12 units/nine compiler groups and package8 units. Compiler inputs
at e475855 are byte-identical to b0e54cb; the record source pins remain separate.
Earlier 564461b records retain native object74, file source121 and their own pins.

The unsigned local Linux archive from earlier a51c280 is retained at
 tools/distribution/artifacts/retained-a51c280/naja-linux-x86_64-unsigned.tar.gz
(589,051 bytes; SHA-256
60dba88639a972bef3cfa8bed9109a4b0e37943f758980d59c881b812025562c).
It contains the Rust-built compiler and declared licenses/provenance. Actual
installation and changed-source compilation passed in an inventoried 60-file
copied userland with no seed tools. Required compiler OS libraries are libc,
libgcc_s and the GNU loader, highest GLIBC symbol 2.39. This shares the WSL kernel;
it is not a clean VM, security sandbox, current-source or other-platform proof.
The initial declared-loader parser failure and optional later Linux preparation
ENOENT inspection remain retained. See tests/distribution/EXECUTION.md.
The root independently checked all 18 package files and 50 sanitized log hashes.
The existing unsigned VSIX remains separately pinned and locally retained.

Private integrity audit/checkpoint 16 advanced retained source to b0e54cb,
using ten passing exact-source records; clean HEAD5398dbd assessed ready at
2026-10-25T22:01:36.090Z before these metadata edits. It audits report integrity,
not complete regression coverage or log honesty. Public c10836a passed all three
CI hosts at exact run40236076573; the next publication needs its own observation.
Account-shared quota observed 72% used/28% remaining at22:00:47.416Z,
reset2026-11-01T08:14:13Z. Other budget categories remain unknown.

Native Dict/Set work and a frozen 202-case source harness are active on separate
branches. Source native outcomes are not_run until root integrates the grammar
and supplies its exact commit. Continue engineering through supported compaction;
a passing checkpoint is a recovery boundary, not a stopping condition.

Historical file/collection/editor evidence follows unchanged with original pins.

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

Metadata preparation initially failed the unchanged assignment validator because a second T11 reviewer row repeated the existing task/owner. The historical list review was moved into that assignment history and the current object review became its active record; no evidence or validator was removed. Retained replay target/objects-metadata-before-correction.log exited1, SHA256 b1c6224ad9f6e1adfbb3c177a7b6c42795a6a1355fdb26396c13723f1a4de620. All three validators then passed; verified counts remain3 requirements/2 tasks/0 gates.
