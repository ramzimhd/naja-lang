# Source function execution checks

`scripts/test-functions-language.mjs` prepares specification-derived cases for
the bounded ordinary-value function slice. Preparation is not native evidence:
`node scripts/test-functions-language.mjs --prepare-only` verifies every static
fixture SHA-256 in `fixture-index.json`, constructs the generated cases, and
records every compiler/native outcome as `not_run` under an ignored
`target/functions-language-*` directory.

After integrating the compiler implementation, run:

```text
node scripts/test-functions-language.mjs --expect-source FULL_COMMIT_HASH
```

The default mode builds the workspace with pinned Rust 1.97.1, offline and with
the lockfile enforced. It invokes the real CLI `check` and `build` for each case,
then executes the emitted Linux x86-64 ELF through the local Linux host or
declared x86-64 WSL target on Windows. Other hosts fail explicitly. Each native
process has a five-second timeout and the complete harness has a 240-second
deadline. Compilation subprocesses and output capture are also bounded.

The harness retains original sources, command exits, signals, compiler/native
stdout and stderr, static fixture identities, source commit and dirty status,
compiler/ELF/output hashes and the harness identity. `summary.json` is written
only after every expected outcome passes; `failure.json` retains completed
results on an assertion failure. A passing resource-error case requires its
specified exit and exact English diagnostic, rather than treating any failure
or timeout as success. All rejected programs must fail both checking and
building and leave no ELF artifact.

Coverage includes positional arguments and exact arity, self/earlier calls,
isolated recursive locals, arbitrary-value returns, bare/fallthrough `None`,
discarded calls, left-to-right argument effects exactly once, early returns
through conditions/loops/transparent groups, flow-sensitive initialization,
Unicode NFKC names and original positions, contextual project aliases, brace
and depth-marker dialect boundaries, and fixed parameter/function/call/source
limits. Independent JavaScript `BigInt` multiplication and explicitly corrected
floor division derive arithmetic answers; no Python implementation is executed.
CRLF/comments are metamorphic equivalents. Two mutated-source controls must
execute normally and then be rejected by the same output verifier used for
the positive cases, proving that wrong argument effects and return values do
not silently pass the harness.

Unsupported defaults, keyword arguments, annotations on function signatures,
function values, nested definitions, forward calls and globals remain explicit
negative cases. This harness does not establish complete Python compatibility,
closures, complete modules, managed-memory behavior, FC1 or HATCH acceptance.
The `project` fixture uses an explicit project root; `.py` never activates its
aliases. Official narratives and diagnostics are English; multilingual source
identifiers and string values are intentional user data.

No native result is claimed merely by adding these fixtures. Retained execution
results must name the exact integrated source commit and artifact directory.

The first completed run is recorded in
[RUN_2026-10-25.md](RUN_2026-10-25.md), with per-case retained outcomes in
[RESULTS_2026-10-25.json](RESULTS_2026-10-25.json). These results apply only to
the exact source commit named there.
