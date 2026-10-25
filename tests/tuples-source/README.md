# Actual immutable tuple source checks

This harness prepares independent source-level checks for the first immutable
tuple slice. Preparation is not native execution evidence. Run these checks
before the compiler integration is available:

```text
node --check scripts/test-tuples-language.mjs
node scripts/test-tuples-language.mjs --prepare-only
```

The preparation mode validates every immutable static source/config SHA-256 in
`fixture-index.json`, constructs generated cases, and records expected exit,
output/diagnostic hashes and source identities in ignored
`target/tuples-language-*` artifacts. All native outcomes remain `not_run`.
Commit the prepared harness and expectations before actual execution:

```text
node scripts/test-tuples-language.mjs --expect-source FULL_COMMIT_HASH
```

The execution mode builds the workspace using Rust 1.97.1, a locked offline
dependency graph and the real `naja check`/`build` commands. Accepted sources
become actual Linux x86-64 ELF programs and execute locally on Linux x86-64 or
through explicit local x86-64 WSL on Windows. Other hosts fail explicitly.
The frozen budgets are five seconds per native process, 20 seconds per ordinary
child command, 45 seconds for the workspace build, 240 seconds overall and
8 MiB captured output per command. A timeout, crash or signal never counts as
an expected language error. Budgets are test limits, not a sandbox or
performance claim.

Coverage includes empty/single/trailing-comma tuples versus grouping and plain
positional call commas, mixed/nested elements, exact Bool preservation,
once-only left-to-right child effects, self/earlier function calls, immutable
aliases and returned elements, length/truth/not/and/or, exact Int/Bool positive
and negative indexing, huge exact indices, errors and skipped branches/chains.
An independent Node model selects original scalar elements and derives
length/truth results from tuple element count; it uses no runtime addresses,
Python interpreter, compiler IR or borrowed implementation for expected values.

Every element of a 128-element tuple is checked at positive and negative
positions. A 129-element tuple must be rejected. The IR-depth boundary stores
127 nested singleton tuples around one scalar (height 128), then indexes each
level at runtime to recover the scalar. A further wrapper must be rejected.
Both dialects share these cases; `.naja` also exercises braces, transparent
groups, depth markers and explicit project aliases with multilingual user data.
CRLF and appended comment forms are metamorphic equivalents.

Tuple printing, comparison and arithmetic are explicit type failures in this
slice. Reached comparisons cover all six operators with the same descriptor,
empty tuples and distinct tuples; mixed-kind equality covers both operand
orders. No tuple may silently print as None, compare by address or acquire
sequence arithmetic/repetition. Mutable lists, slices, unpacking, iteration,
bare comma tuples and the `tuple()` constructor remain compile rejections.
Original multilingual source positions and ordinary call arity are checked.

Two actual wrong-source controls must execute normally and then fail the same
output verifier used for valid sources: one changes a tuple index and the
other swaps effectful same-kind children. Full sources, command arguments,
outputs, exits, signals and hashes remain in ignored artifacts. On failure,
`failure.json` records the failed case and every remaining `not_run` case;
passing cases cannot replace or hide the failure.

No compiler/native outcome is established by adding this harness. Actual runs
must name the exact integrated source and artifact identities. These tests do
not establish tuple display/equality/arithmetic, general containers, full Python
compatibility, memory reclamation, other emitted targets, self-hosting, FC1 or
HATCH completion. Official narratives remain English; multilingual identifiers
and string contents are intentional user data.
