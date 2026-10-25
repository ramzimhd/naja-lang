use crate::{Diagnostic, Dialect, Lexed, Span, Symbol, Token, TokenKind};

const MAX_NAJA_SOURCE_BYTES: usize = 1_048_576;
const MAX_BRACE_SUITES: usize = 128;
const MAX_LABEL_BYTES: usize = 4096;

#[derive(Clone, Copy)]
struct Indentation {
    columns: usize,
    alternate: usize,
}

struct BraceSuite {
    start: usize,
    /// The first element is the physical header baseline, not an emitted indent.
    indentation: Vec<Indentation>,
    pending_header: Option<PendingHeader>,
}

struct PendingHeader {
    indentation: Indentation,
    /// :(x) remains a same-line expression without a following indent.
    optional: bool,
}

#[derive(Clone, Copy, Default)]
enum HeaderHead {
    #[default]
    Empty,
    Async,
    Suite,
    Other,
}

/// Fixed incremental storage; queries never walk emitted token history.
#[derive(Default)]
struct HeaderContext {
    head: HeaderHead,
    tail: [Option<TokenKind>; 4],
    #[cfg(test)]
    observed_tokens: usize,
}

impl HeaderContext {
    fn observe(&mut self, kind: TokenKind, text: &str) {
        if matches!(kind, TokenKind::Newline | TokenKind::SuiteClose) {
            self.head = HeaderHead::Empty;
            self.tail = [None; 4];
            return;
        }
        if kind.is_trivia() || matches!(kind, TokenKind::Indent | TokenKind::Dedent) {
            return;
        }
        #[cfg(test)]
        {
            self.observed_tokens += 1;
        }
        self.head = match self.head {
            HeaderHead::Empty if kind == TokenKind::Identifier && text == "async" => {
                HeaderHead::Async
            }
            HeaderHead::Empty
                if kind == TokenKind::Identifier
                    && matches!(
                        text,
                        "if" | "elif"
                            | "else"
                            | "while"
                            | "for"
                            | "def"
                            | "class"
                            | "try"
                            | "except"
                            | "finally"
                            | "with"
                            | "match"
                            | "case"
                    ) =>
            {
                HeaderHead::Suite
            }
            HeaderHead::Empty => HeaderHead::Other,
            HeaderHead::Async
                if kind == TokenKind::Identifier && matches!(text, "def" | "for" | "with") =>
            {
                HeaderHead::Suite
            }
            HeaderHead::Async => HeaderHead::Other,
            head => head,
        };
        self.tail.rotate_left(1);
        self.tail[3] = Some(kind);
    }

    fn ends_depth_marker(&self) -> bool {
        self.tail
            == [
                Some(TokenKind::Symbol(Symbol::Colon)),
                Some(TokenKind::Symbol(Symbol::LeftParen)),
                Some(TokenKind::Integer),
                Some(TokenKind::Symbol(Symbol::RightParen)),
            ]
    }

    fn ends_indented_suite(&self) -> bool {
        matches!(self.head, HeaderHead::Suite)
            && (self.tail[3] == Some(TokenKind::Symbol(Symbol::Colon)) || self.ends_depth_marker())
    }
}

struct Lexer<'a> {
    source: &'a str,
    offset: usize,
    tokens: Vec<Token>,
    diagnostics: Vec<Diagnostic>,
    indentation: Vec<Indentation>,
    delimiters: Vec<(u8, usize)>,
    at_line_start: bool,
    continued: bool,
    logical_content: bool,
    dialect: Dialect,
    suites: Vec<BraceSuite>,
    header: HeaderContext,
    line_indent: Indentation,
    header_indent: Indentation,
}

/// Tokenize UTF-8 source without interpreting expressions or changing lexemes.
pub fn lex(source: &str) -> Lexed {
    lex_with_dialect(source, Dialect::Python)
}

