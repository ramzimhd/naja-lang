use naja_frontend::{
    Dialect, Lexed, Span, SuiteKind, Symbol, TokenKind, lex, lex_with_dialect, parse_cst,
    parse_cst_with_dialect,
};

fn naja(source: &str) -> Lexed {
    let lexed = lex_with_dialect(source, Dialect::Naja2026);
    assert_eq!(lexed.reconstruct(), source);
    let mut end = 0;
    for token in &lexed.tokens {
        assert_eq!(
            token.span.start, end,
            "Uncovered or duplicated source byte: {token:?}"
        );
        assert!(source.is_char_boundary(token.span.start));
        assert!(source.is_char_boundary(token.span.end));
        end = token.span.end;
    }
    assert_eq!(end, source.len());
    lexed
}

fn valid(source: &str) -> Lexed {
    let lexed = naja(source);
    assert!(
        lexed.diagnostics.is_empty(),
        "{source:?}: {:?}",
        lexed.diagnostics
    );
    lexed
}

fn kinds(source: &str) -> Vec<TokenKind> {
    valid(source)
        .significant_tokens()
        .map(|token| token.kind)
        .collect()
}

fn indentation(source: &str) -> Vec<TokenKind> {
    kinds(source)
        .into_iter()
        .filter(|kind| matches!(kind, TokenKind::Indent | TokenKind::Dedent))
        .collect()
}

#[test]
fn explicit_python_dialect_preserves_both_legacy_entry_points() {
    for source in [
        "if x: {\n    1\n}\n",
        "{# label #\nx = 1\n}\n",
        "if x:(0)\n    value()\n",
        "value = {'name': 'NAJA'}\n",
    ] {
        assert_eq!(lex(source), lex_with_dialect(source, Dialect::Python));
        assert_eq!(
            parse_cst(source),
            parse_cst_with_dialect(source, Dialect::Python)
        );
        assert!(lex(source).tokens.iter().all(|token| !matches!(
            token.kind,
            TokenKind::SuiteOpen | TokenKind::SuiteClose | TokenKind::BlockLabel
        )));
    }
}

#[test]
fn suite_delimiters_and_labels_have_exact_original_spans() {
    let source = "if enabled: {# Calculate salary #\nvalue = 1\n}\n";
    let lexed = valid(source);
    let suite: Vec<_> = lexed
        .significant_tokens()
        .filter(|token| {
            matches!(
                token.kind,
                TokenKind::SuiteOpen | TokenKind::SuiteClose | TokenKind::BlockLabel
            )
        })
        .collect();
    assert_eq!(suite.len(), 3);
    assert_eq!(lexed.text(suite[0]), "{");
    assert_eq!(suite[0].span.end - suite[0].span.start, 1);
    assert_eq!(lexed.text(suite[1]), "# Calculate salary #");
    assert_eq!(lexed.text(suite[2]), "}");
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::Newline)
            .count(),
        3
    );
}

#[test]
fn brace_body_indentation_is_stylistic_only_at_its_own_level() {
    let source = "if enabled: {\nvalue = 1\n       other = 2\n\t last = 3\n}\n";
    assert!(indentation(source).is_empty());
}

#[test]
fn ordinary_after_open_comment_and_spaced_label_are_distinguished() {
    let ordinary = valid("if enabled: { # ordinary header comment\nwork()\n}\n");
    assert!(
        ordinary
            .tokens
            .iter()
            .any(|token| token.kind == TokenKind::Comment)
    );
    assert!(
        !ordinary
            .tokens
            .iter()
            .any(|token| token.kind == TokenKind::BlockLabel)
    );
    let labeled = valid("if enabled: { # visible label # # ordinary trailing comment\nwork()\n}\n");
    assert_eq!(
        labeled
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::BlockLabel)
            .count(),
        1
    );
    assert_eq!(
        labeled
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::Comment)
            .count(),
        1
    );
}

