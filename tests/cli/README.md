# Native CLI execution tests

`naja run SOURCE [--runner wsl] [--timeout-ms N] [-- ARGS...]` compiles
through the current shared AOT library, then runs a temporary Linux x86-64 ELF.
Linux x86-64 executes directly. The Windows CLI requires explicit `--runner wsl`
and a local Linux x86-64 distribution providing `/usr/bin/uname`, `wslpath`,
`chmod` and GNU `timeout`. The adapter invokes argument arrays, never shell text.
Arguments after `--` retain their boundaries, including empty strings and options.
The current language slice cannot read argv. A development-only independent ELF
fixture echoes actual argv bytes through the production adapter; it verifies
empty arguments, spaces, Unicode, quotes, backslashes and shell-looking text.

`naja test DIRECTORY|SOURCE [--runner wsl] [--filter TEXT] [--json]
[--timeout-ms N]` implements program-file tests: compilation and exit zero mean
pass. It does not discover functions, fixtures, setup hooks or assertions by name.
Directory discovery recursively selects only `test_*.naja` and `test_*.py`, sorted
by their Unicode UTF-8 relative paths (with `/` separators). An explicit source
file need not match that pattern. A filter is a case-sensitive substring of that
relative name. Discovery bounds, applied before filtering, are 256 selected
files, 4096 visited entries and 16 directory levels below the supplied root.
Entries identified as symlinks are skipped; an explicit symlink path is rejected.
Discovery diagnoses names that cannot be represented as Unicode instead of
silently omitting them. Literal backslashes on Unix remain filename characters;
only actual directory separators become `/` in reports.
Concurrent filesystem replacement is not a protected security boundary. Empty
selection is an operational error. Run `programs/` for the two passing examples;
the deliberately failing `cases/` names do not match discovery patterns.

Each program deadline defaults to 5000 ms; `--timeout-ms` accepts 1..60000.
The direct runner kills and reaps the child at its deadline. The WSL runner adds
a target-side GNU timeout and a host observation deadline with three seconds of
adapter allowance. A translated WSL exit 124 cannot distinguish target timeout
from an actual child exit 124, so the report says `timeout_or_exit_124`. A forced
WSL timeout can return 137. Exact signals are unavailable through WSL; the actual
Windows adapter reported status 15 for a fixture terminated by SIGTERM. Directly
observed signals appear in the report; `run` returns conventional `128+signal`
and prints the signal number rather than re-raising it. Numeric observed child
exit codes otherwise pass through unchanged. `test` returns zero for all pass,
one for any failed case or operational error.

`run` inherits stdin/stdout/stderr. Program tests use null stdin and capture at
most 65536 bytes per output stream, marking overflow as failure and terminating
the observed process. Captured streams decode UTF-8 with replacement for invalid
bytes, explicitly marked by `stdout_utf8_valid`/`stderr_utf8_valid`; the
`stdout_hex`/`stderr_hex` fields preserve every retained original byte. Human
output diagnoses replacement characters. On Windows, terminating the adapter
does not prove immediate termination
of every target process; the target-side timeout remains the bound. The current
native programs cannot spawn descendants. These limits are not a sandbox.

`--json` emits a single schema-version-1 object on stdout: `kind`, `runner`,
`signal_observation`, `selected`, `passed`, `failed`, and sorted `tests`. Each case
has `path`, `status`, nullable observed `exit_code`/`signal`, UTF-8 display text
`stdout`/`stderr`, validity flags, lossless hex byte strings and nullable
`diagnostic`. Compile and runner failures are case results. Argument,
discovery and runner-preparation failures use stderr and exit one. Reports omit
timings and random artifact paths. Programs run sequentially, but their own
output and use of OS resources are not made deterministic by this runner.

Temporary executable images are limited to 16 MiB and are created with
`create_new` inside a newly reserved directory under the OS temporary root.
Reservation retries at most 64 collisions. Unix directory/file mode is 0700;
Windows inherits the temporary root's ACL (no new ACL isolation is claimed).
Normal completion and errors remove only the owned executable and empty owned
directory, without recursive deletion. Cleanup failures are diagnosed and retain
the child outcome. An externally killed CLI or machine crash can retain an
artifact; there is no sweeping deletion of old directories. The compiler is
still an unsigned experimental Rust seed, not a standalone HATCH distribution.

Run `cargo build --workspace --locked --offline`,
`cargo test --workspace --locked --offline`, then `node scripts/test-cli.mjs`.
The Node harness explicitly selects WSL on Windows, gives each CLI process a
private fixture temporary root, and retains fixtures under ignored `target/`.
It checks native success, compile/runtime failure, deadline behavior, bounded
capture, Unicode paths, literal argument passing, deterministic discovery,
filters, JSON, source limits, non-overwriting build, and normal/error cleanup.
The harness also builds `execution_probe.rs` with the pinned development Rust
toolchain to exercise real argv bytes, arbitrary exit 42, signal observation,
invalid-image rejection and raw invalid-UTF-8 output through the production
adapter. This fixture is not language functionality. The CLI and generated
programs never invoke Rust or
another compiler. Malformed/non-native ELF headers are rejected before launch,
avoiding an exec-format fallback through the WSL timeout tool.
It requires Linux x86-64 or Windows with the declared WSL tools; it installs
nothing and does not use Python, network services or foreign compilation.
