# Exact Rational backend foundation

The [contract](CONTRACT.md) was frozen at
`23a6a59042c29502e180940bb38eab3c061a7925` before native execution. Core
`f28600e44e67e08c7e6e2682579a5b9d3aa0ccbb` implements the four additive
dynamic expressions, normalized private tag10, cumulative work accounting and
allocation-free generic structural guards. Existing integer APIs and source
division policy are preserved. The RPN `rationals_ir` example is development
plumbing; it is not a second source frontend or a runtime interpreter.

The finite independent Node BigInt harness freezes 101 outcomes in
`PREPARATION.json`, all `not_run` before its first actual native execution.
It includes 32 independently modeled fraction pairs and four arithmetic
operations each; signs/Bool/zero, 10000-digit exact integers, numeric and
unrelated comparisons, chains, effects, aliases, readers, near-arena generic
checks, cumulative Euclid, resource failures and original IR validation.
Native byte mutations exercise input canonicalization, descriptor pointers,
nonreduced fractions, no-gcd generic checking, work debit and source-data
controls. Synthetic canonical Rational descriptors in mutated ELF isolate
reader/unary/mixed-operation counter boundaries without charging a constructor
first; this is adversarial test plumbing, not a public construction path.

Cost expectations derive from the frozen abstract model, not execution output:
constructor0/1=5, constructor1/1=82, positive integral Rational reader=31,
negative integral reader=34. Same positive49-limb operands cost971506 and
50-limb operands1011132, so the latter exceeds the fixed1,000,000 cap.
Exact/one-under budget mutants and a disabled-debit control distinguish
cumulative accounting from per-kernel resets. Generic selected reads/stores/
truth must not allocate or run gcd. They do not prove payload coprimality or
provenance after arbitrary binary mutation.

Preparation commands, with no compiler/native invocation:

```text
node --check scripts/test-rationals.mjs
node scripts/test-rationals.mjs --prepare-only
```

After committing the frozen harness/plan, actual execution requires its full
source commit and unchanged tracked native sources:

```text
node scripts/test-rationals.mjs --expect-source FULL_COMMIT_HASH
```

Before native proof, native-crate Rust tests, formatting and all-target Clippy
passed. Earlier ordinary authoring failures are retained honestly: initial
compilation needed sibling diagnostic-helper visibility and the new adapter
had double-boxed existing boxed operands; the first new depth negative used
128 edges, while the inherited validator starts at depth0 and rejects >128.
The corrected new test asserts128 accepted and129 rejected without changing
the product guard. Failed Rust logs remain under ignored `target/`; no native
case or resource expectation has been changed after execution.

All richer Rational/Decimal display, source true-division policy, quantity and
scale/affine algebra, generic protocols, coherent hashing, full semantics,
self-hosting, productivity, FC1 and HATCH gates remain open. Local target
execution under ordinary OS rights is not a sandbox or clean-host proof.
