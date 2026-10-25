# Independent exact Rational review

Reviewed October 25, 2026 at exact source
`5ee64ec1fb02968964a81b0f07c086ae0578c684`. All 61 independently frozen native
outcomes passed: 31 source programs, 22 work-counter mutants and eight structural/
explicit-validation mutants. No concrete product defect, helper failure, timeout
or signal occurred. Expected exits were 22 zero, 18 resource/metadata 103, 18 type
105 and three division 106. No requirement or gate is promoted.

The separate `agent/rationals-review-v13` worktree began at `936865c7` and
fast-forwarded to the authorized execution source after preparation. Only this
report is committed. AGENTS, ADR-007, the frozen contract at
`23a6a59042c29502e180940bb38eab3c061a7925`, shared integer/divrem ABI and new
Rational helper/dispatch paths were reviewed. No compiler, harness, fixture or
planning files changed. No full Rust, source-220 or backend-101 rerun is claimed.

## Semantic and allocation observations

An independent Node BigInt reduced-fraction model supplied signs, zero, Bool,
large common factors, 68 arithmetic results and a separate exact comparison
vector. Native normalized numerators/denominators and comparisons matched.
Mixed Rational/Int/Bool arithmetic retained Rational results, including integral
values; Int-only results remained Int. Unrelated scalar/ordinary-instance equality
and unsupported container/arithmetic/display/reader/key operations followed the
frozen contract. Both children executed once left to right before kind/zero
guards; wrong kinds preceded zero shortcuts, while failing children retained
their earlier effects. Immutable aliases survived fields, returns and nested
List/Tuple/Dict selections. A 180-frame recursive addition returned exactly
`181/97`, retaining caller state across Rational helpers.

The no-allocation test filled the arena exactly, using pre-execution accounting
confirmed independently by the backend owner: zero Rational descriptor 24 bytes,
holder 2080, singleton List/Tuple 32 each and Dict 2072 total 4240 bytes;
31,534 filler iterations allocate `2080 + 48` bytes each, and a final Text
concatenation allocates 272. Their sum is the unchanged 67,108,864-byte arena.
At zero remaining bytes, repeated generic Rational truth, field/List/Dict
updates and field/List/Tuple/Dict selections printed `full` then `PASS`.
A separately frozen same-setup allocation control printed `full` then failed
103 on one extra `rational(0,1)`. Explicit numeric readers/arithmetic were kept
outside the generic phase because their allocation is permitted.

## Exact work and guard boundaries

Each cost below was derived before native execution from the frozen debit table.
Every operation succeeded at that exact counter and failed with
`NJA203: native rational work limit exceeded` at one unit below. The counter
selector was unique and unchanged. Descriptor allocation/wrapping had no extra
unlisted debit; implicit denominator-one added no input scan, and the coprime
gcd-one test did not invoke an extra charged compare kernel.

| Operation | Required units |
| --- | ---: |
| `rational(0,1)` | 5 |
| `rational(1,1)` | 82 |
| `rational(-1,1)` | 85 |
| `rational(1,-1)` | 91 |
| `rational(-1,-1)` | 88 |
| `rational(0,-1)` | 9 |
| `rational(1,2)` | 108 |
| Reader of `0/1` | 4 |
| Reader of `1/1` | 31 |
| Reader of `-1/1` | 34 |
| Reader of `1/2` | 57 |

Reader-only mutants transformed one uniquely selected immutable Int descriptor
into a canonical private Rational payload. This isolates the reader budget from
a prior constructor's larger cost; it is modified-ELF testing, not a source
literal representation or public ABI. Constructor counters used ordinary source
construction. Exact LOAD, raw-data, pointer and unused-field selectors were
asserted before modification; no matcher or tolerance was relaxed.

Eight separately frozen mutants tested the structural/full-validation split.
Structurally valid noncoprime `2/2` and an out-of-range numerator limb passed
generic truth without gcd/limb scans; explicit readers rejected both with the
exact invalid-Rational-span 103 diagnostic. Bad numerator pointer/count, zero
`0/2` and a negative denominator failed structural guards with 103. This confirms
the selected guards and their deliberate limits, not arbitrary-pointer
provenance, coprimality protection on generic paths or hostile-binary safety.
Static inspection found no concrete register/frame contradiction: operands and
work survive volatile helpers in fixed frame slots, generic guards restore their
caller registers, and iterative gcd preserves the stated shared counter.

## Execution and evidence

All plans were written with outcomes `not_run` before their execution. Actual
commands were `node target/run-rational-review.mjs`, then
`node target/rational-work-review.mjs --execute d77d13fceb3ca703977c31ddde32d97d47d3ea41e1fbd863ab2a9d900313deb9`
and `node target/rational-guard-review.mjs --execute c583cfd64d9fdca9e894415c0413be8ca679ca130664a46970f158c576919e0e`.
All exited 0. The source runner built with
`cargo +1.97.1 build --workspace --locked --offline` (exit 0); subsequent phases
checked the same compiler hash. Each phase checked exact HEAD/empty tracked
diff, used actual CLI check/build and executed ELF under local WSL
`/usr/bin/timeout --signal=TERM --kill-after=1s 5`.

Host: Windows x64, Node v24.11.0, Cargo
`1.97.1 (c980f4866 2026-06-30)`, Rust `1.97.1 (8bab26f4f 2026-07-14)`.
Target: Linux x86_64 through WSL kernel `6.6.87.2-microsoft-standard-WSL2`.
Compiler SHA-256: `b8e27272d2924ae3a49125c431e9ff157f45e160e9dd51b4faf5f77d3ca1ec9e`.
Phase budgets were 240/180/90 seconds respectively, with 45 seconds for the
compiler build, 20 seconds per ordinary command, five seconds per ELF and 1 MiB
capture per child. No budget changed. All 50 prepared source hashes remained
unchanged; 61 executed ELF hashes and 468 captures from 234 child commands were
checked afterward. Summed child time was 51,285 ms, not performance evidence.

| Ignored artifact directory | RESULTS.json SHA-256 |
| --- | --- |
| `target/rational-review-executed-01` | `c201bb8c0bf28d1e0077ddc69fc0197a0bb1d87e99663e4a97744608ed0bfe08` |
| `target/rational-work-independent-01` | `8a2fa0103637505b4ca51b9b5a9ee86e4c3a8d494189398652270a52800516b6` |
| `target/rational-guard-independent-01` | `1e67ca0604978b5fee4c8747122ad96a0c782e0595a38a24ff8153b43b3130ce` |

Original source/model plans remain under `target/rational-review-prepared-01`;
the ignored runner/model scripts, original/mutant ELF files, exact commands and
captures remain in this review worktree. The separate original source-220
preparation received a read-only inspection here, which missed the later
worker-discovered function/value rebinding fixture error. Its first failure and
narrow fixture correction remain separate evidence; that inspection was no
execution certification. The 61 outcomes above required no correction.

Full display/hashing, Decimal/general numeric protocols, dimensions, quantity
algebra, scale/affine point/delta relations, self-hosting, memory safety, cells,
human productivity, FC1 and HATCH remain open. Source `/` remains unsupported;
this review changes no language policy and uses no Python oracle.
