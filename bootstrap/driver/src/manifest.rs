//! Bounded declarative schema-1 manifest metadata. No IO or capability activation.
//! This explicit TOML subset is specified in tests/project/MANIFEST.md.

use naja_frontend::{Diagnostic, Dialect, Span};
use std::collections::BTreeSet;

pub const MANIFEST_MAX_BYTES: usize = 64 * 1024;
pub const MANIFEST_LINE_MAX_BYTES: usize = 8192;
pub const MANIFEST_DECLARATION_LIMIT: usize = 128;
pub const MANIFEST_DEPENDENCY_LIMIT: usize = 32;
pub const MANIFEST_ARRAY_LIMIT: usize = 16;
pub const MANIFEST_STRING_MAX_BYTES: usize = 4096;
pub const MANIFEST_NAME_MAX_BYTES: usize = 256;
pub const MANIFEST_DEPENDENCY_NAME_MAX_BYTES: usize = 64;
pub const MANIFEST_PATH_MAX_BYTES: usize = 1024;
pub const MANIFEST_PATH_COMPONENT_LIMIT: usize = 32;
pub const MANIFEST_TARGET_MAX_BYTES: usize = 96;
pub const MANIFEST_DIAGNOSTIC_LIMIT: usize = 32;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Setting<T> {
    pub value: T,
    /// Original value bytes, including quotes/brackets; None means defaulted.
    pub span: Option<Span>,
}

