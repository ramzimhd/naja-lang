# ADR-004 — Native hosted-integer foundation

Date: October 25, 2026. Status: implementation decision; executable proof pending.
This is a B0 construction step, not FC1, managed-memory or self-hosting acceptance.

Ordinary hosted integer syntax must retain integer semantics. The explicit
checked-i64 backend remains available for `naja.core.i64`; adding ordinary
integers must not reinterpret an annotation/import as permission to narrow them.
The first hosted execution path will therefore use a distinct internal value IR
and a native multi-limb integer implementation. Neither internal Rust enums nor
this initial object layout become public language or FFI contracts.

Emit Linux x86-64 instructions and ELF metadata directly, using the existing
independent backend approach. Generated programs must perform their arithmetic
and control flow at runtime. They must not call the Rust compiler, an external
assembler/linker, an interpreter, a model, or a precomputed program-result service.
Rust and Node remain temporary development tools; the generated runtime routines
are source-described target primitives that must later be rebuilt/evolved through
the NAJA source closure for B1–B3.

Use immutable sign/magnitude objects with a variable number of base-1,000,000,000
limbs. Parse decimal literal digits without converting through i64, f64 or another
fixed-width scalar. Normalize zero, trim unused high limbs, and implement signed
addition, subtraction, multiplication, negation, comparison and decimal output.
Equality/comparison must operate on values, independently of allocation identity.
Native locals initially hold object references in the same declared frame budget.

An initial arena has an explicit 64 MiB allocation budget. Allocation or size
exhaustion must report a distinct resource failure before unsafe arithmetic or
memory access; it must never wrap, saturate, truncate or silently change to i64.
The arena is a temporary memory strategy and does not satisfy HATCH's memory
management, cycle collection, long-running application or concurrency contracts.
Execution remains under ordinary OS rights and external test timeouts. The arena
is a resource bound, not a sandbox or a universal per-program space guarantee.

Keep the hosted backend isolated from the fixed-i64 backend until native
arithmetic, failure and control-flow tests pass. Reject unsupported mixed types
explicitly. Add ordinary assignments/expressions through the shared lexer and
suite model; preserve original spans and existing `.py` dialect isolation.
Functions, strings, booleans, floats, containers and objects remain separate
required work and cannot be claimed from this integer slice.

Verify on Linux x86-64 or the declared Linux WSL target: values beyond 64/128 bits,
positive/negative/zero and cancellation, carry/borrow across many limbs, products,
comparison, assignment without mutation of aliases, loops and equivalent blocks.
Use specification examples, algebraic/metamorphic checks and an independent
Node BigInt test oracle where useful; no Python oracle enters the normal chain.
Exercise resource exhaustion, invalid IR/literals and output failure separately.
Report source, command, target, exit and retained logs before marking any slice
verified. This decision does not waive any L01–L15, FC1 or inherited gate.
