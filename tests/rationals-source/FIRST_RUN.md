# First Rational source run: retained fixture failure

The unchanged 220-case preparation stopped with **33 passed, 1 failed and 186
not_run** against exact source
`5ee64ec1fb02968964a81b0f07c086ae0578c684`. This failed run is retained. It does
not establish complete source verification, FC1, a release gate or HATCH.

The failure is an authored fixture defect: `discarded-ratio-and-return` defines
the static function `value`, then the shared observation helper emits
`value = value()`. The existing documented prohibition on rebinding statically
resolved function names applies. The compiler correctly refused this source;
this observation does not establish a production defect.

## Exact execution

The fresh worktree was tracked clean at the pinned commit before the run:
`C:/naja-worktrees/rationals-source-execution`, branch
`agent/rationals-source-execution-v13`. The original preparation worktree and
its inherited untracked `bootstrap/frontend/Cargo.lock` were untouched.

Executed once, with harness exit 1:

```text
node scripts/test-rationals-language.mjs --expect-source 5ee64ec1fb02968964a81b0f07c086ae0578c684
```

The harness used Node `v24.11.0` on Windows x64, pinned offline/locked Rust seed
build and actual Linux x86-64 ELF execution through local WSL. All frozen
budgets remained unchanged: 5 seconds per native process, 20 seconds per CLI
call, 45 seconds compiler build, 240 seconds suite, 8 MiB per child capture.
The 141 recorded child commands totaled 33,818 milliseconds; none reported a
spawn error or signal. The 33 passed cases emitted and executed actual ELF
files, including both dialect fixtures, typed/project integration, exact BigInt
vectors, huge cancellation, the comparison matrix and unrelated equality.

The first failing source, SHA-256
`9ec65064118df7c2a0f80c2f31d4422b9b3ab3d5a68a629a743e7650110fa6d5`:

```text
from naja.numeric import rational, divide_exact, numerator, denominator
def value():
    rational(1, 2)
    return rational(-3, 4)
value = value()
print(numerator(value))
print(denominator(value))
```

Both `check` and `build` exited 1 at the original line 5, column 1:
`NJA101: rebinding a statically resolved function name is unsupported`.
Neither produced stdout; no ELF existed for this case, and it did not run.
The intended stdout remains `-3\n4\n`. The remaining 186 cases did not run.

## Retained identities and limits

`FIRST_RUN_FAILURE.json` is the original failure JSON copied byte for byte,
including all 220 states and every recorded command/exact exit/capture hash.
`FIRST_RUN_ARTIFACTS.json` additionally retains compiler identity, diagnostic and
source bytes, exact failed stage exits and the absence of a failed-case ELF.
Full sources, ELF files and captures remain locally under the ignored directory
`target/rationals-language-hryYkV`.

| Item | SHA-256 |
| --- | --- |
| Original harness | `e1006441297c00f592d73c2d6be4c92a7b7f4456ba4d1891a827fa2b50803dc5` |
| Fixture index | `c1ecb856a751837fe86df003cdca88f8f045cc72b332f22c0ac2047a6f9041e2` |
| Original preparation | `14a957613189efd8f370768c53ad01a1702acdb2f42e7265698ff9806cb64254` |
| Original failure JSON | `8177b5f7c9032f0d17450b59ab96430ef61b00d1256c3aa36d2d9f061a0ec5f7` |
| Original plan | `537610107a3d74954190cb510e8a806d3479dbc19e3267636bc25aabf840d3b5` |
| Artifact record | `3de15b7025b4cf5c21089799dc55824b363e220d5bba8ac3fd3190228d728f69` |
| Built compiler | `9123142182fc2c62ced5be21286aa71633b6953a0caa0035d0af366a1b77e2f3` |

The source inputs, expected outputs/errors, frozen identities and tolerances
were not changed during this run. The first failure and pending cases are not
reclassified as passes. No second native run occurred before this report.
Any authorized fixture repair must be a separate preparation commit, preserve
this failed observation and await a new exact source pin before execution.