impl<T> Setting<T> {
    fn explicit(value: T, span: Span) -> Self {
        Self {
            value,
            span: Some(span),
        }
    }
    fn defaulted(value: T) -> Self {
        Self { value, span: None }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Edition {
    Naja2026_1,
    Python3150,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Profile {
    Hosted,
    Core,
    Embedded,
}

/// Validated portable relative spelling, not a resolved filesystem path.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ManifestPath(pub String);

/// Lexical target identifier only; this does not assert backend availability.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TargetTriple(pub String);

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ManifestStyle {
    pub require_block_levels: Setting<bool>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LocalDependency {
    /// ASCII TOML package label, not a source identifier or resolved binding.
    pub name: Setting<String>,
    pub path: Setting<ManifestPath>,
    /// Caller-declared metadata, not a verified tree or archive digest.
    pub sha256: Option<Setting<String>>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProjectManifest {
    source: String,
    pub schema: Setting<u32>,
    pub name: Setting<String>,
    pub dialect: Setting<Dialect>,
    pub edition: Setting<Edition>,
    pub profile: Setting<Profile>,
    pub entry: Option<Setting<ManifestPath>>,
    /// Empty means unspecified; there is no ambient host selection.
    pub targets: Vec<Setting<TargetTriple>>,
    pub style: ManifestStyle,
    pub dependencies: Vec<LocalDependency>,
}

impl ProjectManifest {
    pub fn source(&self) -> &str {
        &self.source
    }
}

/// Parse only the documented schema-1 subset. No partial success is returned.
pub fn parse_manifest(source: &str) -> Result<ProjectManifest, Vec<Diagnostic>> {
    if source.len() > MANIFEST_MAX_BYTES {
        return Err(vec![error(
            "M0001",
            "Manifest exceeds 65536 UTF-8 bytes.",
            Span::new(0, source.len()),
        )]);
    }
    Parser::new(source).parse()
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
    Project,
    Style,
    Dependencies,
    Dependency(usize),
    Unsupported,
}

struct DependencyBuilder {
    name: Setting<String>,
    header: Span,
    path: Option<Setting<ManifestPath>>,
    sha256: Option<Setting<String>>,
}

struct Parser<'a> {
    source: &'a str,
    section: Section,
    tables: BTreeSet<String>,
    keys: BTreeSet<String>,
    schema: Option<Setting<u32>>,
    name: Option<Setting<String>>,
    dialect: Option<Setting<Dialect>>,
    edition: Option<Setting<Edition>>,
    profile: Option<Setting<Profile>>,
    entry: Option<Setting<ManifestPath>>,
    targets: Vec<Setting<TargetTriple>>,
    levels: Option<Setting<bool>>,
    dependencies: Vec<DependencyBuilder>,
    diagnostics: Vec<Diagnostic>,
}

impl<'a> Parser<'a> {
    fn new(source: &'a str) -> Self {
        Self {
            source,
            section: Section::Root,
            tables: BTreeSet::new(),
            keys: BTreeSet::new(),
            schema: None,
            name: None,
            dialect: None,
            edition: None,
            profile: None,
            entry: None,
            targets: Vec::new(),
            levels: None,
            dependencies: Vec::new(),
            diagnostics: Vec::new(),
        }
    }

    fn push(&mut self, diagnostic: Diagnostic) {
        if self.diagnostics.len() < MANIFEST_DIAGNOSTIC_LIMIT {
            self.diagnostics.push(diagnostic);
        }
    }

    fn parse(mut self) -> Result<ProjectManifest, Vec<Diagnostic>> {
        let mut base = 0;
        let mut declarations = 0;
        for physical in self.source.split_inclusive('\n') {
            let line = physical
                .strip_suffix('\n')
                .map_or(physical, |value| value.strip_suffix('\r').unwrap_or(value));
            let mut cursor = Cursor {
                line,
                base,
                offset: 0,
            };
            cursor.spaces();
            if !matches!(cursor.byte(), None | Some(b'#')) {
                declarations += 1;
            }
            let result = if declarations > MANIFEST_DECLARATION_LIMIT {
                Err(error(
                    "M0001",
                    "Manifest exceeds 128 declarations.",
                    Span::new(base, base + line.len()),
                ))
            } else if line.len() > MANIFEST_LINE_MAX_BYTES {
                Err(error(
                    "M0001",
                    "Manifest physical line exceeds 8192 bytes.",
                    Span::new(base, base + line.len()),
                ))
            } else if let Some((offset, ch)) =
                line.char_indices().find(|(_, ch)| forbidden_control(*ch))
            {
                Err(error(
                    "M0002",
                    "Manifest contains an unescaped control character or standalone CR.",
                    Span::new(base + offset, base + offset + ch.len_utf8()),
                ))
            } else {
                self.line(&mut cursor)
            };
            if let Err(diagnostic) = result {
                self.push(diagnostic);
            }
            if self.diagnostics.len() == MANIFEST_DIAGNOSTIC_LIMIT
                || declarations > MANIFEST_DECLARATION_LIMIT
            {
                break;
            }
            base += physical.len();
        }
        let missing = Span::new(self.source.len(), self.source.len());
        if self.name.is_none() {
            self.push(error("M0005", "Manifest requires [project] name.", missing));
        }
        for index in 0..self.dependencies.len() {
            if self.dependencies[index].path.is_none() {
                self.push(error(
                    "M0005",
                    "Every local dependency requires a path field.",
                    self.dependencies[index].header,
                ));
            }
        }
        let dialect = self
            .dialect
            .clone()
            .unwrap_or_else(|| Setting::defaulted(Dialect::Naja2026));
        let expected = if dialect.value == Dialect::Python {
            Edition::Python3150
        } else {
            Edition::Naja2026_1
        };
        let edition = self
            .edition
            .clone()
            .unwrap_or_else(|| Setting::defaulted(expected));
        if edition.value != expected {
            self.push(error("M0007", "Edition must match the declared dialect: naja uses 2026.1; python uses pinned 3.15.0.", edition.span.unwrap_or(missing)));
        }
        let levels = self
            .levels
            .clone()
            .unwrap_or_else(|| Setting::defaulted(false));
        if dialect.value == Dialect::Python && levels.value {
            self.push(error(
                "M0007",
                "NAJA block-level style cannot restrict the Python compatibility dialect.",
                levels.span.unwrap_or(missing),
            ));
        }
        if !self.diagnostics.is_empty() {
            return Err(self.diagnostics);
        }
        Ok(ProjectManifest {
            source: self.source.to_owned(),
            schema: self.schema.unwrap_or_else(|| Setting::defaulted(1)),
            name: self.name.expect("required name checked above"),
            dialect,
            edition,
            profile: self
                .profile
                .unwrap_or_else(|| Setting::defaulted(Profile::Hosted)),
            entry: self.entry,
            targets: self.targets,
            style: ManifestStyle {
                require_block_levels: levels,
            },
            dependencies: self
                .dependencies
                .into_iter()
                .map(|dependency| LocalDependency {
                    name: dependency.name,
                    path: dependency.path.expect("required path checked above"),
                    sha256: dependency.sha256,
                })
                .collect(),
        })
    }

    fn line(&mut self, cursor: &mut Cursor<'_>) -> Result<(), Diagnostic> {
        if matches!(cursor.byte(), None | Some(b'#')) {
            return Ok(());
        }
        if cursor.byte() == Some(b'[') {
            return self.table(cursor);
        }
        let (key, key_span) = cursor.bare()?;
        cursor.spaces();
        if cursor.byte() != Some(b'=') {
            return Err(cursor.at("M0003", "Assignments require a bare key and =; dotted/quoted keys and other TOML forms are unsupported.", key_span.start - cursor.base, cursor.line.len()));
        }
        cursor.offset += 1;
        cursor.spaces();
        let (value, span) = cursor.value()?;
        cursor.finish()?;
        let scope = match self.section {
            Section::Root => "root".to_owned(),
            Section::Project => "project".to_owned(),
            Section::Style => "style".to_owned(),
            Section::Dependencies => "dependencies".to_owned(),
            Section::Dependency(index) => {
                format!("dependencies.{}", self.dependencies[index].name.value)
            }
            Section::Unsupported => {
                return Err(error(
                    "M0003",
                    "Fields in unsupported tables are not accepted.",
                    key_span,
                ));
            }
        };
        if !self.keys.insert(format!("{scope}.{key}")) {
            return Err(error(
                "M0004",
                "Manifest field is declared more than once.",
                key_span,
            ));
        }
        match (self.section, key) {
            (Section::Root, "schema") => {
                if let Value::Integer(number) = value {
                    if number != 1 {
                        return Err(error("M0003", "Only manifest schema 1 is supported.", span));
                    }
                    self.schema = Some(Setting::explicit(1, span));
                } else {
                    return Err(wrong_type("schema requires the integer 1.", span));
                }
            }
            (Section::Project, "name") => {
                let text = value.string(span)?;
                if text.len() > MANIFEST_NAME_MAX_BYTES {
                    return Err(error(
                        "M0001",
                        "Project name exceeds 256 UTF-8 bytes.",
                        span,
                    ));
                }
                if text.trim().is_empty() || text.chars().any(char::is_control) {
                    return Err(error(
                        "M0007",
                        "Project name must contain nonempty text without controls.",
                        span,
                    ));
                }
                self.name = Some(Setting::explicit(text, span));
            }
            (Section::Project, "dialect") => {
                let text = value.string(span)?;
                self.dialect = Some(Setting::explicit(
                    match text.as_str() {
                        "naja" => Dialect::Naja2026,
                        "python" => Dialect::Python,
                        _ => {
                            return Err(error(
                                "M0003",
                                "Supported manifest dialects are naja and python.",
                                span,
                            ));
                        }
                    },
                    span,
                ));
            }
            (Section::Project, "edition") => {
                let text = value.string(span)?;
                self.edition = Some(Setting::explicit(
                    match text.as_str() {
                        "2026.1" => Edition::Naja2026_1,
                        "3.15.0" => Edition::Python3150,
                        _ => {
                            return Err(error(
                                "M0003",
                                "Supported editions are NAJA 2026.1 and pinned Python 3.15.0.",
                                span,
                            ));
                        }
                    },
                    span,
                ));
            }
            (Section::Project, "profile") => {
                let text = value.string(span)?;
                self.profile = Some(Setting::explicit(
                    match text.as_str() {
                        "hosted" => Profile::Hosted,
                        "core" => Profile::Core,
                        "embedded" => Profile::Embedded,
                        _ => {
                            return Err(error(
                                "M0003",
                                "Supported profile metadata is hosted, core or embedded.",
                                span,
                            ));
                        }
                    },
                    span,
                ));
            }
            (Section::Project, "entry") => {
                let text = value.string(span)?;
                validate_path(&text, false, span)?;
                self.entry = Some(Setting::explicit(ManifestPath(text), span));
            }
            (Section::Project, "target" | "targets") => {
                let other = if key == "target" { "targets" } else { "target" };
                if self.keys.contains(&format!("project.{other}")) {
                    return Err(error("M0004", "Use target or targets, not both.", key_span));
                }
                let targets = if key == "target" {
                    vec![(value.string(span)?, span)]
                } else if let Value::Strings(items) = value {
                    items
                } else {
                    return Err(wrong_type("targets requires a string array.", span));
                };
                if targets.is_empty() {
                    return Err(error(
                        "M0007",
                        "An explicit targets array cannot be empty.",
                        span,
                    ));
                }
                let mut seen = BTreeSet::new();
                for (text, item_span) in targets {
                    validate_target(&text, item_span)?;
                    if !seen.insert(text.clone()) {
                        return Err(error("M0004", "Target identifier is repeated.", item_span));
                    }
                    self.targets
                        .push(Setting::explicit(TargetTriple(text), item_span));
                }
            }
            (Section::Style, "require_block_levels") => {
                if let Value::Boolean(flag) = value {
                    self.levels = Some(Setting::explicit(flag, span));
                } else {
                    return Err(wrong_type("require_block_levels requires a boolean.", span));
                }
            }
            (Section::Dependency(index), "path") => {
                let text = value.string(span)?;
                validate_path(&text, true, span)?;
                self.dependencies[index].path = Some(Setting::explicit(ManifestPath(text), span));
            }
            (Section::Dependency(index), "sha256") => {
                let text = value.string(span)?;
                if text.len() != 64
                    || !text
                        .bytes()
                        .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
                {
                    return Err(error(
                        "M0007",
                        "Dependency sha256 requires exactly 64 lowercase hexadecimal digits; it is declared metadata only.",
                        span,
                    ));
                }
                self.dependencies[index].sha256 = Some(Setting::explicit(text, span));
            }
            _ => {
                return Err(error(
                    "M0003",
                    "Unknown or unsupported manifest field; executable hooks and implicit dependency declarations are not accepted.",
                    key_span,
                ));
            }
        }
        Ok(())
    }

    fn table(&mut self, cursor: &mut Cursor<'_>) -> Result<(), Diagnostic> {
        self.section = Section::Unsupported;
        let start = cursor.offset;
        cursor.offset += 1;
        cursor.spaces();
        let (first, _) = cursor.bare()?;
        let mut dependency = None;
        cursor.spaces();
        if cursor.byte() == Some(b'.') {
            cursor.offset += 1;
            cursor.spaces();
            dependency = Some(cursor.bare()?);
            cursor.spaces();
        }
        if cursor.byte() != Some(b']') {
            return Err(cursor.at("M0003", "Only project, style, dependencies and dependencies.NAME tables are supported; nesting is at most two.", start, cursor.line.len()));
        }
        cursor.offset += 1;
        let header = Span::new(cursor.base + start, cursor.base + cursor.offset);
        cursor.finish()?;
        let full = dependency
            .as_ref()
            .map_or_else(|| first.to_owned(), |(name, _)| format!("{first}.{name}"));
        if !self.tables.insert(full) {
            return Err(error(
                "M0004",
                "Manifest table is declared more than once.",
                header,
            ));
        }
        self.section = match (first, dependency) {
            ("project", None) => Section::Project,
            ("style", None) => Section::Style,
            ("dependencies", None) => Section::Dependencies,
            ("dependencies", Some((name, span))) => {
                if name.len() > MANIFEST_DEPENDENCY_NAME_MAX_BYTES {
                    return Err(error(
                        "M0001",
                        "Dependency package label exceeds 64 ASCII bytes.",
                        span,
                    ));
                }
                if self.dependencies.len() >= MANIFEST_DEPENDENCY_LIMIT {
                    return Err(error(
                        "M0001",
                        "Manifest exceeds 32 local dependencies.",
                        header,
                    ));
                }
                let index = self.dependencies.len();
                self.dependencies.push(DependencyBuilder {
                    name: Setting::explicit(name.to_owned(), span),
                    header,
                    path: None,
                    sha256: None,
                });
                Section::Dependency(index)
            }
            _ => {
                return Err(error(
                    "M0003",
                    "Unknown or unsupported manifest table.",
                    header,
                ));
            }
        };
        Ok(())
    }
}

enum Value {
    String(String),
    Integer(u64),
    Boolean(bool),
    Strings(Vec<(String, Span)>),
}
impl Value {
    fn string(self, span: Span) -> Result<String, Diagnostic> {
        if let Self::String(text) = self {
            Ok(text)
        } else {
            Err(wrong_type("Field requires a double-quoted string.", span))
        }
    }
}
fn wrong_type(message: &str, span: Span) -> Diagnostic {
    error("M0006", message, span)
}
fn forbidden_control(ch: char) -> bool {
    ch.is_control() && ch != '\t'
}

fn validate_target(text: &str, span: Span) -> Result<(), Diagnostic> {
    if text.len() > MANIFEST_TARGET_MAX_BYTES {
        return Err(error(
            "M0001",
            "Target identifier exceeds 96 ASCII bytes.",
            span,
        ));
    }
    let parts: Vec<_> = text.split('-').collect();
    if !(2..=8).contains(&parts.len())
        || parts.iter().any(|part| {
            part.is_empty()
                || !part
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
        })
    {
        return Err(error(
            "M0007",
            "Target must be a lowercase lexical triple with 2..8 nonempty ASCII components; backend availability is checked separately.",
            span,
        ));
    }
    Ok(())
}

fn validate_path(text: &str, allow_parent: bool, span: Span) -> Result<(), Diagnostic> {
    if text.len() > MANIFEST_PATH_MAX_BYTES
        || text.split('/').count() > MANIFEST_PATH_COMPONENT_LIMIT
    {
        return Err(error(
            "M0001",
            "Manifest path exceeds 1024 UTF-8 bytes or 32 components.",
            span,
        ));
    }
    if text.is_empty()
        || text.contains(['\\', ':', '<', '>', '"', '|', '?', '*'])
        || text.chars().any(char::is_control)
    {
        return Err(error(
            "M0007",
            "Manifest paths must be portable relative local paths without controls, reserved filename characters, backslashes, schemes or streams.",
            span,
        ));
    }
    for component in text.split('/') {
        if allow_parent && component == ".." {
            continue;
        }
        let lower = component.to_ascii_lowercase();
        let stem = lower.split('.').next().unwrap_or("");
        let numbered_device = stem
            .strip_prefix("com")
            .or_else(|| stem.strip_prefix("lpt"))
            .is_some_and(|suffix| {
                matches!(
                    suffix,
                    "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
                )
            });
        let device = matches!(stem, "con" | "prn" | "aux" | "nul") || numbered_device;
        if component.is_empty()
            || matches!(component, "." | "..")
            || lower == ".git"
            || component.ends_with(['.', ' '])
            || device
        {
            return Err(error(
                "M0007",
                "Invalid local path component; entry cannot escape its project, and absolute/private/device or ambiguous names are unsupported.",
                span,
            ));
        }
    }
    Ok(())
}

struct Cursor<'a> {
    line: &'a str,
    base: usize,
    offset: usize,
}
impl<'a> Cursor<'a> {
    fn byte(&self) -> Option<u8> {
        self.line.as_bytes().get(self.offset).copied()
    }
    fn spaces(&mut self) {
        while matches!(self.byte(), Some(b' ' | b'\t')) {
            self.offset += 1;
        }
    }
    fn at(&self, code: &'static str, message: &str, start: usize, end: usize) -> Diagnostic {
        error(code, message, Span::new(self.base + start, self.base + end))
    }
    fn bare(&mut self) -> Result<(&'a str, Span), Diagnostic> {
        let start = self.offset;
        while self
            .byte()
            .is_some_and(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
        {
            self.offset += 1;
        }
        if start == self.offset {
            return Err(self.at("M0003", "Structural keys and package labels require ASCII bare keys; other TOML forms are unsupported.", start, self.line.len()));
        }
        Ok((
            &self.line[start..self.offset],
            Span::new(self.base + start, self.base + self.offset),
        ))
    }
    fn finish(&mut self) -> Result<(), Diagnostic> {
        self.spaces();
        if matches!(self.byte(), None | Some(b'#')) {
            Ok(())
        } else {
            Err(self.at(
                "M0002",
                "Unexpected trailing manifest text; one declaration per physical line is required.",
                self.offset,
                self.line.len(),
            ))
        }
    }
    fn value(&mut self) -> Result<(Value, Span), Diagnostic> {
        let start = self.offset;
        let value = match self.byte() {
            Some(b'"') => Value::String(self.quoted()?.0),
            Some(b'[') => {
                self.offset += 1; self.spaces();
                let mut items = Vec::new();
                if self.byte() != Some(b']') {
                    loop {
                        if items.len() == MANIFEST_ARRAY_LIMIT { return Err(self.at("M0001", "Manifest array exceeds 16 strings.", start, self.line.len())); }
                        if self.byte() != Some(b'"') { return Err(self.at("M0003", "Only single-line, non-nested string arrays are supported.", self.offset, self.line.len())); }
                        items.push(self.quoted()?); self.spaces();
                        if self.byte() != Some(b',') { break; }
                        self.offset += 1; self.spaces();
                        if self.byte() == Some(b']') { break; }
                    }
                }
                if self.byte() != Some(b']') { return Err(self.at("M0003", "Manifest arrays must end on the same physical line.", start, self.line.len())); }
                self.offset += 1; Value::Strings(items)
            }
            Some(b'0'..=b'9') => {
                while self.byte().is_some_and(|byte| byte.is_ascii_digit()) { self.offset += 1; }
                let raw = &self.line[start..self.offset];
                if raw.len() > 1 && raw.starts_with('0') { return Err(self.at("M0002", "Decimal integers cannot contain leading zeroes.", start, self.offset)); }
                let number = raw.parse().map_err(|_| self.at("M0001", "Manifest decimal integer exceeds u64 metadata bounds.", start, self.offset))?;
                Value::Integer(number)
            }
            _ if self.line[self.offset..].starts_with("true") => { self.offset += 4; Value::Boolean(true) }
            _ if self.line[self.offset..].starts_with("false") => { self.offset += 5; Value::Boolean(false) }
            _ => return Err(self.at("M0003", "Unsupported manifest value; use one-line basic strings, unsigned decimals, booleans or string arrays.", start, self.line.len())),
        };
        Ok((value, Span::new(self.base + start, self.base + self.offset)))
    }
    fn quoted(&mut self) -> Result<(String, Span), Diagnostic> {
        let start = self.offset;
        if self.line[start..].starts_with("\"\"\"") {
            return Err(self.at(
                "M0003",
                "Multiline TOML strings are unsupported.",
                start,
                self.line.len(),
            ));
        }
        self.offset += 1;
        let mut text = String::new();
        while self.offset < self.line.len() {
            let current = self.offset;
            let ch = self.line[current..].chars().next().expect("UTF-8 boundary");
            self.offset += ch.len_utf8();
            match ch {
                '"' => return Ok((text, Span::new(self.base + start, self.base + self.offset))),
                '\\' => text.push(self.escape(current)?),
                _ => text.push(ch),
            }
            if text.len() > MANIFEST_STRING_MAX_BYTES {
                return Err(self.at(
                    "M0001",
                    "Decoded manifest string exceeds 4096 UTF-8 bytes.",
                    start,
                    self.offset,
                ));
            }
        }
        Err(self.at(
            "M0002",
            "Unterminated one-line manifest string.",
            start,
            self.offset,
        ))
    }
    fn escape(&mut self, start: usize) -> Result<char, Diagnostic> {
        let Some(ch) = self.line[self.offset..].chars().next() else {
            return Err(self.at(
                "M0002",
                "Incomplete manifest string escape.",
                start,
                self.offset,
            ));
        };
        self.offset += ch.len_utf8();
        if !ch.is_ascii() {
            return Err(self.at(
                "M0002",
                "Unsupported TOML basic-string escape.",
                start,
                self.offset,
            ));
        }
        let byte = ch as u8;
        match byte {
            b'"' => Ok('"'),
            b'\\' => Ok('\\'),
            b'b' => Ok('\u{8}'),
            b't' => Ok('\t'),
            b'n' => Ok('\n'),
            b'f' => Ok('\u{c}'),
            b'r' => Ok('\r'),
            b'u' | b'U' => {
                let count = if byte == b'u' { 4 } else { 8 };
                let mut scalar = 0;
                for _ in 0..count {
                    let Some(digit) = self.byte().and_then(|byte| (byte as char).to_digit(16))
                    else {
                        return Err(self.at(
                            "M0002",
                            "Unicode escape requires exactly four or eight hexadecimal digits.",
                            start,
                            self.offset,
                        ));
                    };
                    self.offset += 1;
                    scalar = scalar * 16 + digit;
                }
                char::from_u32(scalar).ok_or_else(|| self.at("M0002", "Unicode escape must encode a scalar value, not a surrogate or out-of-range code point.", start, self.offset))
            }
            _ => Err(self.at(
                "M0002",
                "Unsupported TOML basic-string escape.",
                start,
                self.offset,
            )),
        }
    }
}
