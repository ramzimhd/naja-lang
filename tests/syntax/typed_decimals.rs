use naja_frontend::{
    Dialect, Lexed, Span, Symbol, Token, TokenKind, lex_with_dialect, parse_cst_with_dialect,
    typed_integer_spans, typed_literal_spans,
};

fn lossless(source: &str, dialect: Dialect) -> Lexed {
    let lexed = lex_with_dialect(source, dialect);
    assert_eq!(lexed.reconstruct(), source);
    let mut end = 0;
    for token in &lexed.tokens {
        assert_eq!(
            token.span.start, end,
            "source bytes must occur exactly once"
        );
        assert!(source.is_char_boundary(token.span.start));
        assert!(source.is_char_boundary(token.span.end));
        end = token.span.end;
    }
    assert_eq!(end, source.len());
    lexed
}

#[test]
fn decimal_cores_and_raw_unicode_suffixes_keep_both_original_spans() {
    for number in [
        ".5",
        "1.",
        "1.e3",
        "01.5",
        "00e2",
        "1e3",
        "1E+3",
        ".5e-2",
        "1_2.3_4e-0_2",
        "0.0e9999999999999999999999999999999999",
    ] {
        for suffix in ["Type", "重量", "Pe\u{301}", "Key", "ＥType"] {
            let source = format!("{number}{suffix}");
            let lexed = lossless(&source, Dialect::Naja2026);
            assert!(
                lexed.diagnostics.is_empty(),
                "{source}: {:?}",
                lexed.diagnostics
            );
            let token = &lexed.tokens[0];
            assert_eq!(token.kind, TokenKind::TypedDecimal, "{source}");
            let (numeric, name) = typed_literal_spans(&source, token).unwrap();
            assert_eq!(numeric, Span::new(0, number.len()));
            assert_eq!(name, Span::new(number.len(), source.len()));
            assert_eq!(&source[numeric.start..numeric.end], number);
            assert_eq!(&source[name.start..name.end], suffix);
            assert_eq!(typed_integer_spans(&source, token), None);
            let python = lossless(&source, Dialect::Python);
            assert!(python.diagnostics.iter().any(|d| d.code == "F0006"));
            assert!(
                !python
                    .tokens
                    .iter()
                    .any(|t| matches!(t.kind, TokenKind::TypedInteger | TokenKind::TypedDecimal))
            );
        }
    }
}

#[test]
fn integer_tokens_and_existing_integer_span_api_remain_unchanged() {
    for number in ["0", "00", "0_0", "1_000", "123456789012345678901234567890"] {
        let source = format!("{number}重量");
        let lexed = lossless(&source, Dialect::Naja2026);
        assert!(lexed.diagnostics.is_empty());
        let token = &lexed.tokens[0];
        assert_eq!(token.kind, TokenKind::TypedInteger);
        let original = typed_integer_spans(&source, token).unwrap();
        assert_eq!(original.0, Span::new(0, number.len()));
        assert_eq!(original.1, Span::new(number.len(), source.len()));
        assert_eq!(typed_literal_spans(&source, token), Some(original));
    }
}

#[test]
fn maximal_decimal_munch_precedes_suffix_then_normal_postfix_and_unary_tokens() {
    let source = "value = -1.Type.field + .5Type[0]\n";
    let lexed = lossless(source, Dialect::Naja2026);
    assert!(lexed.diagnostics.is_empty());
    let actual: Vec<_> = lexed
        .significant_tokens()
        .map(|token| (token.kind, lexed.text(token)))
        .collect();
    assert_eq!(
        actual,
        [
            (TokenKind::Identifier, "value"),
            (TokenKind::Symbol(Symbol::Equal), "="),
            (TokenKind::Symbol(Symbol::Minus), "-"),
            (TokenKind::TypedDecimal, "1.Type"),
            (TokenKind::Symbol(Symbol::Dot), "."),
            (TokenKind::Identifier, "field"),
            (TokenKind::Symbol(Symbol::Plus), "+"),
            (TokenKind::TypedDecimal, ".5Type"),
            (TokenKind::Symbol(Symbol::LeftBracket), "["),
            (TokenKind::Integer, "0"),
            (TokenKind::Symbol(Symbol::RightBracket), "]"),
            (TokenKind::Newline, "\n"),
            (TokenKind::EndOfFile, ""),
        ]
    );
    for separated in ["(1).field", "1 .field", "1. Type", "1e3 Type", ".5 Type"] {
        let lexed = lossless(separated, Dialect::Naja2026);
        assert!(lexed.diagnostics.is_empty());
        assert!(!lexed.tokens.iter().any(|token| matches!(
            token.kind,
            TokenKind::TypedInteger | TokenKind::TypedDecimal
        )));
    }
}

