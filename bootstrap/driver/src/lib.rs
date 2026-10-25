//! Shared bounded executable parser with distinct checked-i64 and hosted domains.
use naja_frontend::{
    Diagnostic, Dialect, Lexed, Span, Token, TokenKind, canonical_identifier, lex_with_dialect,
};
use naja_native::{Binary, Comparison, MAX_LOCALS, Statement, hosted};
use std::collections::{BTreeMap, BTreeSet};
use std::marker::PhantomData;
mod values;
use values::{Fixed, Hosted, Values};

/// Reject unsupported syntax instead of executing a foreign runtime or narrowing int.
pub fn compile(source: &str) -> Result<Vec<u8>, Vec<Diagnostic>> {
    compile_with_dialect(source, Dialect::Python)
}

pub fn compile_with_dialect(source: &str, dialect: Dialect) -> Result<Vec<u8>, Vec<Diagnostic>> {
    let result = match check_with_dialect(source, dialect)? {
        CheckedProgram::FixedI64(statements) => naja_native::emit_elf(&statements),
        CheckedProgram::HostedIntegers(statements) => hosted::emit_elf(&statements),
    };
    result.map_err(|message| {
        vec![Diagnostic {
            code: "NJA200",
            message,
            span: Span::new(0, 0),
        }]
    })
}

#[derive(Debug)]
pub enum CheckedProgram {
    FixedI64(Vec<Statement>),
    HostedIntegers(Vec<hosted::Statement>),
}

pub fn check(source: &str) -> Result<CheckedProgram, Vec<Diagnostic>> {
    check_with_dialect(source, Dialect::Python)
}

pub fn check_with_dialect(
    source: &str,
    dialect: Dialect,
) -> Result<CheckedProgram, Vec<Diagnostic>> {
    let lexed = checked_lex(source, dialect)?;
    // The temporary checked-i64 slice retains its explicit initial import.
    // No import or annotation narrows an ordinary hosted literal to i64.
    if lexed
        .significant_tokens()
        .next()
        .is_some_and(|token| lexed.text(token) == "from")
    {
        parse_lexed::<Fixed>(lexed, dialect).map(CheckedProgram::FixedI64)
    } else {
        let statements = parse_lexed::<Hosted>(lexed, dialect)?;
        validate_hosted(&statements)?;
        Ok(CheckedProgram::HostedIntegers(statements))
    }
}

/// Check the hosted integer domain explicitly through the shared parser.
pub fn check_hosted(
    source: &str,
    dialect: Dialect,
) -> Result<Vec<hosted::Statement>, Vec<Diagnostic>> {
    let statements = parse_values::<Hosted>(source, dialect)?;
    validate_hosted(&statements)?;
    Ok(statements)
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
    parse_lexed::<V>(checked_lex(source, dialect)?, dialect)
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
) -> Result<Vec<V::Statement>, Vec<Diagnostic>> {
    let tokens = lexed.significant_tokens().cloned().collect();
    let mut parser = Parser::<V> {
        lexed,
        tokens,
        cursor: 0,
        locals: BTreeMap::new(),
        initialized: BTreeSet::new(),
        imported_i64: false,
        nodes: 0,
        dialect,
        structural_depth: 0,
        values: PhantomData,
    };
    parser.program().map_err(|diagnostic| vec![diagnostic])
}

