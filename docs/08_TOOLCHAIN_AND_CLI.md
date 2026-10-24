# 08 — Toolchain, Distribution and CLI

## Commands to implement

These are future interface contracts, not commands provided by this documentation package.

| Command | Required behavior |
|---|---|
| `naja --version` | Compiler/generation/protocol version and provenance |
| `naja doctor` | Environment/capability diagnostics; no silent installation |
| `naja init` | Minimal project, manifest, example and tests |
| `naja check` | Parse/semantics/capability diagnostics without user-code execution |
| `naja build` | Native executable/library, debug/release profiles |
| `naja run` | Build and execute; preserve exit code and arguments |
| `naja test` | Deterministic discovery/execution, filters, machine report |
| `naja fmt` | Stable formatting; explicit marker/alias options |
| `naja doc` | API documentation without default project execution |
| `naja package` | Local archives/manifests and hashes |
| `naja lsp` | Language server over stdio |
| `naja dap` | Debug adapter/engine over a declared channel |
| `naja bootstrap` | Staged rebuilding and closure verification |
| `naja repl` | Persistent compiled-native terminal session |
| `naja session --stdio` | Versioned interactive controller |
| `naja cells run file.naja` | Fresh session; top-level cells in source order |
| `naja cells export file.naja --output app.naja` | Current sources, not session memory or output |

All commands have English `--help`, reliable exit codes and structured output where appropriate. Test spaces/Unicode paths, arguments after `--`, offline use and permission failures. Diagnostics have stable machine identifiers independent of prose.

## Project and dependency contracts

`naja.toml` declares schema/dialect/profile/entry point/targets/dependencies/style. It must not execute arbitrary shell commands merely because the editor opens a project. Explicit executable tasks require a separate trust-aware mechanism.

`naja.lock` pins exact resolution/hashes with reviewed changes. Offline builds use locally available archives/sources. Do not disguise domain-specific application logic as uncounted manifest settings; benchmark-specific settings are included in productivity accounting.

## User distributions

Ship target-specific archives or user installers containing compiler, required NAJA runtime/libraries, LSP/DAP, navigation API sources, tested examples and licenses. Supported `init/build/run/test` workflows need no Python, Rust or LLVM installation.

Declare OS libraries, permissions, advanced SDK needs, drivers and platform signing rules. Unsigned artifacts must be labeled unsigned. Hashes verify integrity but do not alone establish publisher trust; do not invent a certificate, notarization or account.

## Bootstrap tooling

Pinned Rust/Cargo may start the project. Audit native dependencies and binding generators for indirect Python usage. Isolate backend interfaces from crates/LLVM versions. Auxiliary fuzz/benchmark tools may remain outside distributed user and autonomy closures.

Separate language, compiler, protocol, library and VSIX versions. HATCH changes require notices and migrations. Stabilize contracts after actual self-hosted and independent-library consumers, not by declaration alone.

## Interactive distribution

Follow document 18: no Python/Jupyter, local private control transport, explicit execution and private caches. Ordinary release applications do not require the interactive component. A normal build must never consult session history for missing variables.

## Productivity-supporting tooling

Offer small documented application/data/system templates using the same public APIs, English diagnostics and schema help. Keep setup small and reproducible. Generated task-specific sources count as maintained code unless regeneration fully owns them under the explicit policy in document 22; always disclose generated footprints.

Formatting must optimize readability, not benchmark scores. Do not introduce line-packing options, automatic hidden helper imports or code generation solely to make examples appear to satisfy the 100-to-25 target.
