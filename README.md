# NAJA HATCH

NAJA is a programming language project inspired by Python's readable source forms,
with independent native compilation, runtime services and explicit hardware control
as its goals. The founder has long wanted these capabilities together. Development
is AI-assisted under human direction; this does not establish independent audit,
universal compatibility, memory safety or performance superiority.

Development has started from the English HATCH 1.2 specifications. This is an early
experimental Rust seed, **not a HATCH release**. The implementation currently has
a lossless lexer/logical-line CST and a small native Linux x86-64 code-generation
spike. It does not yet parse the complete grammar, implement hosted integers,
self-host, provide native sessions, or supply an installable VS Code extension.

The native spike requires `from naja.core import i64`, explicit `i64(...)`
literal constructors and `: i64` declarations. It supports checked addition, subtraction, multiplication, signed
comparisons, assignment, `if`/`else`, `while` and integer output. It rejects
unimplemented features rather than executing Python or silently narrowing `int`.
See [the seed limits](bootstrap/README.md) and
[frontend limits](bootstrap/frontend/README.md).

With the pinned Rust seed and a working platform linker/SDK:

```sh
cargo build --workspace --locked --offline
cargo test --workspace --locked --offline
cargo run --locked --offline -p naja-seed -- check tests/native/fixtures/sum.py
cargo run --locked --offline -p naja-seed -- build tests/native/fixtures/sum.py --target x86_64-unknown-linux-gnu --output build-sum.elf
```

The emitted file targets **Linux x86-64**, including when compiled on Windows.
Run it only on that target after granting execute permission. For automated
execution tests on Windows with Ubuntu WSL or Linux x86-64:

```sh
node scripts/test-native.mjs
```

The commands above were executed on Windows x64, with ELF execution in Ubuntu
WSL. This is not a clean-host installation or macOS support claim. Node is used
for development verification; emitted programs use Linux system calls and do not
invoke Node, Python, Rust, an external linker or LLVM.

NAJA targets at least 75% less task-specific code through its standard library;
the comparison suite is under implementation. No code-size advantage or reduction
in development time has been measured. The complete scope remains 139 mandatory
requirements, 8 future objectives, 38 tasks and 19 release gates. See
[START_HERE](START_HERE.md), [state](planning/state.json), and
[the handoff](launch/HANDOFF.md) for current evidence and remaining work.

Licensed under [Apache-2.0](LICENSE), selected by the owner for this project.
