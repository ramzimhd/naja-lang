# Direct first-order native function backend

This is an executable backend slice, separate from source-language function
resolution. It emits Linux x86-64 instructions and direct relative machine
calls, sharing the existing immutable dynamic-value kernels. Generated programs
do not run an interpreter, dispatch loop, host callback, assembler, linker or
compiler. The Rust seed still needs porting through the NAJA source closure.

The Rust API under `naja_native::dynamic` is:

```rust
pub struct Program { pub body: Vec<Statement>, pub functions: Vec<Function> }
pub struct Function { pub parameters: usize, pub body: Vec<Statement> }
// Additional enum variants:
Expression::Call(usize, Vec<Expression>)
Statement::Return(Expression)
pub fn validate_program(program: &Program) -> Result<(), String>;
pub fn emit_program(program: &Program) -> Result<Vec<u8>, String>;
```

Functions are identified by their index. All referenced indices must exist and
each call supplies exactly the declared number of positional arguments. Backend
indices may reference later functions, allowing direct label resolution; the
source frontend independently limits its supported declaration order. Parameters
initialize local slots `0..parameters`. Every activation has an independent
128-slot local frame. Main locals and other function locals are inaccessible.
Every function, including unused functions and all skipped branches/arguments,
undergoes validation. A local must be initialized along every path reaching its
read. Branches that return do not prevent initialization on the remaining live
path; a loop is never assumed to execute.

Arguments evaluate exactly once, left-to-right, before entering the called
function or checking its depth budget. Calls return the ordinary immutable Int,
Bool, Text, Bytes or None descriptor. `Return` exits groups/loops/remaining body
through one epilogue; reaching the end returns None. No return is permitted in
main. The existing slice-based `emit_elf`/`validate` APIs remain functionless and
reject calls and returns. Existing fixed-i64 and hosted-integer IR APIs are
unchanged. Globals, closures, function values, lambdas, defaults, keyword/variadic
arguments, exceptions/unwinding and a general type system remain future work.

## Temporary private calling convention

This is not a public ABI, FFI contract or stable serialized format. Each caller
pushes descriptor pointers in argument order, followed by a hidden context
pointer, then performs a direct relative `call`. At function entry, `[rsp]` is the
return address, `[rsp+8]` is the hidden pointer and `[rsp+16]` is the last argument.
The callee pushes the old `rbp`, sets its frame base and reserves 2048 bytes;
locals occupy offsets `-8..-1024`. It stores the context pointer at `rbp-2032`,
and copies parameters from positive argument offsets into its own locals.

The context points into main's live stack frame at `rbp-2040`, containing the
active user-call count; the preceding eight bytes contain the source-stack
floor. Nothing escapes main. The return value is in `rax`. The callee decrements
the count, restores `rsp/rbp` and returns; the caller removes its argument/context
slots. Native helpers preserve `rbp/rsp/r14`; `r15` advances for arena allocation.
Other registers are scratch. Source stack slots are eight-byte aligned; no
external ABI/SIMD call requires a 16-byte call boundary in this slice.

Before reserving a frame, code checks the current count against **256 active
user calls**. A 257th call reports `NJA203: native user-call depth limit exceeded`
and exits 103. This is not tail-call optimization; recursive calls consume the
same budget. Main is not a user call. Returning restores the count on all normal
return/fallthrough paths.

The separately preregistered **2 MiB source-stack budget** is measured below
main's initial 2048-byte frame, excluding the kernel's initial argument/env
stack. Every emitted expression/argument push and every function frame
reservation checks the common floor, keeping a **4096-byte helper reserve**.
The internal helpers have bounded, nonrecursive stack use, including the
128-byte division scratch frame. Pending arguments from nested expressions count
toward this same budget. Exceeding it reports
`NJA203: native source stack limit exceeded`, exit 103. Terminal failure paths
exit the process; they do not return into incomplete frames. Error-message
writes remain best effort.