#[test]
fn malformed_labels_and_opening_line_code_have_explicit_diagnostics() {
    for (source, code) in [
        ("{# no terminator\nwork()\n}\n", "F0021"),
        ("if enabled: {# no terminator\nwork()\n}\n", "F0021"),
        ("{#   #\nwork()\n}\n", "F0022"),
        ("{# outer {# nested #\nwork()\n}\n", "F0023"),
        ("{# label # trailing_code\nwork()\n}\n", "F0021"),
        ("if enabled: { work()\n}\n", "F0021"),
        ("if enabled: {", "F0021"),
    ] {
        assert!(
            naja(source)
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == code),
            "{source:?}"
        );
    }
}

#[test]
fn dictionary_set_strings_regex_text_and_comments_keep_their_roles() {
    let source = "if enabled: {\ndata = {\n 'name': 'NAJA',\n 'value': {1, 2},\n}\ntext = '{# label # }'\npattern = r'{[a-z]+}'\n# {# ordinary comment #\n# %% ordinary cell comment\n}\n";
    let lexed = valid(source);
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::SuiteOpen)
            .count(),
        1
    );
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::Symbol(Symbol::LeftBrace))
            .count(),
        2
    );
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::BlockLabel)
            .count(),
        0
    );
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::NonLogicalNewline)
            .count(),
        5
    );
}

#[test]
fn unnamed_standalone_brace_stays_an_expression() {
    for source in [
        "{}\n",
        "{1, 2}\n",
        "{'name': 'NAJA'}\n",
        "value = {# ordinary expression comment\n'key': 1}\n",
        "({# still an expression comment\n1, 2})\n",
    ] {
        let lexed = valid(source);
        assert!(
            !lexed
                .tokens
                .iter()
                .any(|token| token.kind == TokenKind::SuiteOpen)
        );
    }
}

#[test]
fn indentation_around_named_section_is_suspended_and_resumes() {
    let source = "if outer:\n    before()\n    {# transparent #\nunindented()\n          styled()\n    }\n    after()\nlast()\n";
    assert_eq!(
        indentation(source),
        vec![TokenKind::Indent, TokenKind::Dedent]
    );
    let lexed = valid(source);
    let dedent = lexed
        .tokens
        .iter()
        .find(|token| token.kind == TokenKind::Dedent)
        .unwrap();
    assert_eq!(dedent.span.start, source.find("last()").unwrap());
}

#[test]
fn nested_indentation_uses_its_header_physical_baseline() {
    let source = "if outer: {\n    if inner:\n        work()\n        more()\n    after()\n}\n";
    assert_eq!(
        indentation(source),
        vec![TokenKind::Indent, TokenKind::Dedent]
    );
    let lexed = valid(source);
    let dedent = lexed
        .tokens
        .iter()
        .find(|token| token.kind == TokenKind::Dedent)
        .unwrap();
    assert_eq!(dedent.span.start, source.find("after()").unwrap());
    for invalid in [
        "if outer: {\n    if inner:\n    work()\n}\n",
        "if outer: {\n    if inner:\n  work()\n}\n",
        "if outer: {\n    if inner:\n}\n",
    ] {
        assert!(
            naja(invalid)
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "F0024")
        );
    }
}

#[test]
fn intermediate_dedent_is_rejected_inside_brace_local_indentation() {
    let source = "if outer: {\n    if inner:\n        work()\n      ambiguous()\n}\n";
    assert!(
        naja(source)
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0002")
    );
}

#[test]
fn brace_close_requires_physical_dedent_of_nested_indentation() {
    valid("if outer: {\n    if inner:\n        work()\n}\n");
    let source = "if outer: {\n    if inner:\n        work()\n        }\n";
    let lexed = naja(source);
    let error = lexed
        .diagnostics
        .iter()
        .find(|diagnostic| diagnostic.code == "F0024")
        .unwrap();
    assert_eq!(&source[error.span.start..error.span.end], "}");
}

#[test]
fn nested_brace_close_does_not_dedent_suspended_parent_suite() {
    let source = "if outer: {\n    if inner:\n        if deeper: {\nzero_indent()\n}\n        still_inside_inner()\n    after_inner()\n}\n";
    let lexed = valid(source);
    assert_eq!(
        indentation(source),
        vec![TokenKind::Indent, TokenKind::Dedent]
    );
    let dedent = lexed
        .tokens
        .iter()
        .find(|token| token.kind == TokenKind::Dedent)
        .unwrap();
    assert_eq!(dedent.span.start, source.find("after_inner()").unwrap());
}

