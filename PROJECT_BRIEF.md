# NAJA HATCH — Project Brief

Revision 1.2 · October 22, 2026 · English edition

Native power. Familiar syntax.
Less application code.

### Project brief and agent launch plan

English edition · Revision 1.2 · October 22, 2026

A founding specification for an independent, self-hosted programming language, its standard libraries and a complete VS Code workflow. Prepared for Claude Code, Codex or a coordinated pair of implementation agents.

| 23 specifications | 139 required items | 19 release gates |
|---|---|---|
| 6 agent prompts | 38 implementation tasks | 6 productivity cases |

### The new commitment

All official project material is English. Base libraries must target at least 75% less developer-maintained task code than equivalent idiomatic Rust and C++ solutions on the approved suite, while separately demonstrating reduced development time.

### Status

This is a launch specification, not a compiler release. No NAJA binary, VSIX, environment installation, public repository or measured productivity advantage is supplied by preparing these documents.

The complete Markdown specifications and machine-readable tracking files in the accompanying ZIP are normative. This brief is a reading guide.


## Founding decisions

NAJA should combine the practical reach of systems languages with Python-like readability and flexibility. It must not depend on Python to install, compile, execute or perform its normal tests.

| Decision | Required consequence |
|---|---|
| One independent language | Own compiler, runtime, standard library and tools; no CPython fallback. |
| Automatic and explicit control | Optimize safely by default; expose authorized memory, instructions and hardware. |
| Independent evolution | The seed language is temporary; NAJA must rebuild and evolve its own core. |
| English official surfaces | Specifications, prompts, APIs, comments, help, editor labels and reports use English. |
| Productive base libraries | Prove shorter equivalent task code and reduced measured creation/change time. |
| Evidence-based completion | Required gates, real binaries and reproducible tests—not scaffolds or claims. |

### What stays flexible

Optional block-depth markers and project aliases remain. Unicode identifiers, user-defined aliases in other languages and multilingual application data are not prohibited by the English project policy.

### What is not promised

Universal Python-package compatibility, universal Rust-level safety, C++-beating speed for every program, zero interactive risk and four-times-faster development are not established facts. Claims must name their actual supported scope and evidence.

Full OS, production AI frameworks, vendor GPU support and real quantum execution remain long-term directions; HATCH proves the necessary foundation and bounded extensions.


## Compiler architecture and profiles

```text
Source + manifest + aliases
          |
Lossless frontend and source maps
          |
Names / types / effects / capabilities
          |
Independent NAJA HIR and MIR
          |
Native NAJA backend  |  Optional LLVM adapter
          |
Native binary + required NAJA runtime
```

Formatting, diagnostics, language services and debugging reuse the same frontend. Do not create a second approximate semantic parser inside VS Code. Keep internal Rust/LLVM representations out of permanent public contracts.

| Profile | Capability boundary |
|---|---|
| hosted | Managed objects, exceptions, files, network and compiler/application tools. |
| core | No mandatory OS or hosted runtime; values, controlled memory, FFI and intrinsics. |
| embedded | Core plus a declared board/RTOS layer; target-specific resource and timing limits. |

### Native does not mean runtime-free

Dynamic code may compile to machine instructions that call NAJA runtime services. This is permitted. Calling a hidden Python interpreter is not. Uncertain optimization must preserve semantics rather than silently narrow types or remove checks.

### Durable boundaries

Version small source, module, diagnostic, capability and extension contracts. Allow implementation changes and security fixes. Ordinary libraries should not require compiler plugins or a new syntax for every domain.


## Syntax and compatibility

The familiar syntax is a design choice, not an implementation dependency. Track grammar recognition, executable semantics, library coverage and native-extension support separately.

```text
if 1 == 0:(0)
    if 2 == 3:(1)
        print("hello")
```

The number is nesting depth: root zero, then one per nested suite. Indentation remains authoritative. Sibling clauses share the appropriate level. Standard same-line suites must not be reinterpreted accidentally.

```text
[operators]
"==" = "equalTo"
"!=" = "notEqualTo"

[builtins]
"print" = "display"
```

```text
if 0 equalTo 1:(0)
    display("hello")
```

Aliases resolve contextually and lower to canonical operations. Preserve precedence, chained-comparison evaluation, scope and shadowing. Never replace text inside strings, comments, attributes or unrelated identifiers.

### Dialect boundary

Standard .py source keeps the pinned standard grammar by default. .naja enables the agreed extensions. Each dependency owns its alias table; project settings cannot silently alter another package.

### Support is explicit

