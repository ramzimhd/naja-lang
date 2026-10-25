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
value model, self-host, provide native sessions, or supply an installable VS Code
extension. FC1 and HATCH remain incomplete.

Ordinary decimal integers, including values beyond machine width, compile through
a native multi-limb runtime. The current operations are addition, subtraction,
multiplication, negation, comparisons, assignment, `if`/`else`, `while` and integer
output. A 64 MiB temporary arena reports exhaustion without narrowing or wrapping.
Explicit `from naja.core import i64` selects a separate checked-i64 slice;
mixing these value domains is still unsupported. `.naja` edition
2026.1 adds brace suites, transparent named sections and indentation depth markers
through the shared frontend. Unicode 17 identifier rules and canonical name
resolution preserve original source spans. The compiler rejects
unimplemented features rather than executing Python or silently narrowing `int`.
See [the seed limits](bootstrap/README.md) and
[frontend limits](bootstrap/frontend/README.md).

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
node scripts/test-cli.mjs
```

The CLI also builds and executes programs with `naja run SOURCE`; on Windows,
select the local Linux adapter explicitly with `--runner wsl`. `naja test PATH`
runs deterministic program-file discovery, supports native comparison assertions,
and provides bounded, lossless machine reports. See
[execution limits and options](tests/cli/README.md). This does not yet provide
the complete HATCH test framework or native Windows/macOS application execution.

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
