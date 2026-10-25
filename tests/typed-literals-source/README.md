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

The two changed-source output controls and removed-marker rejection must be
executed later against the actual compiler, alongside the positive, negative,
effects, precision, original-span and unchanged-resource cases. Full typed
literal protocols, exact Rational/Decimal, scale/affine algebra and productivity
evidence remain required separately.