These guards assume at least an ordinary **8 MiB available process stack**;
smaller OS limits or a large inherited argv/environment can fail earlier. The
backend does not change OS stack limits, catch stack faults, implement a runtime
time quota or provide a sandbox. The test harness supplies a five-second external
timeout. The existing shared **64 MiB arena** is not reclaimed on return; values,
arithmetic, formatting and repeated calls consume it. Its distinct diagnostic is
`NJA203: native value arena exhausted`, exit 103. Existing type/assert/zero/IO
failures retain exits 105/104/106/102. Integer division's separate work cap is
unchanged.

Compiler validation limits are 128 functions, 128 parameters/locals per function,
expression depth 128, suite depth 64, aggregate 10,000 IR nodes and aggregate
1 MiB literal spelling across main and **all** functions. Each function definition
counts as one node in addition to its statements/expressions. Empty functions
are valid; main still requires an executable statement. Call arguments contribute
their full node, nesting and literal costs.

## Executed checks

```text
cargo test --workspace --locked --offline
cargo clippy -p naja-native --all-targets --locked --offline -- -D warnings
node scripts/test-functions.mjs
node scripts/test-dynamic.mjs
node scripts/test-hosted.mjs
node scripts/test-native.mjs
```

`examples/functions_ir.rs` is development-only line/RPN plumbing into the Rust IR,
not a second NAJA frontend or product command. Main comes first, followed by
`function PARAMETERS` / `end` blocks, indexed in order. `call:INDEX:ARITY` consumes
that many existing expression operands; `return EXPRESSION` is a statement.
Other fixture operators retain the dynamic adapter conventions. Input is bounded
to 2 MiB/10,000 lines and output uses create-new, never overwriting an artifact.

The Node harness executes actual generated ELF programs on Linux x86-64 (Ubuntu
WSL when the seed runs on Windows), with five seconds per artifact. Independent
Node BigInt formulas check large arithmetic through calls, factorial, Fibonacci
and repeated-result identities. Fixtures cover nested/self calls, all value kinds,
argument order and allocation-based once-only behavior, local/alias isolation,
branches/loops/groups/early return, None fallthrough, 128 parameters/functions,
256-call success and 257-call failure, repeated depth-counter cleanup, shared
arena exhaustion, and type/assert/division failures. A nested-argument fixture
retains 1016 descriptors per recursive level: its calculated 204/205 input
boundary checks the stack budget before depth is exhausted. A smaller-floor
artifact mutant verifies that retained arguments are guarded; a function-literal
mutant changes the actual native result. Separate smaller-floor frame and
parameter-offset mutants exercise frame reservation and argument copying.
An invalid argument at active depth 256 raises its type error before the next
callee's depth check. Validation probes reject invalid unused
functions, skipped arguments, dead code, unknown indices, arity, local access and
aggregate limits. Rust tests also check deterministic static ELF structure.

On the Windows Rust 1.97.1 / Node 24.11.0 seed with Ubuntu WSL Linux x86-64 and
an observed 8192 KiB stack limit, this harness passed 43 checks and 294 independent
oracle outputs. The workspace passed 180 Rust tests, including six new program
validation tests. Existing dynamic (85 checks / 8194 oracle outputs), hosted
(14 checks / 394 arithmetic and 150 comparison outputs), and checked-i64
(36 checks) harnesses also passed. The inspected deterministic function artifact
was ELF64 EXEC, entry `0x401000`, with one RX LOAD, RW non-executable GNU_STACK,
and no interpreter/dynamic section; GNU readelf 2.42 returned success.

Artifacts and logs remain under ignored `target/functions-native-*` / `target/`.
Integrated evidence must record its exact commit, commands, target, versions,
exits and hashes. No source-frontend coverage, other OS target, performance,
self-hosting, full function semantics, FC1 or HATCH acceptance follows from this
backend slice.
