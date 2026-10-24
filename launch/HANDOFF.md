# Handoff — October 24, 2026 seed checkpoint

HATCH is not complete. The new authorized public repository is
https://github.com/ramzimhd/naja-lang, under the owner-selected Apache-2.0 license.
Workspace: `C:/naja`; integration branch: `agent/integrator-H0`, tracking
`origin/main`. The original specifications remain in commit
`684f59efb35ec10e5fa43026e616c3df358108ea`; no earlier implementation was reset.

Implemented: pinned Rust/Cargo 1.97.1 seed/setup/inventory; lossless shared lexer
and logical-line CST; bounded explicit-i64 parser/checker; direct Linux x86-64
instruction/ELF generation with checked arithmetic, comparisons, assignment,
branches/loops and integer output; CLI lex/check/build/help/version; planning
validator/evidence recorder; English governance and internal review reports.
All executed literals require `i64(...)`; imports/annotations never narrow int.

At source `6e702caec0dae3ec90a92d57490387f97d7e09a8`, 43 Rust tests, 37 planning
mutation tests, 25 native/CLI checks, six Windows setup checks and ten offline
Bash setup-logic checks passed. Formatting/Clippy and fresh-checkout log hashes
passed. Hosted Windows x64, Linux x64 and macOS arm64 seed jobs passed in
https://github.com/ramzimhd/naja-lang/actions/runs/40097632722. Linux code executed
on Linux CI and local Ubuntu WSL; Windows/macOS emitted-code execution is absent.
Exact commands/versions/exit codes/log hashes are retained under `reports/checks/`.

The first CI used v4 actions and warned about Node-20 declarations. The workflow
now pins official v6 Node-24 actions; inspect the new run separately. Private
vulnerability reporting is enabled. Issue/PR templates and a retained current-push
scanner are included. The original pre-first-push scan transcript was not saved
as a file; this historical evidence gap remains disclosed.

Review fixed bare-literal narrowing, quadratic/unbounded diagnostics, same-line
suite budget bypasses, assignment path/case normalization and commit lengths.
Regression tests and focused re-review passed. Log `-text` attributes preserve
recorded bytes across platforms. The recorder requires committed source and adds
command/exit annotations for silent tools. Its original empty formatting record
is retained privately, without presenting it as valid proof.

No complete grammar, Unicode identifiers, hosted integer/runtime semantics,
functions/classes/collections/errors/modules, aliases/depth interpretation,
full backends/linker, B1–B3, core/QEMU, productive libraries/networking, cells,
LSP/DAP/VSIX or measured productivity exists yet. All 19 release gates are open.
The pinned Python 3.15.0 reference has 278 production entries, all unverified.
Setup fixtures do not prove actual Linux/macOS installation or missing-tool
installer mutation paths. Linux SIGPIPE retains its documented default policy.

Resume from PowerShell in `C:/naja`:

```powershell
git status --short --branch
git log -5 --oneline
git remote -v
git worktree list
Get-Content planning/state.json, launch/HANDOFF.md
node scripts/validation/check-planning.mjs
cargo test --workspace --locked --offline
cargo clippy --workspace --all-targets --locked --offline -- -D warnings
cargo build --workspace --locked --offline
node scripts/test-native.mjs
```

Continue T05 against the pinned production inventory with specification-derived
positive/negative fixtures. Keep parsed/supported/verified separate; the CST is
not a complete parser. Finish T02 setup/target gaps and T04 evidence hardening.
T35 is a partial current-tree English audit; future UI still needs validation.
T36 preregistration must precede benchmark-driven implementation. Do not weaken
the remaining requirements or infer productivity from agent timing.

Inspect actual worktree ownership before edits. Contributor worktrees remain
under `C:/naja-worktrees/` for review; completed changes were cherry-picked by
the sole integrator. After this checkpoint, no contributor may write without a
new assignment. No background work is promised. Preserve ignored local reports,
authentication helpers and reading attachments; do not publish them. Git
Credential Manager authenticated the successful push. Direct gh device login
did not complete in this process; use an authorized connector or normal login
when CLI access is needed. Do not extract or display tokens.
