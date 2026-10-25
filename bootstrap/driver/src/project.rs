//! Explicit, bounded project alias loading with schema-1 manifest validation.
//! Unsupported capabilities reject; dependency/import resolution remains open.

use naja_frontend::{
    ALIAS_CONFIG_MAX_BYTES, AliasEnvironment, AliasTable, Dialect, Span, parse_aliases,
};
use naja_seed::manifest::{Edition, MANIFEST_MAX_BYTES, Profile, ProjectManifest, parse_manifest};
use std::{
    fs::{self, File, Metadata},
    io::{ErrorKind, Read},
    path::{Component, Path, PathBuf},
};

// Retain the existing exported limit name; the bytes now contain a parsed manifest.
pub const MANIFEST_MARKER_MAX_BYTES: usize = MANIFEST_MAX_BYTES;
const MAX_PATH_BYTES: usize = 32 * 1024;
const MAX_PATH_COMPONENTS: usize = 128;
const ALIAS_POLICY: &str = "explicit-project-root-v2;module-owner-only;no-links;manifest-schema-1;dialect=naja;edition=2026.1;profile=hosted;require_block_levels=false;target=x86_64-unknown-linux-gnu;dependencies=unsupported;entry=declarative";

/// Load only `project_root/naja.alias` for an explicitly owned `.naja` module.
/// Relative module paths are relative to the supplied root. Missing aliases
/// return `Ok(None)` after validating root/module ownership and the manifest.
/// Python dialect activation is an error before any filesystem access.
/// The CLI's explicit SOURCE selects the module; manifest entry is metadata.
///
/// All path components are checked for links/reparse points, canonical module
/// containment is component-based, and nested project markers are boundaries.
/// These ordinary filesystem checks assume a stable project tree: they are not
/// a sandbox or protection against hostile concurrent filesystem mutation.
pub fn load_aliases(
    project_root: &Path,
    module_path: &Path,
    dialect: Dialect,
) -> Result<Option<AliasTable>, String> {
    if dialect == Dialect::Python {
        return Err("NJA030: explicit project alias activation is unsupported for the Python compatibility dialect; .py semantics are unchanged".into());
    }
    if module_path.extension().and_then(|value| value.to_str()) != Some("naja") {
        return Err("NJA030: project alias loading currently requires a .naja module; .py and additional extension associations are unsupported".into());
    }
    // Windows verbatim PathBuf::join can normalize parent components. Validate
    // the supplied relative spelling before joining to the canonical root.
    check_requested_path(module_path, "owning module")?;
    let root = checked_path(project_root, true, "project root")?;
    let requested_module = if module_path.is_absolute() {
        module_path.to_owned()
    } else {
        root.join(module_path)
    };
    let module = checked_path(&requested_module, false, "owning module")?;
    let relative = module.strip_prefix(&root).map_err(|_| {
        "NJA030: the module is outside the explicitly supplied project root".to_owned()
    })?;
    if relative.as_os_str().is_empty() {
        return Err(
            "NJA030: the owning module must be a descendant file of the project root".into(),
        );
    }
    reject_nested_projects(&root, relative)?;

    let manifest_path = root.join("naja.toml");
    let manifest_source = read_bounded(
        &manifest_path,
        MANIFEST_MARKER_MAX_BYTES,
        "naja.toml manifest",
    )?;
    let manifest = parse_manifest(&manifest_source).map_err(|errors| {
        let mut message = format!(
            "NJA030: invalid project manifest {}",
            manifest_path.display()
        );
        for error in errors {
            use std::fmt::Write;
            let _ = write!(
                message,
                "\n  {} at manifest bytes {}..{}: {}",
                error.code, error.span.start, error.span.end, error.message
            );
        }
        message
    })?;
    check_manifest_capabilities(&manifest, &manifest_path)?;
    let alias_path = root.join("naja.alias");
    match fs::symlink_metadata(&alias_path) {
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            let error = io_detail(&error);
            return Err(format!(
                "NJA030: cannot inspect {}: {error}",
                alias_path.display()
            ));
        }
        Ok(_) => {}
    }
    let source = read_bounded(&alias_path, ALIAS_CONFIG_MAX_BYTES, "naja.alias")?;
    parse_aliases(
        &source,
        AliasEnvironment {
            edition: "2026.1",
            policy: ALIAS_POLICY,
        },
    )
    .and_then(|table| table.with_project_manifest(&manifest_source))
    .map(Some)
    .map_err(|errors| {
        let mut message = format!(
            "NJA030: invalid alias configuration {}",
            alias_path.display()
        );
        for error in errors {
            use std::fmt::Write;
            let _ = write!(
                message,
                "\n  {} at config bytes {}..{}: {}",
                error.code, error.span.start, error.span.end, error.message
            );
        }
        message
    })
}

