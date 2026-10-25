# Dynamic source integration review — revision 1.3

Reviewed source: `bccb6092e901a86273da031713f1381b4e60a2f4`.
Reviewer: `/root/frontend`, isolated branch `agent/dynamic-source-review-v13`.
Observed on October 25, 2026; report prepared at 19:45 UTC and afterward.
Scope: independent source review and bounded execution probes, not FC1/HATCH
approval. Production files, tests, dependency locks and shared metadata were
not edited. Only this report is committed.

The pinned source has two newly reproduced compiler/input-boundary failures and
one annotation-name issue already fixed by a later integrator commit. Driver
unit tests pass, but the real Windows CLI resource probes expose a stack abort
that the test-thread checks do not catch. Clearance is withheld for the pinned
source until the failures below are addressed and rechecked separately.

## Findings

### F1 — P1: dynamic expression recursion aborts the actual Windows compiler

Location: `bootstrap/driver/src/lib.rs:596` (`expression`), especially its unary
and grouping recursive calls at lines 607–614. The depth guard and later tree
height checks cannot return diagnostics before the Windows main stack exhausts.

A 136-byte source file with an advertised-height-128 expression reproduces it:

```text
print( + repeated 127 times, followed by 1)
```

The notation above describes generation; the retained fixture contains the
actual 127 plus signs, with no commas or explanatory text. Equivalent generator:

```javascript
const source = 'print(' + '+'.repeat(127) + '1)\n';
```

Command:

```powershell
target/debug/naja.exe check target/dynamic-source-review-VUrrOP/height-128.naja
```

Observed: exit `3221225725` (`0xC00000FD`), no normal diagnostic, and stderr
`thread 'main' (...) has overflowed its stack`. The 128-plus case also aborts
instead of rejecting an over-height tree. Further isolation accepts 96 unary
pluses but aborts at 112, 120, 126, 127, 128 and 129. Parentheses and repeated
`not` show the same sampled 96/pass and 112/abort split. This does not establish
the exact minimum crash depth.

In the explicit-i64 parser instantiation, all sampled plus counts through 128
are accepted and 129 gets a normal diagnostic. The new dynamic instantiation's
stack use is therefore material, rather than merely a universal lexer limit.
Fourteen library tests and eleven main-module tests still pass on their test
threads. The actual CLI must support its documented bound and diagnose excess
depth without process stack abort; merely reducing the claimed limit would not
validate the original promise. Include real process tests for unary, grouping,
`not`, supported maximum depth and over-limit rejection on Windows debug builds.

Status at this pinned source: reproduced, unresolved. Integrator notified with
the exact inputs, executable hash and result files.

### F2 — P2: source consumption precedes explicit project/path validation

Locations: `bootstrap/driver/src/main.rs:114` reads before line 131 loads the
module table; `compile_source_file` repeats that order at lines 273–274.
`read_source` opens at line 237 and reads to EOF without ordinary-file metadata
validation. The byte cap does not bound waiting for a stream to end.

A controlled local Windows named pipe with a `.naja` suffix reproduced:

```text
naja check \\.\pipe\naja-source-review-47764.naja --project-root PROJECT
```

`PROJECT` was a valid explicit fixture root. Its loader would reject the device
namespace/nonordinary module before reading. Instead, the CLI connected to the
pipe and waited for input/EOF before reaching that loader. The probe held the
pipe open without supplying source bytes. At the configured 1500 ms cutoff it
terminated the CLI; observed elapsed time was 1602 ms, `connected=true`, no stdout
or stderr, and the child close event reported `SIGTERM`. This is a bounded
reproduction, not a performance threshold or benchmark.

Validate explicit project ownership/aliases before consuming source when that
mode is requested. Reject unsupported source namespaces and nonregular source
objects before opening them, then recheck opened metadata. These checks should
retain the existing stable-filesystem scope; no hostile-rename race protection
or universal OS IO deadline follows from them.

Cleanup: the child close event was awaited, every accepted pipe socket was
destroyed, `server.close` completed, and the probe Node process exited zero.
No server, pipe handle or child was left running. No policy, privilege or
network-listening setting was changed; the probe used only local named-pipe IPC.

Status at this pinned source: reproduced, unresolved. Integrator confirmed the
finding and planned the ordering/metadata fix; a later fix must have its own
commit and verification record.

### F3 — P2: bound `int` is ignored when selecting a `.naja` annotation type

Location: `bootstrap/driver/src/lib.rs:542` selects the compiler-provided
annotation spelling through `expect_binding` without checking a local canonical
`int` binding. Ordinary `int` bindings are otherwise allowed.

```naja
int = 7
x: int = 1
print(x)
```

Pinned `check` unexpectedly succeeds, and a separate real native `run --runner
wsl --timeout-ms 2000` exits zero and prints `1\n`. The native type constraint was
selected despite the bound name. This scope must diagnose an unsupported/shadowed
type rather than silently selecting a different binding. By contrast, the
supported `.py` informational annotation probe with a bound `int` correctly
retains its assigned value and performs no runtime annotation enforcement.

