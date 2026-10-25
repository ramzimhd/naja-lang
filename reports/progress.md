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

Implemented slices now include edition-aware brace/named blocks, checked depth
markers, ordinary native multi-limb decimal integers, definite initialization,
Unicode 17 XID/NFKC names with original spans, and native comparison assertions.
The latest work-unit run passed 90 Rust tests and 23 ordinary-source/native checks
in WSL, including assertion failure exit 104. Native integer allocation is bounded
by a temporary 64 MiB arena; exhaustion reports exit 103 without truncation.
These work-unit outputs still need a new committed-source retained record.

An independent review at source `551214d` reran 14 native IR checks (394 arithmetic
and 150 comparison outputs), 18 source checks and ten further probes, including
812 native outputs. Its exact limits and hashes are in
`reports/reviews/HOSTED_NATIVE_V13.md`; later Unicode/assertion/CLI changes are
outside that review. The recovery suite now has 15 passing tests after fixing
conflict-stage index fingerprints. Its older retained 14-test run and the separate
synthetic coding-agent handoff remain historical evidence rather than a promise
of provider-outage recovery. All new L/C/FC1 contracts remain open.

Contributors use confirmed separate branches/worktrees and paths in
`planning/assignments.json`. The live reservation was explicitly migrated from
manual generation 1 to helper generation 2, retaining the outgoing record.
Old checkpoint fingerprints are preserved and require reconciliation. Current
work adds native run/test CLI commands, shared text/bytes literal decoding and an
explicit evidence audit for advancing retained verified source.

Next: integrate those scoped changes, record the complete source-specific checks,
review staged publication, then continue functions and the hosted value/runtime
foundations. Strings/booleans/floats, functions/classes/containers, full grammar,
productive libraries, cells, VSIX, self-hosting and measured productivity remain
incomplete. Parser support does not establish execution support, and agent timing
is not human productivity evidence.

Client discovery found supported Codex CLI resume/noninteractive interfaces.
No provider-launch supervisor, persistent service or automatic transfer is
running. Budget fields unavailable from the client remain unknown. Current chat
continuation/compaction is active; after a client or machine exit, manual relaunch
is required until an authorized runner has actually been implemented and tested.
