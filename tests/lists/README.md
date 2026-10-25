# Bounded mutable native lists

The public backend IR adds `Expression::List(Vec<Expression>)` and
`Statement::SetIndex { sequence, index, value }`. List construction evaluates
children once, left-to-right. Indexed assignment evaluates **value first, then
sequence, then index**, each exactly once, before target/index validation and
store. An earlier expression failure prevents evaluation of later expressions.
The compiler validates all expressions, including skipped/unused statements.

The [preregistered contract](CONTRACT.md) was committed with the core before the
first native list harness execution. It fixes expectations, capacity and resource
budgets. The harness prints its SHA256 and executes real Linux x86-64 machine
code with a five-second per-artifact timeout. No Python, hidden interpreter,
foreign compiler, callback or cached result supplies program behavior.

## Representation and supported semantics

List uses distinct private tag6: a 24-byte descriptor contains tag, element-array
pointer and count. The shared Tuple/List constructor defensively checks the
preregistered **128-element maximum** before calculating `24+8*count`, allocates
one arena block, and copies pending descriptor pointers into source order. Empty
lists are valid. Tuple and List keep distinct tags and behavior; their common
temporary capacity is enforced by a compile-time assertion.

List supports len, truth/not/and/or and the existing exact Int/Bool index rules,
including negative and enormous indices. Index returns the original descriptor,
preserving Bool, None, Text/Bytes views, arbitrary integers and nested collection
tags. Wrong index kinds fail type105; ordinary bounds errors fail NJA207/107.
Count stays fixed: this slice replaces elements but does not append, resize,
slice, iterate, unpack or implement general list methods.

Indexed assignment accepts only List. Tuple, Text, Bytes and scalar targets fail
`NJA205: native value type mismatch`, exit105. Aliases, stored references and
function parameters observe changes to the same array. A tuple may contain a
reference to a mutable list without making the tuple's own array mutable.
Reassigning a parameter/local does not replace other aliases.

Self and indirect cycles are permitted. Len/truth/index/store perform bounded
shallow operations and never recursively traverse children. No identity/equality
operator, cycle detector, provenance proof, collection or reclamation is claimed.
List display, comparisons and arithmetic remain explicit type105 errors before
fallback/payload interpretation. Existing scalar and tuple behavior is retained;
this partial slice does not waive their remaining HATCH semantics.

## Memory and failure boundaries

Descriptors/arrays remain in the shared **64 MiB temporary arena** through
process exit. Mutation stores an existing descriptor pointer and allocates
nothing. Construction, new element values and other existing operations may
still allocate; unreachable objects and cycles are not reclaimed. This is not
the final hosted memory manager, concurrent mutation support or a sandbox.

Before array access, code checks count, guarded multiplication, pointer-add
carry and the complete used-arena span. Invalid List metadata reports
`NJA203: invalid native list span`, exit103. Selected/read or stored element
descriptors receive a readable 24-byte literal/used-arena span check before a
shallow value check. No store occurs before target, bounds and new-value checks.
These guards do not make arbitrary modified executables safe or prove individual
object provenance. Internally constructed descriptor addresses remain trusted.
Error-message writes are best effort.

Existing limits remain unchanged: 2 MiB guarded source stack with4096-byte helper
reserve, user-call depth256, 128 locals/functions/parameters, expression depth128,
64 suites, 10,000 aggregate IR nodes and 1 MiB aggregate literal spelling.
Each SetIndex statement counts itself and all three expression trees. Each list
counts itself and every child. Existing OS-stack and process-time limitations
remain; the harness timeout is external.

## Verification

```text
cargo test --workspace --locked --offline
cargo clippy -p naja-native --all-targets --locked --offline -- -D warnings
node scripts/test-lists.mjs
node scripts/test-tuples.mjs
node scripts/test-index.mjs
node scripts/test-functions.mjs
node scripts/test-dynamic.mjs
node scripts/test-hosted.mjs
node scripts/test-native.mjs
```

`examples/lists_ir.rs` is bounded development-only RPN plumbing into the backend
IR. `list:N` consumes N preceding values; `store VALUE | SEQUENCE | INDEX`
represents indexed assignment in evaluation order. Existing fixture conventions,
input limits and create-new output remain. It is not a product source frontend.
Existing harnesses/adapters were not edited.

The first native list run passed **97 checks / 385 independently calculated
element outputs** without failures. Vectors verify 128-element mutation and
alias observations, both index signs, Bool/zero, huge integers, value kinds,
parameters, element evaluation and assignment ordering/errors, cycles and
short circuit. The frozen near-full-arena fixture admits 2000 stores of existing
descriptors while a control allocating 2000 lists exhausts the same budget.
Nested pending elements test the existing calculated source-stack boundary.
Count/tag/span/selected-descriptor mutants fail before unsafe access; unsupported
operations retain type105 despite corrupt array metadata. Changed source values
change output, and disabling the generated store is detected by the independent
expected result. Rust tests cover all children/store operands, skipped/unused
branches, 128/129 elements and global node/depth/literal limits.

Windows Rust/Cargo 1.97.1 and Node 24.11.0 supplied the seed; generated programs
executed on Linux x86-64 WSL. Workspace tests passed 242 Rust tests. Existing
tuple (76 checks / 259 outputs), index (72 / 2107), functions (43 / 294), dynamic
(85 / 8194), hosted (14 / 394 arithmetic and150 comparison outputs) and fixed-i64
(36 checks) regressions passed. Workspace build, formatting and backend all-target
clippy passed. GNU readelf 2.42 observed ELF64 EXEC, entry0x401000, one RX LOAD,
RW non-executable GNU_STACK and no interpreter/dynamic section. Artifacts remain
unsigned development executables.

Logs/artifacts remain in ignored `target/lists-native-*` and `target/`. The initial
run log is retained separately as `target/lists-proof-initial.log`. Record exact
commits, commands, versions, host/target, exits and hashes for integrated evidence.
Source syntax integration is separate. No full list/runtime, other-target,
performance, self-hosting, FC1-complete or HATCH acceptance follows from this
bounded B0 backend evidence.
