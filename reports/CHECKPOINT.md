# Seed checkpoint — October 24, 2026

The new authorized repository is public at
[ramzimhd/naja-lang](https://github.com/ramzimhd/naja-lang), under the owner-selected
Apache-2.0 license. No existing repository was overwritten. The initial English
specifications remain in commit `684f59efb35ec10e5fa43026e616c3df358108ea`.

The compiler is an experimental Rust B0 seed, not a HATCH release. It has a
lossless lexer/logical-line CST, a bounded parser/checker for explicit `i64(...)`
values, and an independent Linux x86-64 instruction/ELF emitter. Emitted programs
execute loops, branches, checked arithmetic and decimal output. Hosted `int` is
not narrowed; bare hosted integer expressions reject as unsupported.

## Executed evidence

At source `6e702caec0dae3ec90a92d57490387f97d7e09a8`:

- 43 Rust tests, formatting and Clippy passed.
- 37 planning mutation tests passed, including false verification, ownership,
  commit length and traversal/junction cases.
- 25 native/CLI checks passed in Ubuntu WSL and on a native Linux CI runner.
- Six Windows setup and ten offline Bash setup-logic checks passed. These do not
  prove real Linux/macOS installer mutation paths.
- Windows x64, Linux x64 and macOS arm64 hosted seed build/test jobs passed in
  [CI run 40097632722](https://github.com/ramzimhd/naja-lang/actions/runs/40097632722).
  Linux machine-code execution was intentionally limited to the Linux job.
- A fresh Git checkout passed evidence/hash validation. Raw retained log bytes
  are protected from line-ending conversion by `.gitattributes`.
- Anonymous HTTPS checks confirmed public access, owner ID and license.

Commands, versions, exit codes, timestamps and sanitized logs are in
`reports/checks/`. Internal contributor reviews are in `reports/SEED_REVIEW.md`,
`reports/governance/` and `reports/language/`. These are AI-assisted reviews,
not independent human/external audits. A missing original pre-first-push scan
transcript remains disclosed. No failed or not-run release proof is counted green.

The first CI run warned that the v4 action declarations used Node 20 while the
runner forced Node 24. The workflow now pins official v6 action commits whose
metadata declares Node 24. That workflow revision requires its own remote run;
the earlier passed run remains historical evidence, not proof of that revision.

## Open work

HATCH retains all 139 mandatory requirements, 8 future objectives, 38 tasks and
19 gates. No release gate is complete. Full grammar parsing, Unicode identifiers,
hosted semantics/runtime, aliases/depth interpretation, native platform backends,
self-hosting/B1–B3, productive libraries, freestanding QEMU, robust networking,
cells, LSP/DAP/VSIX and productivity comparisons remain incomplete.

The Python 3.15.0 reference is pinned by immutable upstream commit and ten source
hashes. Its 278 production entries all remain unverified. Productivity templates
remain unmeasured; no code or time advantage is claimed. No automatic cell replay,
fake debugger, interpreter fallback or opaque embedded seed is supplied.

The next compiler work is T05: expand the shared frontend against the pinned
production inventory with positive/negative fixtures, retaining separate parsed,
supported and verified claims. Finish T02's real setup mutation/target checks and
T04's evidence hardening without treating shell fixtures as product installation.
See `launch/HANDOFF.md` for exact restart commands and current Git state.