Recognized but unsupported constructs produce useful diagnostics, not fabricated results. HATCH includes a useful dynamic/object/function/async subset; advanced compatibility remains separately reported without a Python fallback.


## Self-hosting and independence

A compiler written in NAJA is not automatically independent. It fails the autonomy goal if it still delegates to a mandatory C/Rust compiler or opaque seed runtime.

| Stage | Evidence |
|---|---|
| B0 | Temporary, identified seed compiler using verified prebuilt tools. |
| B1 | Seed compiles the actual NAJA compiler/runtime/tool sources. |
| B2 | B1 rebuilds them without Python, Rust/Cargo, LLVM or an external C compiler. |
| B3 | B2 rebuilds again; compare deterministic unsigned artifacts and semantics. |

### Reference target

Strict independent native generation and linking are verified first on Linux x86-64 ELF. Windows x64 and macOS arm64 remain mandatory product targets with real installation, execution and editor tests. Report autonomy levels separately rather than claiming Linux proof covers every OS.

### Prove evolution, not only repetition

Make a real compiler change in NAJA, rebuild it and execute a new test without modifying B0. Port the required runtime, tools, LSP/DAP and interactive session/loader into the audited source closure.

### Declare legitimate host dependencies

The OS, platform SDKs and a thin VS Code JS/TS adapter are distinct from the language implementation. A traceable seed is still necessary; the project does not claim to bootstrap from no executable bits.

Rust/C++ benchmark toolchains belong to comparison infrastructure only. Keep them out of the NAJA distribution and the isolated autonomy environment.


## Simple libraries, explicit behavior

Concision comes from reusable libraries, not hidden changes to the language. Provide three levels: common-case facade, composable services and explicit low-level primitives.

```text
from naja import Network
Network.App.Server.TCP(8080).run(on_receive=lambda msg: msg.data)
```

```text
from naja import Network
Network.App.Server.HTTP(8080).run(on_request=lambda req: "Hello NAJA")
```

These are APIs to implement, not tested programs in this package. The simple path keeps loopback defaults, bounded resources and clean shutdown. TCP chunks are not automatically complete application messages; framing is explicit when required.

### Native data pipelines

```text
from naja import Data

sales = Data.csv("sales.csv",
    schema={"region": str, "amount": int})
summary = (sales.where(lambda row: row.amount >= 0)
    .group_by("region", max_groups=4096)
    .sum("amount"))
summary.write_csv("summary.csv", atomic=True)
```

The proposed data layer requires schema validation, explicit invalid-row policies, bounded processing and declared output-commit behavior. No Python/pandas bridge or hidden unbounded buffering. A grouping limit is real: streaming input does not make unlimited groups constant-memory.

### Systems

A concise microkernel must genuinely boot and handle its declared hardware events. General boot/HAL helpers are allowed, but target assumptions and custom application glue remain visible and counted.


## The 100-to-25 acceptance target

On every approved matched scenario, NAJA must require no more than one quarter of the developer-maintained task footprint of both idiomatic Rust and C++ implementations.

```text
N / R <= 0.25
N / C <= 0.25

N <= 0.25 * min(R, C)
```

N, R and C are normalized authored-code counts for equivalent behavior. A best baseline of 100 permits at most 25 NAJA lines. This is arithmetic illustrating the target, not a measured result.

| Count or disclose | Rule |
|---|---|
| Application-owned code | Imports, declarations, handlers, helpers and low-level glue all count. |
| Configuration and DSL inputs | Task-specific manifests, build settings, macros and embedded rules count. |
| Formatting | Pin readable formatting; exclude delimiter-only layout from normalized counts. |
| General libraries | Exclude reusable internals symmetrically; disclose size and engineering cost. |
| Generated output | Count task inputs and edited output; disclose fully generated output separately. |

### Fair comparisons

Allow reviewed normal libraries on the Rust and C++ sides, not only verbose manual implementations. Preserve identical features, failure behavior and safety/resource budgets. No code golf, padding, hidden helper packages or average that conceals a failed domain.

The target is meaningful for bounded workflows, not a universal promise to shorten an already one-line expression fourfold. Name the tasks and counting method in any public claim.


## Six mandatory productivity cases

| Case | Equivalent behavior |
|---|---|
| DX01 · Microkernel | Real freestanding boot, serial output, memory information, bounded timer interrupts and clean halt on the same QEMU target. |
| DX02 · TCP application | Length-prefixed echo, partial I/O, multiple clients, deadlines, limits, malformed input and graceful cancellation. |
| DX03 · HTTP application | Health and validated JSON routes, correct statuses, request bounds, malformed-input errors, logging and shutdown. |
| DX04 · CLI utility | Arguments, streamed text transformation, Unicode, I/O errors, cancellation and declared output commit. |
| DX05 · CSV pipeline | Typed schema, validation, filter, bounded group/sum, deterministic output and malformed/oversized input handling. |
| DX06 · JSONL pipeline | Streaming validation/projection to deterministic CSV, record/memory bounds, errors, cancellation and cleanup. |

