# Unicode 17.0.0 source names and NFKC

The independently implemented frontend now validates source NAME tokens with
Unicode 17.0.0 `XID_Start` plus underscore and `XID_Continue`. This matches the
version linked by the pinned Python 3.15.0 lexical reference at commit
`d220409a13b77de7a6c30abe16ea90db01528edc`; its `unicodedata_db.h` declares
`UNIDATA_VERSION "17.0.0"`. Those Python files are read-only references. No
Python interpreter, oracle, generated Python execution service or build script
is used.

`naja_frontend::canonical_identifier(&str)` validates a raw NAME spelling and
returns its NFKC symbol key, preserving case. The source lexer never rewrites
bytes or token spans. The resolver must recognize raw keywords first, then use
canonical keys consistently for declaration/use/collision handling. The helper
does not reserve normalized keyword lookalikes, case-fold names, rewrite string
prefixes or normalize strings, labels, comments or string-based runtime lookups.
Its errors contain original name-relative byte spans. `is_identifier` checks
lexical NAME rules; raw keyword grammar remains a separate parser concern.

Unicode identifiers are not restricted to English, Latin or a single script.
Combining marks may continue names but cannot start them unless the actual
XID_Start property permits it. Unicode 17.0.0 includes U+200C/U+200D in
XID_Continue; these are not silently removed. Confusable detection, bidirectional
display review, editor presentation and security lint policies remain separate
work. Accepting an identifier is not a guarantee that its appearance is safe.

## Frozen reference data and offline checks

`provenance.json` records the official URLs, byte lengths and SHA-256 hashes.
The Unicode data and exact Unicode-3.0 license were acquired on October 25, 2026.
The upstream Python lexical chapter hash also matches the existing compatibility
baseline. No Python implementation source is copied into this directory.

`regenerate.mjs` deterministically validates six acquired reference files before
extracting two ASCII test fixtures. It preserves all 2201 XID property ranges
and all 20034 normalization vectors with their five columns and section markers;
only explanatory comments/layout are removed. The data remains subject to the
included Unicode license and attribution. Test data is compiled into test
executables only, not the distributed compiler's ordinary source-name service.

The Rust tests compare start/continue results for **all 1112064 Unicode scalar
values**, including underscore's additional start rule. NFKC tests check every
official vector's five input forms against its NFKC column, then check identity
for every scalar absent from Part 1. The latter also verifies identity for
unassigned scalars, beyond the official assigned-scalar default invariant.
Integration cases cover multilingual names, compatibility equivalence, combining
marks, case sensitivity, invalid starts/continuations, numeric suffix boundaries,
original byte spans and long combining sequences. They do not execute CPython.

Run ordinary checks without network access:

```text
cargo +1.97.1 test -p naja-frontend --locked --offline
cargo +1.97.1 clippy -p naja-frontend --all-targets --locked --offline -- -D warnings
cargo +1.97.1 tree -p naja-frontend --locked --offline -e normal,build
```

For an explicit development reference refresh, acquire the six files listed in
`provenance.json` into a separate directory without executing them, then run:

```text
node compatibility/unicode/regenerate.mjs --source DIRECTORY
```

The regeneration command makes no network calls. Normal builds/tests do not run
it or download reference data. A baseline/version change requires reviewed new
hashes, fixtures, dependency pins and compatibility evidence; it is not an
automatic move to the latest Unicode release.

## Temporary Rust seed dependency review

| Package | Version | License | Enabled dependency surface |
|---|---|---|---|
| `unicode-ident` | 1.0.24 | `(MIT OR Apache-2.0) AND Unicode-3.0` | Frozen Unicode 17 tables and property lookup; no normal/build dependencies |
| `unicode-normalization` | 0.1.25 | `MIT OR Apache-2.0` | `std`; frozen Unicode 17 decomposition/composition tables, `tinyvec` with `alloc` |
| `tinyvec` | 1.12.0 | `Zlib OR Apache-2.0 OR MIT` | `alloc`, `tinyvec_macros`; optional serialization/format integrations are disabled |
| `tinyvec_macros` | 0.1.1 | `MIT OR Apache-2.0 OR Zlib` | Declarative macros; no normal/build dependencies |

Archive hashes agree with the Cargo lockfile checksums. The direct versions are
exact manifest pins; all four versions are fixed by the shared lockfile. Package
source and public package-cache entries were inspected; credentials and account
configuration were not read. Three archives were already cached. The missing
normalization archive was acquired from `static.crates.io` and hashed; explicit
`cargo info unicode-normalization@0.1.25 --registry crates-io` acquired its missing
public index entry before `cargo generate-lockfile --offline`. That acquisition
is distinct from the ordinary offline compiler build/test closure.

Enabled crate manifests have no build scripts or foreign runtime dependencies.
Dependency dev tests, maintainer generators and benchmark packages are outside
this project's graph and are not executed by these checks. Upstream source
archives may contain maintainer generation scripts; their presence does not make
them part of NAJA's mandatory chain.

`unicode-ident` has two unsafe leaf-table lookups. The checked trie lookup falls
back to chunk zero; both immutable trie tables have maximum chunk 242, `CHUNK`
is 64, and the maximum leaf offset is `242 * 32 + 63 = 7807`, within the
7808-byte leaf table. The ASCII bit shift is guarded by `is_ascii()`. These
bounds were inspected in the exact cached source and property behavior was
compared against the independently acquired official ranges for every scalar.

`unicode-normalization` locally allows unsafe scalar construction for Hangul
despite its crate-level unsafe lint. Decomposition first checks syllables in
U+AC00..U+D7A3, then produces initial/vowel/final Jamo within their valid BMP
ranges. Composition guards both operands' Jamo/syllable ranges; the resulting
syllable remains U+AC00..U+D7A3, below surrogate code points. The actual arithmetic
and guards were reviewed, and all Hangul/default normalization cases are included
in the conformance checks. Canonical ordering uses stable `sort_by_key`, not an
unbounded recursive regex or external process. `tinyvec` and its macro crate
forbid unsafe code in their own sources. Standard-library internals remain part
of the temporary Rust seed boundary.

This is a scoped source/dependency/conformance review, not an external security
audit or a proof of all allocation/resource behavior. Source-size limits remain
declared by the frontend/driver; the normalization helper relies on available
memory and does not introduce an English-only or arbitrary small name limit.
These Rust packages must not become an opaque permanent dependency of the final
NAJA self-hosted closure. This work does not establish full grammar, executable
Unicode semantics before resolver integration, Unicode string runtime support,
self-hosting, FC1 or HATCH completion.
