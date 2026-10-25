//! Bounded project alias configuration and explicit contextual lookup.

use crate::{Diagnostic, Span, Symbol, canonical_identifier};

pub const ALIAS_CONFIG_MAX_BYTES: usize = 64 * 1024;
pub const ALIAS_NAME_MAX_BYTES: usize = 256;
pub const ALIAS_DIAGNOSTIC_LIMIT: usize = 32;
const PROJECT_MANIFEST_MAX_BYTES: usize = 64 * 1024;
const PROJECT_MANIFEST_DOMAIN: &[u8] = b"NAJA.alias.project-manifest\0";

/// Explicit cache inputs supplied by the project owner. No filesystem or
/// ambient project discovery occurs here. Edition is bounded to 128 bytes and
/// policy to 4096 bytes; the exact bytes of both affect identity.
#[derive(Clone, Copy, Debug)]
pub struct AliasEnvironment<'a> {
    pub edition: &'a str,
    pub policy: &'a str,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BuiltinAlias {
    Print,
    Len,
}

/// A canonical grammar/symbol target, never an instruction to replace text.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AliasTarget {
    Comparison(Symbol),
    Builtin(BuiltinAlias),
}

/// The consumer must select context after raw keyword and binding resolution.
/// No context exists for member names, bindings, strings or comments.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AliasContext {
    ComparisonOperator,
    UnboundBuiltin,
}

/// All spans refer to the original configuration, not the consumer's source.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AliasEntry {
    pub target: AliasTarget,
    pub alias: String,
    pub canonical_alias: String,
    /// Assignment from the first key quote through the last value quote.
    pub span: Span,
    /// Quoted canonical key and quoted alias value, including their quotes.
    pub key_span: Span,
    pub value_span: Span,
}

#[derive(Clone, Debug)]
pub struct AliasTable {
    source: String,
    entries: Vec<AliasEntry>,
    cache_identity: Vec<u8>,
    base_identity_len: usize,
}

impl AliasTable {
    pub fn source(&self) -> &str {
        &self.source
    }

    pub fn entries(&self) -> &[AliasEntry] {
        &self.entries
    }

    /// Resolve an already validated NFKC candidate in one explicit grammar
    /// context. Check raw keywords, canonical spellings and explicit bindings
    /// before calling; builtin aliases are only an unbound-name fallback.
    /// The result retains the canonical target's ordinary precedence/semantics.
    /// Neither the candidate nor any source token is modified.
    pub fn lookup(&self, context: AliasContext, canonical_candidate: &str) -> Option<&AliasEntry> {
        self.entries.iter().find(|entry| {
            entry.canonical_alias == canonical_candidate
                && matches!(
                    (context, entry.target),
                    (AliasContext::ComparisonOperator, AliasTarget::Comparison(_))
                        | (AliasContext::UnboundBuiltin, AliasTarget::Builtin(_))
                )
        })
    }

    /// Collision-free serialization, not a digest: fixed domain/version, then
    /// u64 big-endian byte lengths and bytes for config, edition and policy.
    /// This includes whitespace/comments and whether schema=1 was explicit.
    pub fn cache_identity(&self) -> &[u8] {
        &self.cache_identity
    }

    /// Bind exactly one raw project-manifest context to this table's identity.
    /// The context is opaque UTF-8, at most 65536 bytes; no IO, parsing,
    /// normalization or policy interpretation occurs. Rebinding replaces the
    /// previous context. Alias source, entries and lookup semantics are unchanged.
    /// Oversize diagnostics use an empty config span for this external input.
    pub fn with_project_manifest(mut self, manifest: &str) -> Result<Self, Vec<Diagnostic>> {
        if manifest.len() > PROJECT_MANIFEST_MAX_BYTES {
            return Err(vec![error(
                "A0001",
                "Project manifest identity context exceeds the limit of 65536 UTF-8 bytes; this is an external input, not alias configuration text.",
                Span::new(0, 0),
            )]);
        }
        self.cache_identity.truncate(self.base_identity_len);
        self.cache_identity
            .extend_from_slice(PROJECT_MANIFEST_DOMAIN);
        self.cache_identity
            .extend_from_slice(&(manifest.len() as u64).to_be_bytes());
        self.cache_identity.extend_from_slice(manifest.as_bytes());
        Ok(self)
    }
}