/// Use the same tokenization/source model with explicitly selected extensions.
pub fn lex_with_dialect(source: &str, dialect: Dialect) -> Lexed {
    if dialect == Dialect::Naja2026 && source.len() > MAX_NAJA_SOURCE_BYTES {
        return Lexed {
            source: source.to_owned(),
            tokens: vec![
                Token {
                    kind: TokenKind::Invalid,
                    span: Span::new(0, source.len()),
                },
                Token {
                    kind: TokenKind::EndOfFile,
                    span: Span::new(source.len(), source.len()),
                },
            ],
            diagnostics: vec![Diagnostic {
                code: "F0029",
                message: "NAJA source exceeds the initial frontend limit of 1 MiB.".into(),
                span: Span::new(0, 0),
            }],
        };
    }
    Lexer {
        source,
        offset: 0,
        tokens: Vec::new(),
        diagnostics: Vec::new(),
        indentation: vec![Indentation {
            columns: 0,
            alternate: 0,
        }],
        delimiters: Vec::new(),
        at_line_start: true,
        continued: false,
        logical_content: false,
        dialect,
        suites: Vec::new(),
        header: HeaderContext::default(),
        line_indent: Indentation {
            columns: 0,
            alternate: 0,
        },
        header_indent: Indentation {
            columns: 0,
            alternate: 0,
        },
    }
    .run()
}

