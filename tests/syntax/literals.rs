use naja_frontend::{
    Diagnostic, Dialect, LiteralValue, STRING_LITERAL_MAX_BYTES, Span, Token, TokenKind,
    decode_string, lex_with_dialect, parse_cst_with_dialect,
};

fn token(source: &str) -> Token {
    Token {
        kind: TokenKind::String,
        span: Span::new(0, source.len()),
    }
}

fn decode(source: &str) -> LiteralValue {
    let lexed = lex_with_dialect(source, Dialect::Python);
    assert!(
        lexed.diagnostics.is_empty(),
        "{source:?}: {:?}",
        lexed.diagnostics
    );
    let strings: Vec<_> = lexed
        .tokens
        .iter()
        .filter(|token| token.kind == TokenKind::String)
        .collect();
    assert_eq!(strings.len(), 1, "{source:?}");
    assert_eq!(lexed.text(strings[0]), source);
    assert_eq!(lexed.reconstruct(), source);
    decode_string(source, strings[0]).unwrap_or_else(|error| panic!("{source:?}: {error:?}"))
}

fn text(source: &str, expected: &str) {
    assert_eq!(
        decode(source),
        LiteralValue::Text(expected.into()),
        "{source:?}"
    );
}

fn bytes(source: &str, expected: &[u8]) {
    assert_eq!(
        decode(source),
        LiteralValue::Bytes(expected.into()),
        "{source:?}"
    );
}

fn error(source: &str, expected_code: &str) -> Diagnostic {
    let result = decode_string(source, &token(source));
    let error = result.expect_err(source);
    assert_eq!(error.code, expected_code, "{source:?}: {error:?}");
    assert!(error.span.start <= error.span.end);
    assert!(source.get(error.span.start..error.span.end).is_some());
    error
}

#[test]
fn ordinary_quotes_and_noop_unicode_prefixes() {
    for prefix in ["", "u", "U"] {
        for delimiter in ["'", "\"", "'''", "\"\"\""] {
            text(
                &format!("{prefix}{delimiter}Hello, 世界!{delimiter}"),
                "Hello, 世界!",
            );
            text(&format!("{prefix}{delimiter}{delimiter}"), "");
        }
    }
}

#[test]
fn every_case_variant_of_bytes_and_raw_prefixes() {
    for prefix in ["b", "B"] {
        bytes(&format!("{prefix}\"\\x80\\377\""), &[128, 255]);
    }
    for prefix in ["r", "R"] {
        text(&format!("{prefix}\"\\u0061\\n\""), "\\u0061\\n");
    }
    for prefix in ["br", "bR", "Br", "BR", "rb", "rB", "Rb", "RB"] {
        bytes(&format!("{prefix}\"\\x80\\n\""), b"\\x80\\n");
    }
}

#[test]
fn standard_control_quote_and_backslash_escapes() {
    let source = r#""\\\'\"\a\b\f\n\r\t\v""#;
    let expected = "\\'\"\u{7}\u{8}\u{c}\n\r\t\u{b}";
    text(source, expected);
    bytes(&format!("b{source}"), expected.as_bytes());
}

#[test]
fn octal_consumes_one_to_three_ascii_digits() {
    text(
        r#""\0|\07|\101|\0123|\08|\377|\400|\777""#,
        "\0|\u{7}|A|\n3|\08|ÿ|Ā|ǿ",
    );
    bytes(
        r#"b"\0|\07|\101|\0123|\08|\377""#,
        b"\0|\x07|A|\n3|\x008|\xff",
    );
}

