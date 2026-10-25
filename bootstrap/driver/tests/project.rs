#[path = "../src/project.rs"]
mod project;

use naja_frontend::{ALIAS_CONFIG_MAX_BYTES, AliasContext, AliasTarget, Dialect, Symbol};
use project::{MANIFEST_MARKER_MAX_BYTES, load_aliases};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

static NEXT_FIXTURE: AtomicU64 = AtomicU64::new(0);
const ALIASES: &str = "[operators]\n\"==\" = \"equalTo\"\n[builtins]\n\"print\" = \"display\"\n";
const MANIFEST: &str = "[project]\nname = \"test\"\n";

fn maximum_manifest() -> String {
    let mut source = MANIFEST.to_owned();
    while source.len() < MANIFEST_MARKER_MAX_BYTES {
        let bytes = (MANIFEST_MARKER_MAX_BYTES - source.len()).min(8192);
        source.push('#');
        if bytes > 1 {
            source.push_str(&"x".repeat(bytes - 2));
            source.push('\n');
        }
    }
    source
}

struct Fixture {
    base: PathBuf,
    temp: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let temp = fs::canonicalize(std::env::temp_dir()).unwrap();
        let base = temp.join(format!(
            "naja-project-loader-{}-{}",
            std::process::id(),
            NEXT_FIXTURE.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&base).unwrap();
        Self { base, temp }
    }

    fn project(&self, name: &str) -> PathBuf {
        let root = self.base.join(name);
        fs::create_dir(&root).unwrap();
        fs::write(root.join("naja.toml"), MANIFEST).unwrap();
        fs::write(root.join("main.naja"), "print(1)\n").unwrap();
        root
    }

    fn aliases(&self, root: &Path) {
        fs::write(root.join("naja.alias"), ALIASES).unwrap();
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        // This is a newly created, unique test directory under the canonical
        // temporary root. No cleanup target comes from a project/config path.
        assert_eq!(self.base.parent(), Some(self.temp.as_path()));
        assert!(
            self.base
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("naja-project-loader-")
        );
        let _ = fs::remove_dir_all(&self.base);
    }
}

fn failure(root: &Path, module: &Path, fragment: &str) -> String {
    let error = load_aliases(root, module, Dialect::Naja2026).unwrap_err();
    assert!(error.starts_with("NJA030:"), "{error}");
    assert!(error.contains(fragment), "Expected {fragment:?}: {error}");
    error
}

#[test]
fn ordinary_project_uses_shared_alias_service_and_preserves_raw_config() {
    let fixture = Fixture::new();
    let root = fixture.project("ordinary");
    fixture.aliases(&root);
    let table = load_aliases(&root, Path::new("main.naja"), Dialect::Naja2026)
        .unwrap()
        .unwrap();
    assert_eq!(table.source(), ALIASES);
    assert_eq!(table.entries().len(), 2);
    assert_eq!(
        table
            .lookup(AliasContext::ComparisonOperator, "equalTo")
            .unwrap()
            .target,
        AliasTarget::Comparison(Symbol::EqualEqual)
    );
    assert!(
        table
            .lookup(AliasContext::UnboundBuiltin, "display")
            .is_some()
    );
    let again = load_aliases(&root, &root.join("main.naja"), Dialect::Naja2026)
        .unwrap()
        .unwrap();
    assert_eq!(table.cache_identity(), again.cache_identity());
    assert_eq!(
        fs::read_to_string(root.join("naja.alias")).unwrap(),
        ALIASES
    );
}

#[test]
fn absent_root_alias_is_optional_after_ownership_and_manifest_validation() {
    let fixture = Fixture::new();
    let root = fixture.project("optional");
    assert!(
        load_aliases(&root, Path::new("main.naja"), Dialect::Naja2026)
            .unwrap()
            .is_none()
    );
    fs::remove_file(root.join("naja.toml")).unwrap();
    failure(&root, Path::new("main.naja"), "naja.toml");
}

