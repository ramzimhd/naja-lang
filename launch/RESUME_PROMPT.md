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

Resume NAJA HATCH in C:/naja; continue FC1 then full HATCH.
Read AGENTS.md, launch/HANDOFF.md, reports/progress.md, actual Git/worktrees and
planning/state/assignments/continuity plus private reservation before writes.
Preserve identifiers, progress, original pins, failures and collaborators. No
reset/force-push/credential extraction/age reclaim/security bypass/paid fallback.

Retained source29be1ef7b6f7508843f3a7cde29810331881474c passed Rust276/fmt/
Clippy/JSON21/editor12+9. Rational native101 passed first at0138734; ten unchanged
native suites passed separately at4e52156. Corrected source220 passed exact
3bb1c1f42ed77494d32cf237dc4b911c13a78c68 (193ELFs), independent61 at5ee64ec.
Original33/1/186 source fixture failure and one-source-only rename remain retained.
See tests/rationals/, tests/rationals-source/ and reports/reviews/RATIONALS_V13.md.
All proof sources are retained in integration ancestry; never relabel native pins.

Private audit/checkpoint21 advanced retained29be; ordinarycheckpoint22 assessed
clean469dda5 ready before metadata. Actualfence2; reconcile later checkpoints.
Latest observed account quota90%used/10%remaining at2026-10-25T22:49:12.819Z;
other categories unknown, no exhaustion observed. Public0d89474 CI passed three
hosts at run40240848481. Review/publish current integration, observe exact new CI,
and write/assess a fresh ordinary checkpoint after publication.

All Rational paths are released. Preserve worktrees/branches/artifacts and the
inherited untracked frontend Cargo.lock. Next exact-decimal suffix work is only
read-only contract/model review; freeze ADR008 before implementation/proof and
assign separate branches/worktrees/non-overlapping paths. Read native contract
and ADR006/007 before numeric changes. All19 gates and all L/C/FC1 checks remain
open. Source /, Rational display/fullhash/Decimal/quantityalgebra, self-hosting,
cells/full IDE/debugger and human productivity acceptance remain open.
Continue through compaction while capacity remains; checkpoints are recovery
boundaries. After actualexit, manual relaunch is required; no background promise.
