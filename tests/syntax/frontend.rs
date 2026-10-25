use naja_frontend::{Span, Symbol, TokenKind, lex, parse_cst};

mod blocks;

fn significant(source: &str) -> Vec<(TokenKind, String)> {
    let lexed = lex(source);
    assert!(lexed.diagnostics.is_empty(), "{:?}", lexed.diagnostics);
    lexed
        .significant_tokens()
        .map(|token| (token.kind, lexed.text(token).to_owned()))
        .collect()
}

fn assert_lossless(source: &str) {
    let lexed = lex(source);
    assert_eq!(lexed.reconstruct(), source);
    let mut end = 0;
    for token in &lexed.tokens {
        assert_eq!(
            token.span.start, end,
            "Every source byte must occur exactly once: {token:?}"
        );
        assert!(source.is_char_boundary(token.span.start));
        assert!(source.is_char_boundary(token.span.end));
        end = token.span.end;
    }
    assert_eq!(end, source.len());
}

#[test]
fn empty_and_trivia_only_sources_are_lossless() {
    for source in [
        "",
        " ",
        "\n",
        "\r\n",
        "# comment",
        "# %%\n\n   # data\r\n",
        "\u{feff}# UTF-8 BOM\r\n",
    ] {
        assert_lossless(source);
        assert!(lex(source).diagnostics.is_empty());
    }
}

#[test]
fn tokens_preserve_names_operators_and_trivia() {
    let source = "answer = 42 # actual source\n";
    assert_lossless(source);
    assert_eq!(
        significant(source),
        vec![
            (TokenKind::Identifier, "answer".into()),
            (TokenKind::Symbol(Symbol::Equal), "=".into()),
            (TokenKind::Integer, "42".into()),
            (TokenKind::Newline, "\n".into()),
            (TokenKind::EndOfFile, "".into()),
        ]
    );
}

#[test]
fn arbitrary_integer_lexemes_are_never_narrowed() {
    let huge = "99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999";
    let tokens = significant(huge);
    assert_eq!(tokens[0], (TokenKind::Integer, huge.into()));
    assert_lossless(huge);
}

#[test]
fn integer_radices_and_separators() {
    for number in [
        "0",
        "00",
        "0_0",
        "123_456",
        "0b101_001",
        "0B_111",
        "0o755",
        "0O_755",
        "0xdead_BEEF",
        "0X_FF",
    ] {
        assert_eq!(significant(number)[0], (TokenKind::Integer, number.into()));
    }
}

#[test]
fn float_lexemes_include_exponent_signs() {
    for number in [
        "0.",
        ".5",
        "1.25",
        "1e5",
        "1e-5",
        "1E+5",
        "1_000.5_0e+1_0",
        "00.1",
        "00e2",
    ] {
        assert_eq!(significant(number)[0], (TokenKind::Float, number.into()));
    }
}

#[test]
fn invalid_numbers_are_diagnosed_without_losing_source() {
    for number in [
        "01", "0x", "0xGG", "0b102", "0o8", "0x__1", "1_", "1__2", "1e", "1e+", "1e_2", "1._0",
        "1_.0", "1suffix",
    ] {
        assert_lossless(number);
        assert!(
            lex(number)
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "F0006"),
            "{number}"
        );
    }
}

#[test]
fn imaginary_literals_have_explicit_unsupported_diagnostic() {
    let lexed = lex("3.5j");
    assert!(
        lexed
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0013")
    );
    assert_lossless("3.5j");
}

#[test]
fn indentation_and_eof_dedent_are_structural_empty_spans() {
    let lexed = lex("if flag:\n    first()\n    if other:\n        second()");
    assert!(lexed.diagnostics.is_empty());
    let structures: Vec<_> = lexed
        .tokens
        .iter()
        .filter(|token| matches!(token.kind, TokenKind::Indent | TokenKind::Dedent))
        .collect();
    assert_eq!(
        structures
            .iter()
            .map(|token| token.kind)
            .collect::<Vec<_>>(),
        vec![
            TokenKind::Indent,
            TokenKind::Indent,
            TokenKind::Dedent,
            TokenKind::Dedent
        ]
    );
    assert!(
        structures
            .iter()
            .all(|token| token.span.start == token.span.end)
    );
    assert_lossless(&lexed.source);
}