fn check_manifest_capabilities(manifest: &ProjectManifest, path: &Path) -> Result<(), String> {
    if manifest.dialect.value != Dialect::Naja2026 {
        return Err(manifest_refusal(
            path,
            manifest.dialect.span,
            "The manifest dialect must be naja for explicit .naja project alias loading; Python compatibility cannot activate these aliases.",
        ));
    }
    if manifest.edition.value != Edition::Naja2026_1 {
        return Err(manifest_refusal(
            path,
            manifest.edition.span,
            "Only NAJA edition 2026.1 is supported for this project loader.",
        ));
    }
    if manifest.profile.value != Profile::Hosted {
        return Err(manifest_refusal(
            path,
            manifest.profile.span,
            "The declared profile is not enforced by this loader; only hosted is currently supported.",
        ));
    }
    if manifest.style.require_block_levels.value {
        return Err(manifest_refusal(
            path,
            manifest.style.require_block_levels.span,
            "require_block_levels=true is not enforced by this loader and cannot be activated silently.",
        ));
    }
    for target in &manifest.targets {
        if target.value.0 != "x86_64-unknown-linux-gnu" {
            return Err(manifest_refusal(
                path,
                target.span,
                "The declared target is unavailable; this seed supports only x86_64-unknown-linux-gnu.",
            ));
        }
    }
    if let Some(dependency) = manifest.dependencies.first() {
        return Err(manifest_refusal(
            path,
            dependency.name.span,
            "Declared local dependencies require a resolver and lock/hash validation, which are not implemented; dependency configuration cannot be activated silently.",
        ));
    }
    Ok(())
}

fn manifest_refusal(path: &Path, span: Option<Span>, message: &str) -> String {
    let position = span.map_or_else(
        || "at a defaulted manifest setting".to_owned(),
        |span| format!("at manifest bytes {}..{}", span.start, span.end),
    );
    format!(
        "NJA030: unsupported project manifest {} {position}: {message}",
        path.display()
    )
}

fn check_requested_path(path: &Path, label: &str) -> Result<(), String> {
    if path.as_os_str().is_empty() || path.as_os_str().len() > MAX_PATH_BYTES {
        return Err(format!(
            "NJA030: {label} path must contain 1..32768 encoded bytes"
        ));
    }
    if path
        .components()
        .any(|part| matches!(part, Component::ParentDir))
    {
        return Err(format!(
            "NJA030: parent traversal (..) is unsupported in the {label} path"
        ));
    }
    Ok(())
}

fn checked_path(path: &Path, directory: bool, label: &str) -> Result<PathBuf, String> {
    check_requested_path(path, label)?;
    let absolute = if path.is_absolute() {
        path.to_owned()
    } else {
        std::env::current_dir()
            .map_err(|error| {
                format!(
                    "NJA030: cannot resolve explicit relative {label}: {}",
                    io_detail(&error)
                )
            })?
            .join(path)
    };
    if !absolute.is_absolute()
        || absolute.as_os_str().len() > MAX_PATH_BYTES
        || absolute.components().count() > MAX_PATH_COMPONENTS
    {
        return Err(format!(
            "NJA030: {label} path must be absolute after resolution and have at most 128 components/32768 encoded bytes"
        ));
    }
    let mut checked = PathBuf::new();
    for part in absolute.components() {
        match part {
            Component::Prefix(prefix) => {
                #[cfg(windows)]
                if !matches!(
                    prefix.kind(),
                    std::path::Prefix::Disk(_) | std::path::Prefix::VerbatimDisk(_)
                ) {
                    return Err("NJA030: project alias loading supports local disk paths only; network/device namespaces are unsupported".into());
                }
                checked.push(prefix.as_os_str());
            }
            Component::RootDir => checked.push(part.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                return Err(format!(
                    "NJA030: parent traversal is unsupported in the {label} path"
                ));
            }
            Component::Normal(name) => {
                #[cfg(windows)]
                if name.to_string_lossy().contains(':') {
                    return Err(
                        "NJA030: alternate data streams are unsupported in project alias paths"
                            .into(),
                    );
                }
                checked.push(name);
                let metadata = fs::symlink_metadata(&checked).map_err(|error| {
                    let error = io_detail(&error);
                    format!(
                        "NJA030: cannot inspect {label} component {}: {error}",
                        checked.display()
                    )
                })?;
                reject_link(&metadata, &checked)?;
            }
        }
    }
    let metadata = fs::symlink_metadata(&checked).map_err(|error| {
        let error = io_detail(&error);
        format!(
            "NJA030: cannot inspect {label} {}: {error}",
            checked.display()
        )
    })?;
    reject_link(&metadata, &checked)?;
    if if directory {
        !metadata.is_dir()
    } else {
        !metadata.is_file()
    } {
        return Err(format!(
            "NJA030: {label} must be an ordinary {}: {}",
            if directory { "directory" } else { "file" },
            checked.display()
        ));
    }
    fs::canonicalize(&checked).map_err(|error| {
        let error = io_detail(&error);
        format!(
            "NJA030: cannot canonicalize {label} {}: {error}",
            checked.display()
        )
    })
}

