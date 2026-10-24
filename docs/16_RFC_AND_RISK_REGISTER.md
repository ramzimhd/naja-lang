# 16 — Decisions, Risk Register and Change Control

## ADR template

ID; English title; date; status (`proposed`, `accepted`, `superseded`); context; decision; alternatives; consequences; affected requirements; verification plan; migration; actual author/reviewer; sources.

An agent cannot approve away a founding requirement. Reversible implementation decisions may be recorded by the integrator; independence, syntax or completion reductions require the founder.

## Initial decisions

ADR-001 temporary Rust seed/no Python; ADR-002 mandatory independent backend/optional LLVM; ADR-003 `.py`/`.naja`; ADR-004 depth markers; ADR-005 contextual aliases/hygienic builtins; ADR-006 hosted/core memory and guarantees; ADR-007 source maps/LSP/DAP; ADR-008 networking/framing; ADR-009 autonomy/product target matrix; ADR-010 license/publication; ADR-011 native cells/AOT isolation; ADR-012 English official language; ADR-013 productivity library layers and preregistered 4:1 benchmark policy.

## Risks and required mitigation

| ID | Risk | Mitigation/evidence |
|---|---|---|
| K01 | Indirect Python dependency | Closure audit, clean hosts, process traces |
| K02 | Nominal-only self-hosting | B1/B2/B3; no opaque seed blobs |
| K03 | Parser changes valid standard source | Dialects, CST and ambiguous-suite corpus |
| K04 | Aliases change order/scope | Canonical AST; chain/shadowing tests |
| K05 | Simple syntax hides inconsistent semantics | Specification/tests before optimization |
| K06 | Unproven Rust-level safety claim | Scoped guarantees, negative tests, unsafe inventory |
| K07 | Permanent LLVM requirement | Independent backend/linking |
| K08 | Theoretical platform support | Actual execution on each announced OS |
| K09 | Decorative VSIX | Real edit/build/test/debug acceptance |
| K10 | TCP confused with messages/HTTP | Explicit stream/framing/HTTP contracts |
| K11 | Private content publication | Dedicated folder, explicit staging, scan/review |
| K12 | Agent conflicts or invented evidence | Worktrees, one integrator, actual logs |
| K13 | Infinite scope/no useful release | Explicit HATCH gates and future objectives |
| K14 | False stability | Small versioned contracts, migrations, consumers |
| K15 | Misleading performance | Equivalent workloads and public methods |
| K16 | Compromised supply chain | Pinned dependencies, least privilege, provenance |
| K17 | Interactive path becomes hidden interpreter | Native end-to-end tests and closure audit |
| K18 | Stale redefinition results | Versions/guards/invalidation; C05/C06/C24 |
| K19 | Repeated effects or fake rollback | No automatic replay; C03/C08/C09 |
| K20 | Freed code or unbounded versions | Live references, session limits; C31 |
| K21 | Separate process mistaken for sandbox | Trust/OS rights and explicit limitations |
| K22 | Poisoned cache/stale ABI | Hashes, permissions, versions; C17–C19 |
| K23 | Shared frontend regresses AOT | Pre-change baseline and P01–P04 |
| K24 | Interactivity delays every foundation | Minimal native session; exclude unrelated hot reload |
| K25 | Reset leaks resources/state | Generations, cleanup, documented forced stop |
| K26 | English migration corrupts requirements | Stable IDs, semantic review, preserved evidence |
| K27 | 4:1 target gamed by formatting/helpers | Normalized counts, all task-owned files, audited baselines |
| K28 | Less code hides fewer checks/capabilities | Shared acceptance/failure tests and resource budgets |
| K29 | LOC presented as development-time proof | Actual timed creation/change tasks, separate measures |
| K30 | Library costs disappear from claims | Report reusable library engineering/maintenance separately |
| K31 | Pipeline facade hides Python/full buffering | Dependency traces, bounded memory and malformed-data tests |
| K32 | Kernel facade is actually a hosted program | Same bare-metal target/boot contract and actual QEMU trace |

Track actual severity/status during reviews. Identifying a risk does not resolve it. Failed hypotheses require fixes/ADRs, not deletion of tests. Bounded tests do not establish unperformed universal mathematical proofs.
