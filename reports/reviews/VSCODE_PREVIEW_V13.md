# Independent VS Code CLI preview review

Reviewed October 25, 2026 at exact candidate
`862e911d97b7fc8c9c61aa0da830f5550370488d`, on separate branch
`agent/vscode-review-v13`. No actionable product defect was reproduced.
Only this report is committed; production, harnesses, planning and earlier
artifacts were preserved. This is a review of an experimental CLI adapter,
not acceptance of FC1-10, full VSIX delivery, LSP, DAP or cells.

Read the shared instructions, specifications 08/09, current acceptance contract,
adapter core/host, manifest/configuration/grammar, frozen preparation
`aa414355e1b84ba4c999d90e6b5e0480a04c54cb`, tests and execution evidence.
The actual compiler remains exactly
`662bcdcff3a5742d9271b5f449becaa724503d78`: the frozen harness checked no tracked
compiler differences or untracked compiler sources. Later root integrations and
the proposed compiler-source selection option are outside this review.

## Execution and boundaries

Windows x64; Node `v24.11.0`, Rust `1.97.1 (8bab26f4f 2026-07-14)`, Cargo
`1.97.1 (c980f4866 2026-06-30)`. Native execution used WSL Linux
`6.6.87.2-microsoft-standard-WSL2`, x86_64, reported stack limit 8192 KiB.
No Python, network, dependency installation, provider/auth operation, visible IDE
helper, Workspace Trust bypass or security flag change was used by this review.

| Actual command | Exit and result |
| --- | --- |
| `node scripts/test-vscode.mjs` | 0; unchanged 12 unit tests and nine harness groups passed; locked/offline compiler build and real semantic checks |
| `node target/vscode-independent-review.mjs` | 0; 31 independent groups passed in 3,044 ms |
| `node target/vscode-followup-review.mjs` | 0; six additional groups passed in 3,178 ms, including actual file-symlink rejection |
| `node target/vscode-output-links-review.mjs` | 0; three output identity controls passed in 151 ms |
| `git diff 662bcdcff3a5742d9271b5f449becaa724503d78 -- bootstrap/ backends/ Cargo.toml Cargo.lock rust-toolchain.toml` | 0; empty |

Independent expectations were written before executing each probe. The first
suite used a 120-second overall cap; subsequent suites used 60 seconds. Process
plans retained the adapter's 10/30/15-second check/build/run deadlines, five-second
native deadline and 1 MiB combined output cap. Deliberate child deadline tests
used shorter fixed 100 ms/50 ms limits, not increased product budgets. The authored
harness retains its 45-second build, 10-second command and 120-second suite caps.
All expected refusals, nonzero native exits and controlled-invalid results were
asserted as failures; no expectation was changed after execution.

The review ran actual compiler processes and generated ELF, plus a mocked VS Code
API host. **Actual IDE interaction and an actual extension-host command workflow
were not run.** The author's isolated Code CLI install/version/list observations
were inspected, not repeated or relabeled as this review's installation evidence.
They record Code 1.142.0, commit `6d62b1d5dace93a33b3a6d3eca1317bd5e15bcb1`,
and listing `ramzimhd.naja-cli-preview@0.0.1`, with the retained deprecation warning.
No Marketplace/release publication, signature, clean-host or remote proof follows.

## Independent results

- Manual/trust gates: a mock host using the real selected compiler published the
  expected Problems range only after explicit Check. Activation and edit/close/
  configuration events launched nothing and never saved. Untrusted, dirty,
  closed, untitled, nonlocal-authority, Python-language and `.py` source cases
  rejected before launch. The manifest associates only `.naja`, makes compiler
  path and Windows runner machine-scoped, and has no automatic installer or task.
- Freshness: independently changed URI, version, text, disk bytes, settings,
  manifest and alias bytes before launch and after a simulated result: all 14
  combinations rejected without accepting diagnostics. Two overlapping commands
  accepted only the newer response, even when the older runner ignored its abort
  signal. The actual disk/project readers were retained in these mock-host tests.
  A synthetic control with the final freshness test removed accepted stale data;
  the original `executeFresh` rejected the same scenario. This is an oracle
  sensitivity check, not a production edit or a full mutation-test campaign.
- Protocol: real CLI check with empty PATH preserved the original CRLF/BMP/astral
  range (line 1, UTF-16 characters 14..20). Additional malformed controls rejected
  a different source identity, schema/count/unknown-field errors, invalid UTF-8,
  partial or additional JSON, stderr, invalid ranges and surrogate splitting.
  The author's LF/CRLF/CR, alias and omission checks also passed unchanged.
  Operational errors remain errors, not semantic passes. Its infinite-loop
  check returned without executing the program.
- Literal process arguments: metacharacters, Unicode and quotes arrived unchanged
  in a real observed Node child. Static inspection and existing mocks confirm
  `shell:false`, `windowsHide:true` and ignored stdin. Exact combined output of
  1,048,576 bytes succeeded; 1,048,577 rejected. Deadline, abort, pre-abort and
  signalled-child paths rejected with their expected error kinds.
- Disk input: exactly 1 MiB of multibyte UTF-8 was accepted; one additional byte
  rejected. Invalid UTF-8 and a BOM/editor-text mismatch rejected. Actual source
  and compiler file symlinks rejected without changing privileges. Project files
  accepted 65,536 bytes and rejected 65,537; missing versus empty files changed
  the fingerprint, and parent traversal rejected. Only the two documented project
  files are fingerprinted; this is not a complete project dependency resolver.
- Build preservation: actual CLI plans refused an existing output, its hardlink,
  and a case-equivalent source spelling without changing either source or marker.
  Exact source output rejected before launch. Actual followed and dangling output
  symlinks failed CLI creation, preserved the links/target and created no missing
  target. The CLI uses exclusive new-file creation; no race-confinement guarantee
  is inferred from these observations.
