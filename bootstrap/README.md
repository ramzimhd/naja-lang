# Experimental seed status

The pinned Rust 1.97.1 seed builds three source-only crates with no external Rust
dependencies: `naja-frontend`, `naja-native` and `naja-seed`. The Rust compiler's
own implementation dependencies are temporary seed infrastructure. Building Rust
from source is outside NAJA's mandatory chain. The seed build uses the host SDK
linker; generated Linux ELF files use the independent emitter instead.

`naja lex` produces original-source byte spans and lossless tokens. `naja check`
checks the experimental executable subset. `naja build` emits a fresh Linux x86-64
ELF file and never executes source. Commands not shown by `naja --help` are not
implemented. The frontend's logical-line CST is not a complete grammar parser.

## Executable subset

An initial `from naja.core import i64` imports the compiler-provided checked
signed 64-bit primitive. This is not a general module resolver or delivered
standard library. Top-level declarations require `name: i64 = expression`.
Declarations must precede their uses and cannot occur inside suites. Later
assignments can occur inside suites. `print(expression)` prints one decimal i64
and a newline. There is no imported Python module or runtime.

Every literal expression must explicitly construct `i64(signed_decimal_literal)`;
an import or annotation never changes the semantics of an ordinary integer.
Bare hosted-integer expressions are rejected, including in annotated declarations.
Expressions support these checked constructors, local variables, parentheses,
unary `+`/`-` and binary `+`, `-`, `*` with their usual precedence and left
associativity. Conditions require one signed comparison (`==`, `!=`, `<`, `<=`,
`>` or `>=`). `if`/`else` and `while` support indented suites or one supported
simple statement on the header line. Arithmetic overflow emits `NJA201` to
stderr and exits 101; stdout failure emits `NJA202` and exits 102. Error-message
writes are best effort. Writes retry EINTR and handle partial transfers; broken
pipes may terminate under Linux's default SIGPIPE policy.

This subset does not implement hosted arbitrary-precision `int`, floats,
booleans, string execution, functions, objects, containers, exceptions, general
imports, aliases or depth markers. Syntax outside the subset produces an English
diagnostic; rejection of a valid standard-language form is an implementation
limit and does not redefine the promised language. Unicode string/comment data
is retained by the lexer. Unicode identifiers remain a clearly diagnosed missing
frontend capability. `.py` and `.naja` have the same limited executable subset
at this checkpoint, without alias reinterpretation or text substitution.

Limits: UTF-8 source at most 1 MiB, 128 initialized locals, 128 expression tree
levels, 64 suite levels and 10000 statements/operations. There is no runtime loop
quota or sandbox: a source loop can run indefinitely and code executes under the
user's OS rights. Tests use an external five-second timeout. These temporary
compiler limits do not narrow the final HATCH requirements.

## Independent emission and verification

The backend emits instructions, patches local relative branches/calls and builds
ELF64 headers directly in Rust. Output has one read/execute segment and a
read/write non-executable stack declaration, no ELF interpreter or shared-library
dependency. Locals and expression temporaries live on the Linux stack. There is
no external assembler/linker, C translation, source interpreter, cached answer
or embedded seed used to run the emitted program. This remains seed-language code;
NAJA source porting and B1/B2/B3 are unimplemented.

`cargo test --workspace --locked --offline` tests frontend and compiler failures.
`cargo build --workspace --locked --offline` followed by
`node scripts/test-native.mjs` executes real emitted code on Linux x86-64, or
Ubuntu WSL from Windows. The harness preserves artifact hashes, tests runtime
control flow, boundaries, overflow, output failure, Unicode paths, rejection
before output creation, overwrite refusal and deterministic output. Fixtures are
not DX01–DX06 productivity comparisons. No performance or timing claim follows.

Reference sources consulted on October 24, 2026:

- [Intel architecture/instruction manuals](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html).
- [Linux write behavior](https://man7.org/linux/man-pages/man2/write.2.html).
- [System V ELF program headers](https://gabi.xinuos.com/elf/07-pheader.html).

The older Linux Foundation ELF mirror denied automated access; it was not used
as verification evidence. There are no copied third-party implementation sources.
