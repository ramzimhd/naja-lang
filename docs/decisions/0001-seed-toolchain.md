# ADR 0001: Temporary pinned native seed tools

Date: October 24, 2026. Status: accepted for the initial seed environment.

NAJA starts with official prebuilt Rust/Cargo 1.97.1, the minimal profile, and
the matching rustfmt/clippy components. The selected Windows installation was
already stable Rust/Cargo 1.97.1. Adding the exact version alongside it makes
the repository pin independent of future changes to the mutable stable channel.
Existing installations and the user's default toolchain are preserved.
Rust is temporary construction infrastructure. This decision does not satisfy
self-hosting, the native backend, or any final independent build-closure gate.

`bootstrap/toolchains.json` records exact tool versions, the SHA-256 of the
official Rust release manifest, Node archive checksums, targets and upstream
references. Pins are selected versions, not a claim that they are the newest
releases. The manifest's consumed scalar fields deliberately occupy individual
unescaped JSON lines so the Bash script needs no JSON runtime, Node or Python.
The scripts validate their required fields and reject invalid pins. Change the
manifest and the root Rust toolchain pin together after reviewing compatibility.

The [rustup toolchain documentation](https://rust-lang.github.io/rustup/concepts/toolchains.html)
describes exact version and host identifiers. The
[installation documentation](https://rust-lang.github.io/rustup/installation/index.html)
describes user-scoped tool locations. The setup scripts use only an existing
rustup; they never pipe a remote script to a shell or install rustup automatically.
Before an explicit Rust installation, they fetch the official release manifest
over HTTPS, compare its recorded SHA-256, then let rustup verify component
downloads. They reject custom rustup distribution/update endpoints for this
installation path. This is integrity checking against a reviewed upstream hash,
not independent verification of every existing local binary or a new signing key.

The selected Node 24.11.0 is an
[official LTS release](https://nodejs.org/en/blog/release/v24.11.0).
Its three recorded archive hashes match the upstream
[SHASUMS256.txt](https://nodejs.org/dist/v24.11.0/SHASUMS256.txt).
Node/npm serve the thin VS Code adapter's packaging workflow. They are not part
of the autonomous NAJA compiler closure. Git serves source development; GitHub
CLI serves authorized publication; VS Code serves editor acceptance. Setup
checks their selected versions but preserves missing or mismatched installations
for a separately reviewed official installation. It never performs global npm
installation. A version suffix such as Git's `.windows.1` is reported by its
upstream platform build; the check compares the exact three-part Git release.

The Rust prebuilt toolchain is dual MIT/Apache-2.0 with separately declared
third-party components; see its [copyright inventory](https://github.com/rust-lang/rust/blob/1.97.1/COPYRIGHT).
Node's [license inventory](https://github.com/nodejs/node/blob/v24.11.0/LICENSE)
includes its MIT license and bundled third-party notices.
[npm](https://github.com/npm/cli/blob/v11.6.1/LICENSE) and
[GitHub CLI](https://github.com/cli/cli/blob/v2.95.0/LICENSE)
use Artistic-2.0 and MIT respectively;
[Git](https://github.com/git/git/blob/v2.51.0/COPYING) uses GPL-2.0-only. Microsoft VS Code
binaries use the [Microsoft product license](https://code.visualstudio.com/license),
distinct from the MIT Code-OSS source license. These are external development
tools, not code imported into NAJA; retain their upstream terms and notices.

Run from any current directory:

```powershell
& C:/path/to/naja/scripts/dev/setup.ps1 -Diagnostic
& C:/path/to/naja/scripts/dev/setup.ps1 -Scope Extension -DryRun
& C:/path/to/naja/scripts/dev/setup.ps1 -Install
```

```sh
bash /path/to/naja/scripts/dev/setup.sh --diagnostic
bash /path/to/naja/scripts/dev/setup.sh --scope extension --dry-run
bash /path/to/naja/scripts/dev/setup.sh --install
```

The default `Seed`/`seed` scope checks exact Rust/Cargo, components and Git.
`Extension`/`extension` also checks Node/npm and VS Code; `All`/`all` adds GitHub
CLI. `Diagnostic`/`--diagnostic` prints resolved command paths. Default and
diagnostic modes are offline and read-only. Dry-run prints required Rust repair
commands without executing them, including when combined with install.
Explicit install adds only a missing exact Rust toolchain/components through
rustup, without changing defaults, updating rustup, removing tools, elevation,
security-policy changes, or automatic prerequisite installation. Repeated install
on a sufficient environment does not fetch metadata or invoke installation.
No mode invokes a missing compiler proxy, which could otherwise auto-install
a toolchain. A missing linker/SDK is not repaired here.

Exit 0 means the selected version checks passed. Exit 1 means a tool is missing,
mismatched, unreadable or blocked; dry-run retains that result. Exit 2 means
invalid usage/manifest, an unsupported host, or a stopped installation. Setup
parameter-binding failures in PowerShell use the PowerShell host's exit status.
The Bash script's invalid-argument status is 2. Setup
does not prove native linking, compiler correctness, product installation or
the absence of Python from the eventual build closure; execute the separate
build and dependency-audit checks for those claims. Windows x64, Linux x64 and
macOS arm64 are supported script host selections, not a claim of execution on
all three platforms. WSL Windows interop paths are excluded from native Linux
tool checks. No host control is bypassed when an executable is blocked.

Official provenance pages and checksum endpoints were read on October 24,
2026. This ADR is scoped to setup behavior; exact executed verification and
platform limits belong in the integrator's retained T02 evidence.

Run `scripts/dev/test-setup.ps1` on an already sufficient Windows seed environment
to check actual setup, unchanged rustup settings/toolchain inventory, wrong Cargo
pins, malformed pins and a missing toolchain dry-run. It stops before install
tests if the initial read-only seed check fails. Run
`bash scripts/dev/test-setup.sh` for offline script-logic checks with explicit
fixture executables. The latter proves setup decisions and failure detection;
it does not prove a Linux/macOS Rust installation or a NAJA build. Both harnesses
use disposable temporary files and leave actual toolchains unchanged.
