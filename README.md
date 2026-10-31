# NAJA HATCH

NAJA is a programming language project inspired by Python's readable source forms,
with independent native compilation, runtime services and explicit hardware control
as its goals. The founder has long wanted these capabilities together. Development
is AI-assisted under human direction; this does not establish independent audit,
universal compatibility, memory safety or performance superiority.

Development has started from the English HATCH specifications, expanded by the
[founder's revision 1.3](docs/continuation/README.md). This is an early
experimental Rust seed, **not a HATCH release**. The implementation currently has
a lossless lexer/logical-line CST and a small native Linux x86-64 code-generation
backend. It does not yet parse the complete grammar, implement the full hosted
value model, self-host or provide native sessions. An unsigned, installable
[VS Code CLI preview](editor/vscode/README.md) supports manual check/build/run;
full language/debug tooling remains incomplete. FC1 and HATCH remain incomplete.

Ordinary decimal integers, including values beyond machine width, compile through
a native multi-limb runtime. Text, bytes, booleans and `None` also execute natively.
The current slice supports arithmetic, comparisons and chains, truthiness,
short-circuit expressions, assignment, `if`/`else`, `while`, assertions, printing
and text/bytes length/indexing. Fixed-length lists support shared indexed mutation;
tuples support immutable indexed access. Explicit `naja.io` and `naja.text`
imports expose bounded byte-file operations and strict UTF-8 conversion.
Ordered dictionaries and sets support bounded exact scalar keys, membership,
shared dictionary updates and immutable key snapshots through `naja.collections`.
Ordinary classes support native construction, shared fields and compiled methods;
full name mangling, inheritance, descriptors, extensions and partial classes remain
open. See the [class source evidence](tests/objects-source/PRIVATE_FIX_RUN_2026-10-25.md).
First-order functions use native calls and
isolated local frames, with explicit binding and resource limits. A 64 MiB
temporary arena reports exhaustion without
narrowing or wrapping.
A [locally retained unsigned Linux package experiment](tests/distribution/EXECUTION.md)
pins an earlier compiler source and records installation in a bounded copied
userland. It is not a published release or a current-source installation result.
Explicit `from naja.core import i64` selects a separate checked-i64 slice;
mixing these value domains is still unsupported. `.naja` edition
2026.1 adds brace suites, transparent named sections and indentation depth markers
through the shared frontend. Unicode 17 identifier rules and canonical name
resolution preserve original source spans. The compiler rejects
unimplemented features rather than executing Python or silently narrowing `int`.
See [the seed limits](bootstrap/README.md) and
[frontend limits](bootstrap/frontend/README.md).

An explicitly imported integer-literal capability lets eligible user classes
construct exact integers from `.naja` suffix forms such as `10Parcel`.
[ADR-006](docs/decisions/0006-explicit-integer-literal-capability.md) defines this
first slice; quantity algebra, scale/affine relations and general protocols remain
open. The [150-case source proof](tests/typed-literals-source/EXECUTION_936865c.md)
retains its exact compiler source and limits.

The explicit `naja.literal.exact_literal` marker also accepts exact decimal
suffixes such as `1.25Portion`, passing native Rational values to ordinary class
constructors. [ADR-008](docs/decisions/0008-exact-decimal-literal-capability.md)
defines the lexical and expansion limits; the [202-case proof](tests/exact-literals-source/EXECUTION_6d8fb04.md)
retains its source and resource checks. General quantity algebra remains open.

Explicit `naja.numeric` imports provide bounded exact `rational`, `divide_exact`,
`numerator` and `denominator` operations. Fractions use native arbitrary integers,
positive denominators and reduced results. Mixed Int/Bool arithmetic and exact
comparisons are supported; ordinary `/`, Rational printing, full hashing and
general numeric protocols remain open. [ADR-007](docs/decisions/0007-exact-rational-foundation.md)
and the [native contract](tests/rationals/CONTRACT.md) define the limits.

Inclusive integer intervals check Int and Bool values against signed bounds of
any size. `from naja.numeric import checked_int` works in both dialects, and
`.naja` local annotations such as `age: (1 to 40) = value` check every
assignment to that name. Known constants and wrong literal kinds are refused at
compile time, while everything else is checked in native code; copies and
arithmetic results are not refined. [ADR-009](docs/decisions/0009-inclusive-integer-intervals.md)
defines the limits; the [source proof](tests/intervals-source/EXECUTION.md)
retains its checks. Decimal, Float and Rational intervals, named refinement
types and refined fields or parameters remain open.

With the pinned Rust seed, a working platform linker/SDK and the locked packages
available locally (one-time development preparation: `cargo fetch --locked`):

```sh
cargo build --workspace --locked --offline
cargo test --workspace --locked --offline
cargo run --locked --offline -p naja-seed -- check tests/native/fixtures/sum.py
cargo run --locked --offline -p naja-seed -- build tests/native/fixtures/sum.py --target x86_64-unknown-linux-gnu --output target/readme-sum.elf
cargo run --locked --offline -p naja-seed -- check tests/native/fixtures/integers.naja
```

The emitted file targets **Linux x86-64**, including when compiled on Windows.
Run it only on that target after granting execute permission. For automated
execution tests on Windows with Ubuntu WSL or Linux x86-64:

```sh
node scripts/test-native.mjs
node scripts/test-hosted.mjs
node scripts/test-hosted-language.mjs
node scripts/test-dynamic.mjs
node scripts/test-functions.mjs
node scripts/test-index.mjs
node scripts/test-values-language.mjs
node scripts/test-functions-language.mjs
node scripts/test-index-language.mjs
node scripts/test-project-cli.mjs
node scripts/test-cli.mjs
```

The CLI also builds and executes programs with `naja run SOURCE`; on Windows,
select the local Linux adapter explicitly with `--runner wsl`. `naja test PATH`
runs deterministic program-file discovery, supports native comparison assertions,
and provides bounded, lossless machine reports. See
[execution limits and options](tests/cli/README.md). This does not yet provide
the complete HATCH test framework or native Windows/macOS application execution.

`naja doctor --json` reports declared capabilities and limits; an explicit runner
option checks local preparation separately from program execution. `naja init
NEW_DIRECTORY` creates a validated manifest, ordinary native example and
program-file smoke test without executing them. Existing targets are refused.
See [the project CLI workflow](tests/cli/PROJECT.md) for empty-PATH compilation
checks, creation limits and the distinction from clean-host installation.

`--project-root PATH` explicitly activates the owning `.naja` project's optional
comparison/print/len aliases on check/build/run/test. Conventional spellings still
work. No ambient alias search occurs; `.py` explicit activation is rejected.
The bounded schema-1 `naja.toml` parser validates the explicit project and rejects
unavailable capabilities; dependency resolution remains incomplete. See
[the source foundation](docs/decisions/0005-native-values-and-project-alias-activation.md)
for annotation behavior, semantics and remaining limits.

The commands above were executed on Windows x64, with ELF execution in Ubuntu
WSL. This is not a clean-host installation or macOS support claim. Node is used
for development verification; emitted programs use Linux system calls and do not
invoke Node, Python, Rust, an external linker or LLVM.

NAJA targets at least 75% less task-specific code through its standard library;
the comparison suite is under implementation. No code-size advantage or reduction
in development time has been measured. The complete scope remains 139 mandatory
inherited requirements, 8 future objectives, 38 tasks and 19 release gates, plus
the additive revision 1.3 foundations and FC1 acceptance checks. See
[START_HERE](START_HERE.md), [state](planning/state.json), and
[the handoff](launch/HANDOFF.md) for current evidence and remaining work.

Licensed under [Apache-2.0](LICENSE), selected by the owner for this project.
