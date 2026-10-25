# Exact decimal literal source preparation

Authority is amended frozen ADR-008 at
`3fa7e09ceb82365948dd2f9793cdbf44dc5dc12f`, path
`docs/decisions/0008-exact-decimal-literal-capability.md`. The dedicated branch
starts at `546f8e366bba182263afd5be1cb4068c15356ea7` and consumes the authorized
documentation correction before this preparation. The original ADR's unique-name
wording was corrected before any exact-literal compiler/native execution: existing
native validation charges every static member-name occurrence, duplicates included.
No backend charge or budget was weakened. This plan contains only `not_run` outcomes.

The exact marker is an explicit static import, aliasable and canonically bound,
following the existing bare-marker/top-level/earlier-class eligibility rules.
An eligible initializer has receiver and exactly one value parameter. Both marker
declarations and ordinary constructors work in both dialects; suffixes work only
in `.naja`. No arbitrary decorator, automatic participation or unit-name registry
is implied. Integer-only capability remains Int-only; exact capability receives
Rational even for an integer suffix. Ordinary construction does not coerce Int.

The frozen decimal grammar accepts `.5Type`, `1.Type`, `1.e3Type`, `01.5Type`,
valid digit-group underscores and signed decimal exponents. The scanner uses
maximal numeric input, with no recovery by trying a shorter malformed prefix.
Initial raw suffix ASCII e/E/j/J and underscore remain ambiguous even following
a complete exponent. Base/imaginary suffixes remain unsupported. Suffix-free
Integer/Float and unsupported imaginary classifications are preserved, as are
`.py` suffix refusals, strings, comments and ordinary identifiers.

The independent Node model parses the validated unsigned decimal text into raw
coefficient digits C, fractional digit count F and signed BigInt exponent E.
With S=E-F it models direct C followed by S zeros over 1 when S>=0, or C over
1 followed by -S zeros otherwise. It preserves coefficient leading/trailing zeros
for accounting. Only after the separate pair-size guard does its value model
construct BigInts and use Euclid to reduce the mathematical result to n/d,
including zero0/1. No Number, binary float, Decimal host library or compiler output
supplies numeric expectations. Number conversion is used solely for already
bounded string-repeat lengths. Huge expansion cases never allocate the modeled
million-digit numerator/denominator in the oracle; they are check-only fixtures.

The separate literal ledger models atomic pair reservation of BOTH emitted Int
string lengths, synthetic denominator 1 included. Zero, leading/trailing zeros
and cancellation receive no shortcut. It records prior/attempted totals and leaves
the total unchanged when a pair fails. Complete boundary inventories also include
ordinary Int spelling bytes, decoded UTF-8 Text/Bytes data, and every canonical
static attribute/method-name occurrence. Repeated field names are charged again;
the unique-name cardinality limit is a different unchanged guard. Names are NFKC
canonicalized before UTF-8 accounting. The ledger is a fixture inventory, not a
second general-purpose parser or a claim to parse arbitrary source programs.
Other cases retain raw-pair or fraction identities when applicable.

Default boundary class metadata is `__init__` (8 bytes) plus one `value` field
store (5 bytes). Consequently `1e1048561Parcel` and `1e-1048561Parcel` reserve
exactly 1,048,576 bytes including those names; exponent1048562 is one over.
Check-only boundary fixtures never build or execute the huge native inputs.
Other inventories cover decoded Unicode/byte escapes, ordinary integers,
duplicate canonical field spellings, two cumulative pairs, source-visible zeros,
long leading-zero exponents and statically skipped/unused code. Huge positive,
negative and zero exponents must refuse without overflow or truncation.

NJA101 expansion failure is exactly
`typed exact literal expansion exceeds the 1 MiB literal budget` at the original
numeric span. Unknown/ineligible classes retain
`typed literal suffix requires an earlier explicitly eligible class`; shadowing
retains `typed literal type is shadowed by a value binding`, at the original
suffix. Decimal-shaped suffixes on integer-only classes use
`decimal typed literal requires an explicitly eligible exact literal class`, at
the suffix. Invalid exact initializers use
`exact literal capability requires an initializer with exactly one value parameter`
at the class name. Diagnostic ranges retain original UTF-8 bytes for review and
zero-based UTF-16 positions for CLI JSON checks. Other refusals freeze their
agreed code/category, without inventing implementation-specific prose.

Native exact stderr includes a final LF:

| Exit | Bytes before LF |
| --- | --- |
| 103 | `NJA203: native rational work limit exceeded` |
| 103 | `NJA203: native value arena exhausted` |
| 103 | `NJA203: native user-call depth limit exceeded` |
| 104 | `NJA204: assertion failed` |
| 105 | `NJA205: native value type mismatch` |
| 105 | `NJA205: native initializer must return None` |

The constructor work oracle independently implements the frozen Rational table
from `23a6a59042c29502e180940bb38eab3c061a7925:tests/rationals/CONTRACT.md`.
Each Int input costs descriptor1 plus raw1+limbs. Each Euclid iteration costs1,
then divrem: n0 costs1, m1 costs1+8(n+2), otherwise
1+132n(m+1)+8(m+1). Final exact N/g and D/g are always separately charged,
even g1. No allocation debit is invented. The positive equal-power inputs here
need no sign clone. Direct `1.` with432 zeros takes971506 units and succeeds;
441 zeros takes1011132 and fails the cumulative1,000,000-unit cap BEFORE object
allocation/initializer effects. Their complete traces are frozen in the plan.

Cases cover renamed ASCII/Unicode classes, exact values beyond128 bits, Ratio
kind through Int readers, effects/once/order, failure ordering, object identity,
mutation, postfix syntax, braces/depth/named suites, short circuits and unary
after construction. Ratio display remains unsupported105; observers print its
Int numerator/denominator. Three actually changed numeric/constructor programs
must match new bytes AND fail their original output oracles; removing the marker
must reject. Equal-value scale, rename, CRLF and comment metamorphs retain values.

Unchanged caps: source/literals1MiB, IR nodes10000, expression height128,
suites64, imports/classes/functions128, native arena64MiB, calls256, source stack
2MiB plus4KiB helper reserve. This plan includes generated-node, height, source,
suite, import, work, arena and call guard cases, without claiming exhaustive OS
resource or every pre-existing cap coverage. Time budgets are5s per artifact,
20s per ordinary command,45s per offline build,240s overall and8MiB captured bytes
per child. Signal, timeout, crash or mismatched bytes fails. Lower OS resources
remain a limitation; this is no sandbox, latency, performance or productivity proof.

Preparation executes only Node and read-only Git, writes fresh ignored artifacts
with create-new semantics, then freezes `plan.json` as `PREPARATION.json` before
any compiler/native execution. Execution requires a separately authorized full
integrated source SHA, frozen harness/contract/plan identities and unchanged
tracked compiler files without untracked compiler sources. It builds offline
with Rust1.97.1, uses real CLI check/build/lex, and runs emitted ELF directly on
Linux x86-64 or through explicit local WSL. First failure, pending `not_run`, raw
streams and hashes are retained. No old harness or founder requirement is edited.
General Decimal/protocols, imports/types, quantities, hashing, scale/affine algebra,
self-hosting, FC1 and HATCH remain open.
