# Independent verification of dynamic source fixes — revision 1.3

Verified source: `865a0d2a6a0e5509e7870d1620d1bcebac054d6b`.
Reviewer: `/root/frontend`, branch `agent/dynamic-source-fixes-v13`.
Observed October 25, 2026, completed after 19:54 UTC. Only this report is
committed; production, tests, locks and shared metadata were not edited.

The independently reproduced F1/F2/F3 regressions from
`reports/reviews/DYNAMIC_SOURCE_V13.md` no longer reproduce in the checks below.
This is limited clearance for those fixes on the tested Windows debug seed and
WSL native target. It is not FC1, L03/L04 or HATCH acceptance. The old report,
source pin and failure outcomes remain historical evidence and were not changed.

## F1 — compiler stack bounds

Read the fixed worker boundary in `bootstrap/driver/src/lib.rs:15`–`40` and its
public compile/check entry points. It requests an 8 MiB stack through one joined
scoped compilation worker, including native emission for compile calls. This
explicit temporary seed reservation has OS thread overhead; peak/resident memory
was not measured. Native generated programs do not use this compiler worker.
The constant was already selected in the supplied fix before these checks.

Rebuilt the actual CLI and reran the original forty sampled plus, parentheses,
`not` and explicit-i64 depth cases. All completed without stack abort: 34
accepted and six returned normal rejection diagnostics. The original dynamic
112/120/126/127 cases, which aborted at the earlier source, now accept as
appropriate. Dynamic 127 unary operators have height 128 and accept; 128 and
129 reject. Parenthesis nesting 128 accepts and 129 rejects. Explicit-i64 plus
128 remains accepted and 129 remains rejected. The original 136-byte
`height-128.naja` and over-height companion now match their original expectations.
No advertised semantic depth, source budget or test cutoff was increased.

Additional real `run --runner wsl --timeout-ms 2000` cases exercised native
compilation and execution with:

- 64 indented true-condition suites and 127 unary pluses, printing `1`;
- 64 transparent named suites and the same maximum-height expression, printing
  `1`;
- the 64-indented-suite case in `.py`, printing `1`;
- 64 suites with 127 `not` operators, printing `False`;
- 64 suites with 128 parentheses, printing `1`.

Combined 64-suite/over-height and 65-suite/maximum-height inputs reject normally
with the existing depth diagnostics. The fourteen original boundary cases all
match expectations, including locals 128/129, comparison width 128/129,
10000/10002 operations and exact 1 MiB source/one byte over.

`NJA107` worker-creation failure and `NJA108` unexpected worker-panic conversion
were inspected in source; these OS/fault paths were not forced. No claim of
global concurrent-compiler memory quotas or universal stack behavior is made.

## F2 — source IO ordering and named pipe

Inspected CLI ordering at `bootstrap/driver/src/main.rs:114`–`116` and
`compile_source_file` at lines 304–309: explicit owning-project aliases are
validated before source contents are consumed. `read_source` validates supported
Windows namespaces and requires ordinary regular-file metadata before opening
and on the opened file. Test command preflight also validates the path before
discovery. These are stable-filesystem checks, not atomic or race-resistant
confinement and not a general OS IO deadline.

Reran the original local named-pipe reproduction with the unchanged 1500 ms
cutoff and a fresh private endpoint. Observed result:

```json
{
  "connected": false,
  "killed": false,
  "elapsedMilliseconds": 65,
  "stdout": "",
  "stderr": "NJA030: project alias loading supports local disk paths only; network/device namespaces are unsupported\n",
  "code": 1,
  "signal": null
}
```

The server observed zero connections, the CLI exited normally before the
cutoff, and the timer was canceled. The child close event and server-close
callback were awaited; every accepted socket would have been destroyed (there
were none). The probe Node process exited zero, with no retained child, server
or pipe handle. No policy, privileges or networking settings changed. The 65 ms
observation is not a benchmark or guaranteed latency bound.

An outside-project regular source containing invalid UTF-8 also returns the
ownership error before `NJA005`, confirming that its contents are not decoded
before explicit project validation. The original sibling/nested project,
`.py` activation and no-ambient-alias cases retain their expected rejection.