#[test]
fn missing_roots_modules_and_manifests_are_errors() {
    let fixture = Fixture::new();
    failure(
        &fixture.base.join("missing"),
        Path::new("main.naja"),
        "project root",
    );
    let root = fixture.project("missing-files");
    failure(&root, Path::new("missing.naja"), "owning module");
    fs::remove_file(root.join("naja.toml")).unwrap();
    failure(&root, Path::new("main.naja"), "naja.toml");
    failure(
        &root.join("main.naja"),
        Path::new("main.naja"),
        "ordinary directory",
    );
}

#[test]
fn relative_modules_are_relative_to_the_explicit_root() {
    let fixture = Fixture::new();
    let root = fixture.project("relative");
    fixture.aliases(&root);
    fs::create_dir(root.join("src")).unwrap();
    fs::write(root.join("src/entry.naja"), "print(2)\n").unwrap();
    assert!(
        load_aliases(&root, Path::new("src/entry.naja"), Dialect::Naja2026)
            .unwrap()
            .is_some()
    );
}

#[test]
fn canonical_containment_uses_path_components_and_rejects_sibling_prefixes() {
    let fixture = Fixture::new();
    let root = fixture.project("owner");
    let sibling = fixture.project("owner-other");
    fixture.aliases(&root);
    failure(&root, &sibling.join("main.naja"), "outside");
}

#[test]
fn python_explicit_activation_fails_before_any_filesystem_access() {
    let error = load_aliases(
        Path::new("missing-root"),
        Path::new("missing.py"),
        Dialect::Python,
    )
    .unwrap_err();
    assert!(error.contains("Python compatibility dialect"));
    let fixture = Fixture::new();
    let root = fixture.project("python");
    fixture.aliases(&root);
    fs::write(root.join("main.py"), "equalTo = 7\n").unwrap();
    assert!(
        load_aliases(&root, &root.join("main.py"), Dialect::Python)
            .unwrap_err()
            .contains("Python compatibility dialect")
    );
    failure(&root, &root.join("main.py"), ".naja module");
}

#[test]
fn additional_extensions_and_parent_traversal_are_explicitly_unsupported() {
    let fixture = Fixture::new();
    let root = fixture.project("plain-paths");
    for module in ["main", "main.txt", "main.NAJA"] {
        failure(&root, Path::new(module), ".naja module");
    }
    failure(
        &root,
        Path::new("../plain-paths/main.naja"),
        "parent traversal",
    );
    // Construct the original spelling without PathBuf::join normalizing a
    // verbatim Windows path before the loader sees it.
    let root_with_parent = PathBuf::from(format!(
        "{root}{sep}..{sep}plain-paths",
        root = root.display(),
        sep = std::path::MAIN_SEPARATOR
    ));
    failure(
        &root_with_parent,
        Path::new("main.naja"),
        "parent traversal",
    );
}

#[test]
fn manifest_is_bounded_utf8_parsed_configuration_instead_of_arbitrary_marker_text() {
    let fixture = Fixture::new();
    let root = fixture.project("marker");
    for contents in ["", " \t\r\n", "\u{2003}"] {
        fs::write(root.join("naja.toml"), contents).unwrap();
        failure(&root, Path::new("main.naja"), "invalid project manifest");
    }
    fs::write(root.join("naja.toml"), b"\xff").unwrap();
    failure(&root, Path::new("main.naja"), "UTF-8");
    fs::write(root.join("naja.toml"), maximum_manifest()).unwrap();
    assert!(
        load_aliases(&root, Path::new("main.naja"), Dialect::Naja2026)
            .unwrap()
            .is_none()
    );
    fs::write(
        root.join("naja.toml"),
        "x".repeat(MANIFEST_MARKER_MAX_BYTES + 1),
    )
    .unwrap();
    failure(&root, Path::new("main.naja"), "limit of 65536");
    fs::write(root.join("naja.toml"), "not valid TOML; marker only").unwrap();
    failure(&root, Path::new("main.naja"), "invalid project manifest");
}