Later fix, separate from reviewed results: the integrator supplied
`af68803c940fd7b5fb59bb5293d8decc0479967e`. Its source diff adds the `.naja` bound
canonical-`int` guard and regressions, while retaining informational `.py`
annotation behavior. That diff was inspected read-only. This review did not
execute the later commit and does not relabel the pinned failure as a pass.

## Inspected scope and evidence

Read governing docs03/docs04 and continuation L03/L04. Inspected the shared
parser's raw keyword handling, canonical identifiers, builtin fallback and
comparison aliases, declaration/definite-initialization tracking, annotation
guards, precedence/chain construction, suites and resource accounting. Also
inspected `values.rs`, main CLI option/source/project ordering, project loader
checks and relevant dynamic validator/emitter/runtime paths for truthiness,
comparison chains and operand preservation. Existing backend documentation and
tests informed declared limits; they were not treated as new source-level
acceptance evidence.

Host: Windows, PowerShell. Seed compiler:
`rustc 1.97.1 (8bab26f4f 2026-07-14)`. Independent fixture/oracle tooling:
Node `v24.11.0`. Actual emitted native programs ran on the available local WSL
target, observed as `Linux x86_64`; Node/WSL were review tooling, not embedded
in generated programs. No Python or foreign interpreter oracle was executed.

The pinned debug CLI SHA-256 was
`2ff2119def8d1d2fe32a272efe9ed3102a0b018263a59b6e4c310365502adddf`.
Commands and outcomes:

| Command | Outcome |
| --- | --- |
| `git switch -c agent/dynamic-source-review-v13 bccb6092e901a86273da031713f1381b4e60a2f4` | Exact pinned branch created; prior branches preserved |
| `cargo +1.97.1 build -p naja-seed --locked --offline` | Exit 0 |
| `wsl.exe --exec uname -sm` | Exit 0; `Linux x86_64` |
| `cargo +1.97.1 test -p naja-seed --lib --locked --offline -- --quiet` | Exit 0; 14 passed, 0 failed/ignored |
| `cargo +1.97.1 test -p naja-seed --bin naja --locked --offline -- --quiet` | Exit 0; 11 passed, 0 failed/ignored |
| `node target/dynamic-source-review-probe.mjs` | 21 cases; 20 matched expectations, F3 unexpectedly accepted |
| `node target/dynamic-source-review-bounds.mjs` | 14 cases; 12 matched, two CLI stack aborts in F1 |
| `node target/dynamic-source-review-stack.mjs` | 40 sampled depth/form checks; 18 dynamic stack aborts, 22 ordinary accept/reject outcomes |
| `node target/dynamic-source-review-pipe.mjs` | Bounded reproduction of F2; child/server fully closed |
| Separate native run of F3's retained source | Exit 0; stdout `1\n` |

The primary matrix includes fourteen native `run` cases and seven `check`
cases. Native values cover `not`/`and`/`or` precedence, preserved operands,
short-circuit type failures, reached chain failure, bool/int arithmetic and
comparisons, UTF-8/combining/NUL text length, bytes concatenation, informational
`.py` and enforced `.naja` annotations, alias/NFKC operator mapping, alias binding
initializers, mixed suites/depth metadata and a 500-digit Node-BigInt arithmetic
expectation. Negative cases check bound alias calls, raw keyword precedence,
`.py` alias isolation, absence of ambient aliases, definite initialization and
original Unicode/CRLF diagnostic position (`:3:12:`).

The bound matrix checks 128/129 locals, comparison width 128/129, 10000/10002
operations, suite depth 64/65, exact 1 MiB source and one byte over, plus sibling
and nested project boundaries. Those twelve non-height cases matched their
expected accept/reject result. No new incorrect precedence, chain short-circuit,
alias/data substitution or original-span behavior was found in these cases.

Retained local artifacts are under ignored
`target/dynamic-source-review-VUrrOP/`: source fixtures and `results.json`,
`bounds-results.json`, `stack-results.json`, `pipe-result.json`. The four probe
scripts are retained under ignored `target/`. Generated ELFs from `naja run`
were temporary and were removed by that command; per-case ELF hashes were not
retained, so no artifact-level repeatability claim is made. Probe generation
used specification-derived expectations and Node BigInt, without a language
interpreter oracle.

## Limits and later changes

This review is bounded to the pinned Windows debug seed and the listed probes.
It does not cover release-build stack behavior, other host call stacks, full
grammar/type/object/module semantics, hostile filesystem races, all Unicode
lookalikes, native signal behavior, general exception handling or the complete
backend. Unsupported syntax/features documented by the construction slice
remain open rather than being counted as review defects or implemented gates.
No whole FC1, L03/L04 or HATCH clearance follows from these results.

Integrator follow-up `9051f82` concerns filesystem-test capability handling and
was deliberately not checked out or substituted for the pinned source. The
annotation follow-up is recorded above. Further source-input and parser-stack
fixes must retain this original failure evidence and add separate commit-specific
verification, rather than rewriting these outcomes.
