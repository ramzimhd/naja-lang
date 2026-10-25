# Actual-source native value tests

`node scripts/test-values-language.mjs` builds the current CLI offline, checks
and compiles real `.naja`/`.py` source through the shared frontend, and executes
the emitted Linux x86-64 ELF. It does not use the development RPN/IR adapters,
Python, a foreign interpreter, network services or another compiler in emitted
programs. Rust and Node remain development tools, not a completed autonomy
closure.

The harness was prepared on `5c555bc6e3ff51c9f2f945b069654aa287bc446b` while the
integrator was implementing the source/dynamic-backend bridge and explicit
project-root CLI option. Preparation and `node --check` are not native
verification. A passing run requires that subsequent compiler integration;
do not attribute a future run to the preparation base or claim the older source
already accepts these programs.

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
