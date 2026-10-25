//! Independent decoding of one original string token, without source rewriting.

use crate::{Diagnostic, Span, Token, TokenKind};

/// Maximum original token length accepted by [`decode_string`], in UTF-8 bytes.
pub const STRING_LITERAL_MAX_BYTES: usize = 1024 * 1024;

/// Decoded literal data. Text remains case-sensitive and is never normalized.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum LiteralValue {
    Text(String),
    Bytes(Vec<u8>),
}

/// Decode exactly one string token from its original source byte span.
///
/// Both dialects share this operation. Prefixes, delimiters and escape syntax
/// are validated again, so malformed or fabricated tokens cannot panic or
/// silently include trailing source. Errors use original absolute byte spans.
/// The operation is linear in token bytes, with at most that many output bytes,
/// and rejects tokens longer than [`STRING_LITERAL_MAX_BYTES`].
///
/// Unknown escapes retain their backslashes. This value API does not report
/// Python's warnings. Named Unicode escapes, surrogate-valued text escapes,
/// overflowing bytes octal escapes and interpolated strings are explicitly
/// unsupported. See `compatibility/literals/README.md` for the pinned rules.
pub fn decode_string(source: &str, token: &Token) -> Result<LiteralValue, Diagnostic> {
    let Some(literal) = source.get(token.span.start..token.span.end) else {
        let mut anchor = token.span.start.min(source.len());
        while !source.is_char_boundary(anchor) {
            anchor -= 1;
        }
        return Err(diagnostic(
            "F0030",
            "String token span must be an ordered UTF-8 byte range inside the original source.",
            Span::new(anchor, anchor),
        ));
    };
    if token.kind != TokenKind::String {
        return Err(diagnostic(
            "F0030",
            "String decoding requires a String token.",
            token.span,
        ));
    }
    if literal.len() > STRING_LITERAL_MAX_BYTES {
        return Err(diagnostic(
            "F0038",
            "String token exceeds the decoder limit of 1048576 source bytes.",
            token.span,
        ));
    }
    Decoder::new(literal, token.span.start)?.decode()
}

fn diagnostic(code: &'static str, message: &str, span: Span) -> Diagnostic {
    Diagnostic {
        code,
        message: message.to_owned(),
        span,
    }
}

struct Decoder<'a> {
    literal: &'a str,
    base: usize,
    quote: u8,
    width: usize,
    raw: bool,
    offset: usize,
    value: LiteralValue,
}

impl<'a> Decoder<'a> {
    fn new(literal: &'a str, base: usize) -> Result<Self, Diagnostic> {
        // Valid ordinary prefixes have at most two ASCII letters. Bound the
        // prefix scan independently of malformed token length.
        let quote_offset = literal
            .bytes()
            .take(3)
            .take_while(u8::is_ascii_alphabetic)
            .count();
        let prefix = &literal[..quote_offset];
        let Some(quote @ (b'\'' | b'"')) = literal.as_bytes().get(quote_offset).copied() else {
            return Err(diagnostic(
                "F0031",
                "String token requires a valid prefix followed immediately by a quote.",
                Span::new(base, base + literal.len()),
            ));
        };
        let lower = prefix.to_ascii_lowercase();
        let (raw, bytes) = match lower.as_str() {
            "" | "u" => (false, false),
            "r" => (true, false),
            "b" => (false, true),
            "br" | "rb" => (true, true),
            "f" | "fr" | "rf" | "t" | "tr" | "rt" => {
                return Err(diagnostic(
                    "F0011",
                    "Formatted and template strings are unsupported; interpolation is not decoded.",
                    Span::new(base, base + quote_offset),
                ));
            }
            _ => {
                return Err(diagnostic(
                    "F0031",
                    "Unsupported or invalid ordinary string prefix.",
                    Span::new(base, base + quote_offset),
                ));
            }
        };
        let width = if literal.as_bytes().get(quote_offset..quote_offset + 3)
            == Some(&[quote, quote, quote])
        {
            3
        } else {
            1
        };
        Ok(Self {
            literal,
            base,
            quote,
            width,
            raw,
            offset: quote_offset + width,
            value: if bytes {
                LiteralValue::Bytes(Vec::new())
            } else {
                LiteralValue::Text(String::new())
            },
        })
    }

    fn decode(mut self) -> Result<LiteralValue, Diagnostic> {
        while self.offset < self.literal.len() {
            let start = self.offset;
            if self.literal.as_bytes()[start] == self.quote
                && (self.width == 1
                    || self.literal.as_bytes().get(start..start + 3)
                        == Some(&[self.quote, self.quote, self.quote]))
            {
                self.offset += self.width;
                if self.offset != self.literal.len() {
                    return Err(self.error(
                        "F0031",
                        "String token contains source after its first closing delimiter.",
                        self.offset,
                        self.literal.len(),
                    ));
                }
                return Ok(self.value);
            }
            let ch = self.next_source_char()?;
            if ch == '\\' {
                self.escape(start)?;
            } else if ch == '\n' && self.width == 1 {
                return Err(self.error(
                    "F0005",
                    "An unescaped physical newline cannot occur in a single-quoted string.",
                    start,
                    self.offset,
                ));
            } else {
                self.push(ch);
            }
        }
        Err(self.error(
            "F0005",
            "String token has no unescaped matching closing delimiter.",
            0,
            self.literal.len(),
        ))
    }