#[test]
fn ordinary_numeric_and_imaginary_classification_is_preserved_in_both_dialects() {
    let source = "1 1.25 1e3 .5 1. 01.5 0x10Face 0o10 0b10\n";
    let expected = [
        (TokenKind::Integer, "1"),
        (TokenKind::Float, "1.25"),
        (TokenKind::Float, "1e3"),
        (TokenKind::Float, ".5"),
        (TokenKind::Float, "1."),
        (TokenKind::Float, "01.5"),
        (TokenKind::Integer, "0x10Face"),
        (TokenKind::Integer, "0o10"),
        (TokenKind::Integer, "0b10"),
        (TokenKind::Newline, "\n"),
        (TokenKind::EndOfFile, ""),
    ];
    for dialect in [Dialect::Python, Dialect::Naja2026] {
        let lexed = lossless(source, dialect);
        assert!(lexed.diagnostics.is_empty());
        assert_eq!(
            lexed
                .significant_tokens()
                .map(|t| (t.kind, lexed.text(t)))
                .collect::<Vec<_>>(),
            expected
        );
        for (source, kind) in [
            ("1j", TokenKind::Integer),
            ("1.5J", TokenKind::Float),
            ("1e3j", TokenKind::Float),
        ] {
            let lexed = lossless(source, dialect);
            assert_eq!(lexed.tokens[0].kind, kind);
            assert!(lexed.diagnostics.iter().any(|d| d.code == "F0013"));
        }
    }
}

#[test]
fn malformed_base_imaginary_and_ambiguous_suffixes_never_retry_shorter_cores() {
    for source in [
        "10Elephant",
        "10Joule",
        "1.5Elephant",
        "1e3eType",
        "1e3EType",
        "1e3jType",
        "1e3JType",
        "1._Type",
        "1.5_Type",
        "1e3_Type",
        "1.5__Type",
        "10_Parcel",
        "01Parcel",
        "1__2Type",
        "1_.2Type",
        "1._2Type",
        "1.2_e3Type",
        "1.2e+Type",
        "1.2e-__3Type",
        "1.2e3_Type",
        "1e+3e4Type",
        "1e++3Type",
        "0x10Type",
        "0o10Type",
        "0b10Type",
        "0x10重量",
        "1jType",
        "1.5jType",
        "1.5\u{301}Type",
    ] {
        let lexed = lossless(source, Dialect::Naja2026);
        assert!(
            lexed.diagnostics.iter().any(|d| {
                d.code == "F0006" && d.message.contains("use an explicit constructor")
            }),
            "{source}: {:?}",
            lexed.diagnostics
        );
        assert!(!matches!(
            lexed.tokens[0].kind,
            TokenKind::TypedInteger | TokenKind::TypedDecimal
        ));
        assert_eq!(typed_literal_spans(source, &lexed.tokens[0]), None);
    }
}

#[test]
fn decimal_span_helper_rejects_wrong_kinds_ranges_and_forged_malformed_tokens() {
    for source in [
        "",
        "1.5",
        "1e3EType",
        "1__2.3Type",
        "1eType",
        "1jType",
        "1.2jType",
        "0x1Type",
        "1.2Type Name",
        "1.5\u{301}Type",
    ] {
        assert_eq!(
            typed_literal_spans(
                source,
                &Token {
                    kind: TokenKind::TypedDecimal,
                    span: Span::new(0, source.len()),
                }
            ),
            None,
            "{source}"
        );
    }
    let source = "é1.5Type";
    for span in [
        Span::new(1, source.len()),
        Span::new(2, source.len() + 1),
        Span::new(5, 2),
    ] {
        assert_eq!(
            typed_literal_spans(
                source,
                &Token {
                    kind: TokenKind::TypedDecimal,
                    span
                }
            ),
            None
        );
    }
    for kind in [TokenKind::Float, TokenKind::Integer, TokenKind::Identifier] {
        assert_eq!(
            typed_literal_spans(
                "1.5Type",
                &Token {
                    kind,
                    span: Span::new(0, 7)
                }
            ),
            None
        );
    }
}

