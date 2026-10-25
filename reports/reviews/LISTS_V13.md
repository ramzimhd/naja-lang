# Independent native/source mutable list review

Review date: October 25, 2026. No actionable product correctness defect was
reproduced at exact source `aba7307c9c044f83dc3129581744529a627b1d08`. The clean
review branch is `agent/lists-review-v13`. Product sources, authored harnesses,
editor files and shared planning remained read-only; only this report is committed.
Earlier artifacts and failed probes were preserved under ignored `target/`.

The review read the shared instructions, L04/current language contracts, runtime
code/docs, `tests/lists/CONTRACT.md`, list README, and shared parser/lowering diff
`662bcdcff3a5742d9271b5f449becaa724503d78`. Optional diagnostics observations are
separate below; their inherited implementation commit is
`5d00f2408a1a52cf83c4768a9c5d0d45b58b62ea`. Later integrations are outside the pin.
Unsupported display/comparison/arithmetic are explicit partial limits, not a
waiver of required language semantics, full-list compatibility or HATCH gates.

## Actual execution

Host: Windows x64, Rust `1.97.1 (8bab26f4f 2026-07-14)`, Cargo
`1.97.1 (c980f4866 2026-06-30)`, Node `v24.11.0`.
Native target: WSL Linux `6.6.87.2-microsoft-standard-WSL2 x86_64`; reported stack
limit `8192` KiB. No Python, provider/auth operation, service or ownership change
was used. Generated ELF execution did not invoke a foreign compiler/interpreter.

| Command | Exit/result |
| --- | --- |
| `cargo test --workspace --locked --offline` | 0; 247 tests passed |
| `cargo build --workspace --locked --offline` | 0 |
| `cargo build -p naja-native --example lists_ir --locked --offline` | 0 |
| `cargo clippy -p naja-seed -p naja-native --all-targets --locked --offline -- -D warnings` | 0 |
| `cargo test --workspace --locked --offline -- --list` | 0; counts 4 frontend + 125 syntax + 11 native + 6 function + 3 index + 3 list + 4 tuple + 21 seed library + 16 CLI + 17 manifest + 23 project + 14 scaffold = 247 |
| `node scripts/test-lists.mjs` | 0; existing native regression: 97 checks, 385 oracle outputs, span/tag and disabled-store controls |
| `node target/list-independent-source.mjs` | 1; 57 source cases passed, then a reviewer-authored unrolled fixture exceeded the fixed source parse budget |
| `$env:START_AT='nearfull2000-stores-with-loop-counter'` then `node target/list-independent-source.mjs` | 0; 34 continuation cases completed |
| `node target/list-store-ir-review.mjs` | 0; pure near-full stores, allocation control and disabled-store source-ELF mutant |
| `node target/list-store-value-span.mjs` | 0; original plus three stored-value span/tag corruption controls |

Across the source runs, **91 distinct cases completed**: 69 native outcomes
and 22 explicit check/build rejections. Native outcomes were 21 exit 0, four
expected resource 103, 35 expected type 105, two expected division-by-zero 106 and
seven expected bounds 107. Every accepted source passed real product check/build;
each rejection failed both with exit 1 and created no requested ELF. One ordering
case also passed `naja run --runner wsl --timeout-ms 5000`; other retained ELFs ran
through `/usr/bin/timeout --signal=TERM --kill-after=1s 5 ELF` under WSL after chmod.

Independent source runs used fixed 180-second overall, 20-second host-command,
five-second native and 8 MiB output bounds, recording 36,383 ms and 11,244 ms.
The fixed IR/value-span controls used the same host/native/output bounds.
No timeout or product budget increase occurred. Expected failures are not
successful implementations of the unsupported operations.

## Independent semantics and ordering

A Node BigInt model starts with 128 elements, performs 509 deterministic signed
updates through alternating positive/negative indices, observes each through an
alias, then reads all positions and len. All **638 independent outputs** matched.
The continuation recalculates that script counter while skipping the matrix;
the outputs are counted once. These expectations do not use Python or the author's
native model. Separate source controls storing 2 versus 3 produced exactly 2 versus 3.

