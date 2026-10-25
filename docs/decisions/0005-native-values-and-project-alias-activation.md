# ADR-005: Native value source foundation and explicit project aliases

Status: accepted as a reversible implementation foundation, October 25, 2026.
This does not waive L01–L15, the pinned compatibility contract or any FC1/HATCH
gate. The temporary Rust seed must still be replaced through the NAJA source
closure and B1–B3 work.

## Shared parsing and native values

Ordinary source uses the existing shared lexer, names, suites and generic
executable parser, selecting the native tagged-value IR. The earlier explicit
checked-i64 and development hosted-integer domains retain that same parser.
There is no second source language, textual rewrite, foreign interpreter or
bytecode dispatch loop. New dynamic values include arbitrary-precision decimal
integers, UTF-8 text, bytes, Bool and None. The shared literal decoder retains its
documented limitations, including unsupported surrogate text and named escapes.

Supported operators preserve their ordinary precedence and left-to-right operand
evaluation. Comparisons produce Bool; chained comparisons evaluate the middle
operand once and skip later operands after a false pair. Truthiness, not, and/or,
if/else/while and assertions use native operations. And/or return an operand;
not returns Bool. Bool participates numerically as zero/one; unary positive and
arithmetic return Int. Text+Text and Bytes+Bytes concatenate. Length counts text
Unicode scalar values, including combining marks separately, or bytes. Text data
is never NFKC-normalized. Immutable descriptors preserve assignment aliases.

Explicit `.naja` int declarations establish a noncoercing numeric boundary for
initial and later assignments. Int and its Bool subtype retain their original
descriptor and precision; other implemented kinds fail with type exit105. A
local binding shadowing the annotation's compiler-provided int is diagnosed.
In `.py`, the supported int annotation is informational and never narrows,
converts or rejects a dynamic value. Other annotation forms, general type
resolution, repeated declarations and a complete type system remain unsupported.

Floats, repetition, general conversions, user functions/classes/collections,
recoverable exceptions and other promised operations remain required. In
particular, unsupported string multiplication does not settle the founder's
numeric-literal conversion contract. It must later resolve direct operations and
that contract explicitly. Unimplemented forms are rejected or report the scoped
native type failure; they are never routed to Python or silently reinterpreted.

## Explicit owning-project alias context

The CLI accepts `--project-root PATH` on check/build/run/test for `.naja` modules.
SOURCE keeps its cwd-relative meaning; the loader receives an absolute spelling
without erasing link/traversal components. No alias file is discovered without
this option, and `.py` explicit activation is an error. Only the supplied root's
`naja.alias` participates. The root/module/marker paths, containment, nested
project boundaries and bounded configuration are validated as documented in
`tests/project/README.md`. The current nonempty UTF-8 naja.toml marker is not a
manifest parser, dependency resolver or permission sandbox.

The shared alias table maps only documented comparisons and print/len. Original
source/config spans remain available. Lookup occurs in comparison-operator or
unbound builtin-call positions after raw keyword and canonical binding checks.
An assignment can bind an alias name normally; its later variable reference does
not select a builtin. Strings/comments/member names are never rewritten.
Conventional spellings continue to work. Source imports and dependency ownership
resolution remain unimplemented; callers must supply each module's actual owner.

The table exposes collision-free versioned identity bytes covering raw config,
edition and policy. There is currently no compiler cache, package lockfile alias
entry or LSP invalidation implementation to claim. These remain acceptance work.

## Limits and evidence

The temporary 64 MiB native arena has no reclamation. Resource exit103,
assertion exit104, type exit105 and I/O exit102 are process failures with
best-effort diagnostics, not recoverable language exceptions. The parser and IR
retain bounded source/literal sizes, locals, tree depth, suites and operations;
chains are limited to128 comparisons. There is no runtime loop quota or sandbox.
Unix filename conversion is tested independently of a filesystem's ability to
create invalid-byte names; macOS EILSEQ fixture rejection remains observable.

Work-unit tests and real WSL execution demonstrate the implemented slices only.
New retained records must name the actual committed source and preserve failures.
The earlier 14-record proof set remains pinned to source4f93a39 and does not
silently certify this later foundation or satisfy whole-feature acceptance.
