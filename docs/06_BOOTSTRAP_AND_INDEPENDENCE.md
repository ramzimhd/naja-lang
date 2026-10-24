# 06 — Bootstrap, Self-Hosting and Independence

## Five distinct independence levels

| Level | Requirement | Evidence |
|---|---|---|
| I0 — Python | No Python for NAJA tools or programs | Dependency audit and execution without Python |
| I1 — User | Install/build without Rust/Cargo/LLVM | Standalone native distribution on a clean host |
| I2 — Sources | Evolve and rebuild the core in NAJA | NAJA source closure and audited target primitives |
| I3 — Code generation | No mandatory LLVM or C translation | NAJA backend and linking on the reference target |
| I4 — Trust | Traceable, reproducible bootstrap | Seed/source hashes, stages and comparisons |

Self-hosting alone does not imply I3. Existing staged compiler builds are a precedent, not evidence about NAJA. [S04]

## Construction stages

**B0 — Temporary seed.** A compiler initially written in Rust with a verified prebuilt toolchain, implementing the subset needed by the NAJA compiler. Do not make rebuilding rustc from source part of NAJA's chain: its upstream bootstrap uses Python. [S19]

**B1 — First NAJA compiler.** B0 compiles NAJA compiler/runtime/tool sources through the independent backend. B1 genuinely executes the compiler algorithm written in NAJA; it must not contain B0 as an opaque blob or invoke it.

**B2 — Self-rebuild.** B1 rebuilds the same sources without Rust/Cargo, LLVM/Clang/GCC, Python or network access. Explicitly allowed OS dependencies remain available.

**B3 — Fixed-point check.** B2 rebuilds B3 under the same deterministic conditions. Compare unsigned artifacts after only documented allowed nondeterministic-field normalization. Never exclude code sections merely to force equality. Publish conformance results for B1/B2/B3 as well.

Core build tools progressively become NAJA. A small shell/PowerShell launcher may remain an interface, not a hidden compiler implementation. Target bootstrap primitives have auditable source/descriptions, not unrebuildable opaque libraries.

## Build-closure inventory

List every executable, library, object, table generator, resource tool and script needed. By HATCH completion the reference closure comes from NAJA sources or documented target primitives, not a frozen Rust/C++ runtime requiring its original compiler.

Combine binary imports, subprocess tracing where available, restricted environments, network observation, manifests and actual rebuilding. Searching for the word “python” is neither sufficient proof nor a substitute for tracing absolute paths and indirect dependencies.

## Targets and claims

The strict autonomy target is **Linux x86-64 ELF**. Product distributions must also install, compile, run, edit and debug on **Windows x64 and macOS arm64**, with real execution tests.

Report I1/I2/I3 separately for Windows/macOS and identify platform SDK/linker requirements. Passing Linux does not verify strict autonomy on another OS. Extending I3 to all targets remains separately tracked.

Demonstrate a real compiler change written in NAJA, followed by rebuilding and a new test without modifying B0. Independence must support evolution, not merely repeat a frozen build.

## Exclusions and host adapters

No requirement to bootstrap from zero executable bits, reconstruct the OS/firmware/VS Code or implement every vendor GPU backend. A traceable seed is an acknowledged starting point.

The thin VS Code JS/TS wrapper is a host adapter with separate packaging tools. Language services, formatting, resolution, tests and fundamental debugging logic must not be duplicated in it. VSIX packaging is not part of a claim that the entire software world rebuilds without JavaScript.

## Required implementation evidence

Produce `bootstrap/manifest.json`, `bootstrap/README.md`, `artifacts/bootstrap/B1..B3/manifest.json`, `reports/independence.json`, idempotent verification commands, process traces and an allowed-dependency list with justification. Keep the historical seed available for investigation, but not mandatory for every new version or contributor.

## Interactive closure

Cell compilation, loader, controller, protocol, invalidation and required cache support are part of the autonomous Linux closure. A NAJA wrapper around mandatory ORC or opaque Rust code is insufficient. T33 extends T22 before T23/B1–B3. After rebuilding, run a native session without seed tools. This does not make interactivity mandatory in delivered applications.

## Productive standard-library closure

New foundation libraries and benchmark-facing APIs must be buildable under the same rules; do not reintroduce Python/pandas or a mandatory Rust/C++ framework behind a short facade. Third-party Rust/C++ comparison implementations are benchmark-only tools, not NAJA user or self-rebuild dependencies. Keep their toolchains outside the clean-room proof.