Critical mutation cases passed:

- A nested call target prints value, sequence, inner index and final index in
  order, once each, before the expected store. Final-Index decomposition does not
  execute a read of the assignment's final element.
- RHS mutation replaces the target list in a holder and changes an index through
  aliases. The subsequent assignment uses that new target/index; the original
  list remains unchanged. Conversely, an index function replaces a holder after
  the sequence has been captured: the store updates the already-selected old list,
  while the holder continues to reference its replacement.
- Parameters and tuple-held references share list mutations. Rebinding a
  parameter to a new list does not replace the caller's alias. Original Bool,
  None, Bytes, Unicode Text views and arbitrary integer descriptors survive store,
  return and later rebinding with their expected tags and precision.
- Self and indirect cycles support shallow len/truth/index/store without recursive
  traversal. A later store breaks a cycle and is visible through the expected
  aliases. Tuple/Text/Bytes and scalar mutation targets fail type 105; nested
  mutation of a List held inside a tuple works.
- A value failure prevents both target and index effects; sequence failure occurs
  after value effects and before index effects. All three expressions execute
  before target validation. An index expression's bounds failure precedes a
  wrong-target type check. RHS alias effects occur before a later invalid-index
  failure. No claim of external rollback or catchable exceptions is implied.
- Construction evaluates children once in order and stops on the first failure.
  Standalone List/tuple/scalar/call expressions evaluate and discard results;
  side effects remain. Discarded empty lists in a loop exhaust the arena, proving
  allocation is not silently skipped. Short circuit skips unreachable list errors.
- Bool, computed zero, exact negative and huge indices normalize correctly for
  stores. Empty/out-of-range and 10,001-digit/computed huge indices fail 107.
  Unsupported list display, comparisons on either side, arithmetic and numeric
  use fail 105 rather than falling through to false, None display or pointer equality.
- Actual source accepts 128 elements, 127 nested list wrappers plus a leaf and
  combined deepest expressions inside a function plus 63 suites. Count/depth
  overflow rejects. Recursive calls accept 256 and reject 257; pending list
  elements accept calculated input 204 and fail source-stack 103 at 205.
- Explicit project Unicode print/len/operator aliases retain context in list
  elements/indices and mutable parameter bindings. Invalid or uninitialized RHS,
  target and index are rejected even in skipped/unused code. Conditional or
  zero-iteration-loop initialization does not initialize a later mutation target.
  Slices, multidimensional/augmented assignment, unpacking, starred/comprehension
  forms, unsupported constructors and non-final-Index targets reject explicitly.

## Near-full arena evidence and retained source failure

The frozen contract's prefix retains 127 allocations of 524,288-byte payloads
and seven of 65,536-byte payloads, leaving less than 64 KiB. An initial source
fixture unrolled 2,000 assignments and expected successful compilation. It
instead failed NJA101 at the fixed 10,000 source statement/parse-operation budget.
Parsing accounts for the full Index target before SetIndex decomposition, so this
source form costs more parse operations than the final backend SetIndex IR.
The failed source, diagnostic, script and partial results remain in
`target/list-independent-source-RMAEER/`; it is not counted as a successful store test.

The continuation preserves 2,000 stores and all budgets with 100 store statements
inside 20 loop iterations. It reports `prefill-done`, `None`, and iteration count
20. Its numeric counter has small explicit arena overhead (at most 20 one-limb
increments, bounded by 960 bytes, plus final formatting); it is not described as
an allocation-free entire program. A same-prefix 2,000-list allocation control
fails arena 103. Both remain inside the original source/IR limits.

An independent development-IR fixture additionally performs the original **2,000
unrolled stores of existing descriptors without a counter** and succeeds, while
the same-prefix 2,000-list allocation control fails 103. The retained existing
native regression independently passes its frozen pure-store/control cases.
Thus the failed oversized source form was not repaired by reducing the store
count, raising a cap, disabling a test or accepting timeout as success.

A copied ELF from the independently compiled `a[0]=2` source had only its native
store instruction replaced with NOPs. It exited 0 but printed 1, which the source
oracle expecting 2 rejects. The original file/hash was preserved. This is a
detected controlled defect, not acceptance of the mutant's wrong behavior.

