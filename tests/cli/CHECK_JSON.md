# Structured source diagnostics

`naja check SOURCE --json [--project-root PATH]` checks the same shared frontend
as ordinary `check`. It does not execute source or emit a native artifact. A
semantic pass returns exit 0; a semantic failure returns exit 1. Both write one
JSON object to stdout, with empty stderr:

```json
{"schema_version":1,"source":"supplied-source.naja","status":"failed","diagnostics":[{"code":"NJA101","message":"diagnostic text","start":{"line":0,"character":2},"end":{"line":0,"character":9}}],"omitted_diagnostics":0}
```

Ranges are half-open, zero-based original-source UTF-16 positions, including
after aliases, named/braced/depth suites and Unicode names. LF, CRLF and CR each
separate lines. Terminal diagnostics retain one-based Unicode scalar columns.
At most 32 diagnostics are emitted, with an explicit omitted count. Internal
out-of-source/interior-byte spans are clamped to valid source boundaries rather
than panicking. The supplied path spelling is retained; non-Unicode OS paths
are represented lossily and are not an editor URI identity guarantee.

Usage, filesystem, encoding and explicit project-ownership/configuration errors
remain ordinary stderr errors with exit 1 and no JSON. Clients must distinguish
transport/input errors from a valid semantic report and validate the schema,
source identity, positions and exit/status agreement. Disk-based clients must
also reject stale document versions. This command is not an LSP implementation,
incremental service, execution sandbox or complete editor delivery.

The independently frozen CLI harness uses a five-second ordinary command
deadline, 45 seconds for the locked offline workspace build, 120 seconds overall
and one MiB captured output. It covers empty-PATH checks without execution or
artifacts, both dialects, all line endings, astral Unicode before an error,
source suite forms, aliases, omission reporting, changed-source error controls
and input/option refusals. Expectations precede its first actual execution:

```text
node scripts/test-check-json.mjs
```

The initial Rust test build failed with E0425 because four existing test calls
still named the replaced option parser. The reproduced failure is retained in
ignored `target/check-json-first-test-failure.log` (exit 101,
SHA-256 `34a3a30c3e9eab0374a1561ce321d9331c6300bdf2be6a819cbc06991be02a5a`).
Those callers were migrated to the new parser and extended with duplicate/order
checks; no test was disabled and no resource limit changed.
