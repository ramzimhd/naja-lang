# 18 — NAJA Interactive: Compiled Native Cells

**Revision 1.2 English edition. Implementation and validation remain pending.**

## 1. Decision and limits

Support explicit execution of cells, complete selections and expressions in a persistent session while compiling user code into native instructions. Final AOT compilation remains independent. No Python/CPython, mandatory Jupyter kernel, hidden interpreter, AI account or mandatory LLVM backend.

Interactivity is optional for end users but mandatory in the HATCH product acceptance scope. It is neither a third dialect nor a new keyword set.

Compiling fragments and retaining state is technically established by systems such as Clang-Repl; ORC documents native runtime linking. They are references, not implemented NAJA capabilities or required dependencies. [S25, S26]

Do not promise instant compilation, equal speed for every interactive fragment, zero risk or external-effect rollback. Measure compile/load time, mutable-state lookup and optimization-boundary costs. [S28] The verifiable objective is that ordinary release applications inherit no unused interactive controller, dispatch layer or session dependency. Architecture alone does not prove this property.

## 2. Cells are not syntax blocks

A cell is an editor work unit; a syntax block is an `if`/`for`/`def`-style construct; an IR basic block is a compiler representation. `:(x)` remains nesting depth, not a unique cell identifier. Use stable editor IDs or source ranges/revisions; visual cell numbers are not persistent identity.

A cell contains an expression or a complete top-level statement sequence. The interactive module is `__main__`, with declared source origin, project context and persistent bindings. Executing a function definition defines it; the body runs only when called. Decorators, defaults and class bodies follow promised NAJA execution semantics, not execution during supposedly side-effect-free checking.

Missing names cause the appropriate diagnostic/error. Never automatically execute earlier cells to manufacture their values.

## 3. Presentation without new grammar

In `.naja`, top-level `# %%` outside strings is an optional editor comment convention. Ordinary AOT ignores it as a comment. Use the shared CST to avoid splitting strings/multiline constructs. Complete selections work without markers.

```naja
# %% Data
values = [10, 20, 30]

# %% Calculation
average = sum(values) / len(values)
print(average)

# %% Use
if average >= 20:(0)
    print("Average is sufficient")
```

Execute the first cell and then the others in the same session; inspect values; edit/rerun the second without replaying the first. The saved source also builds normally. Session snapshots are not implicit build inputs.

`.py` remains standard. `.naja` follows the session's pinned dialect/aliases. Comments do not alter precedence or name scope.

## 4. Valid selections preserve context

Reject selections that cut expressions, decorators, required `try` handlers or function bodies with unavailable locals. Do not silently dedent them.

```naja
if 1 == 0:(0)
    if 2 == 3:(1)
        print("hello")
```

The complete unit prints nothing. Selecting only the nested `print` is rejected by default; offer the whole construct or an intentional copy into a new top-level snippet. Never remove parent conditions to make interaction appear successful.

Do not infer missing function arguments or recover live-stack locals magically. Debug-frame evaluation is a separate DAP contract. Preserve original coordinates, block depths and alias mappings in diagnostics.

## 5. One compiler, two execution paths

```text
Source / selection / cell
              |
       Shared NAJA frontend + HIR/MIR
              |
       +------+--------------------+
       |                           |
AOT release                  Native session
whole-program optimization   incremental analysis
backend + linking            required-fragment compilation
       |                           |
standalone native binary     versioned native code + metadata
no session controller              |
                             dedicated worker process
                                   |
                             NAJA state + bounded output
```

A minimal implementation may emit relocatable objects/native modules and load them. A sophisticated adaptive JIT is not required; “JIT” identifies compilation timing, not an obligation to interpret AST/bytecode.

The independent Linux x86-64 backend, symbol resolver and loader belong to the self-hosted closure. ORC may be optional, never the sole working path. No hidden C generation/compiler or per-cell Rust compiler invocation.

The controller is distinct from LSP. User code never executes inside the editor, language server or completion request. A separate worker protects availability but is not by itself a security sandbox.

Object-runtime services may be shared. Session tables/history/editor communication/replacement machinery must be separable and excluded from ordinary AOT linking.

## 6. State, types and redefinitions

Keep module bindings/imports/values according to NAJA semantics. Execute once per user request in requested order. Rerunning a mutating cell repeats its mutation; do not deduplicate effects implicitly.

Permitted dynamic type changes require analysis, guards, invalidation or correct generic native paths. Respect the already specified annotation semantics. A cached specialization must not retain false assumptions.

Redefinition creates a new function version and updates the binding; old references remain valid:

```naja
# %% Initial version
def calculate(x):(0)
    return x + 1
previous = calculate

# %% New binding
def calculate(x):(0)
    return x + 2
print(previous(10))  # 11
print(calculate(10))  # 12
```

These particular outputs assume no mutable-global dependencies in the bodies. Old functions still resolve globals under normal NAJA rules, not arbitrary snapshots. Guard/invalidate/recompile optimized calls and inlining that depend on changed mutable bindings.

A new class definition creates a new type. Never reinterpret old instance layouts or migrate them automatically. Unsupported changes require an explicit diagnostic/new session, not memory corruption.

No replacement of active stack frames or overwriting referenced code. Keeping necessary versions until reset is acceptable for HATCH with documented bounded resource use and an explicit restart request at the limit. Functions, closures, tasks and callbacks keep code alive. Limits never trigger hidden restart/replay.

