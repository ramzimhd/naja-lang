NAJA HATCH — Autonomous Continuation Mandate
Revision: 1.3 continuation addendum · 2026-10-25
Repository: https://github.com/ramzimhd/naja-lang
Audience: Claude Code, Codex, or another explicitly authorized implementation agent.
Status: Instructions and acceptance contracts, not evidence of implemented features.
1. Mission and finish line
Continue the existing NAJA implementation. Incorporate the founder's consolidated design decisions, then build and verify the first usable native NAJA compiler and its HATCH development experience. Perform implementation, tests, integration and packaging; do not finish with another plan, a mock interface, or the existing explicit-i64 demonstration.

There are two distinct checkpoints:
- FC1 — First usable compiler: an intermediate, evidence-backed product milestone defined in 04_ACCEPTANCE.md. Deliver it as an experimental preview, with precise limits, when it passes.
- HATCH completion: the inherited mandatory release requirements plus the incorporated foundational additions. FC1 is not permission to close all HATCH gates. Preserve the original end-to-end HATCH mission and continue ready work after FC1 within available execution capacity. Do not call a preview a complete HATCH release.
The first milestone creates a concrete result before the entire ecosystem is finished. Full scientific, distributed, GPU, AI and quantum ecosystems are not a license to delay that result indefinitely. Preserve their architectural requirements and existing HATCH demonstration obligations; implement bounded, real foundations before expanding their catalogs.

Work autonomously on reversible engineering decisions. Continue after a task or milestone when another authorized task is ready. Stop only at the completed mandate, a user instruction, a genuine external permission/dependency blocker with no independent ready work, or an actual execution/quota limit that cannot be handled by the available authorized tooling. Preserve a recoverable handoff before predictable limits.
2. Start from verified reality
The public main branch was read on 2026-10-25 at:

05df50551d9591036e4403e26d626ee19d1c2a15

This is a reference, not a reset target. Reinspect current Git and local changes. The reported local workspace is C:/naja; discover the actual location. Never overwrite a newer branch or another person's uncommitted changes to reproduce this snapshot.

The inspected repository has a Rust seed, a lossless lexer/logical-line CST, and a bounded native Linux x86-64 ELF implementation using explicit i64. Its handoff says HATCH is incomplete and all 19 release gates remain open. planning/state.json records an older verified source commit separately from the documentation checkpoint. Do not collapse those identifiers or present retained historical results as fresh tests.

Read, in this order:
1. Repository AGENTS.md, CLAUDE.md when present, START_HERE.md, and this mandate.
2. launch/HANDOFF.md, launch/RESUME_PROMPT.md, planning/state.json, assignments, tasks, requirements and release gates.
3. 02_LANGUAGE_CONTRACTS.md, 03_CONTINUITY_PROTOCOL.md, and 04_ACCEPTANCE.md from this addendum.
4. The specific existing design documents and implementation files needed by the next task. Do not repeatedly ingest the entire repository.
Inspect Git status, HEAD, remotes, worktrees, active owners, actual tools and CI. Verify host and emitted-target differences. Build and run the existing bounded tests before substantial changes. Do not recreate the repository, license, or working toolchain.
3. Resolve superseded instructions explicitly
Older documents prohibit all grammar extensions except depth markers and aliases. They also emphasize complete parsing of a pinned Python grammar. The founder subsequently authorized braces, named blocks, typed literals, constrained/pattern-derived types and independent NAJA semantics. This continuation explicitly authorizes documenting those changes.

Create a concise ADR and a migration table before relying on the new rules. Amend conflicting project instructions rather than ignoring them silently. Preserve unrelated security, provenance, independence, testing and acceptance obligations.
Earlier statement	New governing direction
Only :(x) and naja.alias may extend the grammar	The agreed NAJA extensions in document 02 are also permitted.
Python compatibility defines the product	NAJA is independent. Familiar syntax supports adoption; Python behavior is not its universal semantic authority.
Networking brace DSL forbidden	General brace-delimited suites are permitted; a separate networking-specific grammar remains unnecessary.
Smart types mean only validation	Validated values may expose typed, immutable extracted properties.
Unit examples require one operator handler per pair	Reusable algebra plus a declared relation derives valid operations.
Continue the seed until another checkpoint	Continue toward FC1 and HATCH, with proactive durable checkpoints, not voluntary abandonment after one task.


