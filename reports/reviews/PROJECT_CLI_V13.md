# Independent doctor/init CLI review

Review date: October 25, 2026. No actionable product correctness defect was found
at `797dda666fa41bb4924c8011a37603e84c1b0662`. The review branch is
`agent/project-cli-review-v13`, created from a clean checkout at that exact source.
Only this report is committed. Production, authored harness, planning and other
agents' paths remained read-only; previous artifacts were preserved. Later CLI
work and integrated evidence are outside this source pin.

The review read the shared instructions, doctor/scaffolder/main/project/manifest
code, project/CLI contracts and relevant tests. Another agent independently
inspected creation, Unicode interpolation and doctor reporting read-only and
found no concrete defect. Independent actual CLI probes supplement the authored
tests; their failures are retained separately below.

## Environment and commands

Windows x64; Rust `1.97.1 (8bab26f4f 2026-07-14)`, Cargo
`1.97.1 (c980f4866 2026-06-30)`, Node `v24.11.0`.
Native execution used WSL Linux `6.6.87.2-microsoft-standard-WSL2 x86_64`;
`ulimit -s` returned `8192` KiB. No Python, provider, auth flow, installation,
service or production reservation operation was used.

| Command | Exit | Observation |
| --- | --- | --- |
| `cargo test --workspace --locked --offline` | 0 | All 235 Rust tests passed, including 14 scoped scaffolder tests |
| `cargo build --workspace --locked --offline` | 0 | Actual CLI built |
| `cargo clippy -p naja-seed --all-targets --locked --offline -- -D warnings` | 0 | No warnings |
| `cargo test --workspace --locked --offline -- --list` | 0 | Counts: 4 frontend + 125 syntax + 11 native + 6 function + 3 index + 18 seed library + 14 CLI + 17 manifest + 23 project + 14 scaffold |
| `node scripts/test-project-cli.mjs` | 0 | 23 authored project CLI checks passed, zero `not_run` |
| `node target/project-cli-review.mjs` (initial version) | 1 | 53 independent cases passed, then the probe launcher failed before starting the CLI with a long working directory |
| `node target/project-cli-review.mjs` (short-cwd version) | 1 | 72 ordinary independent cases passed; a real partial collision behaved correctly, then probe bookkeeping misclassified a repeated notification |
| `node target/project-cli-collision-classification.mjs` | 0 | Independently verified retained collision bytes, partial diagnostic and one refusal on retry |

Four further actual CLI namespace cases also passed through an inline Node
launcher: ordinary local verbatim disk path accepted; verbatim UNC, GLOBALROOT
and device-volume namespaces rejected. All used the absolute compiler with an
empty PATH and the same 20-second/1 MiB command bounds.

The ordinary probe recorded 86 completed synchronous CLI commands and 72 case
results before the collision. Its recorded elapsed time at that point was
9,733 ms. The fixed budget was 120 seconds overall, 20 seconds per host command,
1 MiB retained output per command and 2,000 ms for actual native main/smoke
execution. Existing runner preparation deadlines stayed unchanged. The single
asynchronous collision command also had a 20-second cap. No budget increased;
no timeout occurred.

## Actual independent results

For empty-PATH calls, the probe removed every case-insensitive spelling of PATH
from a copied environment, then supplied one empty PATH value and invoked the
absolute compiler executable. The development Cargo build used the normal host
environment. Empty PATH does not remove OS libraries or establish a clean host.

- Default JSON doctor succeeded with malformed ambient `naja.toml`/`naja.alias`.
  The top-level directory inventory and ambient bytes remained unchanged. JSON
  parsed as exactly one document, stderr was empty, runner was `none`, preparation
  was `not_probed`, and `user_program_executed` was false. Host/target and
  resource fields matched the pinned constants: 8 MiB compilation stack, 64 MiB
  arena, 2 MiB native source stack, 256 active calls, 128 locals and one-million
  general-division limb product. Self-hosting/cells/LSP/DAP/VSIX flags were false.
- Text doctor reported `not_probed` without private directory inventory. Invalid,
  duplicate, equals-style, missing and extraneous options failed with NJA041,
  empty stdout and no project side effect. Explicit `direct` on Windows failed
  with NJA010 and no success JSON. Explicit WSL preparation succeeded separately,
  reporting `prepared` and still `user_program_executed: false`.
