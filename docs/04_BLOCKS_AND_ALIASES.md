# 04 — Block Markers and Aliases

## Status and dialects

Implementation specification subject to explicit founder decisions. Nesting depth, rather than a global sequence number, is the documented interpretation of `:(x)`.

`.py` uses the pinned standard grammar without implicit alias-token reinterpretation. `.naja` enables the two extensions. A file does not change dialect depending on the machine. Explicit project associations may add extensions, never silently rewrite third-party files.

A standard Python suite can already start on the same line after `:`; `(0)` there can be an expression. Preserve that behavior. [S01]

## Block depth `:(x)`

```naja
if 1 == 0:(0)
    if 2 == 3:(1)
        print("hello")
```

`x` is a non-negative decimal integer. Root-level headers use zero; each additional lexical suite adds one. Indentation remains the structural authority. An incorrect marker produces a precise diagnostic, expected level and suggested fix.

`elif`, `else`, `except`, `except*` and `finally` share their companion header's depth. `case` is one level below `match`. Functions/classes count as blocks; decorators, blank lines and comments do not. Recognize multiline headers at logical-line boundaries. Follow indentation rules, not naive visual-column arithmetic.

Recognize a marker only after a suite-header colon, at the end of the logical line with an optional comment, when an indented suite follows. Without such a suite, `if flag:(0)` remains a simple suite containing `(0)`; a lint may flag ambiguity. Do not turn valid standard code into an incomplete block.

Do not interpret dictionary entries, slices, annotations, strings, comments or f-string expression punctuation as block markers. Same-line suites do not acquire ambiguous markers. Markers do not change values or effects; debug/source-position metadata can change, so compare semantics and canonical IR rather than demanding identical debug binaries.

`require_block_levels = true` is a project style rule for `.naja`, not a restriction on all valid Python files. `naja fmt` adds/corrects/removes markers only under explicit options. Inlay hints may provide the same visual aid without source edits.

## Project file `naja.alias`

Optional declarative TOML next to the root manifest; no executable code, plugin loading or downloads.

```toml
schema = 1

[operators]
"==" = "equalTo"
"!=" = "notEqualTo"
"<" = "lessThan"
"<=" = "lessThanOrEqualTo"
">" = "greaterThan"
">=" = "greaterThanOrEqualTo"

[builtins]
"print" = "display"
"len" = "length"
```

```naja
if 0 equalTo 1:(0)
    display("hello")
```

Names are case-sensitive. `eualTo` is not `equalTo`; diagnostics may suggest a fix, never silently alter code. HATCH aliases are valid identifiers distinct from keywords, canonical operators and other declared aliases. Reject inconsistent tables before compilation.

### Operators

Recognize aliases in operator position using context and lower them to canonical operator nodes. Preserve precedence, associativity, evaluation order, overloads and short-circuit behavior. [S02] `a lessThan f() lessThan c` evaluates `f()` once. Strings, `obj.equalTo`, keyword arguments and a variable named `equalTo` are not textually replaced.

The six requested comparisons are mandatory. Other compound/boolean operators need separate tests and schema evolution, not user-defined arbitrary precedence.

### Builtins

An explicitly bound local/global `display` resolves normally; otherwise the declared alias can resolve the native NAJA builtin `print`. Lint shadowing rather than secretly correcting it. A local `print` is not automatically renamed. Canonicalization must retain the resolved builtin symbol and use hygienic qualification for source export if needed. Imported functions still use ordinary `import ... as ...` rather than a new global alias category.

### Scope and reproducibility

No search above the project root or in the home directory. Each package owns and ships its table. Hash the table into cache keys and the lockfile. Changes trigger targeted invalidation, diagnostics and LSP refresh.

## Acceptance

Positive cases: nested/sibling blocks, companion clauses, comments, CRLF, multiline headers, decorators, match/case, mixed alias/canonical operators, chained comparison with call counter, builtin aliases and shadowing.

Negative cases: wrong depth, duplicate/keyword aliases, invalid TOML, similar misspellings, wrong case and dependency attempts to alter a parent dialect.

Regression cases: same-line standard suites, dictionaries/slices, strings/comments, f-strings, same-named attributes/local variables and invalid indentation. Regex replacement followed by Python execution is not a production parser or an acceptance test.

## Interactive cells and English examples

`:(x)` is not a cell ID. Optional editor comment `# %%` separates complete top-level units and remains a comment during a normal build. Dialect and aliases are pinned when a session starts; changing them requires a new HATCH session. Caches/source positions include their version/hash. See document 18.

Official examples use English alias names. Users may define aliases in other languages under the identifier rules; the English project policy does not prohibit this capability.
