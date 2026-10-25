# Frozen native object foundation contract

Prepared before the first native object execution. Target: Linux x86-64 via
explicit local WSL/native execution, five seconds per artifact. No Python oracle.

The additive `ObjectProgram { body, functions, classes }`, `Class { methods }`
and `Method { name, function }` use existing `Function` bodies/frames. The existing
`Program`, `validate_program` and `emit_program` retain their interfaces.
`validate_object_program` / `emit_object_program` enable class metadata.

- `Construct(class_index, arguments)` evaluates positional arguments once left
  to right before allocating an instance. Optional `__init__` receives that
  instance as parameter zero and must return None; construction returns the
  original instance. Static constructor arity is validated, including zero
  arguments for a class without an initializer.
- `GetAttribute(object, name)` evaluates its object once, returns an existing
  stored descriptor without copying, and otherwise looks for a method. Extracting
  a bound-method value is explicitly unsupported; unknown members fail110.
- `MethodCall(object, name, arguments)` evaluates and resolves the receiver/member
  once before argument effects. Stored fields shadow methods; these currently
  noncallable supported value kinds fail105 before arguments. Missing members
  fail110 before arguments. A resolved method and receiver remain selected across
  argument effects. Arguments then evaluate once left to right; dynamic arity
  failure occurs after their effects. Receiver counts toward the128-parameter cap.
- `SetAttribute { object, name, value }` evaluates VALUE then OBJECT once, validates
  the target/value descriptor spans, and updates/adds one per-instance field.
  Aliases, parameters, returns, self and indirect cycles share reference identity.
  There is no recursive traversal, implicit copy, reclamation or cycle-collector
  claim. Field updates at capacity remain allowed.
- Plain instances are truthy. Equality/inequality between plain objects use
  identity; unrelated scalar equality is false. Ordering, display, arithmetic,
  length, indexing and mutation as sequences fail105. Existing unsupported
  tuple/list comparisons continue to fail105, including mixed object comparisons.
- New metadata bounds:128 classes,128 methods/class,128 fields/instance,
  1024 distinct static attribute names,256 UTF-8 bytes/name. Names are nonempty,
  contain no NUL and are exact byte keys; frontend Unicode canonicalization is
  separate. Special member names other than `__init__` are explicitly unsupported.
  Class/method records count toward10000 IR nodes; names count toward the existing
  aggregate1MiB literal limit. All branches/functions/metadata are validated,
  including unused/skipped expressions. Existing depth128/suites64/locals128,
  functions128/call-depth256,2MiB source stack plus4096 helper bytes,64MiB arena,
  division/file/path/syscall/EINTR budgets do not change.
- Private tag7 uses an arena-owned descriptor and a fixed128-entry field table.
  Descriptor/table/count/class/selected-value spans are checked before payload
  reads/stores. Class dispatch compiles to native code selecting native function
  addresses, not an interpreter or host callback. Internal metadata is not a
  public ABI, arbitrary-pointer provenance proof or sandbox.
- Missing attributes: `NJA210: native object attribute not found\n`, exit110.
  Bound-method extraction: `NJA210: native bound-method values are unsupported\n`,
  exit110. Wrong kind/noncallable fields retain
  `NJA205: native value type mismatch\n`, exit105. Arity:
  `NJA205: native method argument count mismatch\n`, exit105. Initializer result:
  `NJA205: native initializer must return None\n`, exit105. Invalid object spans:
  `NJA203: invalid native object span\n`, exit103. Field capacity:
  `NJA203: native object field limit exceeded\n`, exit103. Invalid class metadata:
  `NJA203: invalid native class metadata\n`, exit103. Arena/call/stack diagnostics
  remain their existing accurate English messages.

This first backend slice does not implement first-class classes/functions/bound
methods, inheritance, class attributes, callable fields, descriptors/properties,
magic methods except initializer dispatch, decorators, extension/partial-class
resolution or arbitrary class patching. Such source constructs must diagnose
unsupported behavior. L05/L06 and full ordinary class semantics remain required.
No full-class, FC1, self-hosting, clean-host or HATCH claim follows.

Freeze independent expectations for general multiple classes, field isolation,
aliases/cycles, Unicode keys, method shadow/selection/effects, constructors,
invalid/skipped IR, boundaries/resources/spans and changed-code mutants before
native execution. Preserve failures; do not loosen expectations or budgets.
