#[path = "../src/manifest.rs"]
mod manifest;

use manifest::*;
use naja_frontend::{Dialect, Span};

const MINIMAL: &str = "[project]\nname = \"Example\"\n";

fn bad(source: &str) -> Vec<naja_frontend::Diagnostic> {
    let diagnostics = parse_manifest(source)
        .expect_err("invalid input must never return a partial successful manifest");
    assert!(!diagnostics.is_empty());
    assert!(diagnostics.len() <= MANIFEST_DIAGNOSTIC_LIMIT);
    for diagnostic in &diagnostics {
        assert!(diagnostic.span.start <= diagnostic.span.end);
        assert!(diagnostic.span.end <= source.len());
        assert!(
            source.is_char_boundary(diagnostic.span.start),
            "{diagnostic:?}"
        );
        assert!(
            source.is_char_boundary(diagnostic.span.end),
            "{diagnostic:?}"
        );
        assert!(!diagnostic.message.is_empty());
    }
    diagnostics
}

fn code(source: &str, expected: &str) {
    let diagnostics = bad(source);
    assert!(
        diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == expected),
        "{diagnostics:?}"
    );
}

fn project(fields: &str) -> String {
    format!("{MINIMAL}{fields}\n")
}

#[test]
fn minimal_manifest_has_explicit_name_and_no_invented_default_spans_or_host_target() {
    let parsed = parse_manifest(MINIMAL).unwrap();
    assert_eq!(parsed.source(), MINIMAL);
    assert_eq!(
        parsed.schema,
        Setting {
            value: 1,
            span: None
        }
    );
    assert_eq!(parsed.name.value, "Example");
    assert_eq!(
        parsed.dialect,
        Setting {
            value: Dialect::Naja2026,
            span: None
        }
    );
    assert_eq!(
        parsed.edition,
        Setting {
            value: Edition::Naja2026_1,
            span: None
        }
    );
    assert_eq!(
        parsed.profile,
        Setting {
            value: Profile::Hosted,
            span: None
        }
    );
    assert_eq!(
        parsed.style.require_block_levels,
        Setting {
            value: false,
            span: None
        }
    );
    assert_eq!(
        &MINIMAL[parsed.name.span.unwrap().start..parsed.name.span.unwrap().end],
        "\"Example\""
    );
    assert_eq!(parsed.entry, None);
    assert!(parsed.targets.is_empty());
    assert!(parsed.dependencies.is_empty());
}

#[test]
fn full_metadata_preserves_crlf_unicode_comments_and_original_value_spans() {
    let source = concat!(
        "# Schema-1 subset fixture, not a compiler execution.\r\n",
        "schema = 1 # explicit\r\n[project]\r\n",
        "name = \"Café é 数据 # = [ ]\" # outside string\r\n",
        "dialect = \"naja\"\r\nedition = \"2026.1\"\r\nprofile = \"core\"\r\n",
        "entry = \"源代码/main.naja\"\r\n",
        "targets = [\"x86_64-unknown-none\", \"custom-vendor-device\",] # metadata\r\n",
        "[style]\r\nrequire_block_levels = true\r\n[dependencies]\r\n",
        "[dependencies.geometry]\r\npath = \"../géométrie\"\r\n",
        "sha256 = \"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\"\r\n"
    );
    let parsed = parse_manifest(source).unwrap();
    assert_eq!(parsed.source(), source);
    assert_eq!(parsed.name.value, "Café é 数据 # = [ ]");
    assert_eq!(parsed.profile.value, Profile::Core);
    assert_eq!(parsed.entry.as_ref().unwrap().value.0, "源代码/main.naja");
    assert!(parsed.style.require_block_levels.value);
    assert_eq!(parsed.targets[1].value.0, "custom-vendor-device");
    let span = parsed.targets[1].span.unwrap();
    assert_eq!(&source[span.start..span.end], "\"custom-vendor-device\"");
    assert_eq!(parsed.dependencies[0].name.value, "geometry");
    let span = parsed.dependencies[0].name.span.unwrap();
    assert_eq!(&source[span.start..span.end], "geometry");
    assert_eq!(parsed.dependencies[0].path.value.0, "../géométrie");
    assert!(parsed.dependencies[0].sha256.is_some());
    assert_eq!(
        parsed.schema.span,
        Some(Span::new(
            source.find("1 #").unwrap(),
            source.find("1 #").unwrap() + 1
        ))
    );
}

