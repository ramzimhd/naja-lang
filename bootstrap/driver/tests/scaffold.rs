#[path = "../src/scaffold.rs"]
mod scaffold;

use naja_frontend::Dialect;
use naja_seed::{
    CheckedProgram, compile_with_dialect,
    manifest::{Edition, Profile, parse_manifest},
};
use scaffold::*;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

static NEXT_FIXTURE: AtomicU64 = AtomicU64::new(0);

struct Fixture {
    temp: PathBuf,
    base: PathBuf,
}
impl Fixture {
    fn new() -> Self {
        let temp = fs::canonicalize(std::env::temp_dir()).unwrap();
        let base = temp.join(format!(
            "naja-scaffold-test-{}-{}",
            std::process::id(),
            NEXT_FIXTURE.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&base).unwrap();
        Self { temp, base }
    }
    fn target(&self, name: &str) -> PathBuf {
        self.base.join(name)
    }
    fn failure(&self, path: &Path, fragment: &str) -> String {
        let error = init_project(path).unwrap_err();
        assert!(error.starts_with("NJA040:"));
        assert!(
            error.contains(fragment),
            "Unexpected sanitized error: {error}"
        );
        assert!(
            !error.contains(self.temp.to_str().unwrap()),
            "Error leaked absolute temporary/profile path"
        );
        error
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let resolved = fs::canonicalize(&self.base).unwrap();
        assert!(
            resolved.parent() == Some(self.temp.as_path()),
            "Unsafe scaffold fixture cleanup parent"
        );
        assert!(
            resolved
                .file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .starts_with("naja-scaffold-test-"),
            "Unsafe scaffold fixture cleanup name"
        );
        fs::remove_dir_all(resolved).unwrap();
    }
}

#[test]
fn new_leaf_contains_exact_relative_summary_and_valid_supported_manifest() {
    let fixture = Fixture::new();
    let target = fixture.target("ordinary");
    let result = init_project(&target).unwrap();
    assert_eq!(result.name, "ordinary");
    assert_eq!(
        result.created_files,
        ["naja.toml", "main.naja", "test_smoke.naja"]
    );
    let mut actual = fs::read_dir(&target)
        .unwrap()
        .map(|entry| entry.unwrap().file_name().into_string().unwrap())
        .collect::<Vec<_>>();
    actual.sort();
    assert_eq!(actual, ["main.naja", "naja.toml", "test_smoke.naja"]);
    for name in &result.created_files {
        assert!(!Path::new(name).is_absolute());
        assert!(target.join(name).is_file());
        assert!(fs::read(target.join(name)).unwrap().len() <= INIT_FILE_MAX_BYTES);
    }
    let source = fs::read_to_string(target.join("naja.toml")).unwrap();
    let manifest = parse_manifest(&source).unwrap();
    assert_eq!(manifest.schema.value, 1);
    assert_eq!(manifest.name.value, result.name);
    assert_eq!(manifest.dialect.value, Dialect::Naja2026);
    assert_eq!(manifest.edition.value, Edition::Naja2026_1);
    assert_eq!(manifest.profile.value, Profile::Hosted);
    assert_eq!(manifest.entry.unwrap().value.0, "main.naja");
    assert_eq!(manifest.targets[0].value.0, "x86_64-unknown-linux-gnu");
    assert!(manifest.dependencies.is_empty());
    assert!(!manifest.style.require_block_levels.value);
}

#[test]
fn generated_programs_compile_to_real_distinct_native_elf_bytes_without_execution() {
    let fixture = Fixture::new();
    let target = fixture.target("native-source");
    init_project(&target).unwrap();
    let mut artifacts = Vec::new();
    for filename in ["main.naja", "test_smoke.naja"] {
        let source = fs::read_to_string(target.join(filename)).unwrap();
        let CheckedProgram::HostedValues(program) =
            naja_seed::check_with_dialect(&source, Dialect::Naja2026).unwrap()
        else {
            panic!("Generated source must use ordinary hosted native functions");
        };
        assert_eq!(program.functions.len(), 1);
        let bytes = compile_with_dialect(&source, Dialect::Naja2026).unwrap();
        assert_eq!(&bytes[..4], b"\x7fELF");
        assert_eq!(bytes[4], 2);
        assert_eq!(&bytes[18..20], &[0x3e, 0]);
        assert!(bytes.len() > 128 && bytes.len() < 16 * 1024 * 1024);
        artifacts.push(bytes);
    }
    assert_ne!(artifacts[0], artifacts[1]);
    let names = fs::read_dir(target).unwrap().count();
    assert_eq!(names, 3); // No build artifacts are written.
}

#[test]
fn unicode_names_spaces_combining_marks_and_inert_shell_punctuation_are_data() {
    let fixture = Fixture::new();
    for name in [
        "Café 数据 é",
        "Δ project with spaces",
        "name;echo $(nothing)&",
        "--option-looking",
    ] {
        let target = fixture.target(name);
        let result = init_project(&target).unwrap();
        assert_eq!(result.name, name);
        let manifest =
            parse_manifest(&fs::read_to_string(target.join("naja.toml")).unwrap()).unwrap();
        assert_eq!(manifest.name.value, name);
        assert_eq!(manifest.profile.value, Profile::Hosted);
        assert!(manifest.dependencies.is_empty());
        assert_eq!(fs::read_dir(target).unwrap().count(), 3);
    }
}

#[test]
fn quote_backslash_control_and_manifest_injection_names_reject_before_any_output() {
    let fixture = Fixture::new();
    for name in [
        "bad\"name",
        "bad\\name",
        "bad\nname",
        "bad\rname",
        "bad\tname",
        "bad\0name",
        "bad\u{7f}name",
        "evil\"\n[dependencies.attack]\npath=\"local\"",
    ] {
        // Preserve the original spelling even on verbatim Windows parent paths.
        let requested = PathBuf::from(format!(
            "{}{}{name}",
            fixture.base.display(),
            std::path::MAIN_SEPARATOR
        ));
        fixture.failure(&requested, "NJA040:");
        assert_eq!(fs::read_dir(&fixture.base).unwrap().count(), 0);
    }
}

#[test]
fn every_existing_target_kind_and_retry_preserve_all_existing_bytes() {
    let fixture = Fixture::new();
    let empty = fixture.target("empty");
    fs::create_dir(&empty).unwrap();
    fixture.failure(&empty, "already exists");
    assert_eq!(fs::read_dir(empty).unwrap().count(), 0);
    let nonempty = fixture.target("nonempty");
    fs::create_dir(&nonempty).unwrap();
    fs::write(nonempty.join("sentinel"), b"preserve exactly").unwrap();
    fixture.failure(&nonempty, "already exists");
    assert_eq!(
        fs::read(nonempty.join("sentinel")).unwrap(),
        b"preserve exactly"
    );
    let file = fixture.target("file");
    fs::write(&file, b"existing file").unwrap();
    fixture.failure(&file, "already exists");
    assert_eq!(fs::read(file).unwrap(), b"existing file");
    let target = fixture.target("generated");
    let summary = init_project(&target).unwrap();
    let before = summary
        .created_files
        .iter()
        .map(|name| fs::read(target.join(name)).unwrap())
        .collect::<Vec<_>>();
    fixture.failure(&target, "already exists");
    let after = summary
        .created_files
        .iter()
        .map(|name| fs::read(target.join(name)).unwrap())
        .collect::<Vec<_>>();
    assert_eq!(before, after);
}

#[test]
fn parent_must_exist_as_a_directory_and_missing_ancestors_are_not_created() {
    let fixture = Fixture::new();
    let missing = fixture.target("missing");
    fixture.failure(&missing.join("leaf"), "parent must already exist");
    assert!(!missing.exists());
    let file = fixture.target("parent-file");
    fs::write(&file, b"parent bytes").unwrap();
    fixture.failure(&file.join("leaf"), "ordinary directories");
    assert_eq!(fs::read(file).unwrap(), b"parent bytes");
}

#[test]
fn unsafe_local_names_parent_traversal_streams_and_private_components_reject() {
    let fixture = Fixture::new();
    for name in [
        ".git",
        "CON",
        "nul.txt",
        "COM1",
        "LPT9.data",
        "COM¹.txt",
        "LPT³",
        "bad:stream",
        "bad?name",
        "bad*name",
        "bad|name",
        "bad<name>",
        "trailing.",
        "trailing ",
    ] {
        fixture.failure(&fixture.target(name), "project names/components");
    }
    let traversal = PathBuf::from(format!(
        "{}{}..{}naja-scaffold-must-not-escape",
        fixture.base.display(),
        std::path::MAIN_SEPARATOR,
        std::path::MAIN_SEPARATOR
    ));
    fixture.failure(&traversal, "parent traversal");
    for path in [
        Path::new(""),
        Path::new("."),
        Path::new(".."),
        Path::new("new/"),
        Path::new("new/."),
    ] {
        fixture.failure(path, "NJA040:");
    }
    assert_eq!(fs::read_dir(&fixture.base).unwrap().count(), 0);
}

#[test]
fn utf8_name_and_path_budgets_are_frozen_and_checked_before_writes() {
    assert_eq!(
        (
            INIT_PATH_MAX_BYTES,
            INIT_PATH_COMPONENT_LIMIT,
            INIT_PARENT_COMPONENT_MAX_BYTES,
            INIT_NAME_MAX_BYTES,
            INIT_FILE_MAX_BYTES
        ),
        (32768, 128, 255, 128, 4096)
    );
    let fixture = Fixture::new();
    init_project(&fixture.target(&"x".repeat(128))).unwrap();
    init_project(&fixture.target(&"é".repeat(64))).unwrap();
    fixture.failure(&fixture.target(&"x".repeat(129)), "128-byte");
    fixture.failure(&fixture.target(&"é".repeat(65)), "128-byte");
    fixture.failure(Path::new(&"x".repeat(32769)), "32768");
    let long_parent = PathBuf::from(format!(
        "{}{}{}{}leaf",
        fixture.base.display(),
        std::path::MAIN_SEPARATOR,
        "x".repeat(256),
        std::path::MAIN_SEPARATOR
    ));
    fixture.failure(&long_parent, "255-byte");
    assert_eq!(fs::read_dir(&fixture.base).unwrap().count(), 2);
}

#[test]
fn generated_file_components_fit_at_the_boundary_and_reject_above_before_leaf_creation() {
    let fixture = Fixture::new();
    let mut parent = fixture.base.clone();
    while parent.components().count() + 2 < INIT_PATH_COMPONENT_LIMIT {
        parent.push("x");
        fs::create_dir(&parent).unwrap();
    }
    let target = parent.join("boundary");
    init_project(&target).unwrap();
    assert_eq!(
        target.join("test_smoke.naja").components().count(),
        INIT_PATH_COMPONENT_LIMIT
    );
    let too_deep = target.join("new-leaf");
    fixture.failure(&too_deep, "128 components");
    assert!(!too_deep.exists());
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
fn existing_links_and_dangling_links_reject_without_following_or_replacing() {
    let fixture = Fixture::new();
    let original = fixture.target("original");
    fs::write(&original, b"outside target bytes").unwrap();
    let link = fixture.target("link");
    file_link(&original, &link);
    let identity = fs::read_link(&link).unwrap();
    fixture.failure(&link, "already exists");
    assert!(fs::read_link(&link).unwrap() == identity);
    assert_eq!(fs::read(&original).unwrap(), b"outside target bytes");
    let absent = fixture.target("absent");
    let dangling = fixture.target("dangling");
    file_link(&absent, &dangling);
    fixture.failure(&dangling, "already exists");
    assert!(!absent.exists());
    assert!(
        fs::symlink_metadata(dangling)
            .unwrap()
            .file_type()
            .is_symlink()
    );
    let directory = fixture.target("directory");
    fs::create_dir(&directory).unwrap();
    let linked_dir = fixture.target("linked-directory");
    directory_link(&directory, &linked_dir);
    fixture.failure(&linked_dir, "already exists");
    assert_eq!(fs::read_dir(directory).unwrap().count(), 0);
}

#[cfg(any(unix, windows))]
#[test]
fn linked_parent_and_ancestor_components_cannot_redirect_creation() {
    let fixture = Fixture::new();
    let original = fixture.target("original");
    fs::create_dir(&original).unwrap();
    let link = fixture.target("linked");
    directory_link(&original, &link);
    fixture.failure(&link.join("new-leaf"), "symlink/junction/reparse");
    let child = original.join("child");
    fs::create_dir(&child).unwrap();
    fixture.failure(&link.join("child/new-leaf"), "symlink/junction/reparse");
    assert_eq!(fs::read_dir(&original).unwrap().count(), 1);
    assert_eq!(fs::read_dir(child).unwrap().count(), 0);
}

#[cfg(windows)]
#[test]
fn windows_junction_parents_and_network_device_stream_namespaces_reject() {
    use std::os::windows::process::CommandExt;
    let fixture = Fixture::new();
    let original = fixture.target("original");
    fs::create_dir(&original).unwrap();
    let junction = fixture.target("junction");
    let quote = |path: &Path| {
        let text = path.to_str().unwrap();
        let text = text.strip_prefix(r"\\?\").unwrap_or(text);
        assert!(
            !text.chars().any(|ch| "&|<>()^%!\"\r\n".contains(ch)),
            "Unsafe junction fixture shell spelling"
        );
        text.to_owned()
    };
    let command = format!(
        "mklink /J \"{}\" \"{}\"",
        quote(&junction),
        quote(&original)
    );
    let outcome = std::process::Command::new("cmd.exe")
        .args(["/d", "/v:off", "/c"])
        .raw_arg(command)
        .creation_flags(0x0800_0000)
        .output()
        .unwrap();
    assert!(
        outcome.status.success(),
        "Native junction fixture creation failed"
    );
    fixture.failure(&junction.join("new-leaf"), "symlink/junction/reparse");
    assert_eq!(fs::read_dir(original).unwrap().count(), 0);
    fixture.failure(
        Path::new(r"\\example.invalid\share\new-project"),
        "local disk paths",
    );
    fixture.failure(Path::new(r"\\.\pipe\new-project"), "local disk paths");
    fixture.failure(Path::new("C:relative-leaf"), "drive-relative");
    fixture.failure(&fixture.target("new:stream"), "streams");
}

#[cfg(unix)]
#[test]
fn unix_non_utf8_names_reject_before_filesystem_access() {
    use std::{ffi::OsString, os::unix::ffi::OsStringExt};
    let fixture = Fixture::new();
    let path = fixture
        .base
        .join(OsString::from_vec(b"invalid-\xff".to_vec()));
    fixture.failure(&path, "valid UTF-8");
    assert_eq!(fs::read_dir(&fixture.base).unwrap().count(), 0);
}

#[cfg(windows)]
#[test]
fn windows_unpaired_utf16_names_reject_before_filesystem_access() {
    use std::{ffi::OsString, os::windows::ffi::OsStringExt};
    let fixture = Fixture::new();
    let path = fixture
        .base
        .join(OsString::from_wide(&[b'x' as u16, 0xd800]));
    fixture.failure(&path, "valid UTF-8");
    assert_eq!(fs::read_dir(&fixture.base).unwrap().count(), 0);
}