/// Parse the documented format-1 subset of `naja.alias` without any IO.
///
/// Optional root `schema = 1` precedes `[operators]` and `[builtins]`. Assignments
/// use one-line TOML 1.0 basic-string keys/values; comments and LF/CRLF work.
/// Only six comparisons and print/len are targets. Unsupported tables or TOML
/// forms reject explicitly. A missing schema means format 1. See
/// `compatibility/aliases/README.md` for the complete bounded grammar/policy.
pub fn parse_aliases(
    source: &str,
    environment: AliasEnvironment<'_>,
) -> Result<AliasTable, Vec<Diagnostic>> {
    if source.len() > ALIAS_CONFIG_MAX_BYTES {
        return Err(vec![error(
            "A0001",
            "Alias configuration exceeds the limit of 65536 UTF-8 bytes.",
            Span::new(0, source.len()),
        )]);
    }
    if environment.edition.len() > 128 || environment.policy.len() > 4096 {
        return Err(vec![error(
            "A0001",
            "Alias environment exceeds the edition (128 bytes) or policy (4096 bytes) limit; this is an external input, not configuration text.",
            Span::new(0, 0),
        )]);
    }
    Parser::new(source).parse(environment)
}

fn error(code: &'static str, message: &str, span: Span) -> Diagnostic {
    Diagnostic {
        code,
        message: message.to_owned(),
        span,
    }
}

#[derive(Clone, Copy)]
enum Section {
    Root,
    Operators,
    Builtins,
    Unsupported,
}

struct Parser<'a> {
    source: &'a str,
    section: Section,
    schema_seen: bool,
    tables_seen: [bool; 2],
    targets_seen: Vec<AliasTarget>,
    entries: Vec<AliasEntry>,
}

impl<'a> Parser<'a> {
    fn new(source: &'a str) -> Self {
        Self {
            source,
            section: Section::Root,
            schema_seen: false,
            tables_seen: [false; 2],
            targets_seen: Vec::new(),
            entries: Vec::new(),
        }
    }

    fn parse(mut self, environment: AliasEnvironment<'_>) -> Result<AliasTable, Vec<Diagnostic>> {
        let mut diagnostics = Vec::new();
        let mut base = 0;
        for physical in self.source.split_inclusive('\n') {
            let line = if let Some(line) = physical.strip_suffix('\n') {
                line.strip_suffix('\r').unwrap_or(line)
            } else {
                physical
            };
            let mut cursor = Cursor {
                line,
                base,
                offset: 0,
            };
            let result = if let Some(offset) = line.find('\r') {
                Err(error(
                    "A0002",
                    "Alias configuration uses LF or CRLF newlines; a standalone CR is invalid.",
                    Span::new(base + offset, base + offset + 1),
                ))
            } else {
                self.line(&mut cursor)
            };
            if let Err(diagnostic) = result {
                diagnostics.push(diagnostic);
                if diagnostics.len() == ALIAS_DIAGNOSTIC_LIMIT {
                    break;
                }
            }
            base += physical.len();
        }
        if !diagnostics.is_empty() {
            return Err(diagnostics);
        }
        let mut identity = b"NAJA.alias\0".to_vec();
        identity.extend_from_slice(&1u64.to_be_bytes());
        for field in [self.source, environment.edition, environment.policy] {
            identity.extend_from_slice(&(field.len() as u64).to_be_bytes());
            identity.extend_from_slice(field.as_bytes());
        }
        Ok(AliasTable {
            source: self.source.to_owned(),
            entries: self.entries,
            base_identity_len: identity.len(),
            cache_identity: identity,
        })
    }

