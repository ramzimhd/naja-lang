# 05 — Compiler and Tooling Architecture

## Reference structure

```text
.py / .naja sources + naja.toml + naja.alias
                         |
                 Lexer + lossless CST
                         |
             Canonical AST + source tables
                         |
           Names / types / effects / capabilities
                         |
                Independent semantic HIR
                         |
             MIR: control, values, memory
                         |
                +--------+---------+
                |                  |
      Independent NAJA backend   Optional LLVM adapter
                |                  |
                +-- objects / linking --+
                                        |
                         Native binary + required NAJA runtime
```

LSP, formatting, diagnostics, documentation and debugging reuse frontend services. An approximate VS Code parser must never become the semantic authority.

## Responsibilities

**Source/CST:** retain whitespace, comments, token boundaries, encodings, markers and aliases. Diagnostics and formatting map to original source positions after normalization.

**AST/HIR:** represent dynamic lookup, identity, calls, allocation, exceptions and effects. Do not assume every operation is a machine arithmetic instruction. Symbol IDs must not depend on Rust object pointers.

**MIR:** represent control blocks, values, lifetimes, memory access, unwinding/errors, calls and suspension points. Managed/native conversions are explicit and checked. Optimization passes have diagnostic disable switches.

**Independent backend:** implement instruction selection, register allocation, calling conventions, relocations and binary emission sufficient to rebuild compiler/runtime/tools. A backend that only returns a constant is an intermediate milestone, not completion.

**LLVM adapter:** optional optimization/target support behind an isolated interface. LLVM types are not public NAJA contracts. LLVM does not supply NAJA's runtime, and upstream Python-dependent builds must remain outside the required NAJA chain. [S05, S06]

**Linking:** the independent reference path resolves objects, symbols, relocations and required metadata without secretly invoking `clang`, `gcc`, `rustc` or `ld`. A declared system linker on another target does not prove strict autonomy there.

**Runtime:** independent NAJA memory, strings, numbers, collections, objects, exceptions, imports, tasks and execution services. Hiding Python inside a binary is still prohibited.

**Core:** values, memory, atomics, intrinsics and FFI without mandatory hosted services. Dependencies from core to networking or hosted runtime are forbidden.

## Target repository layout

```text
bootstrap/           # Temporary seed compiler, initially Rust if selected
compiler/            # Compiler sources written in NAJA
runtime/             # NAJA runtime and audited target primitives
core/                # Freestanding foundation
stdlib/              # Standard library, including productive high-level APIs
backends/native/     # Independent native generator
backends/llvm/       # Optional adapter
linker/              # Independent reference linking path
tools/               # Build, fmt, test, doc, package, doctor, audit
language-server/     # LSP using the shared frontend
debug-adapter/       # DAP and native debug support
editors/vscode/      # Thin JS/TS host adapter and VSIX
benchmarks/productivity/ # Equivalent NAJA/Rust/C++ tasks and evidence
tests/               # Syntax, semantics, negative, end-to-end, fuzz, bootstrap
examples/            # Only executed, release-supported examples
spec-examples/       # Clearly labeled unimplemented API contracts
docs/                # English specifications, decisions, tutorials
compatibility/       # Actual syntax/semantics/library coverage
planning/            # Requirements, tasks, state and sanitized evidence
launch/              # Checkpoints, handoff and local configuration
```

Empty directories do not count as delivered components. Audit launch material before copying it into a public repository.

## Durable interfaces

Ordinary libraries use the language, standard library and FFI; they do not need arbitrary native compiler plugins to solve application problems. Compiler extensions form a separate, explicitly trusted, versioned surface.

Progressively stabilize target/capability descriptions, diagnostic JSON, source maps, manifest/lock schemas, opaque module/extension APIs, selected LSP/DAP protocol versions, target C FFI and resource conventions. Do not freeze internal object layouts, Rust enums, all pass representations or LLVM versions. Serialized interchange formats have their own schemas and migrations.

## Native execution with dynamic services

Dynamic functions can compile to native calls into the NAJA runtime. This is independent of Python, but not automatically faster. Specializations need proofs or guards with correct NAJA generic paths. A sophisticated tiered adaptive JIT is not required for the initial autonomous backend; native cell compilation/loading is required by documents 18–19. Future `eval`/`exec` must use NAJA mechanisms, never Python subprocesses.

Inventory seed dependencies separately from OS/SDK, cryptography, drivers, editor packaging and optional adapters. Publish requirements for installation, project compilation, execution, self-rebuild and VSIX packaging. Users need no AI account or remote AI service.

## Native interactive branch

`tools/session/` contains controller/protocol/state support and a native loader; `tests/interactive/` exercises it. Reuse frontend, HIR/MIR, runtime and backend. User code runs in a dedicated process, not the editor or LSP. Respect OS loading/executable-memory protections. The autonomous Linux path also supports cells; ORC is optional. [S26]

AOT dependencies must not include cell history, session registries or REPL controllers. Candidate compilation and actual execution have distinct guarantees. Track live code references and invalidated assumptions explicitly.

## Productivity layers added in revision 1.2

Use three composable levels: ergonomic facade, reusable service/algorithm layer and explicit target primitives. High-level APIs cannot depend on benchmark-specific hidden code, Python or a mandatory cloud service. Keep resource ownership, limits, error policies and effects inspectable. Hosted data pipelines must not pull hosted services into core; microkernel convenience APIs must remain genuinely freestanding.

Test domain libraries as independent consumers of versioned core contracts. The code-size target is achieved through reusable functionality, not an increasingly magical parser. Documents 21–22 define acceptance and accounting.