    /// Read one source scalar, folding only physical CR/LF/CRLF to LF. All
    /// callers advance at UTF-8 boundaries. Decoded escape values bypass this
    /// operation, so an explicit `\r` keeps its carriage return value.
    fn next_source_char(&mut self) -> Result<char, Diagnostic> {
        let start = self.offset;
        let ch = self.literal[start..].chars().next().unwrap();
        self.offset += ch.len_utf8();
        if ch == '\0' {
            return Err(self.error(
                "F0008",
                "A source string literal cannot contain a literal NUL; use an escape.",
                start,
                self.offset,
            ));
        }
        if self.is_bytes() && !ch.is_ascii() {
            return Err(self.error(
                "F0014",
                "Bytes literals may contain only ASCII source characters; use an escape for a non-ASCII byte.",
                start,
                self.offset,
            ));
        }
        if ch == '\r' {
            if self.literal.as_bytes().get(self.offset) == Some(&b'\n') {
                self.offset += 1;
            }
            Ok('\n')
        } else {
            Ok(ch)
        }
    }

    fn escape(&mut self, start: usize) -> Result<(), Diagnostic> {
        if self.offset == self.literal.len() {
            return Err(self.error(
                "F0005",
                "String token ends after a backslash without a closing delimiter.",
                start,
                self.offset,
            ));
        }
        let ch = self.next_source_char()?;
        if self.raw {
            self.push('\\');
            self.push(ch);
            return Ok(());
        }
        let value = match ch {
            '\n' => return Ok(()),
            '\\' | '\'' | '"' => ch,
            'a' => '\u{7}',
            'b' => '\u{8}',
            'f' => '\u{c}',
            'n' => '\n',
            'r' => '\r',
            't' => '\t',
            'v' => '\u{b}',
            '0'..='7' => {
                let mut value = ch as u32 - '0' as u32;
                for _ in 0..2 {
                    match self.literal.as_bytes().get(self.offset) {
                        Some(digit @ b'0'..=b'7') => {
                            value = value * 8 + (digit - b'0') as u32;
                            self.offset += 1;
                        }
                        _ => break,
                    }
                }
                if self.is_bytes() && value > 255 {
                    return Err(self.error(
                        "F0037",
                        "Bytes octal escapes above 0o377 are unsupported; their warning and truncation semantics are not implemented.",
                        start,
                        self.offset,
                    ));
                }
                char::from_u32(value).unwrap()
            }
            'x' => char::from_u32(self.hex_digits(start, 2)?).unwrap(),
            'u' | 'U' if !self.is_bytes() => {
                let value = self.hex_digits(start, if ch == 'u' { 4 } else { 8 })?;
                if (0xd800..=0xdfff).contains(&value) {
                    return Err(self.error(
                        "F0035",
                        "Surrogate-valued text escapes are unsupported by the current UTF-8 text representation.",
                        start,
                        self.offset,
                    ));
                }
                let Some(scalar) = char::from_u32(value) else {
                    return Err(self.error(
                        "F0033",
                        "Unicode escape value exceeds U+10FFFF.",
                        start,
                        self.offset,
                    ));
                };
                scalar
            }
            'N' if !self.is_bytes() => {
                return Err(self.error(
                    "F0034",
                    "Named Unicode escapes are unsupported until a shared character-name database is available.",
                    start,
                    self.offset,
                ));
            }
            _ => {
                // Python 3.15 retains both characters, including \u/\U/\N in
                // bytes literals. Its SyntaxWarning is outside this value API.
                self.push('\\');
                ch
            }
        };
        self.push(value);
        Ok(())
    }

    fn hex_digits(&mut self, start: usize, count: usize) -> Result<u32, Diagnostic> {
        let mut value = 0;
        for _ in 0..count {
            let Some(digit) = self
                .literal
                .as_bytes()
                .get(self.offset)
                .copied()
                .filter(u8::is_ascii_hexdigit)
            else {
                let end = self.offset
                    + self.literal[self.offset..]
                        .chars()
                        .next()
                        .map_or(0, char::len_utf8);
                return Err(self.error(
                    "F0032",
                    match count {
                        2 => {
                            "Hexadecimal byte escape requires exactly two ASCII hexadecimal digits."
                        }
                        4 => "Unicode escape requires exactly four ASCII hexadecimal digits.",
                        _ => "Unicode escape requires exactly eight ASCII hexadecimal digits.",
                    },
                    start,
                    end,
                ));
            };
            value = value * 16
                + match digit {
                    b'0'..=b'9' => digit - b'0',
                    b'a'..=b'f' => digit - b'a' + 10,
                    _ => digit - b'A' + 10,
                } as u32;
            self.offset += 1;
        }
        Ok(value)
    }

    fn is_bytes(&self) -> bool {
        matches!(self.value, LiteralValue::Bytes(_))
    }

    fn push(&mut self, ch: char) {
        match &mut self.value {
            LiteralValue::Text(text) => text.push(ch),
            // Source characters were checked as ASCII and escapes were bounded
            // to 255 before arriving here. This is the specified byte value.
            LiteralValue::Bytes(bytes) => bytes.push(ch as u8),
        }
    }

    fn error(&self, code: &'static str, message: &str, start: usize, end: usize) -> Diagnostic {
        diagnostic(code, message, Span::new(self.base + start, self.base + end))
    }
}