- Real execution: a new Linux ELF compiled from a Unicode/metacharacter path;
  list alias mutation printed `42` through the actual Windows/WSL CLI plan.
  Default Windows Run rejected until explicit WSL selection. A separate failing
  program printed `71`, then exited 104 with NJA204; preceding stdout and failure
  stderr were retained. This exercises the plan/core and real compiler, not a
  Code command palette, progress UI or editor cancellation workflow.

## Process and filesystem limits

Cancellation/deadline/output overflow calls `kill('SIGKILL')` on the observed
child and rejects immediately. It does not wait for an exit acknowledgement or
kill a process tree. An independent mock where `kill` returned false still
rejected as cancelled, with no exit observed. This matches the package's explicit
request-only limitation; callers must not interpret failure as a proved cleanup
or sandbox boundary. Timeout/cancel/overflow rejection also does not return the
partially collected stdout/stderr. Completed nonzero commands do preserve output.

Disk checks are bounded observations around reads; they are not an atomic
snapshot covering later compiler reads. Ancestor links, file replacement between
observations, ABA changes, arbitrary executable provenance and hostile concurrent
filesystem mutation are not proven confined. Compiler selection checks native
magic, not publisher identity or a cryptographic executable pin. Selection remains
explicit and trusted. No rollback, arbitrary modified-executable safety or
process-tree termination is claimed.

The manifest/grammar supply basic approximate coloring, pairs/comments and a
folding setting. Rendering, multiline/incomplete editing quality, keyboard
workflow, real progress/cancellation UI and all announced editor platforms remain
unverified here. `.py` takeover, npm runtime dependencies, automatic source
execution, downloads or telemetry were not found in the packaged implementation.
Native LSP/DAP, completion, formatting, rename, Test Explorer, persistent cells,
self-hosting and the remaining FC1/HATCH obligations remain open.

## Supplied VSIX and evidence identities

Independently read the supplied unsigned `naja-cli-preview-0.0.1.vsix`: **15,947
bytes**, SHA-256
`4ec98c344702801e6195f364578c500914ad1c75e4dec18d8898dca7531759a0`.
Verified all nine ZIP central/local entries, decompression lengths and CRCs.
Its seven packaged implementation/configuration/document files exactly equal
the candidate's Git blobs. The other two entries are VSIX/XML metadata. The exact
allowlist contains no dependencies, development logs, artifacts or private
workspace/profile paths. It matches the recorded archive inventory; integrity
does not establish publisher trust or signature.

Retained independent expectations, scripts, summaries, raw CLI streams and source/
ELF artifacts are under `target/vscode-independent-1RMO7P/`,
`target/vscode-followup-lBFtbP/` and `target/vscode-output-links-0B8EYD/`.
The unchanged authored rerun is under `editor/vscode/artifacts/checks-fHUuOt/`.
Earlier review artifacts remain intact. These are ignored local evidence, not
files included in this scoped report commit. SHA-256 identities:

| File | SHA-256 |
| --- | --- |
| `editor/vscode/core.cjs` | `8e093fa554d980cf50c34b6cd4251e10815efdfbcd8d1a6af5d772fae0fbbb44` |
| `editor/vscode/extension.cjs` | `a04765a72c874b927fde964da96a6fb8bd56cf372fe1dfe291460bd277e35429` |
| `editor/vscode/package.json` | `7833dd6b3c182113d8b73cb1abf1df292df5a11114952d2609b6251eef4f2c3f` |
| `editor/vscode/package-lock.json` | `56d8c1f93b882f8c068a61b28f63c361e75710298ee52f3ec25b1b74973e8772` |
| Language configuration | `501b8020a382bca53ef2e17812c46b2cdcc0899a204858adc484365642a21216` |
| TextMate grammar | `0f264b8ab85f577700778b4baf99f507ce57a440de9ee1e2d3285574cc558433` |
| Built compiler `naja.exe` | `cb89274a2bfe10269cad1c7808b3f183781da5a383922a743c4ec43123bce5ad` |
| Authored rerun `result.json` | `4b70bdb034f58cc5f2ed2354ce4bbfd157bb36df68a1e5fd54401db045e27e5e` |
| Independent `probe.mjs` | `79cba8d95ea12ac237d1fec9af7a6f3926ce6559dac22f1469b6eadc24ee470f` |
| Independent `expectations.json` | `ec1b27e7b7ec9085f8440f2ae52a30ef8fbc0aa0ff5ae2a31c4e21d2b69cb9fd` |
| Independent `summary.json` | `e39d758f4b888df0799b5bef2bc6c968dccfd6d0ad366533f6b4b8086e912c82` |
| Independent `archive.json` | `b44f71040bd066f33c010a6ce22f6305a95866c682a2f1874a056901805ff280` |
| Independently built list ELF | `20ae0b4cbfcdadde882f22ba7197af5ec6968a16cb7700bb29958280c95b3bba` |
| Followup `probe.mjs` | `acdc2fef3546289acb95f9a2ccf7d73e92585916357e1d154a6d46ab8cf30124` |
| Followup `summary.json` | `19137fc488f4ca6fe409f71d03aaeaab3549795f57fb67ddb877c0b6e5dec234` |
| Output-link `probe.mjs` | `11adc8baf79abebeaf9e177cd0c2c2f5676b226bedfbf8f8756c1f35325b6e5a` |
| Output-link `summary.json` | `b0c4dd97c005dacddc53f03342e5901370f7731f326ead8939066e702e21b67d` |

No severity is assigned because no actionable defect was reproduced. The
documented limits and unexecuted editor/platform acceptance remain open.
