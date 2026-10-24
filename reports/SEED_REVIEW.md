# Internal seed review — October 24, 2026

This is internal AI-assisted contributor review, not an independent human audit
or HATCH release acceptance. Contributors used separate branches/worktrees; the
integrator reviewed and merged their scoped commits.

## Frontend and native spike

The frontend contributor reviewed the integrator's driver and native emitter.
Three defects were reproduced and corrected before recording final native tests:

1. A file-level i64 import implicitly narrowed bare literals. Every executable
   literal now requires `i64(signed_decimal_literal)`. Bare integers reject even
   after imports, annotations or in mixed arithmetic. Hosted int is still absent.
2. Formatting every lexical diagnostic re-scanned source prefixes and produced
   unbounded stderr. The CLI now indexes original line starts once, reports at
   most 32 diagnostics and appends an omitted-count line. Focused tests covered
   Unicode data, CR/CRLF and a fully malformed 1 MiB input.
3. Same-line suites bypassed node/nesting accounting. They now use the same
   accounting as indented statements. Regressions cover the 65th suite level and
   more than 10000 statements.

Re-review reproduced rejection of all three earlier failures and found no further
concrete defect in that scope. Inspection covered signed comparison branches,
overflow flags, stack offsets, minimum-i64 decimal output, partial writes and ELF
permissions. Native tests also cover stdout errors and the documented default
Linux SIGPIPE behavior (141); error messages cannot be guaranteed after a signal.

## Planning validator

The setup contributor independently probed the planning validator and reproduced
three false passes: repeated path separators hid overlapping scopes; differing
case/slashes hid shared worktrees; and 41–63-character commit strings passed as
valid evidence. Normalization and exact 40/64-character hash validation now reject
them. Four additional tests cover those cases plus traversal/junction escape.

Structural validation checks retained logs, hashes, references and status
consistency. It cannot prove honest command execution, full requirement coverage,
or that a purported commit exists. Those limits remain explicit.

## Other observed failures and limits

The first root `cargo test --workspace --locked --offline` correctly failed
because a workspace lockfile had not yet been generated. `cargo generate-lockfile
--offline` created a source-only lockfile; later locked/offline tests pass.
An npm PowerShell wrapper briefly encountered endpoint protection during tool
inspection. The same normal command later succeeded without a policy change.
The original failed observation was not recast as success.

Native Linux/macOS tool installation, mutation of a missing-tool setup, complete
grammar/semantics, strict autonomous rebuilds, clean-user product workflows,
freestanding QEMU, native cells, editor tooling and productivity remain unverified.
Setup fixture tests do not prove real Linux/macOS installation. Real command
records and sanitized logs are retained under `reports/checks/`.

The first formatting evidence record had empty captured output because successful
`cargo fmt --check` is silent. The planning validator rejected that record. It
was retained privately, the recorder gained explicit command/exit annotations,
and the check was rerun under a new evidence name. Captured tool output remains
separate from those recorder annotations. Final records are made only after
committing source changes.
