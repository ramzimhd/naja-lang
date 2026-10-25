use naja_frontend::{
    Dialect, IdentifierErrorKind, Span, TokenKind, canonical_identifier, is_identifier, lex,
    lex_with_dialect,
};

#[test]
fn multilingual_identifiers_and_combining_continuations_are_original_tokens() {
    for name in [
        "café",
        "变量",
        "مجموع",
        "साँप",
        "가",
        "_Δ",
        "℘",
        "a·b",
        "a\u{200c}b",
        "a\u{200d}b",
        "𐐀_value",
        "cafe\u{301}",
    ] {
        assert!(is_identifier(name), "{name:?}");
        let source = format!("{name} = 1\r\n");
        for dialect in [Dialect::Python, Dialect::Naja2026] {
            let lexed = lex_with_dialect(&source, dialect);
            assert!(
                lexed.diagnostics.is_empty(),
                "{name:?}: {:?}",
                lexed.diagnostics
            );
            assert_eq!(lexed.tokens[0].kind, TokenKind::Identifier);
            assert_eq!(lexed.text(&lexed.tokens[0]), name);
            assert_eq!(lexed.tokens[0].span, Span::new(0, name.len()));
            assert_eq!(lexed.reconstruct(), source);
        }
    }
}

#[test]
fn canonical_names_apply_nfkc_without_case_folding_or_keyword_reservation() {
    for (source, canonical) in [
        ("K", "K"),
        ("Ｋ", "K"),
        ("ﬃ", "ffi"),
        ("µ", "μ"),
        ("cafe\u{301}", "café"),
        ("가", "가"),
        ("ｉｆ", "if"),
    ] {
        assert_eq!(canonical_identifier(source).unwrap(), canonical);
        assert_eq!(
            canonical_identifier(&canonical_identifier(source).unwrap()).unwrap(),
            canonical
        );
    }
    assert_ne!(
        canonical_identifier("Name").unwrap(),
        canonical_identifier("name").unwrap()
    );
    assert_ne!(
        canonical_identifier("a").unwrap(),
        canonical_identifier("а").unwrap()
    ); // Latin/Cyrillic user data.
    assert!(is_identifier("if")); // NAME validation leaves raw keyword grammar to the parser.
}

#[test]
fn invalid_identifier_boundaries_return_precise_name_relative_byte_spans() {
    let empty = canonical_identifier("").unwrap_err();
    assert_eq!(empty.kind, IdentifierErrorKind::Empty);
    assert_eq!(empty.span, Span::new(0, 0));
    for name in ["1name", "\u{301}a", "🐍", "ำ", "゛", "＿value"] {
        let error = canonical_identifier(name).unwrap_err();
        assert_eq!(error.kind, IdentifierErrorKind::InvalidStart, "{name:?}");
        assert_eq!(error.span.start, 0);
    }
    for (name, position) in [
        ("名🐍", "名".len()),
        ("a-b", 1),
        ("name\u{200b}", 4),
        ("a b", 1),
    ] {
        let error = canonical_identifier(name).unwrap_err();
        assert_eq!(error.kind, IdentifierErrorKind::InvalidContinue);
        assert_eq!(error.span.start, position);
    }
}

#[test]
fn invalid_unicode_source_reports_the_offending_scalar_without_consuming_neighbors() {
    for source in ["a🐍b", "\u{301}name", "a\u{200b}b", "名字€next"] {
        let lexed = lex(source);
        assert_eq!(lexed.reconstruct(), source);
        let diagnostic = lexed
            .diagnostics
            .iter()
            .find(|diagnostic| diagnostic.code == "F0010")
            .unwrap();
        assert_eq!(
            source[diagnostic.span.start..diagnostic.span.end]
                .chars()
                .count(),
            1
        );
        assert!(diagnostic.message.contains("U+"));
        assert!(
            lexed
                .tokens
                .iter()
                .any(|token| token.kind == TokenKind::Identifier)
        );
    }
}

#[test]
fn numeric_unicode_suffixes_are_rejected_without_reinterpreting_values() {
    for source in ["1变量", "1\u{301}", "1e3Ｋ", "0x1变量", "0b1名"] {
        let lexed = lex(source);
        assert!(
            lexed
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "F0006"),
            "{source:?}"
        );
        assert_eq!(lexed.reconstruct(), source);
    }
}

#[test]
fn compatibility_spelling_does_not_turn_into_a_keyword_string_prefix_or_label() {
    let source = "ｉｆ = 1\nｒ'raw'\nname = 'K cafe\u{301}' # Ｋ\n";
    let lexed = lex_with_dialect(source, Dialect::Naja2026);
    assert!(lexed.diagnostics.is_empty());
    assert_eq!(lexed.reconstruct(), source);
    assert_eq!(lexed.text(&lexed.tokens[0]), "ｉｆ");
    assert!(
        !lexed
            .tokens
            .iter()
            .any(|token| token.kind == TokenKind::SuiteOpen)
    );
    let prefix = lexed
        .tokens
        .iter()
        .find(|token| lexed.text(token) == "ｒ")
        .unwrap();
    assert_eq!(prefix.kind, TokenKind::Identifier);
    let label_source = "{# K cafe\u{301} #\n名 = 1\n}\n";
    let label = lex_with_dialect(label_source, Dialect::Naja2026);
    assert!(label.diagnostics.is_empty());
    assert_eq!(label.reconstruct(), label_source);
    assert!(label.tokens.iter().any(
        |token| token.kind == TokenKind::BlockLabel && label.text(token) == "# K cafe\u{301} #"
    ));
}

#[test]
fn normalization_is_idempotent_and_long_names_preserve_utf8_source_bounds() {
    let name = format!("a{}", "\u{315}\u{300}".repeat(16_384));
    assert!(is_identifier(&name));
    let canonical = canonical_identifier(&name).unwrap();
    assert!(is_identifier(&canonical));
    assert_eq!(canonical_identifier(&canonical).unwrap(), canonical);
    let source = format!("{name} = 1\n");
    let lexed = lex(&source);
    assert!(lexed.diagnostics.is_empty());
    assert_eq!(lexed.tokens[0].span.end, name.len());
    assert_eq!(lexed.reconstruct(), source);
}
