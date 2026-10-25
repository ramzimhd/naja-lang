# Initial lossless frontend

`naja-frontend` is an independent Rust seed crate. Unicode services use two
exactly pinned direct Rust dependencies and two transitive dependencies;
`compatibility/unicode/` records their versions, checksums, licenses and limits.
It is an implemented lexical/CST foundation for T05, not a complete parser or a
claim of Python 3.15 grammar coverage. It invokes no Python interpreter or oracle.

The compatibility entry points are `lex(&str) -> Lexed` and
`parse_cst(&str) -> Cst`; both select `Dialect::Python` as before. Explicit
`lex_with_dialect(source, Dialect::Naja2026)` and
`parse_cst_with_dialect(source, Dialect::Naja2026)` select the founder-authorized
2026.1 block syntax. Source extensions are selected by the caller, not guessed
by this library or changed through ambient settings.
`Lexed::significant_tokens()` is a borrowed iterator over non-trivia tokens;
logical newlines, indentation, invalid tokens and EOF remain. `Lexed::text`
returns original lexemes. Diagnostics must be rejected before execution.

The frontend preserves every original UTF-8 byte, trivia, comments, optional
initial UTF-8 BOM and LF/CRLF/CR line endings. Token spans are half-open byte
ranges, while `Lexed::position` reports one-based Unicode-scalar positions.
Structural indent/dedent, EOF and a final logical newline may have empty spans.
`Lexed::reconstruct()` concatenates token text to reproduce the exact input.

Implemented tokenization covers Unicode 17.0.0 identifiers, decimal/base integer lexemes
without numeric conversion or width limits, decimal float lexemes, ordinary and
raw single/triple quoted strings, byte strings, comments, standard operators,
bracket continuation and explicit backslash continuation. Indentation uses tab
stops of eight and a second column count to reject ambiguous tabs/spaces;
comments and blank lines do not change indentation. The lexer retains escapes
as original source bytes. Invalid numbers, characters, delimiters, indentation and
unterminated strings have English diagnostics with source spans.

Unicode string/comment data is preserved. Identifier starts follow XID_Start
plus underscore; continuation characters follow XID_Continue. Raw source names
remain byte-for-byte tokens. `is_identifier` validates lexical NAME spelling;
`canonical_identifier` returns its NFKC symbol key or a relative-byte error.
Resolvers call the shared service after raw keyword recognition and use canonical
keys for declarations, uses and duplicate-name detection. Neither tokenization
nor this service silently reserves a compatibility spelling that normalizes to
a keyword. Case is significant; no case folding or confusable-name restriction
is implied. String prefixes remain their raw ASCII spellings. Labels, comments,
string data and runtime string-based lookups are not normalized by these APIs.

The shared `decode_string(source: &str, token: &Token)` service validates one
original `String` token and returns `Result<LiteralValue, Diagnostic>`.
`LiteralValue::Text(String)` and `LiteralValue::Bytes(Vec<u8>)` keep text and
bytes distinct. Ordinary, `u`, raw, bytes and raw-bytes single/triple forms use
the pinned Python 3.15.0 lexical rules in both dialects. It handles control,
octal, hexadecimal and Unicode scalar escapes, physical line continuations and
newline normalization without altering tokens or their spans. Text values are
never identifier-normalized. Adjacent literal concatenation belongs to the
parser, not this one-token service.

Decoder input is bounded by `STRING_LITERAL_MAX_BYTES` (1 MiB per original
token), with linear work and output no larger than input. It validates token
kind, ordered UTF-8 span, prefix, exact delimiters and escape syntax. Errors
carry absolute original byte spans, including malformed external token spans.
Unknown escapes keep their backslashes; this value-only API does not report
the pinned reference's warnings. Named Unicode escapes, surrogate-valued text
escapes and bytes octal escapes above 255 receive explicit unsupported
diagnostics. See `compatibility/literals/README.md` for rules and test coverage.

Formatted/template string interpolation and imaginary literals also receive
explicit unsupported diagnostics. Encodings other than already-decoded UTF-8,
complete grammar, parsing/resource budgets, semantic
analysis and execution remain future work. An unsupported
formatted string is scanned as an opaque ordinary quote-delimited string for
recovery; no grammar accuracy is claimed for its contents.

`parse_aliases(config, AliasEnvironment { edition, policy })` parses a bounded
format-1 `naja.alias` configuration without IO. It supports the six documented
comparison operators and the `print`/`len` builtin table, retaining original
configuration and assignment/key/value byte spans. Schema 1 is the default
when omitted. Other tables/targets and unsupported TOML forms reject explicitly.
The service uses a strict one-line TOML 1.0 basic-string subset and validates
Unicode identifier aliases with the same NFKC service as source identifiers.

`AliasTable::lookup(context, canonical_candidate)` requires a grammar context
and an already validated canonical identifier key. Consumers check raw keywords,
canonical spellings and explicit bindings before lookup; `UnboundBuiltin` is
only a fallback. Lookup returns the canonical comparison `Symbol` or builtin
target with its configuration entry. It does not mutate source, lexemes or
token kinds. The exact serialized cache identity includes raw config, edition,
policy and format version. See `compatibility/aliases/README.md` for the bounded
grammar, conflict rules, source/config origin distinction and integration limits.

