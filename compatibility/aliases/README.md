# Contextual alias configuration foundation

This implements the shared T07 configuration/lookup foundation specified by
[docs04](../../docs/04_BLOCKS_AND_ALIASES.md) and
[L03](../../docs/continuation/02_LANGUAGE_CONTRACTS.md). It does not establish
native alias execution, project discovery, cache invalidation, editor updates
or complete L03/HATCH acceptance. The calling project/module owns its table;
the frontend never searches directories or changes dependency source semantics.
It adds no dependencies and requires no external interpreter, IO or network
at build/test time.

## Explicit bounded grammar

Format 1 supports the documented tables and canonical targets:

| Table | Canonical keys |
| --- | --- |
| `operators` | `==`, `!=`, `<`, `<=`, `>`, `>=` |
| `builtins` | `print`, `len` |

The grammar is a deliberately limited subset of
[TOML 1.0.0](https://toml.io/en/v1.0.0), not a general TOML implementation:

```text
document    := (blank | comment | schema | header | assignment)*
schema      := schema WS? = WS? 1 TRAILING       # root, before any table
header      := [ WS? (operators | builtins) WS? ] TRAILING
assignment  := BASIC WS? = WS? BASIC TRAILING   # inside one supported table
TRAILING    := WS? (# comment)? (LF | CRLF | EOF)
WS          := one or more ASCII spaces/tabs
BASIC       := one-line double-quoted TOML basic string
```

Line indentation is allowed. `schema = 1` is optional and defaults to format
1, including the table-only L03 example; any other version or duplicate schema
rejects. Table headers may appear once each, in either order. Keys are canonical
operator/builtin spellings; values are user-defined aliases. Empty tables and an
empty configuration are valid. No declaration can follow another on one line.

Basic strings support escaped quote/backslash, `\b`, `\t`, `\n`, `\f`, `\r`,
and scalar-valued `\u`/`\U` escapes with exactly four/eight ASCII hexadecimal
digits. Unknown escapes, surrogate/out-of-range values and unescaped ASCII
controls other than tab reject. Hashes are comments only outside strings.
Comments permit tab but not other ASCII controls. Newlines are LF or CRLF;
standalone CR rejects. Escaped characters are decoded before target/name checks.

Single-quoted or multiline strings, bare/dotted assignment keys, arrays,
inline tables, array-of-table sections, BOMs and other TOML data types are
unsupported by this initial format. Unsupported sections, including `keywords`
and `types`, reject rather than silently doing nothing. Docs04/L03 define no
keyword/type alias tables. Arithmetic/boolean/compound operator targets and
glyph aliases such as multiplication/division signs remain unimplemented.
They need separate schema/grammar tests before support can be claimed.

## Public API and origin

```rust
parse_aliases(config: &str, environment: AliasEnvironment<'_>)
    -> Result<AliasTable, Vec<Diagnostic>>
```

`AliasEnvironment { edition: &str, policy: &str }` provides explicit cache
inputs. The service treats their bytes as opaque identity inputs; the caller
owns dialect, project/module authorization and policy interpretation.
`AliasTable::source()` returns the exact original config. `entries()` returns
the decoded alias, its NFKC `canonical_alias`, canonical `AliasTarget` and
assignment/key/value spans. Quoted key/value spans include their original
quotes and escape spellings; assignment spans exclude leading whitespace and
trailing comments. Every entry and parser diagnostic span belongs to the
configuration. They are never substituted for the using source token's span.
Environment-limit diagnostics use an empty config span and explicitly name
the external input. The compiler/editor must retain both origins when showing
a source use alongside its configuration definition.

`AliasTable::lookup(context: AliasContext, canonical_candidate: &str)` accepts
an already validated `canonical_identifier` result and returns a borrowed
`AliasEntry`, or none. There are exactly two explicit lookup contexts:

- `ComparisonOperator` yields `AliasTarget::Comparison(Symbol)` for the six
  canonical comparison nodes. Existing grammar owns precedence, associativity,
  chaining, evaluation order and operator overload behavior.
- `UnboundBuiltin` yields `AliasTarget::Builtin(BuiltinAlias::Print | Len)`
  only after the consumer has checked explicit local/global/imported bindings
  and canonical builtin spellings. Bound alias names keep their ordinary symbol
  meaning. A canonical builtin name is never automatically renamed.

Raw keyword handling comes before name normalization and lookup, as in the
existing source-name contract. A parser selects contexts deliberately; it must
never call operator lookup on member names, declarations, keyword arguments or
ordinary expression identifiers. Strings, comments, regex data and labels do
not enter identifier lookup. The table never edits `Lexed`, token kinds, source
bytes or AST nodes. Conventional syntax remains the consumer's normal grammar.
The pure library does not enable aliases for `.py`, select source extensions,
walk parent directories or retroactively apply a table to dependencies.

## Conflict and Unicode policy

Each canonical target may have one alias. Table and target duplicates reject,
including different quoted escape spellings of the same key. Alias names must
be valid Unicode 17 XID identifiers under the shared frontend service; names
are case-sensitive, and NFKC-equivalent names collide across both tables.
Alias declarations matching a raw Python hard keyword or `match`, `case`,
`type`, `_` reject to avoid ambiguous reserved grammar positions. NFKC-only
keyword lookalikes retain the established identifier rule: they do not reserve
new raw keywords. Config escaping is decoded first, so an escaped spelling of
the actual keyword is still reserved. Canonical builtin names `print` and `len`,
including NFKC equivalents, also reject as alias values to keep their existing
spellings unambiguous. English project prose does not restrict user alias names
to ASCII or English. There is no case folding or confusable-name prohibition.

## Bounds and deterministic identity

`ALIAS_CONFIG_MAX_BYTES` limits raw configuration to 65,536 UTF-8 bytes.
`ALIAS_NAME_MAX_BYTES` limits each decoded alias to 256 UTF-8 bytes, before
NFKC. Edition/policy inputs are limited to 128/4096 bytes. Format 1 has at most
eight targets. Parsing is iterative and linear in config size, with fixed-size
escape loops and constant-bounded target/name collision scans. All returned
diagnostic spans are valid original UTF-8 byte boundaries. Invalid inputs return
the first `ALIAS_DIAGNOSTIC_LIMIT` (32) diagnostics, never a partial usable table.
Once an unsupported table is diagnosed, its entries are not interpreted in the
preceding section. Lookup compares at most eight stored canonical names; callers
perform source identifier normalization under their existing source budgets.

`cache_identity()` returns exact deterministic serialized bytes, not a digest.
It starts with `NAJA.alias\0`, then format 1 as an unsigned 64-bit big-endian
integer. The raw config, edition and policy follow in that order, each as an
unsigned 64-bit big-endian byte count followed by the exact UTF-8 bytes. Length
delimiters distinguish field partitions, and raw bytes retain comments,
whitespace, line endings, schema omission and declaration order. No random Rust
hashing is used. A future cache may hash these bytes through its audited digest
service and must use the identity for invalidation; this library implements no
cache or lockfile mutation.

## Verification and limits

`tests/syntax/aliases.rs` covers all eight canonical targets, explicit contexts,
case and Unicode equivalence, multilingual identifiers, raw/NFKC keyword rules,
duplicates/conflicts, comments and quoted escapes, malformed/unsupported input,
original CRLF/UTF-8 config spans, exact resource limits and cache identity.
Bounded malformed character vectors verify safe diagnostics without an external
parser/oracle or wall-time thresholds. Source-token immutability is checked in
both dialects with same-named bindings/members, strings, regex-like text and
comments. These tests establish configuration and contextual mapping, not actual
parser precedence or native shadowing/chain execution; root integration owns
those proofs.

```powershell
cargo +1.97.1 test --manifest-path bootstrap/frontend/Cargo.toml --locked --offline
cargo +1.97.1 clippy -p naja-frontend --all-targets --locked --offline -- -D warnings
cargo +1.97.1 fmt --all -- --check
```