struct Parser<V: Values> {
    lexed: Lexed,
    tokens: Vec<Token>,
    cursor: usize,
    locals: BTreeMap<String, usize>,
    initialized: BTreeSet<usize>,
    imported_i64: bool,
    nodes: usize,
    dialect: Dialect,
    structural_depth: usize,
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
    fn program(&mut self) -> Parsed<Vec<V::Statement>> {
        let mut statements = Vec::new();
        while self.token().kind != TokenKind::EndOfFile {
            if self.token().kind == TokenKind::Newline {
                self.advance();
                continue;
            }
            if self.text() == "from" {
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
        if statements.is_empty() {
            return Err(self.error(
                "expected an executable statement; the native spike does not emit empty programs",
            ));
        }
        Ok(statements)
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
        if self.take("assert") {
            let condition = self.condition()?;
            self.newline()?;
            return Ok(V::assertion(condition));
        }
        if self.take("while") {
            let condition = self.condition()?;
            let initialized = self.initialized.clone();
            let body = self.suite(depth + 1)?;
            // A loop may execute zero times. New symbols retain their slots,
            // while only values initialized on entry are definite afterward.
            self.initialized = initialized;
            if self.text() == "else" {
                return Err(self.error("while-else is not implemented in this native spike"));
            }
            return Ok(V::while_loop(condition, body));
        }
        if self.take("if") {
            let condition = self.condition()?;
            let initialized = self.initialized.clone();
            let yes = self.suite(depth + 1)?;
            let yes_initialized = self.initialized.clone();
            self.initialized = initialized;
            let no = if self.take("else") {
                self.suite(depth + 1)?
            } else {
                Vec::new()
            };
            self.initialized = yes_initialized
                .intersection(&self.initialized)
                .copied()
                .collect();
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
        if self.take_binding("print") {
            self.expect("(")?;
            let value = self.expression(0, 0)?;
            self.expect(")")?;
            self.newline()?;
            return Ok(V::print(value));
        }
        if self.token().kind != TokenKind::Identifier || self.reserved_name() {
            return Err(self.error("unsupported statement in the experimental executable subset"));
        }
        let name_span = self.token().span;
        let name = self.canonical_name()?;
        self.advance();
        let declared = self.take(":");
        let creates = declared || (V::HOSTED && !self.locals.contains_key(&name));
        let slot = if creates {
            if !V::HOSTED && depth != 0 {
                return Err(self.error("this native spike requires local declarations at top level for definite initialization"));
            }
            if declared {
                self.expect_binding(if V::HOSTED { "int" } else { "i64" })?;
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
        let value = self.expression(0, 0)?;
        self.newline()?;
        if creates {
            self.locals.insert(name, slot);
        }
        self.initialized.insert(slot);
        Ok(V::assign(slot, value))
    }
    fn condition(&mut self) -> Parsed<V::Condition> {
        let left = self.expression(0, 0)?;
        let comparison = match self.text() {
            "==" => Comparison::Equal,
            "!=" => Comparison::NotEqual,
            "<" => Comparison::Less,
            "<=" => Comparison::LessEqual,
            ">" => Comparison::Greater,
            ">=" => Comparison::GreaterEqual,
            _ => {
                return Err(self.error(
                    "this native spike requires one explicit comparison in each condition",
                ));
            }
        };
        self.advance();
        let right = self.expression(0, 0)?;
        Ok(V::condition(left, comparison, right))
    }
    fn expression(&mut self, minimum: u8, depth: usize) -> Parsed<V::Expression> {
        if depth > 128 {
            return Err(self.error("experimental expression nesting exceeds 128"));
        }
        let mut left = if self.take("-") {
            V::negate(self.expression(3, depth + 1)?)
        } else if self.take("+") {
            self.expression(3, depth + 1)?
        } else if self.take("(") {
            let value = self.expression(0, depth + 1)?;
            self.expect(")")?;
            value
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
            let slot = *self.locals.get(&name).ok_or_else(|| {
                self.error("undefined or uninitialized name in the experimental executable subset")
            })?;
            if !self.initialized.contains(&slot) {
                return Err(self.error(
                    "name is not definitely initialized on every path in this executable slice",
                ));
            }
            self.advance();
            V::local(slot)
        } else {
            return Err(self.error(if V::HOSTED {
                "unsupported expression in the hosted integer slice"
            } else {
                "unsupported expression; this checked-i64 slice requires explicit i64 values"
            }));
        };
        loop {
            let (precedence, operator) = match self.text() {
                "+" => (1, Binary::Add),
                "-" => (1, Binary::Subtract),
                "*" => (2, Binary::Multiply),
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
            self.nodes += 1;
            if self.nodes > 10_000 {
                return Err(self.error("experimental expression operation limit exceeded"));
            }
        }
        if V::height(&left) > 128 {
            return Err(self.error("experimental expression tree depth exceeds 128"));
        }
        Ok(left)
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
        assert!(compile("print(True)\n").is_err());
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
}
