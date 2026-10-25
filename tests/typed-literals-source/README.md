# Stage A preparation

The frozen [contract](STAGE_A_CONTRACT.md) and `PREPARATION.json` describe
150 finite independent source/lexer cases. All 150 outcomes are `not_run`.
No compiler build, source check/build/lex command or emitted native program was
executed while preparing this package.

Prepared on Node v24.11.0, Windows x86-64, from base
`b2f4fe02e0e26fcb56643479f6958bde5bbf550f`. Syntax validation and
`node scripts/test-typed-literals-language.mjs --prepare-only` each exited zero.
Only read-only Git identity and Node were invoked. The integrator must supply
the exact integrated compiler commit before execution; commands and budgets are
in the contract. This preparation is not native evidence or FC1/HATCH completion.

A read-only reviewer caught a pre-freeze range-helper authoring bug: the
later-type case initially selected its later class declaration. The helper now
selects the unique suffix adjacent to numeric digits. Same-line Unicode range
data and byte-offset calculation were strengthened before freeze. Earlier
149-case preparation directories remain ignored local records with all outcomes
`not_run`; the final 150-case record also includes the clarified double-underscore
malformed-number refusal. No execution failure or acceptance result is relabeled.

The integrator's pre-execution review corrected three fixture mistakes after
the initial freeze: assertion stderr is `NJA204: assertion failed\n` in the
existing native runtime; the two positive import-boundary classes must use
`Boundary` instead of ambiguous E-starting `Edge`; and the transparent named
section uses the existing `{# Stage A # ... }` form. Commit
`0af62e2208db22663b415d5aef5ff1e2bf0159c1` preserves the original all-`not_run`
preparation. The narrow refreeze changes only the assertion stderr, those three
source identities and resulting harness/contract identities. All other sources,
150 outcomes, output expectations and resource budgets remain unchanged.
No product code or compiler/native execution was involved in the corrections.

The two changed-source output controls and removed-marker rejection must be
executed later against the actual compiler, alongside the positive, negative,
effects, precision, original-span and unchanged-resource cases. Full typed
literal protocols, exact Rational/Decimal, scale/affine algebra and productivity
evidence remain required separately.

The first corrected execution at exact integrated compiler source
`936865c7ef4dd566b4e4523089b1e6bad09534fe` passed all 150 checks without
changes to this frozen harness, expectations or budgets. That includes 64
actual native ELF executions, 73 compile refusals and 13 lexer checks on
Windows/WSL x86-64. The original `PREPARATION.json` remains `not_run`;
the separate [execution report](EXECUTION_936865c.md) and raw results record
the actual observation, commands, hashes and limits. This partial Stage A
proof does not complete general typed-literal protocols, FC1 or HATCH.