The CST groups tokens into logical-line nodes and records indentation depth.
It retains malformed source and diagnostics, and performs no statement/expression
validation. Indentation tokens alone do not validate whether a header permits a
suite. Keywords and contextual aliases remain identifiers. `:(0)` remains four
structural tokens; deciding whether it is a depth marker or a same-line suite
requires a future grammar/context pass. `# %%` remains a comment. No source text
replacement or automatic cell processing occurs.

## NAJA 2026.1 brace foundation

The shared lexer emits significant `SuiteOpen`, `SuiteClose` and `BlockLabel`
tokens for brace suites, with one-byte brace spans and an exact `# Label #`
span. These differ from expression `Symbol::LeftBrace`/`RightBrace` tokens.
Recognized ordinary suite-header forms end in `: {`; statements begin on the
next physical line. A standalone named section begins with `{# Label #` at
logical statement start. Bare standalone braces remain expressions. Names are
display metadata, not variable bindings, scopes, cells or execution requests.
The body parser still owns statement grammar and companion-clause association.

Immediate `{#` always begins a label and requires a terminating `#` on that
physical line. A header's `{ # ordinary comment` without another `#` is an
ordinary comment; `{ # label #` is metadata. Only whitespace and an optional
ordinary comment may follow the label before newline. Empty labels, embedded
brace delimiters, missing terminators and trailing body code are diagnosed.
Repeated display names and Unicode label data are allowed.

Suite newlines remain significant. Each active brace frame suspends its parent's
indentation state and ignores stylistic indentation only at its own root.
A nested indentation header records its first physical line's indentation;
the next non-comment statement must indent beyond that baseline. Subsequent
dedents must match an active indentation level or return to/below that baseline.
A closing brace cannot guess a dedent from deeper child indentation. Nested
brace closures do not alter suspended parent indentation. This preserves both
indentation-to-brace and brace-to-indentation combinations. For example:

```naja
if outer:
    {# Transparent section #
unindented()
    }
    after_section()

if outer: {
    if inner:
        nested()
    after_inner()
}
```

Same-line `} else: {` and following-line companion forms retain source tokens;
a body statement immediately followed by `}` receives an empty-span logical
newline before `SuiteClose`. A physical closing-line newline is also retained.
Depth-marker tokens are unchanged. Combined marker/brace decorations reject;
the driver must validate marker depths and clause ownership.

The inherited ambiguity rule also applies inside a brace: `if enabled:(0)`
without a deeper following content line retains an ordinary parenthesized
same-line expression. It does not create a pending indentation obligation. A
deeper following line selects an indentation suite; the parser then validates
marker depth. Comments and blank lines do not decide this distinction.

Header detection maintains a fixed first-keyword state and four trailing token
kinds. It updates once per significant token and never scans earlier tokens to
decide whether a new expression brace is a suite. Tests inspect fixed-cache
observation counts and exercise long expression-brace vectors without flaky
wall-clock thresholds. This is not a bound on every future frontend operation.

`Cst::suites` supplies shared folding/source metadata: `SuiteKind::Control` or
`NamedSection`, full brace span, original open/optional close/optional label
spans. Missing closes remain `None` with diagnostics. Expression dictionaries,
sets, strings, raw pattern text, ordinary comments and `# %%` are not converted
to block metadata. Formatted-string interpolation and complete pattern syntax
remain unsupported as described above; no new semantic support is claimed.

The dialect-aware NAJA entry point currently bounds source at 1 MiB, brace suite
nesting at 128 and a label at 4096 UTF-8 bytes. `F0029` reports these limits;
even rejected input reconstructs exactly. Existing Python-entry behavior is
unchanged. These are initial lexical limits, not final HATCH resource proofs.

Run the specification-derived positive, negative and metamorphic tests with:

```text
cargo test --manifest-path bootstrap/frontend/Cargo.toml
```

Tests use the locked Rust dependency graph and no external interpreter. They cover source reconstruction,
byte spans, line-ending/trivia transformations, integer preservation,
indentation/continuation, strings/comments and explicit unsupported cases. The
small generated-input test checks lexical progress and losslessness; it is not
an exhaustive fuzzing or robustness claim. Official checked-in Unicode fixtures
compare XID rules for every Unicode scalar and NFKC against every Unicode 17.0.0
normalization vector, plus the default scalar invariant. Fixture regeneration
and reference acquisition are development operations outside normal tests.

NAJA2026 additionally exposes TypedInteger tokens for unambiguous adjacent valid
decimal integers and type identifiers. typed_integer_spans returns the two
original source ranges; no numeric conversion or type lookup happens in lexing.
Python-dialect rejection remains unchanged. Exponent/base/imaginary classification
is retained, and ambiguous typed spellings request an explicit constructor.
ADR006 defines the bounded capability slice; general numeric suffix construction
and type eligibility are not inferred by the lexer.
