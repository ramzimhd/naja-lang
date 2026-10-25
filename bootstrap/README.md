# Experimental seed status

The pinned Rust 1.97.1 seed builds `naja-frontend`, `naja-native` and `naja-seed`.
Four pinned temporary Rust packages provide Unicode 17 identifier and NFKC tables;
[their dependency review](../compatibility/unicode/README.md) records versions,
licenses, checksums and conformance tests. The Rust compiler's own implementation
dependencies are temporary seed infrastructure. Building Rust
from source is outside NAJA's mandatory chain. The seed build uses the host SDK
linker; generated Linux ELF files use the independent emitter instead.

`naja lex` produces original-source byte spans and lossless tokens. `naja check`
checks the experimental executable subset. `naja build` emits a fresh Linux x86-64
ELF file and never executes source. `naja run` and program-file `naja test` execute
compiled code on Linux x86-64, with an explicit WSL adapter on Windows. See
[CLI execution](../tests/cli/README.md). Commands not shown by `naja --help` are not
implemented. The frontend's logical-line CST and suite metadata are not a complete
grammar parser. `.naja` selects edition 2026.1; `.py` retains the separate
compatibility dialect. Both use the same frontend implementation.

`naja doctor` reports declared host/target and resource facts without loading an
ambient project. `--runner direct|wsl` explicitly requests bounded preparation;
the report distinguishes preparation from executing source. `naja init
NEW_DIRECTORY` exclusively creates three checked project files under an existing
ordinary parent, with no automatic execution or dependency installation. See
[the project CLI checks](../tests/cli/PROJECT.md).

## Executable subset

Without an initial core import, ordinary decimal integer literals and inferred
assignments use native immutable multi-limb values. Text, bytes, booleans and None
also execute through the shared parser and native tagged-value emitter. Unary
`+`/`-`, binary `+`/`-`/`*`/`//`/`%`, comparisons/chains, not/and/or, truthy `if`/`else`,
`while`, `print` and text/bytes `len` are supported. `assert` accepts a truthy
expression, always executes when reached and reports `NJA204`/exit 104 on failure.
It is not an assumed optimizer contract or recoverable exception implementation.
Integer spelling never
passes through a fixed-width or floating-point representation. Definite
initialization intersects conditional paths and assumes a loop may execute zero
times. Unicode names use canonical NFKC symbol keys; keywords retain raw spelling.

In `.py`, the supported `name: int = expression` annotation is informational.
In `.naja`, it checks Int/Bool at every assignment without conversion or narrowing;
other implemented kinds report type exit105. Other annotation kinds and general
type resolution remain unsupported. Text/bytes addition concatenates, Bool
arithmetic produces Int, and/or return operands and comparison chains evaluate
middle operands once. See [ADR-005](../docs/decisions/0005-native-values-and-project-alias-activation.md)
for exact semantics and explicit project alias activation.

The hosted runtime initially uses a 64 MiB arena for values and output buffers,
with no reclamation. Exhaustion/mapping failure reports `NJA203` and exits 103.
This preserves integer values within the explicit resource budget and is not the
final memory manager. See [the native backend](../backends/native/README.md).

Ordinary Int/Bool floor division and remainder use exact multi-limb native
arithmetic: the quotient rounds toward negative infinity and a nonzero remainder
has the divisor's sign. Operands evaluate left to right and remain immutable.
The three multiplicative operators share precedence and associate left to right.
Zero division reports `NJA206`/exit106; unsupported operands report type exit105.
General division is bounded to one million normalized numerator/divisor limb
pairs per operation; exceeding it reports a distinct `NJA203` work error/exit103.
Single-limb division is linear and arena-bounded. These failures are process
diagnostics, not catchable language exceptions. `/` and fixed-i64 division remain
explicitly unsupported; no truncation or float substitution is performed.

Top-level ordinary-value functions accept plain positional parameters and exact
arity calls to themselves or earlier definitions. Return exits through native
frame cleanup; bare return and fallthrough produce None. Calls can be standalone
statements, and `pass` performs no work. Parameters and locals occupy independent
128-slot frames. Branch initialization follows paths that can reach a read;
returning branches do not require a later local to be initialized. The same
function parser handles `.py` indentation and `.naja` braces/depth/named groups.

