# Typed numerical literals and relations — staged contract draft

Drafted October 25, 2026 against compiler source
`b0e54cb2db1a2aea20b6056c05f92ea5e6b62560`. This is preparatory design for
continuation L04/L07/L08 and FC1-05. Every native outcome below is `not_run`.
No executable fixture, protocol spelling, benchmark result or acceptance status
is established here. The integrator must resolve the decisions below before
freezing executable cases and budgets. Full founder requirements remain open.

Authority: [language contracts](../../docs/continuation/02_LANGUAGE_CONTRACTS.md),
[acceptance](../../docs/continuation/04_ACCEPTANCE.md), original documents
[03](../../docs/03_LANGUAGE_AND_COMPATIBILITY.md),
[04](../../docs/04_BLOCKS_AND_ALIASES.md),
[05](../../docs/05_ARCHITECTURE.md), and ADRs 003–005. The founder's Gramme/Kilo
and affine class declarations are normative examples; they are not a registry
of compiler-recognized unit names. This draft adds no alternative source syntax.

## Shared semantic obligations

- `.naja` 2026.1 suffixes resolve an in-scope eligible type through an explicit
  literal-construction capability. Merely having a constructor or similarly
  named method does not opt a type in. Ordinary constructors remain available.
  Unknown, ambiguous, shadowed or ineligible names diagnose at original spans;
  `amountGramme` remains an identifier. `.py` keeps its separate pinned grammar.
- Extend the shared lossless lexer/CST and resolver. Retain exact numeric text,
  suffix spelling and both source ranges. Identifier NFKC applies to bindings,
  never numeric/user text. Freeze decimal/exponent/base/underscore/reserved
  suffix precedence before implementation. Preserve ordinary `1e3`, base forms,
  unary precedence and any separately supported complex suffix; reject an
  ambiguous spelling with a constructor suggestion. Do not split malformed
  numbers opportunistically to make a suffix resolve.
- The literal payload must preserve arbitrary precision and exact decimal
  construction: retain validated digits/base/exponent, not an intermediate
  machine integer or binary float. Decimal-looking text destined for Rational
  or Decimal must avoid a binary-float round trip. Representation may canonicalize
  a value while preserving the original spelling for diagnostics/protocol needs.
- Construction follows the resolved protocol's order and effects exactly once.
  Do not replace an effectful constructor with metadata or a constant. Folding
  requires proven applicable purity, validity and failure semantics; the first
  slice may simply retain native calls. Unary minus is an operation on the
  constructed expression unless the reviewed protocol explicitly specifies
  otherwise; it must not silently change constructor observations.
- Separate nominal family/dimension identity, representation unit, scalar
  storage/promotion and algebra. Conversion does not imply inheritance or
  substitutability. General operator dispatch must select an authorized algebra,
  preserve operand order/effects, and diagnose unsupported pairs rather than
  infer laws from method names or fall through to object identity arithmetic.
- Compose exact scale factors. Addition/subtraction in the quantity family use
  the left representation and promote storage as necessary: `20Kilo + 10Gramme`
  represents exactly `2001/100 Kilo`, displayed as `20.01 Kilo` under the chosen
  exact display policy. `10Gramme + 20Kilo` is `20010 Gramme`; the quotient
  `2Kilo / 500Gramme` is dimensionless `4`. These are semantic expectations, all
  currently `not_run`. Scalar multiplication, quantity products and quotients
  have separately declared result rules; a scale relation grants no other law.
- An affine relation explicitly maps source coordinates to target coordinates.
  Require distinct source points and an invertible nonzero scale. For the
  founder's Fahrenheit-to-Celsius pairs, the exact map is `5*x/9 - 160/9`;
  its inverse is `9*x/5 + 32`. Deltas use scale only. Point minus point produces
  a delta, point plus delta produces a point, and ordinary point plus point
  rejects. Conversions preserve point/delta kind and check destination bounds
  and invariants after conversion. Delta representation/result policy must be
  frozen separately from the coordinate formula.
- Reject incompatible dimensions, contradictory cycles and ambiguous paths.
  Use stable resolved family/type identities, including module ownership;
  coincident short names do not merge types. Cross-unit equal values must hash
  compatibly when hashable. Until coherent value equality/hash exists, refuse
  quantity hashing explicitly; ordinary instance-identity hashing is unsuitable.

