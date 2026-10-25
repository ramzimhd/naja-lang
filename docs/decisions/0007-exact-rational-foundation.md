# ADR-007 — Explicit exact Rational foundation

Date: October 25, 2026. Status: engineering default for implementation/review.
Authority: continuation L04/L07/L08 and FC1-05. The native contract is frozen at
`23a6a59042c29502e180940bb38eab3c061a7925:tests/rationals/CONTRACT.md` before
native proof. This stage does not complete those broader requirements.

Expose explicit static `naja.numeric` imports using the existing header, canonical
binding, alias, exact arity and shared 128-binding machinery:

```text
from naja.numeric import rational, divide_exact, numerator, denominator
value = rational(10, 20) + divide_exact(1, 3)
print(numerator(value))
print(denominator(value))
```

The independently expected result is numerator 5 and denominator 6. No source division
operator policy is changed. Ordinary integer `/` remains explicitly unsupported;
do not silently replace Python integer division with a different numeric model.
Float/Decimal inference and exact decimal suffix construction remain later work.

`rational(n,d)` takes Int/Bool operands and constructs an immutable reduced exact
fraction, denominator positive, zero 0/1. `divide_exact(a,b)` accepts Rational/
Int/Bool and always returns Rational. Readers accept Rational only and return Int.
Both argument expressions execute left to right before both kinds are checked;
kind checks precede zero/work/normalization. Argument failures retain earlier
effects. Numeric zero division uses the existing 106 diagnostic. No machine-width
narrowing, binary-float round trip, external interpreter or cached result occurs.

Exact +,-,* and unary signs support Rational mixed with Int/Bool; operations
involving Rational return Rational. Numeric comparisons use exact crossproducts.
Truth depends on the numerator. Unrelated scalar/ordinary-instance equality is
false, inequality true; ordering and unsupported container comparisons fail 105.
Rational floor/modulo, length, printing, sequence access/stores, attributes and
mapping keys initially fail 105. Full display, coherent hashing and numeric/type
protocols remain required rather than being reclassified as optional objectives.

The native representation is private tag 10 with raw arbitrary-integer numerator
and denominator pointers. Explicit operations validate canonical input payloads
and coprimality, then run actual native Euclidean gcd/division and reduction.
Each starts one cumulative 1,000,000-unit abstract work budget. The frozen table
charges before scans and kernels, without per-component/gcd resets or hidden
pointer shortcuts. These units are conservative limb-work bounds, not cycles,
latency or a general process deadline. Result allocation has no unlisted debit;
arena limits still apply. All existing source/tree/node/stack/call/arena caps stay.

Generic checks/truth/container/object-field operations perform constant structural
header/span checks, without gcd, limb scans or scratch allocation. This preserves
existing descriptor-reusing stores and selected reads. Immutable constructors
establish canonical fractions; structural guards are not arbitrary modified-ELF
provenance/coprimality proofs. Explicit numeric readers may allocate validated
gcd scratch and their Int wrappers within the unchanged arena/work budgets.

Freeze independent BigInt fraction models, effects, boundary/work calculations,
corruption/changed-input controls and allocation-free generic-store tests before
native execution. Retain first failures, exact sources/commands/hashes and pending
`not_run` outcomes. General protocols/algebra, scale graphs, dimensions, affine
point/delta rules, imported types, self-hosting and FC1/HATCH acceptance remain open.
