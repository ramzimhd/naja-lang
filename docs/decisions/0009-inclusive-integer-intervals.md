# ADR-009 — Inclusive integer interval checks

Date: October 31, 2026. Status: frozen engineering contract before implementation
and native proof. Authority: continuation L09 and FC1-06. Named refinement types,
Decimal/Float intervals, typed fields/parameters, patterns and general invariants
at FFI/deserialization boundaries remain required work beyond this first slice.

## One native check and two source entry points

Add dynamic IR `IntegerInterval(value, lower, upper)`, with three boxed children.
It returns the original immutable Int/Bool descriptor after validation, without
wrapping, cloning, narrowing or allocating. Bool follows the existing integer
annotation policy: exact false/true are numeric zero/one, preserving the Bool
descriptor on success. Rational, even integral, and all other kinds fail 105.

The explicit static API is `from naja.numeric import checked_int`, with exactly
three positional arguments. It is available in both dialects under the existing
canonical/as import, static binding, header and shared128-import rules. It does
not parse text or convert to a machine integer. The result is an ordinary value;
no persistent refinement is promised merely by calling this function.

In ordinary-value `.naja`, support local annotations `age: (1 to 40) = value`.
Bounds are signed decimal integer literal tokens with optional single leading
ASCII +/- and the existing digit/underscore/leading-zero rules. `to` is a raw
ASCII contextual keyword only inside that annotation, not a global reserved
binding and not a canonicalized lookalike or a new project alias target.
Decimal/base/exponent/Bool/typed-suffix endpoints and general bound expressions
refuse: `integer interval endpoints require signed decimal integer literals`.
`.py` interval syntax refuses; its existing int annotations remain informational.
Existing `.naja` int annotation behavior remains unchanged.

Retain the declared bounds in the annotated slot's parser metadata and insert
the same native check on EVERY assignment to it, including branch/loop/unused
code. Each function has its own annotation table; save/restore the outer table.
Arithmetic and copies into unannotated slots do not inherit the refinement.
Assigning an arithmetic result back to an annotated slot rechecks it. Ints are
immutable; this stage adds no refined mutable fields, hidden wrapper type,
runtime schema registry or changed value equality/hash.

## Static proof and diagnostics

The shared source proof recognizes decimal Int and Bool literals, parentheses
and recursive unary +/- as integral constants; normalize sign/leading zero only
for comparison, without a machine-width conversion. It does not execute calls,
read files, fold general arithmetic or infer all expression types. Plain Text,
Bytes and None literals, including their unary-sign forms, are known wrong kinds;
other unproven expressions retain the native checks. General inference and
constant evaluation remain open. Never remove a runtime check after a proof.

For `checked_int`, inspect all three arguments for these known wrong scalar
kinds first, in argument order. Such an invalid program diagnoses NJA101
`integer interval requires Int or Bool` at the offending argument expression.
If both bounds are proven integral and lower>upper, diagnose NJA101
`integer interval lower bound exceeds upper bound` from the start of the lower
argument to the end of the upper argument, even when the value is dynamic.
If both bounds are proven valid and the value is also proven integral, refuse
an outside value with NJA101 `constant is outside the inclusive integer interval`
at the value expression. A single known bound does not prove API value-range
failure in this stage. Unproven siblings remain unexecuted in a statically invalid
program; this is compile-time refusal, not a runtime-effect rollback claim.

Annotation bounds are always proven literal bounds. An empty annotation uses
the same empty-bounds diagnostic, spanning its opening to closing parenthesis.
A proven wrong scalar RHS or outside integral RHS uses the same type/range
message at the RHS expression. Every later assignment shares these proof rules.
RHS spans exclude the terminating logical newline. Canonical names and Unicode
data retain their existing independent policies and original UTF-8/UTF-16 maps.

## Native evaluation, guards and exact work

Evaluate value, lower, upper exactly once, left to right, before any operation
guard. A child error stops later children and retains earlier effects. First
guard ALL three aligned/readable 24-byte descriptor spans, then ALL three kind
tags (Int0/Bool3), before raw payload checks or empty/range comparisons.

