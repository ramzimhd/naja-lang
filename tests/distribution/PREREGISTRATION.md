# Frozen Linux seed distribution checks

Prepared before executing this distribution harness. Scoped task: T12, CLI/tools,
plus FC1-01 groundwork. T22 is the NAJA build-closure port and is not this work.
T28 publication, FC1 acceptance and all inherited HATCH gates remain open.

Compiler source is exactly `a51c2808bae4b57596f7f957ce53530004a504f8`, supplied
through Git archive. Compiler/backend/dependency source differences and untracked
files are rejected. Helper/test source is recorded separately. No compiler or
backend code changes are permitted in this task.

The unsigned Linux x86-64 GNU archive contains only `bin/naja`, package README,
manifest/checksums, exclusive-prefix installer, Apache LICENSE/NOTICE, five exact
Unicode seed license files, Rust 1.97.1 COPYRIGHT/APACHE/MIT notices and three
pinned provenance/lock records. Maximum 24 files, 32 MiB compiler, 64 MiB archive,
2 MiB text inputs. `readelf` must identify ELF64 little-endian x86-64, the normal
GNU/Linux loader and at most eight allowlisted OS library names. Record all
required GLIBC symbol versions; do not claim older-distribution compatibility.
No Python, Rust/Cargo, Node, C compiler or LLVM tool is bundled. The Rust-built
compiler contains Rust standard-library code and four pinned Unicode crates.

Existing Ubuntu 24.04 WSL x86-64 has readelf/ldd/tar/gzip/timeout/gcc/cc/curl and
working unprivileged user/mount/PID/network namespaces. No Linux user Rust/Cargo
was found. Docker client 29.1.2 exists, but its daemon is unavailable; podman and
bwrap were not found. No service/security/system configuration change is planned.
Install official Rust 1.97.1 minimally into an exclusive private `/tmp` prefix,
without profile edits. Check the already pinned official Rust manifest hash and
official rustup installer checksum, retain actual installer/version/hash, stage
the four Cargo.lock archives and verify their checksums. Network acquisition is
development preparation only. The actual compiler build is `--release --locked
--offline`, with source-path remapping; no Python/upstream generators are run.

Budgets: complete harness 1,200 seconds; preparation 900 seconds (rustup 600,
Cargo fetch 120, offline build 180); each curl at most 60 seconds with explicit
file-size limits; copied-userland checks 120 seconds; ordinary orchestration
commands 10 seconds; 2 MiB combined retained process output (Git source tar may
use 64 MiB). Subprocesses use argument arrays, no shell interpolation. Timeouts
request process termination, not a universal process-tree/resource-isolation
guarantee. Preparation retains its owned partial directory on failure.

First install into a new private prefix, verify unchanged compiler bytes and
empty-PATH invocation. Refuse existing prefix and preserve its sentinel. Then
copy an enumerated minimal userland: package, shell and seven ordinary installer
utilities, their `ldd` OS library closure, compiler OS libraries, independent
source fixtures and empty writable directories. Each command gets fresh
unprivileged user/mount/PID/network namespaces and a chroot. Only `/dev/null` is
bind-mounted; no host/source/toolchain tree, proc or sys mounts. Installation
uses only declared OS utility PATH; compiler/native-program commands get
`PATH=/no-tools` and a cleared environment. No Rust/Cargo/Node/Python/C compiler
exists in that userland. This is a disposable copied userland on the existing
WSL kernel, not a fresh VM, whole-host cleanup or security sandbox proof.

Verify actual installed `--version/help/doctor/check/build/run/init/test` behavior.
Independent fixture returns 43; changing its input and assertion returns 52 and
must change the emitted ELF hash. Readelf must show generated apps have no
interpreter/NEEDED runtime entries. An unsupported class must diagnose; an
injected assertion must fail program-file testing. Corrupt only the disposable
package copy and require checksum rejection before installation. Retain exact
file/hash inventories (at most 128 files) and separate archive/compiler/app
hashes. No cached answer, compiler fallback or hidden toolchain service is used.
Do not claim absent tools merely by clearing PATH: inventory the copied tree.

Keep raw logs, artifacts and private locations ignored. Publish sanitized
derivatives with independent hashes; preserve failures and distinguish them from
expected negative controls. No tracked binary or public release is produced.
Official preparation references: [Rust installation](https://rust-lang.org/install.html),
[rustup locations](https://rust-lang.github.io/rustup/environment-variables.html),
[Rust 1.97.1](https://blog.rust-lang.org/2026/07/16/Rust-1.97.1/).
