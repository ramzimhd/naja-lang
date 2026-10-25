use naja_frontend::{
    ALIAS_CONFIG_MAX_BYTES, ALIAS_DIAGNOSTIC_LIMIT, ALIAS_NAME_MAX_BYTES, AliasContext,
    AliasEnvironment, AliasTable, AliasTarget, BuiltinAlias, Diagnostic, Dialect, Span, Symbol,
    TokenKind, canonical_identifier, lex_with_dialect, parse_aliases,
};

const ENVIRONMENT: AliasEnvironment<'_> = AliasEnvironment {
    edition: "2026.1",
    policy: "project-owned; aliases-enabled",
};
const CONFIG: &str = include_str!("../../compatibility/aliases/comparison.alias");

fn parse(source: &str) -> AliasTable {
    parse_aliases(source, ENVIRONMENT).unwrap_or_else(|errors| panic!("{source:?}: {errors:?}"))
}

fn errors(source: &str, code: &str) -> Vec<Diagnostic> {
    let errors = parse_aliases(source, ENVIRONMENT).unwrap_err();
    assert!(
        errors.iter().any(|error| error.code == code),
        "{source:?}: {errors:?}"
    );
    assert!(errors.len() <= ALIAS_DIAGNOSTIC_LIMIT);
    for error in &errors {
        assert!(
            source.get(error.span.start..error.span.end).is_some(),
            "{error:?}"
        );
    }
    errors
}

fn lookup(table: &AliasTable, context: AliasContext, raw: &str) -> Option<AliasTarget> {
    table
        .lookup(context, &canonical_identifier(raw).unwrap())
        .map(|entry| entry.target)
}

#[test]
fn empty_optional_configuration_and_default_schema_are_supported() {
    for source in ["", " ", "# comment", "\t# comment\r\n", "schema = 1"] {
        assert!(parse(source).entries().is_empty());
    }
    let implicit = parse("[operators]\n\"==\" = \"equalTo\"\n");
    let explicit = parse("schema = 1\n[operators]\n\"==\" = \"equalTo\"\n");
    assert_eq!(implicit.entries()[0].target, explicit.entries()[0].target);
    assert_ne!(implicit.cache_identity(), explicit.cache_identity());
}

#[test]
fn all_eight_documented_targets_map_to_canonical_nodes() {
    let table = parse(CONFIG);
    assert_eq!(table.entries().len(), 8);
    for (name, symbol) in [
        ("equalTo", Symbol::EqualEqual),
        ("notEqualTo", Symbol::NotEqual),
        ("lessThan", Symbol::Less),
        ("lessThanOrEqualTo", Symbol::LessEqual),
        ("greaterThan", Symbol::Greater),
        ("greaterThanOrEqualTo", Symbol::GreaterEqual),
    ] {
        assert_eq!(
            lookup(&table, AliasContext::ComparisonOperator, name),
            Some(AliasTarget::Comparison(symbol))
        );
        assert_eq!(lookup(&table, AliasContext::UnboundBuiltin, name), None);
    }
    for (name, builtin) in [
        ("display", BuiltinAlias::Print),
        ("length", BuiltinAlias::Len),
    ] {
        assert_eq!(
            lookup(&table, AliasContext::UnboundBuiltin, name),
            Some(AliasTarget::Builtin(builtin))
        );
        assert_eq!(lookup(&table, AliasContext::ComparisonOperator, name), None);
    }
}

#[test]
fn comparison_mapping_preserves_the_exact_canonical_operators() {
    let table = parse(CONFIG);
    // A grammar consumer receives the same comparison node variants and can
    // retain its existing chain/precedence logic. No new precedence is defined.
    let alias_chain = ["lessThan", "equalTo", "greaterThanOrEqualTo"];
    let canonical = [Symbol::Less, Symbol::EqualEqual, Symbol::GreaterEqual];
    for (alias, symbol) in alias_chain.into_iter().zip(canonical) {
        assert_eq!(
            lookup(&table, AliasContext::ComparisonOperator, alias),
            Some(AliasTarget::Comparison(symbol))
        );
    }
    assert!(
        table
            .lookup(AliasContext::ComparisonOperator, "lessThen")
            .is_none()
    );
    assert!(
        table
            .lookup(AliasContext::ComparisonOperator, "LessThan")
            .is_none()
    );
}