    fn line(&mut self, cursor: &mut Cursor<'_>) -> Result<(), Diagnostic> {
        cursor.spaces();
        if matches!(cursor.byte(), None | Some(b'#')) {
            return cursor.finish();
        }
        if cursor.byte() == Some(b'[') {
            return self.header(cursor);
        }
        match self.section {
            Section::Root => self.schema(cursor),
            Section::Operators | Section::Builtins => self.assignment(cursor),
            // A preceding diagnostic rejects this configuration. Do not
            // reinterpret unsupported table entries in the previous section.
            Section::Unsupported => Ok(()),
        }
    }

    fn header(&mut self, cursor: &mut Cursor<'_>) -> Result<(), Diagnostic> {
        self.section = Section::Unsupported;
        let start = cursor.offset;
        if cursor.line[start..].starts_with("[[") {
            return Err(cursor.error(
                "A0003",
                "Array-of-table alias sections are unsupported.",
                start,
                cursor.line.len(),
            ));
        }
        cursor.offset += 1;
        let Some(relative_end) = cursor.line[cursor.offset..].find(']') else {
            return Err(cursor.error(
                "A0002",
                "Alias table header requires a closing bracket.",
                start,
                cursor.line.len(),
            ));
        };
        let end = cursor.offset + relative_end;
        let name = cursor.line[cursor.offset..end].trim_matches([' ', '\t']);
        cursor.offset = end + 1;
        cursor.finish()?;
        let (section, index) =
            match name {
                "operators" => (Section::Operators, 0),
                "builtins" => (Section::Builtins, 1),
                _ => return Err(cursor.error(
                    "A0003",
                    "Unsupported alias section; format 1 supports only [operators] and [builtins].",
                    start,
                    end + 1,
                )),
            };
        if self.tables_seen[index] {
            return Err(cursor.error(
                "A0005",
                "An alias table cannot be declared more than once.",
                start,
                end + 1,
            ));
        }
        self.tables_seen[index] = true;
        self.section = section;
        Ok(())
    }

    fn schema(&mut self, cursor: &mut Cursor<'_>) -> Result<(), Diagnostic> {
        let start = cursor.offset;
        let Some(rest) = cursor.line[cursor.offset..].strip_prefix("schema") else {
            return Err(cursor.error("A0003", "Unsupported root declaration; only optional schema = 1 is accepted before alias tables.", start, cursor.line.len()));
        };
        if rest
            .as_bytes()
            .first()
            .is_some_and(|ch| !matches!(ch, b' ' | b'\t' | b'='))
        {
            return Err(cursor.error(
                "A0002",
                "Invalid schema declaration.",
                start,
                cursor.line.len(),
            ));
        }
        cursor.offset += 6;
        cursor.expect_equal()?;
        if cursor.byte() != Some(b'1') {
            return Err(cursor.error(
                "A0004",
                "Only alias schema version 1 is supported.",
                cursor.offset,
                cursor.line.len(),
            ));
        }
        cursor.offset += 1;
        cursor.finish()?;
        if self.schema_seen {
            return Err(cursor.error(
                "A0005",
                "Alias schema cannot be declared more than once.",
                start,
                cursor.offset,
            ));
        }
        self.schema_seen = true;
        Ok(())
    }

