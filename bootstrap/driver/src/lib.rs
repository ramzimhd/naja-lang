//! Shared bounded executable parser with distinct checked-i64 and hosted domains.
use naja_frontend::{
    AliasContext, AliasTable, AliasTarget, BuiltinAlias, Diagnostic, Dialect, Lexed, Span, Symbol,
    Token, TokenKind, canonical_identifier, decode_string, lex_with_dialect,
};
use naja_native::{Binary, Comparison, MAX_LOCALS, Statement, dynamic, hosted};
use std::collections::{BTreeMap, BTreeSet};
use std::marker::PhantomData;
pub mod manifest;
mod values;
use values::{Dynamic, Fixed, Hosted, Values};

/// Bounded temporary seed stack reservation, plus platform thread overhead.
/// This supports the advertised parser/IR depths independently of the caller's
/// main-thread default. Native emitted programs do not create this worker.
pub const COMPILATION_STACK_BYTES: usize = 8 * 1024 * 1024;

fn compilation_worker<T: Send>(
    operation: impl FnOnce() -> Result<T, Vec<Diagnostic>> + Send,
) -> Result<T, Vec<Diagnostic>> {
    std::thread::scope(|scope| {
        let worker = std::thread::Builder::new()
            .name("naja-compiler".into())
            .stack_size(COMPILATION_STACK_BYTES)
            .spawn_scoped(scope, operation)
            .map_err(|error| {
                vec![Diagnostic {
                    code: "NJA107",
                    message: format!("cannot create the bounded compilation worker: {error}"),
                    span: Span::new(0, 0),
                }]
            })?;
        worker.join().unwrap_or_else(|_| {
            Err(vec![Diagnostic {
                code: "NJA108",
                message: "the compilation worker failed unexpectedly".into(),
                span: Span::new(0, 0),
            }])
        })
    })
}

/// Reject unsupported syntax instead of executing a foreign runtime or narrowing int.
pub fn compile(source: &str) -> Result<Vec<u8>, Vec<Diagnostic>> {
    compile_with_dialect(source, Dialect::Python)
}

pub fn compile_with_dialect(source: &str, dialect: Dialect) -> Result<Vec<u8>, Vec<Diagnostic>> {
    compile_with_aliases(source, dialect, None)
}

/// The caller supplies the owning module's table; no ambient alias discovery occurs.
pub fn compile_with_aliases(
    source: &str,
    dialect: Dialect,
    aliases: Option<&AliasTable>,
) -> Result<Vec<u8>, Vec<Diagnostic>> {
    compilation_worker(|| {
        let result = match check_with_aliases_inner(source, dialect, aliases)? {
            CheckedProgram::FixedI64(statements) => naja_native::emit_elf(&statements),
            CheckedProgram::HostedIntegers(statements) => hosted::emit_elf(&statements),
            CheckedProgram::HostedValues(program) => dynamic::emit_program(&program),
        };
        result.map_err(|message| {
            vec![Diagnostic {
                code: "NJA200",
                message,
                span: Span::new(0, 0),
            }]
        })
    })
}

#[derive(Debug)]
pub enum CheckedProgram {
    FixedI64(Vec<Statement>),
    HostedIntegers(Vec<hosted::Statement>),
    HostedValues(dynamic::Program),
}

pub fn check(source: &str) -> Result<CheckedProgram, Vec<Diagnostic>> {
    check_with_dialect(source, Dialect::Python)
}

pub fn check_with_dialect(
    source: &str,
    dialect: Dialect,
) -> Result<CheckedProgram, Vec<Diagnostic>> {
    check_with_aliases(source, dialect, None)
}

pub fn check_with_aliases(
    source: &str,
    dialect: Dialect,
    aliases: Option<&AliasTable>,
) -> Result<CheckedProgram, Vec<Diagnostic>> {
    compilation_worker(|| check_with_aliases_inner(source, dialect, aliases))
}

fn check_with_aliases_inner(
    source: &str,
    dialect: Dialect,
    aliases: Option<&AliasTable>,
) -> Result<CheckedProgram, Vec<Diagnostic>> {
    if dialect == Dialect::Python && aliases.is_some() {
        return Err(vec![Diagnostic {
            code: "NJA106",
            message: "project aliases cannot activate in the Python compatibility dialect".into(),
            span: Span::new(0, 0),
        }]);
    }
    let lexed = checked_lex(source, dialect)?;
    // The temporary checked-i64 slice retains its explicit initial import.
    // No import or annotation narrows an ordinary hosted literal to i64.
    if lexed
        .significant_tokens()
        .next()
        .is_some_and(|token| lexed.text(token) == "from")
    {
        parse_lexed::<Fixed>(lexed, dialect, aliases)
            .map(|program| CheckedProgram::FixedI64(program.body))
    } else {
        let parsed = parse_lexed::<Dynamic>(lexed, dialect, aliases)?;
        let program = dynamic::Program {
            body: parsed.body,
            functions: parsed.functions,
        };
        dynamic::validate_program(&program).map_err(|message| {
            vec![Diagnostic {
                code: "NJA104",
                message,
                span: Span::new(0, 0),
            }]
        })?;
        Ok(CheckedProgram::HostedValues(program))
    }
}

/// Check the hosted integer domain explicitly through the shared parser.
pub fn check_hosted(
    source: &str,
    dialect: Dialect,
) -> Result<Vec<hosted::Statement>, Vec<Diagnostic>> {
    compilation_worker(|| {
        let statements = parse_values::<Hosted>(source, dialect)?;
        validate_hosted(&statements)?;
        Ok(statements)
    })
}

fn validate_hosted(statements: &[hosted::Statement]) -> Result<(), Vec<Diagnostic>> {
    hosted::validate(statements).map_err(|message| {
        vec![Diagnostic {
            code: "NJA104",
            message,
            span: Span::new(0, 0),
        }]
    })
}

fn parse_values<V: Values>(
    source: &str,
    dialect: Dialect,
) -> Result<Vec<V::Statement>, Vec<Diagnostic>> {
    parse_lexed::<V>(checked_lex(source, dialect)?, dialect, None).map(|program| program.body)
}

fn checked_lex(source: &str, dialect: Dialect) -> Result<Lexed, Vec<Diagnostic>> {
    if source.len() > 1_048_576 {
        return Err(vec![Diagnostic {
            code: "NJA100",
            message: "source exceeds the experimental 1 MiB limit".into(),
            span: Span::new(0, 0),
        }]);
    }
    let lexed = lex_with_dialect(source, dialect);
    if !lexed.diagnostics.is_empty() {
        return Err(lexed.diagnostics);
    }
    Ok(lexed)
}