#[test]
fn manifest_parser_errors_retain_exact_original_codes_and_utf8_byte_spans() {
    let fixture = Fixture::new();
    let root = fixture.project("manifest-spans");
    let source = "# 世界\r\nschema = \"1\"\r\n[project]\r\nname = \"café\"\r\n";
    fs::write(root.join("naja.toml"), source).unwrap();
    fs::write(root.join("naja.alias"), b"\xff").unwrap();
    let start = source.find("\"1\"").unwrap();
    let error = failure(
        &root,
        Path::new("main.naja"),
        &format!("M0006 at manifest bytes {start}..{}", start + 3),
    );
    assert!(error.contains("naja.toml"));
    assert!(!error.contains("invalid alias configuration"));
    assert_eq!(fs::read_to_string(root.join("naja.toml")).unwrap(), source);
    assert_eq!(fs::read(root.join("naja.alias")).unwrap(), b"\xff");
    for source in [
        "[project]\nname = \"x\"\nunknown = true\n",
        "[project]\nname = \"x\"\nname = \"x\"\n",
        "[project]\nname = \"x\"\n[style]\nrequire_block_levels = \"true\"\n",
        "schema = 2\n[project]\nname = \"x\"\n",
        "[project]\nname = \"x\"\nentry = \"../outside.naja\"\n",
        "[project]\nname = \"x\"\n[dependencies.a]\n",
    ] {
        fs::write(root.join("naja.toml"), source).unwrap();
        failure(&root, Path::new("main.naja"), "at manifest bytes");
    }
}

#[test]
fn unavailable_manifest_capabilities_reject_before_alias_inspection_even_when_aliases_are_absent() {
    let fixture = Fixture::new();
    for aliases in [false, true] {
        let root = fixture.project(&format!("capabilities-{aliases}"));
        if aliases {
            fs::write(root.join("naja.alias"), b"\xff").unwrap();
        }
        for (fields, message, value_spelling) in [
            (
                "dialect = \"python\"",
                "manifest dialect must be naja",
                "\"python\"",
            ),
            ("profile = \"core\"", "only hosted", "\"core\""),
            ("profile = \"embedded\"", "only hosted", "\"embedded\""),
            (
                "target = \"x86_64-pc-windows-msvc\"",
                "declared target is unavailable",
                "\"x86_64-pc-windows-msvc\"",
            ),
            (
                "targets = [\"x86_64-unknown-linux-gnu\", \"custom-vendor-device\"]",
                "declared target is unavailable",
                "\"custom-vendor-device\"",
            ),
            (
                "[style]\nrequire_block_levels = true",
                "require_block_levels=true is not enforced",
                "true",
            ),
            (
                "[dependencies.a]\npath = \"../sibling\"",
                "dependencies require a resolver",
                ".a]",
            ),
            (
                "[dependencies.a]\npath = \"missing-owner\"\nsha256 = \"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"",
                "dependencies require a resolver",
                ".a]",
            ),
        ] {
            let source = format!("# 世界\r\n{MANIFEST}{fields}\n");
            fs::write(root.join("naja.toml"), &source).unwrap();
            let error = failure(&root, Path::new("main.naja"), message);
            let start = source.find(value_spelling).unwrap();
            let (start, end) = if value_spelling == ".a]" {
                (start + 1, start + 2)
            } else {
                (start, start + value_spelling.len())
            };
            assert!(
                error.contains(&format!("at manifest bytes {start}..{end}")),
                "{error}"
            );
            assert!(!error.contains("invalid alias configuration"));
            assert_eq!(fs::read_to_string(root.join("naja.toml")).unwrap(), source);
        }
    }
}

#[test]
fn supported_explicit_metadata_and_empty_dependencies_allow_loading_while_entry_stays_declarative()
{
    let fixture = Fixture::new();
    let root = fixture.project("supported-metadata");
    let source = concat!(
        "schema = 1\n[project]\nname = \"café 数据\"\ndialect = \"naja\"\n",
        "edition = \"2026.1\"\nprofile = \"hosted\"\nentry = \"not-present/other.naja\"\n",
        "targets = [\"x86_64-unknown-linux-gnu\"]\n[style]\nrequire_block_levels = false\n[dependencies]\n"
    );
    fs::write(root.join("naja.toml"), source).unwrap();
    assert!(!root.join("not-present").exists());
    assert!(
        load_aliases(&root, Path::new("main.naja"), Dialect::Naja2026)
            .unwrap()
            .is_none()
    );
    fixture.aliases(&root);
    assert_eq!(
        load_aliases(&root, Path::new("main.naja"), Dialect::Naja2026)
            .unwrap()
            .unwrap()
            .source(),
        ALIASES
    );
    assert!(!root.join("not-present").exists());
    assert_eq!(
        fs::read_to_string(root.join("main.naja")).unwrap(),
        "print(1)\n"
    );
}

