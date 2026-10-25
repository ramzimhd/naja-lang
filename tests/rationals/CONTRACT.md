# Bounded exact Rational native foundation

Frozen before native execution from source
`936865c7ef4dd566b4e4523089b1e6bad09534fe`, October 25, 2026. Authority:
documents 03/05, continuation L04/L07/L08 and FC1-05. This is a backend-only
foundation, without quantity names, source `/` changes, Decimal, display,
algebra protocols, scale/affine relations, complete hashing or acceptance claims.

## Public IR and semantics

Add dynamic expressions `Rational(numerator, denominator)`,
`DivideExact(left, right)`, `Numerator(value)`, `Denominator(value)`, with boxed
child expressions. Constructor operands accept Int/Bool only; exact division
accepts Rational/Int/Bool pairs and always returns Rational. Readers accept
Rational only and return Int. Both operands evaluate once left to right before
the operation validates anything. Check both operand kind tags before payload
scans, denominator-zero checks or normalization work. Child failures retain
their earlier effects and status; e.g. a failing child division precedes an
outer wrong-kind refusal. Bool numerically means exact zero/one.

Private tag 10 is an immutable 24-byte descriptor containing raw integer
numerator/denominator pointers at offsets 8/16. Denominator is positive/nonzero,
gcd is one, and zero is exactly 0/1. Raw integers retain sign/count/base-1e9
limbs without machine narrowing or binary floating conversion. Shared inputs
are never mutated; results and Euclidean scratch use the existing bounded arena.

Rational with Int/Bool/Rational supports exact +, -, *, unary +/- and numeric
comparison. Existing Int/Bool-only operations keep their old results/semantics.
Arithmetic involving a Rational returns Rational, including integral results.
Truth is numerator != 0. Unary + may reuse a validated immutable Rational;
no public identity promise is introduced. Equality with unrelated Text/Bytes/
None/ordinary instances is false and inequality true; ordered comparison fails.
Tuple/List/Dict/Set comparisons remain explicit unsupported type failures.
Rational floor division, modulo, length, printing, sequence access/mutation,
attributes and arithmetic with nonnumeric values fail105. Rational mapping
keys fail105 even when numeric-equal to an integer; coherent full hashing is
still required work. Rational values may be stored, aliased, returned and read.

## Generic structural checks versus explicit numeric checks

Generic runtime check/truth/container or object-field validation allocates
nothing, scans no limb sequence and runs no gcd. It guards readable/aligned
descriptor, raw header and full payload spans; bounded counts; zero sign iff
zero count; nonzero signs +/-1; positive/nonempty denominator; and zero 0/1.
The zero-denominator-one check reads its single guarded limb. Truth then reads
the guarded numerator sign. Selected collection values are not recursively
traversed. Unsupported operations and rejected mapping keys do not normalize.
These guards are not a pointer-provenance, coprimality or modified-ELF proof.

Explicit constructor, numeric arithmetic/comparison, unary and reader operations
perform canonical full integer scans and canonical Rational/coprimality checks.
Each input descriptor costs 1, then each raw integer costs `1+n` before scanning
its n limbs. Check full readable span/count/sign first, every limb <1e9 and
nonzero highest limb; Bool is canonical zero or positive one. A Rational input
validates numerator then denominator, positive denominator, zero 0/1, and for
nonzero numerator verifies gcd(abs(numerator), denominator)==1. This gcd and any
absolute-value clone share the operation work budget. Unrelated scalar/object
equality uses the constant structural guard; container comparisons fail105.

## Fixed cumulative work policy

Every explicit Rational operation starts one `W=1,000,000` counter. No reset for
the second operand, intermediate, gcd iteration or final division. Debit before
each listed scan/kernel/allocation for that kernel. Units are abstract,
conservative payload-limb work bounds, not CPU cycles or a process deadline.
For canonical limb counts n,m:

| Primitive | Debit |
| --- | --- |
| Descriptor preflight | 1 |
| Raw canonical integer/Bool scan | 1+n |
| Clone/negate | 1+2n |
| Raw signed compare | 1+2*max(n,m) |
| Raw add/subtract | 1+6*max(n,m) |
| Raw multiply | 1+4nm+3(n+m) |
| Raw divrem, n=0 | 1 |
| Raw divrem, n>0 and m=1 | 1+8(n+2) |
| Raw divrem, n>0 and m>=2 | 1+132n(m+1)+8(m+1) |
| Each nonzero-divisor Euclid iteration, before divrem | 1 additional |

