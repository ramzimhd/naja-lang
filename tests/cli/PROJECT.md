# Project initialization and capability reporting

`naja init NEW_DIRECTORY` creates a previously absent leaf under an existing
ordinary local parent. It generates only `naja.toml`, `main.naja` and
`test_smoke.naja`. Both sources pass the shared checker before writes; nothing
executes automatically. Existing targets are refused. The scaffold contract,
path bounds, exclusive files and partial-output policy are in
[`INIT.md`](../project/INIT.md). Program-file smoke tests are independent native
programs, not a module import or test-function framework.

`naja doctor [--json] [--runner direct|wsl]` reports declared host/target facts,
the language subset and temporary resource limits. Default reporting neither
loads ambient projects nor invokes external tools. An explicit runner requests
the existing bounded preparation checks. Preparation is separate from compiling
or executing a user program; the JSON report states that distinction. No tools,
services or dependencies are installed, and no network probe is performed.
Unavailable native host execution and unfinished tooling remain visible.

`node scripts/test-project-cli.mjs` exercises both commands, preservation and
invalid-argument cases, Unicode paths and the generated project. It removes all
inherited spellings of PATH before doctor/init/check/build calls, then passes an
empty PATH to the absolute compiler executable. This is evidence that these
calls work without finding Python, Rust or SDK executables through PATH; it is
not a clean host, dependency-closure or self-hosting proof. The Rust seed's OS
libraries remain present. The harness's own offline Cargo build uses its normal
development environment and is reported separately.

On Linux x86-64 or explicit local Windows WSL, the full mode prepares the runner,
executes initialized main (stdout 42) and runs its one program-file smoke test.
`--compile-only` records those three cases as `not_run`; CI uses this mode on
Windows/macOS hosts where a Linux execution environment is not provisioned.
That mode does not claim generated Windows/macOS program execution. Native ELF
build/check coverage remains available on those hosts.

The fixed suite budget is 120 seconds, each child at most 30 seconds, with 1 MiB
captured output per command; the actual program deadline is 2000 ms and existing
runner preparation deadlines remain unchanged. A failure is retained and never
accepted as a resource/timeout success. Exact commands, exits/signals, generated
file/ELF/compiler/harness hashes and captured streams remain under ignored
`target/project-cli-*`; summary and partial-failure files preserve their scope.
No sandbox, complete CLI, clean installation or HATCH acceptance is implied.

During harness authoring, recording command output in the checked working
directory caused its own no-new-entry assertion to fail. Both partial failures
remain under ignored `target/project-cli-*`, and the original harness is retained
as `target/project-cli-before-capture-fix.mjs`, SHA-256
`f74f28b9cf01798be84445af45e7ff16c051ddec07ff232d95e703ddebf90b5e`.
Captures now live in a pre-existing dedicated subdirectory; the top-level
working-directory entry check remains exact. No product behavior, expected
acceptance outcome or timeout was changed to address this fixture mistake.
