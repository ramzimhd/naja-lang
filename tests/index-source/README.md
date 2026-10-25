# Actual source indexing checks

This harness tests the bounded Text/Bytes indexing slice through the shared
source parser, real CLI checker/builder and emitted Linux x86-64 machine code.
It does not call Python or use an external interpreter as an oracle.

Before execution, freeze fixtures and expected outcomes with:

```text
node --check scripts/test-index-language.mjs
node scripts/test-index-language.mjs --prepare-only
```

Preparation validates the immutable SHA-256 identities in `fixture-index.json`,
constructs every source case and records expected exits and output hashes in
an ignored `target/index-language-*` plan. Every preparation native outcome is
`not_run`; preparation alone is not compiler or runtime verification. Commit
the prepared harness and expectations before running:

```text
node scripts/test-index-language.mjs --expect-source FULL_COMMIT_HASH
```

The default mode builds the compiler through pinned Rust 1.97.1 with
`cargo +1.97.1 build --workspace --locked --offline`, checks and builds every
source, then executes each accepted ELF on Linux x86-64 or through the explicit
local x86-64 WSL target on Windows. Other hosts fail explicitly. Fixed budgets
are five seconds for each native process, 20 seconds for ordinary child
commands, 45 seconds for the workspace build, 240 seconds overall and 8 MiB
captured output per child command. No timeout or signal counts as an expected
language failure. These limits are not a security sandbox or performance claim.

Node's `Array.from(text)` supplies Unicode scalar answers independently of UTF-8
byte offsets and JavaScript UTF-16 indexing. Explicit unsigned values 0..255
supply byte answers. Generated matrices cover every byte at positive and
negative positions, all UTF-8 widths and width boundaries, combining marks,
NUL and physical control characters. Static cases cover immutable backing
views, reassignment and returned views; postfix chains and precedence;
self/earlier calls with observable once-only left-to-right evaluation;
short-circuit and skipped comparison operands; shared `.py`/`.naja` parsing,
brace/depth forms and explicit contextual aliases.

Runtime controls require exact type, bounds and zero-division diagnostics and
exits. Large positive and negative integer indices must remain exact rather
than wrap. The 127-postfix expression boundary must execute and 128 must be
rejected in both dialects. Slices, multidimensional/empty indices, unsupported
index values and source locations have explicit negative cases. Both check
and build must reject each compile failure without emitting an ELF.

Two actual wrong-index source mutations must compile and execute normally,
then fail the same output verifier used for positive cases. This checks that
the harness detects a wrong scalar or unsigned byte rather than merely a
successful process exit.

Plans and summaries retain source commit, dirty status, original source hashes,
expected outputs, actual command/compiler/native exits, signals and artifact
identities. Every command's output is retained, including partial output from
a timeout. On a failure, `failure.json` preserves the failing case and all
remaining `not_run` outcomes without weakening expectations. Successful runs
retain per-case output/ELF hashes in `summary.json`.

These tests do not implement or verify slices, general containers, arbitrary
object indexing, complete Python compatibility, memory reclamation, other
emitted targets, self-hosting, FC1 or HATCH completion. Multilingual identifiers
and string values are intentional user data; official narratives are English.

The first actual run is retained in
[RUN_2026-10-25.md](RUN_2026-10-25.md) and
[RESULTS_2026-10-25.json](RESULTS_2026-10-25.json). Its results apply to the exact
source/compiler identities recorded there.