## F3 — annotation binding resolution

The exact original `.naja` input now rejects with `NJA101` at the annotation's
`int` token, explaining that a local binding shadows the compiler-provided type:

```naja
int = 7
x: int = 1
print(x)
```

An attempted native `run` also rejects before executing or printing. The
equivalent canonical binding spelled with fullwidth `ｉｎｔ` rejects as well.
In `.py`, both ASCII and NFKC-equivalent bound-`int` cases retain informational
annotation behavior and execute the text assignment, printing `informational`.
The original primary matrix's annotation source is byte-identical; its diagnostic
matcher uses the actual fix's word `shadows` instead of the earlier anticipated
word `bound`. The expected rejection and source were not weakened.

## Commands and retained evidence

Host: Windows/PowerShell; Rust `1.97.1 (8bab26f4f 2026-07-14)`, Node `v24.11.0`.
Native execution target: local WSL `Linux x86_64`. No Python interpreter/oracle
was executed. The rebuilt debug CLI SHA-256 is
`b341dbb1a726ce6726b1d4fc4030dce863cbb06d12a8ac7d443410d43e69640b`.

| Command/check | Result |
| --- | --- |
| `cargo +1.97.1 build -p naja-seed --locked --offline` | Exit 0 |
| `node target/dynamic-source-fixes-setup.mjs` | Separate artifact directory created; original result hashes captured |
| `node target/dynamic-source-fixes-3zMqut/probe.mjs` | Original 21 source cases: 21 matched |
| `node target/dynamic-source-fixes-3zMqut/bounds.mjs` | Original 14 boundary cases: 14 matched |
| `node target/dynamic-source-fixes-3zMqut/stack.mjs` | Original 40 stack samples: zero aborts, all ordinary accept/reject outcomes |
| `node target/dynamic-source-fixes-3zMqut/pipe.mjs` | Same 1500 ms cutoff; zero observed connections, normal rejection, complete cleanup |
| `node target/dynamic-source-fixes-3zMqut/combined.mjs` | 12 additional cases matched, including combined bounds and native annotation behavior |
| `cargo +1.97.1 test -p naja-seed --lib --locked --offline -- --quiet` | Exit 0; 14 passed, zero failed/ignored |
| `cargo +1.97.1 test -p naja-seed --bin naja --locked --offline -- --quiet` | Exit 0; 13 passed, zero failed/ignored |

All 21 primary, 14 boundary and 40 stack source inputs were compared with the
original retained fixtures and are byte-identical. Artifact directories and the
private pipe's unique endpoint changed, not the source cases or their resource
budgets. The four original result JSON files remained unchanged; their verified
SHA-256 values are:

| Original result | SHA-256 |
| --- | --- |
| `results.json` | `4bbfa299e0b298e52b8f6b145464ac2e20c461f5b6d8fb50a2b3a72e54888261` |
| `bounds-results.json` | `38d7f64451a142a9d0c49b069ae71771a5cf169020ffcef1ba203b31b7a78cfe` |
| `stack-results.json` | `80685849abfeba413fb06e007d2d6f74e94512938c3440ce6e02c9564254d7e2` |
| `pipe-result.json` | `38d489fdfb39ce75825a1c3f374a8943ef6197f504c96921481f46c3bff81e18` |

New scripts, source fixtures, result JSON and `input-identity.json` are retained
under ignored `target/dynamic-source-fixes-3zMqut/`. Original evidence remains
under ignored `target/dynamic-source-review-VUrrOP/`. `naja run` removes its
temporary ELF files; per-case ELF hashes were not retained. The primary matrix
still checks actual native values, short-circuiting/chains, alias/NFKC resolution,
original diagnostic spans and wide integer arithmetic, as described in the old
review. This rerun used the independently retained probes, not the integrator's
new `scripts/test-compiler-boundaries.mjs` as an oracle.

No remaining F1/F2/F3 regression was observed in this bounded rerun. Release
builds, other host stacks/filesystems, worker failure injection, hostile rename
races, complete syntax/types/modules and the remaining HATCH gates still need
their own evidence.