For each input in value/lower/upper order, debit descriptor1, require its unused
descriptor word at offset16 to be zero, then validate its raw integer header and
full payload span. Raw pointers are eight-byte aligned/readable, count is at
most `(64 MiB-16)/4`, sign0 iff count0, otherwise sign+/-1 and nonempty. Debit
raw scan `1+n` before reading n limbs. Every limb is <1e9 and a nonempty highest
limb is nonzero. Bool payload must be exactly canonical zero or positive one.
These stronger checks are scoped to this new primitive; old generic/Rational
descriptor rules and all existing limits stay unchanged. This is bounded
structural/canonical-payload checking, not arbitrary pointer provenance or a
hostile modified-binary sandbox.

Each operation has ONE cumulative W=1,000,000 abstract limb-work units. After
all three full scans, compare lower/upper, then value/lower, then value/upper.
Debit `1+2*max(n,m)` BEFORE EACH raw signed compare, including equal pointers,
different signs, empty counts or obvious outcomes. Stop after the first failure:
empty, below lower, above upper. Both bounds are inclusive. There is no pointer,
zero, bounds-equality, early-range or per-operand/compare budget reset shortcut.
Raw comparisons allocate nothing and share the existing exact integer kernel.

A successful check costs `9+nv+nl+nu+2*(max(nl,nu)+max(nv,nl)+max(nv,nu))`.
All-zero costs9; three one-limb inputs cost18. One shared111110-limb integer
costs999999 and succeeds; shared111111 limbs costs1000008 and fails work.
These are abstract conservative units, not cycles or a general process deadline.
Work failure precedes the charged scan/compare, after its constant span/header
guards. Kind failures precede every raw payload scan, regardless of later zeros.

Use a fixed helper frame (planned128 bytes) with saved pointers/work across
volatile kernels. Interval WORK uses frame offset-16 to preserve the existing
Rational offset-8 mutant signature. Existing2MiB user stack,4096-byte helper
reserve,256 active calls,64MiB arena,128 expression height,10000 nodes,64 suites,
128 locals/functions/parameters/classes and1MiB source/aggregate literal budgets
are unchanged. A successful check must work with exactly zero arena bytes free.

Exact stderr is one final LF:

| Exit | Bytes before LF |
| --- | --- |
| 103 | `NJA203: invalid native integer interval span` |
| 103 | `NJA203: native integer interval work limit exceeded` |
| 105 | `NJA205: native value type mismatch` |
| 112 | `NJA212: integer interval check failed` |
| 113 | `NJA213: empty integer interval` |

## Lowering, limits and evidence

Every annotation assignment injects two fresh Integer leaves and one interval
node around its existing RHS; count all three extra nodes and actual height.
Reserve BOTH stored endpoint string byte lengths atomically against the existing
parser literal ledger BEFORE cloning them, on every assignment, not merely at
declaration. Preserve original endpoint digits after removing separators and
one unary plus; negative endpoints include their minus. Static comparison may
normalize a view, but cannot trim stored payload bytes or silently avoid fees.
Do not charge declaration-only endpoint metadata again as extra IR literals.
All existing per-occurrence member-name and decoded literal fees remain.

Explicit API arguments already have their normal node/literal accounting; add
only the wrapper node. The existing backend validator remains an independent
backstop and traverses unused code. No compiler/Rust API receives unchecked
literal growth, unbounded exponent work or a hidden interpreter.

Freeze finite independent Node BigInt values, static diagnostics/spans, effects,
scope/reassignment/copy behavior, aggregate/node/height/call boundaries, exact
work debits, full-arena no-allocation checks and actual changed-source/binary
mutants before their native execution. Preserve first failures, exact sources,
commands, hashes, targets, versions and pending `not_run`. No Python/CPython
oracle, foreign compiler, canned result, disabled old selector or raised budget
is authorized. This stage promotes no complete L09/FC1/HATCH requirement or gate.
