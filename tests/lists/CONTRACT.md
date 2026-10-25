# Preregistered bounded-list test contract

Frozen before the first native list harness execution. Reference target is Linux
x86-64, through declared WSL on the Windows seed. Artifact timeout is five seconds.
No Python or interpreter supplies expected values.

- List has distinct tag6 and at most 128 elements; count is fixed after construction.
- Children evaluate once, left-to-right. Stored descriptor references preserve tags.
- Len/truth/index use the existing exact Int/Bool, negative and huge-index rules.
- Indexed assignment evaluates VALUE, then SEQUENCE, then INDEX exactly once.
  Only a List target is mutable. Wrong kinds fail105; bounds fail107 before store.
- Aliases and parameters share mutation. Self and indirect cycles are allowed;
  shallow operations do not recursively traverse or reclaim them.
- Print, comparisons and arithmetic involving List remain explicit type105 errors.
- Tuple/Text/Bytes indexed assignment remains type105; existing behavior is retained.
- All existing budgets stay fixed: 64 MiB arena, 2 MiB source stack plus4096-byte
  helper reserve, call depth256, expression depth128, 10,000 IR nodes, 1 MiB literals.
- Mutation replaces an existing pointer without allocation. A prefix of127 copies
  of524288-byte payloads plus7 copies of65536-byte payloads leaves less than64KiB
  of the arena. Two thousand stores of existing descriptors must succeed there;
  a control allocating two thousand one-element lists must exhaust it.
- Corrupt count/span/tag/selected-descriptor probes must fail before unsafe payload
  access. Artifact guards do not establish arbitrary pointer provenance or a sandbox.
- Independent128-element vectors, fixed ordering/error/cycle fixtures, a changed
  source-value control and a disabled-store artifact mutant determine expectations.

Implementation defects may be fixed. Expectations, caps, timeouts and budgets must
not be loosened to turn a failure into success. Retain any failures and corrections.
