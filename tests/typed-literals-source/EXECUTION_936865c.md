# Stage A native execution at 936865c

The first unchanged corrected 150-case harness run passed, exit zero, against
clean compiler source `936865c7ef4dd566b4e4523089b1e6bad09534fe`, in the separate
`agent/typed-literals-execution-v13` worktree. No source, expected result,
diagnostic, resource cap or harness repair was made during or after this run.
The original and corrected preparation records remain historical `not_run`
records; this report supplies the separate execution observation.

| Observed checks | Passed |
| --- | ---: |
| Native behavior cases | 62 |
| Changed-source output controls | 2 |
| Compile refusals, each checked by real check/build | 73 |
| Original lexical token classification | 13 |
| Total | 150 |

The 64 ELF executions produced 132 expected stdout lines. Eight intentionally
failed native programs returned their exact expected resource/assertion/type
statuses and stderr; these are successful negative tests, not ignored failures.
All pending counts are zero. The harness retained 422 child-command identities
and output hashes. No failure record was produced. Exact results/commands are
in [EXECUTION_936865c.json](EXECUTION_936865c.json), harness stdout in the lossless
base64 envelope [STREAMS_936865c.json](STREAMS_936865c.json). Detailed raw child streams,
generated sources and ELF artifacts remain locally under
`target/typed-literals-language-NbVyoq/`.

The run passed exact BigInt payloads and underscore spellings through renamed
ordinary constructors; opt-in eligibility, marker aliases, both dialects,
NFKC binding, Unicode/CRLF original suffix ranges, constructor order/once/failure
effects, unary signs after construction, short circuits, loops, aliases and
ordinary mutation. It passed malformed/ambiguous-number refusals, unchanged
float/base/imaginary classifications, import/class/function and expression
boundaries, parse-node/suite/source limits, arena exhaustion and call-depth
failure. Changed constructor logic and numeric source produced independently
predicted different native bytes rejected by their original output oracles;
removing the opt-in marker caused the required source rejection.

Commands executed from the isolated source root:

```text
git rev-parse HEAD
git status --short
node --check scripts/test-typed-literals-language.mjs
node scripts/test-typed-literals-language.mjs --expect-source 936865c7ef4dd566b4e4523089b1e6bad09534fe
```

The initial status was clean. The unchanged harness verified frozen identities,
unchanged compiler files and no untracked compiler files, then ran
`cargo +1.97.1 build --workspace --locked --offline` successfully. It used the
real `naja check --json`, `naja build` and `naja lex` commands and literal WSL
argument boundaries for native runs. All commands required by the harness
completed within its unchanged 5-second artifact, 20-second CLI, 45-second
build, 240-second overall and 8 MiB capture limits. No Python, network/provider,
external assembler/linker or runtime compiler was used by these programs.

Observed versions: Node v24.11.0; rustc 1.97.1
`(8bab26f4f 2026-07-14)`; Cargo 1.97.1 `(c980f4866 2026-06-30)`;
WSL Linux `6.6.87.2-microsoft-standard-WSL2 x86_64 GNU/Linux`;
GNU readelf 2.42. The Windows compiler is an unsigned local debug artifact,
not a release binary or clean-host/self-hosting demonstration.

SHA-256 identities:

| Retained/observed item | SHA-256 |
| --- | --- |
| Unchanged harness | `5bff2753678b8c3eaef90005f0e06d46a453188afc9093f25d3176e1688409c1` |
| Frozen contract | `acfc89c0320a0b364855c2fe4860a23593787f9762333c650ccfdc8e42b2d918` |
| Corrected preparation | `485d653e9105506a3ecb417d7d59790241fd4e67cd5dc9fc93cb0661736ea937` |
| Raw execution summary | `4eb59fe5ba98d45fd953fac21d7427d670c737006a7dcbb84c79725c169d8db0` |
| Harness stdout log | `8705341fe6602235d8996e7fdd32c3ceab23de187e154a88bf6a2a828fdad6e5` |
| Observed `target/debug/naja.exe` | `4e2da1461d09162f9899b15d67164552814f2e0c4e939f6ee6ce987681824b0f` |
| `renamed-exact-4.elf` | `3a5635ee1f4e31b79072a3a53f5a357554005de5f3fe100b147fb33941e61e63` |

Source Git blobs at the exact executed commit: shared lexer
`c2983c59d63e42b3b489cf5ac2a9b2e5c35f819b`, frontend token definitions
`2821bc785944375d3834f187c63fffd7da53ed5d`, driver parser
`27ed37ab9753f9c13ce4af33f56750dbbc6edb56`, harness
`622a75cbe7e9c744acf5850a8c6bf802d7979717`.

`wsl.exe --exec /usr/bin/readelf -h -l -d` on that ELF returned zero:
ELF64 little-endian x86-64 EXEC, entry `0x401000`, one RX LOAD plus RW
GNU_STACK, no interpreter or dynamic section. Windows UTF-8/CRLF text captures
are retained without Git line-ending conversion in
[STREAMS_936865c.json](STREAMS_936865c.json), with byte lengths and hashes;
their decoded bytes were round-trip verified against the local captures.
This is an observation of
one generated artifact, not a universal dependency or reproducible-build proof.

This evidence is Stage A static same-module integer-literal construction on
one Windows/WSL target. General protocols/decorators, imported types,
Rational/Decimal promotion, scale/affine algebra, complete Python semantics,
productivity, FC1 and HATCH acceptance remain open. Resource guards do not
provide an OS sandbox or a guarantee under lower host-stack availability.
