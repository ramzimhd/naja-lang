# 03 — Language, Capability Profiles and Compatibility

## General contract

One language, multiple declared capabilities. Python supplies familiar source forms; implementation is NAJA. Maximum compatibility remains an objective, but no universal conformance claim is allowed without a bounded reference and evidence.

The working grammar reference is Python 3.15, not a binary dependency or a commitment to adopt every future change. Verify and record the exact edition and adaptations in `compatibility/baseline.json`. Normal tests must not execute CPython as a required oracle. Use specification-based expected results and metamorphic tests; an explicitly authorized external comparison remains outside the normal build/test closure. [S01, S02, S03, S20]

| Dimension | HATCH objective | Permitted claim |
|---|---|---|
| Standard syntax | Parse all productions of the pinned grammar | Grammar coverage X/Y |
| Executable semantics | Tested HATCH set below | Explicit supported-feature list |
| Standard library | Independent NAJA library for HATCH uses | Module-by-module coverage |
| Third-party Python packages | Later audit or porting | No blanket pip compatibility |
| CPython ABI | Outside HATCH completion | Unsupported unless specifically demonstrated |
| Future Python | Versioned proposals | No automatic tracking obligation |

Parsing a construct is different from executing it. Recognized but unimplemented constructs must produce explicit unsupported-feature diagnostics, never be ignored or replaced by fabricated results.

## Mandatory executable HATCH set

Variables and permitted dynamic reassignment; `None`, booleans, arbitrary-precision hosted integers, floating-point values with declared IEEE behavior, Unicode strings and bytes; tuples, lists, ordered dictionaries and sets; expressions, comparisons, conditions and loops; functions, keyword/default arguments, closures and lambdas; classes, inheritance and ordinary methods; exceptions and `finally`; context managers; deterministic imports; iterators, generators and comprehensions; decorators; declared pattern matching; `async`/`await` and structured tasks sufficient for networking; annotations/inference without silent semantic changes.

General metaclasses, complex descriptors, unrestricted class patching, `eval`/`exec`, exhaustive introspection and native Python-extension compatibility remain separately tracked compatibility work, not a Python fallback. Their absence prevents a “100% Python compatible” claim. A compiler that only adds integers is not complete HATCH; implementing every Python package is not the present completion scope.

## Semantics that optimization must preserve

`int` must not silently become `i64`. Expose fixed-width types explicitly through `naja.core`, with checked overflow by default and named wrapping/saturating operations. Test negative floor division, exceptions, evaluation order, identity, mutation, argument defaults, closures and chained comparisons.

Aggressive floating-point transformations are explicit opt-in choices. Operator overloading, supported non-boolean comparison results and `NotImplemented` behavior must follow the declared contract. Uncertain inference uses correct native NAJA dynamic operations or an explicit profile diagnostic, not CPython. [S02, S03]

## Profiles

**hosted:** managed objects, allocations, exceptions, files, networking and modules for applications and compiler tools. Native AOT may call a NAJA runtime; native does not mean runtime-free.

**core:** no mandatory hosted OS, networking service or implicit allocator/GC. Provide values, controlled memory, FFI and intrinsics. Reject unbounded allocation-dependent operations when the required service is absent. An annotation alone is not a real-time proof.

**embedded:** core plus declared board/RTOS support. Memory, interrupt and timing claims are target-specific and measured.

WebAssembly, GPU and quantum targets are capability-limited adapters, not modes that execute every language feature on every device. Manifests declare restrictions and dependencies.

## Types, ownership and safety

Strong typing, static typing and type inference are distinct. Hosted NAJA preserves dynamic flexibility. Profiles/modules may request stronger guarantees through existing annotations/configuration.

Proposed hosted strategy: reference counting with cycle collection, or an alternative justified by ADR and measurements. Close resources through explicit contexts. Native values/buffers require controlled ownership and borrowing; raw pointers need an identifiable unsafe API scope. Object layout is not the public ABI. Test cycles, allocation failures, exceptions, FFI and concurrency.

Unsafe operations require scope, rationale and preconditions. Safety decorators/context managers are compiler-recognized primitives, not trusted merely because a user function has a particular name. Do not add an `unsafe` keyword to the grammar.

Shared-access safety must be established statically or through locks, isolation or immutability. Do not claim arbitrary code is data-race-free. Publish proof limits and failure policies.

## Modules and packages

`naja.toml` declares a project; `naja.lock` pins versions and hashes. HATCH handles local dependencies, controlled archives, deterministic resolution and offline builds; a central public registry is not required. Never run package-install scripts automatically without explicit permission.

Compiler and editor share a resolver. Project aliases do not leak across dependency boundaries. Cache keys include dialect, profile, alias content, options and interface versions.

## Cells and language policy

Cells use the same frontend, names, types, objects and exceptions, not a simplified dialect. Document 18 defines interactive scope, redefinitions and valid selections. Never dedent an invalid selection or remove its parent condition to make it execute.

Official APIs, documentation and diagnostics use English. This does not remove Unicode identifiers, user-defined alias names or multilingual application data. Concise APIs may not weaken these semantics, memory rules or error behavior to meet a line-count target.