Raw counts are bounded by `(64 MiB-16)/4` before arithmetic or payload reads;
cost calculations remain below signed64 range at these limits and are guarded
before debit. Existing raw division limb-product limits remain in force.
General divrem performs at most30 candidate trials per quotient digit. Its
conservative payload bound `n*(129m+98)+3n+6m+10` is below the charged formula.

Normalization receives signed N,D after both kind/raw preflights. Zero D fails
106. If D<0, charged native negate clones both N and D. If N=0, return canonical
0/1 without gcd/final divisions. Otherwise charge an absolute-N clone only if
N<0, then run iterative Euclid `(a,b)=(abs(N),D)` while b!=0, charging the step
and raw divrem each iteration. Save gcd g. Always perform separately charged
exact divisions N/g and D/g, verify both remainders zero, then allocate the
Rational descriptor; there is no g==1 reduction shortcut.

Add/subtract preflights both inputs, computes P=AN*BD then Q=BN*AD, then N=P+/-Q,
then D=AD*BD, and normalizes. Multiply computes N=AN*BN then D=AD*BD and
normalizes. Exact divide checks the already-validated right numerator nonzero,
computes N=AN*BD then D=AD*BN and normalizes. Numeric comparison computes the
same two crossproducts then a charged raw compare, without normalization.
Coerced Int/Bool has denominator one. Unary minus validates its Rational input,
charges a numerator negate clone, and reuses its positive denominator without
reduction; unary plus only validates. Readers validate then wrap the selected
raw integer as Int. No cross-cancellation, denominator-equality optimization
or pointer-equality work shortcut changes this frozen debit order.

## ABI, diagnostics and unchanged resources

A fixed 256-byte operation frame saves W, pointers and intermediates across
volatile integer helpers. Generic structural guards save registers on a fixed
stack frame, without allocation. The shared raw divrem kernel uses its existing
128-byte frame and returns quotient AX/remainder DX from DI/SI inputs. Helpers
preserve BP/SP and R14; only allocation advances R15. All other registers are
volatile unless the generic guard explicitly restores them. The nonrecursive
helper graph remains below the existing4096-byte helper reserve. Source stack
2MiB, active user-call depth256, arena64MiB, IR nodes10000, expression128,
suites64, locals/functions/parameters128 and aggregate literal1MiB remain.

Exact best-effort stderr ends in one LF:

| Exit | Bytes before LF |
| --- | --- |
| 103 | `NJA203: native rational work limit exceeded` |
| 103 | `NJA203: invalid native rational span` |
| 103 | `NJA203: native value arena exhausted` |
| 105 | `NJA205: native value type mismatch` |
| 105 | `NJA205: unsupported native mapping key type` |
| 106 | `NJA206: integer division by zero` |

Malformed spans/counts/signs/limbs/noncanonical explicit Rational input fail103.
A structurally malformed stored Rational denominator fails103, while a valid
constructor/exact-division zero divisor fails106. Work debit failure precedes
that scan/kernel, including discovery of a later bad limb. This policy does not
introduce an exception framework, sandbox or provenance claim.

## Preregistered native proof

An independent Node BigInt reduced-fraction model supplies finite random and
explicit cases: all signs/zero/Bool, >128-bit common factors, exact cancellation,
mixed arithmetic/comparison/chains, aliases/returns/containers, child order and
failures, unsupported kinds and mapping keys, no-allocation near-arena generic
stores/selected reads/truth, aggregate work exhaustion and boundary mutants.
Native descriptor/header/pointer/count/sign/limb/denominator and work-counter
mutations must fail accurately; changed source must alter actual output and be
rejected by the original oracle. All unused/skipped IR branches retain node,
depth, initialization and literal validation. Existing strict mutant selectors
are not weakened; only new instruction sequences may change if they collide.
Freeze the finite harness before its first execution; retain first failure and
pending not_run cases. Artifacts execute as real Linux x86-64 ELF on explicit
local WSL, five seconds each, with no Python/foreign compiler/interpreter oracle.