This first-order slice resolves functions statically and rejects nested/later
definitions, global variable reads, function rebinding/values, defaults, keywords,
variadics and parameter/return annotations. Builtins used inside functions cannot
later be rebound by a module/local assignment or another definition. Unsupported
binding forms are rejected before source executes. Full Python binding and
function semantics remain required. Native execution has explicit 256-active-call
and 2 MiB source-stack limits, with a 4 KiB helper reserve, in addition to the
64 MiB shared arena. These are temporary seed/runtime bounds; see
[native calls](../tests/functions/README.md) for the OS stack assumption.

Top-level ordinary classes support method-only bodies (or `pass`), an optional
`__init__`, positional construction, per-instance attributes and native method
dispatch. Methods declare a receiver as their first ordinary parameter. Class
and method suites share the same frontend; `.naja` class/method/control depth
markers count each enclosing header. Constructors use completed class metadata
for exact arity, including calls from an earlier method to a later initializer.
Class names are static bindings; class/function values, rebinding and forward
class references remain unsupported. Class-context private names (`__name`
without a trailing `__`) are diagnosed until contextual name mangling is
implemented; outside-class private spelling and string data stay unchanged.
Method names occupy their class rather
than the module namespace. Local parameters can shadow class names as values.

Member names use canonical Unicode keys, so equivalent spellings address the
same field. Fields retain descriptors and reference identity across aliases,
parameters, returned objects and cycles. Assignment evaluates VALUE then OBJECT;
method receiver/member resolution occurs before arguments, which then evaluate
once left to right. A selected method remains selected across argument effects;
dynamic arity errors follow those effects. Initializers must return None.
Missing attributes and unsupported bound-method extraction use `NJA210`/exit110;
noncallable fields, wrong kinds and unsupported object operations use type105.
Plain objects are truthy and equality uses identity. Display, ordering, numeric
and sequence operations remain unsupported. Classes/methods/fields each cap128,
static member names cap1024 and effective member keys cap256 UTF-8 bytes; existing
global arena, stack, node, depth, literal and function limits remain unchanged.
Inheritance, class attributes, other special methods, descriptors, decorators,
partial classes and extensions remain required work. See
[the frozen object contract](../tests/objects/CONTRACT.md) and
[prepared source suite](../tests/objects-source/README.md) for evidence boundaries.

Text/Bytes postfix indexing evaluates the sequence and exact Int/Bool index once
in order. Negative indices count from the end; Text returns one Unicode scalar
as Text, while Bytes returns an unsigned Int in 0..255. Oversized indices remain
exact and report `NJA207`/exit107 instead of narrowing or wrapping. Text views
retain their immutable backing storage. Indexing binds above unary arithmetic
and chains left to right; slices and multidimensional indices are explicitly
unsupported. See [native indexing](../tests/index/README.md) for the span checks,
UTF-8 validation and unchanged arena/stack limits.

Parenthesized tuples use `()` for empty, `(value,)` for one element, and
`(a, b, ...)` for up to 128 elements; `(value)` remains grouping. A trailing comma
is allowed. Elements evaluate once from left to right and retain their original
descriptors. Tuples support `len`, truth/not/and/or and exact signed indexing,
including nested tuples and tuples returned by functions. They share the existing
arena, expression depth, literal and node limits. Bare comma tuples, unpacking,
starred elements, iteration, slices and the `tuple()` constructor are not yet
implemented. Tuple display, comparisons and numeric operations explicitly report
type exit105; they remain required semantic work, not permanent exclusions.
See [native tuples](../tests/tuples/README.md) for lifetime and guard boundaries.

List literals use `[]` or `[a, b, ...]`, with an optional trailing comma and a
128-element bound. Lists support `len`, truth/not/and/or, exact signed indexing
and replacement of an existing element. Their count is fixed in this initial
slice. Assigning `sequence[index] = value` evaluates the value first, followed
by the sequence and index, each once. Nested and function-returned subscript
targets work. Aliases and function parameters share mutations; stored values
retain their original kinds. Tuple/Text/Bytes mutation reports type exit105,
and list index bounds report exit107 before a store. Ordinary value expression
statements evaluate and discard their result through the same native emitter.

