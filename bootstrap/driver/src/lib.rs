//! Bounded experimental seed frontend for explicitly imported checked i64.
use naja_frontend::{Diagnostic, Dialect, Lexed, Span, Token, TokenKind, lex_with_dialect};
use naja_native::{Binary, Comparison, Condition, Expression, MAX_LOCALS, Statement};
use std::collections::BTreeMap;

/// Reject unsupported syntax instead of executing a foreign runtime or narrowing int.
pub fn compile(source: &str) -> Result<Vec<u8>, Vec<Diagnostic>> {
    compile_with_dialect(source, Dialect::Python)
}

pub fn compile_with_dialect(source: &str, dialect: Dialect) -> Result<Vec<u8>, Vec<Diagnostic>> {
    let statements = check_with_dialect(source, dialect)?;
    naja_native::emit_elf(&statements).map_err(|message| {
        vec![Diagnostic {
            code: "NJA200",
            message,
            span: Span::new(0, 0),
        }]
    })
}

pub fn check(source: &str) -> Result<Vec<Statement>, Vec<Diagnostic>> {
    check_with_dialect(source, Dialect::Python)
}

pub fn check_with_dialect(
    source: &str,
    dialect: Dialect,
) -> Result<Vec<Statement>, Vec<Diagnostic>> {
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
    let tokens = lexed.significant_tokens().cloned().collect();
    let mut parser = Parser {
        lexed,
        tokens,
        cursor: 0,
        locals: BTreeMap::new(),
        imported_i64: false,
        nodes: 0,
        dialect,
        structural_depth: 0,
    };
    parser.program().map_err(|diagnostic| vec![diagnostic])
}

struct Parser {
    lexed: Lexed,
    tokens: Vec<Token>,
    cursor: usize,
    locals: BTreeMap<String, usize>,
    imported_i64: bool,
    nodes: usize,
    dialect: Dialect,
    structural_depth: usize,
}

type Parsed<T> = Result<T, Diagnostic>;

impl Parser {
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
            Err(self.error(format!("expected '{value}' in the experimental i64 subset")))
        }
    }
    fn newline(&mut self) -> Parsed<()> {
        if self.token().kind == TokenKind::Newline {
            self.advance();
            Ok(())
        } else {
            Err(self.error("expected end of logical line; extra syntax is unsupported"))
        }
    }
    fn program(&mut self) -> Parsed<Vec<Statement>> {
        let mut statements = Vec::new();
        while self.token().kind != TokenKind::EndOfFile {
            if self.token().kind == TokenKind::Newline {
                self.advance();
                continue;
            }
            if self.text() == "from" {
                if self.imported_i64 || !statements.is_empty() {
                    return Err(self.error(
                        "the experimental i64 import must appear once before executable statements",
                    ));
                }
                for word in ["from", "naja", ".", "core", "import", "i64"] {
                    self.expect(word)?;
                }
                self.newline()?;
                self.imported_i64 = true;
            } else {
                if !self.imported_i64 {
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
    fn statement(&mut self, depth: usize) -> Parsed<Statement> {
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
    fn statement_after_accounting(&mut self, depth: usize) -> Parsed<Statement> {
        if self.token().kind == TokenKind::SuiteOpen {
            return self.brace_suite(depth, true).map(Statement::Group);
        }
        if self.take("while") {
            let condition = self.condition()?;
            let body = self.suite(depth + 1)?;
            if self.text() == "else" {
                return Err(self.error("while-else is not implemented in this native spike"));
            }
            return Ok(Statement::While(condition, body));
        }
        if self.take("if") {
            let condition = self.condition()?;
            let yes = self.suite(depth + 1)?;
            let no = if self.take("else") {
                self.suite(depth + 1)?
            } else {
                Vec::new()
            };
            if self.text() == "elif" {
                return Err(self.error(
                    "elif is not implemented in this native spike; full grammar remains open",
                ));
            }
            return Ok(Statement::If(condition, yes, no));
        }
        self.simple(depth)
    }
    fn suite(&mut self, depth: usize) -> Parsed<Vec<Statement>> {
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
    fn brace_suite(&mut self, depth: usize, named: bool) -> Parsed<Vec<Statement>> {
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
    fn indented_or_simple_suite(&mut self, depth: usize) -> Parsed<Vec<Statement>> {
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
    fn simple(&mut self, depth: usize) -> Parsed<Statement> {
        if self.take("print") {
            self.expect("(")?;
            let value = self.expression(0, 0)?;
            self.expect(")")?;
            self.newline()?;
            return Ok(Statement::Print(value));
        }
        if self.token().kind != TokenKind::Identifier || reserved(self.text()) {
            return Err(self.error("unsupported statement in the experimental i64 subset"));
        }
        let name = self.text().to_owned();
        self.advance();
        let declared = self.take(":");
        let slot = if declared {
            if depth != 0 {
                return Err(self.error("this native spike requires local declarations at top level for definite initialization"));
            }
            self.expect("i64")?;
            if self.locals.contains_key(&name) {
                return Err(self.error("duplicate i64 declaration"));
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
        if declared {
            self.locals.insert(name, slot);
        }
        Ok(Statement::Assign(slot, value))
    }
    fn condition(&mut self) -> Parsed<Condition> {
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
        Ok(Condition {
            left,
            comparison,
            right,
        })
    }
    fn expression(&mut self, minimum: u8, depth: usize) -> Parsed<Expression> {
        if depth > 128 {
            return Err(self.error("experimental expression nesting exceeds 128"));
        }
        let mut left = if self.take("-") {
            Expression::Negate(Box::new(self.expression(3, depth + 1)?))
        } else if self.take("+") {
            self.expression(3, depth + 1)?
        } else if self.take("(") {
            let value = self.expression(0, depth + 1)?;
            self.expect(")")?;
            value
        } else if self.take("i64") {
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
            let value = signed.parse::<i64>().map_err(|_| self.error("literal is outside explicit i64 range; hosted arbitrary-precision int is not implemented"))?;
            self.advance();
            self.expect(")")?;
            Expression::Integer(value)
        } else if self.token().kind == TokenKind::Integer {
            return Err(self.error("hosted integer expressions are not implemented; use an explicit i64(decimal_literal) constructor for this fixed-width spike"));
        } else if self.token().kind == TokenKind::Identifier && !reserved(self.text()) {
            let slot = *self.locals.get(self.text()).ok_or_else(|| {
                self.error("undefined or uninitialized name in the experimental i64 subset")
            })?;
            self.advance();
            Expression::Local(slot)
        } else {
            return Err(self.error(
                "unsupported expression; this native spike executes explicit i64 values only",
            ));
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
            left = Expression::Binary(operator, Box::new(left), Box::new(right));
            if expression_height(&left) > 128 {
                return Err(self.error("experimental expression tree depth exceeds 128"));
            }
            self.nodes += 1;
            if self.nodes > 10_000 {
                return Err(self.error("experimental expression operation limit exceeded"));
            }
        }
        if expression_height(&left) > 128 {
            return Err(self.error("experimental expression tree depth exceeds 128"));
        }
        Ok(left)
    }
}

fn expression_height(value: &Expression) -> usize {
    match value {
        Expression::Integer(_) | Expression::Local(_) => 1,
        Expression::Negate(inner) => 1 + expression_height(inner),
        Expression::Binary(_, left, right) => {
            1 + expression_height(left).max(expression_height(right))
        }
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
        assert!(compile("print(123456789012345678901234567890)\n").is_err());
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
}
