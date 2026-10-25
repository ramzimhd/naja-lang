# ADR-008 — Exact decimal literal construction

Date: October 25, 2026. Status: frozen engineering contract before implementation
and native proof. Authority: continuation L04/L07/L08 and FC1-05. This additive
stage does not complete general numeric protocols or quantity/affine algebra.

## Explicit class capability

Add the static `naja.literal.exact_literal` marker alongside `integer_literal`.
The existing bare imported-marker/top-level-class rules apply: one initializer
value parameter after the receiver, ordinary canonical/as imports and shadowing,
earlier same-module class identity, no marker execution, stacking, calls,
attributes, nested/function decoration or automatic constructor participation.
Both declarations work in either dialect; suffix syntax remains `.naja` only.

An `integer_literal` class continues to receive an Int from an integer suffix.
An `exact_literal` class ALWAYS receives Rational, including integer suffixes:
`10Portion` means the ordinary construction `Portion(rational(10,1))` for that
capability. Ordinary `Portion(10)` still receives Int and can behave differently.
No application/type spelling, unit registry or quantity behavior is built in.
An integer-only capability refuses decimal-shaped suffix input semantically.

## Shared lexical boundary

Keep `TypedInteger` and `typed_integer_spans` unchanged. Add `TypedDecimal` and a
shared `typed_literal_spans` helper for either typed token. The original numeric
and suffix byte ranges are preserved; lexing does not resolve classes or expand
numbers. Ordinary suffix-free Integer/Float/Imaginary classes stay unchanged.

For this grammar, D is an ASCII digit followed by zero or more optionally
underscore-separated ASCII digits; EXP is `[eE][+-]?D`. Decimal-shaped cores are
`(D '.' D? | '.' D) EXP?` or `D EXP`, using the existing decimal validator.
Accept `.5Type`, `1.Type`, `1.e3Type` and `01.5Type`. Maximal numeric scanning
defines `1.Type` as numeric core `1.` followed by suffix `Type`; grouping or
separation expresses integer member access. The existing integer leading-zero
rule remains: nonzero leading-zero integers are invalid, while decimal-shaped
leading zeros retain their current validity.

A suffix is an adjacent raw XID identifier. Initial ASCII e/E/j/J and underscore
remain ambiguous and refuse with explicit-constructor advice, even after a
complete exponent. Base and imaginary suffixes remain unsupported. Never retry
a shorter prefix to make malformed exponents/separators valid. Whitespace breaks
adjacency. Raw Unicode spelling and canonical binding policy remain distinct.
The `.py` suffix refusal and inert strings/comments remain unchanged.

## Exact lowering and preallocation

Read the unsigned original numeric text without machine/float conversion. Remove
only separators and the decimal point from the mantissa to obtain coefficient
digits C, preserving all leading and trailing zero digits. Let F be the number
of fractional digits and E the signed exponent, or zero if absent. With S=E-F,
emit numerator `C` plus S zeros and denominator `1` when S>=0; otherwise emit
numerator `C` and denominator `1` plus -S zeros. Integer input uses F=E=0.
There is NO zero shortcut, leading/trailing-zero trimming, cancellation or gcd
at compile time. Ordinary native Rational normalization establishes the result.

Before building coefficient/zero strings, compute BOTH emitted Int string byte
lengths with checked arithmetic and reserve their sum against the remaining
1,048,576-byte aggregate literal budget. Synthetic denominator `1` is charged.
Zero and cancellable decimal inputs receive the same direct-pair charges. Long
leading-zero exponents must be interpreted correctly; a checked/saturating
exponent accumulator is bounded by the possible expansion and fractional length,
without truncating overflow to zero or rejecting merely by exponent text length.

Maintain a cumulative parser literal ledger matching native validation: actual
Int string bytes, decoded Text/Bytes bytes and every canonical static attribute/
method name validation occurrence's UTF-8 bytes, including repeated names.
The distinct-name cardinality limit is separate; do not reduce existing charges
to one per unique name. Reserve generated pairs atomically before
allocation, including inside skipped/unused code. Preserve the independent
backend aggregate check. Expansion excess diagnoses NJA101 at the original
NUMERIC span: `typed exact literal expansion exceeds the 1 MiB literal budget`.
No source, native arena, stack, work, class/import or other budget is raised.

Generated expressions are two Int leaves, Rational and ordinary Construct: all
four nodes and their real height count. Normalize the argument before class
allocation/initializer effects. Construction happens once; postfix access follows
ordinary precedence and unary signs apply AFTER construction. No effect is
folded, replayed or moved past a failure. Rational work/arena limits still apply;
for example direct `1.` with 432 fractional zeros reaches the frozen 49-limb
normalization case, while 441 zeros reaches the over-budget 50-limb case.

## Diagnostics, migration and proof

Unknown/ineligible types and value shadowing keep suffix-span diagnostics.
A decimal suffix on an integer-only eligible class diagnoses NJA101 at that
suffix: `decimal typed literal requires an explicitly eligible exact literal class`.
Marker initializer eligibility uses the class-name span and states the selected
capability's requirement for exactly one value parameter.

Accepting decimal tokens changes the old Stage A lexical rejection expectations
for decimal suffixes. Preserve the original proof and fixture IDs. First execute
focused unchanged-source before/after controls, then narrowly migrate only
affected lexical expectations; an integer-only class must still refuse through
semantic checking. Never describe that lexical oracle as unchanged.

Freeze independent Node BigInt decimal/fraction values and a separate literal
ledger, constructor effects, original spans, renamings/metamorphs, actual changed
source controls, exact/one-over expansion/aggregate boundaries, skipped code and
native work guards before execution. Keep first failures and pending `not_run`.
No Python/decimal host oracle or binary-float path is authorized. Full Decimal,
imported types, generic capabilities/algebra, coherent hashing, dimensions,
scale/affine point/delta relations, self-hosting and FC1/HATCH remain required.

Pre-execution correction: initial contract546f8e3 incorrectly described existing
name charges as unique. Read-only inspection found native validation charges
every occurrence. This amendment preserves that existing accounting before any
literal expansion/native proof; it does not weaken the backend guard. All
independent preparations remain `not_run` until the amended contract is consumed.
