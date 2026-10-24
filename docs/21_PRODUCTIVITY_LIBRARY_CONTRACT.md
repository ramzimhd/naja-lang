# 21 — Productive Standard Library and 100-to-25 Contract

## Objective

NAJA must make common development substantially shorter and easier through its base libraries, not only through Python-like syntax. On the approved matched HATCH benchmark suite, the target is:

**NAJA developer-maintained task code <= 25% of the equivalent idiomatic Rust implementation and <= 25% of the equivalent idiomatic C++ implementation.**

For a 100-line comparable baseline, NAJA must require at most 25 comparable lines. This means at least 75% fewer lines, or a baseline-to-NAJA ratio of at least 4:1. It is not proof of four-times-faster authoring, four-times-faster execution or universal compression of all algorithms.

The target is mandatory per selected scenario, not an average. Document 22 defines fair accounting and the separate development-time evidence gate. The implementation may not silently lower targets or remove failed scenarios. The exact initial scenario suite is a proposed operationalization of the founder's requirement, not an already measured result.

## Three API layers, one language

1. **Simple facade:** short common-case entry points with secure, bounded, documented defaults.
2. **Composable service layer:** reusable operations, schemas, handlers, resource policies and configuration.
3. **Explicit primitives:** low-level memory, hardware, scheduling, I/O and target-specific controls for advanced work.

Use normal functions, classes, decorators, annotations and contexts. Domain convenience does not justify new brace syntax, hidden language dialects or required compiler plugins for ordinary libraries. Advanced users may bypass the facade without abandoning NAJA.

## Mandatory base-library capabilities

| Domain | HATCH capabilities needed for useful concision | Non-goals |
|---|---|---|
| Core | Numeric/value types, safe buffers, ownership/resource contexts, atomics and FFI | Arbitrary hosted semantics without runtime services |
| System | Declared boot/board adapter, serial output, target interrupt/timer setup, explicit lifecycle | Full operating system, universal drivers |
| Applications | Arguments/configuration, files/paths, structured errors/logging, JSON, lifecycle/cancellation | A complete GUI or mobile framework |
| Networking | TCP/HTTP facades, framing, bounded buffers/connections, timeouts and clean shutdown | Ignoring protocol/error behavior to shorten code |
| Data | Native CSV/JSONL readers, schemas, validation, streaming filter/map, bounded aggregation, deterministic sinks | Python/pandas bridge, unbounded collect by default, full distributed engine |
| Tooling | Project templates, semantic completion, help, tests and native cells | Canned completion, fake examples or a new IDE |

Implement these layers in NAJA as the self-hosted language matures; temporary seed-language code must not remain an opaque required component at the final autonomy gate.

## System-library behavior

A concise microkernel example must actually boot on the declared freestanding target. The library may provide reusable boot/interrupt/serial machinery, but all platforms, bootloader assumptions, memory/interrupt requirements and linked primitives must be declared. It must not run a hosted process that merely prints an OS-like message.

Keep unsafe operations reviewable. High-level setup calls expose configuration/limits and return meaningful errors where recoverable. Do not claim hard real-time guarantees without measured bounds. SDK/board adapters may be shared foundations, but benchmark-specific assembly, linker scripts or support code count in the application's authored footprint.

## Application-library behavior

Common APIs offer sensible defaults and explicit stop/error/configuration hooks. Importing or constructing an application must not unexpectedly open ports, modify files or spawn background work. Start/stop lifecycle is explicit. Configuration validation and errors should reduce debugging time, not hide failures.

TCP and HTTP retain document 10's exact distinctions. Keep the original two-line demonstrations, but do not claim that a real application with tests/configuration is always two lines.

## Data-library behavior

The initial standard data surface is a proposal to stabilize through tests, not a claim of existing implementation:

```naja
from naja import Data

sales = Data.csv("sales.csv", schema={"region": str, "amount": int})
summary = (sales.where(lambda row: row.amount >= 0)
    .group_by("region", max_groups=4096)
    .sum("amount"))
summary.write_csv("summary.csv", atomic=True)
```

Expose schema, missing/invalid-row policy, encoding, numeric precision/overflow, ordering and output replacement explicitly. Defaults fail clearly on invalid data unless a documented policy opts into another behavior. Do not silently drop invalid rows.

Streaming operations should not load an entire source automatically. Grouping uses a declared key bound, documented spill strategy or clear failure; “streaming” does not imply unbounded grouping needs constant memory. If arbitrary integers are used, enforce/report record and numeric-size resource bounds rather than equating fixed row count with fixed byte memory.

Cancellation and failure must close handles and avoid presenting incomplete output as committed. An atomic file replacement contract covers the stated filesystem/target behavior, not universal power-loss durability. External side effects are never generally transactional. Native-cell runs must not automatically repeat pipeline effects.

Support a deliberately bounded CSV dialect and JSONL schema, with quoted/escaped input, Unicode, missing/invalid values, large records, malformed files and output errors tested. Document unsupported formats. No implicit Python, pandas, JVM, hosted service or paid cloud dependency.

## Reuse and “hidden work”

Standard libraries legitimately encapsulate complex reusable behavior; that is the goal. To exclude library internals from application line counts, a component must be publicly documented, independently tested, versioned, shipped for general use and work on varied inputs. Any benchmark-specific helper, generated user-owned code, embedded DSL, custom macro or target shim counts regardless of folder or package name.

Report library source/dependency size, implementation effort, unsafe surface, compile costs and long-term maintenance separately. Do not claim reduced total ecosystem engineering effort merely because per-application code is shorter. Give Rust/C++ equally fair access to documented idiomatic libraries.

## Readability and performance

One readable statement/declaration per line; avoid semicolon packing, giant lambdas, opaque one-line configuration and hidden expression strings. Use a pinned formatter and a normalized count to prevent brace-layout advantages from deciding the result.

The facade must preserve required output, error handling, limits, permissions and cancellation. Measure startup, latency/throughput, allocation/memory, binary size and compile costs. Do not weaken safety or slow the runtime beyond preregistered budgets to win the concision metric.

## Acceptance

Native microkernel/application/data workflows, their paired baselines and tests are mandatory through R19. The library catalog and English docs are required, not merely proposed namespace stubs. Agent reports must distinguish API contract, implemented API and executed evidence. A failed 4:1 scenario requires API/design work and honest reporting, not marketing language or a smaller denominator.
