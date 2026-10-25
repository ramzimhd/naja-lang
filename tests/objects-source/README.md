# Actual ordinary-class source checks

This independent harness prepares bounded `.py` and `.naja` user-class programs
for the real CLI and emitted Linux x86-64 ELF target. It uses no Python
interpreter or oracle. Preparation is separate from execution:

```text
node --check scripts/test-objects-language.mjs
node scripts/test-objects-language.mjs --prepare-only
```

The preparation freezes source/config SHA-256 identities in
`fixture-index.json`, generated source hashes, independent expected outputs,
runtime exits and exact diagnostic bytes. It must be committed before native
execution. Every prepared native outcome is `not_run`. The compiler source base
for this preparation is `a51c2808bae4b57596f7f957ce53530004a504f8`; its compiler
does not yet include the class source integration. Do not execute this harness
until the integrator supplies its exact integrated source commit:

```text
node scripts/test-objects-language.mjs --expect-source FULL_COMMIT_HASH
```

The backend expectations use the object contract frozen before execution at
`845fbdc9f9b7762500d35f90417f3eb573587c81:tests/objects/CONTRACT.md`.
Source syntax and binding expectations follow the integrator's agreed bounded
slice and the richer obligations in `docs/03_LANGUAGE_AND_COMPATIBILITY.md`, continuation
L05/L06 and FC1-02. These richer obligations remain open.

The frozen budgets are five seconds per native process, 20 seconds per ordinary
child command, 45 seconds per compiler build, 240 seconds overall and 8 MiB
captured output per child. The compiler build uses Rust 1.97.1 with
`--workspace --locked --offline`. Each case receives real `check` and `build`
commands. Accepted artifacts run only on Linux x86-64 or explicit local x86-64
WSL on Windows. Signals, timeouts and crashes never count as language errors.
These are local execution limits, not an OS sandbox or performance guarantee.

An independent Node reference model supplies 128 object identities and aliases,
256 deterministic scalar field updates and final observations. A separate
identity matrix derives equality from JS reference identity, without compiler
IR, addresses or a class-name output table. Source fixtures exercise multiple
classes with the same method names, isolated fields, canonical Unicode names,
early returns, returned/indexed receivers, tuple/list-held objects, self/indirect
cycles and Bool preservation. Ordinary scalar behavior, exact large integers,
Text/Bytes and imported conversion calls pass through method bodies.

Observable effects distinguish constructor arguments before initialization,
attribute VALUE before OBJECT and method receiver/member resolution before
arguments. A selected method and receiver must survive changes made by
arguments. Missing/noncallable members fail before argument effects; dynamic
method arity fails after them. Non-None initializers fail explicitly. Stored
fields shadow methods, while extracting a bound method is an explicit native
failure. Equality uses instance identity; unrelated scalar equality is false;
mixed unsupported tuple/list comparisons and object display/order/arithmetic/
length/indexing remain exact type failures.

Both dialects retain ordinary indentation and `.naja` additionally exercises
class brace labels, class/method/inner control depth markers and transparent
method groups. Class bodies accept only methods/pass. Named class-body groups
and empty suites reject. NFKC field names denote one field; canonical class and
method collisions reject. Explicit project aliases remain contextual: method
names that equal builtin/operator aliases remain ordinary member names. CRLF
and comment metamorphs preserve semantics and original-source diagnostics are
checked. Python inputs do not implicitly enable NAJA syntax or project aliases.

Boundary controls freeze 128 classes, 128 total methods in one class (also
bounded by the existing total function cap), 128 fields with updates allowed at
capacity, 127 explicit method parameters plus receiver, 256 UTF-8 bytes per
member name, 1024 distinct static member names, expression height 128 and 256
active method calls. Each has a one-over failure control. Member metadata in
skipped code still counts; the new member-name cap is not applied to class
identifiers. The unchanged 64 MiB arena must exhaust on repeated construction;
repeated field updates near that limit must reuse descriptors. The existing
source node/literal/suite/stack limits are not raised or claimed independently
exhaustively covered here.

Unsupported inheritance, decorators, nested classes, class variables/body
effects, default/annotated/keyword parameters, static methods/properties, raw
special members other than initialization, dynamic class values, later static
references and binding collisions must reject. Two changed-source controls
execute real mutated programs normally and must be rejected by the same output
verifier. All original sources, commands, outputs, exits/signals and artifact
hashes are retained under ignored `target/objects-language-*`. On failure the
failed observation and every remaining `not_run` case are preserved unchanged.

No first-class class or bound-method values, inheritance, descriptors, extensions,
partial classes, general monkey-patching, memory reclamation, arbitrary-pointer
provenance, full Python compatibility, other emitted targets, clean installation,
self-hosting, FC1 or HATCH claim follows. Existing harnesses and historical
results remain unchanged. Official prose is English; multilingual source data
and identifiers remain intact.

The first exact-source execution is retained in
[RUN_2026-10-25.md](RUN_2026-10-25.md) and
[RESULTS_2026-10-25.json](RESULTS_2026-10-25.json). Its scoped observations apply
only to the compiler and artifact identities recorded there; this preparation
record remains unchanged.