- Init with an empty PATH produced exactly the three named files and one
  creation summary, with no automatic `42` program output or generated ELF.
  Names included composed/decomposed Unicode, spaces, supplementary scalars,
  apostrophe and inert shell-looking punctuation. Manifest names retained their
  exact spelling; no shell marker appeared. Leaf limits accepted 128 ASCII bytes,
  64 `é` characters and 32 supplementary four-byte scalars; 129/130-byte leaves
  rejected before writes. `./--dash` created a dash-leading leaf explicitly;
  an unqualified flag-like argument was rejected by CLI argument parsing.
- Existing generated projects, empty/nonempty directories, ordinary files, hard
  links, file/directory symlinks and dangling links were refused. Existing
  sentinel/foreign/generated bytes were preserved. Missing ancestors were not
  created. The extra `--run` option rejected before a target appeared.
- Quote/newline manifest-injection names, controls, trailing dot/space, `.git`,
  device names including superscript-number spelling, streams, parent traversal,
  drive-relative paths, UNC/device namespaces, trailing separator/dot/parent
  leaves and oversized UTF-8 paths/component counts rejected. Error text was
  English, stdout empty and no private absolute target appeared in errors.
- Actual symlink and junction parent components could not redirect creation.
  A 255-byte Unicode parent component worked; 256 bytes rejected. A generated
  file path with exactly 128 components worked; the next component rejected
  before creating its leaf. The deep target was passed as an absolute argument
  from a short working directory.
- Both generated sources in seven independently named projects passed actual
  `naja check` and `naja build --target x86_64-unknown-linux-gnu --output NEW_ELF`
  with explicit owning roots and empty PATH: 14 checks and 14 ELF builds. All
  project bytes remained unchanged. The emitted files had ELF magic and x86-64
  machine metadata. These were compile checks, not canned native results.
- With the normal host execution environment and explicit WSL, generated main
  ran with exit 0, exact stdout `42\n` and empty stderr. Program-file testing
  reported exactly one passing smoke program, zero failed. Both used the real
  project context and a 2,000 ms native deadline.

## Partial creation and failed probe boundaries

The initial independent probe attempted to use a working directory longer than
260 Windows characters. Node returned `spawnSync ... ENOENT` before launching
the absolute compiler. Its artifacts and failure remain under
`target/project-cli-review-mVLtb0/captures/`. This does not establish a NAJA path
failure. The revised probe kept a short working directory and passed the deep
target as an absolute argument; the intended component-boundary tests passed.

One bounded external collision attempt watched the disposable parent, then
created `main.naja` with exact foreign bytes `FOREIGN-COLLISION\n` when the new
leaf appeared. The actual CLI exited 1 with empty stdout and:

```text
NJA040: cannot exclusively create generated file main.naja: AlreadyExists; OS error 80; owned partial project output was retained for inspection
```

The directory retained generated `naja.toml` and the exact foreign `main.naja`;
`test_smoke.naja` was absent. The watcher subsequently received another event and
overwrote its own `inserted` flag with `EEXIST`, causing the review script to
assert the wrong success branch. Its exit 1 and original bookkeeping are
preserved; they are not reported as a fully passing probe script.

The separate classifier verified the actual product diagnostic, exact retained
bytes, missing later output and unchanged hashes. It then invoked init once on
the retained target: exit 1, `target already exists`, empty stdout, unchanged
files. The watch flag was made sticky in the disposable script for future reuse;
the collision was not repeated. This is one observed exclusive-create collision
and retention check, not atomic confinement against adversarial filesystem races.

## Static assessment and practical limits

`init_project` resolves and inspects the destination, generates fixed bounded
bytes and checks the manifest plus both sources before creating a directory.
Those checks use the shared seed checker; no execution function is called.
Existing target inspection uses `symlink_metadata`; creation uses exclusive
directory creation and `OpenOptions::create_new` for every generated file.
Writes use `write_all`/`sync_all`; partial write/identity failures report retained
output instead of recursively deleting it. The real collision above exercises
the public CLI's write phase, supplementing the authored private-phase test.

