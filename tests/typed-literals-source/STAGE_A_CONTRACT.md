# Stage A — Explicit integer literal source checks

Prepared October 25, 2026 from compiler source
`b2f4fe02e0e26fcb56643479f6958bde5bbf550f` and the integrator's approved
ADR-006 at `fabcb6ebe676cf08d11f2b1a1d096f6a0979ecb4`, path
`docs/decisions/0006-explicit-integer-literal-capability.md`.
This independent finite preparation has no compiler/native execution result.
Every outcome in `PREPARATION.json` is `not_run`.

The inherited [contract draft](CONTRACT_DRAFT.md), continuation L04/L07/L08,
FC1-05 and documents 03/05 remain authoritative. This first slice does not
complete those requirements, general decorator execution or a quantity system.

## Frozen source behavior

- `from naja.literal import integer_literal [as alias]` explicitly imports a
  static class capability. No ambient marker, arbitrary decorator callback,
  executable import, marker call or first-class marker value is authorized.
  Imports and marker-decorated ordinary constructors work in both dialects.
- A bare imported marker immediately precedes a top-level class in logical
  source order. Blank/comment-only physical lines are allowed. Stacked, called,
  attribute, function and nested decorators remain explicit unsupported cases.
- Eligibility requires `__init__(receiver, value)` with exactly one ordinary
  positional value argument. Conventional construction remains available;
  merely having a constructor never grants eligibility. Capability metadata
  is bounded by existing class entries and the shared 128 import bindings.
- In `.naja`, a valid decimal integer immediately adjacent to an eligible
  earlier same-module class name constructs the ordinary native object once.
  Valid digit underscores and arbitrary precision remain exact, without an
  intermediate machine integer or float. Whitespace breaks adjacency.
  Numeric and suffix spans remain original-source spans; identifier binding
  uses NFKC, without normalizing data or the numeric spelling.
- Local/parameter values win over class names and diagnose the suffix as a
  value-shadowed type. Existing refusal to introduce a new local binding with
  the same name as a static class is preserved; this slice does not broaden
  class rebinding. A reassigned parameter remains a shadowing value.
- `.py` suffixes keep their original lexical rejection, even with an imported
  marker. Plain `1e3` and related exponent forms remain Float tokens; ordinary
  bases remain Integer tokens; imaginary literals retain their existing
  unsupported classification. Source float/base execution is not added here.
- `.naja` ambiguous ASCII e/E/j/J suffix starts and float/base-plus-suffix
  spellings reject with F0006 and `use an explicit constructor`. Malformed
  numbers keep their existing lexical failure instead of convenient splitting.
  Underscore belongs to the numeric digit grammar first: `10_Type` and
  `10__Type` reject instead of treating the underscore as a suffix start.
  Identifiers such as `amountVessel`, strings and comments remain inert.
- Ordinary postfix/member/method/index rules apply. Unary `-10Type` and
  `+10Type` first construct positive ten, including effects, then encounter the
  existing object unary type error. `Type(-10)` supplies negative ten instead.
  No effectful construction is folded, copied or replayed. Aliases, parameters,
  identity and mutation use existing ordinary-object behavior.

Unknown/ineligible names use NJA101 with exactly
`typed literal suffix requires an earlier explicitly eligible class`.
Value-shadowed names use NJA101 with exactly
`typed literal type is shadowed by a value binding`.
Both diagnostics must cover the original suffix, checked through zero-based
UTF-16 JSON ranges. Frozen byte ranges are also retained for source review;
the current JSON CLI exposes UTF-16 ranges rather than byte offsets.
Absent/wrong-arity eligible initializers use NJA101 with exactly
`integer literal capability requires an initializer with exactly one value parameter`;
their declaration location is not fixed by this harness. Other decorator/API
failures freeze NJA101 and the stated category only. Absolute CLI paths and
implementation-chosen English messages outside these agreed cases are not
invented as expected diagnostic bytes.

Exact native stderr includes one final LF:

| Exit | Bytes before LF |
| --- | --- |
| 103 | `NJA203: native value arena exhausted` |
| 103 | `NJA203: native user-call depth limit exceeded` |
| 104 | `NJA204: assertion failed` |
| 105 | `NJA205: native value type mismatch` |
| 105 | `NJA205: native initializer must return None` |

## Independent cases and unchanged bounds

The harness generates sources deterministically. Node BigInt supplies exact
integer expectations beyond 64/128 bits; explicit constructor traces supply
order/once/failure oracles. Six unrelated type names, additional renamed
classes, NFKC bindings and Unicode data avoid an application-name registry.
Cases cover aliases, two eligible classes, ineligible/later/unknown classes,
ordinary constructors, both dialects, brace/depth/transparent suites, postfix
access, signs, short circuits, loops, shared mutation and original CRLF/Unicode
diagnostic positions. Regular exponent/base lexer checks remain separate from
unsupported source execution. Two genuinely changed source programs must
produce their independently predicted new bytes and fail their original output
oracles; removing the marker must make suffix construction reject.

The unchanged bounds are source 1 MiB, shared imports/classes/functions 128,
parse/IR nodes 10000, expression tree height 128, suites 64, literal budget
1 MiB, native arena 64 MiB, user-call depth 256 and source stack 2 MiB plus
4 KiB helper reserve. This harness exercises import/class/function, expression,
node/suite/source, arena and call boundaries. It does not claim a separate
literal-budget one-over proof hidden behind the smaller source-file limit or
exhaustive stack/OS-resource coverage. No tolerance or feature budget increases.

Execution budgets are frozen at five seconds per artifact, 20 seconds per
ordinary command, 45 seconds for the pinned offline compiler build, 240 seconds
overall and 8 MiB captured bytes per child. A signal, timeout, crash or unexpected
diagnostic fails. Ordinary OS rights and lower host stack availability remain
limits; there is no sandbox, IO deadline or performance/productivity claim.

## Preparation and later execution

```text
node --check scripts/test-typed-literals-language.mjs
node scripts/test-typed-literals-language.mjs --prepare-only
```

Preparation invokes only read-only Git identity and Node; it emits sources and
all-`not_run` identities under a fresh ignored `target/typed-literals-language-*`
directory. Freeze its `plan.json` as `PREPARATION.json` and commit before any
compiler/native run. Native execution requires a separately supplied exact
integrated source pin, frozen harness/contract/expectations and unchanged tracked
compiler sources with no untracked compiler files:

```text
node scripts/test-typed-literals-language.mjs --expect-source FULL_COMMIT_HASH
```

It builds Rust 1.97.1 offline, calls the real CLI for `check`/`build` or `lex`,
then runs emitted ELF directly on Linux x86-64 or through explicit local WSL
on Windows. Raw command streams, source/artifact hashes and first failure with
pending `not_run` cases are retained. No Python, provider, network, foreign
assembler/linker/runtime compiler or old harness edits are part of this test.
General imported types/protocols, rational/decimal promotion, relations,
scale/affine algebra and complete semantics remain required later work.
