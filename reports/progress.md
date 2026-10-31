# Inclusive integer interval checkpoint — October 31, 2026

A Claude session resumed the interrupted October 31 interval work as `/root`,
sole integrator in `C:/naja` on `agent/integrator-H0`. Nothing was lost. The
three files reported missing were present: ADR-009 (`44c091d`) and
`reports/governance/CI_EXACT_LITERAL_CORRECTION_2026-10-31.json` (`9f7ba0d`)
were committed locally but not pushed, and `target/resume-intervals.mjs` is an
ignored local helper that wrote private checkpoint 28. Public `main` is still
`8dbea5f`; its CI run 40244261165 (#15) passed on all three hosts.

The interrupted session had left uncommitted drafts in two worktrees. They
were reviewed before freezing, four fixture defects were corrected, and the
corrections are recorded in `tests/intervals/PREFREEZE_CORRECTIONS.md` and
`tests/intervals-source/PREFREEZE_CORRECTIONS.md`. No outcome had been
observed before the freeze.

ADR-009 first slice, retained source `daf60e1749ba4a3d4a0ee6c4347b3bee499f93ab`:

- Native `IntegerInterval` at `78b35f3`: frozen 113 checks PASS on first run
  (103 Linux x86-64 ELFs under WSL2, 10 IR refusals). `tests/intervals/`.
- `from naja.numeric import checked_int` (both dialects) and `.naja` local
  annotations `name: (lower to upper) = value` at `daf60e1`: frozen 148
  outcomes PASS on first run (75 ELFs, 66 refusals, 7 check-only).
  `tests/intervals-source/`.
- At `daf60e1`: formal records PASS for fmt, Rust 296 tests, strict Clippy,
  JSON 21, VS Code adapter, native 113 and source 148
  (`reports/checks/v13-interval-*`). All 29 inherited CI suites PASS, 0 failed,
  0 not run (`tests/intervals-source/REGRESSIONS_daf60e1.json`).
- Independent read-only review found no correctness defect
  (`reports/reviews/INTEGER_INTERVALS_V13.md`).
- CI now also runs `test-intervals.mjs` and `test-intervals-language.mjs` on
  Linux.

NOT RUN or still open in L09/FC1-06: Decimal, Float and Rational intervals;
NaN and infinity policy (no Float type exists yet); named refinement types;
refined fields, parameters and returns; refined mutable containers;
external-input, FFI and deserialization invariants; patterns and captures;
general constant folding and inference. No requirement, task or gate was
promoted; counts remain 3 verified requirements, 2 tasks, 0 of 19 gates.

Budget observed 2026-10-31T13:20Z through the Claude desktop app: weekly
all-models window 77% used (resets 2026-11-04T08:00Z), 5-hour window 52% used,
extra usage disabled, session context 37%. No background runner exists.
Private reservation fence 2 remains held by `/root`; never reclaim it by age
or PID.

Preserve every worktree, including `native-integer-intervals`,
`integer-interval-source`, `integer-interval-integration` and the unused
`integer-interval-review`, plus the untracked `bootstrap/frontend/Cargo.lock`
in `C:/naja-worktrees/frontend`.

Next commands:

```text
git status --short --branch
node scripts/validation/check-planning.mjs
node scripts/validation/check-continuity.mjs
node scripts/publication-audit.mjs
git push origin agent/integrator-H0
```

Then observe the exact CI run for the pushed head on all three hosts before
claiming it, and continue the next L09/FC1-06 slice (freeze an ADR for
Rational or Decimal interval policy, or refined parameters, before
implementation). Earlier checkpoint text below is historical.

# Quota stop and exact resume boundary — October 25, 2026

Observed account quota100%used/0%remaining at2026-10-25T23:18:50.686Z; reset2026-11-01T08:14:13Z. Engineering stops at this real quota limit. No automatic runner, paid fallback or background continuation is promised. Manually resume when quota is available.

Published05e8dee98a940a1b8c1770b0eadd26d6d21a293b fixes the exact202 harness comparing Windows preparation-host metadata to Linux execution-host metadata. Original3cb7 run40243893202 remains FAILED; all earlier native/source suites passed and exact202 did not run there. The correction changes no case source/oracle/work/budget, and preserves original preparation bytes. Node syntax/prepare-only/current-plan identity passed. New exact CI40244168721 was in_progress; inspect its real conclusion before claiming Linux success. Any final metadata-head CI needs its own observation.

Retained verified compiler6d8fb04 remains unchanged: Rust291/fmt/Clippy/JSON21/editor and firstWindows/WSL exact202 passed. StageA150/Rational220 compatibility passedf0; independent49 passing outcomes preserve its original reviewer assumption failure. All contributor paths released, all code/reports committed. All19 gates and L/C/FC1 remain open.

Private checkpoint26 saved clean05e8dee before this metadata; a later ordinary checkpoint supersedes it. Actual fence2 remains held; never reclaim by age/PID. Read actual Git/state/private checkpoint and preserve all worktrees, rawcaptures and original frontend Cargo.lock. Then verify pending CI and continue founder work. Earlier checkpoint text is historical.

# Current exact decimal literal checkpoint — October 25, 2026

Retained source6d8fb04400cf19f9cf04bebd6bc67fbe1b39cbb0 passed Rust291, fmt, strict Clippy, JSON21 and editor12+9. First frozen exact source202 passed (74ELFs), with independent49 passing outcomes across two phases. Original reviewer17/1/31 assumption failure remains distinct from continuation32. StageA150 and unchanged Rational220 compatibility passed exactf0f8994. Five StageA diagnostic changes followed44paired unchanged-source commands; all150 source hashes/original proofs remain preserved.

ADR008 provides explicit exact_literal class capability, maximal decimal tokens and direct coefficient/power-of-ten Rational arguments, with checked atomic preallocation and unchanged per-occurrence literal/name budgets. No binaryfloat, zero/cancellation shortcut or special unit registry. All19 gates and L/C/FC1 remain open, including generic algebra, scale/affine relations, full hashing/display/Decimal, self-hosting, cells/debugger and human productivity.

Private audit/checkpoint24 advanced retained6d; clean3e76cd3 assessedready at23:11:47.925Z before metadata. Later ordinary checkpoints supersede that observation. Public487901d passed all3hosts at CI40242650531. Exact-stage publication/newCI is pending. Quota98%used/2%remaining observed23:10:44.675Z; other categories unknown. No background runner exists. Continue while capacity remains; after actual exit manually resume from actual Git/private checkpoint.

All contributors released their paths. Preserve source-integration, exact execution, review, compatibility and frontend-evidence worktrees. Read tests/exact-literals-source/EXECUTION_6d8fb04.md, reports/reviews/EXACT_LITERALS_V13.md and tests/typed-literals-source/EXACT_DECIMAL_MIGRATION_2026-10-25.md. Original failed frontend logs and transcript-only baseline are retained in tests/syntax/EXACT_DECIMAL_FRONTEND_EVIDENCE.*. All1062 new encoded streams were decoded/hash/length/pattern reviewed.

Next commands: git status --short; node scripts/validation/check-planning.mjs; node scripts/publication-audit.mjs; git push origin HEAD:main after staged review; observe exact new CI. Then continue remaining founder implementation. Earlier checkpoint text below is historical and retains original pins.

# Current exact Rational foundation — October 25, 2026

Retained compiler source is `29be1ef7b6f7508843f3a7cde29810331881474c`.
Its 276 Rust tests, formatting, strict Clippy, 21 structured-diagnostic checks
and VS Code adapter 12 units/9 compiler groups passed. All 19 inherited gates,
15 foundational additions, seven continuity additions and 12 FC1 checks remain
open. Verified counts remain three inherited requirements and two tasks.

The explicit `naja.numeric` APIs construct/read exact immutable reduced fractions
and perform exact division. Native Int/Bool/Rational arithmetic and comparisons
retain arbitrary precision. Ordinary source `/` remains unsupported. Generic
truth, container/field updates and selected reads use constant structural checks
without limb scans, gcd or allocation; explicit numeric operations validate and
share one frozen cumulative 1,000,000-unit work counter. All earlier caps remain.
Full display, hashing, Decimal, general protocols, dimensions and scale/affine
point/delta relations remain required work. See ADR007 and the native contract.

The first frozen IR run passed all 101 checks at exact `0138734` without a native
repair: 95 actual ELFs, six invalid-IR refusals and precise work/corruption controls.
At separately pinned `4e52156`, Rust276 and ten unchanged legacy native harnesses
passed; no old selector or expected result changed. All 19 losslessly encoded
logs were decoded and length/hash/pattern reviewed before publication.

The corrected source suite passed all 220 at exact
`3bb1c1f42ed77494d32cf237dc4b911c13a78c68`: 193 actual ELFs and 833 commands.
Its first run at `5ee64ec` remains 33 passed/one fixture failure/186 not_run.
The fixture defined `value()` then assigned `value = value()`, correctly refused
by the existing static binding guard. A separate reviewed correction renamed only
that function/call; the other 219 sources and every oracle/budget stayed unchanged.
Both plans and observations remain retained under `tests/rationals-source/`.

Independent review passed 61 outcomes at `5ee64ec`: 31 source programs, 22 precise
work-counter controls and eight structural/full-validation controls. At exactly
zero arena bytes free, generic alias/field/List/Tuple/Dict access and updates
succeeded, while an extra explicit construction failed 103. Structural checks
deliberately do not prove arbitrary modified-ELF coprimality or limb canonicality.
The scoped report preserves these limits and the separate fixture failure.

All proof source commits are retained in integration ancestry. Private integrity
audit/checkpoint21 advanced retained source to29be1ef using five passing records;
ordinary checkpoint22 assessed clean469dda5 ready at2026-10-25T22:52:58.367Z,
before public metadata edits. Integrity is not complete coverage or acceptance.
Published0d89474 passed all three CI hosts at run40240848481; the next publication
needs its own exact-SHA observation. Latest observed account quota was90%used/
10%remaining at22:49:12.819Z. Other budget categories remain unknown.

Next: review/publish this Rational integration and observe CI, then implement the
exact decimal literal capability after freezing lexical and preallocation rules.
Contributor code paths are released; follow-up work is read-only contract review.
Continue FC1 and HATCH through compaction while authorized capacity remains.

Earlier checkpoint chapters follow with their original pins and historical next
actions preserved.

# Historical native mappings and integer literal construction — October 25, 2026

Retained integrated compiler source is 781f33513f679cb4e06e807da6804b83af9830cc.
Its 271 Rust tests, formatting, strict Clippy and 21 structured-diagnostic checks
passed. All 19 inherited gates and every L/C/FC1 contract remain open. The
147 inherited requirements and 38 task identifiers/status history are preserved.

Native ordered Dict/Set, scalar keys, membership, mixed comparison chains,
shared Dict updates and immutable Tuple key snapshots now lower through the
shared source parser. The revised frozen 202-case source suite passed at exact
50970ba8a46f000cb6a57e5cb454228f952aeef1: 160 semantic cases, 40 compile refusals,
two real source/private-input mutants and 162 actual ELF executions. Exact and
one-over/cumulative key-work guards passed without changing the 1,000,000-unit
limit. Native IR87/Rust267 and independent mapping41 retain their earlier b2
pins; source value108/function76/index83/tuple137/list167/class170/file121 and
adapter checks retain their actual separate source pins. Containers still lack
full hashing/protocols/iteration/deletion/display/structural equality and GC.

Both mapping preparation failures remain failed: first 11 passed/one failed/190
not_run because two alias keys were unquoted; next 146 passed/one failed/55
not_run because key-data setup used unsupported sequence repetition. The first
repair quoted only the keys. The second refroze only 19 payload sources using
native concatenation, preserving key bytes, timing, alias identity, every oracle
and every budget; all other 183 sources stayed identical. Both original plans,
reports and captures remain retained. Native Text/Bytes repetition is still
required work. A separate obsolete Dict/Set compile-rejection record also remains
failed: unchanged original display sources now check/build zero and native105.
Focused proof preceded their runtime-guard migration; values suite stays108.

ADR006 implements explicitly eligible integer suffix construction: a scoped
naja.literal.integer_literal marker decorates a same-module class with a one-value
initializer; .naja unambiguous decimal suffixes lower to ordinary native calls.
TypedInteger tokens preserve numeric/suffix spans; eligibility and value shadowing
use canonical bindings. Exact integers never pass through machine/float coercion.
The static marker/ordinary constructor work in both dialects, while .py suffix
rejection remains unchanged. Ambiguous numeric spellings suggest constructors;
unary signs apply after construction. No unit-name registry or marker execution
is hidden in this mechanism. Full protocols, Rational/Decimal promotion,
scale/affine relations and quantity operator behavior remain required work.

All 150 frozen typed source outcomes passed at exact
936865c7ef4dd566b4e4523089b1e6bad09534fe: 64 actual ELFs, 73 compile refusals,
13 lexer cases and zero pending outcomes. Independent47 passed at that source.
Before first execution, review corrected three fixture sources and one existing
assertion diagnostic; the original all-not_run preparation remains unchanged in
history. Native execution required no further repair. Five separately retained
command records passed at936865c. Its compiler inputs exactly match integrated
781f335 (empty Git diff for Cargo/toolchain/bootstrap/backends); native/source
results retain936865c rather than being relabeled as the integrated HEAD.
Two losslessly encoded stream captures were decoded, length/hash-checked and
reviewed for secret/profile patterns before publication; their raw bytes remain
unchanged. Current code still emits direct independent Linux x86-64 ELF.

Private integrity audit/checkpoint18 advanced retained source to781f335 using
four exact-source passing records. Clean HEAD1bb01a2 assessed ready at
2026-10-25T22:30:16.598Z before metadata edits. This audits report integrity,
not complete coverage/log honesty or acceptance. CI b6786b7 failed package controls
because depth1 checkout lacked pinned historical source; original run40238471265
stays failed. Corrected6e4148b passed Linux/Windows/macOS at exact40238645724.
Published0d894742f47fdb40a1e3594c861f14aa273d02e9 passed all three hosts
at exact run40240848481; the public REST job conclusions are retained in
reports/governance/CI_MAPPINGS_LITERALS_2026-10-25.json. Last observed shared quota
was88% used/12% remaining at22:43:26.443Z;
other budget categories remain unknown.

Next: exact normalized native Rational foundation and explicit numeric APIs.
Seed owns native-rationals branch/backend/new IR harness; frontend owns only new
rationals-source harness. Native contract23a6a590 is frozen before execution with
cumulative work accounting and constant/noallocation generic guards. No Rational
native result is claimed yet. Root's separate rational-source-integration branch
in C:/naja-worktrees/typed-literal-integration is clean at5ee64ec, with source APIs,
height accounting and ADR007 committed. Rust276/fmt/Clippy/JSON21 passed at exact
d4d354c066c96e7e8beb0bc7b2ab46659f0672cb. Its unchanged source220 preparation
was independently reviewed before execution; all native outcomes remain not_run.
Continue FC1 and HATCH through compaction; a checkpoint is not a stopping point.

Historical class/distribution/file evidence follows with original pins preserved.

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
