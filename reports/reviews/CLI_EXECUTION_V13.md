# Independent CLI execution review — October 25, 2026

Reviewed source: **`18ca70486db86aaff16c69a55642ddbe1a2c0c17`** on independent
branch `agent/cli-review-v13`. One P2 argument-handling defect was reproduced.
Other exercised behavior passed. This report is the reviewer's only tracked
change; production source, shared planning and integration reservations were not
modified. Earlier review branches were preserved.

## Finding: filter data beginning with two hyphens is rejected

**P2 — Preserve arbitrary substring filter text.**
`bootstrap/driver/src/main.rs:266` rejects every option value beginning `--`
before dispatching by option. This also rejects legitimate `--filter` data,
although help and `tests/cli/README.md` specify a case-sensitive substring filter
without that restriction. Quoting cannot resolve this because the CLI already
receives separate argument strings. No `--filter=TEXT` spelling exists at the
reviewed revision.

Minimal input: a disposable directory containing `test_--focused.naja` with
exact UTF-8 source `assert 2 > 1\n`. Its source SHA-256 is
`d9e6d2a66bb2b1df5e3b3034068b42d207963dc85bbc2501511942b3a7b90320`.

Actual commands, using the built CLI and the retained fixture directory:

```text
target/debug/naja.exe test target/cli-review-WwaO2v/filter-dashes --runner wsl --filter focused --json
target/debug/naja.exe test target/cli-review-WwaO2v/filter-dashes --runner wsl --filter --focused --json
```

The first exited 0 with `selected: 1`, `passed: 1` and original path
`test_--focused.naja`. The second exited 1, emitted no stdout, and reported
`NJA001: missing or non-Unicode option value` on stderr. The real file is
discoverable and executable; only the requested substring spelling is blocked.
Using a shorter filter is a workaround but can select additional files.

Allow the next nonempty Unicode string as filter data, or provide an unambiguous
`--filter=TEXT` form, while retaining appropriate validation for runner and
timeout values. The integrator received and confirmed this finding during the
review and reported a subsequent fix plus regressions. That later source was
not substituted into this checkout or reverified by this report. The original
reviewed revision still fails the reproducer.

## Scope, environment and baseline

Read `AGENTS.md`, toolchain/CLI specification 08, the continuation acceptance
contract, CLI documentation, `bootstrap/driver/src/main.rs`, `execution.rs`,
`scripts/test-cli.mjs`, the development execution probe, and assertion parsing
and lowering relevant to actual program execution.

Host: Windows x64; Rust `1.97.1 (8bab26f4f 2026-07-14)`; Cargo
`1.97.1 (c980f4866 2026-06-30)`; Node `v24.11.0`. Target programs ran on Ubuntu
WSL, `Linux 6.6.87.2-microsoft-standard-WSL2 x86_64 GNU/Linux`. This is evidence
for the Windows CLI's explicit WSL runner and actual Linux x86-64 ELF execution.
It is not native Windows execution or direct-Linux Rust adapter verification.

| Actual command | Exit | Result |
| --- | --- | --- |
| `cargo test --workspace --locked --offline` | 0 | 127 tests passed: 4 frontend unit, 95 syntax, 6 native, 12 seed library, 10 CLI; no failures |
| `cargo build --workspace --locked --offline` | 0 | CLI built offline |
| `cargo clippy -p naja-seed --all-targets --locked --offline -- -D warnings` | 0 | Passed without warnings |
| `node scripts/test-cli.mjs` | 0 | All 42 author-harness checks passed; symlink fixture executed successfully |
| `rustc --edition=2024 target/cli-review-WwaO2v/adapter.rs -o target/cli-review-WwaO2v/adapter.exe` | 0 | Independent development probe compiled with the pinned host toolchain |
| `target/cli-review-WwaO2v/adapter.exe` | 0 | Independent production-adapter probes below passed |
| Inline `node --input-type=module` source/discovery probes | 0 | Ten additional actual CLI probes passed |
| `wsl.exe -d Ubuntu --exec rustc --version` | 1 | `rustc` unavailable in this distribution |
| `wsl.exe -d Ubuntu --exec cargo --version` | 1 | `cargo` unavailable in this distribution |

No toolchain was installed to fill the direct-Linux verification gap. No Python,
provider launcher, authentication flow, service, network operation or production
reservation write was used. Native programs never invoked a compiler or
interpreter. Rust compiled development probes only.

The existing 42-check harness was independently rerun, not newly authored here.
It exercises actual argv bytes (including empty strings, Unicode, quotes,
backslashes and shell-looking text), runtime exit 101, assertion exit 104,
target timeouts, bounded output, sorted reports, filters, symlinks, discovery
limits, invalid sources, non-overwriting builds and temporary cleanup. Current
NAJA programs cannot read argv; the real argv-byte check uses its explicitly
development-only independent ELF fixture through the production adapter.

## Independent native and adapter probes

The independent Rust probe includes the pinned production `execution.rs` without
editing it and uses the existing development fixture's static x86-64 ELF-header
constructor. Its newly supplied instructions execute Linux syscalls directly.
Probe input, executable and log remain under ignored
`target/cli-review-WwaO2v/`. Each normal probe has a bounded target deadline and
the outer Node invocation has a 30-second process limit.

