# NAJA CLI Preview (Experimental)

An installable thin adapter for explicitly checking, building and running saved
`.naja` files with a separately installed native NAJA compiler. Basic language
configuration and approximate TextMate coloring work without running a compiler.
`.py` associations are unchanged.

Set **NAJA: Compiler Path** to an absolute trusted native executable. No PATH
search, automatic installation, network request, dependency installation or
telemetry is performed. Optionally set **NAJA: Project Root** to the absolute
owning root to activate that project's aliases. There is no project discovery.
Compiler settings belong to the extension's workspace execution host; remote
and virtual environments are not verified by this preview.

Use the command palette:

- **NAJA: Check Saved File** invokes the real `check --json` protocol and publishes
  validated original UTF-16 ranges to Problems.
- **NAJA: Build Saved File to New ELF** asks for a new output and invokes the
  Linux x86-64 native backend. Existing files are refused by the compiler.
- **NAJA: Run Saved File** explicitly compiles and executes. Linux x64 is direct;
  Windows requires **NAJA: Windows Runner = wsl** and the compiler's documented
  local WSL prerequisites. Other execution hosts are unavailable.
- **NAJA: Cancel Compiler Command** requests forced cancellation of the observed
  compiler child. It cannot undo file writes or external effects, and does not
  guarantee process-tree termination. The run command has a native 5-second
  deadline as well as the adapter's host deadline.

Trust and an explicitly saved, clean, local `.naja` editor are required for every
compiler action. No compiler runs on activation, opening, typing, saving or trust
grant. The adapter never saves a document for you. Disk UTF-8 must exactly match
the editor snapshot, so unsupported encodings/BOM handling may reject. Changes
to editor version/text/URI, explicit settings or bounded project manifest/alias
bytes discard stale results. Edits/close/config changes clear diagnostics and
cancel active work; checks do not rerun automatically.

Source and combined subprocess output are each bounded to 1 MiB. Check/build/run
host deadlines are 10/30/15 seconds. Diagnostic transport accepts at most 32
ranges, rejects unknown fields, mismatched source/status/exit, out-of-range or
surrogate-splitting positions and malformed output. Operational compiler errors
remain output errors rather than semantic passes. Output is noninteractive;
stdin is closed. Commands use literal argument arrays and no shell. These
ordinary OS processes are not a sandbox, and filesystem observations are not an
atomic defense against hostile concurrent mutation.

There is no native LSP, DAP, completion, hover, rename, formatting, Test Explorer,
cell session, source debugger or full project resolver in this preview. The CLI
and language remain experimental; this package does not complete FC1 or HATCH.
Coloring is not the semantic authority. Native compiler delivery and clean-host,
cross-platform, remote and actual editor workflows need separate evidence.

Install a locally reviewed VSIX with VS Code's **Install from VSIX** action.
This local publisher identifier is not a Marketplace publisher verification or
signature. The VSIX is unsigned. Users of a packaged adapter do not install Node
or npm; packaging uses pinned official `@vscode/vsce` as a dev dependency only.

Development checks: `node --test tests/vscode/adapter.test.mjs` and
`node scripts/test-vscode.mjs` from the repository root. The latter checks the
real pinned native compiler without executing a program. See
`tests/vscode/PREREGISTRATION.md` in the repository for frozen assumptions and
evidence limits. Packaging from this folder:

```text
npm ci --ignore-scripts --no-audit --no-fund
node node_modules/@vscode/vsce/vsce package --no-dependencies --out artifacts/naja-cli-preview-0.0.1.vsix
```

This adapter follows the official [Workspace Trust guide](https://code.visualstudio.com/api/extension-guides/workspace-trust)
and uses the official [VSIX packaging tool](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).
