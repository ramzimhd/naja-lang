# Bounded native object foundation

The [frozen contract](CONTRACT.md) was committed before native object execution.
This is a backend IR slice; source class parsing/binding is integrated separately.
It adds general instances, per-instance fields, initializer dispatch and ordinary
method calls compiled directly to Linux x86-64 code. There is no sample-class
table, bytecode interpreter, host callback or foreign compiler/linker call.

## Public development IR

Existing `Program { body, functions }`, `emit_program` and `validate_program`
remain available. Class metadata uses the additive API:

```rust
ObjectProgram { body: Vec<Statement>, functions: Vec<Function>, classes: Vec<Class> }
Class { methods: Vec<Method> }
Method { name: String, function: usize }
emit_object_program(&ObjectProgram) -> Result<Vec<u8>, String>
validate_object_program(&ObjectProgram) -> Result<(), String>
```

New expressions are `Construct(class_index, arguments)`,
`GetAttribute(Box<Expression>, String)` and
`MethodCall(Box<Expression>, String, Vec<Expression>)`. Attribute assignment is
`Statement::SetAttribute { object, name, value }`.

Methods reference existing functions with the receiver as parameter zero. An
optional `__init__` receives the newly allocated instance; construction requires
its result to be None and returns the original instance. A class without an
initializer requires zero constructor arguments. Constructor arity is statically
validated, as existing statically named function calls are. Constructor argument
expressions evaluate once left to right before allocation/initialization.

Attribute assignment evaluates VALUE then OBJECT once. Reads return the original
stored descriptor. Each instance has its own table; references passed through
locals, fields, arrays, arguments and returns preserve identity. Self and indirect
cycles are supported without recursive traversal. There is no copying, collection
or reclamation; storage lives until process exit and consumes the bounded arena.

A method call evaluates and resolves the receiver/member before evaluating
arguments. Stored fields shadow methods and currently supported field values are
not callable. Unknown/noncallable members fail before argument effects. A selected
receiver/native method remains selected across argument mutations. Arguments then
evaluate once left to right; a dynamic arity mismatch fails after their effects.
Ordinary functions keep their existing independent local frames and shared call
counter. Method calls and constructors do not bypass depth or stack guards.

Plain instances are truthy; equality/inequality uses identity. Ordering, display,
arithmetic, length and sequence indexing/mutation explicitly fail105. Existing
tuple/list comparison restrictions remain, including mixed instance comparisons.
Extracting a method as a bound value explicitly fails110.

