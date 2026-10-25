# Actual-source native value tests

`node scripts/test-values-language.mjs` builds the current CLI offline, checks
and compiles real `.naja`/`.py` source through the shared frontend, and executes
the emitted Linux x86-64 ELF. It does not use the development RPN/IR adapters,
Python, a foreign interpreter, network services or another compiler in emitted
programs. Rust and Node remain development tools, not a completed autonomy
closure.

The harness was prepared on `5c555bc6e3ff51c9f2f945b069654aa287bc446b` while the
integrator was implementing the source/dynamic-backend bridge and explicit
project-root CLI option. It was subsequently executed after merging committed
compiler integration `bccb6092e901a86273da031713f1381b4e60a2f4` into the test
branch. Preparation and `node --check` alone are not native verification; the
older preparation base was never claimed to accept these programs.

## Recorded execution

At clean test HEAD `9ef3c38360a6e12db0879db07ddc958d4ae3cff8`,
`node scripts/test-values-language.mjs` exited 0 with **84 checks passed and
0 not run**: 51 actual native-outcome checks and 33 compile/project rejection
checks. Expected native failures (type 105, assertion 104 and resource 103) are
checked outcomes, not successful execution of those unsupported operations.
All three symlink/reparse cases executed. No budget or expected result was
changed after execution.

The execution host was Windows x64 with Node `v24.11.0` and Rust
`1.97.1 (8bab26f4f 2026-07-14)`; emitted Linux x86-64 programs executed through
the declared local WSL target. Direct Linux-host execution is supported by the
harness but was not run in this record. The merged test HEAD contains scoped
harness preparation `5cfc9c3c5216abf3d03087eddaa7ea688ea4f7f3` and the committed
compiler integration; it does not include later uncommitted integrator work.

Retained evidence is `target/values-language-ik3Yp1/summary.json`, SHA-256
`073476faba257996c48bc1612d9ee7d50736df1ff34aaa4d74a82ecb51861107`.
Its compiler SHA-256 is
`bb67065f80631a8955c5683d58b1e26f063ec014cbeb326ec3a09b67581bb6d6`;
the executed harness SHA-256 is
`f0e654a38eba6e105a82ab4b314d48721cde6a814d4c1eb4eaf745cd8b678cd3`.
Source/ELF/output/table identities remain in that local summary. In particular,
the chain-middle-once case exited 0 while the deliberate duplicate-middle case
exited 103 under the same 64 MiB arena and five-second target limit.

## Contracts and coverage

The expected results follow specification 03, specification 04 and continuation
L01/L03/L04/L12, together with the bounded string/bytes decoder and dynamic value
contracts. The tests cover this slice, not the entire required language:

- Text, Bytes, Bool, None and arbitrary-precision integer literals; embedded NUL,
  Unicode scalar text, raw escapes, every byte value and bytes quote selection.
- Numeric int/bool addition, subtraction, multiplication and unary positive/
  negative operations. Arithmetic results are integer values; no narrowing is
  authorized by an annotation.
- Immutable text/bytes concatenation and retained aliases; text `len` counts
  Unicode scalars, including combining scalars separately, and bytes `len`
  counts bytes.
- Comparison results as Boolean values; numeric bool/int equality and ordering;
  Unicode-scalar and unsigned-byte ordering; unequal unrelated kinds and explicit
  failure for unsupported ordering.
- `not`, `and`, `or` precedence, original operand return, truthy if/while/assert,
  skipped right operands, and deliberately live counterparts which fail with
  type exit 105. Failed assertions exit 104 before later output.
- Comparison chains and skipped later operands; an arena-bounded middle-operand
  construction test and a deliberate duplicate-allocation resource control.
- `.naja : int` runtime guards which retain Int/Bool descriptors, including Bool
  printing as True/False; the `.py` annotation remains informational. Other
  annotation types remain unsupported.
- Explicit `--project-root` activation for check/build/run/test, conventional
  spellings, contextual comparison/print/len aliases, same-named locals, Unicode
  and NFKC alias use, original source diagnostics and opaque label/string data.
- Per-owner tables, edits between fresh compiler invocations, module/root/nested
  marker boundaries, optional missing tables, malformed/oversized tables, absent
  markers, parent traversal and symlink/reparse rejection. No ambient table is
  activated from the working directory. Explicit `.py` activation is an error.

