# Actual mapping and set source checks

This independent harness prepares bounded `.py` and `.naja` programs for the
real shared parser, CLI and emitted Linux x86-64 ELF target. No Python
interpreter or oracle is used. Freeze preparation before native execution:

```text
node --check scripts/test-mappings-language.mjs
node scripts/test-mappings-language.mjs --prepare-only
```

`fixture-index.json` fixes SHA-256 identities for source/config/input files.
`PREPARATION.json` fixes generated case identities, independent output hashes,
diagnostics, exits and budgets. Every prepared native outcome is `not_run`.
The source base is `b0e54cb2db1a2aea20b6056c05f92ea5e6b62560`; mapping
source integration is pending. Native execution requires an exact later source
commit supplied by the integrator:

```text
node scripts/test-mappings-language.mjs --expect-source FULL_COMMIT_HASH
```

The native contract was frozen in
`af9a12a0fcdae8b56290accaa1e8931d77d34872:tests/mappings/CONTRACT.md`, with
the exact key-work sequence clarified before native proof in
`09c9ed9440fef17881aed7252cbb859ce35afd43`. Expectations follow that contract
and the agreed source slice; they are not inferred from execution. Documents
03–05 and continuation contracts retain the richer language obligations.

The frozen limits are five seconds per native artifact, 20 seconds per ordinary
child command, 45 seconds per compiler build, 240 seconds overall and 8 MiB
captured output per child. The compiler builds with Rust 1.97.1 using
`--workspace --locked --offline`. Every case gets actual `check` and `build`
commands; accepted artifacts run only on Linux x86-64 or explicit local x86-64
WSL on Windows. Spawn errors, signals, crashes and timeouts never substitute for
expected language failures. No sandbox, OS deadline or speed claim follows.

An independent ordered Node model supplies 128 keys, aliases, 256 deterministic
updates and final key/value/membership observations in both dialects. Its
explicit key relation merges exact Int/Bool zero/one, preserves None, and keeps
Text and unsigned Bytes separate. It uses linear entries rather than JS Map's
incompatible Bool/Int equality. BigInt values retain exact huge keys. A separate
Set model deduplicates through that same explicit relation. One independent key
case covers all 256 unsigned byte values and Unicode scalar UTF-8 width edges.
Unicode key data,
including compatibility/decomposed strings, remains unnormalized; identifier
normalization is separate. Snapshots retain the first key descriptor and order,
including distinguishable Bool versus Int descriptors.

Cases cover empty/literal Dict and Set forms, length/truth, snapshots before and
after insertion, immutable snapshot arrays, values held through aliases,
functions/classes, lists/tuples and self/indirect cycles. Observable effects
require Dict KEY then VALUE then insertion before later pairs, Set element then
insertion, store VALUE then CONTAINER then KEY, reads CONTAINER then KEY and
membership ELEMENT then CONTAINER exactly once. Invalid keys still allow the
current Dict VALUE's effects; later pairs/elements must be skipped. Missing
keys and unsupported key kinds have distinct exact diagnostics.

Membership, `not in`, arithmetic/boolean precedence and mixed comparison chains
preserve each middle operand once and short-circuit later work. A successful
chain using a non-Boolean middle value and an error chain requiring a Dict
middle operand distinguish correct reuse from substituting the first Boolean
result. Parenthesized imports, aliases, Unicode bindings, methods named `keys`,
project comparison aliases and raw keyword lookalike identifiers are included.
An explicit local/parameter/import/function/class `set` binding wins over the
unbound zero-argument builtin; local callable values remain unsupported.

Conventional indentation works in both dialects; `.naja` additionally combines
expression braces with labeled/control braces, depth markers, named groups and
multiline nested literals. CRLF/comments and brace-looking string contents are
metamorphic controls. Original multilingual diagnostic positions and Python
dialect isolation are fixed expectations. No token substitution is used.

Literal boundaries count all 128 pairs/elements including duplicates; 129
rejects. Dict updates at 128 unique keys succeed and inserting a 129th fails
at runtime. Set's 129th source element is rejected before execution; this source
slice exposes no incremental Set insertion API, so it cannot independently
reach the native Set-capacity failure path. Expression height 128 and 128 mixed
relations succeed; their one-over sources reject. Near the unchanged 64 MiB
arena, repeated Dict updates must retain descriptors, while snapshots allocate
and repeated Set construction must exhaust the arena. Other inherited limits
are unchanged, not exhaustively re-proven by this suite. A recursive mutation,
membership and lookup case must preserve all 256 caller frames and still enforce
the existing 257th-call failure.

Key work is bounded at exactly 1,000,000 units per operation. Query preflight
charges once, each visited candidate charges once, and compatible equal-size
comparisons charge twice the payload size before scanning; there is no pointer
shortcut or counter reset per candidate. A 250,000-byte self-alias lookup totals
1,000,000 and succeeds; one byte more fails. Cases cover Bytes, ASCII Text and
multibyte Text, reads/membership/updates and empty-container query validation.
Two distinct-length Bytes keys of 499,999 and 500,001 bytes have an exact-budget
insertion and snapshot. An absent None query costs exactly that budget; a
one-byte absent query exceeds it by one. Equal-length multiple-candidate cases
also distinguish cumulative accounting. Retained payload beyond one million
units cannot be reached through valid insertion in this slice, so no snapshot
one-over source claim is made. Large-limb boundary and corrupt-span probes
remain separate backend evidence.

Two real controls must execute normally and then fail the same output oracle:
one changes a duplicate update in source; another changes only private input
file bytes from an ASCII key to a Unicode compatibility key. The file cases use
the existing explicit file/UTF-8 APIs. Node creates their sole `key.txt` under a
private ignored artifact directory and verifies its inventory/bytes around
check, build and native execution. ELF/capture files live outside that directory.
Windows compiler SOURCE paths and Linux native working directories are distinct;
no outside file mutation or filesystem-confinement claim is made.

Full sources, private inputs, outputs, ELF files, exact command arguments,
exit/signal observations and hashes are retained under ignored
`target/mappings-language-*`. Failure records retain the original failed case
and every remaining `not_run` outcome. The execution path checks the frozen
harness, fixture, generated-case and budget identities before building.

Set iteration/add/delete/resizing, Dict protocols, tuple/object hashing,
comprehensions, full structural equality/display, memory reclamation and full
Python container behavior remain required future work. Current unsupported
operations reject or report their declared native type error. These checks do
not establish pointer provenance, memory safety, clean installation,
self-hosting, FC1 or HATCH, and promote no gate. Existing harnesses and historical
results remain untouched. Official prose is English; multilingual user data is
preserved.

The first unchanged source run failed on the frozen alias fixture's invalid
unquoted keys. Its original observation and 190 pending cases are retained in
[FAILED_RUN_2026-10-25.md](FAILED_RUN_2026-10-25.md) and
[FAILED_RESULTS_2026-10-25.json](FAILED_RESULTS_2026-10-25.json). The preparation
and failure remain unchanged; this is not a source-suite pass.
