# Exact Rational source preparation

This is a frozen source-harness preparation, not an execution result. All 220
source cases are `not_run`. No compiler build, source `check`/`build`, or native
ELF execution occurred while preparing this directory. The integrator must
provide an exact integrated source commit before the native run.

The source base is `936865c7ef4dd566b4e4523089b1e6bad09534fe`. The exact frozen
backend contract is
`23a6a59042c29502e180940bb38eab3c061a7925:tests/rationals/CONTRACT.md`, whose bytes
hash to `980e4663145eb42286840a4e64f0366e4a75b45786847dbb89b183248c7269d7`.
The contract and author confirmations preceded any native Rational proof.

`PREPARATION.json` freezes the harness, ten static source/configuration/input
files, all generated source and expected output identities, the cumulative-work
debit traces, budgets, and every `not_run` outcome. A native run first verifies
these identities and requires an exact `--expect-source` argument. This suite
does not modify the older scalar, typed-literal, mapping or other source suites.

## Source and independent oracles

The explicit module-header APIs are `rational`, `divide_exact`, `numerator` and
`denominator` from `naja.numeric`. This slice observes Rational values through
the readers and comparisons. It does not enable ordinary source `/` or promise
Rational printing, floor division, modulo, length, indexing, attributes, mapping
keys, full hashing, Decimal, or general numeric promotion/scale/affine protocols.

Node BigInt supplies a reduced-fraction model with positive denominators and
canonical zero. It generates 80 deterministic small arithmetic operations in
each dialect, explicit integers beyond 128 bits with large common factors,
Bool/Int promotion cases and 384 exact mixed numeric relations. Expected
arithmetic uses integer gcd and cross multiplication, without binary floating
arithmetic or an interpreter oracle. Static cases independently specify signs,
zero, truth, unary operations, integral Rational results, immutable aliases,
function returns, class fields, tuple/list/dictionary selected values and
ordinary Int-only behavior.

Effects cases distinguish argument evaluation from type, zero and work guards:
both arguments finish once from left to right before either kind is checked;
a failing child stops later arguments; both kinds precede zero shortcuts.
Chains retain the original middle Rational and skip later failures when false.
Short-circuit cases skip an otherwise over-budget constructor. Wrong kinds,
unrelated scalar/object equality, unsupported container comparison, restricted
Rational operations and Ratio mapping-key rejection have distinct frozen
expectations. Raw keyword handling and NFKC bindings are exercised through
Unicode import aliases, members and project operator aliases. User data remains
unchanged. Shared `.naja` brace/named/depth suites, `.py` isolation, CRLF and inert
comment transformations use the same source parser. The existing Stage A
class-suffix path constructs an ordinary class whose initializer calls
`rational`; this introduces no new Rational literal grammar.

The private file case reads exactly two bytes, `[135,137]`, as numerator and
denominator offsets, producing `7/9`. The actual-input control changes them to
`[136,137]`, producing `8/9`; the original output verifier must reject it.
Another control changes `rational(6,8)` to `rational(8,6)` in the actual source.
Both controls must execute normally before the same strict stdout verifier
detects the changed result. The runtime file is created only under an ignored
private fixture directory; compiler artifacts/captures remain outside that
inventory. Its name, inventory and bytes are checked before and after source
checking, building and native execution. Linux runtime paths are separate from
the Windows compiler source paths.

## Work and allocation boundaries

The independent work model follows the frozen abstract debit table, with one
cumulative `W=1,000,000` budget per explicit Rational operation. It records every
descriptor/raw scan, clone, Euclid iteration, divrem and multiply debit as exact
integers. The seed author independently confirmed the following totals
algebraically before execution:

| Case | Required work if completed | Expected result |
| --- | ---: | --- |
| `rational(0,1)` model checkpoint | 5 | `0/1` |
| `rational(1,1)` model checkpoint | 82 | `1/1` |
| Reader preflight of `1/1` | 31 | Reader accepts Ratio |
| `rational(N,N)`, `N=10^432`, 49 limbs | 971506 | `1/1` |
| `rational(N,N)`, `N=10^441`, 50 limbs | 1011132 | Work failure 103 |
| Both negative 49-limb operands | 971704 | `1/1` |
| `rational(0,-10^891)` | 306 | `0/1` |
| 50-limb reciprocal product, no cross-cancellation | 1019822 | Work failure 103 |
| Equal 50-limb Ratio exact division, no shortcut/reset | 1012680 | Work failure 103 |

`required_units_if_completed` is an independent algebraic total after all
listed steps, even when execution must stop at the first excessive debit.
`first_excess_index` records that first debit. Native counters are not observable
from this source API, and no counter instrumentation is claimed here. The
constructor boundary also prints both child effects before its work refusal.
Comparison tests distinguish crossproducts from result normalization.