fn parse_lexed<V: Values>(
    lexed: Lexed,
    dialect: Dialect,
    aliases: Option<&AliasTable>,
) -> Result<ParsedProgram<V>, Vec<Diagnostic>> {
    let tokens = lexed.significant_tokens().cloned().collect();
    let mut parser = Parser::<V> {
        lexed,
        tokens,
        cursor: 0,
        locals: BTreeMap::new(),
        initialized: BTreeSet::new(),
        integer_annotations: BTreeSet::new(),
        imported_i64: false,
        nodes: 0,
        dialect,
        aliases: aliases.cloned(),
        structural_depth: 0,
        functions: Vec::new(),
        function_signatures: BTreeMap::new(),
        in_function: false,
        flow_live: true,
        module_bindings: BTreeSet::new(),
        function_builtin_uses: BTreeSet::new(),
        values: PhantomData,
    };
    parser.program().map_err(|diagnostic| vec![diagnostic])
}

struct ParsedProgram<V: Values> {
    body: Vec<V::Statement>,
    functions: Vec<V::Function>,
}

struct Parser<V: Values> {
    lexed: Lexed,
    tokens: Vec<Token>,
    cursor: usize,
    locals: BTreeMap<String, usize>,
    initialized: BTreeSet<usize>,
    integer_annotations: BTreeSet<usize>,
    imported_i64: bool,
    nodes: usize,
    dialect: Dialect,
    aliases: Option<AliasTable>,
    structural_depth: usize,
    functions: Vec<V::Function>,
    function_signatures: BTreeMap<String, (usize, usize)>,
    in_function: bool,
    flow_live: bool,
    module_bindings: BTreeSet<String>,
    function_builtin_uses: BTreeSet<String>,
    values: PhantomData<V>,
}

type Parsed<T> = Result<T, Diagnostic>;

