# Frozen bounded native mapping contract

Committed before native mapping execution. Linux x86-64 through explicit local
WSL/native execution; five seconds per artifact; independent Node expectations,
no Python execution/oracle. Existing Program/ObjectProgram entrypoints remain.

- New IR: `Dict(Vec<(Expression,Expression)>)`, `Set(Vec<Expression>)`,
  `Contains(Box<Expression>,Box<Expression>)`, `DictKeys(Box<Expression>)`,
  `RelationChain(Box<Expression>,Vec<(Relation,Expression)>)` where
  `Relation::{Compare(Comparison),In,NotIn}`. Old CompareChain remains supported.
- Dict/Set literals admit at most128 source pairs/elements, including duplicates.
  Empty storage allocates before child expressions. Each Dict KEY then VALUE
  evaluates once, followed by insertion before the next pair. Set elements
  evaluate and insert once left to right. Duplicate equal keys retain the first
  key descriptor/position; Dict replaces its value without reordering. Sets
  deduplicate. Mutable storage holds at most128 unique entries; updates at
  capacity succeed. No resizing, deletion, iterator or public hash API.
- Dict Index evaluates DICT then KEY and returns the stored value descriptor.
  Existing SetIndex assignment evaluates VALUE then CONTAINER then KEY once.
  It supports Dict insertion/update as well as existing List assignment. Set
  positional reads/stores explicitly fail105.
- Contains evaluates ELEMENT then CONTAINER and returns Bool, initially for
  Dict/Set only. Other membership containers fail105. Relations in a chain
  evaluate operands once left to right, short-circuit, reuse the original middle
  operand rather than a Boolean, and return Bool. Chains require1..128 relations;
  additional relations consume the existing global operation/node budget.
- DictKeys evaluates its Dict once and returns an immutable Tuple SNAPSHOT of
  original key descriptors in insertion order. Later Dict updates do not change
  the snapshot array. This is not Python dict.keys() view/iterator semantics.
- Keys initially support exact canonical Int, Bool (0/1 equivalence), Unicode
  Text, Bytes and None. Text/Bytes remain distinct; no normalization occurs.
  Tuple/List/Object/Dict/Set keys explicitly fail as unsupported in this slice,
  not a permanent unhashability rule. Wrong key types are checked even for empty
  containers. Full tuple/object hashing and all mandatory container semantics
  remain required. Stored values may include aliases and cycles without copying,
  recursive traversal, reclamation or GC claims.
- Private tags8/9 have arena-owned descriptors and fixed128-entry key/value
  pointer tables. Descriptor/table/count/selected-value/key spans are checked
  before payload access/store. Numeric key headers, sign/count consistency,
  base1e9 canonical limbs and Bool zero/one are validated before exact comparator
  reuse; Text keys validate strict UTF8. No narrowing or pointer-provenance claim.
- Preregistered `MAX_MAPPING_KEY_WORK=1_000_000` per lookup/insertion/Contains/
  DictKeys operation: one unit per validated payload byte or integer limb,
  plus two units per worst-case paired byte/limb comparison. Fixed descriptor/
  header reads cost no payload units. Sign/count/length/kind mismatches may avoid
  comparison scans. Debit BEFORE scans; the counter never resets per candidate.
  Literal construction performs at most128 separately bounded insertions.
  Snapshot validates all retained keys within one cumulative budget. This is a
  temporary resource limit, not a hash optimization or overall CPU/IO deadline.
- Existing64MiB arena,2MiB source stack plus4096 helper reserve, call-depth256,
  literal1MiB/nodes10000, depth128/suites64/locals128/functions128 and all prior
  arithmetic/file/class limits are unchanged. All branches/unused IR validate.
  Mapping metadata checks never recursively traverse values or cycles.
- Len/truth support Dict/Set counts. Display, order, structural equality and
  arithmetic explicitly fail105, including comparisons against plain instances.
  Missing Dict key: `NJA211: dictionary key not found\n`, exit111.
  Unsupported key: `NJA205: unsupported native mapping key type\n`, exit105.
  Other wrong kinds: existing `NJA205: native value type mismatch\n`, exit105.
  Capacity: `NJA203: native dictionary capacity exceeded\n` or
  `NJA203: native set capacity exceeded\n`, exit103. Corrupt metadata/key spans:
  `NJA203: invalid native mapping span\n` or
  `NJA203: invalid native mapping key span\n`, exit103. Key work:
  `NJA203: native mapping key work limit exceeded\n`, exit103. Arena/stack/call
  errors and selected-value readable-span errors retain existing diagnostics.

Freeze general independent cases for exact key equivalence, kinds/bytes/Unicode,
order/snapshots, aliases/cycles/parameters, effects and first-error ordering,
mixed short-circuit comparison chains, boundary/resource/span/key-work guards,
and changed-input/kernel mutants before native execution. Retain failures and
corrections without loosening expectations/caps/timeouts. This is an unsigned
B0 backend foundation, not full mappings/sets, FC1, self-hosting or HATCH proof.