#[test]
fn original_configuration_and_quoted_spans_survive_escape_decoding() {
    let source = "# 世界\r\n[ operators ] # section\r\n  \"\\u003d=\" \t= \"\\u0065qualTo\" # explanation\r\n";
    let table = parse(source);
    assert_eq!(table.source(), source);
    let entry = &table.entries()[0];
    assert_eq!(entry.alias, "equalTo");
    assert_eq!(entry.canonical_alias, "equalTo");
    assert_eq!(
        &source[entry.key_span.start..entry.key_span.end],
        "\"\\u003d=\""
    );
    assert_eq!(
        &source[entry.value_span.start..entry.value_span.end],
        "\"\\u0065qualTo\""
    );
    assert_eq!(
        &source[entry.span.start..entry.span.end],
        "\"\\u003d=\" \t= \"\\u0065qualTo\""
    );
    assert!(entry.key_span.start > "# 世界\r\n".len());
}

#[test]
fn multilingual_and_non_bmp_aliases_use_the_shared_identifier_rules() {
    let table = parse(
        "[operators]\n\"==\"=\"égal\"\n\"!=\"=\"不同\"\n\"<\"=\"أصغر\"\n\"<=\"=\"\\U00010400\"\n",
    );
    for name in ["égal", "不同", "أصغر", "\u{10400}"] {
        assert!(lookup(&table, AliasContext::ComparisonOperator, name).is_some());
    }
    assert_eq!(table.entries()[0].alias, "égal");
}

#[test]
fn unicode_equivalent_names_resolve_without_case_folding() {
    let table = parse("[operators]\n\"==\"=\"café\"\n\"!=\"=\"EqualTo\"\n\"<\"=\"equalTo\"\n");
    assert_eq!(
        lookup(&table, AliasContext::ComparisonOperator, "cafe\u{301}"),
        Some(AliasTarget::Comparison(Symbol::EqualEqual))
    );
    assert_eq!(
        lookup(&table, AliasContext::ComparisonOperator, "ｅｑｕａｌＴｏ"),
        Some(AliasTarget::Comparison(Symbol::Less))
    );
    assert_eq!(
        lookup(&table, AliasContext::ComparisonOperator, "EqualTo"),
        Some(AliasTarget::Comparison(Symbol::NotEqual))
    );
    assert!(
        table
            .lookup(AliasContext::ComparisonOperator, "EQUALTO")
            .is_none()
    );
}

#[test]
fn duplicate_names_are_detected_across_targets_tables_and_nfkc_spellings() {
    for source in [
        "[operators]\n\"==\"=\"same\"\n\"!=\"=\"same\"",
        "[operators]\n\"==\"=\"same\"\n[builtins]\n\"print\"=\"same\"",
        "[operators]\n\"==\"=\"café\"\n\"!=\"=\"cafe\\u0301\"",
        "[operators]\n\"==\"=\"K\"\n\"!=\"=\"K\"",
    ] {
        errors(source, "A0008");
    }
}

#[test]
fn duplicate_schema_tables_and_decoded_keys_are_rejected() {
    for source in [
        "schema=1\nschema=1",
        "[operators]\n[operators]",
        "[builtins]\n[builtins]",
        "[operators]\n\"==\"=\"one\"\n\"\\u003d=\"=\"two\"",
        "[builtins]\n\"print\"=\"display\"\n\"print\"=\"show\"",
    ] {
        errors(source, "A0005");
    }
}

#[test]
fn raw_keywords_and_canonical_builtin_conflicts_are_rejected() {
    for name in [
        "False",
        "None",
        "True",
        "and",
        "async",
        "await",
        "class",
        "if",
        "else",
        "return",
        "while",
        "match",
        "case",
        "type",
        "_",
        "print",
        "len",
        "ｐｒｉｎｔ",
    ] {
        errors(&format!("[operators]\n\"==\"=\"{name}\""), "A0007");
    }
}