Keep .py parsing/support claims separately versioned and measured. Do not reinterpret supported .py programs silently to give them .naja coercions. Keep previous grammar coverage and semantic tests as historical or active obligations according to the explicit migration map; do not delete them to make completion easier. No universal Python package/ABI/semantic compatibility claim is authorized.

Do not reset the existing 139 mandatory requirements, 8 future objectives, 38 tasks or 19 gates if those are still the actual repository counts. Compute current counts from the files. Add stable feature IDs and test mappings without recycling old IDs. Changed contracts require revalidation; old evidence stays linked to its original contract revision.
4. Non-negotiable product principles
Independence. No Python, CPython, PyPy, MicroPython, PyO3, hidden interpreter, required Python script, Python test oracle, pandas/NumPy delegation, Python language server, or required Jupyter engine in the normal product/build/test path. C# is an inspiration, not permission to require .NET. A native NAJA runtime and documented native OS services are allowed. Native does not mean that every program can run without an OS or allocator.

Bootstrap freedom. Rust may create the seed. LLVM may be an optional backend. Neither may be the irreplaceable foundation of the final reference reconstruction path. Preserve the independent backend/linker path and develop compiler/library/tool modules in NAJA early. HATCH still requires the documented autonomous source closure, B1/B2/B3 reconstruction and a real compiler change implemented and rebuilt in NAJA. An embedded seed binary, C transpilation, or opaque precompiled runtime does not prove independence.

Power with simplicity. Target the control and native execution capabilities associated with C/C++/Rust and the application/concurrency ergonomics associated with C#, using Python-like readability without inheriting their runtimes. Do not claim equivalent speed, safety or compatibility without scoped evidence.

Controlled flexibility. One versioned semantic model, a small set of extensible protocols, deterministic resolution, explicit capabilities and understandable diagnostics. Project style policy can reject code; it must not secretly change what accepted code means. Avoid dozens of incompatible dialect combinations.

English. Official specifications, prompts, APIs, diagnostics, comments, examples, extension UI, public progress and release notes are English. User identifiers, aliases and data retain Unicode support. Preserve original legal text and raw evidence where appropriate.

Measured productivity. Preserve the <=25% task-owned code target against both equivalent idiomatic Rust and C++ baselines on the approved microkernel/application/data scenarios. Count helpers/configuration fairly and report library implementation cost separately. Measure development/change time separately. Neither agent timing nor fewer lines alone proves human time savings. Missing human evidence is not a pass and need not block unrelated engineering.
5. Foundation to implement
Implement the detailed semantics in document 02, including both conventional and concise forms:
Area	Required direction
Blocks	Indented suites, optional depth markers, indentation-independent brace suites, named transparent sections, source maps and editor folding.
Aliases	Project/module-scoped token-aware operator/function aliases, stable precedence, no textual replacement or import leakage.
Types and objects	Inference, generics/protocols, flow-sensitive narrowing, value/reference representations, user classes and explicit runtime behavior.
Smart values	Numeric intervals, regex constraints, named/typed captures, reusable and local structural types; native Email/IP-style objects.
Type relationships	User-defined numeric-literal construction, scale/affine relations and valid derived operators; no hard-coded Gram/Kilo identities.
Conversion	ToString, ToInt, ToDecimal, explicit failure-aware conversion, narrowly defined constant contextual conversion.
Organization	Partial classes in declared folders/files; scoped extension methods/properties without inheritance or hidden layout mutation.
Collections/data	Concise reductions, native Array/Vector/Matrix/Tensor foundations, bounded DataFrame/pipeline foundations, data interchange without Python.
Execution	Sync, async/await, native threads, structured tasks, parallel data work, synchronization and typed events.
Tooling	Native CLI, usable VSIX/LSP/debugging, native persistent cells, compiler explanations and real feature discovery.
Systems	Hosted/core/embedded capability separation, explicit hardware access, freestanding proof, no hidden OS assumptions in core.
Advanced architecture	Controlled compile-time evaluation, derivation/contracts, scientific transforms, actors, ML/agents and quantum extension points.