    fn assignment(&mut self, cursor: &mut Cursor<'_>) -> Result<(), Diagnostic> {
        let (key, key_span) = cursor.quoted()?;
        cursor.expect_equal()?;
        let (alias, value_span) = cursor.quoted()?;
        cursor.finish()?;
        let target = match (self.section, key.as_str()) {
            (Section::Operators, "==") => AliasTarget::Comparison(Symbol::EqualEqual),
            (Section::Operators, "!=") => AliasTarget::Comparison(Symbol::NotEqual),
            (Section::Operators, "<") => AliasTarget::Comparison(Symbol::Less),
            (Section::Operators, "<=") => AliasTarget::Comparison(Symbol::LessEqual),
            (Section::Operators, ">") => AliasTarget::Comparison(Symbol::Greater),
            (Section::Operators, ">=") => AliasTarget::Comparison(Symbol::GreaterEqual),
            (Section::Builtins, "print") => AliasTarget::Builtin(BuiltinAlias::Print),
            (Section::Builtins, "len") => AliasTarget::Builtin(BuiltinAlias::Len),
            _ => {
                return Err(error(
                    "A0003",
                    "Unsupported canonical alias target in this table.",
                    key_span,
                ));
            }
        };
        if self.targets_seen.contains(&target) {
            return Err(error(
                "A0005",
                "A canonical alias target cannot be assigned more than once.",
                key_span,
            ));
        }
        self.targets_seen.push(target);
        if alias.len() > ALIAS_NAME_MAX_BYTES {
            return Err(error(
                "A0001",
                "Decoded alias name exceeds the limit of 256 UTF-8 bytes.",
                value_span,
            ));
        }
        let canonical_alias = canonical_identifier(&alias).map_err(|_| {
            error("A0006", "Alias value must be a valid Unicode identifier; glyph aliases are not implemented.", value_span)
        })?;
        if reserved(&alias) || matches!(canonical_alias.as_str(), "print" | "len" | "set") {
            return Err(error(
                "A0007",
                "Alias conflicts with a reserved raw keyword or canonical builtin spelling.",
                value_span,
            ));
        }
        if self
            .entries
            .iter()
            .any(|entry| entry.canonical_alias == canonical_alias)
        {
            return Err(error(
                "A0008",
                "Alias name is ambiguous after Unicode NFKC canonicalization; names must be unique across tables.",
                value_span,
            ));
        }
        self.entries.push(AliasEntry {
            target,
            alias,
            canonical_alias,
            span: Span::new(key_span.start, value_span.end),
            key_span,
            value_span,
        });
        Ok(())
    }
}

fn reserved(raw: &str) -> bool {
    // Raw spelling is deliberate: NFKC lookalikes are identifiers, not newly
    // reserved keywords. Soft grammar words are reserved for alias declarations
    // to avoid future ambiguity; ordinary bindings keep their normal rules.
    matches!(
        raw,
        "False"
            | "None"
            | "True"
            | "and"
            | "as"
            | "assert"
            | "async"
            | "await"
            | "break"
            | "class"
            | "continue"
            | "def"
            | "del"
            | "elif"
            | "else"
            | "except"
            | "finally"
            | "for"
            | "from"
            | "global"
            | "if"
            | "import"
            | "in"
            | "is"
            | "lambda"
            | "nonlocal"
            | "not"
            | "or"
            | "pass"
            | "raise"
            | "return"
            | "try"
            | "while"
            | "with"
            | "yield"
            | "match"
            | "case"
            | "type"
            | "_"
    )
}

struct Cursor<'a> {
    line: &'a str,
    base: usize,
    offset: usize,
}

