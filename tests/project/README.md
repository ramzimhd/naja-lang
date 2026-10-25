# Explicit project alias loading foundation

`bootstrap/driver/src/project.rs` provides this bounded IO boundary:

```rust
load_aliases(project_root: &Path, module_path: &Path, dialect: Dialect)
    -> Result<Option<AliasTable>, String>
```

This checkpoint implements the loader and isolated integration tests. CLI and
parser wiring are separate integrator work. It does not establish complete
manifest/dependency resolution, native alias execution, L03 or HATCH acceptance.
No dependency, installation, network access or external interpreter is needed
by the loader.

## Explicit ownership and dialect

The caller supplies the owning root for each module. An explicit relative root
is resolved against the process working directory; a relative module path is
resolved against that root. Absolute module paths are accepted only if their
canonical path is a component-wise descendant of the canonical root. There is
no search for a root or alias table above the supplied root, in home directories
or next to an arbitrary source file. Only `ROOT/naja.alias` is loaded.

The initial loader requires an ordinary existing `.naja` module with that exact
extension. Calling it with `Dialect::Python` returns `NJA030` before filesystem
access; passing a `.py` path with `Dialect::Naja2026` also rejects. Additional
source associations are unimplemented. An ordinary `.py` compilation must not
call this explicit activation API and retains its separate compatibility
semantics. The caller must preserve this dialect decision in parser/cache use.

A nested `naja.toml` between the root and module is an ownership boundary:
loading the parent table rejects and requires the child's owning root explicitly.
This bounded root-to-module marker check never chooses a different root or
loads a nested alias table. Imported/dependency source ownership remains
unimplemented; an arbitrary descendant without a marker is not proof of package
ownership. A future import resolver must supply the actual owner, including for
dependencies stored inside a larger repository. Parent policy must not be applied
retroactively to dependencies or compiled standard modules.

## Marker contract and bounded reads

`ROOT/naja.toml` must be an ordinary nonempty UTF-8 file of at most 65,536 bytes,
with at least one non-whitespace character. This is only a project marker.
Its TOML syntax, schema, dialect, profile, entry point, dependencies, targets and
style are not parsed or applied. Arbitrary nonempty UTF-8 marker text can pass;
that is not a claim of manifest validity. Full manifest support must replace
this explicit limitation before normal manifest-driven workflows are accepted.

After root, module and marker validation, an absent `ROOT/naja.alias` returns
`Ok(None)`. An empty alias file returns `Some` of the shared empty table. Existing
alias files must be ordinary UTF-8 files no larger than the shared
`ALIAS_CONFIG_MAX_BYTES` (65,536). Each reader checks opened metadata size and
reads at most limit plus one byte, so growth cannot produce an unbounded read.
An invalid UTF-8 offset, parse failure or IO failure rejects; there is no fallback
to another table or partial usable configuration. Shared parser errors preserve
their code and original config byte spans in the returned English `NJA030`
message. Source-use spans remain the parser's separate responsibility. IO errors
use English Rust error kinds and numeric OS codes rather than localized system
prose. User path and alias data remain Unicode.

The shared parser receives edition `2026.1` and the fixed policy bytes:

```text
explicit-project-root-v1;module-owner-only;no-links;manifest-marker-only;naja-only
```

Its deterministic table identity therefore includes raw alias config, edition,
format version and this loader policy. No cache or lockfile is mutated. Future
compiler cache keys also need owner/module identities and every relevant parsed
manifest option; this loader does not implement that cache.

## Filesystem checks and limits

Paths are bounded to 32,768 encoded bytes and 128 components after absolute
resolution. Empty paths and `..` components reject before filesystem traversal,
including before joining a raw module spelling to a canonical Windows root.
The loader checks each existing path component using `symlink_metadata`, then
canonicalizes and checks module containment using `Path::strip_prefix`.
Files/directories masquerading as the required opposite kind reject. All
symlinks reject, even when they point within the project. The conservative walk
also rejects link components in the supplied root's ancestors; use the ordinary
canonical location for roots exposed through such links.

On Windows, all reparse-point types reject using
[`MetadataExt::file_attributes`](https://doc.rust-lang.org/std/os/windows/fs/trait.MetadataExt.html)
and Microsoft's
[`FILE_ATTRIBUTE_REPARSE_POINT = 0x400`](https://learn.microsoft.com/en-us/windows/win32/fileio/file-attribute-constants),
so a junction cannot escape merely because it is not classified as a symbolic
link. Only local disk path prefixes are accepted; UNC/device namespaces and
alternate data streams reject. Canonical disk prefixes remain supported.
No permissions, execution policy, firewall rules or privileges are changed.

These are ordinary static filesystem checks under the caller's OS identity.
They assume a stable project tree. Rechecking a file path after its bounded read
detects some changes but is not an atomic filesystem snapshot or a defense
against hostile concurrent rename/link races. Hard-linked files and OS mount
ownership are not independently authenticated. The implementation is not an OS
sandbox and does not claim race-resistant path confinement.

## Tests and commands

`bootstrap/driver/tests/project.rs` includes the isolated module with `#[path]`.
Temporary fixtures are uniquely created below the canonical system temp root;
recursive cleanup checks that exact generated target. Tests do not change the
process working directory or user environment. Cases include:

- ordinary/absent/malformed alias files, missing roots/modules/markers and wrong
  file kinds;
- Unicode and space paths, Unicode alias data, invalid UTF-8 and config spans;
- exact alias/marker size boundaries and oversized/component-heavy paths;
- relative root ownership, sibling prefix rejection, parent traversal and nested
  owner boundaries, with no parent or nested alias fallback;
- `.py` isolation and unsupported extension associations;
- real file/directory/dangling/internal/root symlinks; Windows also creates a
  real junction and checks UNC/device/stream namespace rejection.

The Windows junction fixture uses the native `cmd.exe` `mklink /J` builtin on
fresh generated paths. Arguments are quoted and shell metacharacters are
rejected in these test paths. No script execution or policy bypass is used.
Windows symlink tests require an environment already authorized to create
symlinks; they fail explicitly if that capability is absent rather than silently
claiming coverage. Unix symlink variants are provided but need execution on a
Unix host before Unix runtime validation can be claimed.

```powershell
cargo +1.97.1 test -p naja-seed --test project --locked --offline
cargo +1.97.1 clippy -p naja-seed --test project --locked --offline -- -D warnings
cargo +1.97.1 fmt --all -- --check
```

On the current Windows host, all 18 loader integration tests passed, including
actual symlinks and a junction, with no ignored tests. These results cover this
IO foundation only; they do not demonstrate native alias semantics or full
manifest/project support.