impl<V: Values> Parser<V> {
    fn token(&self) -> &Token {
        &self.tokens[self.cursor.min(self.tokens.len() - 1)]
    }
    fn text(&self) -> &str {
        self.lexed.text(self.token())
    }
    fn error(&self, message: impl Into<String>) -> Diagnostic {
        Diagnostic {
            code: "NJA101",
            message: message.into(),
            span: self.token().span,
        }
    }
    fn advance(&mut self) {
        if self.cursor + 1 < self.tokens.len() {
            self.cursor += 1;
        }
    }
    fn take(&mut self, value: &str) -> bool {
        if !value.is_empty() && self.text() == value {
            self.advance();
            true
        } else {
            false
        }
    }
    fn expect(&mut self, value: &str) -> Parsed<()> {
        if self.take(value) {
            Ok(())
        } else {
            Err(self.error(format!(
                "expected '{value}' in the experimental executable subset"
            )))
        }
    }
    fn canonical_name(&self) -> Parsed<String> {
        canonical_identifier(self.text()).map_err(|error| Diagnostic {
            code: "NJA105",
            message: "invalid Unicode identifier".into(),
            span: Span::new(
                self.token().span.start + error.span.start,
                self.token().span.start + error.span.end,
            ),
        })
    }
    fn take_binding(&mut self, value: &str) -> bool {
        if self.token().kind == TokenKind::Identifier
            && canonical_identifier(self.text()).is_ok_and(|name| name == value)
        {
            self.advance();
            true
        } else {
            false
        }
    }
    fn expect_binding(&mut self, value: &str) -> Parsed<()> {
        if self.take_binding(value) {
            Ok(())
        } else {
            Err(self.error(format!(
                "expected binding '{value}' in this executable slice"
            )))
        }
    }
    fn take_builtin(&mut self, builtin: BuiltinAlias) -> bool {
        // Only a call position can select this slice's builtin call syntax.
        // In particular, an alias on the left of '=' first creates a binding.
        if !self
            .tokens
            .get(self.cursor + 1)
            .is_some_and(|token| self.lexed.text(token) == "(")
        {
            return false;
        }
        if self.token().kind != TokenKind::Identifier
            || reserved(self.text()) && !matches!(self.text(), "print")
        {
            return false;
        }
        let Ok(name) = self.canonical_name() else {
            return false;
        };
        if self.locals.contains_key(&name)
            || self.function_signatures.contains_key(&name)
            || (self.in_function && self.module_bindings.contains(&name))
        {
            return false;
        }
        let conventional = match builtin {
            BuiltinAlias::Print => "print",
            BuiltinAlias::Len => "len",
        };
        let matches = name == conventional
            || self
                .aliases
                .as_ref()
                .and_then(|table| table.lookup(AliasContext::UnboundBuiltin, &name))
                .is_some_and(|entry| entry.target == AliasTarget::Builtin(builtin));
        if matches {
            if self.in_function {
                self.function_builtin_uses.insert(name);
            }
            self.advance();
        }
        matches
    }
    fn comparison(&self) -> Option<Comparison> {
        let symbol = match self.token().kind {
            TokenKind::Symbol(symbol) => Some(symbol),
            TokenKind::Identifier if !reserved(self.text()) => self
                .canonical_name()
                .ok()
                .and_then(|name| {
                    self.aliases
                        .as_ref()?
                        .lookup(AliasContext::ComparisonOperator, &name)
                })
                .and_then(|entry| match entry.target {
                    AliasTarget::Comparison(symbol) => Some(symbol),
                    _ => None,
                }),
            _ => None,
        }?;
        match symbol {
            Symbol::EqualEqual => Some(Comparison::Equal),
            Symbol::NotEqual => Some(Comparison::NotEqual),
            Symbol::Less => Some(Comparison::Less),
            Symbol::LessEqual => Some(Comparison::LessEqual),
            Symbol::Greater => Some(Comparison::Greater),
            Symbol::GreaterEqual => Some(Comparison::GreaterEqual),
            _ => None,
        }
    }
    fn reserved_name(&self) -> bool {
        // Hard keywords are recognized from raw spellings. Compiler-provided
        // bindings use canonical keys and cannot yet be shadowed in this slice.
        reserved(self.text())
            || canonical_identifier(self.text())
                .is_ok_and(|name| matches!(name.as_str(), "print" | "i64"))
    }
    fn newline(&mut self) -> Parsed<()> {
        if self.token().kind == TokenKind::Newline {
            self.advance();
            Ok(())
        } else {
            Err(self.error("expected end of logical line; extra syntax is unsupported"))
        }
    }
    fn program(&mut self) -> Parsed<ParsedProgram<V>> {
        let mut statements = Vec::new();
        while self.token().kind != TokenKind::EndOfFile {
            if self.token().kind == TokenKind::Newline {
                self.advance();
                continue;
            }
            if self.text() == "def" {
                self.function_definition()?;
            } else if self.text() == "from" {
                if V::HOSTED {
                    return Err(self.error("general imports are not implemented in the hosted integer slice; explicit i64 programs use the checked-i64 path"));
                }
                if self.imported_i64 || !statements.is_empty() {
                    return Err(self.error(
                        "the experimental i64 import must appear once before executable statements",
                    ));
                }
                self.expect("from")?;
                self.expect_binding("naja")?;
                self.expect(".")?;
                self.expect_binding("core")?;
                self.expect("import")?;
                self.expect_binding("i64")?;
                self.newline()?;
                self.imported_i64 = true;
            } else {
                if !V::HOSTED && !self.imported_i64 {
                    return Err(self.error("this native spike requires 'from naja.core import i64'; hosted arbitrary-precision int is not implemented"));
                }
                statements.push(self.statement(0)?);
            }
        }
        if statements.is_empty() && !self.functions.is_empty() {
            // Definitions bind static names but do not execute their bodies.
            // An empty transparent group gives the native module a zero-work
            // main body without manufacturing a call or a printed result.
            statements.push(V::group(Vec::new()));
        }
        if statements.is_empty() {
            return Err(self.error(
                "expected an executable statement; the native spike does not emit empty programs",
            ));
        }
        Ok(ParsedProgram {
            body: statements,
            functions: std::mem::take(&mut self.functions),
        })
    }
    fn function_definition(&mut self) -> Parsed<()> {
        if !V::DYNAMIC || self.in_function {
            return Err(
                self.error("only top-level ordinary-value function definitions are implemented")
            );
        }
        self.account_statement(0)?;
        self.expect("def")?;
        if self.token().kind != TokenKind::Identifier || self.reserved_name() {
            return Err(self.error("expected an unreserved function name"));
        }
        let name = self.canonical_name()?;
        if self.locals.contains_key(&name)
            || self.function_signatures.contains_key(&name)
            || self.function_builtin_uses.contains(&name)
        {
            return Err(
                self.error("function rebinding or collision with a module variable is unsupported")
            );
        }
        if self.functions.len() >= dynamic::MAX_FUNCTIONS {
            return Err(self.error("experimental function limit of 128 exceeded"));
        }
        self.advance();
        self.expect("(")?;
        let mut parameters = BTreeMap::new();
        if self.text() != ")" {
            loop {
                if self.token().kind != TokenKind::Identifier || self.reserved_name() {
                    return Err(
                        self.error("functions currently require plain positional parameter names")
                    );
                }
                let parameter = self.canonical_name()?;
                if parameters.contains_key(&parameter) {
                    return Err(
                        self.error("duplicate parameter under its canonical Unicode spelling")
                    );
                }
                if parameters.len() >= MAX_LOCALS {
                    return Err(self.error("experimental parameter limit of 128 exceeded"));
                }
                parameters.insert(parameter, parameters.len());
                self.advance();
                if !self.take(",") || self.text() == ")" {
                    break;
                }
            }
        }
        self.expect(")")?;
        let count = parameters.len();
        self.function_signatures
            .insert(name, (self.functions.len(), count));
        self.module_bindings = self.locals.keys().cloned().collect();
        let outer_locals = std::mem::replace(&mut self.locals, parameters);
        let outer_initialized = std::mem::replace(&mut self.initialized, (0..count).collect());
        let outer_annotations = std::mem::take(&mut self.integer_annotations);
        let outer_flow = std::mem::replace(&mut self.flow_live, true);
        self.in_function = true;
        let body = self.suite(1)?;
        self.in_function = false;
        self.locals = outer_locals;
        self.initialized = outer_initialized;
        self.integer_annotations = outer_annotations;
        self.flow_live = outer_flow;
        let function = V::function(count, body).map_err(|message| self.error(message))?;
        self.functions.push(function);
        Ok(())
    }
    fn statement(&mut self, depth: usize) -> Parsed<V::Statement> {
        self.account_statement(depth)?;
        self.statement_after_accounting(depth)
    }
    fn account_statement(&mut self, depth: usize) -> Parsed<()> {
        self.nodes += 1;
        if self.nodes > 10_000 || depth > 64 {
            return Err(
                self.error("experimental program exceeds 10000 statements or 64 suite levels")
            );
        }
        Ok(())
    }
    fn statement_after_accounting(&mut self, depth: usize) -> Parsed<V::Statement> {
        if self.token().kind == TokenKind::SuiteOpen {
            return self.brace_suite(depth, true).map(V::group);
        }
        if self.take("while") {
            let condition = self.condition()?;
            let initialized = self.initialized.clone();
            let flow_live = self.flow_live;
            let body = self.suite(depth + 1)?;
            // A loop may execute zero times. New symbols retain their slots,
            // while only values initialized on entry are definite afterward.
            self.initialized = initialized;
            self.flow_live = flow_live;
            if self.text() == "else" {
                return Err(self.error("while-else is not implemented in this native spike"));
            }
            return Ok(V::while_loop(condition, body));
        }
        if self.take("if") {
            let condition = self.condition()?;
            let initialized = self.initialized.clone();
            let flow_live = self.flow_live;
            let yes = self.suite(depth + 1)?;
            let yes_initialized = self.initialized.clone();
            let yes_live = self.flow_live;
            self.initialized = initialized;
            self.flow_live = flow_live;
            let no = if self.take("else") {
                self.suite(depth + 1)?
            } else {
                Vec::new()
            };
            let no_live = self.flow_live;
            self.initialized = match (yes_live, no_live) {
                (true, false) => yes_initialized,
                (false, true) => self.initialized.clone(),
                _ => yes_initialized
                    .intersection(&self.initialized)
                    .copied()
                    .collect(),
            };
            self.flow_live = yes_live || no_live;
            if self.text() == "elif" {
                return Err(self.error(
                    "elif is not implemented in this native spike; full grammar remains open",
                ));
            }
            return Ok(V::conditional(condition, yes, no));
        }
        self.simple(depth)
    }
    fn suite(&mut self, depth: usize) -> Parsed<Vec<V::Statement>> {
        self.expect(":")?;
        if self.token().kind == TokenKind::SuiteOpen {
            return self.brace_suite(depth, false);
        }
        self.enter_suite()?;
        let result = self.indented_or_simple_suite(depth);
        self.structural_depth -= 1;
        result
    }
    fn enter_suite(&mut self) -> Parsed<()> {
        if self.structural_depth >= 64 {
            return Err(self.error("experimental program exceeds 64 suite levels"));
        }
        self.structural_depth += 1;
        Ok(())
    }
    fn brace_suite(&mut self, depth: usize, named: bool) -> Parsed<Vec<V::Statement>> {
        self.enter_suite()?;
        self.advance();
        let result = (|| {
            if self.token().kind == TokenKind::BlockLabel {
                self.advance();
            } else if named {
                return Err(self.error("a transparent named section requires a block label"));
            }
            self.newline()?;
            let mut body = Vec::new();
            while self.token().kind != TokenKind::SuiteClose {
                if self.token().kind == TokenKind::EndOfFile {
                    return Err(self.error("unterminated brace suite"));
                }
                if self.token().kind == TokenKind::Newline {
                    self.advance();
                } else {
                    body.push(self.statement(depth)?);
                }
            }
            self.advance();
            if self.token().kind == TokenKind::Newline {
                self.advance();
            } else if self.token().kind != TokenKind::EndOfFile
                && self.token().kind != TokenKind::SuiteClose
                && self.token().kind != TokenKind::Dedent
                && !matches!(self.text(), "else" | "elif")
            {
                return Err(
                    self.error("expected end of line or a matching conditional clause after '}'")
                );
            }
            if body.is_empty() {
                return Err(self.error("empty suites are unsupported in this native subset"));
            }
            Ok(body)
        })();
        self.structural_depth -= 1;
        result
    }
    fn indented_or_simple_suite(&mut self, depth: usize) -> Parsed<Vec<V::Statement>> {
        // Recognize markers structurally, without changing ordinary expressions in .py.
        if self.dialect == Dialect::Naja2026 && self.text() == "(" {
            let marker = self.tokens.get(self.cursor..self.cursor + 5);
            if let Some([open, number, close, newline, indent]) = marker
                && self.lexed.text(open) == "("
                && number.kind == TokenKind::Integer
                && self.lexed.text(close) == ")"
                && newline.kind == TokenKind::Newline
                && indent.kind == TokenKind::Indent
            {
                let text = self.lexed.text(number);
                if !text.bytes().all(|byte| byte.is_ascii_digit())
                    || text.parse::<usize>().ok() != Some(depth - 1)
                {
                    return Err(self.error(format!(
                        "depth marker must equal enclosing control depth {}",
                        depth - 1
                    )));
                }
                self.cursor += 3;
            }
        }
        if self.token().kind != TokenKind::Newline {
            self.account_statement(depth)?;
            return Ok(vec![self.simple(depth)?]);
        }
        self.newline()?;
        if self.token().kind != TokenKind::Indent {
            return Err(self.error("expected an indented suite"));
        }
        self.advance();
        let mut body = Vec::new();
        while self.token().kind != TokenKind::Dedent {
            if self.token().kind == TokenKind::EndOfFile {
                return Err(self.error("unterminated indented suite"));
            }
            if self.token().kind == TokenKind::Newline {
                self.advance();
            } else {
                body.push(self.statement(depth)?);
            }
        }
        self.advance();
        if body.is_empty() {
            return Err(self.error("empty suites are unsupported"));
        }
        Ok(body)
    }
    fn simple(&mut self, depth: usize) -> Parsed<V::Statement> {
        if V::DYNAMIC && self.take("pass") {
            self.newline()?;
            return Ok(V::group(Vec::new()));
        }
        if self.take("return") {
            if !V::DYNAMIC || !self.in_function {
                return Err(self.error("return requires an ordinary-value function body"));
            }
            let value = if self.token().kind == TokenKind::Newline {
                V::none().map_err(|message| self.error(message))?
            } else {
                self.expression(0, 0)?
            };
            self.newline()?;
            self.flow_live = false;
            return V::returned(value).map_err(|message| self.error(message));
        }
        if self.take("assert") {
            let condition = self.condition()?;
            self.newline()?;
            return Ok(V::assertion(condition));
        }
        if self.take_builtin(BuiltinAlias::Print) {
            self.expect("(")?;
            let value = self.expression(0, 0)?;
            self.expect(")")?;
            self.newline()?;
            return Ok(V::print(value));
        }
        if V::DYNAMIC
            && self.token().kind == TokenKind::Identifier
            && self
                .tokens
                .get(self.cursor + 1)
                .is_some_and(|t| self.lexed.text(t) == "(")
        {
            let value = self.expression(0, 0)?;
            self.newline()?;
            return V::evaluate(value).map_err(|message| self.error(message));
        }
        if self.token().kind != TokenKind::Identifier || self.reserved_name() {
            return Err(self.error("unsupported statement in the experimental executable subset"));
        }
        let name_span = self.token().span;
        let name = self.canonical_name()?;
        if self.function_signatures.contains_key(&name) {
            return Err(self.error("rebinding a statically resolved function name is unsupported"));
        }
        if self.function_builtin_uses.contains(&name) {
            return Err(self.error("rebinding a builtin used by a static function is unsupported"));
        }
        self.advance();
        let declared = self.take(":");
        let creates = declared || (V::HOSTED && !self.locals.contains_key(&name));
        let slot = if creates {
            if !V::HOSTED && depth != 0 {
                return Err(self.error("this native spike requires local declarations at top level for definite initialization"));
            }
            if declared {
                if V::DYNAMIC
                    && self.dialect == Dialect::Naja2026
                    && (self.locals.contains_key("int")
                        || self.function_signatures.contains_key("int")
                        || (self.in_function && self.module_bindings.contains("int")))
                {
                    return Err(self.error("an int annotation requires the compiler-provided type; a local binding shadows it in this executable slice"));
                }
                self.expect_binding(if V::HOSTED { "int" } else { "i64" })?;
                if V::DYNAMIC && self.dialect == Dialect::Naja2026 && self.in_function {
                    self.function_builtin_uses.insert("int".into());
                }
            }
            if self.locals.contains_key(&name) {
                return Err(Diagnostic {
                    code: "NJA101",
                    message: "duplicate declaration under its canonical Unicode spelling".into(),
                    span: name_span,
                });
            }
            if self.locals.len() >= MAX_LOCALS {
                return Err(self.error("experimental local limit of 128 exceeded"));
            }
            self.locals.len()
        } else {
            *self.locals.get(&name).ok_or_else(|| self.error("declare the variable with ': i64' before assignment; hosted int inference is not implemented"))?
        };
        self.expect("=")?;
        let mut value = self.expression(0, 0)?;
        self.newline()?;
        if V::DYNAMIC && self.dialect == Dialect::Naja2026 {
            if declared {
                self.integer_annotations.insert(slot);
            }
            if self.integer_annotations.contains(&slot) {
                self.account_expression()?;
                value = V::require_integer(value);
            }
        }
        if creates {
            self.locals.insert(name, slot);
        }
        self.initialized.insert(slot);
        Ok(V::assign(slot, value))
    }
    fn condition(&mut self) -> Parsed<V::Condition> {
        if V::DYNAMIC {
            let value = self.expression(0, 0)?;
            return V::truth(value).map_err(|message| self.error(message));
        }
        let left = self.expression(0, 0)?;
        let comparison = self.comparison().ok_or_else(|| {
            self.error("this explicit integer domain requires one comparison in each condition")
        })?;
        self.advance();
        let right = self.expression(0, 0)?;
        Ok(V::condition(left, comparison, right))
    }
    fn account_expression(&mut self) -> Parsed<()> {
        self.nodes += 1;
        if self.nodes > 10_000 {
            return Err(self.error("experimental parse operation limit of 10000 exceeded"));
        }
        Ok(())
    }
    fn expression(&mut self, minimum: u8, depth: usize) -> Parsed<V::Expression> {
        if depth > 128 {
            return Err(self.error("experimental expression nesting exceeds 128"));
        }
        let mut left = if V::DYNAMIC && self.text() == "not" {
            if minimum > 3 {
                return Err(
                    self.error("not requires parentheses in an arithmetic or comparison operand")
                );
            }
            self.advance();
            let value = self.expression(3, depth + 1)?;
            V::boolean_not(value).map_err(|message| self.error(message))?
        } else if self.take("-") {
            V::negate(self.expression(7, depth + 1)?)
        } else if self.take("+") {
            V::positive(self.expression(7, depth + 1)?)
        } else if self.take("(") {
            if self.take(")") {
                V::tuple(Vec::new()).map_err(|message| self.error(message))?
            } else {
                let first = self.expression(0, depth + 1)?;
                if self.take(",") {
                    let mut elements = vec![first];
                    while self.text() != ")" {
                        if elements.len() >= dynamic::MAX_TUPLE_ELEMENTS {
                            return Err(
                                self.error("experimental tuple element limit of 128 exceeded")
                            );
                        }
                        elements.push(self.expression(0, depth + 1)?);
                        if !self.take(",") {
                            break;
                        }
                    }
                    self.expect(")")?;
                    V::tuple(elements).map_err(|message| self.error(message))?
                } else {
                    self.expect(")")?;
                    first
                }
            }
        } else if self.take_binding("i64") {
            if V::HOSTED {
                return Err(self.error(
                    "explicit i64 and hosted integers cannot yet be mixed in this executable slice",
                ));
            }
            self.expect("(")?;
            let negative = self.take("-");
            if self.token().kind != TokenKind::Integer {
                return Err(self.error("this spike implements i64(signed_decimal_literal) only"));
            }
            let text = self.text();
            if !text.bytes().all(|byte| byte.is_ascii_digit())
                || (text.len() > 1 && text.starts_with('0'))
            {
                return Err(self.error(
                    "only canonical decimal i64 literals are implemented in this native spike",
                ));
            }
            let signed = if negative {
                format!("-{text}")
            } else {
                text.to_owned()
            };
            let value = V::integer(signed).map_err(|message| self.error(message))?;
            self.advance();
            self.expect(")")?;
            value
        } else if V::DYNAMIC && self.token().kind == TokenKind::String {
            let decoded = decode_string(&self.lexed.source, self.token())?;
            let value = V::literal(decoded).map_err(|message| self.error(message))?;
            self.advance();
            value
        } else if V::DYNAMIC && matches!(self.text(), "True" | "False") {
            let value = V::boolean(self.text() == "True").map_err(|message| self.error(message))?;
            self.advance();
            value
        } else if V::DYNAMIC && self.take("None") {
            V::none().map_err(|message| self.error(message))?
        } else if V::DYNAMIC && self.take_builtin(BuiltinAlias::Len) {
            self.expect("(")?;
            let value = self.expression(0, depth + 1)?;
            self.expect(")")?;
            V::length(value).map_err(|message| self.error(message))?
        } else if self.token().kind == TokenKind::Integer {
            if !V::HOSTED {
                return Err(self.error("hosted integer expressions require the hosted path; use explicit i64(decimal_literal) in this fixed-width slice"));
            }
            let text = self.text().replace('_', "");
            if !text.bytes().all(|byte| byte.is_ascii_digit()) {
                return Err(
                    self.error("the hosted integer slice currently supports decimal literals only")
                );
            }
            let value = V::integer(text).map_err(|message| self.error(message))?;
            self.advance();
            value
        } else if self.token().kind == TokenKind::Identifier && !self.reserved_name() {
            let name = self.canonical_name()?;
            if V::DYNAMIC
                && self
                    .tokens
                    .get(self.cursor + 1)
                    .is_some_and(|token| self.lexed.text(token) == "(")
            {
                self.function_call(&name, depth)?
            } else {
                let slot = *self.locals.get(&name).ok_or_else(|| {
                    self.error(
                        "undefined or uninitialized name in the experimental executable subset",
                    )
                })?;
                if !self.initialized.contains(&slot) {
                    return Err(self.error(
                        "name is not definitely initialized on every path in this executable slice",
                    ));
                }
                self.advance();
                V::local(slot)
            }
        } else {
            return Err(self.error(if V::HOSTED {
                "unsupported expression in the hosted integer slice"
            } else {
                "unsupported expression; this checked-i64 slice requires explicit i64 values"
            }));
        };
        self.account_expression()?;
        loop {
            if V::DYNAMIC && self.text() == "[" {
                // Indexing binds more tightly than unary signs, multiplication,
                // comparisons and short circuiting, and chains left to right.
                if 8 < minimum {
                    break;
                }
                self.advance();
                let index = self.expression(0, depth + 1)?;
                if matches!(self.text(), ":" | ",") {
                    return Err(
                        self.error("slices and multidimensional indices are not implemented")
                    );
                }
                self.expect("]")?;
                left = V::index(left, index).map_err(|message| self.error(message))?;
                self.account_expression()?;
                if V::height(&left) > 128 {
                    return Err(self.error("experimental expression tree depth exceeds 128"));
                }
                continue;
            }
            if V::DYNAMIC {
                let logical = match self.text() {
                    "or" => Some((1, false)),
                    "and" => Some((2, true)),
                    _ => None,
                };
                if let Some((precedence, and)) = logical {
                    if precedence < minimum {
                        break;
                    }
                    self.advance();
                    let right = self.expression(precedence + 1, depth + 1)?;
                    left = V::logical(and, left, right).map_err(|message| self.error(message))?;
                    self.account_expression()?;
                    if V::height(&left) > 128 {
                        return Err(self.error("experimental expression tree depth exceeds 128"));
                    }
                    continue;
                }
                if self.comparison().is_some() {
                    if 4 < minimum {
                        break;
                    }
                    let mut rest = Vec::new();
                    while let Some(comparison) = self.comparison() {
                        if rest.len() >= dynamic::MAX_CHAIN_COMPARISONS {
                            return Err(self.error("comparison chain exceeds 128 comparisons"));
                        }
                        self.advance();
                        self.account_expression()?;
                        rest.push((comparison, self.expression(5, depth + 1)?));
                    }
                    left =
                        V::comparison_chain(left, rest).map_err(|message| self.error(message))?;
                    if V::height(&left) > 128 {
                        return Err(self.error("experimental expression tree depth exceeds 128"));
                    }
                    continue;
                }
            }
            if V::DYNAMIC && matches!(self.text(), "//" | "%") {
                if 6 < minimum {
                    break;
                }
                let remainder = self.text() == "%";
                self.advance();
                let right = self.expression(7, depth + 1)?;
                left = V::divrem(remainder, left, right).map_err(|message| self.error(message))?;
                if V::height(&left) > 128 {
                    return Err(self.error("experimental expression tree depth exceeds 128"));
                }
                self.account_expression()?;
                continue;
            }
            let (precedence, operator) = match self.text() {
                "+" => (5, Binary::Add),
                "-" => (5, Binary::Subtract),
                "*" => (6, Binary::Multiply),
                _ => break,
            };
            if precedence < minimum {
                break;
            }
            self.advance();
            let right = self.expression(precedence + 1, depth + 1)?;
            left = V::binary(operator, left, right);
            if V::height(&left) > 128 {
                return Err(self.error("experimental expression tree depth exceeds 128"));
            }
            self.account_expression()?;
        }
        if V::height(&left) > 128 {
            return Err(self.error("experimental expression tree depth exceeds 128"));
        }
        Ok(left)
    }
    fn function_call(&mut self, name: &str, depth: usize) -> Parsed<V::Expression> {
        if self.locals.contains_key(name) {
            return Err(self.error("calling local values or parameters is unsupported; function values remain unimplemented"));
        }
        let (index, arity) = self.function_signatures.get(name).copied().ok_or_else(|| self.error("unknown function; this slice supports self-recursion and earlier top-level definitions only"))?;
        self.advance();
        self.expect("(")?;
        let mut arguments = Vec::new();
        if self.text() != ")" {
            loop {
                if arguments.len() >= MAX_LOCALS {
                    return Err(self.error("experimental call argument limit of 128 exceeded"));
                }
                arguments.push(self.expression(0, depth + 1)?);
                if !self.take(",") || self.text() == ")" {
                    break;
                }
            }
        }
        self.expect(")")?;
        if arguments.len() != arity {
            return Err(self.error(format!(
                "function requires {arity} positional arguments; received {}",
                arguments.len()
            )));
        }
        V::call(index, arguments).map_err(|message| self.error(message))
    }
}