## Stages and actual dependencies

| Stage | Smallest useful executable proof | Dependencies and scope |
| --- | --- | --- |
| A: literal construction | An arbitrary renamed, explicitly eligible user class receives a multi-limb integer through suffix construction; field observations and constructor markers match its ordinary constructor. Include two unrelated eligible classes and an ineligible class. | Shared suffix tokens/spans, reviewed opt-in metadata and static type resolution. Existing native classes/fields/calls and arbitrary integers can supply the execution core. No scale arithmetic or FC1-05 completion claim. |
| B: exact scalar algebra | Independent runtime inputs exercise native exact fractions, promotion, division and checked construction; decimal/exponent literal text reaches exact construction unchanged. | A reusable native Rational/Decimal policy, normalized nonzero denominators, bounded arithmetic/gcd/conversion work and general protocol/operator dispatch. Host floats or a constant-only evaluator cannot supply this proof. |
| C: scale relations | Developer-defined families and exact relation chains derive arithmetic and comparisons, including renamed examples and nonintegral scales. | B plus coherent relation declarations/resolution, family identities, generic algebra/result rules, cycle/path validation and display/equality/hash policy. Library code owns quantity behavior; the compiler lowers resolved general operations. |
| D: affine relations | Runtime point/delta operations and forward/inverse conversions honor scale, offset, dimensions and checked bounds. | C plus an explicit affine relation kind and point/delta representation. Preserve constructor/conversion effects; no guessed inversion of arbitrary functions. |

At the inspected source, the shared lexer explicitly rejects numeric suffixes;
the executable backend has exact integers but no Rational/Decimal/float values
or true-division result. Classes have bounded fields, native methods and static
constructors, but no general protocols/generics, algebra overloads, inheritance
or class-keyword relation declarations. Imports expose a fixed set of function
APIs, not general imported/qualified type identities. These are dependencies,
not reasons to implement a second parser or hardcode units. Stage A may begin
with explicit same-module static eligibility, provided it is a reviewed part
of the general capability contract. General imports and the founder's relation
declaration surface remain required; a temporary restriction cannot close them.

## Cases to freeze before each stage executes

All groups are `not_run`. Freeze source identities, independent mathematical
expectations, exact diagnostics, changed-source controls and budgets before
execution; do not adopt implementation output as the oracle.

- Lexical/binding: ordinary numbers versus suffixes, exponents/base digits,
  underscore/sign boundaries, Unicode/NFKC collisions, unknown and shadowed
  types, imported/qualified constructors, comments/strings, mixed suites and
  unchanged `.py` rejection. Resolve ambiguous cases before writing fixtures.
- Native semantics: integers beyond 64/128 bits, exact decimal cancellation,
  nonintegral promotion, runtime operand effects, constructor order/failure,
  renamed families, inverse/composed scales, incompatible dimensions, zero
  denominators, contradictory cycles and multiple candidate paths.
- Affine: both founder endpoints, an independently chosen interior coordinate,
  forward/inverse round trips, point subtraction, point-plus-delta, delta scale
  without offset, point-plus-point refusal and post-conversion bound failures.
- Trust/limits: no suffix-name switch or special Gramme/temperature instruction;
  altered relation coefficients change actual native results. Preserve existing
  source/tree/arena/stack limits. Add frozen finite caps for coefficient digits,
  exponent expansion, relation graph size/path work and rational arithmetic work;
  diagnose resource failure before unsafe allocation, truncation or overflow.
  No raised tolerances, Python oracle or hidden compile-time execution service.

## Decisions for the integrator

1. Approve the literal capability's declaration/constructor interface, ownership
   and coherence rules, then freeze suffix token precedence and unary behavior.
2. Choose the first exact scalar/result policy (including `/`, Decimal versus
   Rational, display and nonterminating decimals), and the opt-in algebra API.
3. Freeze relation declaration semantics, graph ambiguity rules, dimensional
   result identities and affine point/delta representation and operator results.
4. Assign imported type resolution and explicit unsupported boundaries; freeze
   new work budgets without changing existing caps. Require exact-source native
   evidence at each stage. None alone discharges full L04/L07/L08 or FC1-05.