Local alias shadowing is tested through values and rejection of a call to a
bound non-callable alias name. Methods, imports, function side effects and editor
cache refresh are not implemented by this source slice. Tests of fresh table
loads do not establish a persistent cache or dependency resolver. The project
manifest is only the implementation's bounded ownership marker; full manifest
semantics are not inferred from it. Relative SOURCE paths remain relative to
the invoking working directory, even with an explicit project root.

The numeric-string constant multiplication rule reserved by L11 is not frozen
as a type error here. Repetition negatives use runtime/non-numeric text or bytes;
floats, functions, collections, methods, adjacent literal concatenation and the
decoder's documented unsupported escape forms are separately rejected. These
failures remain visible limitations, not successful HATCH implementations.

## Independent expectations and limits

Node BigInt supplies numeric expectations. Text comparison uses codepoint arrays,
not JavaScript UTF-16 ordering. Bytes comparison and representation use explicit
unsigned-byte rules. The harness compares exact output buffers, including text
NUL and newline bytes; it never uses Python as an oracle.

`chain-once-arena.naja` builds an 8 MiB text value, retains a 16 MiB concatenation,
then evaluates `assert s < s + s > s`. Under the declared noncollecting 64 MiB
arena, one middle concatenation fits. The explicit duplicate-middle control
exceeds the same budget and must exit 103. No allocation budget is raised after
a failure. This is a construction-slice allocation check, not a substitute for
observable function-call counting once functions/effects become available.

Every native artifact has an external five-second target timeout, with a
one-second kill-after interval. Each ordinary host command is bounded to twenty
seconds, the offline build to thirty seconds, and the whole harness to 180
seconds. Captured host output is capped at 8 MiB. These are test limits, not a
language sandbox or a runtime loop quota. Symlink creation denied by the host is
recorded `not_run`, never as a successful symlink check.

Windows requires the declared local WSL Linux x86-64 tools; Linux x86-64 executes
directly. No tools are installed by the script. Source, unsigned ELF, raw output,
partial failure evidence and `summary.json` remain under ignored
`target/values-language-*`. Successful summaries retain actual Git HEAD/status,
host/target, compiler and harness digests, source/ELF/output hashes, per-case
alias-table identity, results and explicit not-run counts. The script does not
write public planning, verification counters or reports.

Run from a checkout containing the integrated source bridge:

```text
node --check scripts/test-values-language.mjs
node scripts/test-values-language.mjs
```

Full strings/containers/functions, managed memory, numerical data foundations,
modules, complete alias/editor behavior, native cells, self-hosting, productive
domain APIs, clean-host installation and remaining FC1/HATCH requirements stay
open. A passing result only verifies the supplied source/native cases on its
recorded source and target.

After direct function support was integrated, the old negative fixture containing
only a plain `def`/`return` became supported. The unsupported-function check now
uses a default parameter, whose semantics remain unimplemented. Historical
84-case sources/results remain unchanged. Real function execution is covered
separately; parser acceptance alone is not counted as native verification.

## Signed division source extension

The harness now additionally compiles ordinary `.py` and `.naja` `//`/`%` source.
The additional cases cover all operand signs and Bool numeric behavior,
precedence/left associativity, 1200/120-digit arithmetic, immutable operand
aliases, reconstruction identities, skipped short-circuit branches and actual
failure order. Node BigInt truncates toward zero; the independent oracle adjusts
nonzero opposite-sign remainders to floor semantics and checks reconstruction
and divisor-signed range. No Python process is executed.

Runtime zero cases require exact NJA206/exit106, type cases NJA205/105, and a
1001-by-1000-limb operation requires the preregistered NJA203 work error/103.
The general one-million-limb-pair budget, arena, deadlines and earlier expected
outcomes are unchanged. Fixed-i64 division remains rejected and `/` remains
unsupported. The original 84-case historical execution above remains pinned to
its original source; later retained command records identify the expanded
harness execution separately.

The manifest-loader integration requires generated alias-project fixtures to
contain real schema-1 `[project] name` declarations. The earlier comment-only
markers now have their own explicit rejection case, alongside malformed
manifests, unenforced profiles/style, unavailable targets, unresolved dependencies
and Python-dialect activation. The failed combined run at source432ee9d is
retained in `reports/checks/v13-functions-values-language.json`; it found a stale
fixture, not a reason to relax manifest validation. Existing ownership, symlink,
namespace and alias-conflict expectations are unchanged.
