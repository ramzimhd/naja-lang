# Independent immutable tuple backend/source review

Review date: October 25, 2026. No actionable correctness defect was reproduced
within the pinned partial tuple slice. Unsupported tuple display, comparisons,
numeric operations, iteration and other promised semantics remain open work;
their explicit failures below are not compatibility or HATCH completion claims.

## Pins and ownership

The clean branch `agent/tuples-review-v13` began at exact backend source
`4e7f0c19e7dc927dcfb425ddc43d9a5411401e08`. Independent backend probes ran there.
The branch then fast-forwarded to exact integrated source
`b0456b62796dffc2042094567df65c1901429b10` before actual source probes.
The backend diff between these pins is empty. Relevant inherited commits:

- `17d272bd21fcdbc6d7b4d84ca71aa5f36f3147f3`: native tuple implementation.
- `b61e498a0f1f262707e37918eb4e32676872c3c1`: Tuple expression-height accounting.
- `4e7f0c19e7dc927dcfb425ddc43d9a5411401e08`: backend verification harness.
- `a1c0a14251ab81432a349ca3c8d15be2eba69e1e`: source tuple integration.
- `b0456b62796dffc2042094567df65c1901429b10`: frozen author source harness.

The review read the shared instructions, L04/current language contracts, ADR-005,
tuple/runtime documentation, constructor, tag dispatch, indexing, validation,
height accounting and shared parser. A second agent independently audited the
backend read-only and found no concrete defect. Product sources, authored
harnesses and shared planning remained unchanged. Only this report is committed;
all scratch and earlier evidence remain under ignored `target/`. Later structured
check/CLI work and other agents' source-harness results are outside this pin.

## Execution and counts

Host: Windows x64; Rust `1.97.1 (8bab26f4f 2026-07-14)`, Cargo
`1.97.1 (c980f4866 2026-06-30)`, Node `v24.11.0`.
Target: WSL Linux `6.6.87.2-microsoft-standard-WSL2 x86_64`; stack limit
reported `8192` KiB. No Python, interpreter oracle, provider/auth operation,
service, ownership change or external compiler/linker for native execution was used.

| Command | Source | Exit/result |
| --- | --- | --- |
| `cargo test --workspace --locked --offline` | Backend pin, then integrated pin | 0 both times; integrated run passed 241 tests |
| `cargo build -p naja-native --example tuples_ir --locked --offline` | Backend pin | 0 |
| `cargo clippy -p naja-native --all-targets --locked --offline -- -D warnings` | Backend pin | 0 |
| `node target/tuple-independent-ir.mjs` | Backend pin | 0; 53 independent IR cases, 257 oracle outputs |
| `cargo build --workspace --locked --offline` | Integrated pin | 0 |
| `cargo clippy -p naja-seed -p naja-native --all-targets --locked --offline -- -D warnings` | Integrated pin | 0 |
| `cargo test --workspace --locked --offline -- --list` | Integrated pin | 0; 4 frontend + 125 syntax + 11 native + 6 function + 3 index + 4 tuple + 20 seed library + 14 CLI + 17 manifest + 23 project + 14 scaffold = 241 |
| `node target/tuple-independent-source.mjs` | Integrated pin | 0; 77 independent actual-source cases, 257 oracle outputs |
| `node scripts/test-tuples.mjs` | Integrated pin, unchanged backend | 0; existing IR harness: 76 checks, 259 outputs, including count/tag/span/unsupported-operation mutants |

Independent IR cases comprised 48 native outcomes and five emission rejections:
nine exit 0, three expected resource 103, 29 expected type 105, one expected
division-by-zero 106 and six expected bounds 107. Independent source cases
comprised 55 native outcomes and 22 check/build rejections: 15 exit 0, four
expected resource 103, 29 expected type 105, one expected 106 and six expected 107.
Expected failure codes are not successful implementations of those operations.

Every accepted actual source passed product `naja check` and `naja build` before
native execution. Every rejection failed both with exit 1 and no requested ELF.
Two source cases also passed product `naja run --runner wsl --timeout-ms 5000`;
other retained ELFs ran through WSL's
`/usr/bin/timeout --signal=TERM --kill-after=1s 5 ELF` after `chmod`.
The IR adapter is development RPN plumbing, not a second NAJA grammar. No claim
that all source cases passed the product `run` route is made.

Independent suites froze 180 seconds overall, 20 seconds per host command, five
seconds per native artifact and 8 MiB captured output. IR/source summaries record
32,948 ms and 39,617 ms respectively. No native/source probe failed or timed out;
budgets and expectations were not raised. An initial unquoted PowerShell Git
peel expression failed; quoted `git rev-parse '4e7f0c1^{commit}'` resolved the full
backend pin before branch creation. No source/native result depends on that
shell parsing error.

