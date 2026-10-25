# NAJA implementation progress — October 25, 2026

Revision 1.3; NAJA edition 2026.1; sole integrator /root. FC1 and HATCH remain
incomplete. All 19 inherited gates and all new L/C/FC1 contracts remain open.
The 147 inherited requirements and 38 tasks retain their identifiers/history.

Exact source 797dda666fa41bb4924c8011a37603e84c1b0662 passed 21 retained records:

| Executed scope | Actual result |
| --- | --- |
| Locked/offline Rust workspace | 235 passed; zero failed/ignored |
| Checked-i64 native / hosted integer IR / integer source | 36 / 14 / 23 checks |
| Tagged values and division IR | 85 checks; 8,194 independent outputs |
| Direct native function IR | 43 checks; 294 independent outputs |
| Native scalar indexing IR | 72 checks; 2,107 independent outputs |
| Actual values / functions / indexing source | 106 / 76 / 83 checks; zero not_run |
| Native run/test CLI / compiler boundaries | 43 / 25 checks |
| Full init/doctor project workflow | 23 checks; zero not_run |
| Explicit compile-only project workflow | 20 passed; 3 native cases not_run |
| Formatting, Clippy, build, three validators, scoped whitespace | Passed |

Commands, versions, exits, sanitized raw logs and hashes are in
reports/checks/v13-index-project-*.json and paired logs. Windows x64 compiled the
seed; Linux x86-64 programs actually ran through explicit local Ubuntu WSL.
Compile-only outcomes do not claim native Windows/macOS execution. The earlier
126 Node integrity/recorder cases remain pinned to 432ee9d. Public d065460 passed
Linux/Windows/macOS CI at run40230539152; this later publication needs its own CI.

Private integrity audit/checkpoint 10 advanced retained source under actual fence 2.
The evidence-only dirty state assessed ready with explicit acknowledgement before
metadata edits. Integrity auditing is not coverage, log-honesty or milestone
acceptance proof. Later review/evidence commits do not inherit a tested identity.

Ordinary native Int/Text/Bytes/Bool/None support exact arithmetic including signed
floor division/remainder, concatenation, comparisons/chains, short circuiting,
len, assertions, branches/loops and annotations. First-order functions use real
calls/returns, isolated frames and once-only arguments, with unsupported binding
forms rejected. Text/Bytes indexing now accepts exact Int/Bool indices, negative
from end, returns scalar Text or unsigned byte Int and reports bounds exit107.
The shared frontend retains suites, Unicode 17 XID/NFKC and original positions.

Explicit project roots parse bounded schema 1 manifests and reject unavailable
capabilities before contextual aliases. Alias identity includes exact manifest
bytes. Init exclusively creates three validated files without executing them;
doctor separates declared capabilities, explicit runner preparation and user
execution. Real empty-PATH init/check/build calls succeeded; they do not remove
OS libraries or establish a clean host or autonomy closure.

Independent indexing review at 834014b found no actionable defect across 77 source
cases/3,528 oracle outputs plus 8 corruption controls. Its original fixture error
remains retained. Independent doctor/init review at 797dda6 found none across 72
ordinary cases plus namespace/native probes and one actual exclusive-create
collision: foreign bytes and partial output were retained, and retry refused.
The probe's launcher/watcher authoring failures remain failed. Earlier division,
function and compiler-stack/input reviews retain their original source pins.

All failures remain visible. The old macOS fixture failure and Linux diagnostic
expectation were corrected and passed later d065460 CI. The old value fixture
failure at 432ee9d remains alongside later valid-manifest checks. During project
harness authoring, its own capture files tripped a read-only assertion; captures
were separated, original harness/failures preserved, and full/compile-only modes
then passed. No semantic expectation, validation policy or budget was relaxed.

Temporary limits remain compiler stack 8 MiB; native arena 64 MiB without reclamation;
call depth 256; source stack2 MiB/4 KiB helper reserve with documented OS assumptions;
and one million limb pairs for general division. Process diagnostics are not
catchable exceptions. There is no runtime loop quota, sandbox or hostile-race
filesystem confinement claim.

Immutable tuples are the next scoped integration; their backend and source
harness preparation are separate from this evidence. Mutable collections/classes,
floats, complete functions/modules, productive libraries, B1–B3/reference closure
in NAJA, cells, LSP/DAP/VSIX, clean-host products and human productivity sessions
remain required. The old independence inventory needs expanded-closure evidence.
No unattended provider runner, paid fallback or ownership transfer is running.
Continue after checkpoints while authorized work and capacity remain.
