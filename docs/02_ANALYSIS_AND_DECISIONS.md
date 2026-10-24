# 02 — Architectural Tensions and Initial Decisions

## 1. Familiar syntax is not an implementation

Python source forms do not provide an object model, importer or libraries. NAJA implements them independently; compatibility dimensions are measured separately. CPython implementation details are not automatically language rules. [S03]

**Decision:** a native NAJA frontend, runtime and conformance matrix. The inherited working grammar target is Python 3.15; the implementation agent must verify and pin the exact official edition, date and content hash without installing Python. This package does not assert a locally verified tool version. [S01, S20]

## 2. Dynamic flexibility and low-level control

Dynamic objects need runtime services; a kernel cannot assume an existing hosted OS. Use capability profiles of one language, not incompatible syntaxes: `hosted` with managed objects, `core` without mandatory OS/GC services, and `embedded` with an explicitly declared board/RTOS layer. Reject unavailable operations clearly. [S13]

## 3. Standard syntax, aliases and block markers

Alphabetic operators and block markers are real grammar extensions. Standard Python already permits a same-line suite following `:`. [S01] Keep `.py` standard by default and enable extensions in `.naja`. Never globally replace text or alter a dependency's dialect. Network braces in the original concept express API intent, not an additional grammar feature.

## 4. Self-hosting is not complete independence

A compiler written in NAJA that always invokes `clang`, links an opaque Rust runtime or embeds its original seed fails the independence requirement. Staged construction is a method, not proof by itself. [S04] Audit the entire build closure and provide independent native generation and linking on the reference target; LLVM remains optional.

## 5. Do not rebuild the entire software industry

Independence does not require rewriting the OS, VS Code or GPU drivers. Declare platform interfaces/SDKs separately from compiler/runtime dependencies. The VS Code JS/TS adapter remains thin; language services and debugging logic belong to standalone NAJA tools. [S08]

## 6. Concision does not remove operational obligations

TCP is a byte stream, not application message delivery, and using port 80 does not make TCP HTTP. [S12] Provide distinct TCP/HTTP facades, explicit framing, bounded resources, shutdown and errors. More generally, high-level libraries may handle complexity, but must not silently delete it from the behavior contract.

## 7. Capability and safety require evidence

Explicit machine operations need documented types, lifetimes, permissions and concurrency contracts. Compare performance with equivalent numeric types, checks and workloads. Never change permitted behavior merely to win a benchmark.

## 8. A complete foundation is not every future domain

HATCH must deliver a useful native compiler, self-hosted core, tools, base libraries, networking, VS Code, compiled cells and domain-extension demonstrations. Full production AI frameworks, vendor GPU drivers, a complete OS and real QPU access remain future objectives. Revision 1.2 additionally requires bounded native data pipelines and productivity proofs; it does not turn the microkernel benchmark into a full OS project. Only the founder may reduce mandatory scope.

## 9. Agent autonomy has boundaries

Continue ready, authorized work rather than repeatedly asking for confirmation. Do not invent accounts, permissions, a second agent or unlimited session capacity. Maintain resumable state; isolate account/elevation/cost blockers and continue independent tasks.

## 10. Reversible choices

| Topic | Proposed default | Change policy |
|---|---|---|
| Seed | Pinned stable Rust; audited dependencies | Technical ADR after a measured spike |
| Optimizing backend | Optional LLVM | Replaceable |
| Independent backend | NAJA; Linux x86-64 ELF proof | Mandatory; additional proof targets may follow |
| Product targets | Windows x64, Linux x64, macOS arm64 | Real target acceptance required |
| Parser | Own frontend; audited Rust reuse possible | No Python parser dependency |
| Network APIs | High-level facade plus low-level interface | ADR with example migration |
| `:(x)` | Nesting depth, root depth zero | Explicit interpretation, not global numbering |
| License | Apache-2.0 proposal | Owner decision before change |
| Independence/self-hosting | Founding requirements | No agent downgrade |
| Official language | English throughout | User code/data languages unrestricted |
| Productivity | <=25% task code on the approved suite | No agent relaxation after seeing results |

## 11. Risks to address early

Native demos may conceal incomplete dynamic semantics: test semantics before optimization. Late self-hosting may require a massive rewrite: compile early compiler modules in NAJA. Decorative tooling may mask unusability: design source maps/LSP early and real DAP before release. Track ambiguous aliases, lifetime errors, hidden dependencies, binary formats and public-repository security against gates, not promises.

## 12. Interactivity and compilation coexist

A fragment can be compiled before execution; Clang-Repl is a precedent, not a NAJA implementation. [S25] Use the same frontend for complete top-level cells, versioned state and ordinary AOT. Never replay history automatically. Compilation failure preserves committed user state; runtime failure may leave partial effects. Measure cold latency, warm execution and release performance separately.

## 13. Four-times-less code is not four-times-less work

The founder's 100-to-25 target is an acceptance target for equivalent selected scenarios. Count all task-specific developer-owned code and configuration, not only the attractive entry file. Permit idiomatic libraries on both Rust and C++ sides and report the stronger baseline; do not compare NAJA libraries only against manually expanded socket or boot code. Report library engineering/maintenance separately from per-application authoring.

Development time requires actual controlled work sessions, including debugging and a change request. AI-generated token counts, estimates, or line counts alone are not time evidence. If a result misses the target, improve the general library and publish the miss; do not silently change the denominator, scenario or tests.