#[test]
fn hexadecimal_escapes_consume_exact_width_and_keep_remaining_digits() {
    text(r#""\x414\u004142\U0001F40D0""#, "A4A42🐍0");
    bytes(r#"b"\x414\xFF\x00""#, b"A4\xff\0");
}

#[test]
fn text_scalar_boundaries_include_noncharacters_and_decoded_nul() {
    text(
        r#""\u0000\uD7FF\uE000\uFFFF\U0010FFFF""#,
        "\0\u{d7ff}\u{e000}\u{ffff}\u{10ffff}",
    );
    text(r#""\u00E9e\u0301""#, "ée\u{301}");
}

#[test]
fn unknown_escapes_keep_the_backslash_and_original_character() {
    text(r#""\q\8\9\X41\é\{\}""#, "\\q\\8\\9\\X41\\é\\{\\}");
    bytes(
        r#"b"\q\8\9\X41\u0061\U0001F40D\N{SNAKE}""#,
        b"\\q\\8\\9\\X41\\u0061\\U0001F40D\\N{SNAKE}",
    );
}

#[test]
fn named_escapes_are_explicitly_unsupported_only_in_nonraw_text() {
    for source in [r#""\N{SNAKE}""#, r#""\N""#, r#""\N{""#] {
        assert!(error(source, "F0034").message.contains("unsupported"));
    }
    text(r#"r"\N{SNAKE}""#, "\\N{SNAKE}");
    bytes(r#"b"\N{SNAKE}""#, b"\\N{SNAKE}");
}

#[test]
fn surrogate_escapes_are_unsupported_without_pair_reinterpretation() {
    for source in [
        r#""\ud800""#,
        r#""\udfff""#,
        r#""\U0000D800""#,
        r#""\ud83d\ude00""#,
    ] {
        assert!(error(source, "F0035").message.contains("unsupported"));
    }
    text(r#"r"\ud800""#, "\\ud800");
    bytes(r#"b"\ud800""#, b"\\ud800");
}

#[test]
fn unicode_escape_values_above_the_codespace_are_errors() {
    for source in [r#""\U00110000""#, r#""\UFFFFFFFF""#] {
        error(source, "F0033");
    }
}

#[test]
fn overflowing_bytes_octal_is_explicitly_unsupported() {
    for source in [r#"b"\400""#, r#"B"\777""#] {
        assert!(error(source, "F0037").message.contains("unsupported"));
    }
    bytes(r#"br"\400""#, b"\\400");
}

#[test]
fn every_truncated_or_nonhex_escape_is_rejected() {
    for escape in [
        "\\x",
        "\\x0",
        "\\xG0",
        "\\x0g",
        "\\xé0",
        "\\x１２",
        "\\u",
        "\\u0",
        "\\u00",
        "\\u000",
        "\\u000g",
        "\\U",
        "\\U0",
        "\\U0000000",
        "\\U0000000g",
    ] {
        error(&format!("\"{escape}\""), "F0032");
    }
    for source in ["\"\\x", "\"\\u00", "\"\\U000000"] {
        error(source, "F0032");
    }
}

#[test]
fn all_physical_newline_forms_normalize_inside_triples() {
    for prefix in ["", "u", "r", "b", "br", "rb"] {
        let source = format!("{prefix}'''a\rb\r\nc\nd\\r'''");
        let expected = if prefix.contains('r') {
            "a\nb\nc\nd\\r"
        } else {
            "a\nb\nc\nd\r"
        };
        if prefix.contains('b') {
            bytes(&source, expected.as_bytes());
        } else {
            text(&source, expected);
        }
    }
}

#[test]
fn escaped_physical_newlines_are_removed_only_without_raw_prefix() {
    for newline in ["\n", "\r", "\r\n"] {
        for quote in ["'", "'''", "\"", "\"\"\""] {
            for prefix in ["", "u", "r", "b", "br", "rb"] {
                let source = format!("{prefix}{quote}a\\{newline}b{quote}");
                let expected = if prefix.contains('r') { "a\\\nb" } else { "ab" };
                if prefix.contains('b') {
                    bytes(&source, expected.as_bytes());
                } else {
                    text(&source, expected);
                }
            }
        }
    }
}

#[test]
fn raw_escaped_quotes_keep_both_characters() {
    text(r#"r"a\"b""#, "a\\\"b");
    text(r#"r'a\'b'"#, "a\\'b");
    bytes(r#"rb"a\"b""#, b"a\\\"b");
    text(r#"r"a\\""#, "a\\\\");
    for source in [r#"r"a\""#, r#"rb"a\""#, "r'\\"] {
        error(source, "F0005");
    }
}

#[test]
fn triple_quotes_close_only_at_first_unescaped_matching_run() {
    text("'''a' b'' c\"\"\"d'''", "a' b'' c\"\"\"d");
    text(r#""""a\"""b""""#, "a\"\"\"b");
    text(r#"r"""a\"""b""""#, "a\\\"\"\"b");
    for source in [
        "'''a'''junk",
        "'''a''''",
        "'''a'''''",
        "\"a\" \"b\"",
        "'a'junk",
    ] {
        error(source, "F0031");
    }
}

#[test]
fn no_unescaped_physical_newline_is_allowed_in_short_strings() {
    for newline in ["\n", "\r", "\r\n"] {
        for prefix in ["", "r", "b", "br"] {
            error(&format!("{prefix}'a{newline}b'"), "F0005");
        }
    }
}

#[test]
fn bytes_reject_nonascii_source_even_when_raw_or_backslash_prefixed() {
    for source in ["b'é'", "B'世界'", "br'🐍'", "rb'\\é'"] {
        error(source, "F0014");
        assert!(
            lex_with_dialect(source, Dialect::Python)
                .diagnostics
                .iter()
                .any(|d| d.code == "F0014")
        );
    }
    bytes(r#"b"\xE9""#, &[233]);
}

#[test]
fn source_nul_is_rejected_but_escaped_nul_is_data() {
    for prefix in ["", "u", "r", "b", "br"] {
        error(&format!("{prefix}'a\0b'"), "F0008");
        error(&format!("{prefix}'a\\\0b'"), "F0008");
    }
    text(r#""\0\x00\u0000\U00000000""#, "\0\0\0\0");
    bytes(r#"b"\0\x00""#, &[0, 0]);
}

#[test]
fn fabricated_tokens_require_exact_prefix_and_delimiter_grammar() {
    for source in [
        "", "plain", "r 'x'", "ur'x'", "ru'x'", "bb'x'", "bf'x'", "rr'x'", "rrr'x'", "é'x'",
    ] {
        error(source, "F0031");
    }
    for source in ["'", "'''", "''''", "'''''", "'abc", "\"abc'", "r'\\"] {
        error(source, "F0005");
    }
    for source in ["''a", "'a''b'", "b'a'junk", "r'a'# comment"] {
        error(source, "F0031");
    }
}

#[test]
fn formatted_and_template_prefixes_remain_explicitly_unsupported() {
    for prefix in [
        "f", "F", "fr", "fR", "rf", "RF", "t", "T", "tr", "tR", "rt", "RT",
    ] {
        let source = format!("{prefix}\"{{item}}\"");
        error(&source, "F0011");
        assert!(
            lex_with_dialect(&source, Dialect::Python)
                .diagnostics
                .iter()
                .any(|d| d.code == "F0011")
        );
    }
}

#[test]
fn malformed_external_spans_never_panic_and_produce_safe_error_spans() {
    let source = "é'x'";
    for span in [
        Span::new(1, 5),
        Span::new(0, 1),
        Span::new(5, 2),
        Span::new(0, 99),
        Span::new(usize::MAX, usize::MAX),
    ] {
        let error = decode_string(
            source,
            &Token {
                kind: TokenKind::String,
                span,
            },
        )
        .unwrap_err();
        assert_eq!(error.code, "F0030");
        assert!(source.get(error.span.start..error.span.end).is_some());
    }
    let wrong_kind = Token {
        kind: TokenKind::Identifier,
        span: Span::new(2, 5),
    };
    assert_eq!(
        decode_string(source, &wrong_kind).unwrap_err().code,
        "F0030"
    );
    assert_eq!(
        decode_string(
            source,
            &Token {
                kind: TokenKind::String,
                span: wrong_kind.span
            }
        )
        .unwrap(),
        LiteralValue::Text("x".into())
    );
}

#[test]
fn diagnostics_retain_original_absolute_utf8_and_crlf_byte_positions() {
    let source = "# 世界\r\nname = 'é\\xG1'\r\n";
    let lexed = lex_with_dialect(source, Dialect::Python);
    let token = lexed
        .tokens
        .iter()
        .find(|t| t.kind == TokenKind::String)
        .unwrap();
    let error = decode_string(source, token).unwrap_err();
    let start = source.find("\\x").unwrap();
    assert_eq!(error.code, "F0032");
    assert_eq!(error.span, Span::new(start, start + 3));
    assert_eq!(&source[error.span.start..error.span.end], "\\xG");
    assert_eq!(lexed.position(start).unwrap().line, 2);
    assert_eq!(lexed.position(start).unwrap().column, 10);
    assert_eq!(lexed.reconstruct(), source);
}

#[test]
fn structural_looking_data_is_opaque_in_both_dialects_and_all_quotes() {
    for dialect in [Dialect::Python, Dialect::Naja2026] {
        for prefix in ["", "u", "r", "b", "br", "rb"] {
            for quote in ["'", "\"", "'''", "\"\"\""] {
                let value = "# %% {# Label # } :(1) [0-9]{2}";
                let literal = format!("{prefix}{quote}{value}{quote}");
                for newline in ["\n", "\r\n", "\r"] {
                    let source = format!("# before{newline}data = {literal} # after{newline}");
                    let cst = parse_cst_with_dialect(&source, dialect);
                    assert!(
                        cst.lexed.diagnostics.is_empty(),
                        "{:?}",
                        cst.lexed.diagnostics
                    );
                    assert_eq!(cst.lexed.reconstruct(), source);
                    assert!(cst.suites.is_empty());
                    let strings: Vec<_> = cst
                        .lexed
                        .tokens
                        .iter()
                        .filter(|t| t.kind == TokenKind::String)
                        .collect();
                    assert_eq!(strings.len(), 1);
                    let string = strings[0];
                    assert_eq!(&source[string.span.start..string.span.end], literal);
                    let expected = if prefix.contains('b') {
                        LiteralValue::Bytes(value.as_bytes().into())
                    } else {
                        LiteralValue::Text(value.into())
                    };
                    assert_eq!(decode_string(&source, string).unwrap(), expected);
                }
            }
        }
    }
}

#[test]
fn generated_scalar_spellings_decode_to_the_same_original_text() {
    // Deterministic non-surrogate scalars, including four-byte UTF-8. This is
    // a semantic round trip, independent of the implementation's escape parser.
    for value in (1..=0x10ffff).step_by(7919) {
        let Some(ch) = char::from_u32(value) else {
            continue;
        };
        if ['\'', '"', '\\', '\r', '\n'].contains(&ch) {
            continue;
        }
        let expected = ch.to_string();
        text(&format!("'{ch}'"), &expected);
        text(&format!("'\\U{value:08X}'"), &expected);
        if value <= 0xffff {
            text(&format!("'\\u{value:04x}'"), &expected);
        }
    }
}

#[test]
fn all_byte_values_have_equivalent_hex_and_octal_spellings() {
    for byte in 0..=255u8 {
        bytes(&format!("b'\\x{byte:02x}'"), &[byte]);
        bytes(&format!("B'\\{byte:03o}'"), &[byte]);
    }
}

#[test]
fn bounded_large_vectors_and_exact_limit_preserve_output_size() {
    let source = format!("'{}'", "x".repeat(STRING_LITERAL_MAX_BYTES - 2));
    assert_eq!(source.len(), STRING_LITERAL_MAX_BYTES);
    let LiteralValue::Text(value) = decode_string(&source, &token(&source)).unwrap() else {
        panic!()
    };
    assert_eq!(value.len(), STRING_LITERAL_MAX_BYTES - 2);
    let too_large = format!("'{}'", "x".repeat(STRING_LITERAL_MAX_BYTES - 1));
    error(&too_large, "F0038");
    let source = format!("b'{}'", "\\x00\\377\\q".repeat(50_000));
    let LiteralValue::Bytes(value) = decode_string(&source, &token(&source)).unwrap() else {
        panic!()
    };
    assert_eq!(value.len(), 200_000);
    assert!(
        value
            .chunks_exact(4)
            .all(|chunk| chunk == [0, 255, b'\\', b'q'])
    );
}

#[test]
fn bounded_fabricated_token_vectors_have_safe_results_and_diagnostics() {
    // Exhaust every sequence of up to five characters from this deliberately
    // malformed alphabet. No timing threshold or external parser is involved.
    let alphabet = ['\'', '"', '\\', 'x', '0', '\r', '\n', 'é'];
    for length in 0..=5u32 {
        for mut index in 0..alphabet.len().pow(length) {
            let mut fragment = String::new();
            for _ in 0..length {
                fragment.push(alphabet[index % alphabet.len()]);
                index /= alphabet.len();
            }
            for prefix in ["", "r", "b", "br"] {
                let source = format!("{prefix}{fragment}");
                match decode_string(&source, &token(&source)) {
                    Ok(LiteralValue::Text(value)) => assert!(value.len() <= source.len()),
                    Ok(LiteralValue::Bytes(value)) => assert!(value.len() <= source.len()),
                    Err(error) => assert!(source.get(error.span.start..error.span.end).is_some()),
                }
            }
        }
    }
}
