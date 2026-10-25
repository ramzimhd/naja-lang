# Independent exact literal review

Reviewed October 25, 2026 at exact source
`6d8fb04400cf19f9cf04bebd6bc67fbe1b39cbb0`. Across two distinct frozen phases,
49 outcomes passed: 18 actual Linux x86-64 ELF executions, 29 check/build
refusals and two lexical checks. No concrete product defect was reproduced.
One reviewer assumption failed and remains failed in the original record;
the original 49-case run is not an all-pass result. No gate is promoted.

The isolated `agent/exact-literal-review-v13` worktree began at `546f8e3`, read
AGENTS, continuation L04/L07/L08, ADR-006/007 and amended ADR-008 `3fa7e09`,
then fast-forwarded to the authorized execution pin with a clean tracked tree.
Only this report is committed. Compiler, harness, fixtures and planning were
unchanged. This review did not run the separate source-202 or Rust suites.

## Accounting and construction

Read-only inspection confirmed a direct native path: the lexer retains original
numeric/suffix spans; the driver resolves the earlier explicit class capability,
plans both Int string lengths, reserves their sum before either expanded String,
then lowers two Int leaves, Rational and ordinary Construct. Exact capability
always passes Rational, including integers; ordinary construction retains Int.
Marker import/declaration does not execute a decorator or initializer. No domain
name table, float conversion or compile-time zero/cancellation shortcut was found.

The initial ADR's unique-name accounting claim was corrected before any proof.
Existing backend validation charges every canonical static-name occurrence;
the set separately bounds distinct names. It visits class/method metadata first,
main statements next, then each function body once. Class/function/parameter
names and implicit initializer lookup add no literal fee. The parser ledger
has matching inventories in source order, so overflow diagnostic order need not
equal backend traversal order. Postfix-to-assignment conversion does not double
charge its retained member name. Unused branches/functions and post-return
statements retain validation. Backend accounting remains an independent guard.

The independent Node BigInt oracle sums decimal place values and reduces exact
fractions; it does not import compiler code or use binary float/Python. Native
results matched decimal/exponent/underscore/leading-zero forms, trailing-dot
maximal munch, integers, large exact values and renamed canonical Unicode types.
Postfix/unary behavior, once-only construction, argument order and suppressed
effects followed the frozen expectations. A changed `1.50T` produced `3/2` and
was rejected by the unchanged `1.25T` output oracle `5/4`.

Five independently inventoried exact/one-over pairs covered minimal initializer,
positive zero expansion, an unused method, repeated identical member names and
decoded Text/Bytes. Each exact 1,048,576-byte case checked, built and executed;
each additional byte rejected at the original numeric span with the exact
expansion diagnostic. The minimal fixture charges `__init__` eight bytes:
`0e-1048566T` reserves `1 + 1048567 + 8 = 1048576` bytes. Unused-method names,
repeated member occurrences and decoded Unicode/byte-escape data were charged.
These are bounded inventories, not an arbitrary-source independent parser.

Sixteen-thousand-digit leading-zero exponents retained small exact values.
Huge positive/negative exponents on zero rejected without an overflow/zero
shortcut. Skipped, unused and post-return expansion excesses rejected, as did
the generated-node cap. The separately derived Rational work model predicts
971506 units for direct `1.` plus 432 zeros and 1011132 for 441 zeros. At the
unchanged one-million cap, the first initialized normally; the second exited
103 before initializer effects. This is an under/over work check, not an exact
counter mutation or host-memory/performance proof.

Integer-only decimal suffixes, class eligibility, parameter shadowing, stacked
markers, marker calls, `.py` suffixes and malformed/base/imaginary/ambiguous
suffixes refused. Raw suffix spans retained original UTF-16 positions across
CRLF, non-BMP text and canonical spellings. Suffix-free Float classification
and TypedDecimal `1.T` maximal munch were checked independently.

## Preserved first failure and continuation

The original 49-case run stopped after 17 passes at `private-local-guard`:
the reviewer expected `__private` inside an ordinary top-level function to
reject. Check and build correctly succeeded; that guard explicitly applies
within textual class context. The emitted ELF was retained and not executed.
This was an oracle-scope mistake, not a compiler defect or weakened requirement.
Its first record remains 17 passed, one failed assumption and 31 `not_run`.

After a separate freeze and authorization, continuation executed the identical
31 pending sources/expectations plus one new class-context private-name refusal.
All 32 passed. No original source, expected result, tolerance or resource cap
was edited. Across both phases, 48 original outcomes plus the new refusal passed;
the original failed assumption was never relabeled. Native exits were fifteen
zero, one resource 103 and two type 105. No timeout or signal occurred.

## Evidence

Artifacts remain under `C:/naja-worktrees/exact-literal-review/target/`.
Commands were `node target/run-exact-review.mjs 6d8fb04400cf19f9cf04bebd6bc67fbe1b39cbb0`
(exit 1 at the preserved assumption) and
`node target/run-exact-continuation.mjs 6d8fb04400cf19f9cf04bebd6bc67fbe1b39cbb0`
(exit 0). Both checked exact HEAD/clean tracked state and built with
`cargo +1.97.1 build --workspace --locked --offline` (exit 0). Actual CLI
check/build/lex and WSL `/usr/bin/timeout --signal=TERM --kill-after=1s 5`
executed the artifacts. Host Windows x64/Node v24.11.0; WSL reported Linux x86_64.
Each phase kept the frozen 240s overall, 45s build, 20s command, 5s ELF and
1 MiB capture budgets. All 146 child commands/292 raw stream hashes and 18
executed ELF identities were audited; 50 distinct source identities are retained.

| Identity | SHA-256 |
| --- | --- |
| Original `exact-review-prepared-01/PLAN.json` | `afec5725bf648a342405e989df08a87b152fdb7a0d5932faf3d9e21629d423de` |
| Original runner | `d9c6bcc409d2427979fedff73b493908709b0976695a29d10f2d8f482dbf133a` |
| Original failed `exact-review-executed-01/RESULTS.json` | `4c9715d8b01ee70521eb99bea3ec465d95661b9306bdef17cbaf430ad6433f0c` |
| Continuation `exact-review-prepared-02/PLAN.json` | `72dccd682f0cf477b373b48a2dd9905ab95321b6ef4cb4a3c809bff01994cc50` |
| Continuation runner | `dd551d1c5f6150bc3ff40443bfea4bb4bafc4c5594e26d571b358c7f3f621cbb` |
| Continuation `exact-review-executed-02/RESULTS.json` | `11200b0204fad203d7b0f9f70678008fb04f065bb0ffce203087b9e6b0dc5474` |
| Compiler, both phases | `65461d3de271152329a6d4c410a925aa6448e97fc0a04298296e8b44e8a71bea` |
| Unexecuted first-failure ELF | `0a100c9f7e2b05b4e632db9ce9c63f81bdb180493c8130b5bb969ff4e3083ab2` |
| `exact-review-evidence-audit.json` | `ee26c2f5702ddd39d91543129686572450af48933c19c33ae14b5b14040b421e` |

General Decimal, imported types, protocols/operators, coherent hashing, dimensions,
scale/affine point/delta relations, self-hosting, FC1 and HATCH remain open.