### Preregister before implementation

Pin exact inputs, output contracts, target machine, accepted libraries, versions, formatter/counting rules and resource budgets before scoring. A case without an equivalent working baseline is blocked, not passed.

### Platform scope

The microkernel uses one declared emulated bare-metal machine; hosted cases function on all three product targets. Select a documented reference machine for comparative timings. Cross-OS support does not require identical performance.

The supplied JSON templates contain null/not_run results. They are not benchmark reports. A microkernel demonstration is not a complete operating system, and the pipeline suite is not a distributed data platform.


## Time, quality and runtime measurements

Less source code is useful, but it does not by itself prove less development time. Measure creation, debugging and a realistic change request separately from source length and execution speed.

| Dimension | Required evidence |
|---|---|
| Creation time | From the same task/template to accepted behavior, including failed attempts. |
| Change time | A preregistered validated field, filter, handler or similar change. |
| Work accounting | Wall time, active work, compilation/testing waits, setup/learning and review. |
| Fair conditions | Comparable tools/experience; counterbalanced order; actual independent runs. |
| Population | Explicitly label human or AI-assisted sessions; no fabricated participants. |
| Runtime quality | Correctness/errors, bounds, startup, throughput/latency, memory, size and build costs. |

### Acceptance without invented precision

The proposed controlled pilot uses at least three independent runs per language and case. Register uncertainty rules in advance. NAJA must show lower median accepted creation/change time than both baselines under that protocol; missing or inconclusive evidence stays open. A small pilot is not a universal human-productivity study.

### Safety is not optional boilerplate

A shorter API cannot pass by dropping input validation, bounds checks, error handling, cleanup or required behavior. Execution-resource budgets are fixed before viewing results. Publish misses rather than relaxing a tolerance after failure.

Library engineering has not disappeared. Record reusable implementation/maintenance effort separately from the per-application benefit. Do not claim a 4x time or execution improvement from the 4:1 code target.


## Native cells without release dependence

Compile complete cells to native code and execute them in a persistent hosted session. Reuse the ordinary frontend; no hidden Python or bytecode interpreter.

```text
# %% Data
values = [10, 20, 30]

# %% Calculation
average = sum(values) / len(values)
print(average)
```

The separator is an optional editor comment. Block-depth markers are not cell identifiers. Invalid selections cannot be made valid by silently removing parent conditions or unavailable local context.

### State and effects

Preserve old function references after redefinition and invalidate obsolete optimized assumptions. Compilation failure leaves committed bindings unchanged. Execution failure can leave partial file/network/memory effects; no general rollback is promised. Never replay old cells automatically to fill missing names.

### Lifecycle and protection

Use a separate worker, private bounded cache, generation-tagged messages and explicit stop/reset. A separate process is not a complete sandbox. Keep live code until its references are safe, respect OS executable-memory protections and do not run project code on untrusted open.

### AOT remains independent

A final build uses saved source and declared inputs, never session history or memory. Ordinary applications do not link the unused controller. Measure cold compilation/loading, warm native execution and final release behavior separately; retain C01–C34 and P01–P04 acceptance tests.


## An installable VS Code experience

The language does not need a new IDE. It needs a complete, genuine implementation inside the supported VS Code extension model.

| Capability | Required outcome |
|---|---|
| Writing | Highlighting, indentation, completion, signatures, documentation and stable formatting. |
| Understanding | Semantic diagnostics, source-accurate fixes, definitions, references and safe rename. |
| NAJA syntax | Depth-marker fixes/inlay hints and alias-manifest validation/navigation. |
| Project workflows | Initialize, select target/profile, build, run and inspect errors. |
| Testing and debug | Real Test Explorer results and actual native breakpoints, stack and variables. |
| Interactive work | Run Cell/Selection/All, inspect, interrupt/reset and source export. |
| Distribution | Installable VSIX, clean-host tests, English labels/help, no Python extension requirement. |

### Implementation boundary

Keep a thin editor host adapter and standalone NAJA LSP/DAP/CLI services. Port their fundamental logic into the self-hosted closure. Do not substitute canned completions, invented debugger values or screenshots for working services.

### Trust and targets

