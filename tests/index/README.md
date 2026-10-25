# Native Text and Bytes indexing

`naja_native::dynamic::Expression::Index(Box<Expression>, Box<Expression>)`
evaluates its sequence and index once, left-to-right, then calls source-described
native x86-64 routines. It works through both dynamic emission APIs, including
inside ordinary direct functions. The source frontend is integrated separately.

Supported sequence kinds are immutable UTF-8 Text and Bytes. Int and Bool indices
are exact integers: False is zero, True is one, and negative indices count from
the end. Text returns a one-Unicode-scalar Text, including NUL; this is not byte
or grapheme indexing. Bytes returns an Int in `0..255`, never a signed byte or
one-byte Bytes. Other sequence/index kinds raise the existing
`NJA205: native value type mismatch`, exit105. Bounds failures, including empty
sequences and enormous positive/negative integers, report
`NJA207: sequence index out of range`, exit107. Integer division by zero retains
NJA206/106. Slices, containers, custom indexing and exception objects remain
future work; this slice does not claim their semantics.

## Exact bounds and immutable views

The shared integer representation uses sign and base1e9 limbs. Since every
sequence is limited to 64 MiB, an index with two or more canonical magnitude
limbs is provably outside the sequence; code rejects it before narrowing or
reading its limbs. A one-limb magnitude is read unsigned and compared against
the sequence count. Negative normalization checks magnitude against count before
subtraction; a final index/count check precedes every element read. Full integers
never pass through i64/floating point or wrap. Computed zero and Bool False use
the same supported shared canonical zero object as existing numeric kernels.

Text first walks the whole sequence with strict UTF-8 scalar-width checks, then
walks to the normalized position. Continuations, shortest encodings, surrogate
exclusion and the U+10FFFF maximum are checked before continuation-byte reads.
Normal Text construction already guarantees UTF-8; these checks also prevent
malformed artifact data from causing an out-of-span scalar read. Bytes indexing
uses one unsigned byte load. There is no new work cap: Text reads at most two
passes over its existing bounded byte length; Bytes is constant-time after
bounded index metadata checks. No work/resource budget was raised after a
failure.

A Text result allocates one 24-byte descriptor referencing its scalar's existing
immutable payload. Literal data is read-only in the emitted image. Arena payloads
are immutable and persist through process exit; returning from a function or
reassigning a local does not release them. Nested indexed views and aliases
therefore retain valid data. Bytes results use the existing exact small-integer
allocator. There is no GC/reclamation claim; repeated indexing consumes the
shared **64 MiB arena** and eventually reports the existing NJA203/103 arena
diagnostic. Both operands contribute to the existing 128 expression-depth,
10,000 aggregate IR-node and 1 MiB literal limits, including unused/skipped
branches. The 128-local/function/parameter, 64-suite, 256-call and 2 MiB source
stack / 4 KiB helper-reserve limits remain unchanged. Index scratch is a bounded
64-byte helper frame, with bounded nested helper calls inside that reserve.

The index helper checks addition overflow and accepts payload spans only in the
final emitted literal-data region or the currently used arena. Raw index-object
headers and single-limb reads receive the same readable-span check. Invalid spans
report `NJA203: invalid native sequence span`, exit103; invalid UTF-8 reports
`NJA205: invalid native UTF-8 text`, exit105. These are corruption diagnostics,
not ordinary language bounds errors. Region checks do not establish individual
object provenance or make arbitrary modified executables safe. Descriptor
addresses and canonical value construction remain internal compiler invariants.
No user pointer API, OS sandbox, process time quota or new external runtime is
introduced. Error-message writes remain best effort.

## Reproducible checks

```text
cargo test --workspace --locked --offline
cargo clippy -p naja-native --all-targets --locked --offline -- -D warnings
node scripts/test-index.mjs
node scripts/test-functions.mjs
node scripts/test-dynamic.mjs
node scripts/test-hosted.mjs
node scripts/test-native.mjs
```

`examples/index_ir.rs` is development-only line/RPN plumbing into the public Rust
IR, using `SEQUENCE INDEX index`. It retains the function fixture format and
input/output bounds, with create-new artifact output. It is not a product parser
or a second NAJA dialect. Existing harnesses/adapters are unchanged.

The new Node harness executes actual emitted Linux x86-64 ELF instructions,
through Ubuntu WSL on the Windows seed, with five seconds per artifact. Node
Unicode scalar arrays and unsigned byte buffers supply independent expected
values. Tests cover all UTF-8 widths and scalar boundaries, combining text,
NUL, every byte, both index signs, exact bounds, huge literal/computed integers,
Bool and arithmetic-produced zero, literal/arena views, aliases/reassignment,
function argument order, short circuit, 128-depth indexing, types and index-only
allocation exhaustion. The resource fixtures print a setup marker before
allocating only index results. Mutants exercise invalid tags, spans and pointer
overflow, truncated/invalid UTF-8, invalid raw index spans/count/negative zero,
and changed literal content. Rust tests cover both-operand validation, skipped
and unused branches, exact node/depth/literal boundaries and deterministic static
ELF structure. The shared-zero range defect found during review has dedicated
Bool/computed-zero/native regression coverage.

The Windows Rust/Cargo 1.97.1 and Node 24.11.0 seed executed **72 index checks /
2107 independent scalar and byte outputs** through Ubuntu WSL Linux x86-64.
The workspace passed **214 Rust tests**, including three new index-validation
tests. Existing function (43 checks / 294 oracle outputs), dynamic (85 / 8194),
hosted (14 / 394 arithmetic and 150 comparison outputs) and checked-i64/native
(36 checks) regressions passed. Workspace build, formatting and backend all-target
clippy also passed. GNU readelf 2.42 inspected the deterministic index artifact:
ELF64 EXEC, entry `0x401000`, one RX LOAD, RW non-executable GNU_STACK, with no
interpreter or dynamic section. These are bounded B0 backend observations.

Results and artifacts remain under ignored `target/index-native-*` and `target/`.
Evidence must retain exact commits, host/target, commands, versions, exits and
hashes. No other emitted OS, clean-host portability, performance, self-hosting,
complete indexing/runtime semantics, FC1 or HATCH acceptance follows from this
backend slice.
