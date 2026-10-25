# Prepared file and strict UTF-8 source checks

This harness prepares actual `.py`/`.naja` programs for the first explicit
`naja.io` and `naja.text` source APIs. The native contract was frozen in
`39c4b3fbd20e4fcabd4b00c8faa23d2b3189edd2`, `tests/files/CONTRACT.md`.
Preparation does not execute source, build the compiler or verify native IO.

```text
node --check scripts/test-files-language.mjs
node scripts/test-files-language.mjs --prepare-only
```

Preparation verifies static source/config SHA-256 identities and writes an
ignored `target/files-language-*` plan containing every original source hash,
expected exit, output/diagnostic hash and input/output file byte identity.
Every native outcome is `not_run`. Commit this complete preparation before
execution. Actual execution requires the integration owner's exact compiler
source commit, with the frozen expectations unchanged:

```text
node scripts/test-files-language.mjs --expect-source FULL_COMMIT_HASH
```

The real-mode harness builds the workspace with pinned Rust 1.97.1 and
`--locked --offline`, then invokes real `naja check` and `build`. It executes
the emitted Linux x86-64 ELF on Linux x86-64 or explicit local x86-64 WSL on
Windows. Other hosts fail explicitly. All program data paths are relative to
each private native case directory. The Windows compiler SOURCE path and the
Linux native working directory are distinct and both are retained in results.
No shell parses fixture paths, including spaces, Unicode and inert
metacharacters. Fixtures never read credentials, open services or modify
arbitrary outside files.

Node alone creates inputs, directories and optional symlinks under the ignored
private case directory. All existing input/foreign file bytes must remain
unchanged. Complete bounded inventories surround both check and build, proving
that program file-IO effects did not occur there. SOURCE/config files are in
the inventory; requested ELF and command-capture/inventory JSON files are in
the enclosing artifact directory and are excluded from program data. Native
inventories must match only the explicitly expected new files, with exact
sizes and SHA-256 content hashes. Files, failed outputs and logs are retained;
the harness performs no recursive cleanup or rollback.

Independent Node byte/Unicode models cover all 256 bytes, empty files, Unicode
scalar width boundaries, NUL, compatibility/decomposed text without
normalization, and a strict invalid-UTF-8 matrix. Explicit imports cover both
modules and orders, parenthesized/trailing-comma lists, distinct aliases for
one API, Unicode bindings, functions, parameter shadowing, shared suites and
project aliases. Unknown/duplicate/NFKC-colliding/late imports, rebinding and
incorrect call arity have compile failures and original-position checks.
The presence of a private `naja/io.py` fixture must not create an ambient
module resolver or execute that file.

File boundaries are 16 MiB minus one, exact and plus one. Write preflight type,
NUL/path and file-size failures must not create outputs. Exclusive creation
must preserve foreign files and a completed first output. UTF-8 conversions
are immutable descriptor views under the unchanged arena budget, rather than
file operations: a valid 16 MiB plus one conversion must work, while an
oversized write fails. Construction allocations for that conversion stay
below the native 64 MiB arena. Exact 4095-byte relative paths use repeated
`./` components and a short leaf to avoid host directory-length limitations;
UTF-8-byte 4096 and embedded-NUL paths must fail with the frozen diagnostics.
Evaluation cases require PATH then DATA once and preserve ordinary errors
and short-circuit order.

Two changed-source controls must execute normally and then be rejected by the
same verifier used for valid programs. One changes transferred data; the
other changes only output-file bytes while preserving stdout. Both stdout
and independent filesystem hashes are therefore necessary to pass.

Frozen limits are five seconds per native process, 20 seconds per ordinary
child command, 45 seconds per workspace build, 240 seconds for the suite and
8 MiB captured output per child. Private snapshots have at most 128 entries,
16 directory levels and 64 MiB per regular file. Those snapshot bounds are
test-infrastructure limits, not expanded native file limits. A timeout, crash
or signal never counts as an expected language error. `failure.json` retains
the failed case and all remaining `not_run` cases without changing expectations.

Optional Node symlink cases run only if fixture creation succeeds; unavailable
capability is explicitly `not_run`. Source tests do not fabricate FIFO/device
fixtures or inject concurrent growth/shrink, syscall/EINTR/close/partial-write
errors, permissions or corrupt descriptor payloads. Those are separately
owned backend checks and are listed as not run by this source suite. No
filesystem confinement, generic OS IO deadline, sandbox, durability, complete
module/filesystem/Python implementation, self-hosting, FC1 or HATCH claim
follows. The English narratives preserve multilingual user source/data.

The first pinned actual run is retained in
[RUN_2026-10-25.md](RUN_2026-10-25.md) and
[RESULTS_2026-10-25.json](RESULTS_2026-10-25.json). It applies only to the exact
source, contract and artifact identities recorded there.