#[test]
fn dialect_editions_are_pinned_and_style_does_not_rewrite_python_semantics() {
    let python = parse_manifest(&project("dialect = \"python\"")).unwrap();
    assert_eq!(python.dialect.value, Dialect::Python);
    assert_eq!(
        python.edition,
        Setting {
            value: Edition::Python3150,
            span: None
        }
    );
    assert_eq!(
        parse_manifest(&project("dialect = \"python\"\nedition = \"3.15.0\""))
            .unwrap()
            .edition
            .value,
        Edition::Python3150
    );
    for fields in [
        "edition = \"3.15.0\"",
        "dialect = \"python\"\nedition = \"2026.1\"",
        "dialect = \"python\"\n[style]\nrequire_block_levels = true",
    ] {
        code(&project(fields), "M0007");
    }
    for fields in [
        "dialect = \"Python\"",
        "dialect = \"javascript\"",
        "edition = \"3.15\"",
        "edition = \"future\"",
    ] {
        code(&project(fields), "M0003");
    }
}

#[test]
fn profiles_and_targets_are_typed_metadata_without_backend_or_io_claims() {
    for (name, expected) in [
        ("hosted", Profile::Hosted),
        ("core", Profile::Core),
        ("embedded", Profile::Embedded),
    ] {
        let value = parse_manifest(&project(&format!("profile = \"{name}\"\ntarget = \"custom-vendor-device\"\nentry = \"not-created/main.naja\""))).unwrap();
        assert_eq!(value.profile.value, expected);
        assert_eq!(value.targets[0].value.0, "custom-vendor-device");
    }
    code(&project("profile = \"real-time-proof\""), "M0003");
    for target in [
        "native",
        "X86_64-pc-windows-msvc",
        "x86_64--linux",
        "cpu-../../x",
        "cpu-os;run",
        "../cpu-os",
        "cpu-öther",
    ] {
        code(&project(&format!("target = \"{target}\"")), "M0007");
    }
}

#[test]
fn each_declared_local_dependency_requires_its_own_explicit_path() {
    let source = format!(
        "{MINIMAL}[dependencies.alpha]\npath = \"../alpha\"\n[dependencies.alpha-tools]\npath = \"../../tools/α\"\n"
    );
    let parsed = parse_manifest(&source).unwrap();
    assert_eq!(parsed.dependencies.len(), 2);
    assert_eq!(parsed.dependencies[1].name.value, "alpha-tools");
    assert_eq!(parsed.dependencies[1].path.value.0, "../../tools/α");
    code(
        &format!(
            "{MINIMAL}[dependencies.missing]\nsha256 = \"{}\"\n",
            "a".repeat(64)
        ),
        "M0005",
    );
    code(&format!("{MINIMAL}[dependencies.empty]\n"), "M0005");
    for hash in [
        "",
        "123",
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
    ] {
        code(
            &format!("{MINIMAL}[dependencies.a]\npath = \"vendor/a\"\nsha256 = \"{hash}\"\n"),
            "M0007",
        );
    }
}