## Independent adversarial results

The IR oracle constructs a heterogeneous 128-element tuple containing exact
large Node BigInt values, Unicode/NUL Text, Bytes, Bool, None and nested tuples.
Both index signs recover the intended element/capability at every position.
The source oracle independently constructs 128 large integer elements and checks
every position with both signs. Each matrix produces 257 outputs including len;
the two matrices are separate checks, not additional author-harness counts.

Additional actual source/IR observations:

- Empty tuple, nonempty tuple and a singleton containing an empty tuple have
  correct len and truth. Not produces Bool; and/or return their original selected
  operand. Truthy if/while/assert work without recursively interpreting children.
- Source distinguishes `()` from `(x,)` and grouping `(x)`. Nested/trailing-comma
  forms and tuples in function arguments retain comma ownership. Calls receiving
  two tuples still receive two arguments; a single tuple does not silently unpack
  into two parameters. `.py` uses the same supported tuple parsing.
- Selected elements retain their original scalar kind: True/False print as Bool,
  unary numeric use yields 1/0, None remains None, Bytes index remains unsigned
  Int, and Text index remains a scalar view. `.naja` integer validation preserves
  a selected Bool descriptor and rejects a tuple. `.py`'s supported annotation
  remains informational, permitting tuple len afterward.
- Child calls print once in left-to-right order. A failing child stops later
  printing children. Short circuit and a false comparison chain skip construction
  and its side effects. Division failure in a child occurs before the enclosing
  unsupported tuple operation's type check.
- Allocation pressure leaves room for one 16 MiB allocating child in a singleton
  tuple; both source and IR succeed. An explicit duplicated-child control raises
  arena 103 with the same 64 MiB budget. Repeated empty tuple construction alone
  prints a setup marker and exhausts the arena rather than silently recycling it.
- Tuple aliases preserve element pointers after original variables are rebound.
  Nested tuples and Text views remain usable after function return. Reindexing
  the returned structure yields the expected original Unicode/scalar data.
- False/True, computed zero, negative zero, large cancellation and negative
  indices select correct elements. Empty/out-of-range positions and 10,001-digit
  or computed multi-limb indices raise bounds 107 without machine-integer wrapping.
- Empty and selected nested tuple printing, unary numeric use, all six comparisons
  with a tuple on either side, and all five binary arithmetic operations with a
  tuple on either side raise the specified type 105. No None display, pointer
  equality or unrelated-type false fallback is silently substituted.
- IR accepts 128 nested tuple edges and rejects 129. Source accepts 127 singleton
  wrappers plus the scalar leaf (128 tree levels) and rejects 128 wrappers.
  Accepted deepest source is also checked/built/executed inside a function plus
  63 nested suites; main-thread checked-IR cleanup completes. The next expression
  level rejects before creating an ELF.
- Recursive source accepts 256 active calls and rejects 257. Eight nested tuple
  layers retain 1,016 pending descriptors per recursive level: source and IR input
  204 succeeds; 205 fails source-stack 103 before the call-depth bound. Constructor
  copying and its scratch use therefore execute near the unchanged stack budget.
- Explicit Unicode print/len aliases and comparison aliases work around and
  inside tuple elements. A len-alias parameter and an operator-alias local retain
  their bindings. A CRLF/Unicode invalid child reports original line 1, column 9.

The 22 source rejections cover count/depth overflow, bare comma expressions and
returns, unpacking, starred elements, comprehensions/iteration, builtin tuple
construction, slices, indexed assignment, empty/repeated separators,
multidimensional indexing, wrong arity, calls through tuple values, invalid
children in skipped/unused code and the explicit checked-i64 domain. These are
declared limits of this implementation, not changes to the founder's language.

## Construction, guards and lifetime assessment

The private tag5 descriptor stores array pointer/count, not serialized source or
a public ABI. Validation caps 128 children and accounts for every child in the
existing node/literal/depth budgets, including unreachable/skipped expressions.
The emitter evaluates children and pushes each descriptor through the existing
guard before calling the native constructor. The constructor checks unsigned
count<=128 before size calculation or pending-array reads, saves source/count in
allocator-preserved r12/r13, allocates `24+8*count` once, and copies the reversed
stack representation back into source element order. Empty tuple data equals the
end of its descriptor and is a valid empty used-arena span.