#[test]
fn nfkc_keyword_lookalikes_keep_the_existing_raw_keyword_contract() {
    // The grammar checks raw "if" first. The fullwidth spelling is an
    // identifier and may have this canonical key without reserving new words.
    let table = parse("[operators]\n\"==\"=\"ｉｆ\"\n");
    assert_eq!(table.entries()[0].canonical_alias, "if");
    assert_eq!(
        lookup(&table, AliasContext::ComparisonOperator, "ｉｆ"),
        Some(AliasTarget::Comparison(Symbol::EqualEqual))
    );
    errors("[operators]\n\"==\"=\"if\"", "A0007");
}

#[test]
fn unimplemented_tables_and_canonical_targets_are_explicitly_unsupported() {
    errors("[[operators]]\n\"==\"=\"equalTo\"", "A0003");
    for section in [
        "keywords",
        "types",
        "imports",
        "operator",
        "Operators",
        "operators.extra",
        "\"operators\"",
    ] {
        let diagnostics = errors(&format!("[{section}]\n\"==\"=\"equalTo\""), "A0003");
        assert!(diagnostics[0].message.contains("Unsupported"));
    }
    for key in ["+", "*", "and", "in", "is", "×", "== =="] {
        errors(&format!("[operators]\n\"{key}\"=\"aliasName\""), "A0003");
    }
    for key in ["open", "Print", "str", "int"] {
        errors(&format!("[builtins]\n\"{key}\"=\"aliasName\""), "A0003");
    }
}

#[test]
fn invalid_names_and_glyph_aliases_are_not_silently_reinterpreted() {
    for name in [
        "",
        "×",
        "÷",
        "==",
        "two words",
        "a-b",
        "1alias",
        "\u{301}a",
        "🐍",
    ] {
        errors(&format!("[operators]\n\"==\"=\"{name}\""), "A0006");
    }
}

#[test]
fn toml_quoted_escapes_decode_before_identifier_validation() {
    let table = parse("[operators]\n\"==\"=\"\\u0065qual\\U00000054o\"\n");
    assert_eq!(table.entries()[0].alias, "equalTo");
    for escape in ["\\\"", "\\\\", "\\b", "\\t", "\\n", "\\f", "\\r"] {
        // These are syntactically valid TOML escapes but not alias identifiers.
        errors(&format!("[operators]\n\"==\"=\"a{escape}b\""), "A0006");
    }
}

#[test]
fn unknown_malformed_and_nonscalar_toml_escapes_are_errors() {
    for escape in [
        "\\q",
        "\\x41",
        "\\0",
        "\\N{SNAKE}",
        "\\u",
        "\\u123",
        "\\uGGGG",
        "\\uD800",
        "\\U00110000",
        "\\UFFFFFFFF",
        "\\u１２３４",
    ] {
        errors(&format!("[operators]\n\"==\"=\"{escape}\""), "A0002");
    }
    errors("[operators]\n\"==\"=\"a\\", "A0002");
}

#[test]
fn comments_and_hashes_are_recognized_only_outside_basic_strings() {
    let table = parse("# before\n[operators]# section\n\"==\"=\"equalTo\"# after\n");
    assert_eq!(table.entries().len(), 1);
    errors("[operators]\n\"==\"=\"equal#To\"", "A0006");
    errors("[operators]\n\"#\"=\"equalTo\"", "A0003");
    errors("[operators]\n\"==\"=\"equalTo # missing quote", "A0002");
}

