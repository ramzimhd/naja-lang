# First frozen exact-literal source execution

The unchanged 202-case preparation passed its first authorized run at exact clean
source `6d8fb04400cf19f9cf04bebd6bc67fbe1b39cbb0`. Exit 0, 202 passed, 0 pending:
74 real emitted ELF executions, 97 check/build refusals, 21 lexical classifications
and 10 check-only successes. Native stdout matched 170 independently expected lines;
stderr and exits matched their frozen byte oracles. No first failure, product
repair, expectation migration, budget increase or frozen-file edit was needed.

The separate worktree was `C:/naja-worktrees/exact-literal-execution`, branch
`agent/exact-literal-execution-v13`. Preparation remains on its separate branch
at `4d97ddcacc587c1d326120a869a9205ed63848e9`. Amended ADR authority remains
`3fa7e09ceb82365948dd2f9793cdbf44dc5dc12f`; the original unique-name wording and
its pre-execution correction remain historical. `PREPARATION.json` still records
all 202 outcomes as `not_run`; this separate execution record supplies actual results.

Authorized inner command:

```text
node scripts/test-exact-literals-language.mjs --expect-source 6d8fb04400cf19f9cf04bebd6bc67fbe1b39cbb0
```

A Node `spawnSync` wrapper retained the harness's complete raw stdout/stderr as
`target/exact-literal-first.stdout` and `.stderr`, using exclusive-create writes.
Its 250000ms outer collection timeout did not replace or raise the harness's
unchanged 240000ms overall deadline. Wrapper exit 0, no signal/error. The harness
enforced 5s per ELF, 20s per ordinary command, 45s per offline build and 8MiB capture
per child. These are test limits, not product timing or sandbox claims.

The 528 recorded child commands include exact Git identity/cleanliness checks,
`cargo +1.97.1 build --workspace --locked --offline`, CLI `check --json`, `build`
and `lex`, plus explicit local WSL `chmod`/`timeout` execution. All command streams
are retained. Huge successful expansion cases use only `check --json`, so no
million-digit artifact is emitted/executed. Refusals must fail both check/build,
retain the expected diagnostic/range and leave no artifact.

Observed tools/target: Node v24.11.0, rustc 1.97.1 (8bab26f4f 2026-07-14),
cargo 1.97.1 (c980f4866 2026-06-30), Windows x64 seed emitting Linux x86-64 ELF.
The harness observed WSL `Linux x86_64`. CLI version:
`naja 0.0.1 HATCH experimental Rust seed; native target Linux x86-64; no self-hosting claim`.
This worker ran no Rust unit/fmt/Clippy or old harness suites for this report;
the integrator retains those separately.

The results include exact decimal/integer Ratio input, explicit integer-only
semantic refusal, suffix-free Float classification, ordinary constructor behavior,
constructor order/once/effects, unary-after-construction, short circuits, Unicode
and CRLF ranges, raw coefficient zeros, huge signed/zero exponents, leading-zero
exponents and skipped/unused static checking. Complete inventories verify exact
and one-over aggregate limits for generated pairs, decoded Text/Bytes, ordinary
integers and duplicate canonical member-name occurrences. Native 49/50-limb
normalization cases matched 971506/1011132 work units respectively, with the latter
failing 103 before initializer effects. Three actually changed source programs
produced their new expected bytes and failed their original output oracles;
removing the marker rejected. All original limits remained in place.

Retained artifacts:

- [EXECUTION_6d8fb04.json](EXECUTION_6d8fb04.json): byte-identical harness summary,
  sources/expectations/results, 528 commands and ELF/stream hashes.
- [STREAMS_6d8fb04.json](STREAMS_6d8fb04.json): 1058 lossless base64 streams,
  99924 decoded bytes, covering every child stdout/stderr plus both outer streams.
  Each decoded byte count/hash was checked against the raw capture and summary;
  all 202 frozen source/expectation identities were independently compared again.
- Ignored original directory: `target/exact-literals-language-fu9wYr`, with first
  `plan.json`, generated sources, emitted ELFs, 1056 raw child streams and summary.

| Identity | SHA-256 |
| --- | --- |
| Frozen harness | `18aff2f3f569a414fd3cbc4ef1807906fba426db8eca7b042c6cfe1ee603418a` |
| Frozen contract | `792c5a72d8e2d3c93a33386667469f6777cae4b52e05f9dab3568cd04fb031f5` |
| Original preparation | `8f4f47addfc099f74f14139b16c28594915532b571f00d406792cd1d79cc87b1` |
| Execution summary | `68d7987a13ab379e210115e9c916297a885ddc85dd36c07461ec7f2ff126ebc1` |
| Lossless stream archive | `104d011a277963770456e63c0fa4fd05305548043156332d9c97daf9c347c9a9` |
| Observed unsigned debug `naja.exe` | `125ed2a6f6aef5c4ae2dfd8a080fe6d8bd766b5f0f4d0de7f6f9b7fda36e04e1` |

Relevant exact-source Git blobs, preserving byte identity independently of later
report commits:

| Path | Git blob |
| --- | --- |
| `bootstrap/driver/src/lib.rs` | `0ca0c2a3eab62f4afc96acf512eddae0c2ed5edf` |
| `bootstrap/driver/src/literal_construction.rs` | `b2e2792f184e819923db1c888f5402f2e7cf1bbb` |
| `bootstrap/frontend/src/lexer.rs` | `4d5ca8eab5632bc25617c335383ca28709f56ebc` |
| `bootstrap/frontend/src/lib.rs` | `b2f0cb40fc44667cf1702c0b55827784b66d5fb8` |
| `scripts/test-exact-literals-language.mjs` | `3658d266aab4f048ce14ccd00a769fdc868474a9` |

This is scoped same-module exact literal construction evidence. It does not
complete general Decimal/numeric protocols, imported types, quantity/scale/affine
algebra, coherent hashing, native source closure, clean-host validation,
productivity, FC1 or HATCH. The debug artifact is unsigned; no release or
reproducible-build claim is made. Old Stage A lexical evidence remains historical;
any affected old-fixture migration belongs to the integrator's separate record.