#[test]
fn table_identity_includes_exact_manifest_bytes_and_effective_loader_policy() {
    let fixture = Fixture::new();
    let root = fixture.project("manifest-identity");
    fixture.aliases(&root);
    let variants = [
        MANIFEST.to_owned(),
        format!("{MANIFEST}# changed raw comment\n"),
        format!("schema = 1\n{MANIFEST}"),
        format!("{MANIFEST}dialect = \"naja\"\n"),
        format!("{MANIFEST}edition = \"2026.1\"\n"),
        format!("{MANIFEST}profile = \"hosted\"\n"),
        format!("{MANIFEST}[style]\nrequire_block_levels = false\n"),
        format!("{MANIFEST}target = \"x86_64-unknown-linux-gnu\"\n"),
        format!("{MANIFEST}entry = \"unselected.naja\"\n"),
        MANIFEST.replace('\n', "\r\n"),
    ];
    let mut identities = std::collections::BTreeSet::new();
    for source in variants {
        fs::write(root.join("naja.toml"), &source).unwrap();
        let table = load_aliases(&root, Path::new("main.naja"), Dialect::Naja2026)
            .unwrap()
            .unwrap();
        assert_eq!(table.source(), ALIASES);
        let identity = table.cache_identity();
        assert!(
            identity
                .windows(source.len())
                .any(|bytes| bytes == source.as_bytes())
        );
        for field in [
            "explicit-project-root-v2",
            "manifest-schema-1",
            "edition=2026.1",
            "profile=hosted",
            "require_block_levels=false",
            "entry=declarative",
        ] {
            assert!(
                identity
                    .windows(field.len())
                    .any(|bytes| bytes == field.as_bytes())
            );
        }
        assert!(identities.insert(identity.to_vec()));
        assert_eq!(
            identity,
            load_aliases(&root, Path::new("main.naja"), Dialect::Naja2026)
                .unwrap()
                .unwrap()
                .cache_identity()
        );
    }
}

#[test]
fn maximum_alias_and_manifest_bytes_are_both_retained_without_a_policy_limit_increase() {
    let fixture = Fixture::new();
    let root = fixture.project("maximum-identity");
    let manifest = maximum_manifest();
    let aliases = format!("#{}", "x".repeat(ALIAS_CONFIG_MAX_BYTES - 1));
    fs::write(root.join("naja.toml"), &manifest).unwrap();
    fs::write(root.join("naja.alias"), &aliases).unwrap();
    let table = load_aliases(&root, Path::new("main.naja"), Dialect::Naja2026)
        .unwrap()
        .unwrap();
    assert_eq!(table.source(), aliases);
    assert!(table.entries().is_empty());
    assert!(table.cache_identity().len() > manifest.len() + aliases.len());
    assert!(
        table
            .cache_identity()
            .windows(manifest.len())
            .any(|bytes| bytes == manifest.as_bytes())
    );
}

#[test]
fn marker_config_and_module_must_be_ordinary_files() {
    let fixture = Fixture::new();
    let root = fixture.project("ordinary-files");
    fs::remove_file(root.join("main.naja")).unwrap();
    fs::create_dir(root.join("main.naja")).unwrap();
    failure(&root, Path::new("main.naja"), "ordinary file");
    fs::remove_dir(root.join("main.naja")).unwrap();
    fs::write(root.join("main.naja"), "print(1)").unwrap();
    fs::remove_file(root.join("naja.toml")).unwrap();
    fs::create_dir(root.join("naja.toml")).unwrap();
    failure(&root, Path::new("main.naja"), "ordinary file");
    fs::remove_dir(root.join("naja.toml")).unwrap();
    fs::write(root.join("naja.toml"), MANIFEST).unwrap();
    fs::create_dir(root.join("naja.alias")).unwrap();
    failure(&root, Path::new("main.naja"), "ordinary file");
}