#[test]
fn entry_cannot_escape_while_dependencies_can_declare_bounded_sibling_roots() {
    for path in ["../main.naja", "a/../../main.naja", ".."] {
        code(&project(&format!("entry = \"{path}\"")), "M0007");
    }
    for path in ["../alpha", "../../alpha", "vendor/../sibling", ".."] {
        let source = format!("{MINIMAL}[dependencies.a]\npath = \"{path}\"\n");
        assert_eq!(
            parse_manifest(&source).unwrap().dependencies[0]
                .path
                .value
                .0,
            path
        );
    }
    for path in [
        "",
        "/absolute",
        "//host/share",
        "C:/device",
        "https://example.invalid/a",
        "file:local",
        "a:stream",
        "a/what?",
        "a/star*",
        "a/<name>",
        "a/pipe|name",
        "a//b",
        "./a",
        "a/./b",
        ".git/config",
        "x/.GiT/y",
        "a/CON",
        "a/com1.txt",
        "a/LPT9",
        "a/COM¹.txt",
        "a/com²",
        "a/LPT³.tar.gz",
        "a/trailing.",
        "a/trailing ",
    ] {
        code(&project(&format!("entry = \"{path}\"")), "M0007");
        code(
            &format!("{MINIMAL}[dependencies.a]\npath = \"{path}\"\n"),
            "M0007",
        );
    }
    code(&project(r#"entry = "a\\b.naja""#), "M0007");
    code(&project(r#"entry = "a/\"name.naja""#), "M0007");
    code(&project("[dependencies.a]\npath = \"a/\\\"name\""), "M0007");
}

#[test]
fn unknown_fields_tables_shell_hooks_and_download_metadata_reject() {
    for source in [
        format!("unknown = 1\n{MINIMAL}"),
        project("shell = \"touch file\""),
        project("[build]\ncommand = \"do-not-run\""),
        project("[project.extra]\nname = \"x\""),
        project("[style]\nunknown = false"),
        project("[dependencies]\na = \"registry-name\""),
        project("[dependencies.a]\npath = \"local\"\ninstall = \"do-not-run\""),
        project("[dependencies.a]\nurl = \"https://example.invalid/source\""),
        project("[dependencies.a]\ngit = \"https://example.invalid/repo\""),
        project("[Project]\nname = \"x\""),
    ] {
        code(&source, "M0003");
    }
    code(&format!("schema = 2\n{MINIMAL}"), "M0003");
    code(
        &format!("{MINIMAL}[dependencies.naïve]\npath = \"local\""),
        "M0003",
    );
}

#[test]
fn wrong_types_reject_for_each_field_instead_of_coercion() {
    for source in [
        format!("schema = \"1\"\n{MINIMAL}"),
        "[project]\nname = true\n".into(),
        project("dialect = true"),
        project("edition = 2026"),
        project("profile = []"),
        project("entry = false"),
        project("target = [\"cpu-os\"]"),
        project("targets = \"cpu-os\""),
        project("[style]\nrequire_block_levels = \"true\""),
        project("[dependencies.a]\npath = []"),
        project("[dependencies.a]\npath = \"local\"\nsha256 = true"),
    ] {
        code(&source, "M0006");
    }
}

#[test]
fn duplicate_fields_tables_targets_and_singular_plural_conflicts_reject() {
    for source in [
        format!("schema = 1\nschema = 1\n{MINIMAL}"),
        project("name = \"Example\""),
        project("[project]\nname = \"Example\""),
        project("[style]\n[style]"),
        project("target = \"cpu-os\"\ntarget = \"cpu-os\""),
        project("target = \"cpu-os\"\ntargets = [\"cpu-os\"]"),
        project("targets = [\"cpu-os\"]\ntarget = \"cpu-os\""),
        project("targets = [\"cpu-os\", \"cpu-os\"]"),
        project("[dependencies.a]\npath = \"local\"\npath = \"local\""),
        project("[dependencies.a]\npath = \"local\"\n[dependencies.a]\npath = \"local\""),
    ] {
        code(&source, "M0004");
    }
}

#[test]
fn full_toml_forms_outside_the_subset_are_explicit_errors() {
    for fields in [
        "entry = 'src/main.naja'",
        "entry = \"\"\"src/main.naja\"\"\"",
        "\"entry\" = \"src/main.naja\"",
        "project.entry = \"src/main.naja\"",
        "[\"style\"]",
        "[[dependencies.a]]",
        "targets = [\n\"cpu-os\"\n]",
        "targets = [[\"cpu-os\"]]",
        "targets = [1]",
        "targets = [true]",
        "targets = [\"cpu-os\" \"cpu-two\"]",
        "target = { value = \"cpu-os\" }",
        "entry = 2026-10-25",
        "entry = 1.0",
        "entry = -1",
        "entry = +1",
        "entry = 0x10",
        "entry = 1_000",
        "entry = 01",
        "entry = truex",
        "entry = null",
        "entry = \"a\" ; entry = \"b\"",
    ] {
        bad(&project(fields));
    }
    code(&format!("\u{feff}{MINIMAL}"), "M0003");
    code(&project("[dependencies.a.extra]\npath = \"x\""), "M0003");
}

#[test]
fn unicode_escapes_are_decoded_without_normalization_and_spans_stay_raw() {
    let source = "[project]\nname = \"Caf\\u00e9 e\\u0301 \\U0001f40d \\\"#\\\"\"\n";
    let parsed = parse_manifest(source).unwrap();
    assert_eq!(parsed.name.value, "Café é 🐍 \"#\"");
    let span = parsed.name.span.unwrap();
    assert_eq!(
        &source[span.start..span.end],
        "\"Caf\\u00e9 e\\u0301 \\U0001f40d \\\"#\\\"\""
    );
    let mut canonical = source.to_owned();
    canonical.push_str("# changed raw spelling retained\n");
    assert_ne!(
        parse_manifest(&canonical).unwrap().source(),
        parsed.source()
    );
}

#[test]
fn malformed_escapes_controls_and_truncated_tokens_report_original_utf8_boundaries() {
    for name in [
        r#""\uD800""#,
        r#""\U00110000""#,
        r#""\u12z4""#,
        r#""\u123""#,
        r#""\q""#,
        "\"\\é\"",
        "\"unfinished",
        "\"trailing\\",
        "\"raw\u{7f}control\"",
        "\"raw\0control\"",
    ] {
        code(&format!("[project]\nname = {name}\n"), "M0002");
    }
    for name in [
        r#""line\nfeed""#,
        r#""\t""#,
        r#""\b""#,
        r#""\f""#,
        r#""\r""#,
    ] {
        code(&format!("[project]\nname = {name}\n"), "M0007");
    }
    code("[project]\rname = \"x\"\n", "M0002");
    for text in ["", "# only comments\n", "schema = 1\n", "[project]\n"] {
        code(text, "M0005");
    }
    for offset in MINIMAL.char_indices().map(|(offset, _)| offset) {
        let _ = parse_manifest(&MINIMAL[..offset]);
    }
}

#[test]
fn limits_are_frozen_before_testing_and_enforce_exact_utf8_byte_boundaries() {
    assert_eq!(
        (
            MANIFEST_MAX_BYTES,
            MANIFEST_LINE_MAX_BYTES,
            MANIFEST_DECLARATION_LIMIT
        ),
        (65536, 8192, 128)
    );
    assert_eq!(
        (
            MANIFEST_DEPENDENCY_LIMIT,
            MANIFEST_ARRAY_LIMIT,
            MANIFEST_STRING_MAX_BYTES
        ),
        (32, 16, 4096)
    );
    assert_eq!(
        (
            MANIFEST_NAME_MAX_BYTES,
            MANIFEST_DEPENDENCY_NAME_MAX_BYTES,
            MANIFEST_TARGET_MAX_BYTES
        ),
        (256, 64, 96)
    );
    assert_eq!(
        (
            MANIFEST_PATH_MAX_BYTES,
            MANIFEST_PATH_COMPONENT_LIMIT,
            MANIFEST_DIAGNOSTIC_LIMIT
        ),
        (1024, 32, 32)
    );
    parse_manifest(&format!("[project]\nname = \"{}\"", "é".repeat(128))).unwrap();
    code(
        &format!("[project]\nname = \"{}\"", "é".repeat(129)),
        "M0001",
    );
    parse_manifest(&project(&format!("entry = \"{}\"", "x".repeat(1024)))).unwrap();
    code(
        &project(&format!("entry = \"{}\"", "x".repeat(1025))),
        "M0001",
    );
    parse_manifest(&project(&format!(
        "entry = \"{}\"",
        vec!["x"; 32].join("/")
    )))
    .unwrap();
    code(
        &project(&format!("entry = \"{}\"", vec!["x"; 33].join("/"))),
        "M0001",
    );
    parse_manifest(&project(&format!("target = \"{}-os\"", "x".repeat(93)))).unwrap();
    code(
        &project(&format!("target = \"{}-os\"", "x".repeat(94))),
        "M0001",
    );
    code(
        &project(&format!("entry = \"{}\"", "x".repeat(4097))),
        "M0001",
    );
}

#[test]
fn total_config_and_physical_line_budgets_accept_boundaries_and_reject_above() {
    let mut source = MINIMAL.to_owned();
    while source.len() < MANIFEST_MAX_BYTES {
        let remaining = MANIFEST_MAX_BYTES - source.len();
        let bytes = remaining.min(MANIFEST_LINE_MAX_BYTES);
        source.push('#');
        if bytes > 1 {
            source.push_str(&"x".repeat(bytes - 2));
            source.push('\n');
        }
    }
    assert_eq!(source.len(), MANIFEST_MAX_BYTES);
    parse_manifest(&source).unwrap();
    source.push('x');
    code(&source, "M0001");
    parse_manifest(&format!("{MINIMAL}#{}", "x".repeat(8191))).unwrap();
    code(&format!("{MINIMAL}#{}", "x".repeat(8192)), "M0001");
}

#[test]
fn arrays_dependency_counts_labels_and_table_depth_are_bounded() {
    let targets = (0..16)
        .map(|index| format!("\"cpu{index}-vendor-os\""))
        .collect::<Vec<_>>()
        .join(",");
    assert_eq!(
        parse_manifest(&project(&format!("targets = [{targets}]")))
            .unwrap()
            .targets
            .len(),
        16
    );
    code(
        &project(&format!("targets = [{targets},\"extra-vendor-os\"]")),
        "M0001",
    );
    code(&project("targets = []"), "M0007");
    let mut source = MINIMAL.to_owned();
    for index in 0..32 {
        source.push_str(&format!(
            "[dependencies.d{index}]\npath = \"../d{index}\"\n"
        ));
    }
    assert_eq!(parse_manifest(&source).unwrap().dependencies.len(), 32);
    source.push_str("[dependencies.extra]\npath = \"../extra\"\n");
    code(&source, "M0001");
    parse_manifest(&format!(
        "{MINIMAL}[dependencies.{}]\npath = \"local\"\n",
        "a".repeat(64)
    ))
    .unwrap();
    code(
        &format!(
            "{MINIMAL}[dependencies.{}]\npath = \"local\"\n",
            "a".repeat(65)
        ),
        "M0001",
    );
    code(
        &project(&format!(
            "targets = {}\"x\"{}",
            "[".repeat(2000),
            "]".repeat(2000)
        )),
        "M0003",
    );
}

#[test]
fn diagnostic_cap_is_deterministic_and_invalid_input_never_returns_partial_success() {
    let source = format!(
        "{MINIMAL}{}",
        (0..200)
            .map(|index| format!("unknown_{index} = true\n"))
            .collect::<String>()
    );
    let first = bad(&source);
    assert_eq!(first.len(), 32);
    assert_eq!(first, bad(&source));
    for source in [
        format!("{MINIMAL}[unknown]\nname = \"replacement\"\n"),
        format!("{MINIMAL}[project]\nname = \"replacement\"\n"),
    ] {
        bad(&source);
    }
}

#[test]
fn deterministic_scalar_mutations_cannot_panic_or_escape_resource_and_span_bounds() {
    let scalars = [
        'a',
        'é',
        '数',
        '\u{1f40d}',
        '\0',
        '\r',
        '\n',
        '\t',
        '#',
        '=',
        '[',
        ']',
        '{',
        '}',
        '\\',
        '"',
        '\'',
        '.',
        ':',
        '0',
    ];
    let mut seed = 0x4e414a41_u64;
    for _ in 0..1200 {
        let mut source = String::new();
        for _ in 0..48 {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
            source.push(scalars[(seed as usize) % scalars.len()]);
        }
        if let Err(diagnostics) = parse_manifest(&source) {
            assert!(!diagnostics.is_empty());
            assert!(diagnostics.len() <= 32);
            for diagnostic in diagnostics {
                assert!(
                    diagnostic.span.start <= diagnostic.span.end
                        && diagnostic.span.end <= source.len()
                );
                assert!(
                    source.is_char_boundary(diagnostic.span.start)
                        && source.is_char_boundary(diagnostic.span.end)
                );
            }
        }
    }
}
