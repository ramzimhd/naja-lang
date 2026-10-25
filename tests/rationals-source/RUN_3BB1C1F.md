# Exact Rational source run at 3bb1c1f

The corrected frozen suite passed **220 of 220 cases**, with no pending case,
against exact source `3bb1c1f42ed77494d32cf237dc4b911c13a78c68`. This is finite
source/native evidence for the bounded Rational slice. It does not promote a
gate or establish complete numeric protocols, Python compatibility,
self-hosting, FC1 or HATCH acceptance.

The first failed run remains unchanged in `FIRST_RUN.md`,
`FIRST_RUN_FAILURE.json` and `FIRST_RUN_ARTIFACTS.json`: 33 passed, 1 authored
fixture failure and 186 not_run at `5ee64ec1fb02968964a81b0f07c086ae0578c684`.
That static function-name guard was correct. Separate correction commit
`699bdaede2156f3df3b10b2b84b138cb2083ef7d` renamed only the fixture function
`value()` to `make_ratio()` and its call, before this run. All other 219 case
identities, expected output/error bytes, costs and resource budgets remained
unchanged. The original failure is not reclassified as a pass.

## Command, target and outcomes

The execution branch advanced with `git merge --ff-only` to the exact source
pin and was tracked clean before this command. Harness exit: **0**.

```text
node scripts/test-rationals-language.mjs --expect-source 3bb1c1f42ed77494d32cf237dc4b911c13a78c68
```

Host: Windows x64, Node `v24.11.0`. The harness built the experimental Rust seed
with `cargo +1.97.1 build --workspace --locked --offline`, then invoked actual
`naja check` and `naja build --target x86_64-unknown-linux-gnu` for every case.
The 193 accepted source/control cases emitted and executed real Linux x86-64
ELF files through local WSL. Rejected cases were checked through both CLI paths
and emitted no ELF. No Python or foreign interpreter/compiler oracle was used.

| Frozen category | Cases passed | Actual behavior |
| --- | ---: | --- |
| Native semantic success | 47 | Exit 0, exact stdout/stderr |
| Native type refusal | 127 | Exit 105, exact diagnostic/effects |
| Native zero-divisor refusal | 11 | Exit 106, exact diagnostic/effects |
| Native resource refusal | 6 | Exit 103, exact work/call/arena diagnostic |
| Compile rejection | 27 | `check` and `build` exit 1, required diagnostic |
| Actual changed source/input controls | 2 | Normal exit 0, original stdout verifier rejects |
| Total | 220 | 0 failed, 0 not_run |

The harness recorded 833 child commands, totaling 140,929 milliseconds of
recorded child time. None reported a spawn error or signal. These are summed
child measurements, not a human productivity or compiler performance result.
The frozen limits were unchanged: 5 seconds per native process, 20 seconds per
compiler CLI call, 45 seconds compiler build, 240 seconds total suite and 8 MiB
capture per child. The source diff at execution was empty.

## Observations within this scope

Both source dialects passed the ordinary forms, independent BigInt arithmetic
vectors and exact mixed numeric comparison matrix. Huge common factors,
negative denominators, canonical zero, Bool/Int promotion and immutable aliases
retained their exact numerator/denominator results. Functions, class fields,
containers, typed Stage A class construction, Unicode/as/project aliases,
shared suites, inert comments and CRLF transformations passed. Ordinary Int-only
operations retained their existing behavior; source `/` remained unsupported.

The error/effect cases passed both-arguments-before-kinds ordering, both-kinds-
before-zero/normalization ordering, child-error precedence, once-only argument
effects and chain/boolean short-circuiting. Unrelated scalar/object equality,
restricted container comparisons, Ratio-only readers and unsupported Ratio
display/arithmetic/index/member/mapping-key operations matched frozen errors.
The Unicode unknown-argument diagnostic retained its original source position.

The following resource cases matched the preregistered expectations:

- 256 active calls succeeded; 257 failed with the existing call limit.
- Expression height 128 and 128 import bindings succeeded; the corresponding
  129 cases were rejected.
- Near-arena generic Ratio stores, selected reads and truth reused descriptors
  successfully; repeated explicit construction hit the unchanged arena guard.
- The 49-limb equal constructor succeeded, while the 50-limb constructor hit
  the cumulative work guard, including after both child effects.
- Negative-denominator and zero-result shortcuts matched the cost-derived
  expectations. Reciprocal multiplication and equal-Ratio exact division still
  hit the work guard without an unauthorized cross-cancellation or reset.
- False boolean branches skipped over-budget normalization. Numeric comparison
  crossproducts succeeded without normalizing a result Ratio.

The work totals and full traces remain the contract-derived expectations in
`PREPARATION.json`; source cannot directly inspect the native counter. These
boundary outcomes do not constitute a proof of every helper instruction or a
claim about modified ELF provenance. Malformed descriptor/header/limb and
counter mutation evidence remains the separate backend proof.

The actual source mutation changed the emitted result and was rejected by the
same stdout verifier. The file control likewise distinguished `[135,137]`
(`7/9`) from `[136,137]` (`8/9`). The private runtime input inventories and bytes
were unchanged after checking, building and native execution. Compiler outputs
and captures remained outside each program's data directory. No filesystem
sandbox or general OS I/O deadline is claimed.

## Retained results and identities

`RESULTS_3BB1C1F.json` is the original successful summary copied byte for byte.
It records all 220 case identities/outcomes, exact CLI/native exits, per-command
capture hashes, compiler version/hash and each ELF hash.
`ARTIFACTS_3BB1C1F.json` additionally inventories every retained run file,
including private project/input fixtures, and links the original failed run.
Full source files, ELF files and raw captures remain locally under the ignored
directory `target/rationals-language-K6KBPb`.

| Item | SHA-256 |
| --- | --- |
| Corrected frozen harness | `27ba96c217d30e2a285cae6cd5c01818767868f37783e96a32ae8244a1931e5f` |
| Corrected preparation | `32f4df6b247d3cfddabdca4e72b7d7d88eb91bbc86c0295cf475449bd3ff4c5e` |
| Unchanged static fixture index | `c1ecb856a751837fe86df003cdca88f8f045cc72b332f22c0ac2047a6f9041e2` |
| Successful summary/results | `77b645b82a25812ab885bc149580de091771f96e61f0ea6046fc17c457c4ec11` |
| Actual run plan | `91d0345e5bc587cb1c949c94e0806a39b71d84c7946fc4fdf257a15b95d4cab0` |
| Recursive artifact manifest | `0d4174c375dcc06c7c1b34e75a8ebea98dc55d5ca13d18083b0cf727a29e2bcd` |
| Compiler binary, identical in both runs | `9123142182fc2c62ced5be21286aa71633b6953a0caa0035d0af366a1b77e2f3` |
| Original failure, preserved | `8177b5f7c9032f0d17450b59ab96430ef61b00d1256c3aa36d2d9f061a0ec5f7` |

No compiler, frozen preparation, old harness or shared planning file was changed
to record this run. The original preparation branch and its untracked
`bootstrap/frontend/Cargo.lock` remain preserved. Rational display, full numeric
hashing, Decimal, general promotion/scale/affine protocols and broader founder
acceptance work remain open.
