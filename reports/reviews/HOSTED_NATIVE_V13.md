# Hosted native integer review — October 25, 2026

No actionable correctness defect was found in this bounded review. The reviewed
source is **`551214d92976357b55614ebad4d9e5bfafc7b1e0`**, on independent branch
`agent/hosted-review-v13`. This report is the only tracked change by the reviewer.
The prior `agent/recovery-review-v13` branch was preserved. Later integrator
changes, including CLI or Unicode work, are outside this result.

## Review scope

Read `AGENTS.md`, ADR-004, the backend and hosted-test READMEs, and the source for
the shared parser, `Values` implementations, hosted IR validator/emitter,
instruction encoder, arena allocator, arithmetic, comparisons and formatting.
The review considered sign/zero normalization, long carry/borrow chains,
multiplication intermediates, immutable aliases, private register conventions,
frame addressing, branch/loop initialization, suite handling, original source
positions and allocation failure.

The implementation deliberately has separate hosted and checked-i64 domains.
Its 64 MiB arena, lack of collection, lack of a runtime loop sandbox, and absent
functions/strings/other hosted values are documented limitations, not findings
against this slice. No public FFI ABI, production hardening, self-hosting, full
Python compatibility, FC1 or HATCH acceptance is established here.

## Environment and commands

Host: Windows x64. Rust `1.97.1 (8bab26f4f 2026-07-14)`; Cargo
`1.97.1 (c980f4866 2026-06-30)`; Node `v24.11.0`. Generated ELF programs executed
through Ubuntu WSL on `Linux 6.6.87.2-microsoft-standard-WSL2 x86_64 GNU/Linux`.
The tested emitted target is `x86_64-unknown-linux-gnu`, not Windows execution.

| Actual command | Exit | Result |
| --- | --- | --- |
| `cargo test --workspace --locked --offline` | 0 | 80 tests passed: 2 lexer, 60 syntax, 6 native, 11 seed library, 1 CLI; no failures |
| `cargo build --workspace --examples --locked --offline` | 0 | Fixture adapter built offline |
| `cargo build --workspace --locked --offline` | 0 | Actual CLI built offline |
| `cargo clippy -p naja-native --all-targets --locked --offline -- -D warnings` | 0 | No warnings |
| `node scripts/test-hosted.mjs` | 0 | 14 checks; 394 arithmetic/metamorphic and 150 comparison outputs matched Node BigInt; literal/carry mutants detected |
| `node scripts/test-hosted-language.mjs` | 0 | 18 source/CLI/native checks passed, including supported suite equivalence and rejection cases |
| Independent inline `node --input-type=module` probe harness | 0 | Nine additional probes, described below |
| Independent inline `node --input-type=module` comparison probe | 0 | 486 comparisons, described below |
| `git diff --check` before report creation | 0 | Clean pinned source |

The first independent harness invocation failed before execution because its
Node oracle used a unary minus immediately before exponentiation. No compiler
was invoked by that failed parse. Changing the oracle spelling to
`-(10n ** 50n)` produced the successful run above; this was a harness correction,
not a compiler failure or a changed expected result.

The independent harness wrote source and ELF artifacts only under ignored
`target/hosted-review-Lkyh0E/`. It invoked the real CLI for each accepted source:

```text
target/debug/naja.exe check target/hosted-review-Lkyh0E/NAME.naja
target/debug/naja.exe build target/hosted-review-Lkyh0E/NAME.naja --target x86_64-unknown-linux-gnu --output target/hosted-review-Lkyh0E/NAME.elf
```

`multiple-locals-branch-loop` and `branch-local-uninitialized` used `.py`.
For execution, `wsl.exe -d Ubuntu --exec wslpath -a ARTIFACT` resolved the actual
artifact, followed by `wsl.exe -d Ubuntu --exec chmod u+x RESOLVED_ARTIFACT` and
`wsl.exe -d Ubuntu --exec /usr/bin/timeout 5 RESOLVED_ARTIFACT`. The inline Node
processes used `spawnSync` argument arrays, a 20-second host call timeout and
an 8 MiB captured-output limit. No compiler, interpreter or assembler was called
by generated programs. Node BigInt computed test expectations only.

