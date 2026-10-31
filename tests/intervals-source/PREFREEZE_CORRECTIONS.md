# Pre-freeze source interval harness corrections — October 31, 2026

The October 31 session reached its account limit after drafting this harness
and contract, before freezing `PREPARATION.json`, committing, or implementing
any compiler change. No compiler or native outcome had been observed. The
resumed session reviewed the draft against the existing compiler before
freezing it.

Interrupted draft identity: `scripts/test-intervals-language.mjs` SHA-256
`8957e0c61b7b214cfc6e91c21a8c0d4588d349586aff5305690ecdb330b9ac0d`; the
contract is unchanged (`965f720971bf8ba8883c9fba249e1d0a7a1f7d3439a454f4beb946b6423704d3`).
No prepare-only output from the draft was retained in this worktree.

Two fixture defects were found by reading existing compiler rules:

1. `runtime-kind-object-0/1/2` placed `class C: pass` before the
   `from naja.numeric import checked_int` header. The existing parser ends the
   import header at the first class or function (`explicit API imports must
   precede functions and executable statements`), so these three cases would
   have been compile refusals, not runtime 105 type checks. The class now
   follows `PROBE`; the Rational prefix import still precedes it. Expected
   outcomes are unchanged.
2. `zero-free-arena-api-and-annotated-reassignment` printed an Int after the
   arena was filled to zero free bytes. Native Int printing allocates its
   decimal buffer from the arena, so the print would fail for an unrelated
   reason. The Int check `checked_int(value, value, value)` is kept as a
   statement, and the printed check is now `checked_int(True, value, True)`,
   which returns the original Bool descriptor and prints without allocation.
   Expected stdout changed from `1/False/True` to `True/False/True`.

Existing behaviors read to confirm other fixture assumptions, without running
any interval code: the lexer accepts `0_0` and `00`; `0x1`, `1e0`, `1.0` and
`1Unknown` lex without lexer diagnostics; `to` is not reserved; native Integer
IR accepts an optional leading minus; the call-depth message is
`NJA203: native user-call depth limit exceeded`; method names such as
`__init__` are charged to the literal ledger.

Frozen identity after correction:

- `scripts/test-intervals-language.mjs` SHA-256 `0ae42015f3da9993b983269d26f999d6441397d0465eae291c668165e1e0ce40`
- `tests/intervals-source/PREPARATION.json` SHA-256 `535c527cd481fb27db792daaff2f1aa29e0fa3b1407b6b87bbb96e37426cf8e0` (148 cases: 75 runtime, 66 reject, 7 check; all `not_run`)
