# Exact decimal frontend log retention

This bundle preserves four actual stored logs from the frontend contributor's
`C:/naja-worktrees/exact-literal-frontend/target` directory. Their 26,591 bytes
are retained losslessly as base64, with lengths and SHA-256 hashes in
[EXACT_DECIMAL_FRONTEND_EVIDENCE.json](EXACT_DECIMAL_FRONTEND_EVIDENCE.json).
The stored captures are UTF-8 text with CRLF; no newline conversion was applied.
This does not establish original stdout/stderr separation or byte encoding before
the text captures. Commands, exits and WIP associations below are the original
contributor's report, corroborated by the stored test/Clippy output.

| Stored log | Bytes | Result | SHA-256 |
| --- | ---: | --- | --- |
| `exact-frontend-before-migration.log` | 1175 | Exit 101: 1 focused test passed, 1 failed, 125 filtered | `1f452b064e6a1632fc0c33fb2ab771849526c1fcbad0b36e4aad9fb4fc4e4e85` |
| `exact-frontend-tests-first.log` | 13096 | Exit 101: 4 unit tests passed; 136 syntax tests passed, 1 failed | `3db21e5898bc3e556dc76e5d5a4079e7cabd55645c9cbf8e2c09e0250f84083d` |
| `exact-frontend-tests-final.log` | 12004 | Exit 0: 4 unit and 137 syntax tests passed; 0 doctests | `518628dc49d6687920a29a7a6ea6593e1ea24c954e6f79512c5e6bfd9d08e0ed` |
| `exact-frontend-clippy.log` | 316 | Exit 0: strict frontend all-target Clippy | `8194b4976100cdf148b748ff20a1253211f7b8ac9fd4c80254beea54c835e564` |

Original commands, run in that contributor worktree:

```text
cargo +1.97.1 test -p naja-frontend --test syntax typed_literals --locked --offline
cargo +1.97.1 test -p naja-frontend --locked --offline
cargo +1.97.1 test -p naja-frontend --locked --offline
cargo +1.97.1 clippy -p naja-frontend --all-targets --locked --offline -- -D warnings
```

The first failure occurred at HEAD
`546f8e366bba182263afd5be1cb4068c15356ea7` with uncommitted scanner/API edits
and unchanged old tests. The old decimal-suffix rejection oracle failed on
`1e3Parcel` after intended lexical expansion. It remains a failed observation;
later expectation migration does not turn that log into a pass.

The first full suite ran at amended ADR HEAD
`3fa7e09ceb82365948dd2f9793cdbf44dc5dc12f` with uncommitted implementation/new
tests. Its new metamorphic assertion compared LF and CRLF `Newline` text directly.
The correction compared newline kind while separately retaining raw reconstruction
checks. The subsequent full tests and Clippy passed. The contributor reports their
final source content was then committed unchanged as
`0f128bd2f0bfad45ab09ffb548ac684fa28f703f`. Execution HEAD was still 3fa7e09:
these are WIP observations, not clean executions of commit 0f128bd. No failed-state
WIP tree/diff hashes were saved, so exact clean-commit reproduction is not claimed.

The original baseline is **tool-transcript evidence only**, result reference
`4d091f`: the focused command passed 2 tests, failed 0 and filtered 125 before
edits at clean 546f8e3, as reported by the contributor. No standalone raw log
exists for it; this bundle invents no baseline bytes, base64 or hash. Formatting
checks were likewise reported in tool output without saved logs and are not
included among the four retained captures.

Retention used a separate branch `agent/exact-frontend-evidence-v13` from exact
0f128bd and wrote only these two new evidence files. Node v24.11.0 read the
existing captures, checked their expected hashes and encoded their exact bytes.
The retained bundle was independently decoded and rehashed. This task ran no
compiler/frontend tests, formatting, Clippy or native programs and changed no
source, fixture or acceptance condition. Native/source proofs and later clean
integration checks remain separate evidence owned by the integrator.