#[test]
fn nested_braces_preserve_surrounding_indentation_frames() {
    let source = "if top:\n    if outer: {\nif inner: {\nwork()\n}\n}\n    next_in_top()\nlast()\n";
    let lexed = valid(source);
    assert_eq!(
        indentation(source),
        vec![TokenKind::Indent, TokenKind::Dedent]
    );
    assert_eq!(
        lexed
            .tokens
            .iter()
            .find(|token| token.kind == TokenKind::Dedent)
            .unwrap()
            .span
            .start,
        source.find("last()").unwrap()
    );
}

#[test]
fn multiline_headers_use_first_physical_line_baseline() {
    let source =
        "if outer: {\n    if (left +\n              right):\n        work()\n    after()\n}\n";
    assert_eq!(
        indentation(source),
        vec![TokenKind::Indent, TokenKind::Dedent]
    );
}

#[test]
fn depth_markers_remain_tokens_and_can_decorate_brace_local_indentation() {
    let source = "if outer: {\n    if inner:(1)\n        work()\n    after()\n}\n";
    assert_eq!(
        indentation(source),
        vec![TokenKind::Indent, TokenKind::Dedent]
    );
    let mixed = naja("if outer:(0) {\nwork()\n}\n");
    assert!(
        mixed
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0026")
    );
}

#[test]
fn same_and_following_line_companion_clauses_keep_structural_tokens() {
    for source in [
        "if x: {\nfirst()\n} else: {\nsecond()\n}\n",
        "if x: {\nfirst()\n}\nelse: {\nsecond()\n}\n",
        "try: {\nfirst()\n} except Error: {\nsecond()\n} finally: {\nlast()\n}\n",
    ] {
        let lexed = valid(source);
        assert_eq!(
            lexed
                .tokens
                .iter()
                .filter(|token| token.kind == TokenKind::SuiteOpen)
                .count(),
            lexed
                .tokens
                .iter()
                .filter(|token| token.kind == TokenKind::SuiteClose)
                .count()
        );
    }
    assert!(
        naja("{# section #\nwork()\n} trailing()\n")
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0025")
    );
}

#[test]
fn closing_on_statement_line_inserts_empty_span_logical_newline() {
    let source = "if x: {\nwork()} else: {\nother()}\n";
    let lexed = valid(source);
    for (index, token) in lexed
        .tokens
        .iter()
        .enumerate()
        .filter(|(_, token)| token.kind == TokenKind::SuiteClose)
    {
        assert_eq!(lexed.tokens[index - 1].kind, TokenKind::Newline);
        assert_eq!(
            lexed.tokens[index - 1].span,
            Span::new(token.span.start, token.span.start)
        );
    }
}

#[test]
fn nested_suite_metadata_preserves_duplicate_unicode_labels_without_binding_them() {
    let source = "{# 数据 #\nif x: {# 数据 #\nwork()\n}\n}\n";
    let cst = parse_cst_with_dialect(source, Dialect::Naja2026);
    assert!(cst.lexed.diagnostics.is_empty());
    assert_eq!(cst.suites.len(), 2);
    assert_eq!(cst.suites[0].kind, SuiteKind::NamedSection);
    assert_eq!(cst.suites[1].kind, SuiteKind::Control);
    for suite in &cst.suites {
        assert_eq!(&source[suite.open.start..suite.open.end], "{");
        let close = suite.close.unwrap();
        assert_eq!(&source[close.start..close.end], "}");
        let label = suite.label.unwrap();
        assert_eq!(&source[label.start..label.end], "# 数据 #");
        assert_eq!(suite.span, Span::new(suite.open.start, close.end));
    }
}

#[test]
fn missing_close_metadata_and_stray_closers_are_diagnosed() {
    let source = "if x: {\nwork()\n";
    let cst = parse_cst_with_dialect(source, Dialect::Naja2026);
    assert_eq!(cst.lexed.reconstruct(), source);
    assert!(
        cst.lexed
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0020")
    );
    assert_eq!(cst.suites[0].close, None);
    assert_eq!(cst.suites[0].span.end, source.len());
    assert!(
        naja("}\n")
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0003")
    );
}