impl Lexer<'_> {
    fn push(&mut self, kind: TokenKind, start: usize, end: usize) {
        self.tokens.push(Token {
            kind,
            span: Span::new(start, end),
        });
        if self.dialect == Dialect::Naja2026 {
            self.header.observe(kind, &self.source[start..end]);
        }
    }

    fn error(&mut self, code: &'static str, message: impl Into<String>, start: usize, end: usize) {
        self.diagnostics.push(Diagnostic {
            code,
            message: message.into(),
            span: Span::new(start, end),
        });
    }

    fn byte(&self) -> Option<u8> {
        self.source.as_bytes().get(self.offset).copied()
    }

    fn newline_length(&self, offset: usize) -> usize {
        match self.source.as_bytes().get(offset) {
            Some(b'\r') if self.source.as_bytes().get(offset + 1) == Some(&b'\n') => 2,
            Some(b'\n' | b'\r') => 1,
            _ => 0,
        }
    }

    fn run(mut self) -> Lexed {
        let source = self.source;
        for (offset, ch) in source.char_indices() {
            if ch == '\0' {
                self.error(
                    "F0008",
                    "Source text cannot contain a NUL character.",
                    offset,
                    offset + 1,
                );
            }
        }
        if self.source.starts_with('\u{feff}') {
            self.offset = '\u{feff}'.len_utf8();
            self.push(TokenKind::ByteOrderMark, 0, self.offset);
        }
        while self.offset < self.source.len() {
            if self.at_line_start {
                self.indent();
                if self.offset == self.source.len() {
                    break;
                }
            }
            let start = self.offset;
            let ch = self.byte().expect("offset is before EOF");
            if !self.logical_content && !matches!(ch, b' ' | b'\t' | 0x0c | b'#' | b'\r' | b'\n') {
                self.header_indent = self.line_indent;
            }
            match ch {
                b' ' | b'\t' | 0x0c => {
                    while matches!(self.byte(), Some(b' ' | b'\t' | 0x0c)) {
                        self.offset += 1;
                    }
                    self.push(TokenKind::Whitespace, start, self.offset);
                }
                b'#' => {
                    while self.offset < self.source.len() && self.newline_length(self.offset) == 0 {
                        self.offset += self.source[self.offset..]
                            .chars()
                            .next()
                            .unwrap()
                            .len_utf8();
                    }
                    self.push(TokenKind::Comment, start, self.offset);
                }
                b'\r' | b'\n' => {
                    self.offset += self.newline_length(self.offset);
                    let kind = if self.delimiters.is_empty() && self.logical_content {
                        if self.dialect == Dialect::Naja2026
                            && self.header.ends_indented_suite()
                            && let Some(suite) = self.suites.last_mut()
                        {
                            suite.pending_header = Some(PendingHeader {
                                indentation: self.header_indent,
                                optional: self.header.ends_depth_marker(),
                            });
                        }
                        self.logical_content = false;
                        TokenKind::Newline
                    } else {
                        TokenKind::NonLogicalNewline
                    };
                    self.push(kind, start, self.offset);
                    self.at_line_start = true;
                }
                b'\\' if self.newline_length(start + 1) > 0 => {
                    self.offset += 1 + self.newline_length(start + 1);
                    self.push(TokenKind::ExplicitLineContinuation, start, self.offset);
                    self.at_line_start = true;
                    self.continued = true;
                    if self.offset == self.source.len() {
                        self.error(
                            "F0012",
                            "Expected a continued line after the backslash.",
                            start,
                            self.offset,
                        );
                    }
                }
                b'\'' | b'"' => self.string(start, start, ""),
                b'0'..=b'9' => self.number(),
                b'.' if self
                    .source
                    .as_bytes()
                    .get(start + 1)
                    .is_some_and(u8::is_ascii_digit) =>
                {
                    self.number();
                }
                b'a'..=b'z' | b'A'..=b'Z' | b'_' => self.identifier_or_string(),
                b'{' if self.is_brace_suite_open() => self.open_suite(),
                b'}' if self.dialect == Dialect::Naja2026
                    && self.delimiters.is_empty()
                    && !self.suites.is_empty() =>
                {
                    self.close_suite()
                }
                _ if !ch.is_ascii() => self.unsupported_identifier(),
                _ => self.symbol_or_invalid(),
            }
        }
        for (delimiter, start) in self.delimiters.clone() {
            self.error(
                "F0004",
                format!("Unclosed delimiter '{}'.", delimiter as char),
                start,
                start + 1,
            );
        }
        if self.logical_content {
            self.push(TokenKind::Newline, self.offset, self.offset);
        }
        while let Some(suite) = self.suites.pop() {
            if suite.pending_header.is_some_and(|header| !header.optional) {
                self.error(
                    "F0024",
                    "Expected an indented body before the end of the brace suite.",
                    self.offset,
                    self.offset,
                );
            }
            for _ in 1..suite.indentation.len() {
                self.push(TokenKind::Dedent, self.offset, self.offset);
            }
            self.error(
                "F0020",
                "Unclosed brace suite; expected '}'.",
                suite.start,
                suite.start + 1,
            );
        }
        while self.indentation.len() > 1 {
            self.indentation.pop();
            self.push(TokenKind::Dedent, self.offset, self.offset);
        }
        self.push(TokenKind::EndOfFile, self.offset, self.offset);
        Lexed {
            source: self.source.to_owned(),
            tokens: self.tokens,
            diagnostics: self.diagnostics,
        }
    }

    fn indent(&mut self) {
        let start = self.offset;
        let mut columns = 0;
        let mut alternate = 0;
        while let Some(ch) = self.byte() {
            match ch {
                b' ' => {
                    columns += 1;
                    alternate += 1;
                }
                b'\t' => {
                    columns = (columns / 8 + 1) * 8;
                    alternate += 1;
                }
                0x0c => {
                    columns = 0;
                    alternate = 0;
                }
                _ => break,
            }
            self.offset += 1;
        }
        if self.offset > start {
            self.push(TokenKind::Whitespace, start, self.offset);
        }
        self.line_indent = Indentation { columns, alternate };
        self.at_line_start = false;
        let continued = std::mem::take(&mut self.continued);
        if continued
            || !self.delimiters.is_empty()
            || matches!(self.byte(), None | Some(b'#' | b'\r' | b'\n'))
        {
            return;
        }
        if !self.suites.is_empty() {
            self.brace_indentation(start, Indentation { columns, alternate });
            return;
        }
        let previous = *self.indentation.last().unwrap();
        if columns > previous.columns {
            if alternate <= previous.alternate {
                self.indentation_error(start);
            }
            self.indentation.push(Indentation { columns, alternate });
            self.push(TokenKind::Indent, self.offset, self.offset);
        } else {
            while columns < self.indentation.last().unwrap().columns {
                self.indentation.pop();
                self.push(TokenKind::Dedent, self.offset, self.offset);
            }
            let level = self.indentation.last().unwrap();
            if level.columns != columns {
                self.error(
                    "F0002",
                    "Dedent does not match an outer indentation level.",
                    start,
                    self.offset,
                );
            } else if level.alternate != alternate {
                self.indentation_error(start);
            }
        }
    }

    fn is_brace_suite_open(&self) -> bool {
        self.dialect == Dialect::Naja2026
            && self.delimiters.is_empty()
            && ((!self.logical_content
                && self.source.as_bytes().get(self.offset + 1) == Some(&b'#'))
                || self.header.ends_indented_suite())
    }

    fn opening_whitespace(&mut self) {
        let start = self.offset;
        while matches!(self.byte(), Some(b' ' | b'\t' | 0x0c)) {
            self.offset += 1;
        }
        if self.offset > start {
            self.push(TokenKind::Whitespace, start, self.offset);
        }
    }

    fn open_suite(&mut self) {
        let start = self.offset;
        if self.suites.len() >= MAX_BRACE_SUITES {
            self.error(
                "F0029",
                "Brace suite nesting exceeds the initial frontend limit of 128.",
                start,
                start + 1,
            );
            self.offset = self.source.len();
            self.push(TokenKind::Invalid, start, self.offset);
            self.logical_content = true;
            return;
        }
        if self.header.ends_depth_marker() {
            self.error(
                "F0026",
                "A depth marker and brace delimiter cannot decorate the same suite.",
                start,
                start + 1,
            );
        }
        self.offset += 1;
        self.push(TokenKind::SuiteOpen, start, self.offset);
        self.logical_content = true;
        self.suites.push(BraceSuite {
            start,
            indentation: Vec::new(),
            pending_header: None,
        });
        let immediate_label = self.byte() == Some(b'#');
        self.opening_whitespace();
        let end = self.source[self.offset..]
            .find(['\r', '\n'])
            .map_or(self.source.len(), |length| self.offset + length);
        if self.byte() == Some(b'#') {
            let label_start = self.offset;
            let terminator = self.source[self.offset + 1..end]
                .find('#')
                .map(|length| self.offset + 1 + length);
            if immediate_label || terminator.is_some() {
                let Some(terminator) = terminator else {
                    self.error(
                        "F0021",
                        "Block label is missing its terminating '#' before the newline.",
                        label_start,
                        end,
                    );
                    self.offset = end;
                    self.push(TokenKind::BlockLabel, label_start, end);
                    return;
                };
                let label = &self.source[label_start + 1..terminator];
                if label.trim().is_empty() {
                    self.error(
                        "F0022",
                        "A block label must contain a non-whitespace display name.",
                        label_start,
                        terminator + 1,
                    );
                }
                if label.contains(['{', '}']) {
                    self.error(
                        "F0023",
                        "Nested brace or label delimiters are not allowed inside a block label.",
                        label_start,
                        terminator + 1,
                    );
                }
                if terminator + 1 - label_start > MAX_LABEL_BYTES {
                    self.error(
                        "F0029",
                        "Block label exceeds the initial frontend limit of 4096 UTF-8 bytes.",
                        label_start,
                        terminator + 1,
                    );
                }
                self.offset = terminator + 1;
                self.push(TokenKind::BlockLabel, label_start, self.offset);
                self.opening_whitespace();
            }
            if self.byte() == Some(b'#') {
                let comment_start = self.offset;
                self.offset = end;
                self.push(TokenKind::Comment, comment_start, end);
            }
        }
        if self.offset < end {
            self.error("F0021", "A brace suite opening or label must end its logical line; body statements begin on the next line.", self.offset, end);
            let invalid_start = self.offset;
            self.offset = end;
            self.push(TokenKind::Invalid, invalid_start, end);
        }
        if end == self.source.len() {
            self.error(
                "F0021",
                "A brace suite opening must be followed by a physical newline.",
                start,
                end,
            );
        }
    }

    fn close_suite(&mut self) {
        let start = self.offset;
        let previous = self
            .tokens
            .iter()
            .rev()
            .find(|token| !token.kind.is_trivia())
            .map(|token| token.kind);
        if self.logical_content && previous != Some(TokenKind::SuiteClose) {
            self.push(TokenKind::Newline, start, start);
        }
        let suite = self.suites.pop().unwrap();
        if suite.pending_header.is_some_and(|header| !header.optional) {
            self.error(
                "F0024",
                "Expected an indented body before closing the brace suite.",
                start,
                start + 1,
            );
        }
        if !suite.indentation.is_empty() {
            self.error("F0024", "A nested indentation suite must dedent to its header baseline before the containing brace closes.", start, start + 1);
            for _ in 1..suite.indentation.len() {
                self.push(TokenKind::Dedent, start, start);
            }
        }
        self.offset += 1;
        self.push(TokenKind::SuiteClose, start, self.offset);
        self.logical_content = true;
        self.header_indent = self.line_indent;
        let following = self.source[self.offset..].trim_start_matches([' ', '\t', '\u{c}']);
        // Only a second close on this physical line consults the parent. An
        // inner brace's stylistic close cannot dedent its suspended parent.
        if following.starts_with('}') && !self.suites.is_empty() {
            self.brace_indentation(start, self.line_indent);
        }
        let companion = ["else", "elif", "except", "finally"].iter().any(|word| {
            following.strip_prefix(word).is_some_and(|tail| {
                !tail
                    .chars()
                    .next()
                    .is_some_and(|ch| ch.is_alphanumeric() || ch == '_')
            })
        });
        if !following.is_empty() && !following.starts_with(['\r', '\n', '#', '}']) && !companion {
            let end = self.source[self.offset..]
                .find(['\r', '\n'])
                .map_or(self.source.len(), |length| self.offset + length);
            self.error("F0025", "Only a closing brace, comment or companion clause may follow a suite close on the same line.", self.offset, end);
        }
    }

    fn brace_indentation(&mut self, start: usize, current: Indentation) {
        let index = self.suites.len() - 1;
        let pending = self.suites[index].pending_header.take();
        let mut levels = std::mem::take(&mut self.suites[index].indentation);
        let mut entered = false;
        if let Some(pending) = pending {
            let header = pending.indentation;
            if current.columns <= header.columns || self.byte() == Some(b'}') {
                if !pending.optional {
                    self.error(
                        "F0024",
                        "Expected an indented body deeper than this header's physical indentation.",
                        start,
                        self.offset,
                    );
                }
            } else {
                if current.alternate <= header.alternate {
                    self.indentation_error(start);
                }
                if levels.is_empty() {
                    levels.push(header);
                }
                levels.push(current);
                self.push(TokenKind::Indent, self.offset, self.offset);
                entered = true;
            }
        }
        if !entered && let Some(previous) = levels.last().copied() {
            if current.columns > previous.columns {
                if current.alternate <= previous.alternate {
                    self.indentation_error(start);
                }
                levels.push(current);
                self.push(TokenKind::Indent, self.offset, self.offset);
            } else {
                while levels.len() > 1 && current.columns < levels.last().unwrap().columns {
                    levels.pop();
                    self.push(TokenKind::Dedent, self.offset, self.offset);
                }
                let level = *levels.last().unwrap();
                if levels.len() == 1 && current.columns <= level.columns {
                    if current.columns == level.columns && current.alternate != level.alternate {
                        self.indentation_error(start);
                    }
                    levels.clear();
                } else if current.columns != level.columns {
                    self.error("F0002", "Dedent does not match an active indentation level or its brace-local header baseline.", start, self.offset);
                } else if current.alternate != level.alternate {
                    self.indentation_error(start);
                }
            }
        }
        self.suites[index].indentation = levels;
    }

    fn indentation_error(&mut self, start: usize) {
        self.error(
            "F0001",
            "Inconsistent use of tabs and spaces in indentation.",
            start,
            self.offset,
        );
    }

    fn identifier_or_string(&mut self) {
        let start = self.offset;
        while self
            .byte()
            .is_some_and(|ch| ch.is_ascii_alphanumeric() || ch == b'_')
        {
            self.offset += 1;
        }
        if self.source[self.offset..]
            .chars()
            .next()
            .is_some_and(|ch| !ch.is_ascii() && !ch.is_whitespace())
        {
            self.offset = start;
            self.unsupported_identifier();
            return;
        }
        let prefix = &self.source[start..self.offset];
        let lower = prefix.to_ascii_lowercase();
        if matches!(self.byte(), Some(b'\'' | b'"'))
            && matches!(
                lower.as_str(),
                "r" | "u" | "b" | "br" | "rb" | "f" | "fr" | "rf" | "t" | "tr" | "rt"
            )
        {
            self.string(start, self.offset, &lower);
        } else {
            self.push(TokenKind::Identifier, start, self.offset);
            self.logical_content = true;
        }
    }

    fn unsupported_identifier(&mut self) {
        let start = self.offset;
        while let Some(ch) = self.source[self.offset..].chars().next() {
            if ch.is_alphanumeric() || ch == '_' || (!ch.is_ascii() && !ch.is_whitespace()) {
                self.offset += ch.len_utf8();
            } else {
                break;
            }
        }
        if self.offset == start {
            self.offset += self.source[self.offset..]
                .chars()
                .next()
                .unwrap()
                .len_utf8();
        }
        self.push(TokenKind::Invalid, start, self.offset);
        self.error("F0010", "Non-ASCII source tokens outside strings and comments are unsupported by this initial frontend. Full Unicode identifier rules and normalization are pending.", start, self.offset);
        self.logical_content = true;
    }

    fn string(&mut self, start: usize, quote_offset: usize, prefix: &str) {
        let quote = self.source.as_bytes()[quote_offset];
        let triple = self
            .source
            .as_bytes()
            .get(quote_offset..quote_offset + 3)
            .is_some_and(|slice| slice == [quote, quote, quote]);
        let width = if triple { 3 } else { 1 };
        self.offset = quote_offset + width;
        if prefix.contains('f') || prefix.contains('t') {
            self.error("F0011", "Formatted and template strings are unsupported by this initial frontend; interpolation is not parsed.", start, quote_offset);
        }
        let bytes_literal = prefix.contains('b');
        let mut terminated = false;
        while self.offset < self.source.len() {
            let ch = self.byte().unwrap();
            if ch == quote
                && (!triple
                    || self
                        .source
                        .as_bytes()
                        .get(self.offset..self.offset + 3)
                        .is_some_and(|slice| slice == [quote, quote, quote]))
            {
                self.offset += width;
                terminated = true;
                break;
            }
            if !triple && self.newline_length(self.offset) > 0 {
                break;
            }
            if ch == b'\\' {
                self.offset += 1;
                if self.offset < self.source.len() {
                    let newline = self.newline_length(self.offset);
                    let scalar = self.source[self.offset..].chars().next().unwrap();
                    if bytes_literal && !scalar.is_ascii() {
                        self.error("F0014", "Bytes literals may contain only ASCII source characters; use an escape for a non-ASCII byte.", self.offset, self.offset + scalar.len_utf8());
                    }
                    self.offset += if newline > 0 {
                        newline
                    } else {
                        scalar.len_utf8()
                    };
                }
            } else {
                let scalar = self.source[self.offset..].chars().next().unwrap();
                if bytes_literal && !scalar.is_ascii() {
                    self.error("F0014", "Bytes literals may contain only ASCII source characters; use an escape for a non-ASCII byte.", self.offset, self.offset + scalar.len_utf8());
                }
                self.offset += scalar.len_utf8();
            }
        }
        if !terminated {
            self.error(
                "F0005",
                if triple {
                    "Unterminated triple-quoted string."
                } else {
                    "Unterminated string literal."
                },
                start,
                self.offset,
            );
        }
        self.push(TokenKind::String, start, self.offset);
        self.logical_content = true;
    }

    fn number(&mut self) {
        let start = self.offset;
        let mut kind = TokenKind::Integer;
        let bytes = self.source.as_bytes();
        let base = if bytes.get(start) == Some(&b'0') {
            match bytes.get(start + 1) {
                Some(b'x' | b'X') => Some(16),
                Some(b'o' | b'O') => Some(8),
                Some(b'b' | b'B') => Some(2),
                _ => None,
            }
        } else {
            None
        };
        if let Some(base) = base {
            self.offset += 2;
            while self
                .byte()
                .is_some_and(|ch| ch.is_ascii_alphanumeric() || ch == b'_')
            {
                self.offset += 1;
            }
            let digits = &self.source[start + 2..self.offset];
            let valid = valid_digit_group(digits.strip_prefix('_').unwrap_or(digits), base);
            if !valid {
                self.error(
                    "F0006",
                    format!("Invalid base-{base} integer literal."),
                    start,
                    self.offset,
                );
            }
        } else {
            self.decimal_digits();
            if self.byte() == Some(b'.') {
                kind = TokenKind::Float;
                self.offset += 1;
                self.decimal_digits();
            }
            if matches!(self.byte(), Some(b'e' | b'E')) {
                kind = TokenKind::Float;
                self.offset += 1;
                if matches!(self.byte(), Some(b'+' | b'-')) {
                    self.offset += 1;
                }
                self.decimal_digits();
            }
            if matches!(self.byte(), Some(b'j' | b'J')) {
                self.offset += 1;
                self.error(
                    "F0013",
                    "Imaginary number literals are unsupported by this initial frontend.",
                    start,
                    self.offset,
                );
            } else {
                let lexeme = &self.source[start..self.offset];
                if !valid_decimal(lexeme, kind == TokenKind::Float) {
                    self.error(
                        "F0006",
                        "Invalid decimal number literal.",
                        start,
                        self.offset,
                    );
                }
            }
            if self
                .byte()
                .is_some_and(|ch| ch.is_ascii_alphabetic() || ch == b'_')
            {
                while self
                    .byte()
                    .is_some_and(|ch| ch.is_ascii_alphanumeric() || ch == b'_')
                {
                    self.offset += 1;
                }
                self.error(
                    "F0006",
                    "Invalid suffix on number literal.",
                    start,
                    self.offset,
                );
            }
        }
        self.push(kind, start, self.offset);
        self.logical_content = true;
    }

    fn decimal_digits(&mut self) {
        while self
            .byte()
            .is_some_and(|ch| ch.is_ascii_digit() || ch == b'_')
        {
            self.offset += 1;
        }
    }

    fn symbol_or_invalid(&mut self) {
        let start = self.offset;
        let rest = &self.source[start..];
        if let Some((text, symbol)) = SYMBOLS.iter().find(|(text, _)| rest.starts_with(text)) {
            self.offset += text.len();
            match symbol {
                Symbol::LeftParen | Symbol::LeftBracket | Symbol::LeftBrace => {
                    self.delimiters.push((text.as_bytes()[0], start));
                }
                Symbol::RightParen | Symbol::RightBracket | Symbol::RightBrace => {
                    let expected = match symbol {
                        Symbol::RightParen => b'(',
                        Symbol::RightBracket => b'[',
                        _ => b'{',
                    };
                    match self.delimiters.last().copied() {
                        Some((opener, _)) if opener == expected => {
                            self.delimiters.pop();
                        }
                        Some((opener, _)) => self.error(
                            "F0003",
                            format!(
                                "Closing delimiter '{}' does not match '{}'.",
                                text, opener as char
                            ),
                            start,
                            self.offset,
                        ),
                        None => self.error(
                            "F0003",
                            format!("Unexpected closing delimiter '{}'.", text),
                            start,
                            self.offset,
                        ),
                    }
                }
                _ => {}
            }
            self.push(TokenKind::Symbol(*symbol), start, self.offset);
        } else {
            self.offset += self.source[start..].chars().next().unwrap().len_utf8();
            self.error("F0007", "Unexpected source character.", start, self.offset);
            self.push(TokenKind::Invalid, start, self.offset);
        }
        self.logical_content = true;
    }
}