#[test]
fn blank_and_comment_lines_do_not_change_indentation() {
    let lexed = lex(
        "if flag:\n    first()\n # not a dedent\n\n        # not an indent\n    second()\nlast()\n",
    );
    assert!(lexed.diagnostics.is_empty());
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::Indent)
            .count(),
        1
    );
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::Dedent)
            .count(),
        1
    );
    assert_lossless(&lexed.source);
}

#[test]
fn unmatched_dedent_has_exact_source_span() {
    let lexed = lex("if x:\n    pass\n  pass\n");
    let diagnostic = lexed
        .diagnostics
        .iter()
        .find(|diagnostic| diagnostic.code == "F0002")
        .unwrap();
    assert_eq!(
        &lexed.source[diagnostic.span.start..diagnostic.span.end],
        "  "
    );
    assert_eq!(lexed.position(diagnostic.span.start).unwrap().line, 3);
    assert_lossless(&lexed.source);
}

#[test]
fn tabs_and_spaces_are_checked_at_equal_and_deeper_columns() {
    for source in [
        "if x:\n\tpass\n        pass\n",
        "if x:\n        if y:\n\t pass\n",
    ] {
        assert!(
            lex(source)
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "F0001")
        );
        assert_lossless(source);
    }
    assert!(
        lex("if x:\n\tif y:\n\t\tpass\n\tpass\n")
            .diagnostics
            .is_empty()
    );
}

#[test]
fn formfeed_resets_indentation_columns() {
    let lexed = lex("if x:\n  \x0c    pass\n");
    assert!(lexed.diagnostics.is_empty());
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::Indent)
            .count(),
        1
    );
    assert_lossless(&lexed.source);
}

#[test]
fn brackets_suppress_logical_newlines_and_indentation() {
    let source = "values = [\r\n  1,\r\n       (2 +\r\n    3), # preserve\r\n]\r\n";
    let lexed = lex(source);
    assert!(lexed.diagnostics.is_empty());
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::Newline)
            .count(),
        1
    );
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::NonLogicalNewline)
            .count(),
        4
    );
    assert!(
        !lexed
            .tokens
            .iter()
            .any(|token| matches!(token.kind, TokenKind::Indent | TokenKind::Dedent))
    );
    assert_lossless(source);
}

#[test]
fn explicit_line_continuation_is_retained_and_does_not_indent() {
    let source = "value = 1 + \\\r\n          2\r\n";
    let lexed = lex(source);
    assert!(lexed.diagnostics.is_empty());
    let continuation = lexed
        .tokens
        .iter()
        .find(|token| token.kind == TokenKind::ExplicitLineContinuation)
        .unwrap();
    assert_eq!(lexed.text(continuation), "\\\r\n");
    assert!(
        !lexed
            .tokens
            .iter()
            .any(|token| token.kind == TokenKind::Indent)
    );
    assert_lossless(source);
}

#[test]
fn unfinished_explicit_continuation_is_rejected() {
    assert!(
        lex("value = 1 + \\\n")
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0012")
    );
    assert!(
        lex("value = 1 \\ ")
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0007")
    );
}

#[test]
fn delimiter_failures_are_precise() {
    let lexed = lex("x = (]\n");
    assert!(
        lexed
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0003" && diagnostic.span == Span::new(5, 6))
    );
    assert!(
        lexed
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0004" && diagnostic.span == Span::new(4, 5))
    );
    assert!(
        lex("]")
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0003")
    );
    assert_lossless(&lexed.source);
}

#[test]
fn comments_and_strings_do_not_open_delimiters() {
    let source = "value = '([:](0)' # )]}\nother = \"# %%\"\n";
    assert!(lex(source).diagnostics.is_empty());
    assert_lossless(source);
}

#[test]
fn string_prefixes_quotes_raw_escapes_and_triples() {
    for source in [
        "'text'",
        "\"text\"",
        "r'raw\\n'",
        "R\"raw\\\" quote\"",
        "u'Unicode'",
        "b'bytes\\xff'",
        "BR'raw bytes'",
        "rb'bytes'",
        "'escaped \\' quote'",
        "'''first\nsecond'''",
        "\"\"\"first\r\nsecond\"\"\"",
        "'continued\\\nline'",
    ] {
        let tokens = significant(source);
        assert_eq!(tokens[0], (TokenKind::String, source.into()));
        assert_lossless(source);
    }
}

#[test]
fn multiline_string_does_not_create_indentation_events() {
    let source = "if x:\n    data = '''one\nzero indent\n        eight'''\n    next()\n";
    let lexed = lex(source);
    assert!(lexed.diagnostics.is_empty());
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::Indent)
            .count(),
        1
    );
    assert_lossless(source);
}

