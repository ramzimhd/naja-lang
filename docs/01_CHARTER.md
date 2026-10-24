# 01 — NAJA HATCH Founding Charter

**Package revision 1.2 · October 22, 2026 · Specification, not a completed implementation.**

## Mission

NAJA is an open-source, general-purpose, cross-platform, multi-paradigm programming language project. It targets the native capabilities and hardware control of C, C++ and Rust with Python-like readability and flexibility. Python inspires the source language; NAJA owns its compiler, runtime, types, objects, libraries and execution.

The long-term vision includes applications, websites and services, operating systems, firmware and IoT, numerical computing, AI, GPUs, robotics, distributed computing and hybrid quantum workflows. HATCH does not claim complete implementations of all these domains. It must provide a usable, independently extensible foundation.

## Founder requirements

**F01 — Independence from Python.** Installing, compiling, executing and normally testing NAJA must not require Python. No CPython fallback, Python transpilation, embedded Python interpreter or mandatory Python package. Optional third-party integrations may not enter the standard distribution's required dependency closure.

**F02 — Simplicity without an artificial ceiling.** Preserve familiar procedural, object-oriented and functional source forms. Additional paradigms use libraries, transformations and capabilities where possible. Precise low-level controls remain explicitly available.

**F03 — Two levels of control.** Safe automatic optimization by default; explicit machine types, memory, instructions and authorized resources when requested. Never bypass host operating-system permissions.

**F04 — Optional readability extensions.** `:(x)` denotes nesting depth under the documented interpretation; `naja.alias` supplies project-scoped aliases for native operators and builtins. Original standard forms remain valid. These are extensions, not claims of direct CPython executability.

**F05 — Independent evolution.** The seed language and tools must not become permanent obligations. HATCH completion requires a self-hosted NAJA build closure and a native generation/linking path independent of LLVM on the reference autonomy target, supported by evidence.

**F06 — Durable foundations.** Stabilize small, versioned, tested contracts while allowing implementation improvements and security fixes. Durability is not a promise never to change code.

**F07 — Public open source.** Publish an authorized public GitHub repository, license and notices, contribution guidance, decision history, honest implementation status and traceable releases.

**F08 — Usable development tools.** Provide an installable VS Code extension with compilation, diagnostics, navigation, formatting, testing and real debugging. Do not build a new IDE from scratch.

**F09 — Concrete productivity.** Common TCP/HTTP examples take two application lines including the import. The broader standard-library target is at least 75% less developer-maintained task code than equivalent Rust and C++ implementations on the approved benchmark suite: at most 25 NAJA lines for 100 comparable baseline lines. See documents 21–22 for scope, normalization and anti-gaming rules. Reduce measured development time as a separate objective; a code-size ratio does not prove a time ratio.

**F10 — Execute the mission.** The development agent prepares the environment, creates the authorized new repository and implements through verified HATCH acceptance. Plans, scaffolds, stubs and missing mandatory gates are not completion.

**F11 — Independent compiled interactivity.** Execute complete cells/selections as native code in a persistent session, with VS Code integration and a separate release path. Ordinary applications must not inherit interactive controllers or session state. Verify the claim by inspection and measurements; do not promise zero risk or zero latency.

**F12 — English-first public project.** All official deliverables are in English: specifications, prompts, README, comments, canonical API documentation and identifiers, diagnostics, CLI help, VS Code labels, issue/PR templates, release notes and evidence narratives. This is the founder's project policy, not a universal definition of open source. Unicode source identifiers, user-defined aliases and multilingual user data remain supported according to the language specification.

**F13 — Libraries make concise code real.** Provide reusable, documented, tested high-level APIs over explicit low-level primitives. HATCH must prove concision for a bounded microkernel demonstration, ordinary applications and native data pipelines without hidden Python, hard-coded benchmark outcomes, weakened safety or silently degraded semantics. Failed productivity gates remain failed until corrected or explicitly changed by the founder.

## Public claims

Use “targets,” “planned,” “prototype,” or “supported” according to verified status. Syntax coverage, runtime behavior, library coverage and native-extension compatibility are distinct. Neither a Rust seed nor native code generation automatically proves Rust-level memory safety, C++ performance or universal Python compatibility.

The 4:1 code target applies to equivalent approved tasks, not every possible algorithm. Never claim universal four-times-faster development. Publish failures, baselines, scope and measurements as prominently as successes.

## Origin story

The founder has long wanted one language combining readable source, native power and accessible hardware abstractions. AI-assisted engineering now helps turn that idea into implementation, tests and documentation. Human direction, validation and governance remain essential. Do not invent an origin date, biography, partners, team, or a founder identity not authorized for publication.

## Name and license

NAJA is the language; HATCH is generation 0.x. ADAM is superseded. NAS, NBL, NHOM and NDEM are descriptive labels, not mandatory sublanguages.

Proposed launch license: Apache-2.0 with third-party notices and explicit contribution rules. Confirm the owner's selected license before publishing affected code if authorization is ambiguous. Name research is not trademark clearance. [S18]
