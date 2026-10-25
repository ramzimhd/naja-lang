# Initial lossless frontend

`naja-frontend` is an independent Rust seed crate with no external dependencies.
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

Implemented tokenization covers ASCII identifiers, decimal/base integer lexemes
without numeric conversion or width limits, decimal float lexemes, ordinary and
raw single/triple quoted strings, byte strings, comments, standard operators,
bracket continuation and explicit backslash continuation. Indentation uses tab
stops of eight and a second column count to reject ambiguous tabs/spaces;
comments and blank lines do not change indentation. Escapes are retained rather
than evaluated. Invalid numbers, characters, delimiters, indentation and
unterminated strings have English diagnostics with source spans.

Unicode string/comment data is preserved. Full Unicode identifier recognition
and normalization remain unimplemented: non-ASCII source tokens outside strings
and comments produce an explicit temporary unsupported diagnostic. This is an
initial implementation limit, not the HATCH identifier policy. Formatted/template
string interpolation and imaginary literals also receive explicit unsupported
diagnostics. String escape validity, literal values, encodings other than
already-decoded UTF-8, complete grammar, parsing/resource budgets, Unicode XID
tables, semantic analysis and execution remain future work. An unsupported
formatted string is scanned as an opaque ordinary quote-delimited string for
recovery; no grammar accuracy is claimed for its contents.

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

Tests use no external packages or interpreter. They cover source reconstruction,
byte spans, line-ending/trivia transformations, integer preservation,
indentation/continuation, strings/comments and explicit unsupported cases. The
small generated-input test checks lexical progress and losslessness; it is not
an exhaustive fuzzing or robustness claim.
