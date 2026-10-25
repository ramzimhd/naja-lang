# Rational compatibility after exact literal integration

The unchanged corrected Rational suite passed **220 of 220 cases** against exact
source `f0f89944b13077bb8afe84466a34e8f73f2654da`, with harness exit **0**.
This is finite compatibility evidence after the exact-literal implementation;
no release gate, FC1 or HATCH outcome is promoted.

The fresh worktree was tracked clean at execution:
`C:/naja-worktrees/exact-literal-compatibility`, branch
`agent/exact-literal-compatibility-v13`. Executed once:

```text
node scripts/test-rationals-language.mjs --expect-source f0f89944b13077bb8afe84466a34e8f73f2654da
```

The harness, all 220 sources/oracles, fixture hashes and work traces were checked
against the frozen preparation without changes. No script, preparation, compiler,
old harness or shared metadata was edited for this run. Source diff was empty.
The separate first Rational fixture failure at 5ee64ec remains preserved as
33 passed, 1 failed and 186 not_run, with its authorized correction recorded
separately; this compatibility success does not rewrite that observation.

| Frozen category | Cases passed | Actual outcome |
| --- | ---: | --- |
| Native semantic success | 47 | Exit 0, exact output |
| Native type refusal | 127 | Exit 105, exact diagnostic/effects |
| Native zero refusal | 11 | Exit 106, exact diagnostic/effects |
| Native resource refusal | 6 | Exit 103, exact work/call/arena guard |
| Compile rejection | 27 | Check/build exit 1, no ELF |
| Actual source/input mutation controls | 2 | Exit 0; original output oracle rejects |
| Total | 220 | No failed or not_run case |

Host: win32-x64, Node v24.11.0; target: x86_64-unknown-linux-gnu. The actual Rust seed was
built with `cargo +1.97.1 build --workspace --locked --offline`; actual source
was checked/built and 193 real Linux x86-64 ELF files executed through local
WSL. The 833 recorded child commands totaled 131541 ms of child time,
with no spawn errors or signals. These timings are not productivity evidence.
Budgets stayed fixed: native 5 s, CLI 20 s, compiler build 45 s, suite 240 s,
child capture 8 MiB. No Python or foreign interpreter/compiler oracle was used.

This includes both source dialects, Unicode/project aliases, existing typed
Stage A construction, exact BigInt fraction/comparison vectors, function/class/
container aliases, argument/error ordering and short-circuit behavior. The
256/257 call, 128/129 expression/import, near-arena reuse/allocation and cumulative
49/50-limb work boundaries passed. Private input bytes/inventories survived
check/build/native execution, and both real mutation controls were caught.
Source cannot inspect native work counters or forge corrupt descriptors; those
remain separate backend proof responsibilities. No sandbox or OS I/O deadline
is claimed. Full numeric hashing, Rational display, Decimal, general protocols,
scale/affine relations and broader founder acceptance remain open.

The companion JSON is the successful raw summary copied byte for byte, including
all case identities/outcomes, compiler/ELF hashes, exact exits and all command
capture hashes. Full sources, ELF files and raw captures remain ignored locally
under `target/rationals-language-nlIRdb`.

| Item | SHA-256 |
| --- | --- |
| Companion JSON / raw summary | `ab4264948242ae7af5758f94714433afc70dd6a79a0d8c879856b9b9f0f158b1` |
| Actual plan | `fc306fb46fe0a522e0ef534277743f56bb21f3a9550016b5c51da23886fb5b5f` |
| Unchanged harness | `27ba96c217d30e2a285cae6cd5c01818767868f37783e96a32ae8244a1931e5f` |
| Unchanged preparation | `32f4df6b247d3cfddabdca4e72b7d7d88eb91bbc86c0295cf475449bd3ff4c5e` |
| Unchanged fixture index | `c1ecb856a751837fe86df003cdca88f8f045cc72b332f22c0ac2047a6f9041e2` |
| Compiler binary | `bd591887895768e15f222b3b38f232b62acaf5938359d43693879b1c3a9db208` |

The original frontend/Rational worktrees and inherited untracked Cargo.lock
remain untouched. This run is separate from the integrator's Stage A and exact
literal proofs, and makes no claim about their execution.