Self/indirect list cycles are possible and shallow operations remain bounded;
the temporary arena does not reclaim them. Display, comparisons and arithmetic
involving lists explicitly report type exit105. Resizing, append, slices,
augmented subscript assignment, unpacking, comprehensions and iteration remain
required work. These partial operations do not establish full container
semantics, a memory manager, FC1 or HATCH acceptance.

Explicit module-header imports expose four initial native APIs:
`from naja.io import read_bytes, write_bytes` and
`from naja.text import encode_utf8, decode_utf8`. Both source dialects share
these bindings. Imports precede definitions and executable statements; `as`
aliases, Unicode names and parenthesized lists with trailing commas work.
There are at most 128 canonical import bindings. Distinct aliases for the same
API are allowed; duplicate bindings, rebinding, late/nested imports and unknown
modules/APIs are diagnosed. Function parameters may shadow imported names, but
calling a local value remains unsupported. Imports bind static APIs and perform
no IO during check/build. There is no ambient filesystem module search.

`read_bytes(path)` returns Bytes. `write_bytes(path, data)` exclusively creates
a new file and returns None; PATH then DATA evaluate once in ordinary call order.
`encode_utf8(text)` and strict `decode_utf8(data)` return immutable descriptor
views, preserving Unicode and NUL without normalization. Files are bounded to
16 MiB and paths to 4095 UTF-8 bytes with no embedded NUL. Conversions use the
unchanged arena limit rather than the file-size cap. Known type/path/size
failures precede creation; later OS failures may retain a partial owned file.
Native IO errors exit108 (`NJA208`), invalid conversion exits109 (`NJA209`),
resource errors exit103 and wrong kinds exit105. These are process diagnostics,
not catchable exceptions. Ordinary OS permissions and parent links apply.
See [the frozen native contract](../tests/files/CONTRACT.md) and
[source checks](../tests/files-source/README.md) for syscall, growth, cleanup
and evidence limits. General modules and complete IO remain required work.

An initial `from naja.core import i64` instead imports the compiler-provided checked
signed 64-bit primitive. This is not a general module resolver or delivered
standard library. Top-level declarations require `name: i64 = expression`.
Declarations must precede their uses and cannot occur inside suites. Later
assignments can occur inside suites. `print(expression)` prints one decimal i64
and a newline. There is no imported Python module or runtime.

In that fixed-width slice, every literal expression must explicitly construct `i64(signed_decimal_literal)`;
an import or annotation never changes the semantics of an ordinary integer.
Bare hosted-integer expressions and mixing domains are rejected in the fixed-width
slice, including in annotated declarations.
Expressions support these checked constructors, local variables, parentheses,
unary `+`/`-` and binary `+`, `-`, `*` with their usual precedence and left
associativity. Conditions require one signed comparison (`==`, `!=`, `<`, `<=`,
`>` or `>=`). `if`/`else` and `while` support indented suites or one supported
simple statement on the header line. `.naja` also supports brace suites, optional
single-line block labels, transparent named sections and checked `:(depth)`
markers on indentation suites. Named sections preserve enclosing variable scope;
they add no native instructions. Nested delimiter systems follow
[ADR-003](../docs/decisions/0003-language-edition-2026-1.md), including each nested
indentation header's physical baseline. Empty suites and `elif` remain unsupported
by this executable subset. Arithmetic overflow emits `NJA201` to
stderr and exits 101; stdout failure emits `NJA202` and exits 102. Error-message
writes are best effort. Writes retry EINTR and handle partial transfers; broken
pipes may terminate under Linux's default SIGPIPE policy.

This subset does not implement nondecimal hosted literals, division, floats,
repetition/conversion protocols, functions/classes, containers, recoverable
exceptions or general imports. Syntax outside the subset produces an English
diagnostic; rejection of a valid standard-language form is an implementation
limit and does not redefine the promised language. Unicode string/comment data
is retained. Unicode 17 identifiers, original spans, scalar text operations and
canonical names are supported within this slice. NAJA-only suite forms and
explicit alias activation are rejected in `.py`. `.naja` aliases require an
explicit validated owning project root; strings/comments/variables are not
textually replaced. Full manifests, dependency ownership and caches remain open.