Do not implement a giant switch over official class names. Compiler-recognized operations must use resolved intrinsic/protocol identities. User classes should participate through the same documented contracts where safe. A user function named pure, extend, or compile_time is not automatically trusted compiler authority.
6. Scope discipline: real foundations, explicit expansion
The foundational behaviors from document 02 must be implemented as executable, tested features for the first revised HATCH compiler: braces/named blocks, aliases, classes/protocols, typed literals, bounded relation derivation, constrained/pattern-derived values, controlled partials/extensions, basic numerical collections, native concurrency/events and the existing HATCH application/data/tool workflows.

For very broad families, provide working bounded foundations and an explicit feature matrix:
- Numerical: real arrays, shape-aware vector/matrix/tensor operations, reductions, basic linear algebra/statistics/geometry and documented precision rules. Advanced solvers, sparse catalogs, GPU kernels and automatic differentiation can be separately scheduled beyond their already-required pilots.
- Applications: real TCP/HTTP, files, custom typed events, native tasks/threads and at least one actual application-input event path on a declared supported target. Do not equate custom callback tests with real OS keyboard/mouse integration. Full cross-platform GUI/widget catalogs and every OS event are expansion work.
- AI: preserve the goal of concise native ML and agent APIs and define contracts for models, tools, permissions, budgets and events. Implement the bounded numerical/extension pilots already required; do not claim a complete ML framework or local LLM inference engine from a mock response.
- Quantum: preserve the real local simulator/extension demonstration required by HATCH; remote QPU execution is an optional capability requiring explicit authorization and backend evidence.
- Compiler intelligence: deliver truthful diagnostics and a minimal inspect/explain path; advanced cost modeling, intent-driven energy tuning and general transformation engines remain tracked, not assumed available.
Create a coverage matrix for every reflection: foundational implementation, inherited HATCH requirement, or named expansion with a stable interface/ADR and reason. This is sequencing, not silent deletion. Unmet required foundations remain open. If a proposed API is not implemented, reject it clearly and document it as unavailable; never ship a successful no-op.
7. Execution order
Phase A — Protect and reconcile
Validate the repository and existing tests, check assignments and reconcile stale dependencies/statuses. Create the additive ADR/migration map, deterministic grammar examples, risk register updates, feature IDs and acceptance fixtures. Set up the checkpoint/handoff mechanism immediately. Keep this bounded: a concrete executable syntax/diagnostic test must accompany the first implementation checkpoint; do not disappear into documentation production.
Phase B — Make the frontend reusable
Extend the shared lexer/CST/parser rather than creating independent parsers for build, cells, formatting and VS Code. Implement deterministic block modes, names and source spans; preserve strings/comments/maps/sets/interpolation; add alias resolution, typed-literal recognition and constrained-type grammar. Track parsed, semantically supported, generated and executed separately.

Continue the current frontend task (historically T05) based on actual state. Do not reset verified work. Close or explicitly reconcile installation/evidence prerequisite gaps instead of falsifying dependency completion.
Phase C — Build semantic foundations
Implement resolution, values/objects, fields/methods, closures, generics/protocols and declared errors/resources. Establish native NAJA integer/decimal/float behavior. Add checked smart types, conversion rules, relation lowering, partial-class assembly and scoped extension lookup. Design HIR/MIR around typed operations, effects, ownership and shapes.

Extend real native code generation and runtime services together. Test nested scopes, recursion, cleanup, overload ambiguity, captures and failure paths, not only parser acceptance.
Phase D — Deliver executable user workflows
Deliver the basic standard library, numerical/data foundations, native tasks/threads/events, concise network programs and explicit lifecycle/resource management. Start NAJA-source compiler modules as soon as their needed subset works. Package a real CLI and extension; integrate diagnostics before building decorative editor features.

