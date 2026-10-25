# Actual mutable list source checks

This independent harness checks the bounded fixed-count List slice through
actual `.py`/`.naja` sources, shared parsing, the CLI and emitted Linux x86-64
ELF programs. It uses no Python interpreter or oracle. Before execution, freeze:

```text
node --check scripts/test-lists-language.mjs
node scripts/test-lists-language.mjs --prepare-only
```

Preparation verifies immutable source/config SHA-256 identities in
`fixture-index.json` and records generated source hashes, expected exits and
output/diagnostic identities. Every native outcome is `not_run`. Commit this
preparation before running the unchanged harness at a declared source commit:

```text
node scripts/test-lists-language.mjs --expect-source FULL_COMMIT_HASH
```

The harness builds with Rust 1.97.1, `--workspace --locked --offline`, then
invokes real `naja check` and `build` on every source. Accepted ELF programs
execute on Linux x86-64 or explicit local x86-64 WSL on Windows. Other hosts
fail explicitly. Frozen limits are five seconds per native process, 20 seconds
per ordinary child command, 45 seconds per build, 240 seconds overall and
8 MiB captured output per child. Timeouts, crashes and signals never count as
expected language failures. These limits are not a sandbox or performance claim.

An independent Node vector models 128 initial elements, shared aliases and 256
deterministic stores of mixed scalar values. It derives observations and final
positive/negative indexed outputs without using compiler IR or addresses.
Static cases exercise Bool descriptors, nested lists/tuples, aliases,
parameters, returned/nested targets, self/indirect cycles, length/truth and
discarded expression statements. Effectful assignments require VALUE, then
SEQUENCE, then INDEX once; a RHS that replaces an inner list verifies that the
new target is selected afterward. Earlier/self calls, both dialects, shared
suites, NFKC names, contextual aliases and CRLF/comment equivalents are covered.

128-element lists and expression height 128 must execute; 129-element and
height-129 controls must reject. Exact Int/Bool/negative/huge indices retain
the existing rules. Type, bounds, zero-division and assertion failures require
their exact stderr and exit codes. List display, all comparisons and arithmetic
remain explicit type failures. Tuple/Text/Bytes store targets must also fail.

The arena checks reuse the prefix frozen in `tests/lists/CONTRACT.md`: 127
copies of a 524,288-byte payload plus seven copies of a 65,536-byte payload
leave less than 64 KiB. One hundred calls perform 20 stores each, reusing
existing descriptors without loop-counter allocation or exceeding the source
parse-operation budget. They must succeed. The same number of calls creating
20 one-element lists each must exhaust the unchanged 64 MiB arena. Helpers are
included in the measured source; this is a runtime resource check, not a
productivity benchmark or a general allocator guarantee.

Appending/resizing, slices, augmented assignment, unpacking, comprehensions,
iteration and `list()` remain compile rejections with original source-position
checks. Two real changed-source controls must execute normally and then be
caught by the same output verifier: one disables a store and one changes an
observable RHS effect. All command outputs, original sources, exits, signals
and hashes are retained under ignored `target/lists-language-*`. Failure
records preserve the failed case and every remaining `not_run` outcome.

Existing harnesses and historical results are not edited or relabeled. These
checks do not establish list display/comparison/arithmetic, resizing, complete
containers or Python semantics, memory reclamation or race safety, other
emitted targets, clean installation, self-hosting, FC1 or HATCH. Official prose
is English; multilingual identifiers and source values are user data.
