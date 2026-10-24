# Initial lossless frontend

`naja-frontend` is an independent Rust seed crate with no external dependencies.
It is an implemented lexical/CST foundation for T05, not a complete parser or a
claim of Python 3.15 grammar coverage. It invokes no Python interpreter or oracle.

The public entry points are `lex(&str) -> Lexed` and `parse_cst(&str) -> Cst`.
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

Run the specification-derived positive, negative and metamorphic tests with:

```text
cargo test --manifest-path bootstrap/frontend/Cargo.toml
```

Tests use no external packages or interpreter. They cover source reconstruction,
byte spans, line-ending/trivia transformations, integer preservation,
indentation/continuation, strings/comments and explicit unsupported cases. The
small generated-input test checks lexical progress and losslessness; it is not
an exhaustive fuzzing or robustness claim.
