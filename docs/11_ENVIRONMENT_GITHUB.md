# 11 — Environment Preparation and Public Repository

## Authorization

The founder requests environment preparation, a new public GitHub repository and development through HATCH acceptance. This does not authorize deleting repositories, publishing personal folders, purchases, secret exposure, firewall changes, unapproved reboots or bypassing security controls. Existing authorized coding-agent accounts are development aids, not NAJA dependencies; do not create additional paid accounts.

## E0 — Inspect before installing

Identify actual OS/architecture, shell, workspace, disk/memory and Git, GitHub CLI, VS Code, Rust/Cargo, Node/npm, native tools and WSL availability. Inspect existing Git changes and active work. Write private `launch/local/environment.json` and a sanitized public technical summary.

Windows is a likely host, not an assumption. WSL is optional. Required elevation, feature activation or restart is a specific blocker; continue independent work.

## E1 — Pin justified tools

Proposed seed stack: stable Rust/Cargo, Git/GitHub CLI, VS Code and Node LTS/npm for VSIX packaging. Add target-native tools and QEMU only when needed; LLVM is optional. Normal NAJA tests/scripts use no Python.

Verify current versions, licenses, origin and compatibility from official sources at installation. Pin exact versions/hashes; “latest” is not reproducible. Do not install unused anticipated tools. Verified prebuilt seeds are allowed; upstream rustc/LLVM Python-dependent builds stay outside the required NAJA path. [S05, S06, S19]

## E2 — Controlled setup

Prefer user-scoped official installers/package managers. Inspect downloaded scripts and verify integrity; do not execute opaque remote commands. Preserve sufficient existing installations. Store secrets in normal authentication mechanisms, never repository configuration.

Implement idempotent `scripts/dev/setup.ps1` and `setup.sh` with diagnostic/dry-run modes. Explain required interactive/elevated actions precisely. Do not circumvent missing permissions.

## E3 — New repository and real identity

Use the authorized GitHub connector or authenticated CLI. Read the identity and relevant repositories before writing; never invent an owner. Proposed name: `naja-lang`, under the explicitly selected or unambiguously authenticated account.

Check name collisions. Never overwrite or expose an unrelated existing repository. Resolve the one genuinely unknown owner/name decision while continuing local work.

```sh
gh repo create OWNER/naja-lang --public --source . --remote origin --push
```

This is a future command example, not an executed action. Resolve `OWNER` first. [S16]

## E4 — Audit before first push

Use a dedicated folder and explicit staged-file list. Inspect `git diff --cached`, secrets, private paths, binaries and hidden files. Do not publish other projects, private conversations or unauthorized personal identity/contact information.

Ignore keys/tokens, `.env`, private reports, profiles, caches and builds. Scanners complement rather than replace reading the staged diff. Sanitize public logs.

## E5 — English documentation and governance

Revision 1.2 replaces the previous EN/FR README instruction. Publish an English-only canonical README, specifications, agent prompts, comments, help, diagnostics, examples, contribution/security guides, code of conduct and issue/PR templates. No French companion copy is required or bundled. Unicode test data remains permitted and identified.

Tell the long-held-idea/AI-assistance story without invented personal facts. State real implementation status; quickstarts must be executed before becoming supported examples. Keep unimplemented APIs under `spec-examples/`. No false green badges.

Publish the selected Apache-2.0 proposal only under valid owner authorization, with dependency notices and provenance. Review imported/ported code rights. Do not fabricate a DCO consent or claim AI output has been independently audited. [S18]

## E6 — CI and releases

Add real per-OS checks for syntax, semantics, native generation, independence, LSP/DAP, VSIX, cells and productivity evidence. A README-only green job does not validate the compiler. Pin workflow actions by reviewed SHA, minimize permissions and isolate untrusted PRs from secrets/publication. [S17]

Use only authorized resources; check runner conditions and obtain permission for new charges. Do not claim account protections that are unavailable. Before release: actual tests, manifests, checksums, notices, honest status and current English documentation. GitHub publication is within the mandate. Marketplace publication needs an authorized publisher; a blocked publisher does not excuse missing installable VSIX files. Never invent signing/notarization.

## Updating an active project

Do not recreate an existing repository or overwrite tracked progress. Apply prompts 05/06 by ID-aware merge. Preserve code, history, test logs and evidence; record revalidation needs separately.

Keep interactive caches/history/output private. Do not disable executable-memory protections. Keep Rust/C++ benchmark toolchains in a declared comparison environment, not the NAJA distribution or independent rebuild environment. Translate public narrative/log messages without falsifying original raw evidence; retain originals privately when needed and publish a faithful English summary.
