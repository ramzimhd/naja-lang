# Independent native/source indexing review

Review date: October 25, 2026. No actionable correctness defect was reproduced at
the pinned source. The observations cover this bounded Text/Bytes indexing slice;
they do not establish complete indexing, memory management, arbitrary modified
executable safety, full Python compatibility, portability, performance or HATCH.

## Pin and scope

The review branch `agent/index-source-review-v13` was created from clean source
`834014bf178471958fee0d7cefa2e9621dfce634`. Relevant implementation history:

- `bc52279280837f7efe133d7401c1affff918540e`: native indexing implementation.
- `bf466384a66ea749f7d6556b8245b287d0e067be`: Index expression-height accounting.
- `36ea3cd26459349703d3eb955d051db56ed82fc6`: native indexing harness/evidence.
- `834014bf178471958fee0d7cefa2e9621dfce634`: shared source postfix integration.

The review read the shared agent instructions, L04/language contracts, ADR-004,
bootstrap/index documentation, postfix parser, value height/lowering, native
emission, indexing/numeric helpers, allocator and relevant tests. Product driver,
backend, planning and the source-harness author's files were read-only. Only this
report is committed. Independent probes and all earlier review artifacts remain
under ignored `target/`. Later CLI work and integration are outside this pin.

## Executed evidence

Host: Windows x64, Rust `1.97.1 (8bab26f4f 2026-07-14)`, Cargo
`1.97.1 (c980f4866 2026-06-30)`, Node `v24.11.0`.
Target: WSL Linux `6.6.87.2-microsoft-standard-WSL2 x86_64`; `ulimit -s`
returned `8192` KiB. No Python, provider, auth flow or production service was
used. The Rust seed uses its normal host toolchain; emitted programs execute
independent Linux ELF instructions without an external compiler or interpreter.

| Command | Exit | Actual result |
| --- | --- | --- |
| `cargo test --workspace --locked --offline` | 0 | All 220 Rust tests passed |
| `cargo build --workspace --locked --offline` | 0 | Actual CLI built |
| `cargo clippy -p naja-seed -p naja-native --all-targets --locked --offline -- -D warnings` | 0 | No warnings |
| `cargo test --workspace --locked --offline -- --list` | 0 | Count confirmation: 4 frontend + 125 syntax + 11 native + 6 function + 3 index + 18 seed library + 13 CLI + 17 manifest + 23 project |
| `node scripts/test-index.mjs` | 0 | Existing development-IR harness: 72 checks, 2,107 oracle outputs, including corruption/mutant controls |
| `node target/index-source-review.mjs` | 1 | 63 completed cases passed; stopped at a reviewer-authored invalid project fixture |
| `node target/index-span-review.mjs` | 0 | Eight independent original/corruption control artifacts passed |

The project fixture incorrectly used the formerly accepted marker text
`[package] name="index-review"`. The pinned strict loader correctly rejected it
with NJA030/M0003/M0005 before source execution. The fixture was corrected to the
documented `[project]` table; no product code, expectation or budget changed.
The continuation command was:

```powershell
$env:START_AT = 'project-context-alias-index-expressions'
node target/index-source-review.mjs
```

It exited 0 for the remaining 14 cases. The original failing source, manifest,
diagnostic, script and partial results remain in
`target/index-source-review-bXDutl/`. The corrected continuation remains in
`target/index-source-review-w3F9R9/`. Across these two runs, **77 distinct actual
source cases completed**, comprising **62 native outcomes and 15 explicit source
rejections**. Native outcomes were 18 exit 0, five expected resource 103, eight
expected type 105, two expected division-by-zero 106 and 29 expected bounds 107.
All matched expected bytes and diagnostics. The stale-manifest fixture is not
counted as a successful indexing case.

Every accepted source passed actual `naja check` and `naja build`; each rejected
source failed both with exit 1 and created no requested ELF. Two accepted cases
also passed actual `naja run --runner wsl --timeout-ms 5000`, including operand
order and `.py` postfix precedence. Other emitted files ran through
`wsl.exe --exec /usr/bin/timeout --signal=TERM --kill-after=1s 5 ELF` after `chmod`.
This is real CLI source compilation and native execution, not 77 successful
product `run` invocations or a claim based solely on the author's IR adapter.

Independent source probes froze a 180-second per-run overall limit, 20-second
host command limit, five-second native deadline and 8 MiB output cap. The two
source runs recorded 49,298 ms and 2,138 ms. The fixed eight-artifact span probe
also used 20-second host/five-second native limits. No timeout occurred and no
arena, source stack, call, compiler depth or work budget was increased.

## Independent language/native results

