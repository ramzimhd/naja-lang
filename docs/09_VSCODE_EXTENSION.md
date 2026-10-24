# 09 — Complete HATCH VS Code Extension Contract

## Deliverable and architecture

Ship a usable installable `.vsix`, not only syntax colors. GitHub release artifacts are mandatory; Marketplace publication additionally requires an authorized publisher. [S09]

Use a thin JS/TS VS Code host adapter, native NAJA LSP for semantics, native DAP/debug services and the common CLI for build/test/format/doc tasks. LSP and debugging are distinct interfaces. [S07, S08, S10] Rust implementations may bootstrap services, but their fundamental logic joins the NAJA self-hosted closure before claiming completion. The optional editor host wrapper is not a dependency of NAJA programs.

## Required features

| Area | Behavior | Acceptance |
|---|---|---|
| Installation | VSIX, toolchain selection/detection, doctor | Clean host without Python/Rust/LLVM |
| Editing | Highlighting, indentation, folding, comments, pairs | Incomplete/multiline files |
| Structure | Outline, document/workspace symbols, breadcrumbs | Actual resolved symbols |
| Diagnostics | Errors, warnings, fixes | Exact original positions after aliases/markers |
| IntelliSense | Completion, hover, signatures, documentation | Shared frontend, not canned lists |
| Navigation | Definition, references, safe rename | Multi-file changes; strings untouched |
| Formatting | Document/range formatting | Idempotence and explicit styles |
| Blocks | Validate/fix `:(x)`, inlay hints | Correct nesting and companion clauses |
| Aliases | TOML validation, completion, manifest navigation | Correct package scope |
| Projects | Init, target/profile selection, build/run/clean | Real results; no shell injection |
| Testing | Test Explorer execution/cancellation | Failed tests really fail |
| Debugging | F5, breakpoints, steps, stack, variables, stop/restart | Real native source-level stop |
| Usability | English labels/help/logs, keyboard access | Useful errors; no forced telemetry |
| Cells | Run Cell/Selection/All, inspect, interrupt/reset, export | Persistent native session, no hidden replay |

Completeness is for the supported HATCH subset and targets. Do not advertise unsupported constructs as functional completions.

## Real native debugging

Source maps link original tokens, canonical AST, native code and stops. Non-stoppable lines and untaken branches must be represented correctly. Never fabricate stack frames or variables.

Initial native instrumentation or a temporary existing debugger adapter is permissible, but final artifacts must state autonomous versus optional components and must not introduce Python. Disable side-effecting watch evaluation by default or require an explicit action.

Test nested functions, exceptions, alias source, optimized-away values, supported threading, Unicode paths, user interruption and child cleanup. Release-debug limitations are explicit; unavailable values are not fictional values.

## Trust and installation

Respect Workspace Trust: no user project execution, imports, build scripts, native plugins or network tasks simply on opening an untrusted folder. [S11] Compiler installation/selection is explicit; verify official release origin, target and checksum, support manual offline selection, and never log tokens or run opaque remote scripts.

Associate `.naja` by default. Do not globally take over `.py` or replace another Python extension; a project may explicitly opt into NAJA for `.py`.

## Targets and remote work

Execute tests on Windows x64, Linux x64 and macOS arm64; test Windows/WSL when advertised. Select binaries for the workspace execution host, not only the GUI host. Mark untested environments clearly. Users do not install standalone Node.js to run an already packaged adapter; Node/npm remain separate packaging tools. [S08, S09, S24]

## End-to-end workflow

In a clean VS Code profile: install VSIX and NAJA; create a project; obtain completion/diagnostics; apply a fix; build/run; stop at a real breakpoint and inspect a variable; run passing and failing tests; start HTTP and make a real request; close and check for orphans. Record versions, logs, target and VSIX hash. Screenshots supplement, not replace, protocol and integration tests.

## Native cells

Documents 18–19 define the full contract. Text `# %%` cells and a results panel suffice; Notebook API integration is optional and does not require Python. [S27] The controller is separate from LSP and user code runs out of the editor process.

Tag output by cell/session generation; invalidate current-result indicators after edits. Never execute on open/edit or automatically replay previous cells. Add end-to-end tests for persistent variables, invalid selections, safe redefinition, partial errors, infinite-loop interruption, reset, export and fresh release build on all announced targets.

## English and productivity

All official labels, settings descriptions, diagnostics, snippets and walkthroughs are English in HATCH. Unicode user source/data remains valid. Expose concise library APIs through genuine semantic completion, documentation and examples. Integrate supported application/data/system project templates without concealing task-specific generated code from the productivity audit. No new IDE or additional language syntax is required.