| Probe | Observed result |
| --- | --- |
| Numeric exits 0, 42, 124, 255 | Exact translated `exit_code` values retained; codes 0/42/124/255 preserved; 124 labeled `timeout_or_exit_124` |
| Exactly 65536 stdout bytes, each `ff` | All raw bytes retained; invalid UTF-8 remains observable; no output-limit flag; pass with exit 0 |
| Exactly 65537 stdout bytes, each `ff` | Retained prefix is exactly 65536 bytes; output-limit flag true; effective outcome code 125; observed WSL adapter exit was 1 |
| Captured-mode stdin read | Native `read(0, ..., 1)` returned EOF; fixture passed |
| Self SIGKILL and SIGSEGV | Observed translated exits 9 and 11 respectively; `signal: None`; both failed rather than inventing directly observed signal data |
| Native infinite loop, 30 ms target deadline | Observed 124 with `timeout_or_exit_124`, as documented for WSL |
| Eight malformed ELF mutations | ELF class, machine, header sizes/count, interpreter type, writable/executable load flags and oversized segment rejected before execution |
| Temporary cleanup | Private temporary root empty after the adapter process and after every independent CLI source invocation |

The invalid-image probes mutate a valid fixture before calling `execute`; they
do not claim that arbitrary imported binaries are a user CLI feature. The
overflow case's observed WSL exit is an adapter observation after termination,
not a claimed Linux child exit or signal. Captured raw bytes, rather than lossy
display strings, were compared against expected vectors.

A bounded process-tree exploratory fixture forked a child which sleeps for two
seconds and exits by construction, while the leader exits zero. With a 50 ms
requested target deadline, the WSL adapter returned leader success after 690 ms
including preparation. This did **not** demonstrate a hung capture or prove
termination of descendants. Source inspection shows reader joins occur after
the child-status deadline loop (`execution.rs:404` onward); no independent
process-tree bound is established here. Current docs explicitly exclude
descendant-spawning generated programs, so this is a future-extension boundary,
not an additional current-language finding. No unbounded child was left running.

## Independent source, assertion and discovery probes

Three complete source programs ran through the real CLI with exit 0 and exact
stdout: hosted assertions exercising all six comparisons and negative zero;
checked-i64 assertions exercising all six comparisons; and assertions inside
an eight-iteration mixed brace/branch loop. Expected stdout was respectively
`-99999999999999999999999999999999999999\n`, `3\n` and `8\n`.

For each false condition `1 == 2`, `1 != 1`, `2 < 1`, `2 <= 1`, `1 > 2` and
`1 >= 2`, an independent source containing `assert CONDITION\nprint(999)\n`
was tested with `naja test SOURCE --runner wsl --json`. All six CLI invocations
exited 1, recorded native exit 104 and exact stderr
`NJA204: assertion failed\n`, and retained empty stdout. Later output did not
execute. These are runtime outcomes, not parser acceptance alone.

Four independently created test filenames remained distinct and sorted by UTF-8
bytes: `test_é.naja` (decomposed accent), `test_é.naja` (composed accent),
`test_.naja` (U+E000) and `test_𝄞.naja` (U+1D11E). The machine report preserved
each original path and reported four passes. Expected ordering used Node
`Buffer.compare` on UTF-8 bytes rather than JavaScript UTF-16 string sorting.
No filename normalization or supplementary-plane ordering error was observed.

## Exact source and retained artifact identities

All values below are SHA-256 of actual bytes at this pinned revision. The
independent source-result JSON also retains each assertion source hash and
original discovery identities.

| Input/artifact | SHA-256 |
| --- | --- |
| `bootstrap/driver/src/main.rs` | `395222924cae8be5bf78eec5b53f5d4d0c8437820580a0f6c5d51340623e6024` |
| `bootstrap/driver/src/execution.rs` | `e001bb97f30d8757c669aeed913c76a5183fde8daad0c3b2a6da5cd916d654a4` |
| `scripts/test-cli.mjs` | `77d9957e34f39a8f4bbad975222322af61818430e5b8bc851b8a89beb95fcbef` |
| `tests/cli/execution_probe.rs` | `806354b15657f066b114758a76ee500192da8e0e7daf45bb0b54aafd9b3978b4` |
| Built `target/debug/naja.exe` | `e32a8487a1bef5f4a4fa3fbe7d1839b3ed3e7e1d462f232b8587b3c533385c8b` |
| Independent `adapter.rs` | `b328b152a762e82e6425ce0427630720f82f65c1b74b899f7e6058ad9583d4bd` |
| Independent `adapter.exe` | `ebb1f80fcc45e5dcddc3f35c654460f2831d0e7a1a8af3ea5444e1456e688b45` |
| Independent `adapter.log` | `65279d9c81ae70a8bf526f504ff87a266a8c95ed839ef287ed9942899be900df` |
| Independent `source-probes.json` | `ab43bd07c82ab03419e0a5bcfde8f3730a499da0f23e72ffe8f96c8682efc525` |

## Limits and handoff

This finite review does not certify a sandbox, general process-tree termination,
direct-Linux process handling, Unix non-Unicode path behavior, arbitrary ELF
loader correctness or power-loss cleanup. The Windows probe has no direct Linux
signal observation. Current documentation accurately distinguishes these
platform/seed limitations. The ELF validation, output storage and cleanup checks
are scoped to the implementation exercised; externally killing the CLI can
still retain artifacts as documented.

The integrator should preserve the filter reproducer as a regression and retain
separate evidence for the subsequent fix. Other reviewed observations belong to
`18ca70486db86aaff16c69a55642ddbe1a2c0c17`; they do not silently certify later
recorder, metadata or source changes. No FC1/HATCH gate is closed by this report.