#[test]
fn syntax_is_strict_and_unknown_toml_forms_do_not_fall_back() {
    for source in [
        "schema",
        "schema1=1",
        "schema=10",
        "schema=1 trailing",
        "[operators",
        "[operators]junk",
        "[operators]\n\"==\" \"equalTo\"",
        "[operators]\n\"==\"=\"a\";\"!=\"=\"b\"",
        "[operators]\n\"==\"=\"a\" \"!=\"=\"b\"",
        "[operators]\n\"==\"=\"a\"\0",
        "[operators]\n\"==\"=\"unterminated",
        "# bad\0comment",
        "# bad\u{7f}",
    ] {
        errors(source, "A0002");
    }
    for source in [
        "unknown=1",
        "\u{feff}schema=1",
        "[operators]\n== = \"equalTo\"",
        "[operators]\n\"==\"='equalTo'",
        "[operators]\n\"==\"=\"\"\"equalTo\"\"\"",
        "[operators]\n\"==\"=[\"equalTo\"]",
        "[operators]\nschema=1",
    ] {
        errors(source, "A0003");
    }
    for source in [
        "schema=0",
        "schema=2",
        "schema=\"1\"",
        "schema=true",
        "schema=-1",
    ] {
        errors(source, "A0004");
    }
}

#[test]
fn every_disallowed_unescaped_ascii_control_is_rejected_in_strings_and_comments() {
    for byte in (0..=31u8).chain([127]) {
        if [9, 10, 13].contains(&byte) {
            continue;
        }
        errors(
            &format!("[operators]\n\"==\"=\"a{}b\"", byte as char),
            "A0002",
        );
        errors(&format!("# a{}b", byte as char), "A0002");
    }
    assert!(parse("# tabs\there\n").entries().is_empty());
}

#[test]
fn physical_lf_and_crlf_preserve_mapping_but_change_exact_cache_identity() {
    let lf = parse(CONFIG);
    let crlf_source = CONFIG.replace('\n', "\r\n");
    let crlf = parse(&crlf_source);
    assert_eq!(
        lf.entries()
            .iter()
            .map(|e| (&e.alias, e.target))
            .collect::<Vec<_>>(),
        crlf.entries()
            .iter()
            .map(|e| (&e.alias, e.target))
            .collect::<Vec<_>>()
    );
    assert_ne!(lf.cache_identity(), crlf.cache_identity());
    assert_eq!(crlf.source(), crlf_source);
    errors("[operators]\r\"==\"=\"equalTo\"", "A0002");
    errors("# comment\r", "A0002");
}

#[test]
fn error_spans_refer_to_original_config_not_source_or_decoded_alias_bytes() {
    let source = "# 世界\r\n[operators]\r\n\"==\" = \"a\\u0020b\"\r\n";
    let diagnostics = errors(source, "A0006");
    let start = source.find("\"a\\u0020b\"").unwrap();
    assert_eq!(
        diagnostics[0].span,
        Span::new(start, start + "\"a\\u0020b\"".len())
    );
}

#[test]
fn config_alias_and_environment_resource_boundaries_are_explicit() {
    let name = "a".repeat(ALIAS_NAME_MAX_BYTES);
    assert_eq!(
        parse(&format!("[operators]\n\"==\"=\"{name}\"")).entries()[0]
            .alias
            .len(),
        ALIAS_NAME_MAX_BYTES
    );
    errors(&format!("[operators]\n\"==\"=\"{name}a\""), "A0001");
    let name = "é".repeat(ALIAS_NAME_MAX_BYTES / 2);
    assert!(
        parse(&format!("[operators]\n\"==\"=\"{name}\""))
            .entries()
            .len()
            == 1
    );
    errors(&format!("[operators]\n\"==\"=\"{name}é\""), "A0001");
    let source = format!("#{}", "x".repeat(ALIAS_CONFIG_MAX_BYTES - 1));
    assert!(parse(&source).entries().is_empty());
    errors(&format!("{source}x"), "A0001");
    let edition = "x".repeat(128);
    let policy = "y".repeat(4096);
    assert!(
        parse_aliases(
            "",
            AliasEnvironment {
                edition: &edition,
                policy: &policy
            }
        )
        .is_ok()
    );
    let invalid = parse_aliases(
        "",
        AliasEnvironment {
            edition: &format!("{edition}x"),
            policy: &policy,
        },
    )
    .unwrap_err();
    assert_eq!(invalid[0].code, "A0001");
    assert_eq!(invalid[0].span, Span::new(0, 0));
    let invalid = parse_aliases(
        "",
        AliasEnvironment {
            edition: &edition,
            policy: &format!("{policy}y"),
        },
    )
    .unwrap_err();
    assert_eq!(invalid[0].code, "A0001");
}