fn valid_digit_group(digits: &str, radix: u32) -> bool {
    !digits.is_empty()
        && !digits.starts_with('_')
        && !digits.ends_with('_')
        && !digits.contains("__")
        && digits.chars().all(|ch| ch == '_' || ch.is_digit(radix))
}

fn valid_decimal(value: &str, float: bool) -> bool {
    let (mantissa, exponent) = value
        .split_once(['e', 'E'])
        .map_or((value, None), |(left, right)| (left, Some(right)));
    if let Some(exponent) = exponent {
        let digits = exponent.strip_prefix(['+', '-']).unwrap_or(exponent);
        if !valid_digit_group(digits, 10) {
            return false;
        }
    }
    if let Some((whole, fraction)) = mantissa.split_once('.') {
        (whole.is_empty() || valid_digit_group(whole, 10))
            && (fraction.is_empty() || valid_digit_group(fraction, 10))
            && !(whole.is_empty() && fraction.is_empty())
    } else {
        valid_digit_group(mantissa, 10)
            && (float
                || !mantissa.starts_with('0')
                || mantissa.chars().all(|ch| ch == '0' || ch == '_'))
    }
}

// Longest spellings first; tokenization never performs alias substitution.
const SYMBOLS: &[(&str, Symbol)] = &[
    ("**=", Symbol::DoubleStarEqual),
    ("//=", Symbol::DoubleSlashEqual),
    ("<<=", Symbol::LeftShiftEqual),
    (">>=", Symbol::RightShiftEqual),
    ("...", Symbol::Ellipsis),
    ("**", Symbol::DoubleStar),
    ("//", Symbol::DoubleSlash),
    ("<<", Symbol::LeftShift),
    (">>", Symbol::RightShift),
    ("<=", Symbol::LessEqual),
    (">=", Symbol::GreaterEqual),
    ("==", Symbol::EqualEqual),
    ("!=", Symbol::NotEqual),
    (":=", Symbol::Walrus),
    ("->", Symbol::Arrow),
    ("+=", Symbol::PlusEqual),
    ("-=", Symbol::MinusEqual),
    ("*=", Symbol::StarEqual),
    ("/=", Symbol::SlashEqual),
    ("%=", Symbol::PercentEqual),
    ("@=", Symbol::AtEqual),
    ("&=", Symbol::AmpersandEqual),
    ("|=", Symbol::PipeEqual),
    ("^=", Symbol::CaretEqual),
    ("(", Symbol::LeftParen),
    (")", Symbol::RightParen),
    ("[", Symbol::LeftBracket),
    ("]", Symbol::RightBracket),
    ("{", Symbol::LeftBrace),
    ("}", Symbol::RightBrace),
    (":", Symbol::Colon),
    (",", Symbol::Comma),
    (";", Symbol::Semicolon),
    (".", Symbol::Dot),
    ("+", Symbol::Plus),
    ("-", Symbol::Minus),
    ("*", Symbol::Star),
    ("/", Symbol::Slash),
    ("%", Symbol::Percent),
    ("@", Symbol::At),
    ("&", Symbol::Ampersand),
    ("|", Symbol::Pipe),
    ("^", Symbol::Caret),
    ("~", Symbol::Tilde),
    ("<", Symbol::Less),
    (">", Symbol::Greater),
    ("=", Symbol::Equal),
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn header_cache_observes_each_token_once_with_fixed_history_storage() {
        for count in [500, 5_000, 50_000] {
            let mut context = HeaderContext::default();
            context.observe(TokenKind::Identifier, "data");
            for _ in 0..count {
                context.observe(TokenKind::Symbol(Symbol::LeftBrace), "{");
                assert!(!context.ends_indented_suite());
                context.observe(TokenKind::Symbol(Symbol::RightBrace), "}");
                context.observe(TokenKind::Symbol(Symbol::Semicolon), ";");
            }
            assert_eq!(context.observed_tokens, 1 + count * 3);
            assert_eq!(context.tail.len(), 4);
            for _ in 0..count {
                assert!(!context.ends_indented_suite());
            }
            assert_eq!(context.observed_tokens, 1 + count * 3);
        }
    }

    #[test]
    fn header_cache_preserves_async_markers_and_companion_resets() {
        let mut context = HeaderContext::default();
        context.observe(TokenKind::Identifier, "async");
        context.observe(TokenKind::Whitespace, " ");
        context.observe(TokenKind::Identifier, "def");
        context.observe(TokenKind::Identifier, "work");
        context.observe(TokenKind::Symbol(Symbol::LeftParen), "(");
        context.observe(TokenKind::Symbol(Symbol::RightParen), ")");
        context.observe(TokenKind::Symbol(Symbol::Colon), ":");
        assert!(context.ends_indented_suite());
        context.observe(TokenKind::Symbol(Symbol::LeftParen), "(");
        context.observe(TokenKind::Integer, "0");
        context.observe(TokenKind::Symbol(Symbol::RightParen), ")");
        assert!(context.ends_depth_marker());
        assert!(context.ends_indented_suite());
        context.observe(TokenKind::SuiteClose, "}");
        assert!(!context.ends_indented_suite());
        context.observe(TokenKind::Identifier, "else");
        context.observe(TokenKind::Symbol(Symbol::Colon), ":");
        assert!(context.ends_indented_suite());
        context.observe(TokenKind::Newline, "\n");
        assert!(!context.ends_indented_suite());
    }
}