#[test]
fn unterminated_strings_recover_without_losing_newline() {
    for source in ["'bad\nnext()\n", "'''bad\n", "r'bad\\'", "\"bad"] {
        assert!(
            lex(source)
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "F0005")
        );
        assert_lossless(source);
    }
    let lexed = lex("'bad\nnext()\n");
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::Newline)
            .count(),
        2
    );
}

#[test]
fn formatted_and_template_strings_are_explicitly_unsupported() {
    for source in [
        "f'{value}'",
        "rf'{value}'",
        "F\"{value}\"",
        "t'{value}'",
        "TR'{value}'",
    ] {
        let lexed = lex(source);
        assert!(
            lexed
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "F0011"),
            "{source}"
        );
        assert_eq!(lexed.tokens[0].kind, TokenKind::String);
        assert_lossless(source);
    }
}

#[test]
fn bytes_reject_literal_non_ascii_data() {
    let lexed = lex("b'é'");
    let diagnostic = lexed
        .diagnostics
        .iter()
        .find(|diagnostic| diagnostic.code == "F0014")
        .unwrap();
    assert_eq!(
        &lexed.source[diagnostic.span.start..diagnostic.span.end],
        "é"
    );
    assert_lossless(&lexed.source);
    assert!(
        lex("b'\\é'")
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "F0014")
    );
}

#[test]
fn nul_is_rejected_even_in_strings_and_comments() {
    for source in ["value = '\0'", "# \0 comment", "\0"] {
        assert!(
            lex(source)
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "F0008")
        );
        assert_lossless(source);
    }
}

#[test]
fn non_ascii_whitespace_does_not_misclassify_previous_ascii_identifier() {
    let lexed = lex("name\u{a0}other");
    assert_eq!(lexed.tokens[0].kind, TokenKind::Identifier);
    assert_eq!(lexed.text(&lexed.tokens[0]), "name");
    assert_eq!(lexed.tokens[1].kind, TokenKind::Invalid);
    assert_lossless(&lexed.source);
}

#[test]
fn unicode_user_data_and_byte_spans_are_preserved() {
    let source = "message = 'مرحبا 世界 🐍' # café\r\n";
    let lexed = lex(source);
    assert!(lexed.diagnostics.is_empty());
    let string = lexed
        .tokens
        .iter()
        .find(|token| token.kind == TokenKind::String)
        .unwrap();
    assert_eq!(lexed.text(string), "'مرحبا 世界 🐍'");
    assert_eq!(string.span.start, "message = ".len());
    assert_eq!(string.span.end, "message = 'مرحبا 世界 🐍'".len());
    assert_eq!(
        lexed.position(source.find('世').unwrap()).unwrap().column,
        18
    );
    assert_eq!(lexed.position(source.len()).unwrap().line, 2);
    assert!(lexed.position(source.find('世').unwrap() + 1).is_none());
    assert!(lexed.position(source.len() + 1).is_none());
    assert_lossless(source);
}

#[test]
fn unicode_identifiers_have_honest_temporary_unsupported_diagnostic() {
    for source in ["café = 1", "变量 = 2", "_Δ = 3"] {
        let lexed = lex(source);
        let diagnostic = lexed
            .diagnostics
            .iter()
            .find(|diagnostic| diagnostic.code == "F0010")
            .unwrap();
        assert_eq!(
            &source[diagnostic.span.start..diagnostic.span.end],
            source.split(' ').next().unwrap()
        );
        assert_lossless(source);
    }
}

#[test]
fn cell_separator_remains_an_ordinary_comment() {
    let source = "# %% cell one\nvalue = 1\n# %%\nvalue + 1\n";
    let lexed = lex(source);
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|token| token.kind == TokenKind::Comment)
            .count(),
        2
    );
    assert!(
        !lexed
            .significant_tokens()
            .any(|token| lexed.text(token).contains("%%"))
    );
    assert_lossless(source);
}

