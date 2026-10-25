# Bounded native files and strict UTF-8 conversion

The [frozen contract](CONTRACT.md) was committed before native execution. These
backend IR operations emit Linux x86-64 syscalls/instructions without libc,
another compiler, assembler, linker or interpreter:

- `ReadFile(Box<Expression>)`: Text path to Bytes.
- `EncodeUtf8(Box<Expression>)`: Text to Bytes.
- `DecodeUtf8(Box<Expression>)`: strict Bytes to Text.
- `Expression::WriteFile { path, data }`: evaluate path then data once and return
  native None, matching ordinary function-call argument order.
- `Statement::WriteFile { path, data }`: evaluate data then path once. This is a
  separate assignment-like IR convenience, not reordered ordinary call syntax.

Write data must be Bytes; Text requires explicit encoding. Both write forms
share a syscall helper only after evaluating their operands. Earlier expression
failure prevents later effects. New forms use the existing IR node, nesting,
literal and local/call/stack validation budgets, including skipped/unused code.
Source imports/bindings are integrated separately.

## Paths, data and handle ownership

Paths are Text, at most **4095 UTF-8 bytes plus a terminator**. Embedded NUL is
rejected. The helper validates descriptor/data spans and UTF-8, copies the exact
path into separately allocated terminated storage, and never interpolates a
shell command. Data Unicode/NUL bytes are preserved without normalization.
Conversions validate complete UTF-8 and allocate one 24-byte descriptor pointing
at existing immutable literal/arena data; no source bytes are overwritten.
Strict width logic is shared in source with Text indexing, including shortest
forms, continuation bounds, surrogate exclusion and U+10FFFF.

Read opens with `O_NONBLOCK|O_NOFOLLOW|O_CLOEXEC`, then `fstat` requires a regular
handle. Leaf symlinks, directories, devices and FIFOs are refused before stream
reads. The initial size must be nonnegative and at most **16 MiB**. Allocation
reserves that size plus one probe byte and a descriptor. EOF after shrink returns
only actual bytes; observing any byte beyond the initial size is an explicit
resource failure. This is not a snapshot: same-size concurrent modification is
not detected. Pseudo-files whose reported size is smaller than their content are
also refused by this policy.

Write creates an exclusive new file with `O_WRONLY|O_CREAT|O_EXCL|O_NONBLOCK|
O_NOFOLLOW|O_CLOEXEC`, requested mode0600 subject to umask, then checks its regular
handle. It never overwrites an existing path or deletes partial output. Failure
retains owned partial output. There is no fsync/power-loss durability guarantee.
Parent-directory links and ordinary OS permissions apply; this is not race
confinement, a sandbox or a filesystem transaction. A filesystem call can still
block; `O_NONBLOCK` is not an IO deadline for ordinary regular files.

