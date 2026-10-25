# String and bytes decoding foundation

This is a shared frontend value service, not full Python compatibility or a
native runtime acceptance result. It uses the baseline pinned in
`compatibility/baseline.json`: Python 3.15.0, official CPython commit
`d220409a13b77de7a6c30abe16ea90db01528edc`. The inspected
[immutable lexical reference](https://github.com/python/cpython/blob/d220409a13b77de7a6c30abe16ea90db01528edc/Doc/reference/lexical_analysis.rst)
has SHA-256
`1e249882d4f745150dc0a39188a67fa6e46fd204f6a4c0066382d12c20872c19`
over the downloaded original 50,990 bytes. No external interpreter, runtime,
network access or character-name database is required to build or test this
service. No dependency was added for decoding.

## API and source contract

`decode_string(source: &str, token: &Token) -> Result<LiteralValue, Diagnostic>`
returns `LiteralValue::Text(String)` or `LiteralValue::Bytes(Vec<u8>)`. `source`
is the original already-decoded UTF-8 source and `token` must cover exactly one
`TokenKind::String` literal. The same service applies to `.py` and `.naja`.
It never edits the source, changes token spans, normalizes text with NFKC or
combines adjacent literals. Original bytes remain available for diagnostics,
source maps and reconstruction. The caller must also reject lexer diagnostics
before executing source; successful value decoding alone does not validate
the surrounding program.

Input spans are checked before slicing, including reversed, out-of-bounds and
interior UTF-8 byte positions. All diagnostics use valid absolute byte spans in
the original source. A malformed external span gets an empty span at its
clamped, preceding scalar boundary. The decoder validates prefixes, matching
delimiters, first-delimiter termination and escapes even for fabricated tokens.
It accepts at most `STRING_LITERAL_MAX_BYTES = 1048576` source bytes per token;
larger tokens get `F0038`. Work is linear in token bytes, the prefix scan reads
at most three bytes, escape digit loops read at most eight, and successful
output contains no more bytes than the original token. Decoding is iterative,
with no recursion or unbounded name search.

## Supported pinned rules

The reference's sections on physical lines, string prefixes, formal string
grammar, escape sequences, bytes literals and raw strings define these tests:

- Single and double quotes, including their triple forms, have equivalent
  value semantics. The first unescaped matching delimiter closes the token;
  trailing source is an error. Triple forms retain isolated matching quotes
  and physical newlines. Unescaped newlines are invalid in short forms.
- Prefixes are ASCII and case-insensitive: no prefix and `u` produce text,
  `b` produces bytes, and `r`, `br` and `rb` select raw forms. Prefixes touch
  the opening quote. Other combinations such as `ur` are invalid ordinary
  prefixes; formatted/template forms remain explicitly unsupported.
- Physical CR, LF and CRLF become one LF in decoded values, even inside raw
  strings. Original tokens retain their exact line-ending bytes. A nonraw
  backslash followed by a physical newline removes both from the value. Raw
  forms retain the backslash and normalized LF, including escaped physical
  newlines in short forms. Explicit `\r` escapes still produce carriage return.
- Nonraw backslashes decode escaped quotes, backslash and the ASCII controls
  `\a`, `\b`, `\f`, `\n`, `\r`, `\t`, `\v`. Octal consumes one to three digits
  from `0` through `7`. `\x` consumes exactly two ASCII hexadecimal digits;
  text `\u` and `\U` consume exactly four and eight respectively. Additional
  digits are literal content. Values beyond U+10FFFF are errors; Unicode
  noncharacters within the scalar range remain permitted data.
- Bytes source characters must be ASCII, including after a backslash and in
  raw forms. Numeric escapes can produce bytes above 127 and embedded zero.
  Literal NUL source characters are invalid; escaped zero remains valid data.
- Unknown escapes retain the backslash and following character. In bytes,
  `\u`, `\U` and `\N` are unknown escapes, so they stay literal and never
  inject Unicode data into bytes. Raw forms retain all escape spellings.
  Raw backslash-escaped quotes retain both characters and do not close the
  literal. An odd final backslash cannot form a valid raw literal.

## Explicit limits

Python 3.15.0 reports `SyntaxWarning` for unknown escapes and octal values
above 255. The current `Result` API returns values or errors and has no warning
channel. Unknown escapes retain the correct value but their warnings are not
implemented. Text octal values from 256 through 511 decode to their Unicode
characters; their warnings are also not implemented.

Bytes octal values above 255 receive unsupported `F0037`. This is a scoped
limitation, not a claim that the pinned reference rejects them. No byte
truncation is guessed by this implementation.

Named text escapes such as `\N{SNAKE}` receive unsupported `F0034`; there is no
shared character-name database yet. Surrogate escape values receive unsupported
`F0035` because Rust `String` represents UTF-8 scalar text. Python text can
contain surrogate code points; full preservation needs a different runtime
representation. A pair of surrogate escapes is never silently combined into a
single scalar. Raw text and bytes retain these spellings as described above.

Formatted and template strings receive `F0011` both in the existing lexer and
the decoder. Their replacement grammar is not implemented. The lexer still
uses opaque quote scanning for recovery and claims no full grammar accuracy
inside those forms. Literal concatenation, source encodings beyond UTF-8 and
native object allocation/execution remain separate work.

## Verification

`tests/syntax/literals.rs` contains spec-derived value and diagnostic vectors;
none were generated by an external interpreter. Tests cover every supported
quote/prefix form, every byte value through both hex and octal, deterministic
Unicode scalar samples, combining text and noncharacters, malformed escape
widths, unsupported features, raw quote parity and physical line endings.

Metamorphic cases add comments and change surrounding newlines in both dialects
while preserving values, original byte spans and source reconstruction.
Brace/label/cell/marker-looking string contents remain opaque data. Tests
exhaust bounded malformed character sequences and check safe diagnostic spans
and output bounds; large generated inputs test the exact resource boundary
without wall-time thresholds.

Run the scoped tests and lint checks from the repository/worktree root:

```powershell
cargo +1.97.1 test --manifest-path bootstrap/frontend/Cargo.toml --locked --offline
cargo +1.97.1 clippy -p naja-frontend --all-targets --locked --offline -- -D warnings
cargo +1.97.1 fmt --all -- --check
```

These checks establish this frontend slice only. They are not evidence of full
Python grammar/runtime semantics, FC1, self-hosting, native sessions or HATCH
acceptance.