All existing parent components are checked for ordinary directory/reparse status.
Raw traversal is checked before verbatim-path joining; input, resolved target and
generated file paths receive byte/component budgets. Leaf validation excludes
quotes, backslashes and controls before quoted TOML interpolation, followed by
actual shared manifest parsing. Accepted Unicode and punctuation remain data.
No concrete injection, overwrite or false-success path was found under the
documented stable-tree assumptions.

Default doctor only formats compiler-owned constants/enums. The new dispatch
runs before source/project loading, and only an explicit runner calls the existing
bounded `Runner::prepare`. Its support flags declare available command options,
not installed-distribution or executable-program readiness. `prepared` is not
reported as a user program run. No default PATH lookup or ambient configuration
loading was found in the code; the probes corroborate those boundaries without
claiming a process-trace audit of every OS component.

Path rechecks and canonical spelling are not authenticated inode/file-ID ownership
or an atomic directory-handle confinement API. Hostile replacement races, hard-link
provenance, mount ownership, disk-full/power-loss durability and ACL policy were
not established. Windows inherits the parent ACL; Unix creation modes and
directory flush code were not executed on a direct Unix host. Default doctor
success is not native runtime, clean-host, installability or dependency-closure
proof. No sandbox, security bypass, self-hosting or FC1/HATCH claim follows.

## Retained evidence identities

Independent completed cases/collision evidence:
`target/project-cli-review-K1DaW5/captures/`. Authored harness:
`target/project-cli-IUw79r/`. Source and evidence SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `bootstrap/driver/src/doctor.rs` | `7be07ac54b245c764ce3c46d647edfbd47e9ec39e869aeaf6055e43b6e9f6cfe` |
| `bootstrap/driver/src/scaffold.rs` | `2f517f542feda4aec879884c61ddd67982ff6cf736d1378d32e5f0db8d95d3d4` |
| `bootstrap/driver/src/main.rs` | `1adb34efaee0f283129f7c9b4a70d3d2986f954ff5df7773ec4021683f97eec4` |
| `scripts/test-project-cli.mjs` | `9fe62d4e4f7a78efc045b8245eb90c3656498406ef338d488411898378ed6ff0` |
| Built `naja.exe` | `5cfa30903c1ce5caf84aabbe3900e3c7388c70df37041543503ec4747ea8519a` |
| Initial probe snapshot | `8a578ee5501d0b07a3f953ba736e021f268b58d3ffd9bdb4c5ff645a451a9752` |
| Revised executed probe snapshot | `4a871b18413acffe136b8dcad41732830f8fd5612e84e0653f535d50c6b49f24` |
| Revised partial `summary.json` | `aef299ee402a0fed3aa4f0703e0e5ee09422d19ce4c978bbe04f6acaed7abd7c` |
| Original `collision.json` | `226a8da25ed4db2cc62d0beb19b3971b387c24bbd72931550663bbde9d74c5e6` |
| `collision-classification.mjs` | `969ad483b136d8688aa587d00f66d97039943c178b1d881b398ce0bbccaec195` |
| `collision-classification.json` | `f02eef7e8187307f1950d863bf6cd31be55fa718d2b7272a5eef1c8f4af1e657` |
| `namespace-additional.json` | `c34901e827155e87cc0b136a8e6e90a28f1fe15a470cbc1d84d2d652bfbd8edc` |
| Authored harness `summary.json` | `464d572c4c9cd8400dffaefb29b03eeb72c12974ae2b63dcba3e44e384b6cc0f` |

Selected generated files for the composed Unicode primary project:

| File | SHA-256 |
| --- | --- |
| `naja.toml` | `b8a8c43de4be14861206a6166f5906db53b10fd7f2084a753c64a064c80fd148` |
| `main.naja` | `d83686fbd93556208cb5d8293bc9c198b71b912aa765fdca1d76ab26a09cb2d4` |
| `test_smoke.naja` | `f2cb8480fe0ec678af36c48383cfcd0f0827a8e50b0313fd31da03efc9aa10a0` |

No severity is assigned because no actionable product defect was reproduced.
The retained launcher/bookkeeping failures are review limitations, not passing
commands or grounds to change product requirements.
