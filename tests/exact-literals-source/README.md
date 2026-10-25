# Exact literal source evidence

This is independent preparation for frozen ADR-008. Read [CONTRACT.md](CONTRACT.md)
for semantics, independent BigInt/byte/work models and unchanged limits.

```text
node --check scripts/test-exact-literals-language.mjs
node scripts/test-exact-literals-language.mjs --prepare-only
```

Preparation creates generated source fixtures and their all-`not_run` identities
under a fresh ignored `target/exact-literals-language-*` directory. The first
successful plan is retained as `PREPARATION.json` before any native execution.
No exact-literal compiler/native outcome has run as part of this preparation.

First successful preparation: Nodev24.11.0 on Windows x64, exit0, fresh directory
`target/exact-literals-language-eVs7rr`. Its original `plan.json` was copied with
exclusive-create semantics to `PREPARATION.json`:202 outcomes,74 native programs,
97 compile refusals,21 lexical classifications and10 check-only successes.
All202 remain `not_run`;25 cases retain complete boundary literal inventories.
Read-only independent review found no concrete oracle/ledger/grammar mismatch
before that preparation. `node --check` also passed; no compiler was invoked.

SHA-256 identities of the frozen first preparation:

| File | SHA-256 |
| --- | --- |
| `scripts/test-exact-literals-language.mjs` | `18aff2f3f569a414fd3cbc4ef1807906fba426db8eca7b042c6cfe1ee603418a` |
| `CONTRACT.md` | `792c5a72d8e2d3c93a33386667469f6777cae4b52e05f9dab3568cd04fb031f5` |
| `PREPARATION.json` | `8f4f47addfc099f74f14139b16c28594915532b571f00d406792cd1d79cc87b1` |

Only after the integrator supplies an authorized exact integrated source pin:

```text
node scripts/test-exact-literals-language.mjs --expect-source FULL_COMMIT_HASH
```

The harness preserves raw streams, exact source/artifact hashes and first failures.
Huge expansion boundary successes use `check --json` only; they do not emit/run
million-digit artifacts. The other cases distinguish lexing, refusal and real
native output. Partial literal construction is no full numeric protocol,
quantity, Decimal, productivity, FC1 or HATCH acceptance claim.
