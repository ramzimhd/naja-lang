# Frozen native integer interval proof

Authority: ADR-009 at `44c091d19b1e6d1b17e697694fd5ea28a768110f`.
This backend-only proof does not close L09, FC1-06 or any HATCH gate.

The immutable ternary IR evaluates value/lower/upper once in that order, guards
all three descriptor spans then kinds, then canonically scans value/lower/upper.
Descriptor metadata at offset16 is zero. Each descriptor costs1 and each raw
scan1+n. Inclusive signed comparisons cost1+2max and execute lower/upper,
value/lower, value/upper, stopping at first empty/outside failure. One cumulative
1,000,000-unit work counter has no pointer, sign or equal-bound shortcut.
Success returns the original Int/Bool descriptor and allocates nothing. The
new helper uses128 frame bytes, WORK-16, and the unchanged4096 helper reserve.

Before compiler/native execution, `scripts/test-intervals.mjs --prepare-only`
freezes finite Node BigInt outcomes, exact work debits, sources, mutations and
resource budgets in PREPARATION.json. Independent input comparisons determine
values; the harness does not run a target interpreter or Python oracle.
Cases cover signed/Bool boundaries and arbitrary precision, deterministic seeded
values, effects and child failures, every unsupported-kind position, nesting,
returns/containers, all child IR validation, depth/node/literal caps, raw/header/
span/metadata/canonical-Bool mutants, type/span/work precedence, exact and one
under work counters, natural cumulative boundaries, zero-free-byte arena success
and an allocation-failure control, changed data and disabled-debit controls.

Execution uses real direct-emitted Linux x86-64 ELF under local WSL on Windows,
or local Linux x86-64, at most5 seconds per ELF. Commands have20-second limits,
build45 seconds, total240 seconds, capture8MiB. No caps or old selectors change.
Every first failure and pending not_run outcome is retained with exact source,
commands, host/target distinction, output hashes and artifact identity.
