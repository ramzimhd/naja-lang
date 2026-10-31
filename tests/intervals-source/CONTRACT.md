# Frozen source proof for ADR-009

Authority: `44c091d19b1e6d1b17e697694fd5ea28a768110f`,
`docs/decisions/0009-inclusive-integer-intervals.md`. Source base:
`8dbea5fc4a189bf4bf39017febe30d4afa37f056`. This prepares the first inclusive
arbitrary-integer interval source proof. It does not close L09, FC1-06 or HATCH.

The harness generates every source before execution and freezes its UTF-8 length,
SHA-256, independent expected output/error, diagnostic range, work trace and
literal ledger in PREPARATION.json. Preparation invokes only Node and read-only
Git commands; all compiler/native outcomes remain not_run. Execution requires an
explicit full source commit, clean tracked/untracked compiler paths and exact
frozen identities. The preparation host is independent evidence metadata.

The finite Node BigInt oracle checks inclusive signed bounds and Bool 0/1 without
machine narrowing or a Python/foreign-language interpreter. Runtime failure cases
pass operands through function parameters, so the static proof cannot replace the
native path. Static proof separately covers literal/Bool/parentheses/unary signs,
wrong scalar priority, inverted bounds with an unknown value, and deliberately
unproven calls/arithmetic/containers/Rational values.

Every annotated assignment is charged two stored signed endpoint strings, the RHS
and three injected expression nodes. Sign and raw zero digits remain charged;
unused code and repeated assignments count. Positive exact/one-over controls also
cover decoded UTF-8/bytes and repeated canonical member names. The unchanged
limits are 1 MiB source and aggregate literals, 10,000 nodes, expression height
128, suite height64, 128 bindings and active native calls256.

For limb counts nv,nl,nu, full scans cost2+n each. Comparisons cost
1+2*max(n,m), in lower/upper, value/lower, value/upper order, stopping only on
failure. One cumulative work limit is1,000,000. All-zero costs9, one-limb costs18;
shared111110 limbs costs999999, shared111111 costs1000008. An exact1000000 case
uses counts111109,111109,111111. Equality, shared pointers and differing signs
receive the same charges. Source construction remains within unchanged caps.

Two immutable text literals permit filling the arena exactly:
127*(524288+24)+(521216+24)=67108864. Successful explicit and repeated annotation
checks must then allocate nothing. An arithmetic allocation control must fail.
Actual changed source and private input controls must produce their new exact
result and be rejected by the original output oracle. Binary descriptor mutants
belong to the independent native/review proof, not a substitute in this source
suite.

Frozen execution budgets: native child5seconds, each CLI20seconds, compiler
build45seconds, suite300seconds, each child capture8MiB. First failures and all
remaining not_run records are preserved in a fresh exclusive artifact directory.
No expectation, budget, source, failed outcome or historical suite is rewritten
to obtain success.