Tuple checking caps count, converts count to bytes without overflow under that
cap, checks pointer-add carry and confines the complete array to used arena.
Index then applies exact Int/Bool normalization, checks the selected descriptor's
24 readable bytes and its tag, and returns that descriptor. Existing Text/Bytes
and raw-number span checks remain in the indexing path. Unsupported tuple
print/comparison/numeric paths check tag5 before interpreting array metadata.
The retained author mutants exercise corrupted count/tag/array/selected-pointer
paths and unsupported-operation guard order. No concrete missing supported-path
guard, scratch-register overwrite or frame imbalance was found in code review.

Literal payloads and arena objects are immutable; neither returning a frame nor
rebinding a name releases them. Array entries therefore retain live descriptors
and scalar views under the current no-reclamation strategy. Checks remain
shallow: descriptor addresses/construction are internal invariants, and region
membership does not authenticate object provenance or recursively validate every
child. Modified executables, arbitrary pointers or hypothetical cycles are not
made safe by these guards. There is no mutation/cycle-construction API here.

## Limits and retained identities

The 64 MiB arena, 2 MiB source stack plus 4 KiB helper reserve, 256 calls, 128
locals/functions/parameters, 64 suites, 128 expression nesting, 10,000 aggregate
nodes and 1 MiB source/literal budgets remain. Native stack checks assume ordinary
OS stack availability; lower OS limits and large inherited argv/environment can
fail earlier. There is no reclamation, runtime loop quota, sandbox or portability
proof. Other targets, adversarial filesystem confinement, OS allocation-failure
injection and every global budget boundary were not independently retested.
The full non-tuple regression harness set and the author's frozen source harness
were not run by this reviewer.

Independent evidence is `target/tuple-independent-ir-4yVYpS/` and
`target/tuple-independent-source-GtXYI1/`; author IR artifacts are
`target/tuples-native-Tyoo0j/`. Raw inputs, ELF and streams are retained.
SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `bootstrap/driver/src/lib.rs` | `b5de83135f7565574b6fc7bbcb6a058765083d1a611f15b4d54981ee4ac4870e` |
| `bootstrap/driver/src/values.rs` | `39a7e4dc6eb793c9d3a208439b8bc6b92a71798e5f9990494473bab1d9389848` |
| `backends/native/src/dynamic.rs` | `524516898eeecb1d46ea5553c20343e431d4c3bb6a78e550ab0b9990ff71598f` |
| `backends/native/src/dynamic/routines.rs` | `98b102b262423b1ce8076ffcbad7b32c7200a641669c34658997ca8f2baed83d` |
| `backends/native/src/dynamic/routines/tuples.rs` | `89cb7caadf1ba824cc871e0d95cfba639738cbe2a004f7e091fc2aa1f2b9ff74` |
| `backends/native/src/dynamic/routines/indexing.rs` | `06720f16d0219bb270e49f8ac20d8b3a9e0755de2fb00858535f453b00399145` |
| `scripts/test-tuples.mjs` | `a20071e4b189649ea1c347a33a6282a211091f5a907e3bc1e42f5dcbb4f53e90` |
| Built `naja.exe` | `b9a456ef4503650523f612a6cbfbeaef561e0202c812f4233a25ab5e6745da83` |
| Built `tuples_ir.exe` | `a007086dc37da629f4a74dc34da81e2dd5405d7143b9279d76e921e828d58e33` |
| Independent IR `probe.mjs` | `881a850a6a8aafaba3522768af8cc156a1f2ca121edd34b4ec4f75bf9e254f2c` |
| Independent IR `summary.json` | `a1ea9b34eacfc8abdc7d73f6938385769f3054930f8543287bf5280b36ed4dbb` |
| Independent source `probe.mjs` | `afe9faba8d831a2e3bae0cba38c931a9a3f03634de6e1e0a2a11b203bb1f0fa9` |
| Independent source `summary.json` | `ced6771e1683c21c6b843bd2d0855f11904f61ea386038136f2ded0198ebf613` |

Selected independent source ELF hashes:

| Case | SHA-256 |
| --- | --- |
| 128-element exact-value matrix | `4cea4867beb88529f54a7a5d0a9acebacf7b747d9720efcca1caa5ac66c1936a` |
| Combined source/suite depth | `0da031a4271198f0164e390e063aa3a4cd0e53785552bdc862410f037318b87c` |
| Pending tuple stack 204 | `c396ca367a1312d25f20c432e4ad87972955330ca61a5b271ff2c4861419e708` |
| Pending tuple stack 205 | `a088c2d180e0164311f01a1f0c69fc604a20f798aa0a7a698fb6dac016b49cfd` |
| Project alias context | `5f9b5c04268dc02b90f84b4a52b0b4ef152bcaf4d9a8a9898f6bec8e1483a0f8` |

No correctness severity is assigned because no actionable defect was reproduced.
This evidence does not waive unsupported operations or any inherited gate.
