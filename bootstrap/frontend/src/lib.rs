//! Independent UTF-8 source tokenization and a lossless logical-line CST.
//!
//! This is an initial lexer foundation, not a complete Python/NAJA grammar.
//! See the adjacent README for the exact supported and unsupported surface.

mod alias;
mod identifier;
mod lexer;
mod literal;

pub use alias::{
    ALIAS_CONFIG_MAX_BYTES, ALIAS_DIAGNOSTIC_LIMIT, ALIAS_NAME_MAX_BYTES, AliasContext, AliasEntry,
    AliasEnvironment, AliasTable, AliasTarget, BuiltinAlias, parse_aliases,
};
pub use identifier::{
    IDENTIFIER_UNICODE_VERSION, IdentifierError, IdentifierErrorKind, canonical_identifier,
    is_identifier,
};
pub use lexer::{lex, lex_with_dialect};
pub use literal::{LiteralValue, STRING_LITERAL_MAX_BYTES, decode_string};

/// Source syntax is selected explicitly, never by ambient machine settings.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Dialect {
    #[default]
    Python,
    Naja2026,
}

/// Half-open UTF-8 byte range in the unmodified input.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

impl Span {
    pub const fn new(start: usize, end: usize) -> Self {
        Self { start, end }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Symbol {
    LeftParen,
    RightParen,
    LeftBracket,
    RightBracket,
    LeftBrace,
    RightBrace,
    Colon,
    Comma,
    Semicolon,
    Dot,
    Ellipsis,
    Plus,
    Minus,
    Star,
    DoubleStar,
    Slash,
    DoubleSlash,
    Percent,
    At,
    Ampersand,
    Pipe,
    Caret,
    Tilde,
    LeftShift,
    RightShift,
    Less,
    LessEqual,
    Greater,
    GreaterEqual,
    Equal,
    EqualEqual,
    NotEqual,
    Walrus,
    Arrow,
    PlusEqual,
    MinusEqual,
    StarEqual,
    DoubleStarEqual,
    SlashEqual,
    DoubleSlashEqual,
    PercentEqual,
    AtEqual,
    AmpersandEqual,
    PipeEqual,
    CaretEqual,
    LeftShiftEqual,
    RightShiftEqual,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TokenKind {
    Identifier,
    Integer,
    /// Adjacent valid decimal integer and type identifier, NAJA 2026.1 only.
    TypedInteger,
    Float,
    String,
    Symbol(Symbol),
    /// NAJA 2026.1 suite delimiters, distinct from dictionary/set braces.
    SuiteOpen,
    SuiteClose,
    /// Exact source bytes from the opening # through the terminating #.
    BlockLabel,
    Whitespace,
    Comment,
    /// A physical line ending that terminates a logical line. Can be synthetic
    /// at EOF, in which case its span is empty.
    Newline,
    /// A physical line ending inside brackets or on a blank/comment-only line.
    NonLogicalNewline,
    /// Backslash and its following physical line ending, retained verbatim.
    ExplicitLineContinuation,
    ByteOrderMark,
    /// Structural tokens have empty spans and never replace source text.
    Indent,
    Dedent,
    EndOfFile,
    Invalid,
}

/// Recover the two original ranges without interpreting the integer or suffix.
pub fn typed_integer_spans(source: &str, token: &Token) -> Option<(Span, Span)> {
    if token.kind != TokenKind::TypedInteger {
        return None;
    }
    let text = source.get(token.span.start..token.span.end)?;
    let width = text
        .bytes()
        .take_while(|byte| byte.is_ascii_digit() || *byte == b'_')
        .count();
    if width == 0 || !is_identifier(text.get(width..)?) {
        return None;
    }
    Some((
        Span::new(token.span.start, token.span.start + width),
        Span::new(token.span.start + width, token.span.end),
    ))
}

impl TokenKind {
    pub const fn is_trivia(self) -> bool {
        matches!(
            self,
            Self::Whitespace
                | Self::Comment
                | Self::NonLogicalNewline
                | Self::ExplicitLineContinuation
                | Self::ByteOrderMark
        )
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Token {
    pub kind: TokenKind,
    pub span: Span,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Diagnostic {
    /// Stable initial frontend diagnostic identifier.
    pub code: &'static str,
    pub message: String,
    pub span: Span,
}

/// One-based line and Unicode-scalar column, calculated from original source.
/// Tabs count as one source character here; indentation separately uses tab
/// stops of eight columns and detects ambiguous tabs/spaces.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SourcePosition {
    pub line: usize,
    pub column: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Lexed {
    pub source: String,
    pub tokens: Vec<Token>,
    pub diagnostics: Vec<Diagnostic>,
}

impl Lexed {
    pub fn text(&self, token: &Token) -> &str {
        &self.source[token.span.start..token.span.end]
    }

    /// Borrowed tokens for a parser; preserves logical newlines, indentation,
    /// invalid tokens and EOF. Callers must reject diagnostics before execution.
    pub fn significant_tokens(&self) -> impl Iterator<Item = &Token> {
        self.tokens.iter().filter(|token| !token.kind.is_trivia())
    }

    /// Reconstruct the exact input, including trivia, line endings and BOM.
    pub fn reconstruct(&self) -> String {
        self.tokens.iter().map(|token| self.text(token)).collect()
    }

    /// Returns None for out-of-bounds offsets or an offset inside a UTF-8 scalar.
    pub fn position(&self, offset: usize) -> Option<SourcePosition> {
        if offset > self.source.len() || !self.source.is_char_boundary(offset) {
            return None;
        }
        let mut line = 1;
        let mut column = 1;
        let mut previous_cr = false;
        for ch in self.source[..offset].chars() {
            match ch {
                '\r' => {
                    line += 1;
                    column = 1;
                }
                '\n' if previous_cr => {}
                '\n' => {
                    line += 1;
                    column = 1;
                }
                _ => column += 1,
            }
            previous_cr = ch == '\r';
        }
        Some(SourcePosition { line, column })
    }
}

/// A logical line, including its original trivia and structural tokens.
/// Token ranges index `Cst::lexed.tokens`; trailing blank lines are retained in
/// the final node. No expression, suite or marker semantics are inferred here.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LogicalLine {
    pub span: Span,
    pub token_range: std::ops::Range<usize>,
    pub indentation_depth: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Cst {
    pub lexed: Lexed,
    pub lines: Vec<LogicalLine>,
    pub suites: Vec<Suite>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SuiteKind {
    Control,
    NamedSection,
}

/// Shared brace-folding/source metadata. A missing close remains None on an
/// invalid source; labels are metadata and do not establish symbol bindings.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Suite {
    pub kind: SuiteKind,
    pub span: Span,
    pub open: Span,
    pub close: Option<Span>,
    pub label: Option<Span>,
}

/// Build a lossless logical-line CST. This function does not validate grammar;
/// in particular it does not decide whether `:(0)` is a depth marker or suite.
pub fn parse_cst(source: &str) -> Cst {
    parse_cst_with_dialect(source, Dialect::Python)
}

pub fn parse_cst_with_dialect(source: &str, dialect: Dialect) -> Cst {
    let lexed = lex_with_dialect(source, dialect);
    let mut lines = Vec::new();
    let mut first = 0;
    let mut depth = 0usize;
    let mut line_depth = 0;
    let mut has_content = false;
    for (index, token) in lexed.tokens.iter().enumerate() {
        match token.kind {
            TokenKind::Indent => depth += 1,
            TokenKind::Dedent => depth = depth.saturating_sub(1),
            _ => {}
        }
        if !has_content && !token.kind.is_trivia() {
            line_depth = depth;
            has_content = !matches!(
                token.kind,
                TokenKind::Indent | TokenKind::Dedent | TokenKind::EndOfFile
            );
        }
        if matches!(token.kind, TokenKind::Newline | TokenKind::EndOfFile) {
            lines.push(LogicalLine {
                span: Span::new(lexed.tokens[first].span.start, token.span.end),
                token_range: first..index + 1,
                indentation_depth: line_depth,
            });
            first = index + 1;
            has_content = false;
            line_depth = depth;
        }
    }
    let mut suites: Vec<Suite> = Vec::new();
    let mut active = Vec::new();
    let mut previous = None;
    for token in &lexed.tokens {
        match token.kind {
            TokenKind::SuiteOpen => {
                active.push(suites.len());
                suites.push(Suite {
                    kind: if previous == Some(TokenKind::Symbol(Symbol::Colon)) {
                        SuiteKind::Control
                    } else {
                        SuiteKind::NamedSection
                    },
                    span: Span::new(token.span.start, source.len()),
                    open: token.span,
                    close: None,
                    label: None,
                });
            }
            TokenKind::BlockLabel => {
                if let Some(index) = active.last() {
                    suites[*index].label = Some(token.span);
                }
            }
            TokenKind::SuiteClose => {
                if let Some(index) = active.pop() {
                    suites[index].close = Some(token.span);
                    suites[index].span.end = token.span.end;
                }
            }
            _ => {}
        }
        if !token.kind.is_trivia() {
            previous = Some(token.kind);
        }
    }
    Cst {
        lexed,
        lines,
        suites,
    }
}