fn reserved(name: &str) -> bool {
    matches!(
        name,
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
            | "print"
            | "i64"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    const IMPORT: &str = "from naja.core import i64\n";
    #[test]
    fn compile_loops_branches_and_precedence() {
        let source = format!(
            "{IMPORT}n: i64 = i64(0)\ns: i64 = i64(0)\nwhile n < i64(10):\n    s = s + n * i64(2)\n    n = n + i64(1)\nif s == i64(90):\n    print(s)\nelse:\n    print(i64(-1))\n"
        );
        assert!(compile(&source).unwrap().starts_with(b"\x7fELF"));
    }
    #[test]
    fn reject_hosted_integer_narrowing_unsupported_features_and_bad_scopes() {
        for body in [
            "x = 1\n",
            "print(1)\n",
            "x: i64 = 1\n",
            "print(9223372036854775807 + 1)\n",
            "print(i64(9223372036854775808))\n",
            "print(i64(1) // i64(2))\n",
            "x: int = 1\n",
            "print(9223372036854775808)\n",
            "print(1 // 2)\n",
            "print(1 < 2)\n",
            "x: i64 = x\n",
            "if 1 < 2:\n    x: i64 = 1\n",
            "print(1); print(2)\n",
            "print(True)\n",
            "print(1.5)\n",
            "print('value')\n",
            "while 1 < 2:(0)\n    print(1)\n",
            "print(1)\nfrom naja.core import i64\n",
        ] {
            assert!(compile(&format!("{IMPORT}{body}")).is_err(), "{body}");
        }
        assert!(compile("print(True)\n").is_ok());
        assert!(compile("print(1.5)\n").is_err());
    }
    #[test]
    fn accept_minimum_integer_and_standard_same_line_suite() {
        assert!(
            compile(&format!(
                "{IMPORT}x: i64 = i64(-9223372036854775808)\nif x < i64(0): print(x)\n"
            ))
            .is_ok()
        );
    }
    #[test]
    fn comments_crlf_and_parenthesized_multiline_have_same_binary() {
        let a = compile(&format!(
            "{IMPORT}x: i64 = i64(1) + i64(2) * i64(3)\nprint(x)\n"
        ))
        .unwrap();
        let b = compile("# %%\r\nfrom naja.core import i64\r\nx: i64 = (i64(1) +\r\n    i64(2) * i64(3)) # preserved by frontend\r\nprint(x)\r\n").unwrap();
        assert_eq!(a, b);
    }
    #[test]
    fn same_line_suites_count_toward_depth_and_statement_limits() {
        let mut source = IMPORT.to_owned();
        for depth in 0..65 {
            source.push_str(&"    ".repeat(depth));
            source.push_str("if i64(0) < i64(1):");
            if depth == 64 {
                source.push_str(" print(i64(1))\n");
            } else {
                source.push('\n');
            }
        }
        assert!(
            check(&source).unwrap_err()[0]
                .message
                .contains("64 suite levels")
        );
        let many = format!(
            "{IMPORT}{}",
            "if i64(0) < i64(1): print(i64(0))\n".repeat(5_001)
        );
        assert!(
            check(&many).unwrap_err()[0]
                .message
                .contains("10000 statements")
        );
    }
    #[test]
    fn block_styles_preserve_machine_code_and_transparent_names() {
        let indentation = format!(
            "{IMPORT}x: i64 = i64(0)\nwhile x < i64(3):\n    x = x + i64(1)\nif x == i64(3):\n    print(x)\nelse:\n    print(i64(-1))\n"
        );
        let braces = format!(
            "{IMPORT}{{# State #\nx: i64 = i64(0)\n}}\nwhile x < i64(3): {{# Increment #\nx = x + i64(1)\n}}\nif x == i64(3): {{\nprint(x)\n}} else: {{\nprint(i64(-1))\n}}\n"
        );
        let markers = format!(
            "{IMPORT}x: i64 = i64(0)\nwhile x < i64(3):(0)\n    x = x + i64(1)\nif x == i64(3):(0)\n    print(x)\nelse:(0)\n    print(i64(-1))\n"
        );
        let expected = compile(&indentation).unwrap();
        for source in [&braces, &markers] {
            assert_eq!(
                compile_with_dialect(source, Dialect::Naja2026).unwrap(),
                expected
            );
            assert!(compile(source).is_err(), "NAJA additions leaked into .py");
        }
    }
    #[test]
    fn sections_preserve_control_scope_and_enforce_resource_limits() {
        let source =
            format!("{IMPORT}{{# Outer #\n{{# Inner #\nx: i64 = i64(2)\n}}\n}}\nprint(x)\n");
        assert_eq!(
            compile_with_dialect(&source, Dialect::Naja2026).unwrap(),
            compile(&format!("{IMPORT}x: i64 = i64(2)\nprint(x)\n")).unwrap()
        );
        let inside_control =
            format!("{IMPORT}if i64(1) == i64(1): {{\n{{# Same scope #\nx: i64 = i64(2)\n}}\n}}\n");
        assert!(
            check_with_dialect(&inside_control, Dialect::Naja2026).unwrap_err()[0]
                .message
                .contains("top level")
        );
        let too_deep = format!(
            "{IMPORT}{}print(i64(1))\n{}",
            "{# Layer #\n".repeat(65),
            "}\n".repeat(65)
        );
        assert!(
            check_with_dialect(&too_deep, Dialect::Naja2026).unwrap_err()[0]
                .message
                .contains("64")
        );
    }
    #[test]
    fn depth_markers_check_nesting_and_reject_combined_decorations() {
        let correct = format!(
            "{IMPORT}if i64(1) == i64(1):(0)\n    if i64(2) > i64(1):(1)\n        print(i64(2))\n"
        );
        assert!(check_with_dialect(&correct, Dialect::Naja2026).is_ok());
        for body in [
            "if i64(1) == i64(1):(1)\n    print(i64(2))\n",
            "if i64(1) == i64(1):(0) {\nprint(i64(2))\n}\n",
            "if i64(1) == i64(1): {# Label # print(i64(2))\n}\n",
            "if i64(1) == i64(1): {\nprint(i64(2))\n",
            "{# Missing terminator\nprint(i64(2))\n}\n",
        ] {
            assert!(
                check_with_dialect(&format!("{IMPORT}{body}"), Dialect::Naja2026).is_err(),
                "{body}"
            );
        }
    }
    #[test]
    fn adjacent_closers_leave_parent_indentation_dedent_owned_by_parent() {
        let mixed = format!(
            "{IMPORT}if i64(1) == i64(1): {{\n    if i64(1) == i64(1):\n        if i64(1) == i64(1): {{\nprint(i64(7))\n}}}}\n"
        );
        let indented = format!(
            "{IMPORT}if i64(1) == i64(1):\n    if i64(1) == i64(1):\n        if i64(1) == i64(1):\n            print(i64(7))\n"
        );
        assert_eq!(
            compile_with_dialect(&mixed, Dialect::Naja2026).unwrap(),
            compile(&indented).unwrap()
        );
    }
    #[test]
    fn hosted_parser_retains_all_decimal_digits_and_uses_shared_suites() {
        let digits = "12345678901234567890123456789012345678901234567890";
        let source = format!(
            "{{# State #\nx = {digits}\n}}\nwhile x < {digits} + 3:(0)\n    x = x + 1\nprint(x)\n"
        );
        let ir = check_hosted(&source, Dialect::Naja2026).unwrap();
        let hosted::Statement::Group(body) = &ir[0] else {
            panic!("expected transparent group")
        };
        let hosted::Statement::Assign(0, hosted::Expression::Integer(value)) = &body[0] else {
            panic!("expected hosted declaration")
        };
        assert_eq!(value, digits);
        assert!(check_hosted(&source, Dialect::Python).is_err());
        assert!(check_hosted("x: int = 1_000_000\nprint(-x * (2 + 3))\n", Dialect::Python).is_ok());
    }
    #[test]
    fn hosted_definite_initialization_requires_each_control_path() {
        let both =
            "if 1 == 1:\n    x = 123456789012345678901234567890\nelse:\n    x = 0\nprint(x)\n";
        assert!(check_hosted(both, Dialect::Python).is_ok());
        for source in [
            "if 1 == 2:\n    x = 3\nprint(x)\n",
            "while 1 == 2:\n    x = 3\nprint(x)\n",
            "x = x + 1\n",
            "x = 0xff\n",
            "x = i64(1)\n",
        ] {
            assert!(check_hosted(source, Dialect::Python).is_err(), "{source}");
        }
        assert!(
            check_hosted(
                "x = 0\nwhile x < 3:\n    x = x + 1\nprint(x)\n",
                Dialect::Python
            )
            .is_ok()
        );
        let source = "if 1 == 2:\n    x = 3\nprint(x)\n";
        let error = &check_hosted(source, Dialect::Python).unwrap_err()[0];
        assert_eq!(error.code, "NJA101");
        assert_eq!(&source[error.span.start..error.span.end], "x");
        assert_eq!(error.span.start, source.rfind('x').unwrap());
    }
    #[test]
    fn unicode_symbols_use_nfkc_keys_and_preserve_raw_keyword_rules() {
        for dialect in [Dialect::Python, Dialect::Naja2026] {
            let unicode =
                "变量 = 123456789012345678901234567890\nＫ = 变量\nK = K + 1\nｐｒｉｎｔ(Ｋ)\n";
            let ascii = "value = 123456789012345678901234567890\nother = value\nother = other + 1\nprint(other)\n";
            assert_eq!(
                compile_with_dialect(unicode, dialect).unwrap(),
                compile_with_dialect(ascii, dialect).unwrap()
            );
            assert_eq!(
                compile_with_dialect("ｉｆ = 7\nprint(ｉｆ)\n", dialect).unwrap(),
                compile_with_dialect("x = 7\nprint(x)\n", dialect).unwrap()
            );
            let fixed = "from ｎａｊａ.ｃｏｒｅ import ｉ６４\n变量: ｉ６４ = ｉ６４(7)\nｐｒｉｎｔ(变量)\n";
            assert_eq!(
                compile_with_dialect(fixed, dialect).unwrap(),
                compile(&format!("{IMPORT}x: i64 = i64(7)\nprint(x)\n")).unwrap()
            );
        }
        let collision = "from naja.core import i64\nＫ: i64 = i64(1)\nK: i64 = i64(2)\n";
        let error = &check(collision).unwrap_err()[0];
        assert!(error.message.contains("canonical Unicode"));
        assert_eq!(&collision[error.span.start..error.span.end], "K");
    }
    #[test]
    fn dynamic_source_bounds_and_unsupported_syntax_retain_original_spans() {
        for source in [
            "print(True)\nprint(None)\nprint(+(True and 7))\n",
            "value = b'bytes'\nprint(len(value))\n",
            "if not 1 > 2 and 'yes': assert 1 < 2 <= 3\n",
            "x: int = 'informational'\nprint(x)\n",
        ] {
            assert!(compile(source).is_ok(), "{source}");
        }
        for source in [
            "print(1 < not True)\n",
            "print(-not True)\n",
            "print('a' 'b')\n",
            "print(len())\n",
            "print(len('a', 'b'))\n",
            "x: str = 'unsupported annotation'\n",
        ] {
            assert!(compile(source).is_err(), "{source}");
        }
        let chain = format!("print({})\n", vec!["1"; 130].join(" < "));
        assert!(
            check(&chain).unwrap_err()[0]
                .message
                .contains("128 comparisons")
        );
        let source = "变量 = 'text'\nprint(变量 + missing_name)\n";
        let error = &check(source).unwrap_err()[0];
        assert_eq!(&source[error.span.start..error.span.end], "missing_name");
    }
    #[test]
    fn contextual_aliases_preserve_bindings_data_and_canonical_operations() {
        let table = naja_frontend::parse_aliases("[operators]\n\"<\" = \"lessThan\"\n[builtins]\n\"print\" = \"display\"\n\"len\" = \"length\"\n", naja_frontend::AliasEnvironment { edition: "2026.1", policy: "synthetic compiler test" }).unwrap();
        let aliased = "lessThan = 7\ndisplay(length('é🌍'))\ndisplay(1 lessThan 2 < 3)\ndisplay(lessThan)\nprint('display lessThan')\n";
        let conventional = "lessThan = 7\nprint(len('é🌍'))\nprint(1 < 2 < 3)\nprint(lessThan)\nprint('display lessThan')\n";
        assert_eq!(
            compile_with_aliases(aliased, Dialect::Naja2026, Some(&table)).unwrap(),
            compile_with_dialect(conventional, Dialect::Naja2026).unwrap()
        );
        assert!(
            compile_with_aliases(
                "display = 7\nprint(display)\n",
                Dialect::Naja2026,
                Some(&table)
            )
            .is_ok()
        );
        assert!(
            compile_with_aliases("display = 7\ndisplay(9)\n", Dialect::Naja2026, Some(&table))
                .is_err()
        );
        assert!(compile_with_aliases("print(1)\n", Dialect::Python, Some(&table)).is_err());
        assert!(compile_with_dialect(aliased, Dialect::Naja2026).is_err());
        assert!(
            compile_with_dialect("int = 7\nx: int = 1\n", Dialect::Naja2026).unwrap_err()[0]
                .message
                .contains("shadows")
        );
        assert!(compile("int = 7\nx: int = 'informational'\nprint(x)\n").is_ok());
    }
    #[test]
    fn ordinary_divrem_is_shared_and_fixed_domain_stays_explicit() {
        for dialect in [Dialect::Python, Dialect::Naja2026] {
            assert!(compile_with_dialect("print(-7 // 3 % 2 * 4 + 1)\n", dialect).is_ok());
            assert!(compile_with_dialect("print(1 / 2)\n", dialect).is_err());
            assert!(compile_with_dialect("print(1 // not True)\n", dialect).is_err());
            for op in ["//", "%"] {
                let source = format!("from naja.core import i64\nprint(i64(7) {op} i64(3))\n");
                assert!(compile_with_dialect(&source, dialect).is_err());
            }
        }
    }
    #[test]
    fn native_functions_share_suites_and_flow_initialization() {
        let indented = "def choose(flag):\n    if flag:\n        return 1\n    else:\n        value = 2\n    return value\nprint(choose(False))\n";
        let braces = "def choose(flag): {\nif flag: {\nreturn 1\n} else: {\nvalue = 2\n}\nreturn value\n}\nprint(choose(False))\n";
        let expected = compile(indented).unwrap();
        assert_eq!(
            expected,
            compile_with_dialect(braces, Dialect::Naja2026).unwrap()
        );
        let CheckedProgram::HostedValues(program) = check(indented).unwrap() else {
            panic!()
        };
        assert_eq!(program.functions.len(), 1);
        assert_eq!(program.functions[0].parameters, 1);
        for source in [
            "def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\nprint(fact(20))\n",
            "def empty():\n    pass\n",
            "def empty():\n    return\nempty()\n",
            "def identity(é,):\n    return é\nprint(identity(7,))\n",
        ] {
            assert!(compile(source).is_ok(), "{source}");
        }
    }
    #[test]
    fn unsupported_function_bindings_are_rejected_without_execution() {
        for source in [
            "return 1\n",
            "def f(x=1):\n    return x\n",
            "def f(x: int):\n    return x\n",
            "def f():\n    def g():\n        return 1\n    return 0\n",
            "def f():\n    return g()\ndef g():\n    return 1\nprint(f())\n",
            "def f():\n    return 1\nf = 7\n",
            "x = 7\ndef f():\n    return x\nprint(f())\n",
            "def f(x):\n    return x\nprint(f())\n",
            "def f():\n    print(len('x'))\n    len = 7\nprint(f())\n",
            "def f():\n    return len('x')\nlen = 7\nprint(f())\n",
            "def f():\n    return len('x')\ndef len(x):\n    return 7\nprint(f())\n",
            "len = 7\ndef f():\n    return len('x')\nprint(f())\n",
            "def f(é, ｅ́):\n    return 1\n",
            "def f(flag):\n    if flag:\n        value = 1\n    return value\nprint(f(False))\n",
        ] {
            assert!(compile(source).is_err(), "{source}");
        }
    }
    #[test]
    fn postfix_indexing_is_shared_bounded_and_distinct_from_slices() {
        for dialect in [Dialect::Python, Dialect::Naja2026] {
            for source in [
                "print(('é𝄞' + 'x')[1][0])\n",
                "def value(): return b'\\xff'\nprint(value()[False] // 10)\n",
                "print(False and 'x'[999])\n",
            ] {
                assert!(compile_with_dialect(source, dialect).is_ok(), "{source}");
            }
            for source in [
                "print('x'[:])\n",
                "print('x'[0:1])\n",
                "print('x'[0, 1])\n",
                "print('x'[])\n",
            ] {
                assert!(compile_with_dialect(source, dialect).is_err(), "{source}");
            }
        }
        let at_limit = format!("print('x'{})\n", "[0]".repeat(127));
        let over_limit = format!("print('x'{})\n", "[0]".repeat(128));
        assert!(compile(&at_limit).is_ok());
        assert!(compile(&over_limit).is_err());
    }
    #[test]
    fn tuples_preserve_grouping_and_argument_separator_ownership() {
        for dialect in [Dialect::Python, Dialect::Naja2026] {
            for source in [
                "empty = ()\nassert not empty\nprint(len(empty))\n",
                "one = (True,)\nprint(one[0])\n",
                "pair = (1, ('é', b'\\xff'),)\nprint(pair[1][-1])\n",
                "def pair(a, b): return (a, b)\nprint(pair((1, 2), (3,))[0][1])\n",
                "def identity(value): return value\nprint(identity((7,))[0])\n",
                "print((1, 2))\n", // Display is a runtime type error in this partial slice.
            ] {
                assert!(compile_with_dialect(source, dialect).is_ok(), "{source}");
            }
            for source in [
                "values = 1, 2\n",
                "a, b = (1, 2)\n",
                "values = (*(),)\n",
                "values = (,1)\n",
                "values = (1,,2)\n",
                "print((1, 2)[0, 1])\n",
                "print(tuple())\n",
                "def f(a, b): return a\nprint(f((1, 2)))\n",
            ] {
                assert!(compile_with_dialect(source, dialect).is_err(), "{source}");
            }
        }
        assert_eq!(
            compile("print((7))\n").unwrap(),
            compile("print(7)\n").unwrap()
        );
        assert!(compile(&format!("{IMPORT}value: i64 = ()\n")).is_err());
        assert!(compile(&format!("{IMPORT}value: i64 = (i64(1),)\n")).is_err());
    }
    #[test]
    fn tuple_source_elements_and_tree_height_keep_existing_bounds() {
        for (count, accepted) in [(128, true), (129, false)] {
            let source = format!("values = ({})\n", "0,".repeat(count));
            let result = compile(&source);
            assert_eq!(result.is_ok(), accepted, "{count}: {result:?}");
            if !accepted {
                assert!(result.unwrap_err()[0].message.contains("128"));
            }
        }
        let nested = |layers| format!("value = {}0{}\n", "(".repeat(layers), ",)".repeat(layers));
        assert!(compile(&nested(127)).is_ok());
        assert!(
            compile(&nested(128)).unwrap_err()[0]
                .message
                .contains("128")
        );
        assert!(compile("values = (0, missing)\n").is_err());
    }
}