#[test]
fn invalid_utf8_and_malformed_alias_configuration_are_not_ignored() {
    let fixture = Fixture::new();
    let root = fixture.project("invalid-alias");
    fs::write(root.join("naja.alias"), b"[operators]\n\"==\"=\"\xff\"").unwrap();
    failure(&root, Path::new("main.naja"), "invalid byte at offset");
    fs::write(
        root.join("naja.alias"),
        "# 世界\r\n[operators]\r\n\"==\"=\"if\"",
    )
    .unwrap();
    let error = failure(&root, Path::new("main.naja"), "A0007 at config bytes");
    assert!(error.contains("naja.alias"));
    fs::write(root.join("naja.alias"), "[keywords]\n\"if\"=\"when\"").unwrap();
    failure(&root, Path::new("main.naja"), "A0003");
}

#[test]
fn alias_file_limit_is_checked_before_and_during_bounded_read() {
    let fixture = Fixture::new();
    let root = fixture.project("alias-limit");
    fs::write(
        root.join("naja.alias"),
        format!("#{}", "x".repeat(ALIAS_CONFIG_MAX_BYTES - 1)),
    )
    .unwrap();
    assert!(
        load_aliases(&root, Path::new("main.naja"), Dialect::Naja2026)
            .unwrap()
            .unwrap()
            .entries()
            .is_empty()
    );
    fs::write(
        root.join("naja.alias"),
        "x".repeat(ALIAS_CONFIG_MAX_BYTES + 1),
    )
    .unwrap();
    failure(&root, Path::new("main.naja"), "limit of 65536");
}

#[test]
fn unicode_and_space_paths_and_alias_names_remain_supported() {
    let fixture = Fixture::new();
    let root = fixture.project("project 世界 space");
    fs::write(root.join("module café.naja"), "print(1)").unwrap();
    let contents = "[operators]\r\n\"==\"=\"相等\"\r\n";
    fs::write(root.join("naja.alias"), contents).unwrap();
    let table = load_aliases(&root, Path::new("module café.naja"), Dialect::Naja2026)
        .unwrap()
        .unwrap();
    assert_eq!(table.source(), contents);
    assert_eq!(table.entries()[0].alias, "相等");
    assert!(
        table
            .lookup(AliasContext::ComparisonOperator, "相等")
            .is_some()
    );
}

#[test]
fn no_parent_home_or_nested_alias_search_occurs() {
    let fixture = Fixture::new();
    fs::write(fixture.base.join("naja.alias"), "malformed parent aliases").unwrap();
    let root = fixture.project("only-root");
    fs::create_dir(root.join("src")).unwrap();
    fs::write(root.join("src/entry.naja"), "print(1)").unwrap();
    fs::write(root.join("src/naja.alias"), "malformed nested aliases").unwrap();
    fs::write(root.join("naja.alias.toml"), "malformed alternate filename").unwrap();
    assert!(
        load_aliases(&root, Path::new("src/entry.naja"), Dialect::Naja2026)
            .unwrap()
            .is_none()
    );
    fixture.aliases(&root);
    assert_eq!(
        load_aliases(&root, Path::new("src/entry.naja"), Dialect::Naja2026)
            .unwrap()
            .unwrap()
            .source(),
        ALIASES
    );
}

#[test]
fn nested_project_markers_stop_parent_aliases_and_require_explicit_ownership() {
    let fixture = Fixture::new();
    let root = fixture.project("outer");
    fixture.aliases(&root);
    let nested = root.join("dependency");
    fs::create_dir(&nested).unwrap();
    fs::write(nested.join("naja.toml"), MANIFEST).unwrap();
    fs::write(nested.join("entry.naja"), "print(1)").unwrap();
    failure(
        &root,
        Path::new("dependency/entry.naja"),
        "nested project marker",
    );
    assert!(
        load_aliases(&nested, Path::new("entry.naja"), Dialect::Naja2026)
            .unwrap()
            .is_none()
    );
    fs::write(nested.join("naja.toml"), "invalid child manifest").unwrap();
    failure(
        &root,
        Path::new("dependency/entry.naja"),
        "nested project marker",
    );
    failure(&nested, Path::new("entry.naja"), "invalid project manifest");
}