Generic Ratio guards, truth, stores and selected reads must remain constant
header/span checks without allocation, gcd or limb scans. A near-arena case
performs 2,000 groups of list/instance/dictionary stores and selected reads using
one shared Ratio; it expects success. Its separate control performs 2,000
explicit Rational constructions and expects the unchanged arena failure. The
large payloads use ordinary concatenation, never unsupported sequence
repetition. Both sources stay below the unchanged source/literal limits.

Further source cases retain active-call success at 256 and failure at 257,
expression height success at 128 and rejection at 129, shared import success at
128 and rejection at 129, exact arity/import/static binding refusals and an
original Unicode argument position. Existing 10,000-node, 64-suite, 128
function/local/parameter, 1 MiB source/aggregate-literal, 2 MiB source-stack,
4 KiB helper reserve and 64 MiB arena limits are not increased. This finite suite
does not independently prove every unchanged global bound. Malformed native
descriptor/span/limb and injected work-counter tests belong to the separate
backend proof because valid source cannot fabricate those descriptors.

## Frozen expected outcomes and execution procedure

These counts are expectations, not passes:

| Category | Cases |
| --- | ---: |
| Native success, exit 0 | 47 |
| Native type refusal, exit 105 | 127 |
| Native zero-divisor refusal, exit 106 | 11 |
| Native work/call/arena refusal, exit 103 | 6 |
| Compile rejection through both `check` and `build` | 27 |
| Actual source/file controls rejected by stdout oracle | 2 |
| Total `not_run` | 220 |

Preparation commands actually completed with exit 0:

```text
node --check scripts/test-rationals-language.mjs
node scripts/test-rationals-language.mjs --prepare-only
```

The final local preparation artifacts are
`target/rationals-language-6lEQjZ/{plan,summary}.json`, with identities retained
in `PREPARATION.json`. Earlier Node-only preparation artifacts are retained
locally too. Native execution later requires this command with the exact source
SHA supplied by the integrator:

```text
node scripts/test-rationals-language.mjs --expect-source <40-hex-integrated-source-commit>
```

The native path builds with pinned `cargo +1.97.1 build --workspace --locked
--offline`, then checks/builds real source and executes actual Linux x86-64 ELF
through local WSL on Windows or directly on Linux. Native processes have a
5-second timeout; compiler CLI calls 20 seconds; compiler build 45 seconds;
the complete suite 240 seconds; each child capture 8 MiB. These budgets are
fixed before execution. The first failure and all pending `not_run` cases are
retained; expectations or tolerances must not change to make a failed run pass.
No Python, foreign interpreter/compiler oracle, service, credentials or network
dependency is used. No filesystem sandbox or general OS I/O deadline is claimed.

The inherited untracked `bootstrap/frontend/Cargo.lock` is preserved and is not
part of this task. Preparation is not implementation verification, complete
Python compatibility, self-hosting, FC1, a release gate or HATCH acceptance.

## First run retained; one authorized preparation correction

The unchanged first run at
`5ee64ec1fb02968964a81b0f07c086ae0578c684` stopped at 33 passed, 1 failed and
186 `not_run`. Its source, original identities, commands, outputs and failure
are preserved in `FIRST_RUN.md`, byte-identical `FIRST_RUN_FAILURE.json` and
`FIRST_RUN_ARTIFACTS.json`, committed separately as
`17522596d6fbd551b8edf88b3eafa708cf9c7ec4` before any repair.

The authored `discarded-ratio-and-return` case defined `value()` and then emitted
`value = value()`, correctly refused by the existing static function-name rule.
The integrator authorized only renaming that fixture function to `make_ratio`
and updating its call. The observation assignment remains `value = ...`; the
discarded construction, returned Ratio, expected bytes, limits and all other
219 source identities remain unchanged. No compiler code or acceptance rule
changed.

The corrected case has 207 bytes and SHA-256
`5f088c3398a7245c1dce88215070ea08741d7a77d793002374d23a3a6e1d902b`.
The corrected harness SHA-256 is
`27ba96c217d30e2a285cae6cd5c01818767868f37783e96a32ae8244a1931e5f`.
`PREPARATION.json` retains the original case and preparation/harness identities,
all 220 failed-run states through the original failure record, and the exact
single-case comparison. Node-only preparation rechecked all ten fixture hashes,
all costs and all case identities under `target/rationals-language-jtpiid`.
All corrected 220 native outcomes are `not_run`; no second native run is allowed
until the integrator supplies a new exact integrated source pin.
