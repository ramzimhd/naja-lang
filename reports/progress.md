# NAJA implementation progress — October25, 2026

Revision 1.3; NAJA edition 2026.1; sole integrator /root. FC1 and HATCH remain
incomplete. All 19 inherited gates and all new L/C/FC1 contracts remain open.
The 147 inherited requirements and 38 tasks retain their identifiers and history.

Exact source b9d884dbd3577d104c92593469e894de88062400 passed17 retained checks:

| Executed scope | Actual result |
| --- | --- |
| Locked/offline Rust workspace |216 passed; zero failed/ignored |
| Checked-i64 native harness |36 checks |
| Hosted integer IR harness |14 checks;394 arithmetic/150 comparison outputs |
| Ordinary integer source |23 checks |
| Tagged values/division IR |85 checks;8194 independent outputs |
| Direct native function IR |43 checks;294 independent outputs |
| Actual value/alias/manifest source |106 checks; zero not_run |
| Actual function source |76 checks; zero not_run |
| Native run/test CLI |43 checks |
| Main-process compiler/input boundaries |25 checks |
| Formatting, Clippy, build, three validators, scoped whitespace |Passed |

Commands, versions, exits, sanitized raw logs and hashes are in
reports/checks/v13-integrated-*.json and paired logs. Windows x64 compiled the
seed; Linux x86-64 ELF programs actually ran through explicit local Ubuntu WSL.
The 126 Node integrity/recorder cases passed separately at 432ee9d; they are not
relabeled to b9d884d. Private integrity audit/checkpoint 7 advanced retained source
under actual fence 2; its evidence-only dirty state assessed ready with explicit
acknowledgement before later metadata edits. Audit integrity is not proof of
coverage, log honesty or milestone acceptance.

Native ordinary Int/Text/Bytes/Bool/None values support exact +,-,*, signed floor
division/remainder, concatenation, comparison values/chains, truthiness, len,
assertions, assignment/annotations and branch/loop initialization. First-order
functions now use direct machine calls, isolated 128-slot frames, once-only
left-to-right arguments, self/earlier calls and return/fallthrough None. The shared
frontend handles Python indentation and NAJA brace/named/depth suites, Unicode17
XID/NFKC bindings, original spans and bounded literals. Static function binding
rejects globals, rebinding, forward/nested definitions, function values, defaults,
kwargs/variadics and annotated signatures. Complete functions remain required.

Explicit project roots now parse a bounded schema 1 manifest before loading aliases.
Unavailable profiles/targets, unenforced depth policy and unresolved dependencies
reject. Entry is metadata when SOURCE selects a module. Exact raw manifest bytes
bind alias identity without changing existing policy/config limits. There is no
ambient discovery, package resolver, lockfile/cache implementation or sandbox.

Temporary native limits are64 MiB arena (no reclamation),256 active calls,2 MiB
source stack plus4 KiB helper reserve, and one million limb pairs for general
division. Native OS stack availability assumptions are documented. Resource,
IO, assertion, operand type and zero-division failures exit103/102/104/105/106.
These are process diagnostics, not catchable exceptions or a runtime loop quota.
Compilation reserves a joined8 MiB worker stack. Filesystem checks assume stable
paths; hostile races and universal OS IO deadlines are not certified.

Independent div/rem review at 8e5344b found no actionable defect across 29 native
artifacts/479 oracle pairs, including90,000-digit and exact work-boundary probes.
Independent function review at 0168f46 found none across 82 source cases plus four
depth probes. The earlier real compiler-stack/input/annotation findings and their
unchanged-input fix verification remain retained. One function review WSL-control
deadline failed; the exact retained ELF passed direct execution. This does not
establish universal run-adapter reliability. See reports/reviews/ for pinned scope.

Failures remain visible: macOS fixture creation failed at 5c555bc; its fix passed
macOS CI at dea427a. That latter run passed Windows/macOS but failed the Linux
harness's incorrect FIFO diagnostic expectation. A command-specific fix is
committed and needs its own CI. Combined value checks failed at 432ee9d because
legacy generated projects had comment-only markers; valid-manifest fixtures and
new rejection controls then passed 106 cases at b9d884d. No validation was relaxed.
All prior evidence and raw log bytes remain intact.

Native Text/Bytes indexing and exclusive project initialization continue in scoped
contributor worktrees. Collections/classes/floats, full modules, productive
libraries, B1–B3/reference closure in NAJA, cells, LSP/DAP/VSIX, clean-host products
and real human productivity sessions remain required. The old independence
inventory is historical and needs expanded-closure evidence. No agent timing is
human evidence. No unattended provider runner, paid fallback, automatic ownership
transfer or scheduled service is running. Continue after recovery checkpoints
while authorized work and capacity remain.