The pinned Python3.15.0 primary [data-model source](https://github.com/python/cpython/blob/v3.15.0/Doc/reference/datamodel.rst)
specifies initializer result restrictions and method/instance attribute binding;
its [expression source](https://github.com/python/cpython/blob/v3.15.0/Doc/reference/expressions.rst)
specifies evaluation order. These references informed the supported subset, not
a Python execution oracle or a compatibility claim. Inheritance, class attributes,
first-class class/function/bound-method values, callable fields, descriptors,
properties, special methods except initializer dispatch, decorators, private-name
mangling and arbitrary class patching remain unsupported source obligations.
L05 extension resolution and L06 partial-class authorization are not implemented
by this backend. The frontend must diagnose unsupported forms, resolve scopes and
canonicalize Unicode bindings; backend names are exact static UTF-8 keys.

## Layout, dispatch and limits

Private tag7 descriptors contain the field-table pointer and a static class index.
Each allocation is2080 bytes:24-byte descriptor,8-byte count and128 pairs of
64-bit name-ID/descriptor-pointer slots. Header/count/entries are initialized as
they become live; unused entries are never read by valid programs. No stored
field is shared accidentally between independently constructed instances.

Class/name metadata is validated at compilation. Dispatch emits native class/name
comparisons selecting native function addresses; method calls use a machine
indirect call through that selected address. Source programs cannot supply those
addresses. Instance operations check readable descriptor spans, instance/table
arena spans/alignment, count, class index and selected-value descriptor spans
before payload access/store. Full table capacity is bounded before offset
arithmetic. These region checks are not arbitrary-pointer provenance proofs and
do not make externally modified executables safe.

The private method ABI keeps the resolved receiver, expected arity, native entry
and ordinary positional arguments on the guarded source stack. Every push uses
the existing guard. Function entry checks the shared call counter and frame
reservation; returns preserve the caller frame. Constructors preserve the new
instance separately from the initializer return and guard argument copies.
Attribute-store helper scratch is32 bytes plus its saved frame pointer; other
object helpers have bounded call chains without recursive field traversal.

New explicit caps are128 classes,128 methods/class,128 fields/instance,1024 distinct
static names and256 UTF-8 bytes/name. Names must be nonempty/NUL-free; special
names other than `__init__` diagnose unsupported behavior. The256-byte bound
matches the existing frontend alias-name constant; it does not change identifier
normalization or assert that arbitrary static keys are source identifiers.

Class/method records consume the10000-node aggregate budget and names consume the
aggregate1MiB literal budget. Existing functions128/parameters128 including the
receiver, locals128, expression depth128, suite depth64, call depth256,2MiB source
stack plus4096 helper bytes,64MiB arena and all arithmetic/file budgets remain.
Thus methods admit at most127 explicit arguments. Lower OS stack availability is
still a disclosed host limitation; the stack guards are not a process sandbox.

## Diagnostics

All messages have one final LF. Existing arena/call/stack errors remain unchanged.

| Exit | Diagnostic |
|---|---|
|110|`NJA210: native object attribute not found`|
|110|`NJA210: native bound-method values are unsupported`|
|105|`NJA205: native value type mismatch`|
|105|`NJA205: native method argument count mismatch`|
|105|`NJA205: native initializer must return None`|
|103|`NJA203: invalid native object span`|
|103|`NJA203: invalid native class metadata`|
|103|`NJA203: native object field limit exceeded`|

## Executed checks and retained failures

`examples/objects_ir.rs` is bounded development-only RPN fixture plumbing. Tokens
`new:CLASS:COUNT`, `get:HEX_NAME` and `method:HEX_NAME:COUNT` use the ordinary stack
expression adapter. Statement `attr VALUE | OBJECT | HEX_NAME` preserves value
first. After function declarations, each `class HEX_NAME:FUNCTION ...` line
declares one class; bare `class` has no methods. Existing adapters/harnesses are
unchanged. Input is bounded to2MiB/10000 lines, expressions128 and outputs use
create-new mode. This adapter is not product source syntax.

```text
cargo test --workspace --locked --offline
cargo clippy -p naja-native --all-targets --locked --offline -- -D warnings
cargo fmt --all -- --check
node scripts/test-objects.mjs
node scripts/test-native.mjs
node scripts/test-hosted.mjs
node scripts/test-dynamic.mjs
node scripts/test-functions.mjs
node scripts/test-index.mjs
node scripts/test-tuples.mjs
node scripts/test-lists.mjs
node scripts/test-files.mjs
```

The original object harness was committed before execution. Its first native
run failed: tag7 reached the older generic array-indexing path and emitted
bounds107 rather than the frozen type105. A separate kernel correction rejects
instances before sequence payload interpretation. The original log remains
`target/objects-native-initial.log`; the unchanged rerun passed70 checks/75
independent output lines in `target/objects-native-second.log`. No expected
semantics, cap or timeout changed. Four further argument-boundary/effect/loop
fixtures were committed before their execution; the expanded harness passed74
checks/78 independent output lines in `target/objects-native-expanded.log`.

A preceding Rust-only validation-test authoring error was E0502: one fixture
borrowed a method vector mutably and immutably in a single push expression. A
temporary clone corrected the fixture; that failed compilation is retained in
`target/objects-core-rust-second.log`. It preceded native object execution.

Independent Node expectations cover exact large integer field values and24
dispatch outputs across eight classes, plus field isolation, aliases/cycles,
stored kinds, Unicode/exact keys, method shadowing, cached member selection,
argument/RHS ordering, arity timing, constructor results, both127-argument call
boundaries, method loop returns,128 class/method/field boundaries, call-depth and
arena failures. Span/count/class/selected-value mutants fail before invalid
payload access; stack-floor mutation exercises source guards. A native-entry
relocation mutant changes the actually executed method from41 to42; a stored
literal mutant changes native field output. Deterministic emission is compared.

The native backend was unchanged after the indexing correction at `32f980c`.
Workspace tests and the expanded harness ran with source `2d98253`, including the
separately authorized driver height update. Observed results are257 workspace
Rust tests (including34 native-crate tests), formatting/Clippy success,74 object
checks/78 output lines,36 explicit-i64 checks,14 hosted checks/394 arithmetic and
150 comparison outputs,85 dynamic checks/8194 outputs,43 function checks/294
outputs,72 index checks/2107 outputs,76 tuple checks/259 outputs and97 list
checks/385 outputs, and70 file/UTF8 checks/48 conversion outputs. Their logs
remain ignored `target/objects-*.log` artifacts; integration must record its own
source commit separately.

Record exact source/evidence commit, host/target, versions, exit codes and hashes
when integrating. Ignored target logs/artifacts are local observations and all
ELFs/debug adapters are unsigned B0 development artifacts. Full class semantics,
exception objects/unwinding, collection, clean-host execution, FC1 and HATCH
acceptance remain open.