## 7. Atomic compilation, non-transactional execution

Parse/resolve/compile/prepare symbols in candidate state. Failure before execution leaves committed user bindings unchanged and executes no user initializer. `check` neither writes user files nor imports executable user code.

Execution is not a general transaction. A list/file/socket may change before an exception. Report `failed_partial`, retain bounded output and offer explicit inspect/continue/reset actions. Never claim all effects were undone without a proven mechanism.

Handled NAJA exceptions do not close VS Code. Native crashes/forced stops end the worker and invalidate its handles. Late messages from an old session must not attach to a new one.

## 8. Lifecycle

Serialize user submissions within a HATCH session. Explicit background tasks created by the program do not authorize automatic cell execution. Expose still-active owned tasks/resources.

Provide cooperative interruption, a configurable deadline and forced worker termination as a last resort. Infinite loops must be stoppable without closing the editor. Explain lost state after forced stop and persistent external effects.

Reset creates a new session generation, closes owned resources where possible and invalidates old state. Do not implicitly preserve sockets, raw pointers or hardware handles. Report detached descendants/external resources that cannot be recovered.

Normal file/network/hardware permissions still apply. Blocking servers occupy the session until stopped. Tests use loopback and disposable temporary directories, not private user data.

## 9. Trust, native loading and caching

No project execution, imports, plugins or cells on opening an untrusted workspace. Trust is not proof of program safety. [S11] Respect OS loading/signing and executable-memory protections. Use W^X or an officially permitted target mechanism; do not disable DEP or bypass platform restrictions to pass a test.

Separate code cache from runtime state. Keys include source, dialect, aliases, import/interface dependencies, compiler/runtime/ABI versions, target/CPU features and optimization/safety flags. Non-serializable dynamic assumptions prevent corresponding cross-session reuse. Alias/dialect changes require a new HATCH session; never reinterpret old code under a new table.

Use private local permissions, bounded/versioned formats, integrity checks, safe paths/symlinks and collision-safe temporaries. Hashes do not make adversarial objects trusted. Do not load anonymous network-cache code. On invalid cache, recompile source without replaying historical effects.

Do not persist raw pointers to “restore” a session. Optional history is private/ignored by Git and does not transmit values/output to a service. Inspect values through bounded structured representations; never invoke an effectful user `__repr__` implicitly.

## 10. Commands and protocol

| Future interface | Behavior |
|---|---|
| `naja repl` | Native terminal session |
| `naja session --stdio` | Versioned controller for editor clients |
| `naja cells run file.naja` | Fresh session, complete cells in source order |
| `naja cells export file.naja --output app.naja` | Source-only export; no memory/output |
| `naja build app.naja --release` | Build declared sources independently of sessions |

Protocol methods cover create, execute, inspect, interrupt, reset, close and capability status. Envelopes include version, request/session/generation/cell/revision IDs, source URI/hash, dialect and alias hash. Return bounded output, diagnostics, status, execution counter and separated timings.

Default transport is local stdio or a private OS channel, not an open TCP server. User stdout must not break framing. Validate message size/types/encoding/order. Disconnects or stale messages never initiate execution.

Export means current sources in an explicit order, not reconstructing a program from past effects. Validate in a fresh session before publication. External input/randomness/dependencies/order remain declared reproducibility inputs. A build cannot replay history to supply missing variables.

## 11. VS Code experience

Required: Run Cell, Run Selection, Run All in Source Order, Interrupt, Restart Session, bounded state inspection and source export. HATCH official labels are English; architecture may allow later localization without making translated bundles mandatory.

Separate output by cell and session generation with queued/running/success/failure/interrupted status, execution number and timing. Edits mark previous output stale. Mark known dependents potentially stale; where dependency inference is uncertain, mark the session accordingly rather than claiming perfect dynamic dependency analysis. No automatic rerun.

Notebook API is an optional UI/controller mechanism, not a Python-kernel requirement. [S27] Text cells and a results panel suffice. A custom notebook format, universal rich output, remote kernel or Jupyter integration is outside this HATCH requirement.

## 12. Targets and exclusions

Test hosted sessions on Windows x64, Linux x64 and macOS arm64. Loading strategies may vary, but publish limitations/dependencies. Strict autonomy remains Linux x86-64 including cell compiler, loader, protocol, cache and state management.

Do not impose interactive controllers or dynamically executable memory on microcontrollers, kernels, browser apps or QPUs. Host-driven compile/deploy workflows are separate from executing arbitrary hosted cells on every target.

Outside HATCH: arbitrary production hot reload, transparent active-class migration, general external-effect undo, arbitrary GPU/QPU cell execution, arbitrary live-frame selections and universal zero overhead.

## 13. Roadmap and evidence

H2 defines boundaries/protocol; H4 provides native sessions; H5 proves lifecycle/security/targets; H7 integrates VS Code; H8 self-hosts; H9 audits. Keep the minimal AOT path first and never create a second simplified semantic frontend.

R16/R17, INT-01–INT-16 and PERF-01–PERF-04 are mandatory; document 19 defines their tests. Status is `not_started` in a fresh launch package, never a claim about an existing repository.

## 14. Communication

After actual evidence: “NAJA supports native-compiled cells and final builds independent of the interactive controller on the stated targets.” Do not assert zero risk, zero latency, zero cost for all workloads, arbitrary out-of-context blocks or universal undo.