## Native guard assessment

List uses private tag6 and a fixed count<=128; Tuple keeps tag5. The common
constructor checks count before `24+8*count`, preserves its source/tag/count across
the allocator and copies descriptor pointers in source order. Static assertions
keep the shared constructor's Tuple/List capacities equal.

SetIndex emission saves value and sequence on guarded source-stack slots while
evaluating later expressions. The shared native read/store helper reserves 64
scratch bytes, preserves the source frame, and accepts mutation only for tag6.
It checks complete array count/span, exact Int/Bool index normalization, bounds,
then the new descriptor's readable 24-byte span and shallow value validity before
the pointer store. No allocating helper is called on the store path itself.
New-value descriptor and selected-element validation share bounded, shallow checks.

The independent stored-value ELF controls keep a valid target/index but change the
RHS descriptor pointer to null/code, or change its tag. They respectively report
span 103 or type 105; the original marker-valued store succeeds. Author mutants
also cover count/array/tag/selected-descriptor and unsupported-operation guards.
No concrete missing supported-path guard, wrong-tag fallback or scratch/frame
imbalance was found. Cycles do not trigger recursive child traversal.

These are corruption diagnostics under internal descriptor-construction
invariants. Region membership does not authenticate object provenance or make
arbitrarily modified executables safe. List sharing/mutation is not concurrent
mutation support, GC, reclamation, an ownership proof or a sandbox.

## Optional structured-check observations

Four initial focused cases passed: UTF-16 positions after BMP/astral characters
with LF/CRLF/CR (range line 1, characters 9..16), and an empty-PATH valid check
containing print plus an infinite allocating loop. The latter returned only a
passing JSON document, with no execution or new artifact. Semantic failures used
exit 1 and one JSON document with empty stderr.

The first omission oracle incorrectly assumed 40 NULs generated 40 diagnostics
and expected 8 omitted; the actual report omitted 48. That probe exited 1 and is
retained in `target/list-check-json-review-dMUDgl/`. A first raw-frontend counter
also exited 1 because the reviewer mislabeled the second diagnostic as F0001.
Its original source/executable and failure note remain as
`target/list-diagnostics-count-first.*`.

Primary lexer code emits both F0008 and F0007 per NUL. A corrected standalone
Rust development probe directly reads the unformatted public frontend diagnostics:
40 of each, total 80. The report's 32 retained plus 48 omitted is therefore exact;
the cap/expectation was not weakened to accept inconsistent counting. The raw
counter was built with the following command (exit 0), then executed (exit 0):

```text
rustc --edition=2024 target/list-diagnostics-count.rs --extern naja_frontend=target/debug/libnaja_frontend.rlib -L dependency=target/debug/deps -o target/list-diagnostics-count.exe
```

`node target/list-check-json-followup.mjs` exited 0 for this raw-count comparison
and three input/usage refusals: invalid UTF-8, unsupported extension and duplicate
JSON option. Those failures used stderr/exit 1 with empty stdout, not semantic JSON.
These eight focused behaviors do not establish an LSP, URI identity, stale-document
handling or complete CLI/protocol acceptance.

## Limits and identities

Arena 64 MiB, source stack 2 MiB plus 4 KiB helper reserve, 256 calls, 128
locals/functions/parameters/elements, 64 suites, 128 expression depth, 10,000
aggregate IR/source parse operations and 1 MiB source/literal budgets remain.
Native guards retain ordinary OS-stack assumptions; runtime loops still need
external deadlines. Other OS targets, allocation-fault injection, every global
boundary and the full non-list harness set were not rerun here. Source-harness
work owned by another agent is not claimed by this review.

Independent continuation evidence: `target/list-independent-source-Bbnzxr/`.
IR/store and value-span controls: `target/list-store-ir-review-SRA4m2/` and
`target/list-store-value-span-aAErAr/`. JSON followup:
`target/list-check-json-followup-9Gbj8b/`. Existing native list artifacts:
`target/lists-native-Z4EOoi/`. SHA-256 identities:

