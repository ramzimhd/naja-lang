# Independent native seed backends

`naja_native::dynamic::emit_elf` adds native int, UTF-8 text, bytes, bool and None
descriptors with shared integer kernels, truthiness, short-circuit operands and
typed operation failures. Its supported semantics, private layout, temporary
arena limits and native tests are documented in [dynamic values](../../tests/dynamic/README.md).

`dynamic::emit_program` adds direct first-order native calls with independent
128-slot frames, positional arguments, return and None fallthrough. The private
ABI, separate call/stack budgets and executed tests are documented in
[native functions](../../tests/functions/README.md). Existing slice-based
`dynamic::emit_elf` remains functionless and rejects calls/returns.

`dynamic::Expression::Index` adds exact integer/Bool indexing for immutable Text
and Bytes, with Unicode-scalar Text results and unsigned byte Int results. See
[native indexing](../../tests/index/README.md) for bounds, view lifetimes and
executed checks. This does not add slices or collection indexing.

`dynamic::Expression::Tuple` adds bounded immutable tuples with shallow len,
truthiness and exact indexing. Tuple display, comparison and arithmetic remain
explicit type errors. See [native tuples](../../tests/tuples/README.md) for the
private array layout, limits and verification scope.

The original `naja_native::emit_elf` keeps the explicit checked-i64 IR and overflow
policy. `naja_native::hosted::emit_elf` accepts a separate hosted-integer IR with
`Integer(String)`, locals, negation, addition/subtraction/multiplication, signed
comparisons, assignment, printing, `If`, `While` and transparent `Group`. No
implicit fixed-width/hosted mixing is introduced. Both return actual Linux x86-64
ELF bytes without invoking a compiler, assembler, linker or interpreter.

The hosted IR takes optional-minus ASCII decimal strings. Every digit is
preserved; only chunks of at most nine digits are converted into u32 limbs.
The full integer never passes through i64 or floating point. A frontend must
normalize other supported source literal spellings separately, without narrowing.
Invalid literals, out-of-frame/uninitialized locals and resource-exceeding IR are
rejected before ELF emission. Definite initialization intersects both conditional
branches and does not assume a loop executes. Groups preserve the same frame.

## Temporary hosted runtime

Read-only literal objects and newly allocated immutable values contain a sign,
limb length and base-1,000,000,000 little-endian u32 limbs. Zero has sign/length
zero; results trim unused high limbs. Assignment shares immutable references;
negation and arithmetic never modify their input objects. Magnitude add/subtract
propagate carry/borrow; schoolbook multiplication uses bounded u64 intermediates.
With each input limb below 1e9, product + old limb + carry is below 1e18, within
that intermediate. This representation preserves full multi-limb integer values.

Generated entry code requests a fresh 64 MiB anonymous read/write mapping through
Linux `mmap`. An aligned bump allocator checks addition and arena bounds before
returning storage. Arithmetic objects **and decimal-format buffers** consume this
one budget; nothing is freed or recycled in this construction step. Repeated
printing or an allocating loop can exhaust it. Exhaustion/mapping failure reports
`NJA203: hosted integer arena exhausted` and exits 103; there is no wrap, saturation,
truncation or fallback to i64. This temporary arena is not the HATCH memory manager,
cycle collection, concurrency support or a sandbox. No runtime loop/time quota is
implemented; normal user OS permissions and external test timeouts apply.

Decimal output reads runtime limbs, handles sign and zero, pads internal chunks,
retries EINTR and handles partial writes. Other stdout failures emit `NJA202` to
stderr and exit 102. Error-message writes are best effort; Linux's default SIGPIPE
termination remains possible. Fixed text and literals reside in the RX image;
the arena is RW, never executable, and the stack declaration is non-executable.
The ELF has no interpreter or dynamic section. It still requires the Linux loader,
process stack, inherited descriptors and the mmap/write/exit syscall ABI.

`hosted/x64.rs` describes the required instruction encodings; `hosted/runtime.rs`
emits the source-described routines and patches native control transfers. Internal
helpers preserve rbp/rsp and arena limit r14, while allocation advances r15. Other
registers follow a private caller-clobbered convention. This is not a public FFI
ABI, imported opaque runtime, embedded compiler executable or result cache.

Compiler limits: 128 local references, expression depth 128, suite depth 64,
10000 IR nodes, and 1 MiB aggregate literal spelling. The seed compiler is Rust;
the runtime routines must still be ported/rebuilt through the NAJA closure for
B1–B3. No standalone release, full hosted semantics, FC1, performance or HATCH
completion follows from this integer slice.

## Verification

```text
cargo test --workspace --locked --offline
cargo clippy -p naja-native --all-targets --locked --offline -- -D warnings
node scripts/test-hosted.mjs
```

The native harness builds `examples/hosted_ir.rs`, a development-only line/RPN
adapter into the public Rust IR. It is not a NAJA grammar or product command.
Generated files are retained under ignored `target/hosted-native-*` directories.
The harness runs actual emitted ELF instructions under Linux x86-64, locally via
Ubuntu WSL when hosted on Windows, with a five-second per-artifact timeout. Node
BigInt supplies the independent arithmetic/comparison expectations. Tests include
beyond-64/128-bit and thousand-digit values, signed carry/borrow/product cases,
metamorphic identities, control flow, immutable aliases, invalid IR, exhaustion,
I/O failure, deterministic output and injected literal/carry mutants. Mutants must
be detected; they are test artifacts, never accepted project behavior.

Retain exact commit, host/target, commands, versions, exits, logs and hashes when
recording integrated evidence. The hosted-integer IR tests do not certify a
frontend parser, functions, strings, collections, general objects, modules or
another emitted OS. The separate dynamic and first-order function checks
establish only their documented backend slices.
Machine encoding references: [Intel instruction manuals](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html).
