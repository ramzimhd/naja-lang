# Pre-freeze native interval harness corrections — October 31, 2026

The October 31 session reached its account limit after drafting the backend,
driver, harness and contract in this worktree but before freezing
`PREPARATION.json` or committing anything. No interval ELF had executed. The
resumed session reviewed the uncommitted draft before freezing it.

Interrupted draft identity, retained as the session's only prepare-only output:

- `scripts/test-intervals.mjs` SHA-256 `7f51fb9853650aa920a0b16325f4df13b8d7371c6bc1183162c9bdff7de672f0`
- `target/intervals-native-xou5yk/plan.json` SHA-256 `e77af5f5eecbea04efe9987c46a23523ae405522559998f1c54f90cc7b3b77b1` (113 cases, all `not_run`)

Two fixture defects were found by static review, before any native execution:

1. `child-failure-stops-later-child` called a one-parameter function with
   `call:1:0`. The unchanged IR validator rejects that program before emission
   (`dynamic call requires exact positional arity`, exit 1), so the case could
   never test child-failure ordering. The unreachable function now takes zero
   parameters and returns `2`; the frozen expectation (stdout `1`, exit 106,
   `NJA206: integer division by zero`) is unchanged.
2. `full-arena-checks-allocate-nothing` printed an Int after filling the arena
   to exactly zero free bytes. Native Int printing allocates its decimal buffer
   from the arena, so that print would fail with arena exhaustion for a reason
   unrelated to intervals. The 200 Int checks remain; only the final Int print
   was removed, and the expected stdout is now `True` from the Bool check,
   which prints without allocation.

Lint method: every non-reject fixture source was written out and emitted once
with the unchanged `intervals_ir` driver. All 103 emitted; no ELF was run, and
the reject fixtures were not inspected, so no outcome was observed before the
freeze. The original defect 1 source was emitted separately and reproduced the
arity refusal above.

Frozen identity after correction:

- `scripts/test-intervals.mjs` SHA-256 `bea9ba0cb10d168ff61a4854205345887ee1af23401f421eacbb539f198514f5`
- `tests/intervals/CONTRACT.md` SHA-256 `cdba98ac99ac2fc628c1ebd9064fe38f3b2c7de846d79f80afdd562148527cac`
- `tests/intervals/PREPARATION.json` SHA-256 `001dba5927ba6c7282a90612a3098a1bfb65ee0e91d18799347326f114186531` (113 cases, all `not_run`)

The workspace also needed one driver arm: `bootstrap/driver/src/values.rs`
`height` now counts `IntegerInterval` as one node above its tallest child, so
the exhaustive match compiles. No source lowering uses the node yet.
