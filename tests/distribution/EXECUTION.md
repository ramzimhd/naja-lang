# Scoped unsigned Linux compiler distribution

This is T12 CLI/tools and FC1-01 groundwork. T22 is the separate NAJA build-closure
port. No task, FC1 requirement or HATCH gate is promoted to verified by this report;
T28 HATCH publication stays open. No public artifact publication occurred.

The compiler source is exactly `a51c2808bae4b57596f7f957ce53530004a504f8`.
Preparation was frozen at `bfe181c`; correction/reuse tooling at `6f409ac` is
separately identified in [observations.json](evidence/observations.json).
The harness rejected compiler/dependency changes and exported the pinned Git
source archive before building. Helpers and independently supplied test fixtures
are separate from the compiler artifact source.

The first `node tools/distribution/verify.mjs` exited 1 after six unit tests,
official isolated Linux Rust preparation and the locked/offline release build
passed. Its dependency parser mishandled the already-declared GNU loader when
also listed NEEDED. [Revision notes](REVISION_NOTES.md) explain the correction and
retained failure. No resource budget or compiler requirement changed.

The corrected command, with explicit `--prepared` pointing to that retained run,
exited 0. Eight unit tests passed, including injected invalid ELF/dependency
reports, output-preservation checks and retained-record/source/log/binary
tampering. The reuse audit verified the earlier raw logs/source archive and
compiler/license hashes, then copied fixed inputs into a new output. Actual
readelf inspection was repeated on the copied compiler; no old command replay,
compiler fallback or second SDK download/build was performed.

The unsigned archive is retained locally at
`tools/distribution/artifacts/verify-c6JAHA/naja-linux-x86_64-unsigned.tar.gz`:

| Artifact | Size | SHA-256 |
|---|---:|---|
| Native compiler archive | 589,051 bytes | `60dba88639a972bef3cfa8bed9109a4b0e37943f758980d59c881b812025562c` |
| Compiler binary | 1,446,824 bytes | `565c75155c8a64390481f5db95e20576720b354d39fedca6fc9d5ca75e00d55c` |

The package has 18 fixed files: compiler, installer, README, manifest/checksums,
Apache LICENSE/NOTICE, five Unicode seed license copies, three Rust notice files
and three pinned provenance/lock records. It contains no OS libraries or other
tool executables. The complete file/hash manifest is retained in the observations.
Hashes establish integrity; no publisher signature, certificate or notarization
is claimed. The CLI's version text identifies the experimental Rust seed; source
SHA provenance is carried by the package manifest.

Observed development host: Ubuntu 24.04.3 WSL x86-64, kernel
`6.6.87.2-microsoft-standard-WSL2`, readelf/binutils 2.42 and glibc 2.39.
Official rustup 1.29.2 installed Rust/Cargo 1.97.1 into an exclusive private
prefix, with the pinned official Rust-manifest hash and official installer
checksum checked. The minimal profile was selected; the repository toolchain
resolution also acquired its pinned rustfmt/Clippy components. No profile/system
configuration edit occurred. Four exact Cargo.lock Unicode crate archives were
acquired and checksum-checked before the actual `--release --locked --offline`
build. Rust's development LLVM version was 22.1.6; this is a Rust-built seed,
not self-hosting. Actual commands, tool versions, official URLs and hashes are
retained in the observations and public sanitized logs.

Readelf found compiler dependencies `libc.so.6`, `libgcc_s.so.1` and the GNU
loader `ld-linux-x86-64.so.2`, with interpreter
`/lib64/ld-linux-x86-64.so.2`. Highest required GLIBC symbol is 2.39. Older glibc,
other Linux distributions and other architectures are unverified.

Two installation scopes ran. A new private prefix installed and invoked the
compiler with an empty tool PATH; an existing prefix was refused and its sentinel
preserved. Separately, a new copied userland installed the package using only
declared ordinary OS shell utilities. Its final inventory contains 60 files and
no symlinks, Rust/Cargo, Node, Python, C compiler or LLVM executables. Besides
compiler OS dependencies, the installer utility closure includes OS-provided
libcrypto, libpcre2 and libselinux; these are not distributed in the archive.

Each copied-userland command used fresh unprivileged user/mount/PID/network
namespaces and chroot on the existing WSL kernel. Only `/dev/null` was bound into
that userland; no host/source/toolchain tree, proc or sys mount was added there.
A later new-namespace mount audit recreated and inspected that exact device
bind. Compiler/program invocations used a cleared environment and
`PATH=/no-tools`; installer invocations had only the copied OS utility PATH.
The enumerated copied files, rather than PATH alone, establish the narrower
absence-of-toolchains observation. This is not a fresh VM, cross-platform
installation proof or security sandbox claim.

Installed `--version`, help, doctor, check, build, direct run, init and program-file
test commands executed. Independently supplied source returned 43; changing its
input/assertion returned 52 and produced a different ELF hash. Both generated
applications have no INTERP or dynamic NEEDED entries. The compiler used the
project's native emitter; no linker/C translator was available inside the
userland. Generated scaffold smoke testing passed. Unsupported-class checking
returned real diagnostics; an injected assertion failed with native exit 104 /
NJA204. Corrupting only the disposable package copy caused checksum rejection
before a new installation prefix appeared; installed compiler bytes stayed
unchanged. The final file inventory includes that intentionally corrupted test
copy, while the retained archive and installed compiler retain their recorded
hashes.

An optional later seed-crate build-script inspection **failed/not run** because
the original private Linux preparation directory was no longer available. The
scripts contain no cleanup, and the cause is unknown. Its stderr is retained;
the observer threw before serializing the child exit code. The Windows-side
source tar, compiler, licenses and raw logs remain, and the successful userland
was present for the subsequent mount audit. No claim is made that the original
Linux SDK/cache persists or that the unavailable inspection passed. The expanded
mandatory source-closure audit remains open.

Raw logs and all binaries remain ignored. Fifty public log derivatives have
separate hashes and explicit path sanitization/LF/whitespace transformations;
unchanged raw hashes are retained independently. No tracked binary is added.
Full language/library/module/cell/editor behavior, clean VM/other platforms,
autonomous NAJA reconstruction, external audit and full FC1/HATCH acceptance
remain open.
