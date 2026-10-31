# Integer interval source execution evidence

The first execution of the frozen source harness passed all 148 outcomes at
source `daf60e1749ba4a3d4a0ee6c4347b3bee499f93ab`, exit 0: 75 compiled programs
ran as Linux x86-64 ELFs, 66 programs were refused by both `check --json` and
`build`, and 7 passed `check` only. 447 child commands were recorded. Native
exits were 0 (22), 105 (33), 112 (13), 113 (2), 106 (2) and 103 (3). No case,
expectation, budget or compiler source changed after that run. The
[preparation](PREPARATION.json) stays all-`not_run`; the
[execution results](EXECUTION_daf60e1.json) hold the observation. Two draft
fixture defects were corrected before the freeze; see
[PREFREEZE_CORRECTIONS.md](PREFREEZE_CORRECTIONS.md).

Command, run after committing the compiler lowering:

```text
node scripts/test-intervals-language.mjs --expect-source daf60e1749ba4a3d4a0ee6c4347b3bee499f93ab
```

Host: Windows 11 Pro for Workstations 10.0.26200 (`win32-x64`), Node v24.11.0,
cargo 1.97.1. Target: WSL2 `Linux 6.6.87.2-microsoft-standard-WSL2 x86_64`.
Compiler `naja 0.0.1`, SHA-256
`07137a3752d8e1dab15ead50ba0a6da908637e7a1bb45aae89f512c1cef78c55`.
Artifacts remain in `target/intervals-language-cxax32/`; stdout was captured as
`target/intervals-language-first-execution.log` (4996 bytes, SHA-256
`5f850b5861b58008fa1724d053fde0f9f32b03ed6bf135cc2d5458e77852fa85`).
`EXECUTION_daf60e1.json` SHA-256 is
`9ef8d7200f5bf3dfc36c14075caa446779c949cb4a1ae5f4ffaaf832f96da59c`.

What this shows, against an independent Node BigInt model: `checked_int` in
both dialects and `.naja` local `(lower to upper)` annotations with inclusive
signed and Bool bounds beyond machine width; checks on every store including
branch, loop and unused code; per-function annotation tables with outer
restore; copies and arithmetic results staying unrefined; static NJA101
diagnostics with original UTF-16 ranges for known wrong kinds, inverted bounds
and proven outside constants, including CRLF and non-ASCII sources; unproven
calls, arithmetic, containers and single known bounds staying runtime-checked;
endpoint, `to`, import, arity and `.py` grammar refusals; exact work boundaries
(999,999 / 1,000,008 / 1,000,000 units); per-store literal-ledger exact and
one-over pairs; injected node and height limits; unchanged suite, source, import
and call-depth limits; zero-free-byte arena checks; private file input; and
changed-source and changed-input controls.

What it does not show: Decimal, Float or Rational intervals; named refinement
types; refined fields, parameters or returns; patterns; NaN or infinity (no
Float type exists yet); general constant folding or type inference; or any
L09, FC1-06 or HATCH gate. Native targets other than Linux x86-64 were not run.