fn reject_link(metadata: &Metadata, path: &Path) -> Result<(), String> {
    #[cfg(windows)]
    let reparse = {
        use std::os::windows::fs::MetadataExt;
        // FILE_ATTRIBUTE_REPARSE_POINT includes junctions and other reparse
        // types, not only the symbolic-link tag. Microsoft defines it as 0x400.
        metadata.file_attributes() & 0x400 != 0
    };
    #[cfg(not(windows))]
    let reparse = false;
    if metadata.file_type().is_symlink() || reparse {
        return Err(format!(
            "NJA030: symlink/junction/reparse project paths are unsupported: {}",
            path.display()
        ));
    }
    Ok(())
}

fn reject_nested_projects(root: &Path, relative: &Path) -> Result<(), String> {
    let mut directory = root.to_owned();
    let Some(parent) = relative.parent() else {
        return Ok(());
    };
    for part in parent.components() {
        directory.push(part.as_os_str());
        let marker = directory.join("naja.toml");
        match fs::symlink_metadata(&marker) {
            Ok(_) => {
                return Err(format!(
                    "NJA030: module crosses a nested project marker {}; supply that module's owning project root explicitly",
                    marker.display()
                ));
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) => {
                let error = io_detail(&error);
                return Err(format!(
                    "NJA030: cannot inspect nested project boundary {}: {error}",
                    marker.display()
                ));
            }
        }
    }
    Ok(())
}

fn read_bounded(path: &Path, limit: usize, label: &str) -> Result<String, String> {
    let canonical = checked_path(path, false, label)?;
    let file = File::open(&canonical).map_err(|error| {
        format!(
            "NJA030: cannot open {label} {}: {}",
            path.display(),
            io_detail(&error)
        )
    })?;
    let metadata = file.metadata().map_err(|error| {
        format!(
            "NJA030: cannot inspect opened {label}: {}",
            io_detail(&error)
        )
    })?;
    reject_link(&metadata, path)?;
    if !metadata.is_file() {
        return Err(format!("NJA030: opened {label} must be an ordinary file"));
    }
    if metadata.len() > limit as u64 {
        return Err(format!(
            "NJA030: {label} exceeds the limit of {limit} bytes"
        ));
    }
    let mut bytes = Vec::new();
    file.take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| {
            format!(
                "NJA030: cannot read {label} {}: {}",
                path.display(),
                io_detail(&error)
            )
        })?;
    if bytes.len() > limit {
        return Err(format!(
            "NJA030: {label} exceeds the limit of {limit} bytes"
        ));
    }
    if checked_path(path, false, label)? != canonical {
        return Err(format!("NJA030: {label} path changed while reading"));
    }
    String::from_utf8(bytes).map_err(|error| {
        format!(
            "NJA030: {label} must be UTF-8; invalid byte at offset {}",
            error.utf8_error().valid_up_to()
        )
    })
}

fn io_detail(error: &std::io::Error) -> String {
    // Keep official diagnostics in English even when OS messages are localized.
    match error.raw_os_error() {
        Some(code) => format!("{:?}; OS error {code}", error.kind()),
        None => format!("{:?}", error.kind()),
    }
}