#[test]
fn brace_newlines_and_trivia_transformations_preserve_token_structure() {
    let source = "if x: {\nwork()\nif y:\n    nested()\nnext()\n}\n";
    let expected = kinds(source);
    for ending in ["\n", "\r\n", "\r"] {
        assert_eq!(kinds(&source.replace('\n', ending)), expected);
    }
    let styled = "if x: { # ordinary comment\n       work()\n  # %%\n      if y:\n          nested()\n next()\n}\n";
    assert_eq!(kinds(styled), expected);
}

#[test]
fn frontend_block_limits_fail_explicitly_and_preserve_every_byte() {
    let labels = format!("{{# {} #\nwork()\n}}\n", "x".repeat(4096));
    assert!(
        naja(&labels)
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0029")
    );
    let too_deep = format!("{}{}", "{# nested #\n".repeat(129), "}\n".repeat(129));
    assert!(
        naja(&too_deep)
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0029")
    );
    let oversized = "x".repeat(1_048_577);
    assert!(
        naja(&oversized)
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0029")
    );
}

#[test]
fn generated_naja_delimiter_and_label_fragments_terminate_losslessly() {
    let fragments = [
        "{# label #\n",
        "{# missing\n",
        "if x: {\n",
        "}\n",
        "    ",
        "\n",
        "# comment\n",
        "'{}'",
        "[",
        "]",
        "é",
    ];
    for first in fragments {
        for second in fragments {
            for third in fragments {
                naja(&format!("{first}{second}{third}"));
            }
        }
    }
}

#[test]
fn same_line_parenthesized_suite_does_not_require_an_indented_body() {
    for source in [
        "{# section #\nif enabled:(0)\nnext()\n}\n",
        "if outer: {\n    if enabled:(1)\nnext()\n}\n",
        "{# section #\nif enabled:(0)\n# ordinary comment\n\nnext()\n}\n",
        "{# section #\nif enabled:(0)\n}\n",
    ] {
        assert!(indentation(source).is_empty());
        let lexed = valid(source);
        let marker = lexed
            .tokens
            .iter()
            .find(|token| token.kind == TokenKind::Integer)
            .unwrap();
        assert!(matches!(lexed.text(marker), "0" | "1"));
    }
    let unterminated = naja("{# section #\nif enabled:(0)");
    assert!(
        unterminated
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0020")
    );
    assert!(
        !unterminated
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0024")
    );
}

#[test]
fn optional_marker_candidate_preserves_active_parent_indentation() {
    let source =
        "{# section #\n    if outer:\n        if enabled:(1)\n        next()\n    after()\n}\n";
    assert_eq!(
        indentation(source),
        vec![TokenKind::Indent, TokenKind::Dedent]
    );
    let lexed = valid(source);
    let dedent = lexed
        .tokens
        .iter()
        .find(|token| token.kind == TokenKind::Dedent)
        .unwrap();
    assert_eq!(dedent.span.start, source.find("after()").unwrap());
    let marked = "{# section #\n    if enabled:(0)\n        nested()\n    after()\n}\n";
    assert_eq!(
        indentation(marked),
        vec![TokenKind::Indent, TokenKind::Dedent]
    );
}

#[test]
fn long_expression_brace_vectors_keep_context_and_losslessness() {
    // No elapsed-time assertion: the header cache has fixed storage and bounded
    // updates, independently inspected by the internal observation-count test.
    for count in [500, 5_000, 20_000] {
        let source = format!("{}{}\n", "\\\n".repeat(500), "{};".repeat(count));
        let lexed = valid(&source);
        assert_eq!(
            lexed
                .tokens
                .iter()
                .filter(|token| token.kind == TokenKind::Symbol(Symbol::LeftBrace))
                .count(),
            count
        );
        assert!(
            !lexed
                .tokens
                .iter()
                .any(|token| token.kind == TokenKind::SuiteOpen)
        );
    }
}
