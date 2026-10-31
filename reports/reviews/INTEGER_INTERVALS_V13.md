# Independent integer interval review — October 31, 2026

Scope: read-only correctness review of native `78b35f3` and compiler `daf60e1`
against ADR-009 (`44c091d`). The reviewer was a separate Claude subagent of the
integrating session. It received only the ADR, the commit identifiers and the
files to read; it was not given the implementer's conclusions or test results.
It built nothing and ran no cargo or node command. This is an AI review inside
one session, not a human or cross-organization audit.

Result: no correctness defects found.

Checked and satisfied, with the reviewer's own verification of the assembler
encodings in `backends/native/src/hosted/x64.rs` (`81 /op` with 0 add, 4 and,
5 sub, 7 cmp; 32-bit limb loads at `[base+idx*4+16]`; signed `jg`/`jl` only
on comparison results and signs, unsigned `ja`/`jae`/`jb` on counts, limbs and
work):

- Native: left-to-right single child evaluation; all three 24-byte span guards
  before all three kind checks; per input the descriptor debit, offset-16 zero
  check, raw header, count cap, sign/count consistency, full-span readability,
  then the `1+n` debit before limb reads; limb `< 1e9`, nonzero top limb and
  canonical Bool; three compares in ADR order with `1+2*max` debits and no
  shortcut; inclusive bounds and first-failure stop; 128-byte frame with WORK at
  offset -16; original descriptor returned without allocation; clobbered
  registers are not live in the emitter; every memory read is preceded by its
  guard; all five exit codes and messages match; the validator walks all
  children, including unused code.
- Compiler: `simple()` is the only slot store, so every store to an annotated
  slot is checked, including branches, loops and unused code; tables are saved
  and restored per function and method; copies and results stay unrefined;
  both endpoint lengths are reserved together on every store before cloning;
  three nodes per annotated store and only the call node for `checked_int`;
  the static proof never refuses a program that could succeed at runtime
  except in unused code (which ADR-009 requires), and never removes a runtime
  check; diagnostic order and spans match ADR-009; `to` is raw ASCII only; `.py`
  refuses the grammar while `checked_int` works in both dialects; the existing
  `int` annotation path and its shadowing check are unchanged.

Two points the reviewer accepted from existing code rather than proving:

1. The static readable region used by `readable_span` (shared with mappings)
   was not re-derived. Not changed by this stage.
2. Whether every runtime path that creates an Int descriptor zeroes offset 16.
   The integrator then traced this: dynamic Int descriptors are created only by
   `wrap` (`backends/native/src/dynamic/routines.rs`, stores zero at offset 16)
   and static literals; Bool values are only the two static descriptors; the
   remaining offset-16 writers (`concat`, indexing, files, mappings, objects,
   tuples, rationals) build Text/Bytes/container/Rational descriptors.

Orders ADR-009 leaves open, recorded as observed behavior rather than defects:
the annotation is parsed before duplicate-name and local-limit checks; static
kind/range errors on a store precede that store's ledger and node errors; the
full limb-span readability check precedes the `1+n` debit, as ADR-009 lists.
