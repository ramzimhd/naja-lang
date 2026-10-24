# Initial environment summary — October 24, 2026

T01 / ENV-01. The workspace initially contained the English 1.2 specification
package and local reading attachments, with no `.git` directory, implementation,
active assignments or previous operational handoff. No earlier project was reset.
The original English specifications were preserved in initial commit
`684f59efb35ec10e5fa43026e616c3df358108ea`.

Observed host: Windows 11 Pro for Workstations x64, version 10.0.26200,
PowerShell 7.6.4, approximately 95.7 GiB physical RAM and 91.7 GiB free workspace
disk at the first inventory. Ubuntu WSL 2 runs Linux x86-64. Visual Studio 18
Community with the x64 C++ tool component was found; the Rust workspace actually
builds with the available MSVC linker.

Observed tools: Git 2.51.0.windows.1, GitHub CLI 2.95.0, Rust/Cargo 1.97.1,
Node 24.11.0, npm 11.6.1, VS Code 1.142.0. Exact Rust 1.97.1 with rustfmt and
Clippy was added through official rustup, preserving the existing stable toolchain.
The inventory script records private paths only under ignored `launch/local/`.

The GitHub connector resolves the authorized public account `ramzimhd`.
`ramzimhd/naja-lang` returned 404; this was an availability observation, not
repository creation. GitHub CLI and browser were signed out. Git Credential
Manager lists the same account; stored credentials were not extracted. Public
repository creation awaits a working authorized login. The owner explicitly
selected Apache-2.0 in this session.

No elevation, firewall change, reboot, paid service or Python installation was
performed. One contributor observed an endpoint-protection block during an npm
PowerShell wrapper invocation, preserved it as a transient failure, and later
ran the same normal command successfully. No protection or execution policy was
changed. macOS execution, clean-user installation, QEMU and release acceptance
remain untested.

Reading attachments and the legacy French summary were left intact locally and
excluded from initial staging pending separate review. `SHA256SUMS.txt` and
`PACKAGE_VALIDATION.md` are original launch-package evidence, not checksums or
verification of the implementation tree. They have not been rewritten as new
results.
