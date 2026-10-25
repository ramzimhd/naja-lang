# Exact Rational execution evidence

The first unchanged frozen harness passed101 checks at source
`0138734316bf0cd85d4860541f0ec69643e6da2f`, exit0:95 actual Linux x86-64 ELF
executions,6 invalid-IR refusals,366 expected stdout lines and298 recorded child
commands. All results passed; no native failure record, expectation/cap change,
selector repair or product correction occurred after that first native run.
The original [preparation](PREPARATION.json) remains all-`not_run`; separate
[execution results](EXECUTION_0138734.json) record the actual observation.

The native proof includes128 independently computed arithmetic results from32
BigInt fraction pairs,10000-digit exact integers, mixed Int/Bool arithmetic,
canonical reduction/sign/zero, numeric comparisons/chains, unrelated equality,
unsupported operations, argument effects/type/zero ordering, aliases/returns,
collection values, cumulative Euclid and resource limits. A near-arena probe
performs1000 iterations of generic Rational list/object/dictionary stores,
selected tuple/list/dictionary/field reads and truth checks without hidden gcd
allocation. Corruption probes cover raw sign/count/span/limbs/Bool, Rational
pointers/nonreduction/negative denominator and the deliberately limited generic
structural guard. Exact and one-under work mutants confirm costs5,82,31,34,150,
132 and59;49/50-limb same-operand cases independently check the1,000,000 boundary.
Disabled-debit and changed-data mutants are rejected by their original oracles.

Main command, after committing the frozen contract/core/harness:

```text
node scripts/test-rationals.mjs --expect-source 0138734316bf0cd85d4860541f0ec69643e6da2f
```

Artifacts and raw command byte streams remain in
`target/rationals-native-yDSecI/`; stdout was captured as
`target/rationals-native-first.log`. [STREAMS.json](STREAMS.json) losslessly
base64-encodes the captured logs, with byte lengths/SHA-256 and verified
round trips, avoiding Git CRLF conversion. It also retains the earlier failed
Rust adapter/depth authoring logs as failures, alongside later passing checks.
The first visibility compiler error was reported in the task tool transcript;
it was not a native execution. No failed observation is renamed a success.

The integrator authorized consumption of source-lowering commit
`255d2a2294b6906edbcc45d0387b5b4969602356` in this worker worktree. Its
cherry-pick is `4e52156f8d2127d25c9f7fd51a243da2a8501608`; only the integrator's
driver/height/ADR files changed. Native backend, frozen harness and contract
bytes are identical to the first-proof source. This later source passed:

```text
cargo +1.97.1 test --workspace --locked --offline
cargo +1.97.1 fmt --all -- --check
cargo +1.97.1 clippy --workspace --all-targets --locked --offline -- -D warnings
cargo +1.97.1 build --workspace --all-targets --locked --offline
```

All exited0, with276 Rust tests passed. Before that integration, the native
package's41 Rust tests, formatting and native all-target Clippy passed. Ten
unchanged legacy scripts then all exited0 at the later source:

| Script under scripts/ | Checks | Independent outputs |
| --- | ---: | ---: |
| test-native.mjs | 36 | not separately counted |
| test-hosted.mjs | 14 | 394 arithmetic/metamorphic +150 comparison |
| test-dynamic.mjs | 85 | 8194 |
| test-functions.mjs | 43 | 294 |
| test-index.mjs | 72 | 2107 |
| test-tuples.mjs | 76 | 259 |
| test-lists.mjs | 97 | 385 |
| test-files.mjs | 70 | 48 |
| test-objects.mjs | 74 | 78 |
| test-mappings.mjs | 87 | 964 |

Their original strict mutation selectors and expected results were unchanged;
no collision adjustment was needed. Exact commands, source pin, script hashes
and retained log hashes appear in [REGRESSIONS_4e52156.json](REGRESSIONS_4e52156.json).
The separately owned source harnesses have their own source/evidence pins;
their observations are not implied by these IR/legacy checks.

Observed tools: rustc1.97.1 `(8bab26f4f 2026-07-14)`, Cargo1.97.1
`(c980f4866 2026-06-30)`, Nodev24.11.0, WSL Linux
`6.6.87.2-microsoft-standard-WSL2 x86_64 GNU/Linux`, GNU readelf2.42. The
unchanged Rational harness enforces5-second artifacts,20-second ordinary
commands,45-second build,240-second overall and8MiB capture limits. Process
timeouts/crashes do not count as expected language diagnostics. Other legacy
scripts retain their original frozen limits.

| First-proof observed item | SHA-256 |
| --- | --- |
| Contract | `980e4663145eb42286840a4e64f0366e4a75b45786847dbb89b183248c7269d7` |
| Harness | `abbedba1b2f36b40a436a83cfb999475d23810ab006fb7ef0b135071ddca550e` |
| Preparation | `017cb8d0b66472a88d44351318c77da2577d36369427d25b53d433788a16572a` |
| Raw execution JSON | `f6515a7314229b8eef9011f489ebf898541dd5930ae4c212e3c804aa47bc0b99` |
| Native harness stdout log | `f3759c936ce4455b81d8bc63e276dbc6115da0c13aef5d811f774d9e2ac13f76` |
| Unsigned debug rationals_ir.exe | `54524ba5c292b0d5628f71201010fc463a49ac05667ae72868708e55b91ea826` |
| deterministic-emission.elf | `16a4c1854fbb9ea06d360923c1f9d3c5deeb3ca913c49ede33a6f4861159095f` |

At first-proof source, Git blobs are Rational routines
`8e98d96f90939cc389194d18dcfe6f3e22261892`, dynamic IR
`8d3ea31d941e7417b7c4055ab059b2ffd0fa70ca`, and development adapter
`0d08c6bdf1ed9dc22a8f714d281b614bea2e4cc5`. `readelf -h -l -d` on the
sample ELF exited0: ELF64 little-endian x86-64 EXEC, entry0x401000, one RX LOAD
plus RW GNU_STACK, no interpreter/dynamic section. This observes one emitted
artifact, without a universal dependency, reproducible-build or release claim.

The [contract](CONTRACT.md) preserves all earlier resource limits and explicitly
separates allocation-free structural checks from full numeric canonical/gcd
validation. Generic guards are not modified-ELF provenance/coprimality proofs.
This remains a bounded Rust-seeded backend foundation on one Windows/WSL
target. NAJA-native backend/source closure, self-hosting, generic protocols,
complete display/hashing/Decimal/quantity algebra, productivity, clean-host,
FC1 and HATCH requirements remain open. Ordinary OS rights and lower available
stack are disclosed limits, not a sandbox.
