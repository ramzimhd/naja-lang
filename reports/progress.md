# NAJA implementation progress — October 25, 2026

Contract revision: 1.3. Language edition: 2026.1. Integration owner: `/root`.
FC1 and HATCH remain incomplete; all 19 inherited release gates remain open.

The founder's continuation and L01–L15/C01–C07/FC1 contracts are preserved in
`docs/continuation/` at source `a75364aa3b7989117c1c1c631ba507ca9bfdafbb`.
Existing requirements, evidence and assignment history are retained. New
acceptance work is additive, with explicit revalidation rather than resetting
old results or presenting an expanded obligation as already verified.

Fresh local baseline at `05df50551d9591036e4403e26d626ee19d1c2a15`: 43 Rust
tests, 25 native/CLI checks in Linux x86-64 WSL, and 37 planning tests passed.
The matching hosted [CI run](https://github.com/ramzimhd/naja-lang/actions/runs/40098333023)
also completed successfully on Windows, Linux and macOS. Emitted programs ran
on Linux; Windows/macOS jobs checked the seed and emitted artifacts only.
The fresh local output is in the active tool transcript; new retained exact-source
logs will be recorded after integration. Existing retained records remain valid
only for their stated source and acceptance scope.

Current unverified work: shared dialect-aware brace/named block lexing and CST
metadata; native lowering and depth validation for the bounded i64 subset;
atomic private checkpoint/recovery helpers; and additive contract/FC1 validators.
Contributors use confirmed separate branches/worktrees and non-overlapping paths
listed in `planning/assignments.json`. The integration reservation is an atomic
directory under the common Git directory; timestamps alone cannot transfer it.

Next: review and integrate the workers' scoped commits, execute positive and
negative native block tests, retain evidence, then continue hosted value/runtime
foundations. The current explicit-i64 compiler still lacks ordinary hosted
values, functions/classes, complete grammar, productive libraries, native cells,
VSIX, self-hosting and measured productivity. Parser support does not establish
execution support, and agent timing is not human productivity evidence.

Client discovery found supported Codex CLI resume/noninteractive interfaces.
No provider-launch supervisor, persistent service or automatic transfer is
running. Budget fields unavailable from the client remain unknown. Current chat
continuation/compaction is active; after a client or machine exit, manual relaunch
is required until an authorized runner has actually been implemented and tested.