## Independent probes and observations

All six accepted programs passed CLI checking and building with exit 0. Five
then executed with exit 0 and exact expected stdout/empty stderr. The sixth
was the intentionally denied mapping and exited 103 as required.

| Probe | Independent input/expectation | Observed result |
| --- | --- | --- |
| `long-limb-boundaries` | For limb counts 1, 2, 3, 7, 31, 111, set `p = 10 ** (9 * limbs)`; test both signs of `(p-1)+1`, `p-1`, `(p-1)*(p+1)`, double negation and cancellation; add five negative-zero/zero-product spellings | 65 exact outputs; up to 1000-digit operands and 1998-digit products; zero prints `0` |
| `nested-expression-oracle` | 96 depth-4 binary trees; deterministic seed `0x92a4c771`; unsigned 32-bit LCG `seed = imul(seed,1103515245)+12345`; decimal leaves, signed addition/subtraction/multiplication and nested negation | 96 outputs exactly matched recursively evaluated BigInt expressions |
| `all-128-native-locals` | Assign each `v0` through `v127` the value `10 ** 50 + index`, then replace each with `v * -1 + index` and print it | All 128 output `-(10 ** 50)`; last frame slot behaves correctly |
| `multiple-locals-branch-loop.py` | Twelve iterations, switch branches at six, update large signed `a`/`b`, retain `old` aliases, initialize/read `t` in both paths, print three values per iteration and final sum | All 37 outputs exactly matched independent BigInt state updates |
| `long-comparisons-computed-operands` | All six comparisons for every pair from `[-p-1,-p,-p+1,-1,0,1,p-1,p,p+1]`, `p = 10 ** 300`; left operand executes `a + 0`, right executes `b * 1` | All 486 boolean branch outputs matched BigInt; runtime temporaries preserved both operands |
| `mmap-failure` | `print(1)` under `ulimit -v 32768` before exec | Exit 103; no stdout; exact stderr `NJA203: hosted integer arena exhausted` plus newline |

The mapping-denial execution used this bounded child command, with the resolved
artifact passed as a separate positional argument:

```text
wsl.exe -d Ubuntu --exec /usr/bin/timeout 5 sh -c 'ulimit -v 32768; exec "$1"' hosted-review RESOLVED_ARTIFACT
```

Four independent rejection probes all exited 1 before creating an ELF:

| Probe | Result |
| --- | --- |
| `local129` | `NJA101` at line 129, column 6: local limit of 128 exceeded |
| `branch-local-uninitialized.py` | After only one branch initializes `a`, `print(a)` rejected at line 6, column 7 |
| `loop-local-uninitialized` | Read of a new loop-local `t` after the loop rejected at line 5, column 7 |
| `original-span-unicode-crlf` | Unicode comment and named label plus CRLF do not shift `missing` in `print(missing)`; diagnostic remains line 5, column 7 |

The final rejection source was exactly:

```text
# café 🍃\r\n
{# État #\r\n
x = 1\r\n
}\r\n
print(missing)\r\n
```

Here `\r\n` denotes the actual CRLF bytes in the retained source, not literal
backslash characters. This probes Unicode user data and label positions; it does
not claim that Unicode identifiers are implemented at the pinned revision.

## Source and artifact identities

These are SHA-256 digests of the actual built input bytes and locally generated
artifacts. All full identities below are retained so the result is not attributed
to later source.