#[test]
fn marker_candidates_are_never_textually_rewritten() {
    for source in [
        "if flag:(0)\n    work()\n",
        "if flag:(0)\n",
        "if flag: (0); work()\n",
        "value = {key: (0)}\n",
        "value = data[:(0)]\n",
        "value: (0) = other\n",
    ] {
        assert!(lex(source).diagnostics.is_empty());
        assert_lossless(source);
        let tokens = significant(source);
        let colon = tokens
            .iter()
            .position(|(kind, _)| *kind == TokenKind::Symbol(Symbol::Colon))
            .unwrap();
        assert_eq!(tokens[colon + 1].0, TokenKind::Symbol(Symbol::LeftParen));
        assert_eq!(tokens[colon + 2], (TokenKind::Integer, "0".into()));
        assert_eq!(tokens[colon + 3].0, TokenKind::Symbol(Symbol::RightParen));
    }
}

#[test]
fn standard_same_line_suite_is_preserved() {
    let source = "if enabled: work(); other()\nelse: (0)\n";
    let lexed = lex(source);
    assert!(lexed.diagnostics.is_empty());
    assert!(
        !lexed
            .tokens
            .iter()
            .any(|token| token.kind == TokenKind::Indent)
    );
    assert_lossless(source);
}

#[test]
fn aliases_attributes_and_keywords_are_plain_identifiers_at_lexical_stage() {
    let source = "if equalTo: obj.equalTo(equalTo=display)\n";
    let lexed = lex(source);
    assert!(lexed.diagnostics.is_empty());
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|token| lexed.text(token) == "equalTo" && token.kind == TokenKind::Identifier)
            .count(),
        3
    );
    assert_lossless(source);
}

#[test]
fn operators_use_longest_match() {
    for (text, expected) in [
        ("**=", Symbol::DoubleStarEqual),
        ("//=", Symbol::DoubleSlashEqual),
        ("<<=", Symbol::LeftShiftEqual),
        (">>=", Symbol::RightShiftEqual),
        ("...", Symbol::Ellipsis),
        ("**", Symbol::DoubleStar),
        ("!=", Symbol::NotEqual),
        (":=", Symbol::Walrus),
        ("->", Symbol::Arrow),
    ] {
        assert_eq!(
            significant(text)[0],
            (TokenKind::Symbol(expected), text.into())
        );
    }
}

#[test]
fn lossless_cst_has_contiguous_token_ranges_and_tracks_line_depth() {
    let source = "# heading\nif x:\n    value = (\n      1\n    )\nlast()\n# tail\n";
    let cst = parse_cst(source);
    assert!(cst.lexed.diagnostics.is_empty());
    let content: Vec<_> = cst
        .lines
        .iter()
        .filter(|line| {
            cst.lexed.tokens[line.token_range.clone()]
                .iter()
                .any(|token| token.kind == TokenKind::Identifier)
        })
        .collect();
    assert_eq!(
        content
            .iter()
            .map(|line| line.indentation_depth)
            .collect::<Vec<_>>(),
        vec![0, 1, 0]
    );
    let mut next = 0;
    for line in &cst.lines {
        assert_eq!(line.token_range.start, next);
        next = line.token_range.end;
    }
    assert_eq!(next, cst.lexed.tokens.len());
    assert_lossless(source);
}

#[test]
fn lf_crlf_and_cr_have_same_structural_tokens() {
    let source = "if x:\n    value = (1 +\n      2)\n# %%\nlast()\n";
    let structure = |source: &str| {
        lex(source)
            .significant_tokens()
            .map(|token| token.kind)
            .collect::<Vec<_>>()
    };
    for ending in ["\n", "\r\n", "\r"] {
        let converted = source.replace('\n', ending);
        assert_eq!(structure(source), structure(&converted));
        assert_lossless(&converted);
    }
}

#[test]
fn inserting_trivia_preserves_significant_token_spelling() {
    let original = "if x:\n    value = [1,2]\n";
    let changed =
        "# %% heading\nif  x : # header\n    # body\n    value  = [ 1 , 2 ] # trailing\n\n";
    let without_breaks = |source: &str| {
        significant(source)
            .into_iter()
            .filter(|(kind, _)| *kind != TokenKind::Newline)
            .collect::<Vec<_>>()
    };
    assert_eq!(without_breaks(original), without_breaks(changed));
    assert_lossless(changed);
}

#[test]
fn bounded_character_combinations_are_always_lossless_and_terminate() {
    // Deterministic generated invalid/valid inputs; no external interpreter.
    let alphabet = [
        "a", "1", " ", "\t", "\n", "\r\n", "'", "\"", "#", "\\", "(", ")", "[", "]", ":", "é", "\0",
    ];
    for first in alphabet {
        for second in alphabet {
            for third in alphabet {
                assert_lossless(&format!("{first}{second}{third}"));
            }
        }
    }
}
