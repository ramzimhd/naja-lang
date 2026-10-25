# CLI adapter assumptions and frozen checks

Prepared before running the adapter tests against compiler source
`662bcdcff3a5742d9271b5f449becaa724503d78`. This is an experimental CLI preview,
not completed FC1-10, native LSP/DAP, cells, test discovery or HATCH delivery.

Only explicit Check/Build/Run commands may launch the manually selected absolute
compiler executable. Activation/open/change/save/trust grant never launches one.
Untrusted/virtual/untitled/non-.naja/dirty/closed files reject. `.py` is not taken
over. Compiler path is machine-scoped, project root is explicit and optional.
The adapter runs in the workspace extension host; local and remote environments
need their own compiler. Remote behavior is unverified until separately tested.

Source must be a regular UTF-8 disk file, at most 1 MiB, exactly equal to the
saved clean editor snapshot. Recheck disk/editor URI/version/text, configuration
and trust before starting and before accepting results; edits/close/config changes
cancel the active child and discard stale diagnostics. No automatic save occurs.
Explicit project context snapshots only `naja.toml`/`naja.alias` under that root,
each at most 65,536 bytes; compare their retained hashes before/after commands.
All process calls use argument arrays, shell=false, hidden Windows windows and
null stdin. Check deadline 10 seconds, build 30, run host deadline 15 and native
deadline 5. Combined stdout/stderr is capped at 1 MiB. Cancel/overflow/deadline
requests forced termination of the observed compiler child; no process-tree
termination guarantee, external-effect rollback or sandbox claim.

Check accepts exactly one schema-1 JSON object, the exact supplied absolute
source identity, exit/status agreement, empty stderr, at most 32 diagnostics,
bounded nonempty code/message (64/8192 characters), safe omission count and valid
ordered original UTF-16 ranges within the captured text, without splitting a
surrogate pair. Invalid/truncated/extra output is transport failure, never a pass.
Build uses the actual CLI's new-output-only GNU/Linux ELF option. Run is direct
on Linux x64; Windows requires the user's explicit WSL setting. Other execution
hosts reject. No shell expansion, download, dependency install, telemetry,
credentials, background execution or editor-side interpreter is implemented.

Unit tests must cover trust gating, literal metacharacter paths, no automatic
spawn, Unicode ranges, malformed transport, stale URI/version/text/config/disk,
cancellation, output/deadline limits and process errors. A separately bounded
real-compiler harness pins source 662bcdc, builds locked/offline (45 seconds),
checks valid/invalid/Unicode/alias sources (10 seconds each), caps captured output
at 1 MiB and the suite at 120 seconds, retains failures, and never executes user
programs. Mocked VS Code APIs are unit evidence only.

Package using official pinned `@vscode/vsce` 4.0.0 (Node >=22; current Node24),
installed locally with lifecycle scripts disabled. It is a packaging-only dev
dependency; the VSIX has no runtime npm dependencies. Preserve lock/integrity.
VSIX install may use an isolated local profile/extensions directory. CLI install
and listing are installation evidence, not an observed extension-host/editor
workflow. Do not claim IDE end-to-end success without running that workflow.

Official references: [Workspace Trust](https://code.visualstudio.com/api/extension-guides/workspace-trust),
[publishing/VSIX packaging](https://code.visualstudio.com/api/working-with-extensions/publishing-extension),
[contribution points](https://code.visualstudio.com/api/references/contribution-points).
