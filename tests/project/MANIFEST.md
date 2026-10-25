# Bounded project manifest parser

This is the schema-1 parser contract selected before its implementation tests.
It is a declarative TOML subset, not full TOML, a dependency resolver, lockfile
implementation, capability grant or a claim that every declared target runs.
The explicit project alias loader now validates this subset and refuses declared
capabilities it cannot enforce; see [README.md](README.md). The pure parser still
recognizes broader metadata than that loader can activate.

## Field layout

```toml
schema = 1 # Optional; omission means schema 1, as in naja.alias.

[project]
name = "Example"
dialect = "naja"
edition = "2026.1"
profile = "hosted"
entry = "src/main.naja"
targets = ["x86_64-pc-windows-msvc", "x86_64-unknown-linux-gnu"]

[style]
require_block_levels = false

[dependencies.geometry]
path = "vendor/geometry"
# Optional metadata, not a verified tree hash or lock/resolution claim:
sha256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

This example demonstrates parser metadata. The current explicit alias loader
rejects its Windows target and declared dependency rather than activating them.

Only root `schema`, the `[project]` fields above, `[style]` and individual
`[dependencies.NAME]` tables are accepted. An empty `[dependencies]` namespace
table is allowed; inline dependency declarations are unsupported. Root `schema`
must precede all tables because TOML table scope persists. Tables and keys cannot
be repeated, including identical repeats. `target = "TRIPLE"` is the
singular alternative to `targets`; declaring both rejects. An explicit targets
array is nonempty and contains no duplicates. Targets are typed, bounded lexical
triples; the parser does not determine whether a backend supports them.

`[project] name` is required. Omitted dialect/profile/style mean `naja`, `hosted`
and `require_block_levels = false`. Entry and targets may be omitted; no path or
host target is inferred. The supported dialect spellings are `naja` and `python`.
NAJA edition is `2026.1`; Python compatibility edition is pinned `3.15.0`. Edition
defaults according to the selected dialect; explicit mismatches reject. Profiles
are `hosted`, `core` and `embedded`, as metadata only. Requiring NAJA block levels
in the Python compatibility dialect rejects. The consumer must separately reject
unavailable capabilities, style enforcement, dependency use and target emission.

Each dependency table has a required local `path` and optional lowercase
64-hex `sha256` metadata. A local path is a portable relative spelling: no root,
empty/dot component, backslash, URL/scheme/stream colon, reserved filename
characters (`<`, `>`, `"`, `|`, `?`, `*`), private `.git` component,
Windows device name, trailing dot/space or control character. Dependency paths
may contain bounded `..` components, including `../sibling`, because dependencies
can own sibling roots. Entry is project-relative and rejects every `..` component.
Dependency names are case-sensitive ASCII TOML package labels, not NAJA source
identifiers; no Unicode normalization or source binding is implied. Unicode
project names and path data remain available. The parser never checks existence,
resolves links, verifies declared content hashes or reads dependency sources.
The eventual resolver must canonicalize each owner and validate its lock/hash
before use; URLs remain unsupported.
Reserved filename/device spellings follow the listed rules in
[Microsoft's file naming documentation](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file),
including the superscript-digit COM/LPT names. These are lexical checks, not a
guarantee that a particular filesystem accepts a path or that the file exists.

## Frozen resource and syntax bounds

- Input: at most 65,536 UTF-8 bytes; physical line at most 8,192 bytes.
- At most 128 nonblank/noncomment declarations, including table headers.
- At most 32 local dependency tables and 16 strings per array.
- Decoded string: at most 4,096 UTF-8 bytes; project name: 256 bytes;
  dependency key: 64 ASCII bytes; target identifier: 96 ASCII bytes.
- Path: at most 1,024 UTF-8 bytes and 32 nonempty components.
- Table depth: at most two (`dependencies.NAME`); array depth: one. Parsing is
  iterative and does not recurse on input structures.
- At most 32 diagnostics; any error returns no partial successful manifest.

Supported syntax is one declaration per physical LF/CRLF line; spaces/tabs;
ASCII bare structural keys; one-line double-quoted TOML basic strings with
standard simple and `\u`/`\U` scalar escapes; decimal unsigned integers;
`true`/`false`; one-line string arrays with an optional trailing comma; and `#`
comments outside strings. Unicode string data is preserved without normalization.
Names, paths and targets have their own validation after string decoding.

Literal/multiline strings, multiline arrays, inline tables, array tables, dotted
assignment keys, quoted structural keys/table names, dates, floats, integer
bases/separators/signs, BOMs and unknown fields/tables are explicitly unsupported.
Unescaped controls and standalone CR reject. Unsupported content is never ignored.

## API and evidence scope

`parse_manifest(&str) -> Result<ProjectManifest, Vec<naja_frontend::Diagnostic>>`
does not access files, environment, network, process execution or global state.
It returns typed schema/dialect/edition/profile/path/target/style/dependency
metadata. Explicit settings retain their original half-open UTF-8 byte span;
default settings carry `None` rather than a fabricated source position. The full
unmodified source remains available. Stable diagnostics use `M0001` for resource
limits, `M0002` syntax, `M0003` unsupported forms/fields, `M0004` duplicates,
`M0005` missing fields, `M0006` wrong types and `M0007` invalid values.

The scoped integration test imports the module with `#[path]`; it does not modify
the driver's module wiring. Run `cargo test --locked --offline -p naja-seed
--test manifest`. Scoped formatting can use `rustfmt --check --edition 2024` on
the two new Rust files. Passing these tests is parser evidence only; T12, FC1 and
full HATCH acceptance remain separate work.

On October 25, 2026, the scoped test command exited 0 with 17 passed, 0 failed
and 0 ignored on the Windows development host using Rust/Cargo 1.97.1. Scoped
Clippy (`cargo clippy --locked --offline -p naja-seed --test manifest -- -D
warnings`), rustfmt and authored whitespace checks also exited 0. The tests
include 1,200 deterministic scalar mutations; this is not an external audit or
a full TOML conformance claim. That parser-only result precedes the explicit
project loader wiring described below and in the adjacent README.

The current explicit loader accepts only NAJA 2026.1, hosted, optional/false
block-level requirements, no declared local dependencies and omitted targets or
`x86_64-unknown-linux-gnu`. Other recognized metadata rejects with an original
manifest field span; recognition does not confer capability. Entry is still
declarative metadata because the explicit CLI SOURCE selects the module. Exact
original manifest bytes are bound into each returned alias table's identity;
comments and metadata changes invalidate that identity without rewriting source.