| File | SHA-256 |
| --- | --- |
| `bootstrap/driver/src/lib.rs` | `748ea517da6abc81c752a5d8bcbea2e8f3fc6fd1012363af96d4d618f02d9744` |
| `bootstrap/driver/src/values.rs` | `9055a48ee4f148800efdb268180525d6af0bbe087d40acb5e41a2f37beeccdaf` |
| `bootstrap/driver/src/source_reports.rs` | `7c57e09fb143270f2c605c826f88cbcad808afee1f186447d8a598fccb8d14de` |
| `backends/native/src/dynamic.rs` | `2a6b279e8024d651545af41060974b3ac3b9f377f0e65e5f5f991b998a9f04a5` |
| `backends/native/src/dynamic/routines/indexing.rs` | `f996dc48d0ec824a1cc223745b3e5b95b35dfaf87b391a2673acdf7e2a5050a7` |
| Frozen `tests/lists/CONTRACT.md` | `85d2556fd3e43e03660db4d2d536a99d68c37edbcf29bf14c52041d6d2980247` |
| `scripts/test-lists.mjs` | `7fa7a64a3dd1ce05fed3fef02539ab552a537359bca787e1b42ef865f1a9271c` |
| Built `naja.exe` | `8a5f56e659e9117c2cda7ab1c54b67239a85a7ebceaa72e4a07f9c6991051a5a` |
| Initial source `probe.mjs` | `eaa21af04fc4872611f6e2605ed51d14351737e8b8ef5745dbe08e2db5cb5553` |
| Initial partial `summary.json` | `2c1ae4ee80efb0311064b267401b097030038ef29b78a123757ae4bb15c38a75` |
| Continuation `probe.mjs` | `13aef7f30101d084180c442b1cd3b25c6b35cc3b18108b1c42ea5583a248636c` |
| Continuation `summary.json` | `15ca4e2c29d5ee9b380741e3c0a9796e06adec01d7a2410488b0acd8c3edd237` |
| Independent IR/control `summary.json` | `e8ba6135a0d148fc528538bef7de5695bd16e4ccdedc4bd0a0525ab7ea54d82f` |
| Stored-value span/tag `probe.mjs` | `bafb15e7cdc6c1bf2865f1127c9bdadf602aa0f08d953448e5c088bde6f06ae2` |
| Stored-value span/tag `summary.json` | `84d17dddbe253bcc659bef19c743ae1a268e48a0dc2005c0a79b66e43fffbd56` |
| JSON followup `summary.json` | `eac66eff7e18f1bd470dee0a9f00a52a1de208b720176fe937cec39906f3314e` |

Selected source ELF hashes:

| Case | SHA-256 |
| --- | --- |
| 128-element mutation model | `d68284b04fae8a7d8300ce70a97f68505ce8e07ca1955bf3641f0c71b57eb565` |
| RHS changes target/index aliases | `4e887e19b7e1b1a0f90ca529f51ec08fafeb8bf22e35e258fc00fe45c8fb29c7` |
| Index changes holder after capture | `e3d61b592abe2c63a7245044134c4f752b52cafa9fe11b86bc540214e04a4af5` |
| 2,000 stores with loop counter | `21a0f786d06933a185bbd259fc800185585f99149421b1b3522cabd626925077` |
| Same-prefix list allocation control | `ce73f51f4f4df33413833938d173b0e2af285b7e477eb6e655ea028056b68775` |
| Pending list stack 204 | `4d0eabe85c403267c589bf840e0d9462fb758c086d22324255c99bc08b823038` |
| Pending list stack 205 | `b9d3532c0bad6f3ce248e6ef3b26e53e82da63a5cdec2cf0a15086859c4be7f7` |
| Source control stores 2 | `53abac8f25d1ad94981666fa87a53f3c3fc5627b595d5424dc24df5a6ecc7416` |
| Source control stores 3 | `4135c55ab5eebf7d30c93c9f19f1893ff2aeba39ba1c988ca3f772b8a5e4d276` |

No severity is assigned because no actionable product defect was reproduced.
Retained failed test assumptions remain failures, and unsupported semantics and
all inherited acceptance gates remain open.
