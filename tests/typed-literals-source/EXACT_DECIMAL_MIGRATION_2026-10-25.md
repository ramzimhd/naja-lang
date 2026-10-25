# Stage A compatibility after exact decimal token support

ADR008 accepts decimal-shaped suffix tokens through the shared frontend. Five
unchanged historical Stage A sources still use an integer-only eligible class,
so they continue to fail check/build. Their diagnostic moves from lexical F0006
with constructor advice to semantic NJA101 at the suffix:
`decimal typed literal requires an explicitly eligible exact literal class`.

The affected spellings are `1.5Vessel`, `.5Vessel`, `1.Vessel`, `1e3Vessel` and
`1E-3Vessel`. Their existing case IDs and all 150 source hashes stay unchanged.
Only these five diagnostic expectations change, with original suffix ranges
added. The other 145 identities, case categories, outputs/errors, budgets and
150-case count are unchanged. This does not relax numeric type eligibility.

Before editing expectations, 44 real CLI commands replayed the same five source
hashes through the retained source936865c compiler and new source6d8fb04 compiler.
The old binary matched its original recorded SHA-256 and its worktree compiler
inputs matched936865c. Old lex/check/build refused F0006; new lex produced
TypedDecimal and check/build refused the exact semantic diagnostic/range. Neither
build emitted an ELF. Seven additional before/after lexical controls preserved
integer suffixes, e ambiguity, malformed exponent, base suffix, .py refusal and
ordinary Float classes. All 12 focused controls passed.

The exact commands, compiler/source hashes and capture hashes are retained in
`reports/migrations/EXACT_DECIMAL_STAGE_A_2026-10-25.json`. Raw captures remain in
the source-integration worktree under `target/exact-stage-a-controls-klQwFY`.
No native execution is claimed by that focused migration control.

The original all-not_run preparation is retained byte for byte in
`PREPARATION_BEFORE_EXACT_DECIMAL_2026-10-25.json`; the old source936865c proof
remains unchanged. `STAGE_A_CONTRACT.md` records that historical initial slice;
ADR008 and this migration explicitly supersede only its decimal-token refusal.
The revised preparation remains all-not_run until separately executed at its
own exact source pin. No earlier failure or success is relabeled.