#[test]
fn cache_identity_is_exact_deterministic_and_length_delimited() {
    let table = parse(CONFIG);
    for _ in 0..20 {
        assert_eq!(parse(CONFIG).cache_identity(), table.cache_identity());
    }
    assert!(
        table
            .cache_identity()
            .starts_with(b"NAJA.alias\0\0\0\0\0\0\0\0\x01")
    );
    let a = parse_aliases(
        "",
        AliasEnvironment {
            edition: "ab",
            policy: "c",
        },
    )
    .unwrap();
    let b = parse_aliases(
        "",
        AliasEnvironment {
            edition: "a",
            policy: "bc",
        },
    )
    .unwrap();
    assert_ne!(a.cache_identity(), b.cache_identity());
    for environment in [
        AliasEnvironment {
            edition: "2026.2",
            ..ENVIRONMENT
        },
        AliasEnvironment {
            policy: "different",
            ..ENVIRONMENT
        },
    ] {
        assert_ne!(
            parse_aliases(CONFIG, environment).unwrap().cache_identity(),
            table.cache_identity()
        );
    }
    assert_ne!(
        parse(&format!("{CONFIG}# comment\n")).cache_identity(),
        table.cache_identity()
    );
}

#[test]
fn lookup_does_not_mutate_tokens_members_bindings_comments_or_string_data() {
    let source =
        "equalTo = 7\nobj.equalTo(display=equalTo)\ntext = r'equalTo # %% {2}' # display\n";
    let table = parse(CONFIG);
    for dialect in [Dialect::Python, Dialect::Naja2026] {
        let lexed = lex_with_dialect(source, dialect);
        assert!(lexed.diagnostics.is_empty());
        let original_tokens = lexed.tokens.clone();
        for token in &lexed.tokens {
            if token.kind == TokenKind::Identifier {
                let key = canonical_identifier(lexed.text(token)).unwrap();
                let _ = table.lookup(AliasContext::ComparisonOperator, &key);
                let _ = table.lookup(AliasContext::UnboundBuiltin, &key);
            }
        }
        assert_eq!(lexed.tokens, original_tokens);
        assert_eq!(lexed.reconstruct(), source);
        assert_eq!(table.source(), CONFIG);
    }
}

#[test]
fn diagnostic_accumulation_is_capped_and_invalid_tables_do_not_leak_previous_context() {
    let source = "bad=1\n".repeat(ALIAS_DIAGNOSTIC_LIMIT + 20);
    assert_eq!(errors(&source, "A0003").len(), ALIAS_DIAGNOSTIC_LIMIT);
    let diagnostics = errors(
        "[operators]\n\"==\"=\"equalTo\"\n[types]\n\"!=\"=\"equalTo\"",
        "A0003",
    );
    assert_eq!(diagnostics.len(), 1);
}

#[test]
fn bounded_malformed_configuration_vectors_have_safe_diagnostic_spans() {
    let alphabet = ['[', ']', '=', '"', '\\', '#', '\r', 'é'];
    for length in 0..=4u32 {
        for mut index in 0..alphabet.len().pow(length) {
            let mut fragment = String::new();
            for _ in 0..length {
                fragment.push(alphabet[index % alphabet.len()]);
                index /= alphabet.len();
            }
            for prefix in ["", "[operators]\n"] {
                let source = format!("{prefix}{fragment}");
                match parse_aliases(&source, ENVIRONMENT) {
                    Ok(table) => assert_eq!(table.source(), source),
                    Err(diagnostics) => {
                        assert!(!diagnostics.is_empty());
                        assert!(diagnostics.len() <= ALIAS_DIAGNOSTIC_LIMIT);
                        assert!(
                            diagnostics
                                .iter()
                                .all(|d| source.get(d.span.start..d.span.end).is_some())
                        );
                    }
                }
            }
        }
    }
}