Transfers use at most **65536 bytes per call**. Each file operation permits
**65536 total openat/fstat/read/write attempts**, including EINTR, and **eight
EINTR retries** across the operation. Short positive reads/writes advance by the
actual count; zero read means EOF and zero write is an error. Close is attempted
once and never retried. It is excluded from the attempt budget so exhaustion
cannot prevent cleanup. Normal returns close first. Error paths close owned
handles before diagnostics where feasible; allocation capacity is preflighted
before allocation while a handle is open. Linux's close/error behavior and lack
of durability are described in [close(2)](https://man7.org/linux/man-pages/man2/close.2.html).
Flag/regular-file scope follows [open(2)](https://man7.org/linux/man-pages/man2/open.2.html);
partial/EOF handling follows [read(2)](https://man7.org/linux/man-pages/man2/read.2.html).

Every entry uses a bounded 256-byte helper frame, including a 144-byte x86-64
`stat` buffer. Existing **64 MiB arena**, **2 MiB guarded source stack plus4096
helper bytes**, call depth256 and all compiler budgets remain unchanged. There
is no reclamation, exception object, concurrent ownership or general filesystem
API claim. Diagnostic writes remain best effort.

## Exact diagnostics

Each diagnostic below ends with one LF. Runtime IDs are distinct from the
existing driver static `NJA108` diagnostic.

| Exit | Diagnostic |
|---|---|
|108|`NJA208: native file operation failed`|
|108|`NJA208: invalid native file path`|
|108|`NJA208: native file syscall or EINTR limit exceeded`|
|109|`NJA209: invalid UTF-8 conversion`|
|103|`NJA203: native path byte limit exceeded`|
|103|`NJA203: native file byte limit exceeded`|
|103|`NJA203: native file grew beyond initial size`|
|103|`NJA203: native value arena exhausted`|

Wrong kinds retain `NJA205: native value type mismatch` /105. Corrupt readable
spans retain `NJA203: invalid native sequence span` /103. Region checks do not
prove object provenance or make arbitrary modified executables safe.

## Linux ABI provenance

Local x86-64 Linux UAPI headers supplied the syscall numbers read0/write1/close3/
fstat5/openat257; open flags; 64-bit word layout; and stat mode/size offsets24/48.
No C compiler or guessed libc structure supplies the emitted ABI. Header SHA256:

| Local header | SHA256 |
|---|---|
|`/usr/include/x86_64-linux-gnu/asm/stat.h`|`5cca0ba1e1a55cfa1e853e326eaf4a69f48c1d0caf2d3724ee41917fff042ca6`|
|`/usr/include/x86_64-linux-gnu/asm/unistd_64.h`|`e34e39ab6237ba98b63d03e677f80c780c7416b9374b747f46c474d1920809fe`|
|`/usr/include/asm-generic/fcntl.h`|`61b9dc40467839c0fd8b0693623695eb04b6c2e3c8b9e246377c5eedb322be85`|

## Verification and retained limits

```text
cargo test --workspace --locked --offline
cargo clippy -p naja-native --all-targets --locked --offline -- -D warnings
node scripts/test-files.mjs
node scripts/test-lists.mjs
node scripts/test-tuples.mjs
node scripts/test-index.mjs
node scripts/test-functions.mjs
node scripts/test-dynamic.mjs
node scripts/test-hosted.mjs
node target/native-fixed-domain-regression.mjs
```

`examples/files_ir.rs` is bounded development-only RPN plumbing, not a source
frontend. Unary tokens are `read_file`, `encode_utf8`, `decode_utf8`;
`PATH DATA write_file` is the expression and `write DATA | PATH` the statement.
Input/output bounds and create-new artifact output remain. Existing harnesses
and adapters were not edited.

The harness uses private Linux scratch data and ignored target artifacts, with
five seconds per native artifact. Independent Node Buffer/scalar expectations
cover strict UTF-8 boundaries/invalid encodings, all bytes/NUL, EOF, exact16 MiB
and4095-byte path bounds, Unicode/spaces/inert metacharacters, exclusive existing
file preservation, leaf symlink/FIFO/device/directory refusal, ordinary parent
links, permission failures, requested mode, both evaluation orders and effects.
IO mutants force one-byte progress, attempt/EINTR exhaustion, partial owned
output retention, size-report growth/shrink and disabled close under fdlimit16.
Size-report mutants exercise deterministic observed-growth/shrink behavior,
not a claimed controlled concurrent file race. Descriptor-span mutants and arena
exhaustion probe guards. Changed input files and mutated output literals change
actual native results. Repeated emission checks unsigned deterministic ELF.

The first run stopped before native execution because `map(String.fromCodePoint)`
received extra callback arguments. The correction uses an explicit unary callback.
The second run passed native Unicode/metacharacter IO but Windows's UNC oracle
could not open the Linux double-quote filename. Its oracle now reads that exact
file using binary Linux cat via argv. Expectations, names, caps and timeouts did
not change. Full first/second logs are retained separately. The third run passed
65 checks before adding direct span/arena probes for the remaining guard scope.
The expanded run passed70 checks. Initial list/tuple regressions reached their
mutants and rejected a duplicate instruction signature: the new read buffer's
`add r8,24` matched their unique array-span mutation target. A separate scoped
correction uses r9 for that file buffer address, with identical operations and
instruction count. Existing harnesses and their strict selectors were preserved;
their original failure logs are retained alongside reruns. This did not change
API semantics, expectations, caps or resource budgets.

The inherited `node scripts/test-native.mjs` run failed at an obsolete rejection
of an ordinary list, already supported by its baseline. That original log is
retained as `target/files-i64-regression.log`. With integrator authorization,
the reviewed corrected fixture was read from
`91d94d15ec273e5c71ec6c8d95e5baa824861148:scripts/test-native.mjs` and written
byte-for-byte with create-new mode to ignored
`target/native-fixed-domain-regression.mjs`. Its Git blob is
`d6f04df2a049c42da1d87a13f6957fb6f334ca0c`, SHA256
`fbb8f1e6a9ad650b38f4f6559ba323bdac15bc8c1eb795926655b0650ebacfc8`.
The relevant correction uses an explicitly imported/annotated i64 list as the
domain-separation negative. The tracked inherited fixture was not changed. The
copied fixture belongs to that reviewed integrator commit, not this backend head;
its separate run reports 36 checks passed. Its provenance and logs are retained
in ignored `target/files-native-fixture-provenance.log` and
`target/files-i64-corrected-fixture*.log`.

Observed regression results for this runtime implementation are:

| Check | Passed |
|---|---|
| Workspace Rust tests |250|
| Native file/UTF8 |70 checks, 48 independent conversion outputs|
| Lists |97 checks, 385 independent outputs|
| Tuples |76 checks, 259 independent outputs|
| Indexing |72 checks, 2107 independent outputs|
| Functions |43 checks, 294 independent outputs|
| Dynamic values |85 checks, 8194 independent outputs|
| Hosted integers |14 checks, 394 arithmetic and 150 comparison outputs|
| Reviewed explicit-i64 fixture |36 checks|

The final file run and list/tuple reruns include the buffer-register correction
at `912d428`; the earlier passing Rust/index/function/dynamic runs precede that
file-only, same-instruction-count correction. Keep those observations distinct
from a later integration run on its own recorded commit. Original failing logs
and the passing reruns remain in ignored `target/files-*.log`; they are local
evidence, not a clean-host reproduction or a tracked release artifact.

Optional strace is absent; no installation or error-path syscall tracing is
claimed. Low-FD normal-close and disabled-close tests provide executable closure
evidence; remaining error cleanup is source-reviewed.

Record exact commits, host/target, versions, exits, logs and hashes when integrating.
All artifacts remain unsigned B0 development observations. No clean-host,
other-target, full IO/exception/runtime, self-hosting, FC1-complete or HATCH
acceptance follows from this slice.