| Reviewed/built input | SHA-256 |
| --- | --- |
| `bootstrap/driver/src/lib.rs` | `04bbfed9be90e295fc39d505f5ab0b2b9ff5a27ee2679a76f916770175a0c744` |
| `bootstrap/driver/src/values.rs` | `0f59be647c5a690ff1784d7e3187b7924bcdbc4a836ca1620cdab3576a0252ae` |
| `backends/native/src/hosted.rs` | `aaa093933056b572ae38c4708200f9627e9844d6bda67da9fbf0778fdfe0d247` |
| `backends/native/src/hosted/runtime.rs` | `76c538a6a4bf48e7f2e7d21f4af06e9a1fe7ebf8372062bd82d167aaf9a8f8c2` |
| `backends/native/src/hosted/x64.rs` | `46f0a516e6e98998baf69f235a06f00b86cff5571c4e3d5216875e04cdaa1134` |
| `target/debug/naja.exe` | `55d672405a28e34ebde3a91137709cb67054a3d42735bae31bdc93b3d429242d` |
| `target/debug/examples/hosted_ir.exe` | `e2119c13eb1262594f9db76e864ffc9f96742b58ea117e29c950164d33e9db3f` |
| Independent `review-results.json` | `99d3fec5d01e1d68f8e8f4fa7b252e87f18e53e56d5e69b61580cf8b846f09cd` |

| Independent accepted probe | Source SHA-256 | ELF SHA-256 |
| --- | --- | --- |
| `long-limb-boundaries` | `be9c096c94243c37f27497c7c3d58fc87ed6ad2802dee11eb9768c0709b4354d` | `2b54382a4cd8228cd403be53a12ab78f215337b32180f18f68e869dd43b8c0f8` |
| `nested-expression-oracle` | `89eba650e52213b06df3bfab0d74944ea7df3a11d6601f3c6bdf3e894c8d0fb9` | `4cfc4a4ecf330f0e1b83a0929d37af2420537364bb5dedf83b906ea54c71e464` |
| `all-128-native-locals` | `569ffeec85ac3e89814fb33f8d779acacf5cb1108142655f56cf978f0aba39bd` | `cdee6c55e7a1660a1cf71715c9b3a17ba0d78b35b38a4b8757ba992977c9d01f` |
| `multiple-locals-branch-loop` | `339d4f4ad09b9c6f231d6df3e2025bbd350d6006fc054187ef97eab53b2f1608` | `44e264e49585bfb3bbf359cbc020d8d210a5db565516e918d89c4302b69d34c8` |
| `long-comparisons-computed-operands` | `2f53a2a9d45ec9110d8d1f4fca9c54492a0d1f4ba6a1e0a4b4e8eb2695a2c9fe` | `be3a690855bde23db0ef2c0c8028086b86f358750cf33d696b8910a4e1464a6d` |
| `mmap-failure` | `cc42155088fca5730758db72b2a5bca33112a941dfaa2d43098ec422ce4ea213` | `91111ad92361503dac0fb31355277f43a1f413118a158566da79b322716e7c0e` |

Rejection-source hashes are retained in `review-results.json` with exact
diagnostics; its paths are sanitized to `<probe-dir>`. These ignored artifacts
are local review evidence and are not included in this scoped report commit.

## Assessment and handoff

The observed implementation preserves full integer values on these probes.
Inspection found bounded u64 limb intermediates, initialized product storage,
normalization after subtraction/product, non-mutating operands, bounded arena
allocation, and expression spilling around private runtime calls consistent with
the exercised behavior. Definite initialization correctly rejected the supplied
one-path and zero-iteration cases. No severity is assigned because no actionable
counterexample was found.

This is finite deterministic adversarial testing and source review, not a proof
over arbitrary programs. Partial writes/EINTR were inspected in source but not
independently fault-injected. SIGPIPE retains its documented OS behavior. The
existing author suite independently rerun here covers `/dev/full`, arena
exhaustion, aliases and supported suite equivalence; these are not newly authored
reviewer tests. No performance result or human productivity timing was taken.

The integrator can review this report at the pinned source. Any later source
change needs checks appropriate to that change; this review must not be silently
attached to a newer commit. Production source, shared planning and live
integration ownership were not modified by this reviewer.