No execution or hidden download on opening an untrusted workspace. Do not take over every .py file globally. Select binaries for the real workspace host, including remote/WSL cases when supported. Test the actual VSIX on Windows x64, Linux x64 and macOS arm64.

A missing Marketplace publisher may block that publication channel, not the installable VSIX deliverable. Do not invent signing or notarization.


## Implementation roadmap

| Milestone | Observable result |
|---|---|
| H0–H1 | Controlled setup/public repository; actual frontend, source maps, markers and aliases. |
| H2–H3 | Semantics and verified IR; independent native executable; early compiler code in NAJA. |
| H4–H5 | Useful language/runtime/library; native cells; core/FFI/hardware; real product targets. |
| H6–H7 | Robust networking, productive libraries, native data workflows and end-to-end VSIX. |
| H8 | Complete NAJA closure, B1/B2/B3 and an independently rebuilt compiler change. |
| H9 | Extensions, fuzz/security audit, cell/AOT tests, productivity evidence and release. |

### Revision 1.2 tasks

T35 migrates official surfaces to English without erasing progress. T36 registers fair benchmark contracts. T37 implements reusable system/application/data APIs. T38 executes and publishes code/time/resource evidence. Existing task IDs remain stable; final acceptance depends on the new work.

### Completion gates

R01–R15 retain repository, platform, independence, language, tools, self-hosting, hardware, networking, VSIX, extension and quality/release acceptance. R16–R17 retain native cells and AOT protection. R18 verifies English official surfaces. R19 verifies matched productivity and time evidence.

There are 139 mandatory HATCH requirements and 8 separately tracked future objectives. A missing requirement is not removed from the denominator; a planned capability is not implemented, and an implemented one is not yet verified.

These milestones do not promise a development duration. An experimental prerelease may be useful, but it must not be labeled completed HATCH while a mandatory gate remains open.


## Agent launch and safe migration

The package supports one implementation agent or an integrator plus a contributor/reviewer. A second agent is used only when actually available and authorized. Use separate branches/worktrees and confirmed path ownership; one integrator serializes shared-contract changes.

### New project

```text
Read START_HERE.md and AGENTS.md.
Then execute prompts/01_INITIAL_AGENT.md.
Inspect the real environment before making changes.
Implement and verify the next ready authorized task.
```

### Existing project

```text
Apply prompts/06_AGENT_UPDATE_ENGLISH_PRODUCTIVITY.md.
Merge specifications and tracking entries by stable ID.
Preserve code, history, actual statuses and evidence.
Record revalidation needs; do not reset the project.
```

Translate official narratives and messages without altering user data, legal texts or original evidence. If an expanded requirement invalidates an old acceptance claim, keep the old proof and explain the new validation needed.

### Authorization boundaries

Controlled installation and an authorized public repository are in scope. Purchases, security bypass, destructive resets, unrelated data publication, firewall changes, invented accounts and paid QPU/cloud use are not. Resolve real identity/permission blockers while continuing independent work.

### Resumable execution

Record actual commit, target, command, tool versions, exit code, logs and limitations. At session limits write an English HANDOFF/RESUME with the next command. Do not promise work after the session or claim completion because context ran out.


## Release evidence and package map

A final HATCH claim requires every mandatory gate to pass on the release commit. Reviewers should actively search for hidden interpreters, delegated compilation, opaque runtimes, fake tests, untranslated public surfaces, inflated baselines and omitted task code.

| Location | Purpose |
|---|---|
| docs/01–19 | Core language, architecture, independence, tools, agents, cells and earlier acceptance. |
| docs/20–23 | English policy, productive libraries, matched benchmarks and migration rules. |
| planning/ | 139 mandatory items, 8 future objectives, 38 tasks and 19 gates with empty initial evidence. |
| benchmarks/productivity/ | Case-registration and unmeasured-result templates; no synthetic gains. |
| prompts/01 and 06 | New-project mission and non-destructive update for an active repository. |
| spec-examples/ | Clearly labeled API contracts, not runnable product demonstrations. |

### Honest public story

NAJA began as a long-held ambition to unite readable code with native control. AI-assisted engineering helps implement, test and document it. Human direction and evidence-based review remain essential. Do not invent dates, biographies, teams or achievements.

### What has actually been delivered here

An English specification package and launch brief. Packaging checks validate document structure and consistency only. They do not prove a compiler exists, a development environment was installed, an extension works or the 100-to-25/time targets have been achieved.

### References and next action

The full source register is in document 17. Its inherited references must be verified and pinned when implementation choices are made. Start the appropriate agent prompt in the real authorized workspace, then judge progress by executed programs and retained evidence.
