# Bounded native mappings and membership

The [frozen contract](CONTRACT.md), including exact scan charges, predates native
execution. This is backend IR; source binding/imports are integrated separately.
Existing Program/ObjectProgram and CompareChain interfaces remain compatible.

## API and semantics

New expressions are Dict(Vec<(Expression,Expression)>), Set(Vec<Expression>),
Contains(Box<Expression>,Box<Expression>), DictKeys(Box<Expression>) and
RelationChain(Box<Expression>,Vec<(Relation,Expression)>).
Relation is Compare(Comparison), In or NotIn.

Literal storage allocates first. Dict evaluates each KEY then VALUE once and
inserts before the next pair; Set evaluates/inserts elements left to right.
Equal duplicate keys update only the value, retaining the first key descriptor
and insertion position. Literals admit128 source entries including duplicates;
storage holds128 unique entries, with existing Dict updates allowed at capacity.

Index evaluates CONTAINER then KEY. SetIndex evaluates VALUE then CONTAINER then
KEY and supports Dict insertion/update plus existing List stores. Set positional
reads/stores fail105. Values share references across aliases/arguments/returns,
including self/indirect cycles, without copying, recursion or reclamation.
Contains evaluates ELEMENT then CONTAINER and returns Bool, initially for Dict/Set.
Chains short-circuit and retain each original middle operand after evaluating it
once; they never substitute the previous Boolean. They require1..128 relations.

DictKeys evaluates its Dict once and returns a fresh immutable Tuple snapshot of
retained key descriptors in insertion order. Later map updates cannot change its
array. It is distinct from Python dict.keys() view/iterator semantics.
Keys support exact Int/Bool equivalence, Text, Bytes and None. Text/Bytes stay
distinct; Unicode is not normalized. Tuple/List/Object/Dict/Set keys explicitly
remain unsupported, not permanently unhashable. Len/truth work; display, order,
structural equality and arithmetic fail105. Resizing, deletion, iterators,
set-add and complete hashing/container semantics remain required future work.

The pinned Python3.15.0 [data model](https://github.com/python/cpython/blob/v3.15.0/Doc/reference/datamodel.rst)
provides the order/numeric-key/set reference; its [expressions reference](https://github.com/python/cpython/blob/v3.15.0/Doc/reference/expressions.rst)
provides chaining rules. No Python execution/oracle supplies results.

## Storage and limits

Private tags8/9 use2072-byte arena allocations:24-byte tag/table/count descriptor
and128 key/value-pointer pairs (Set value slots hold None). Lookup is linear;
there is no hash-optimization claim. Descriptor/full-table arena spans, alignment,
count and selected descriptors are checked before payload access/store. Scalar
key preflight validates complete spans, strict Text UTF8, canonical base1e9 integer
sign/count/limbs, and Bool zero/one before shared exact comparator reuse.
None equality does not dereference its unused payload. No pointer-provenance or
modified-executable safety claim follows from region checks.

Lookup/store scratch is128 bytes. Snapshot scratch is1152 bytes:128 metadata plus
1024 pointer bytes, disjoint from metadata. Saved counters survive comparator
clobbers; the ordinary tuple allocator makes the snapshot array. Existing64MiB
arena,2MiB source stack plus4096 helper reserve, call depth256, functions/parameters/
locals128, depth128/suites64, literals1MiB/nodes10000 and other budgets remain.

MAX_MAPPING_KEY_WORK is1000000 per operation. Query preflight occurs once, even
for empty maps; each visited candidate preflights once. Text/Bytes debit declared
byte length; numeric keys debit limb_count; None/fixed headers cost zero.
Compatible equal-length byte comparison debits2*length; equal-sign/count numeric
comparison debits2*limb_count. Other metadata mismatches skip comparison. No
same-pointer shortcut exists. Debit precedes scans, with no reset per candidate.
Each literal insertion has a fresh budget; DictKeys validates all retained keys
within one snapshot budget and does no comparisons. See CONTRACT for exact edges.
This is a temporary resource cap, not narrowing, a CPU deadline or sandbox.

## Diagnostics

All lines end in LF. Existing arena/stack/call and selected-value sequence-span
messages remain unchanged.

| Exit | Diagnostic |
|---|---|
|111|NJA211: dictionary key not found|
|105|NJA205: unsupported native mapping key type|
|105|NJA205: native value type mismatch|
|103|NJA203: native dictionary capacity exceeded|
|103|NJA203: native set capacity exceeded|
|103|NJA203: invalid native mapping span|
|103|NJA203: invalid native mapping key span|
|103|NJA203: native mapping key work limit exceeded|

## Verification and retained failures

Development-only examples/mappings_ir.rs adds RPN dict:COUNT, set:COUNT, contains,
dict_keys and relations:==,in,notin to existing fixture plumbing. Input2MiB/10000
lines, depth128 and create-new output are bounded; this is not product syntax.
Run cargo test --workspace --locked --offline, cargo fmt --all -- --check,
cargo clippy -p naja-native --all-targets --locked --offline -- -D warnings,
and node scripts/test-mappings.mjs. Existing native/hosted/dynamic/functions/
index/tuples/lists/files/objects scripts are unchanged.

Initial mapping execution failed at its new count-corruption selector, which also
matched a file-helper store. A stronger mapping-constructor anchor preserved
strict uniqueness, the mutation and expected103. The original failed
 target/mappings-native-initial.log remains; the rerun passed79 checks/956 lines.
Additional guards were frozen before running; source34e5197 passed87/964 in
 target/mappings-native-expanded.log. Old tuple/list regressions then failed their
strict count-store selectors because new mapping code reused R13. Correction
b8b982a changed only that new counter scratch to RBX, with equal instruction count.
Old selectors/expectations/caps stayed intact. Their original failed logs and
-fixed reruns are retained separately. Corrected sourceb8b982a passed87/964 in
 target/mappings-native-final.log and264 workspace Rust tests, formatting/Clippy.

All nine old backend regressions passed across retained observations:36 i64,
14 hosted/394+150 outputs,85 dynamic/8194,43 functions/294,72 index/2107,
76 tuples/259,97 lists/385,70 files/48 and74 objects/78. Tuple/list reruns include
b8b982a; seven other passes precede its mapping-only scratch correction.
Independent Node expectations cover32 randomized ordered maps, key equivalence/
order/snapshots, aliases/cycles/effects, mixed chains,128 boundaries and exact
scan-budget edges. Native mutants cover canonical keys, UTF8, spans/counts,
capacity/debits, changed source data and deterministic emission. A separate
read-only review found no bounds/ABI/charge blocker and edited no files.

Ignored target logs/artifacts retain actual source observations; integration must
record its own commit. The worker base564461b excludes later frontend private-name
fixes. No current source-class compatibility, clean-host, GC, complete mappings,
self-hosting, FC1 or HATCH claim follows. All artifacts are unsigned B0.
