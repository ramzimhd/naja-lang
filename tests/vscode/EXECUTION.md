# Experimental CLI preview execution

Observed on October 25, 2026, Windows x64, Node 24.11.0. Preparation and frozen
checks were committed as `aa414355e1b84ba4c999d90e6b5e0480a04c54cb` before execution.
Compiler source was pinned to `662bcdcff3a5742d9271b5f449becaa724503d78`;
the harness confirmed no tracked or untracked compiler-source differences.

`node scripts/test-vscode.mjs` exited 0: 12 Node unit tests and nine harness groups
passed. These cover trust and saved-source gating, literal argument boundaries,
bounded output/deadline/cancellation, schema/source/range rejection, stale result
discard, mocked Problems mapping, locked/offline compiler build, real semantic
checks with LF/CRLF/CR original UTF-16 ranges, explicit project aliases,
operational error rejection and the 32-diagnostic omission protocol. One valid
check contains an infinite loop: checking returned JSON without running it.
The build reused the existing Rust toolchain/cache; it is not clean-host proof.

Official `@vscode/vsce` 4.0.0, installed locally with lifecycle scripts disabled,
packaged using:

```text
node node_modules/@vscode/vsce/vsce package --no-dependencies --out artifacts/naja-cli-preview-0.0.1.vsix
```

The resulting unsigned artifact is 15,947 bytes, SHA-256
`4ec98c344702801e6195f364578c500914ad1c75e4dec18d8898dca7531759a0`.
It is retained locally at `editor/vscode/artifacts/naja-cli-preview-0.0.1.vsix`,
which is intentionally ignored. The archive's exact nine-entry allowlist contains
the manifest, README/license, two adapter modules, language configuration and
TextMate grammar. No npm runtime dependencies, development files, retained logs,
profile data or private workspace/profile paths are included. Every archive
entry's hash is recorded in [observations.json](evidence/observations.json).

VS Code 1.142.0 (`6d62b1d5dace93a33b3a6d3eca1317bd5e15bcb1`, x64) successfully
installed the local VSIX into a fresh owned user-data/extensions directory. Its
CLI listing returned exactly `ramzimhd.naja-cli-preview@0.0.1`. The installed
official CLI was invoked through its native executable and JavaScript entry
point with `ELECTRON_RUN_AS_NODE=1`, as used by the installed `code.cmd` wrapper;
no shell or Marketplace publication was used. Install/version/list commands
exited 0. The separate directory is retained under the ignored artifacts folder.
The install command emitted VS Code's `DEP0169` / `url.parse()` deprecation
warning on stderr; it is retained and does not change the observed exit 0.

The [machine-readable observations](evidence/observations.json) retain exact
commands, exit codes, raw log hashes, local raw paths, sanitized public log paths
and their independent hashes. Public logs replace repository/profile paths and
normalize line endings to LF and remove trailing horizontal whitespace from the derivative;
they are derivatives, while unchanged raw captures remain local and ignored.
The initial packaging success was repeated once to capture packaging output with
the installation observations. Before these tests, an initial syntax-check
invocation from the wrong working directory reported `MODULE_NOT_FOUND`;
correct root-directory syntax checks passed. That setup transcript was not
retained as raw evidence and is not counted as compiler execution.

Actual editor interaction and extension-host command workflows were **not run**.
Build/run argument plans are unit tested; editor build/run, WSL execution,
TextMate rendering, other VS Code versions, remote hosts and other platforms
need separate execution evidence. No native LSP/DAP, completion, source debugger,
cells, test discovery, complete project resolver, FC1 or HATCH acceptance is
claimed. This is an experimental CLI adapter with an installable local VSIX.
