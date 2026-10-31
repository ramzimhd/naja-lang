# Native integer interval execution evidence

The first execution of the frozen harness passed all 113 checks at source
`78b35f300ddee38e2d70a79d0fe70dcb54fd1736`, exit 0: 103 Linux x86-64 ELF
executions, 10 invalid-IR refusals and 326 recorded child commands. Native
exits were 0 (27), 103 (30), 105 (30), 106 (2), 112 (8) and 113 (6). No case,
expectation, cap, selector or product code changed after that run. The
[preparation](PREPARATION.json) stays all-`not_run`; the
[execution results](EXECUTION_78b35f3.json) hold the actual observation. Two
draft fixture defects were corrected before the freeze; see
[PREFREEZE_CORRECTIONS.md](PREFREEZE_CORRECTIONS.md).

Command, run after committing the contract, backend and harness:

```text
node scripts/test-intervals.mjs --expect-source 78b35f300ddee38e2d70a79d0fe70dcb54fd1736
```

Host: Windows 11 Pro for Workstations 10.0.26200, Node v24.11.0, cargo 1.97.1.
Target: WSL2 `Linux 6.6.87.2-microsoft-standard-WSL2 x86_64`. Artifacts remain
in `target/intervals-native-TB6ks9/`; stdout was captured as
`target/intervals-first-execution.log` (3403 bytes, SHA-256
`fd7197dfbd7fc6c27cda0deb2f284503ceb73cdbd8c7a8f7d7271dcdaf679dac`).
`EXECUTION_78b35f3.json` SHA-256 is
`a639b26e8f4486bb55e7511db7e48166a5a42cae0573d90c5a4bf90409114e9d`.

What this shows: inclusive signed bounds and arbitrary precision (to 2^301),
Bool bounds, empty and outside failures, seeded BigInt oracle values, every
unsupported-kind position, left-to-right child effects and child-failure
ordering, short-circuit skips, nesting and unrefined copies, IR validation of
every child and unused code, height/node/literal caps, raw header/limb/metadata/
pointer/alignment and canonical-Bool corruption, kind-before-payload and
span-before-debit precedence, exact and one-under work counters, the natural
999,999/1,000,008/1,000,000 boundaries, zero-free-byte arena checks, and
disabled-debit and changed-data mutant controls.

What it does not show: source syntax, static diagnostics or `checked_int`
lowering (see `tests/intervals-source/`), Decimal/Float/Rational intervals,
named refinement types, refined fields or parameters, or any L09/FC1-06/HATCH
gate. Emitted native targets other than Linux x86-64 were not run.