The scalar oracle used Node scalar arrays and byte buffers, never Python. Four
seeded matrices used xorshift32 seed `0xa602d13b`, 96 Unicode strings and a mix of
random scalar values and explicit UTF-8 boundary/combining/NUL values. Positive,
negative and scalar-length results were compared byte-for-byte. The byte matrix
checked all 256 unsigned values with positive, negative and computed indices.
Together with Bool/computed-index cases these produced **3,528 independent
scalar/byte oracle outputs**, counted once; the continuation's script recalculates
that oracle counter but does not rerun those matrices.

Additional cases established:

- False, True, unary negative zero, positive False, multiplication/subtraction/
  floor-division/remainder zero, indexed byte zero and large signed cancellation
  select their exact expected positions. Bounds cases include sequence length,
  before-start, empty sequences, base1e9 boundaries, values above unsigned 64-bit,
  10,001-digit positive/negative literals and computed multi-limb products.
  They fail with NJA207/107 rather than wrap, narrow or select a different element.
- Indexing binds above unary signs/arithmetic, accepts full index expressions,
  and chains left to right. `-b'\xff'[0]` yields integer `-255`. Bytes results
  participate as unsigned Int; Text results are one scalar Text, including
  combining characters and NUL, rather than bytes or grapheme clusters.
- Sequence and index functions print `left`, then `right`, once each. Allocation
  pressure independently permits one allocating sequence operand and one
  allocating index operand; an explicit duplicate-allocation control reports
  arena 103. These tests retain the same 64 MiB budget.
- Both operands finish before the runtime target-type check: `None[1//0]` reports
  zero division 106, while a printing right operand runs before a None-target
  type failure. A failing left expression or inner index prevents later right
  side effects. An invalid index type on empty Text reports type 105 before
  bounds. False/True short circuit and false comparison chains skip failing
  index operations.
- Text views survive concatenated temporary backing, parameter/local rebinding,
  aliases, function return and 200 recursive frames. Reindexing, concatenation,
  equality, printing and scalar length remain correct afterward. A runtime-built
  Text with 1,048,576 scalars returns its correct first/last scalars.
- Infinite loops which allocate only Text index descriptors or Bytes index Int
  results print a setup marker and then report the expected arena 103. Views do
  not silently free their backing or bypass the shared arena budget.
- Actual CLI check/build/execution accept 127 postfix operations plus the leaf
  (128 tree levels), and reject 128 operations. A function body plus 63 nested
  suites ending in that deepest postfix expression passes; the next expression
  level rejects. The accepted `check` case includes main-thread checked-IR cleanup.
- A recursive function indexing its return accepts 256 active calls and rejects
  the 257th with the existing call-depth 103. Eight 128-argument wrappers retain
  1,016 pending descriptors per level and index their returns: source input 204
  succeeds, and 205 fails the existing source-stack 103. This exercises index
  helper scratch inside the unchanged 4 KiB reserve near the stack boundary.
- Explicit project Unicode print/len aliases and an operator alias work around
  and inside index expressions. An operator-alias name used as a local index,
  and a len-alias name used as a parameter holding Text, retain their bindings.
  A CRLF/Unicode undefined-index diagnostic retains original line 2, column 9.

The 15 source rejections cover expression-depth overflow, slices/steps,
multidimensional or trailing-comma indices, empty subscripts, indexed assignment,
calling an indexed value, undefined operands including skipped/unused code, and
the explicitly checked-i64 domain. Unsupported features are diagnosed; they do
not acquire silently different semantics.

## Bounds, UTF-8, lifetime and scratch assessment

The native helper first validates the sequence kind and bounded byte length,
then its payload span, and then the numeric index. All ordinary operands have
already evaluated. Raw numeric headers receive a 16-byte readable-span check;
a one-limb magnitude receives a 20-byte check before its unsigned load. A
canonical two-or-more-limb magnitude is necessarily out of range because the
64 MiB sequence cap is below base1e9. Negative normalization compares magnitude
to count before subtraction; a final unsigned position/count check protects
every element access. The tests cover the shared canonical zero object's range
through both Bool and computed zero.

Text's first walk validates the entire bounded payload, counts scalars, and
checks continuation widths, shortest forms, surrogate exclusion and U+10FFFF.
The second walk selects the scalar. Remaining bytes are checked before every
multi-byte continuation read. The width helper preserves its walking pointer,
remaining length and scalar counter. Bytes uses an unsigned byte load. No new
index work cap exists; Text is bounded by at most two walks of its existing
byte length, while native loops still require external deadlines.

Text results allocate a descriptor referring to existing immutable data. Literal
payloads persist in the RX image; arena payloads persist through process exit.
No descriptor relies on a returned function's stack storage. The helper saves
source `rbp`, reserves 64 scratch bytes, and restores `rsp/rbp` on success.
It leaves arena limit `r14` intact and advances `r15` only through allocation.
Source operands pending across nested calls use guarded stack slots; no concrete
clobbered-value, unbalanced-frame or view-lifetime defect was found.

The independent span probe starts from an actual source-generated ELF and writes
separate modified copies, preserving the original. Its outcomes were:

| Controlled artifact | Expected/actual exit |
| --- | --- |
| Original prints `N` | 0 |
| Empty span at exact final data end | Bounds 107 |
| One-byte span crossing that end | Invalid span 103 |
| Numeric header fits, first limb crosses final end | Invalid span 103 |
| Numeric header starts at final end | Invalid span 103 |
| Valid first ASCII scalar followed by surrogate encoding | Invalid UTF-8 105 |
| Valid first scalar followed by truncated four-byte encoding | Invalid UTF-8 105 |
| View begins at a continuation byte | Invalid UTF-8 105 |

These checks substantiate specific corruption diagnostics. They do not establish
object provenance or contain arbitrary executable modification. In particular,
descriptor addresses are internal construction invariants, and general
descriptor reads occur before payload-region checks. Source has no raw pointer
API here. Region membership alone does not authenticate an individual object;
it must not be described as a sandbox or universal memory-safety guarantee.

## Limits and retained identities

The 8 MiB compilation worker, 128 source expression levels, 64 suite levels,
128 locals/functions/parameters, 10,000 aggregate IR-node and 1 MiB source/literal
bounds remain. Runtime limits remain 64 MiB arena, 256 calls, 2 MiB source stack
with 4 KiB helper reserve and the existing division work bound. Native guards
assume ordinary OS stack availability; smaller stacks or large inherited
argv/environment can fail earlier. Worker allocation failure, alternate hosts,
general object provenance, reclamation and hostile concurrent filesystem changes
were not tested. The full non-index regression harness set was not rerun here.

Raw source evidence is in the two directories identified above. Independent span
evidence is `target/index-span-review-nJnwzK/`; existing author-harness artifacts
are `target/index-native-iSH9si/`. SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `bootstrap/driver/src/lib.rs` | `34c09f986fbc15b372812f406d2165a95c4c7aa501f4ec5d1950f99fea68436d` |
| `bootstrap/driver/src/values.rs` | `bfcf345fc44782410fbf585b160639ebf8815061e2d7276f5c0cb230945f79d2` |
| `backends/native/src/dynamic.rs` | `f2bd73b6f5839449ee0b56482a2e01f3a61ad8bc8c34f2c6eaabee1c60073908` |
| `backends/native/src/dynamic/routines/indexing.rs` | `ce5feed754d31ef1faa83e9733c93b978357391ae4b53902204cd97416252384` |
| `scripts/test-index.mjs` | `eae97e85755e5b115dbdc2d16e584cdbc323e39464646af01b0e7a0bf095581a` |
| Built `naja.exe` | `4e8392afe6fc666e7d73607eeaa453511916446b9736a7db07bb377c5e0f8bef` |
| Initial source `probe.mjs` | `5d8ea38a138eccda22bc3361f87448412ede50e49315cff5ee71dc0bd822d980` |
| Initial source `summary.json` | `9501a56d6626e7d5f51d4ff63d3f46168a2c965aca83b9a095937771a0d72261` |
| Continuation `probe.mjs` | `c87821d70522bc57031b27e867c8a3272598c43b522e649ed433de7ea4e99055` |
| Continuation `summary.json` | `bac21aa2a7228f0e8c91549494f1003d2c3b489c82c73bea968c0ee98cc96ca5` |
| Span `probe.mjs` | `b566b58d3ca1828dae05a8156bca787aa2cd7dc67095ca92031a7518d00c806f` |
| Span `summary.json` | `7e7e2db7363019fb17ebe25df2869be99206f3331bcc663e7cdd3da288e874cb` |

Selected independent native ELF hashes:

| Case | SHA-256 |
| --- | --- |
| First seeded scalar matrix | `afc70f7b1de247aa6a4d81206f421833a98284be6942a6a69a92e9581a92fd44` |
| All unsigned bytes | `b43f59d5d4629f7def8f2702c82671cc740af36c1d435357c865ee0cde6894af` |
| Bool/computed zero/cancellation | `b32725ed060f92b737ebad85910697effa2fff363ea35bd8f5300d68d51bbdbc` |
| Returned views and rebinding | `405f9064c98c74922b8a5ba6a5ba22ae1863e52b8482232548c6192bcbed250d` |
| Main CLI combined depth | `dd4c9566af0d1934450acd408e6a93f992e6f3c2086d1e284fbb853cc99f08ed` |
| Pending stack 204 | `418fdfc674df01139acb74af6c0a27589b8bdc11b5fdf4d696896a88b7091b2e` |
| Pending stack 205 | `7ce501ac9f4ad339de6675a652e62538d839e100f345e9efc383c3577aa17a76` |
| Project aliases/context | `c44401c58596cdd89dd60cced3b2a197ded1241e9b76c57949601526b179458f` |

No correctness severity is assigned because no actionable defect was reproduced.
The invalid preliminary project fixture remains a recorded review-script failure,
not a passing product case or an indexing defect.