Deliver FC1 when its checks pass, publishing only truthful preview capability claims. Continue the remaining ready HATCH work.
Phase E — Complete HATCH verification
Complete platform packaging, freestanding and extension proofs, native cells and AOT independence, usable VSIX/debugging, autonomous reconstruction, adversarial tests, productivity measurements, English audit and release evidence. Add foundational feature checks alongside R01–R19 rather than treating an old green run as proof of the new language.
8. Native sessions and release isolation
Compile complete cells or valid selections to native code in a persistent process. Share the compiler semantics, including the new block styles and types. # %% remains an editor comment. Do not strip an enclosing condition to execute a selection. Do not replay effects, promise external rollback, or unload code still referenced by live objects/tasks.

Version bindings and invalidate dependent code safely. Retain/check lifetimes, interrupt/reset, error reporting, quotas on caches/resources and native debug maps. Process separation protects editor stability but is not a security sandbox.

Release builds must use source and declared build inputs only, not session memory. Do not include a cell controller or interactive dispatch overhead when unused. Measure cold compilation, load cost, warm execution and standalone performance independently. Advanced optimization must preserve ordering, numeric behavior and side effects or require explicit approved numerical policy.
9. Multi-agent operation and quota management
Follow document 03. The essential rules are:
- One active integration owner; each actual worker has a task, branch/worktree, allowed paths and acceptance tests. Do not create fictional reviewers or duplicate effort.
- Persist state before risky work and after bounded testable changes. Commit coherent reviewed work; preserve incomplete work separately with an honest failing/unverified status and a last-known-good pointer.
- Track context utilization separately from subscription/API usage, rate limits, execution time and money. Use real exposed telemetry, or record unknown. Do not infer a reset from a guessed clock.
- Reserve capacity for verification and handoff. Compact or resume using supported local client mechanisms after persisting state. Compaction does not reset usage limits.
- A second authorized available agent may take over from files/commits even without the first agent's private chat. Transfer integration ownership explicitly. Shared files do not alone implement locking.
- Use supported automatic continuation or a tested local supervisor only if available and authorized. Respect wait/reset signals and spending limits. No account rotation to evade limits, extracted API keys, unapproved paid fallback, unrestricted permissions, or busy retry loops.
- When no execution capacity remains, leave a recoverable waiting_for_quota or external-blocker checkpoint, not a false completion or a promise of invisible work.
No prompt can guarantee that a provider never terminates a session. Engineer bounded recoverability, tested resumption and honest continuity instead of claiming uninterrupted execution.
10. Evidence, progress and public collaboration
A passing check identifies the exact tested source revision or dirty-tree content hash, target, tools, command, exit code and retained sanitized output/artifact hashes. Separate the tested source revision from a subsequent report-only commit. Never attach an old log to a new implementation without qualification.

Show a compact progress update after meaningful implementation/test batches. Include current milestone, actual task, concrete feature added, checks executed, failures, next action and observed budget when available. Avoid fake percentages; use verified counts plus qualitative remaining work. Write the same durable summary to the repository's progress file so a read-only follower can track development.

Use small focused commits and explicit staging. Inspect public diffs for secrets, private paths, user data and proprietary attachments. Push verified milestones through the repository's authorized process; no force-push, destructive reset, automatic billing or unauthorized remote execution. Preserve Apache-2.0 and notices.

An independent review is independent only when a different available agent/person actually performs it. When only one agent exists, label self-review honestly. Review failure cases and requirements, not merely formatting.
11. Immediate actions
Begin now by inspecting actual repository/tool/session state, reading the mandatory files and running the retained baseline checks. Then:
1. Persist a real checkpoint schema and current integration owner; verify a basic resume path.
2. Record the additive language amendment and exact frontend examples before implementing changed syntax.
3. Implement and test the next ready vertical slice, starting with the shared frontend and brace/named-block behavior unless newer repository evidence changes the critical path.
4. Continue through dependency-ordered implementation, handing off safely when needed, until the first usable compiler and the remaining HATCH obligations are actually verified or a genuine external limit requires a resumable pause.
Do not answer this mandate only with estimates, future intentions, or a list of files to create. Perform the authorized work and retain proof.
