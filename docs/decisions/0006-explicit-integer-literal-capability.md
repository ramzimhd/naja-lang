# ADR-006 — Explicit integer literal construction, first native slice

Date: October 25, 2026. Status: engineering default for implementation and review.
Authority: continuation L04/L07/L08 and FC1-05. This additive slice discharges no
full protocol, quantity, scale, affine or release requirement by itself.

The first suffix capability uses an explicit static header import:

```text
from naja.literal import integer_literal as numeric

@numeric
class Parcel:
    def __init__(self, value):
        self.value = value

print(123456789012345678901234567890Parcel.value)
```

The imported marker authorizes integer literal construction for that class. It
has no ambient spelling, arbitrary decorator callback or executable import.
Aliases and bindings use existing canonical static import rules. Only the bare
marker immediately before a top-level class is supported; blank/comment-only
lines are permitted. Stacked, called, attribute and function decorators diagnose.
Marker calls/first-class values are unsupported. Marker imports and conventional
construction are available in both dialects; suffix syntax is `.naja` 2026.1 only.

An eligible class must define `__init__` with receiver and exactly one positional
value parameter. It uses its ordinary native constructor, including effects,
initializer result validation and all resource/arity guards. A constructor alone
never opts a class in. No Gramme, Kilo, temperature or other application names
have special compiler meaning. Eligibility belongs to the resolved same-module
class identity. General imported/qualified types remain required later work.

The initial token is a valid decimal integer immediately followed by an XID type
identifier, with separate original numeric/suffix spans retained by the shared
frontend. Existing valid underscores and arbitrary integer precision are kept;
neither machine integers nor binary floats mediate construction. Whitespace
breaks suffix adjacency. Unknown/ineligible earlier classes diagnose at the
suffix; local/parameter value bindings shadow type names and diagnose there.
Identifiers such as `amountParcel`, strings and comments retain their meanings.

Preserve existing decimal/exponent/base/imaginary classification. This first slice
does not accept float/base suffixes or ambiguous e/E/j/J suffix starts; diagnose
with an explicit-constructor suggestion instead of splitting them opportunistically.
Ordinary exponent literals remain Float tokens even though this source backend
does not yet execute them. `.py` number suffix rejection remains unchanged.
Malformed numbers never become valid by separating a convenient suffix.
An underscore-leading type is ambiguous with numeric separators in this slice;
use its ordinary constructor rather than splitting a trailing/double underscore.

Postfix access follows normal expression precedence. Unary signs operate on the
constructed value: `-10Parcel` constructs positive ten then attempts object
negation (currently native type105); `Parcel(-10)` passes a negative integer by
ordinary construction. No effectful construction is folded or replayed.

All prior source/literal/node/tree/suite/alias/import/class/function/call/stack/
arena limits remain. Eligibility is bounded by the existing128 class entries;
markers consume ordinary import bindings. Constructor metadata is checked before
native output. No new unbounded evaluation or dependency is introduced.

Freeze independent renamed-class, effect, shadowing, Unicode-span, lexical,
boundary and actual changed-source controls before native execution. Preserve
failed observations and exact source/artifact hashes. Later stages must supply
general algebra/protocol dispatch, exact Rational/Decimal promotion, true division,
coherent equality/hashing, dimensions, scale graphs and affine point/delta rules.
Those requirements are preserved by this decision and remain open.