impl Cursor<'_> {
    fn byte(&self) -> Option<u8> {
        self.line.as_bytes().get(self.offset).copied()
    }

    fn spaces(&mut self) {
        while matches!(self.byte(), Some(b' ' | b'\t')) {
            self.offset += 1;
        }
    }

    fn error(&self, code: &'static str, message: &str, start: usize, end: usize) -> Diagnostic {
        error(code, message, Span::new(self.base + start, self.base + end))
    }

    fn finish(&mut self) -> Result<(), Diagnostic> {
        self.spaces();
        if self.byte() == Some(b'#') {
            for (offset, ch) in self.line[self.offset..].char_indices() {
                if forbidden_control(ch) {
                    return Err(self.error(
                        "A0002",
                        "Alias comments cannot contain control characters other than tab.",
                        self.offset + offset,
                        self.offset + offset + ch.len_utf8(),
                    ));
                }
            }
            self.offset = self.line.len();
        }
        if self.offset != self.line.len() {
            return Err(self.error(
                "A0002",
                "Unexpected trailing configuration text; one declaration is allowed per line.",
                self.offset,
                self.line.len(),
            ));
        }
        Ok(())
    }

    fn expect_equal(&mut self) -> Result<(), Diagnostic> {
        self.spaces();
        if self.byte() != Some(b'=') {
            return Err(self.error(
                "A0002",
                "Alias assignment requires an equals sign.",
                self.offset,
                self.line.len(),
            ));
        }
        self.offset += 1;
        self.spaces();
        Ok(())
    }

    fn quoted(&mut self) -> Result<(String, Span), Diagnostic> {
        let start = self.offset;
        if self.byte() != Some(b'"') || self.line[self.offset..].starts_with("\"\"\"") {
            return Err(self.error("A0003", "Alias keys and values require one-line double-quoted TOML basic strings; other forms are unsupported.", start, self.line.len()));
        }
        self.offset += 1;
        let mut value = String::new();
        while self.offset < self.line.len() {
            let current = self.offset;
            let ch = self.line[self.offset..].chars().next().unwrap();
            self.offset += ch.len_utf8();
            match ch {
                '"' => return Ok((value, Span::new(self.base + start, self.base + self.offset))),
                '\\' => value.push(self.escape(current)?),
                ch if forbidden_control(ch) => {
                    return Err(self.error(
                        "A0002",
                        "Unescaped control character in alias basic string.",
                        current,
                        self.offset,
                    ));
                }
                _ => value.push(ch),
            }
        }
        Err(self.error(
            "A0002",
            "Unterminated alias basic string; multiline strings are unsupported.",
            start,
            self.offset,
        ))
    }

    fn escape(&mut self, start: usize) -> Result<char, Diagnostic> {
        let Some(ch) = self.line[self.offset..].chars().next() else {
            return Err(self.error(
                "A0002",
                "Truncated alias basic-string escape.",
                start,
                self.offset,
            ));
        };
        self.offset += ch.len_utf8();
        match ch {
            '"' | '\\' => Ok(ch),
            'b' => Ok('\u{8}'),
            't' => Ok('\t'),
            'n' => Ok('\n'),
            'f' => Ok('\u{c}'),
            'r' => Ok('\r'),
            'u' | 'U' => {
                let mut value = 0;
                for _ in 0..if ch == 'u' { 4 } else { 8 } {
                    let Some(digit) = self.byte().filter(u8::is_ascii_hexdigit) else {
                        let end = self.offset
                            + self.line[self.offset..]
                                .chars()
                                .next()
                                .map_or(0, char::len_utf8);
                        return Err(self.error("A0002", "Alias Unicode escape requires exactly four (u) or eight (U) ASCII hexadecimal digits.", start, end));
                    };
                    value = value * 16
                        + match digit {
                            b'0'..=b'9' => digit - b'0',
                            b'a'..=b'f' => digit - b'a' + 10,
                            _ => digit - b'A' + 10,
                        } as u32;
                    self.offset += 1;
                }
                char::from_u32(value).ok_or_else(|| {
                    self.error(
                        "A0002",
                        "Alias Unicode escape must denote a Unicode scalar value.",
                        start,
                        self.offset,
                    )
                })
            }
            _ => Err(self.error(
                "A0002",
                "Unrecognized TOML 1.0 basic-string escape in alias configuration.",
                start,
                self.offset,
            )),
        }
    }
}

fn forbidden_control(ch: char) -> bool {
    matches!(ch, '\u{0}'..='\u{8}' | '\u{a}'..='\u{1f}' | '\u{7f}')
}
