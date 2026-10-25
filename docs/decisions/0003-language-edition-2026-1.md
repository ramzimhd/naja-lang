# ADR-003 — NAJA 2026.1 and additive continuation contracts

Date: October 25, 2026. Status: accepted under the founder's explicit revision 1.3
authorization. Integrator: /root. Implementation remains incremental and tested.

NAJA is an independent language. `.naja` selects edition `2026.1`; `.py` retains
the separately pinned Python 3.15.0 compatibility surface without NAJA-only
coercions or syntax reinterpretation. No Python or .NET runtime/tool is permitted
in the required chain. Existing explicit-i64 source remains a bounded seed subset,
not FC1 and not a narrowing of hosted integers.

| Inherited statement | Authorized governing contract | Preservation/revalidation |
|---|---|---|
| Only depth markers and aliases extend grammar | L01–L15 also authorize general braces, transparent named sections, typed literals and constrained/pattern-derived type syntax | Keep old IDs/tests and add edition-specific fixtures; revalidate CMP/SYN/editor/cell gates |
| Pinned Python grammar defines syntax coverage | It remains the separately measured `.py` baseline; independent NAJA syntax is versioned | Keep compatibility/production inventory and every existing evidence reference |
| No networking braces | General suite braces are allowed; networking-specific syntax is unnecessary | Network API, framing, limits and lifecycle obligations remain unchanged |
| Smart values only validate | Immutable checked captures/properties and structural schemas are required | Add L09/L10 mappings; no regex backtracking or splitting shortcuts |
| Unit conversions need pairwise handlers | Resolved algebra protocols plus declared exact scale/affine relations derive valid operations | Add typed-literal/relation positive and negative tests; no official-name switch |
| Checkpoint ends implementation | Checkpoints enable continued work toward FC1 and full HATCH | Persist ownership/recovery; stop only for the mandate's actual stop conditions |

## Initial block grammar and shared implementation boundary

Keep `lex(source)` and `parse_cst(source)` as the unchanged compatibility entry
points. Add an explicit dialect-aware shared frontend entry point. The compiler,
future formatter/editor and cells consume the same original-source token spans.
No preprocessor rewrites text, dedents selections or strips enclosing conditions.

In `.naja`, a recognized suite header ends with `: {` and then optional ordinary
comment or a single-line `# Label #`, followed by newline. Suite statements begin
on the next line. `{# Label #` at statement start opens a named transparent
section. The closing `#` terminates metadata; missing terminators or trailing
non-comment code are errors. A standalone `{` without a label remains expression
syntax, not an anonymous section. Dictionaries/sets, strings, regex literals and
comments retain their token identities. Labels are metadata, never bindings,
transactions, tasks, implicit scopes or cells.

Suite braces are distinct structural tokens from expression braces. Newlines
remain significant in a brace suite; indentation is stylistic there. Each suite
owns one delimiter system. A nested indentation suite uses its header's physical
indentation as its baseline and must close before its containing brace closes.
Expression grouping suppresses logical newlines only inside that expression.
Outer indentation is suspended, not discarded, while its nested brace suite is
active. A closing brace closes only its matching brace suite. `} else: {` and
`}` followed by `else: {` associate with the nearest unfinished conditional;
stray or ambiguous clauses are diagnosed. Positive/negative mixed-style fixtures
must accompany implementation rather than relying on visual formatting guesses.

Depth markers remain suite nesting depth for indentation blocks. Labels decorate
brace blocks. Combined depth/brace decorations reject until explicitly supported.
Named sections preserve enclosing variable scope and source evaluation order.
No metadata-only grouping may add machine instructions or a cleanup boundary.

The first executable slice extends the current checked-i64 backend with these
block forms. It does not imply ordinary values, classes or other FC1 checks are
implemented. Follow with native value/semantic/runtime foundations; do not stop
at this slice or close FC1/R01–R19 from parser snapshots.

## Continuity and acceptance

Preserve inherited planning documents, statuses and logs by ID. Add stable L/FC1/C
coverage entries, including explicit inherited and expansion mappings. Changed
acceptance records contract revision 1.3 and reasons for revalidation; old results
remain tied to their original tested source/contract. Unknown measurements remain
null/not_run. Human productivity data cannot be fabricated from agent timing.

Use one integration owner and a shared-local-repository atomic reservation. A
timestamp is not authority to steal an owner. Persist concise factual checkpoints,
not private chat transcripts. A supported client resume interface is distinct
from a tested automatic supervisor; no new paid/API fallback, credential
extraction, account switching or persistent service is authorized.
