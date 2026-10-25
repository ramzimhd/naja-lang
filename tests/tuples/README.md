# Bounded immutable native tuples

`naja_native::dynamic::Expression::Tuple(Vec<Expression>)` constructs an immutable
tuple. Its preregistered limit is **128 elements**, including zero. Every child
evaluates exactly once in source order before the tuple allocation; failure
stops evaluation of later children. Children use the same guarded source stack
as other expressions and call arguments. No separate interpreter, host callback,
compiler, assembler or linker executes the generated operations.

The private descriptor uses tag5, an array pointer at offset 8, and an element
count at offset 16. One checked arena allocation contains the 24-byte descriptor
and `8*count` descriptor pointers. The native constructor reverses the caller's
pending stack representation into source element order. It never copies,
coerces, traverses or modifies the element values. Empty tuple data points just
after its descriptor, which is a valid empty used-arena span.

Supported capabilities are:

- `Len`: exact Int element count.
- Truth/not/and/or: empty is false, nonempty is true; and/or return an operand.
- `Index`: existing exact Int/Bool rules, negative positions from the end,
  NJA207/107 for ordinary bounds failures, and the original element descriptor
  as the result. Huge integer indices are rejected before narrowing.

Tuple printing, all comparisons involving either tuple operand, arithmetic,
unary numeric operations and integer-boundary validation explicitly fail with
`NJA205: native value type mismatch`, exit105. Print/comparison guards run before
any tuple payload interpretation, including otherwise-unrelated equality
fallbacks. This slice does not print None for a tuple, compare pointer addresses,
or fabricate an equality result. Existing scalar behavior is preserved.
Slices, mutable lists, unpacking, iteration, tuple equality/display and full
tuple compatibility remain future work. The source frontend is integrated
separately.

## Lifetime and resource boundaries

Tuples and their element arrays live in the existing **64 MiB temporary arena**.
Literal payloads are read-only; allocated objects are immutable and retained
through process exit. Returning a tuple, reassigning a local, keeping an alias,
or indexing nested tuples does not invalidate stored elements or Text views.
There is no reclamation, mutation or cycle-construction API in this slice.
Repeated construction consumes the arena and can fail with the existing
`NJA203: native value arena exhausted`, exit103.

The native constructor checks count<=128 before calculating `24+8*count` or
reading pending elements. Tuple operations check count, pointer-add carry and
the complete element-array span within the used arena before array reads.
Malformed metadata reports `NJA203: invalid native tuple span`, exit103. Index
also checks the selected descriptor's readable 24-byte span in the final literal
data/used arena before reading its tag. These are shallow checks. They do not
recursively traverse tuples, establish arbitrary object provenance or make
modified executables safe. Descriptor construction remains an internal compiler
invariant. No new recursion/cycle guarantee is claimed.

Children contribute to the existing aggregate 10,000 IR nodes, 1 MiB literal
spelling and expression depth 128, including skipped/unused branches. Existing
128-local/function/parameter, 64-suite and 256-user-call limits remain. All
temporary child pushes obey the existing **2 MiB source-stack budget plus
4096-byte helper reserve**. The tuple constructor/checker have bounded,
nonrecursive helper stack use. No work cap, OS stack limit or resource budget
was raised. Lower OS stack limits and inherited argv/environment retain the
previous documented boundary; this is not a sandbox or runtime time quota.

## Executed verification

```text
cargo test --workspace --locked --offline
cargo clippy -p naja-native --all-targets --locked --offline -- -D warnings
node scripts/test-tuples.mjs
node scripts/test-index.mjs
node scripts/test-functions.mjs
node scripts/test-dynamic.mjs
node scripts/test-hosted.mjs
node scripts/test-native.mjs
```

`examples/tuples_ir.rs` is bounded development-only RPN plumbing, not a product
frontend. `tuple:N` consumes N preceding values; `eval` discards an expression
result. The existing fixture operators/functions and create-new output remain.
Existing harnesses/adapters are unchanged.

The harness executes actual emitted Linux x86-64 instructions, through Ubuntu
WSL on Windows, with a five-second artifact timeout. Independently calculated
128-element vectors verify source order, both index signs, Bool and length.
Fixtures cover empty/mixed/nested tuples, original scalar tags, aliases/views,
function returns, once-only left-to-right side effects/errors, short circuit,
128 IR depth, huge indices, unsupported operation guards and allocation-only
tuple exhaustion. Eight nested tuple layers retain 1016 pending descriptors per
recursive call; calculated inputs 204/205 test source-stack success/resource
failure before the call-depth limit. Constructor count/tag/span and selected
descriptor mutants exercise guards; invalid arrays still raise type105 for
unsupported tuple print/comparison/arithmetic. A changed selected literal alters
the native result. Rust tests cover 128/129 elements, all child validation,
global literal/node/depth budgets and deterministic static ELF headers.

The first harness execution stopped with ENOENT because a Windows filename
contained `*` from an operator label. Only artifact labels changed to English
names; source expressions, expectations, budgets and timeouts were unchanged.
A retained tool-output excerpt under `target/tuples-authoring-failure.log`
records the failed run; the original full redirected log had already been
overwritten. The initial workspace build's missing Tuple height arm is retained
separately and was fixed in an authorized, separate driver integration commit.

The Windows Rust/Cargo 1.97.1 / Node 24.11.0 seed passed 76 tuple checks and 259
independently calculated element outputs through Linux x86-64 WSL. Workspace
tests passed 224 Rust tests, including four new tuple-validation tests. Existing
index (72 checks / 2107 outputs), functions (43 / 294), dynamic (85 / 8194),
hosted (14 / 394 arithmetic and 150 comparison outputs) and fixed-i64/native
(36 checks) harnesses passed. Workspace build, formatting and backend all-target
clippy passed. All generated artifacts are unsigned development executables.

Logs/artifacts remain in ignored `target/tuples-native-*` / `target/`. Integrated
evidence must retain exact commits, commands, host/target, versions, exits and
hashes. This is a bounded B0 backend slice, not a source-language, other-target,
performance, self-hosting, complete runtime, FC1 or HATCH acceptance claim.