Limits: UTF-8 source at most 1 MiB, 128 initialized locals, 128 expression tree
levels, 64 suite levels and 10000 statements/operations. There is no runtime loop
quota or sandbox: a source loop can run indefinitely and code executes under the
user's OS rights. Tests use an external five-second timeout. These temporary
compiler limits do not narrow the final HATCH requirements.

The temporary seed reserves a capped 8 MiB compilation-worker stack per call,
plus OS thread overhead, so caller/main-thread defaults do not reduce the stated
depth bounds. Workers are joined before returning; generated programs do not
create them. Source input must be a regular file, and explicit project ownership
is checked before reading it. Windows device/network namespaces and alternate
streams are unsupported. Filesystem checks assume stable paths rather than
hostile concurrent mutation. Actual CLI boundary tests include a private named
pipe or FIFO and the advertised maximum/over-limit depths.

## Independent emission and verification

The backend emits instructions, patches local relative branches/calls and builds
ELF64 headers directly in Rust. Output has one read/execute segment and a
read/write non-executable stack declaration, no ELF interpreter or shared-library
dependency. Locals and expression temporaries live on the Linux stack; hosted
objects use an additional non-executable read/write arena. There is
no external assembler/linker, C translation, source interpreter, cached answer
or embedded seed used to run the emitted program. This remains seed-language code;
NAJA source porting and B1/B2/B3 are unimplemented.

`cargo test --workspace --locked --offline` tests frontend and compiler failures.
`cargo build --workspace --locked --offline` followed by
`node scripts/test-native.mjs` executes real emitted code on Linux x86-64, or
Ubuntu WSL from Windows. The harness preserves artifact hashes, tests runtime
control flow, boundaries, overflow, output failure, Unicode paths, rejection
before output creation, overwrite refusal and deterministic output. Fixtures are
not DX01–DX06 productivity comparisons. Equivalent block styles additionally
compare unsigned ELF bytes. No performance or timing claim follows.

`node scripts/test-hosted.mjs` independently tests native arithmetic against
Node BigInt and injected defects. `node scripts/test-hosted-language.mjs` tests
ordinary source through the shared frontend, checker and emitter. Neither Node
nor Rust is invoked by generated programs. One-time seed package acquisition
uses `cargo fetch --locked`; ordinary checks then run locked/offline. The older
`bootstrap/manifest.json` and independence report retain their pinned historical
source and must be revalidated for this expanded closure.

Reference sources consulted on October 24, 2026:

- [Intel architecture/instruction manuals](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html).
- [Linux write behavior](https://man7.org/linux/man-pages/man2/write.2.html).
- [System V ELF program headers](https://gabi.xinuos.com/elf/07-pheader.html).

The older Linux Foundation ELF mirror denied automated access; it was not used
as verification evidence. There are no copied third-party implementation sources.

## Bounded mapping source slice

The shared expression parser lowers {} and {key: value} dictionaries, {element}
sets, an unbound zero-argument set() and mixed in/not in comparison chains.
Dictionary pairs evaluate KEY then VALUE before insertion; indexed assignment
evaluates VALUE then CONTAINER then KEY. Operands are evaluated once and mixed
chains retain their original middle operand while short-circuiting. Existing
comparison-only source keeps the prior CompareChain IR. Brace expressions remain
distinct from control suites and named sections in both dialects.

Explicit from naja.collections import keys_snapshot binds a one-argument API
returning an immutable Tuple snapshot of first key descriptors in insertion order.
It does not implement Python dict.keys() views. Static canonical imports, aliases
and arity use the existing module-header machinery; no ambient loader is added.
A local, parameter, import, function or class set binding wins over the builtin.
Project aliases cannot use canonical set, including its NFKC equivalents, just as
print/len are reserved builtin spellings; set is not an alias target in schema1.

Native mappings have128 entries, exact Int/Bool/Text/Bytes/None keys and a
separately preregistered cumulative1,000,000-unit key-work limit per operation.
Text/Bytes key data is never normalized. Unsupported key kinds diagnose even in
empty containers; missing keys exit111. Full hashing, iteration, resizing, deletion,
structural equality/display and complete container protocols remain required.
Read tests/mappings/CONTRACT.md for exact validation, debit sequence and errors.
Existing arena/stack/source/literal/node/function/call limits are unchanged.
The independent202-case source preparation is frozen; execution must retain its
actual integrated source SHA and results rather than borrowing backend proof.