#[test]
fn long_paths_fail_explicit_bounds_before_filesystem_traversal() {
    let fixture = Fixture::new();
    let root = fixture.project("bounds");
    failure(
        &PathBuf::from("x".repeat(32769)),
        Path::new("main.naja"),
        "32768",
    );
    let mut module = PathBuf::new();
    for _ in 0..129 {
        module.push("x");
    }
    module.push("main.naja");
    failure(&root, &module, "128 components");
}

#[cfg(any(unix, windows))]
fn file_link(target: &Path, link: &Path) {
    #[cfg(unix)]
    std::os::unix::fs::symlink(target, link).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_file(target, link).unwrap();
}

#[cfg(any(unix, windows))]
fn directory_link(target: &Path, link: &Path) {
    #[cfg(unix)]
    std::os::unix::fs::symlink(target, link).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(target, link).unwrap();
}

#[cfg(any(unix, windows))]
#[test]
fn file_symlinks_and_dangling_alias_symlinks_are_rejected() {
    let fixture = Fixture::new();
    for name in ["main.naja", "naja.toml", "naja.alias"] {
        let root = fixture.project(&format!("file-link-{name}"));
        let target = fixture.base.join(format!("outside-{name}"));
        fs::write(&target, "marker").unwrap();
        let link = root.join(name);
        if link.exists() {
            fs::remove_file(&link).unwrap();
        }
        file_link(&target, &link);
        failure(&root, Path::new("main.naja"), "symlink/junction/reparse");
    }
    let root = fixture.project("dangling");
    file_link(&fixture.base.join("absent.alias"), &root.join("naja.alias"));
    failure(&root, Path::new("main.naja"), "symlink/junction/reparse");
}

#[cfg(any(unix, windows))]
#[test]
fn root_parent_component_and_internal_symlinks_are_rejected() {
    let fixture = Fixture::new();
    let root = fixture.project("linked-target");
    let root_link = fixture.base.join("root-link");
    directory_link(&root, &root_link);
    failure(
        &root_link,
        Path::new("main.naja"),
        "symlink/junction/reparse",
    );
    let project = fixture.project("parent-link");
    directory_link(&root, &project.join("linked-directory"));
    failure(
        &project,
        Path::new("linked-directory/main.naja"),
        "symlink/junction/reparse",
    );
    file_link(&project.join("main.naja"), &project.join("internal.naja"));
    failure(
        &project,
        Path::new("internal.naja"),
        "symlink/junction/reparse",
    );
}

#[cfg(windows)]
#[test]
fn windows_junctions_and_network_device_and_stream_namespaces_are_rejected() {
    use std::os::windows::process::CommandExt;
    let fixture = Fixture::new();
    let root = fixture.project("junction-owner");
    let outside = fixture.project("junction-outside");
    let link = root.join("linked");
    // mklink is the ordinary Windows junction-creation builtin; no scripts,
    // execution-policy changes or elevation are required. Only generated test
    // paths enter this shell call, and metacharacters are rejected explicitly.
    let command_path = |path: &Path| {
        let path = path.to_str().unwrap();
        let plain = path.strip_prefix(r"\\?\").unwrap_or(path);
        assert!(
            !plain.chars().any(|ch| "&|<>()^%!\"\r\n".contains(ch)),
            "Unsupported shell metacharacter in test temporary path"
        );
        plain.to_owned()
    };
    let command = format!(
        "mklink /J \"{}\" \"{}\"",
        command_path(&link),
        command_path(&outside)
    );
    let output = std::process::Command::new("cmd.exe")
        .args(["/d", "/v:off", "/c"])
        .raw_arg(command)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    failure(
        &root,
        Path::new("linked/main.naja"),
        "symlink/junction/reparse",
    );
    failure(&link, Path::new("main.naja"), "symlink/junction/reparse");
    failure(
        Path::new(r"\\example.invalid\share\project"),
        Path::new("main.naja"),
        "local disk paths only",
    );
    failure(
        Path::new(r"\\.\pipe\project"),
        Path::new("main.naja"),
        "local disk paths only",
    );
    failure(
        &root,
        Path::new("main.naja:stream.naja"),
        "alternate data streams",
    );
}
