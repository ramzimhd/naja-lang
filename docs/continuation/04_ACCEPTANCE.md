First Compiler and HATCH Acceptance
These are delivery checks, not achieved results. Allocate new stable IDs without overwriting R01–R19 or existing task/requirement evidence.
FC1 — First usable native compiler preview
The old explicit-i64 slice is valuable baseline work but does not satisfy this milestone. FC1 requires all checks below on a declared reference target (initially Linux x86-64 unless an ADR and evidence justify another). Host compiler builds on other systems are reported separately from executing generated programs on them.
ID	Required executable proof
FC1-01	Install a native compiler artifact into a clean test environment and compile/run independently supplied programs without Python, a hidden seed execution service, or cached answers. Record allowed OS/runtime dependencies.
FC1-02	Familiar variables, ordinary numeric/string/boolean values, functions, calls, scopes, conditions/loops, lists and user classes work natively with meaningful diagnostics. Do not require every hosted integer literal to be written as i64(...). Preserve inherited richer semantic obligations for HATCH.
FC1-03	Indented suites, depth markers, brace suites with no required indentation and standalone named sections execute; maps/sets/strings/regexes and mixed nesting are not corrupted.
FC1-04	Token-aware project aliases, imports and source maps work; invalid/ambiguous source is rejected and reported at the original location.
FC1-05	Typed literals and developer-defined scale/affine relations lower to general native operations; Gramme/Kilo and temperature point/delta tests pass with incompatible cases rejected.
FC1-06	Numeric constraints, checked runtime construction, custom regex captures/properties, and native Email/IP-style structured values have actual valid/invalid-input tests.
FC1-07	Partial-class directory/file enforcement and scoped extensions work without layout mutation, cross-package reopening or accidental name merging.
FC1-08	Collection/array reductions and basic shape-aware numeric operations execute; sum(1,2,4778,6), list .sum() and constrained constant conversion behave as documented.
FC1-09	Native threads and async tasks execute with defined lifecycle/cleanup, and a custom typed event has real subscription/disposal behavior. Do not mistake async scheduling for multicore execution.
FC1-10	CLI build/check/run/test/help, deterministic local module resolution and a basic installable VSIX with real shared-frontend diagnostics, build and run work on the reference target.
FC1-11	At least one native persistent-cell workflow works through the real compiler, and standalone release execution does not depend on session state. Remaining full interaction/debug/platform obligations stay open.
FC1-12	Reproducible artifact/checksums, limitations, tests, source hash, recovery checkpoint and a read-only progress summary exist. All inherited unfulfilled HATCH gates remain visibly open.


Publish FC1 only as an experimental preview; do not title it HATCH complete or imply production hardening. Completion of this table is an intermediate delivery, not the end of the retained HATCH mission.
Revised HATCH completion
All actual mandatory inherited gates R01–R19 must pass under their current documented contracts, plus the incorporated foundational additions. Preserve requirements for richer semantics, platform installations, safety/fuzzing, direct backend/linking, NAJA self-hosting, productive microkernel/application/data examples, networking, native sessions, an operational VSIX/debugger, English delivery and measured productivity. FC1's narrower reference target does not waive Windows/macOS product execution or installation requirements.

The required autonomous reconstruction proof includes B1/B2/B3 and a real compiler modification authored in NAJA and rebuilt without the seed language/LLVM being mandatory in the reference closure. Never claim self-hosting from parsing one's own source or embedding a seed binary.

For all additions, test at least the following boundary groups:
Group	Required positive and negative coverage
Block parsing	Nested/mixed suites, indentation-free braces, missing braces/labels, dictionaries/sets, comments, multiline expressions, interpolation and else/exception ownership. Equivalent spellings preserve control flow and scope.
Literals/relations	Decimal/exponent/base collisions, imports, arbitrary class names, exact scalar promotion, left-unit representation, dimension errors, relation cycles, affine points/deltas and equality/hash consistency.
Smart values	Inclusive bounds, reassignment, overflow/NaN, runtime external input, optional/repeated regex groups, bad patterns, property collisions, immutable backing storage and FFI/deserialization checks.
Organization	Disallowed partial paths, symlink/path traversal, case collisions, duplicate members/constructors, external fragments, extension ambiguity, ownership and member precedence.
Conversions	Valid/invalid constants, dynamic strings requiring explicit parsing, locale/rounding/overflow, no implicit fallback to string repetition, display only after correct numeric evaluation.
Numerical/data	Shape/type/broadcast errors, view aliasing, exact/strict vs approximate arithmetic, missing values, deterministic reductions, bounded CSV/JSONL grouping and resource failures.
Concurrency/events	Independent CPU tasks, shared-memory rules, cancellation, exceptions, bounded queues, unsubscribe cleanup, per-instance subscribers, reentrancy, UI thread affinity and actual OS capability errors.
Cells/release	Definitions, state/version retention, no automatic replay, correct selection context, interrupt/reset, live code references, no cell runtime in unused AOT builds.
Compiler trust	Generated code/source maps visible, compile-time resource limits, no undeclared IO or unverified purity/algebra claims enabling unsafe optimization.
Recovery	Fresh-agent takeover, actual ownership checks, unexpected exit, unknown quota, no fake clean/tested state, bounded retries and no paid/permission bypass.


Use general tests, property/metamorphic tests and varied inputs, not only the examples supplied here. Unsupported edge cases need explicit diagnostics and coverage; successful stubs are forbidden. Test snapshots are not runtime evidence.
Evidence and scope rules
Each result includes exact source/contract revision, target/host distinction, command, versions, exit code, sanitized log and artifact identity. A remote CI run must be checked at its actual SHA; historical summaries cannot close new requirements. Check that tests fail when an injected violation is introduced in a disposable branch.

No blanket claim of optimal performance, zero risk, complete Python compatibility, Rust-equivalent safety or universally 75% shorter code. Preserve the approved per-scenario productivity target and preregistered execution budgets. Human-task timing still requires real human observations; report unavailable evidence as blocked/not run while continuing engineering work.

If a required check fails or cannot run, it remains open. Track expansion areas (advanced scientific catalogs, full GUI frameworks, distributed actors, GPU/autodiff, full ML/agent ecosystems, external QPUs) separately, with real interfaces and bounded HATCH pilots. Do not relabel a mandatory feature as future work to ship early.
Delivery summary required from the agent
State precisely: milestone reached; implemented language edition/features; supported emitted targets; installer/CLI/VSIX artifacts; self-hosting status; interactive status; test and benchmark evidence; open/blocked gates; limitations; next task; integration owner; and the tested recovery procedure.
