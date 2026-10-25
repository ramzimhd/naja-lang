# Independent typed-literal Stage A review

Reviewed October 25, 2026 at exact source
`936865c7ef4dd566b4e4523089b1e6bad09534fe`. All 47 independently preregistered
outcomes passed: 15 actual native ELF executions, 30 check/build refusals and
two lexical classification cases. No concrete product defect, helper failure,
timeout or signal was reproduced. No requirement or gate is promoted.

The separate branch `agent/typed-stage-a-review-v13` began clean at that source.
Only this report is committed. The review read AGENTS, ADR-006, the frozen
Stage A contract/preparation, shared frontend/driver change
`841660890f7e4fb9ec2103df589e4266d9e7c22c` and ordinary constructor lowering.
It did not rerun the separate 150-case suite or Rust test suite, and does not
claim their results. Product/compiler/harness/planning files remained unchanged.

The shared lexer preserves decimal/exponent/base classification and creates a
typed token only after validating an adjacent decimal integer and XID suffix.
The driver retains separate original spans, canonicalizes the suffix through
the existing binding/private-name checks, requires the resolved class's explicit
capability, and lowers to ordinary native construction with one exact integer
argument. The marker is static import/class metadata. No application-name table,
marker callback, foreign interpreter or separate source parser was found.

The native BigInt vector independently derived 19 values based on powers from
`2^130` through `2^364`, with varied decimal separators; every constructed field
matched exactly. Unrelated renamed classes performed their own transformations.
Constructor markers distinguished unary-object failure from postfix access:
`-9Stone` constructed positive nine before type exit 105, while `-9Stone.value`
constructed nine then produced negative nine. Method/index/arithmetic precedence,
ordinary negative construction, left-to-right argument effects and short-circuit
suppression matched the frozen expectations. Rebinding `self` did not replace
the original result; self-class construction inside a method worked. A non-None
initializer result preserved its effects then returned the exact type error.
Declaring/importing the marker and class produced no constructor effects.

NFKC marker imports, class identities and suffix spellings resolved consistently.
Parameter bindings, including canonical lookalikes and reassigned parameters,
shadowed suffix types with the agreed diagnostic. Private initializer parameters
and an NFKC private local rejected through the existing conservative guard;
full name mangling remains unimplemented. Comment-only markers did not opt in,
eligibility did not leak to a following class, and an aliased marker had no
ambient original spelling. Marker calls, first-class values and canonical import
collisions rejected. Marked conventional construction worked in `.py`; suffix
syntax retained its `.py` lexical rejection.

Sixteen malformed/ambiguous decimal, base, exponent, imaginary, underscore and
leading-zero spellings rejected with F0006. Ordinary `10j` retained F0013.
Separate lexical cases retained Integer tokens for valid bases and Float tokens
for valid exponent/decimal forms, without claiming native float/base execution.
Exact typed token text included zero groups and a Unicode suffix. ADR-006's
ambiguity rule is explicitly ASCII: raw `13Ｊewel` was a valid typed token
resolving canonical `Jewel`, while ASCII `j/J` starts retained their ambiguous
numeric classification. An underscore-leading class remained constructible by
its ordinary constructor.

Original-source JSON diagnostics covered only the suffix. A CRLF source with
non-BMP characters diagnosed `未定義` at zero-based line 1, UTF-16 characters
17..20. Canonical parameter shadowing covered original `Ｋappa` at line 6,
characters 13..18; reassigned-parameter shadowing covered `Stone` at line 7,
characters 12..17. Three thousand typed expression statements executed within
the inherited parse budget; 3,400 rejected at the unchanged 10,000-operation cap.
This does not independently exhaust every source/tree/literal/arena/call bound.

The original plan froze all 47 source identities and expected outcomes as
`not_run` before execution. Actual command:

```text
node target/typed-stage-a-independent.mjs --execute 7d6f28af54e688e0b5ac56bfaf8ffbea501a212099d5a3df3393b50c452b35d8
```

It exited 0. The helper verified exact HEAD and an empty tracked diff, then ran
`cargo +1.97.1 build --workspace --locked --offline` (exit 0), real CLI
check/build/lex and local WSL
`/usr/bin/timeout --signal=TERM --kill-after=1s 5 ELF`. Host tools were Windows
x64, Node v24.11.0, Cargo `1.97.1 (c980f4866 2026-06-30)` and Rust
`1.97.1 (8bab26f4f 2026-07-14)`; WSL reported `Linux x86_64`. Native outcomes
were 13 exit 0 and two type exits 105 with exact stdout/stderr bytes. The BigInt
ELF inspection found no INTERP segment or dynamic section.

Budgets remained 240 seconds overall, 45 seconds per compiler build, 20 seconds
per ordinary child, five seconds per ELF and 1 MiB capture per child. No limit
or tolerance changed. All 47 source hashes, 15 ELF hashes and 254 captures for
127 recorded child commands were checked afterward. Summed child time was
18,263 ms, which is test bookkeeping rather than performance/productivity proof.

| Retained identity | SHA-256 |
| --- | --- |
| Independent frozen plan | `7d6f28af54e688e0b5ac56bfaf8ffbea501a212099d5a3df3393b50c452b35d8` |
| Independent helper | `4a764fda4547dd7e4379ce9892ddb53f82daec40cd574d6f3e8449090601cc4d` |
| Actual result summary | `50621b399d5bfaffd8b117ba0278d22c0471df9847a10d7b865c859058b27bf6` |
| Built compiler executable | `dfe5ebd69c08cf3761a6d11cd034d3fe0ea2c3a9c8e0c752cdea72097b365713` |
| Reviewed Stage A contract | `acfc89c0320a0b364855c2fe4860a23593787f9762333c650ccfdc8e42b2d918` |
| Reviewed separate 150-case preparation | `485d653e9105506a3ecb417d7d59790241fd4e67cd5dc9fc93cb0661736ea937` |

The helper remains at ignored `target/typed-stage-a-independent.mjs`; original
plan, sources, captures, command arguments, ELF files and summary remain under
`target/typed-stage-a-independent-01` in this review worktree. There is no
Python oracle. This finite review establishes no general imported type system,
protocol/operator algebra, Rational/Decimal promotion, scale graph, affine
point/delta semantics, memory safety, sandbox, self-hosting, FC1 or HATCH result.