#[test]
fn shared_suites_crlf_unicode_and_inert_data_preserve_original_source() {
    let core = "1_2.5e+0_2";
    let source = format!(
        "# é\r\nif True: {{# Exact numbers #\r\n{{# Values #\r\nvalue = {core}重量\r\ntext = '1.Type # {{' # .5Comment\r\n}}\r\n}}\r\n"
    );
    let cst = parse_cst_with_dialect(&source, Dialect::Naja2026);
    assert_eq!(cst.lexed.reconstruct(), source);
    assert!(
        cst.lexed.diagnostics.is_empty(),
        "{:?}",
        cst.lexed.diagnostics
    );
    assert_eq!(cst.suites.len(), 2);
    let typed: Vec<_> = cst
        .lexed
        .tokens
        .iter()
        .filter(|t| t.kind == TokenKind::TypedDecimal)
        .collect();
    assert_eq!(typed.len(), 1);
    let (number, suffix) = typed_literal_spans(&source, typed[0]).unwrap();
    assert_eq!(&source[number.start..number.end], core);
    assert_eq!(&source[suffix.start..suffix.end], "重量");
    assert_eq!(number.start, source.find(core).unwrap());
    let position = cst.lexed.position(number.start).unwrap();
    assert_eq!((position.line, position.column), (4, 9));
}

#[test]
fn outside_trivia_metamorph_keeps_typed_tokens_and_ordinary_structure() {
    let original = "values = [1.5Type, .5重量, 1.e-2Type, 10Parcel]\n";
    let changed = "# %% 1.Bad\r\nvalues = [ # .5Wrong\r\n 1.5Type, # 1e3Comment\r\n .5重量, 1.e-2Type, 10Parcel] # text\r\n";
    let structure = |source: &str| {
        let lexed = lossless(source, Dialect::Naja2026);
        assert!(lexed.diagnostics.is_empty());
        // The logical newline kind stays fixed while its physical spelling
        // changes; lossless() separately checks each input's exact original bytes.
        lexed
            .significant_tokens()
            .map(|t| {
                (
                    t.kind,
                    if t.kind == TokenKind::Newline {
                        String::new()
                    } else {
                        lexed.text(t).to_owned()
                    },
                )
            })
            .collect::<Vec<_>>()
    };
    assert_eq!(structure(original), structure(changed));
}

#[test]
fn large_exponents_are_retained_without_conversion_or_expansion() {
    for sign in ["", "+", "-"] {
        let core = format!("1.e{sign}{}", "9".repeat(10_000));
        let source = format!("{core}重量");
        let lexed = lossless(&source, Dialect::Naja2026);
        assert!(lexed.diagnostics.is_empty());
        assert_eq!(lexed.tokens[0].kind, TokenKind::TypedDecimal);
        let (number, suffix) = typed_literal_spans(&source, &lexed.tokens[0]).unwrap();
        assert_eq!(&source[number.start..number.end], core);
        assert_eq!(&source[suffix.start..suffix.end], "重量");
    }
}

#[test]
fn bounded_numeric_fragments_remain_lossless_and_expose_only_valid_ranges() {
    let fragments = [
        "0", "1", "_", "1.", ".5", "e", "+", "-", "j", "Type", "重量", "\n",
    ];
    for left in fragments {
        for right in fragments {
            let source = format!("{left}{right}Type");
            let lexed = lossless(&source, Dialect::Naja2026);
            for token in &lexed.tokens {
                if let Some((number, suffix)) = typed_literal_spans(&source, token) {
                    assert_eq!(number.start, token.span.start);
                    assert_eq!(number.end, suffix.start);
                    assert_eq!(suffix.end, token.span.end);
                    assert!(source.is_char_boundary(number.end));
                }
            }
        }
    }
}
