# Initial Mission — Build NAJA HATCH 0.x

You are the lead development agent, whether Claude Code, Codex or another authorized implementation agent. This package supplies founder requirements, specifications, tasks and acceptance gates. Your mission is to implement and verify the product, not merely generate another plan.

## Authorized deliverables

Inspect and prepare/install the required development environment; create a new public GitHub repository under the real authorized identity; document the long-held idea and AI-assisted implementation honestly; develop through HATCH acceptance; deliver native distributions, an installable complete VS Code extension for supported HATCH features, native cells and concise base libraries for systems, applications and data pipelines.

Inspect actual Git/host state before writing. Do not assume a repository, tool installation or compiler exists. Preserve existing work. Proposed repository name: `naja-lang`; resolve owner and collisions before creation. If the project already exists, use prompt 06 and merge rather than restarting.

## Mandatory reading

Read AGENTS, START_HERE, documents 01–02, 12, 14 and 20–23, then relevant technical documents before each component. Read planning requirements/tasks/state and the handoff. Native cells require documents 18–19. Verify needed official references from document 17 when selecting actual versions; do not assume old examples are current installed tools.

Earlier ADAM/Python-prototype/CPython-fallback/mandatory-LLVM proposals are superseded. All examples are contracts until actually implemented and executed.

## Invariants

1. No Python dependency: no interpreter, package, transpilation, embedded runtime, required Python oracle, PyO3 or Python-based LSP/debug workflow.
2. The seed language is temporary. Independently generate/link native code and rebuild/evolve the reference core in NAJA by HATCH completion; optional LLVM is not the sole backend.
3. Preserve Python-like source forms and only the agreed optional `:(x)` and `naja.alias` extensions. Standard `.py` is not silently reinterpreted. No new networking brace syntax.
4. Automatic optimization and explicit hardware control coexist under correct semantics, memory rules and permissions. Do not silently narrow integers or claim safety from the seed implementation language.
5. Native NAJA runtime services are permitted; Python runtime services are not. Hosted/core/embedded declare different capabilities.
6. Claims of compatibility, safety and speed require scoped evidence, not automatic marketing.
7. HATCH ends only when all mandatory gates pass. A skeleton, mock debugger, fake test, opaque seed or an ignored TODO is not delivery.
8. All official project documents, prompts, comments, API docs/names, help/diagnostics, VS Code UI, examples and reports are English. Preserve Unicode/user-data capabilities and legal/raw-evidence fidelity.
9. General base libraries must achieve <=25% normalized developer-maintained task code against both equivalent idiomatic Rust and C++ on DX01–DX06. Count imports, helpers, handlers, task configuration/glue and generated-code inputs fairly; disclose reusable-library costs. Do not use code golf or inflated baselines.
10. Measure actual development/change time separately. Do not convert a line-count target into an unmeasured 4x speed claim. Correctness, safety, independence and preregistered execution/resource budgets still apply.

## Execute in dependency order

Start with a non-destructive host/workspace/account inventory. Install missing tools only from verified official sources with pinned versions, preferably user-scoped. Do not force reboot/elevation or remove sufficient existing tools. Build idempotent setup scripts and manifests.

Create the authorized new public repository only after reviewing explicitly staged content for secrets/private paths. Do not publish private conversations, unrelated code or unauthorized personal identity. Do not overwrite a same-named repository. Follow the owner's license authorization and dependency notices; Apache-2.0 is the proposed default, not permission to invent consent.

Establish state/gates and quickly implement a real vertical slice: source, parser, diagnostics/tests and the first appropriate native behavior. Use small measured architectural spikes and ADRs, not a planning loop. Implement the dependency graph and start compiler/tool porting to NAJA early.

Develop runtime/library, native targets and source maps together with semantic editor support. The VSIX must offer colors, diagnostics, semantic completion, navigation/rename, formatting, marker/alias support, build/run, Test Explorer and actual native debugging. No Python extension is required; a missing Marketplace publisher does not prevent producing an installable VSIX.

## Native networking

Implement both contractual two-line defaults and explicit event handlers:

```naja
from naja import Network
Network.App.Server.TCP(8080).run(on_receive=lambda msg: msg.data)
```

HTTP is separate. TCP is a stream: framing, bounded buffers, backpressure, error handling and clean cancellation are mandatory, not optional extras removed to shorten code.

## Compiled cells

Implement persistent native sessions, complete-cell/selection validation, correct versions/invalidation, private bounded cache, diagnostics, interrupt/reset, terminal/stdio CLI and VS Code integration/source export. Reuse the ordinary frontend; # %% is a comment and block markers retain their meaning.

No hidden interpreter/Jupyter requirement/mandatory ORC. Do not remove parent conditions, replay history, fake rollback or call process separation a sandbox. Keep `build --release` independent of session memory/controllers. Capture AOT baseline before integration and measure cold, warm and final execution separately. Port session/loading support into the autonomous NAJA closure.

## English and productive foundations

Apply the language policy across every surface, not only README. Register DX01–DX06 behavior, baselines, counting/time method and resource budgets before benchmark-driven implementation. Build reusable system/application/data APIs, including native bounded CSV and JSONL pipelines with explicit schemas/error policies. No Python/pandas or hidden foreign-framework shortcut.

Implement actual idiomatic Rust/C++ comparisons outside NAJA's user/build closure. Use equal features, normal libraries and shared negative tests. Demonstrate the 25% code target per case and controlled initial/change-task timing. Label AI-assisted timing correctly and report misses. Never drop cases, move task logic into an uncounted helper or relax budgets after results without an explicit founder decision.

## Verification and review

For each task link requirement IDs, implement positive/negative tests, execute actual commands and record commit/target/versions/exit codes/sanitized logs. Only verified evidence updates completion status. No unrun test becomes green.

Final acceptance includes clean users on three OSes, strict autonomous Linux B1/B2/B3, real VSIX/debug/cells, networking, freestanding/extension proofs, language audit, all six productivity cases and measured time evidence. The package contains 139 mandatory items, 8 future objectives, 38 tasks and 19 gates; those are scope counts, not achieved results.

Use a genuinely available second agent only with confirmed disjoint branch/worktree ownership and prompt 02. One integrator manages shared contracts and merges. Do not invent independent review.

## Responsible continuation

Make reversible documented technical decisions without asking after every file. Isolate genuinely unresolved identity/permission/cost/signing/founding decisions and continue other ready work. Never bypass protections, expose secrets, use paid cloud/QPU without permission, force-push or delete others' work.

Continue useful work within the actual session. At a real limit save a checkpoint, state, HANDOFF and RESUME with precise remaining work/commands. Do not promise activity after the session or declare completion because time/context is exhausted.

Your first response should briefly state actual host/repository findings, the first ready task and real blockers, then perform the authorized work. Do not respond only with another specification.
