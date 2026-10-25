use naja_frontend::{
    Dialect, TokenKind, lex_with_dialect, parse_cst_with_dialect, typed_integer_spans,
};

#[test]
fn typed_numbers_retain_exact_component_ranges_and_lossless_suites() {
    for source in [
        "value = 1_000Parcel\n",
        "if True: {\nvalue = 123456789012345678901234567890重量\n}\n",
        "value = 00Parcel # 10Other\n",
    ] {
        let lexed = lex_with_dialect(source, Dialect::Naja2026);
        assert!(lexed.diagnostics.is_empty(), "{:?}", lexed.diagnostics);
        assert_eq!(lexed.reconstruct(), source);
        let token = lexed
            .tokens
            .iter()
            .find(|token| token.kind == TokenKind::TypedInteger)
            .unwrap();
        let (number, suffix) = typed_integer_spans(source, token).unwrap();
        assert_eq!(number.end, suffix.start);
        assert_eq!(number.start, token.span.start);
        assert_eq!(suffix.end, token.span.end);
        assert!(
            source[number.start..number.end]
                .bytes()
                .all(|b| b.is_ascii_digit() || b == b'_')
        );
        assert_eq!(
            parse_cst_with_dialect(source, Dialect::Naja2026)
                .lexed
                .reconstruct(),
            source
        );
        assert!(
            lex_with_dialect(source, Dialect::Python)
                .diagnostics
                .iter()
                .any(|d| d.code == "F0006")
        );
    }
}

#[test]
fn suffix_support_preserves_numeric_classification_and_rejects_ambiguous_forms() {
    let source = "1e3 1E+3 0x10 0o10 0b10 1.25 amountParcel '10Parcel'\n";
    let lexed = lex_with_dialect(source, Dialect::Naja2026);
    assert!(lexed.diagnostics.is_empty(), "{:?}", lexed.diagnostics);
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|t| t.kind == TokenKind::Float)
            .count(),
        3
    );
    assert_eq!(
        lexed
            .tokens
            .iter()
            .filter(|t| t.kind == TokenKind::Integer)
            .count(),
        3
    );
    assert!(
        !lexed
            .tokens
            .iter()
            .any(|t| t.kind == TokenKind::TypedInteger)
    );
    for source in [
        "10Elephant",
        "10Joule",
        "1e3Parcel",
        "1.5Parcel",
        "0x10Parcel",
        "10_Parcel",
        "01Parcel",
    ] {
        let lexed = lex_with_dialect(source, Dialect::Naja2026);
        assert_eq!(lexed.reconstruct(), source);
        assert!(
            lexed
                .diagnostics
                .iter()
                .any(|d| d.code == "F0006" && d.message.contains("use an explicit constructor")),
            "{source}: {:?}",
            lexed.diagnostics
        );
        assert!(
            !lexed
                .tokens
                .iter()
                .any(|t| t.kind == TokenKind::TypedInteger)
        );
    }
}
