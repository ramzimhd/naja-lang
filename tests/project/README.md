# Explicit project alias loading foundation

`bootstrap/driver/src/project.rs` provides this bounded IO boundary:

```rust
load_aliases(project_root: &Path, module_path: &Path, dialect: Dialect)
    -> Result<Option<AliasTable>, String>
```

The CLI calls this loader through explicit `--project-root` for `.naja`
check/build/run/test operations. The loader now calls the bounded manifest parser
before inspecting aliases. These tests cover that configuration/IO boundary;
native alias execution is tested separately. They do not establish complete
manifest/dependency resolution, L03 or HATCH acceptance.
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

## Manifest contract and bounded reads

`ROOT/naja.toml` must be an ordinary UTF-8 file of at most 65,536 bytes and satisfy
the declarative schema-1 subset in [MANIFEST.md](MANIFEST.md). `[project] name`
is required. Arbitrary marker text, unknown fields/tables, duplicates, wrong
types and unsupported TOML forms now reject. Parser diagnostics retain their
`M0001`–`M0007` code and original manifest byte span in the `NJA030` response.
The older marker-only results remain historical evidence, not current behavior.

Recognized metadata is validated against the loader's actual capabilities before
alias inspection, even when the alias file is absent. Only NAJA dialect/edition
`2026.1`, `hosted`, and `require_block_levels=false` are available. Core/embedded,
Python manifest activation and unenforced required block levels reject. Explicit
targets must all be `x86_64-unknown-linux-gnu`; other lexical target identifiers
reject as unavailable. A nonempty declared local dependency list rejects because
owner resolution and lock/hash validation are not implemented. An empty
`[dependencies]` namespace is allowed. These refusals identify the original field
span and never grant capabilities by declaration alone.

Manifest `entry` remains declarative metadata: the CLI's explicit SOURCE selects
the actual `.naja` module. This loader does not discover, read, validate existence
of or execute entry, nor require it to equal SOURCE. Its relative spelling is
still validated by the manifest parser. A future entry-driven CLI requires a
separate implementation and tests.

After root, module and manifest validation, an absent `ROOT/naja.alias` returns
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
explicit-project-root-v2;module-owner-only;no-links;manifest-schema-1;dialect=naja;edition=2026.1;profile=hosted;require_block_levels=false;target=x86_64-unknown-linux-gnu;dependencies=unsupported;entry=declarative
```

After parsing aliases, `with_project_manifest` binds the exact original manifest
bytes with a separate versioned domain and length-delimited representation. The
shared alias environment's 4,096-byte policy limit remains unchanged; manifest
context has its own 65,536-byte bound. The deterministic table identity includes
raw alias configuration, edition/format, the policy and exact manifest bytes,
including comments, whitespace, explicit/default spellings and entry metadata.
This is collision-free serialization, not a cryptographic hash or trust proof.
No cache or lockfile is mutated. Future cache keys must also include owner/module
identity, compiler options and interface versions. An absent alias has no table
identity, so a future absence cache must separately retain manifest/owner inputs.

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
- parsed manifest boundaries, raw manifest/alias identity and unavailable
  profile/style/dialect/target/dependency refusals before alias reads;
- exact alias/manifest size boundaries and oversized/component-heavy paths;
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
cargo test --locked --offline -p naja-seed --test project --test manifest
cargo clippy --locked --offline -p naja-seed --test project --test manifest -- -D warnings
rustfmt --check --edition 2024 bootstrap/driver/src/project.rs bootstrap/driver/tests/project.rs
```

The original 18-test marker-loader result is historical. On October 25, 2026,
the combined command above exited 0 on the Windows development host using
Rust/Cargo 1.97.1: 23 loader tests and 17 parser tests passed, with 0 failures
and 0 ignored tests. Actual symlinks and a Windows junction were exercised.
Scoped Clippy, rustfmt and authored whitespace checks also exited 0. The tests
cover this IO foundation only; they do not establish full TOML, imports or
dependency resolution.
