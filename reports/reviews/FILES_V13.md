# Independent native file and UTF-8 review

Reviewed October 25, 2026 at exact integrated source
`a51c2808bae4b57596f7f957ce53530004a504f8`. No actionable product defect was
reproduced. Separate branch `agent/files-review-v13` began at frozen source
harness commit `feb2115b10924aa96f9d45836c6aa4c97e01d0e2`, then fast-forwarded
normally to that integration before execution. Only this report is committed;
production, authored harnesses, planning and earlier artifacts remained intact.

Read the shared instructions, language/acceptance/runtime contracts, source and
frozen file contract. Relevant integrated changes are native core `571c8b0`,
height accounting `a98cdc6`, buffer-register correction `09675a8`, source imports
`c93a591a69ebbb4e243236e2e2ce727e9aeb0355`, and seed proof/harness `8f44980`.
The frozen contract's SHA-256 remains
`22d70219a04da4a6603963bac6163a69ec7a4a5cc8c018841632cfbaa48107f3`.
The separately owned frozen 121-case source harness was read but not executed
or claimed by this review. Later integrations are outside this pin.

## Actual execution

Host Windows x64, Node `v24.11.0`, Rust `1.97.1 (8bab26f4f 2026-07-14)`, Cargo
`1.97.1 (c980f4866 2026-06-30)`. Generated ELF execution: Linux x86_64 under WSL,
kernel `6.6.87.2-microsoft-standard-WSL2`, reported stack limit 8192 KiB.
No Python, external native compiler, provider/auth operation, service, dependency
installation or ownership change was used. Native file results came from emitted
instructions and real private files, not prepared fixtures counted as execution.

| Actual command | Exit/result |
| --- | --- |
| `cargo test --workspace --locked --offline` | 0; 253 tests passed |
| `cargo clippy -p naja-seed -p naja-native --all-targets --locked --offline -- -D warnings` | 0 |
| `cargo build --workspace --locked --offline` | 0 |
| `node scripts/test-files.mjs` | 0; existing native regression: 70 checks, 48 conversion oracle outputs |
| `cargo test --workspace --locked --offline -- --list` | 0; counts 4+125+11+3+6+3+3+4+24+16+17+23+14 = 253 |
| `node target/files-independent-review.mjs` | 1; six native cases matched, then a reviewer assumption about a reserved import alias failed; retained |
| `node target/files-independent-continuation.mjs` | 0; 336 completed cases plus one corpus-summary record; 103,452 ms |
| `node target/files-source-bounds-review.mjs` | 0; eight source-boundary cases; 4,342 ms |

Across the independent runs, **350 completed cases matched**: 336 native outcomes
and 14 check/build rejections, in addition to the retained unexpected reviewer
assumption failure. Native outcomes were 162 exit 0, 168 strict-UTF8 exit 109,
three type 105, two IO 108 and one resource 103. These include 312 fresh executions
of one independently compiled corpus program, not 312 distinct compiler inputs.
The remaining source cases compile their own programs. A summary record is not
counted as an additional test.

Independent main runs fixed 240 seconds overall, 20 seconds per host command,
five seconds per native artifact and 8 MiB captured output. The separate source
boundary run fixed 120 seconds overall with the same command/native/output caps.
Native execution used literal argv through `wsl.exe --cd PRIVATE_DIRECTORY
--exec /usr/bin/timeout --signal=TERM --kill-after=1s 5 ELF`; the low-FD case
additionally used `/usr/bin/prlimit --nofile=16:16 --`. No timeout, signal or
raised cap was accepted as a language result. Expectations/source scripts were
retained before their respective executions; failed evidence was not overwritten.

## Independent semantics and effects

The strict UTF-8 corpus independently derives expectations using Node's fatal
`TextDecoder`, with BOM preservation, and Unicode-scalar counting. It covers all
256 one-byte inputs; E0/ED/F0/F4 lead/second-byte boundary combinations surrounded
by valid non-ASCII and NUL context; truncated and extra continuations; empty data;
and a deterministic 512-scalar Unicode sample with decomposed/compatibility text.
All **146 valid** inputs roundtrip to byte-identical output files and correct
scalar lengths. All **166 invalid** inputs exit 109, preserve the input and create
no conversion output. Each execution starts a fresh ELF process/arena and private
case directory. Independent inventories verify check/build create no program IO
effects; native inventories accept only the expected new files and hashes.

Additional actual source cases established:

- PATH is captured before DATA changes its alias holder, so the old filename is
  used. Conversely, a PATH function changes the data holder and the DATA function
  observes that change. Function labels appear once in the expected order.
- A completed file effect in the PATH expression remains when DATA later fails
  decoding. A failing PATH expression skips DATA and its file effect entirely.
  Both argument effects precede helper type checks. The observed data-kind guard
  precedes invalid-path validation after evaluation; that helper error priority is
  an implementation observation, not a newly declared language guarantee.
- Reading a UTF-8 filename from another private file works. Conversion views and
  Text indexing views preserve NUL, Unicode and bytes after source/local/holder
  rebinding. Writing the final combining scalar preserves its exact encoding.
- Static imports correctly shadow supported conventional `len` and contextual
  print/len aliases. Canonical Unicode module/API spellings execute in both source
  dialects. Parameters shadow static imports locally; outside calls keep the API.
  Unused functions and false short circuits do not perform file effects.
- 512 reads under descriptor limit 16 return the correct aggregate length, providing
  independent normal-close evidence. This is not error-path close tracing.
- Source expression height 128 (127 nested conversions plus leaf) executes;
  height 129 rejects before ELF creation. A 256-call program performs its final
  conversion/write and returns None. Call 257 exits 103 before creating that file.
  A self-cyclic List passed as Bytes rejects shallowly with 105.
- Conditional/zero-loop/uninitialized and skipped/unused API operands reject
  statically. Imported APIs as values, local parameter calls, normalized duplicate
  aliases, late imports and explicit-i64 mixing reject. The exact source/built
  ELF/files for changed-data programs remain: both print 1, but their output files
  contain independently verified `first` versus `other` bytes.

## Retained reviewer failure

The first independent run completed six native cases, then expected this ordinary
API alias to compile:

```text
from naja.io import write_bytes as print
```

Actual check/build exited 1 with NJA101, `expected an unreserved API alias`.
`reserved_name` deliberately preserves canonical `print`/`i64` reservations in this
temporary slice. The original script, failing source, diagnostic, expectations and
failed summary remain under `target/files-independent-NIXlMX/`; the script exit 1
is not relabeled success. Its later planned accepted `i64` alias case was not run.

The continuation uses separately named supported `len`/contextual-alias cases and
explicit reserved-`print`/`i64` rejection controls. These pass without a product,
contract, tolerance, budget or compiler change. This is an incorrect review
assumption corrected with primary source evidence, not a silent binding defect
or a waiver of the final language's broader shadowing obligations.

## Native audit and existing regression scope

Static inspection found no concrete ABI, frame, register, bounds or cleanup defect
on supported paths. Every entry owns a 256-byte helper frame; its 144-byte stat
buffer does not overlap metadata. Checked descriptor/data spans precede access.
The shared width routine checks remaining length before continuation reads and
enforces shortest form, surrogate exclusion and the U+10FFFF maximum.

Read uses nonblocking/nofollow/cloexec open, then requires a regular handle.
Allocation capacity is preflighted while owning the handle; it reserves initial
size plus one probe byte. Shrinking EOF reports actual length; observing a byte
beyond initial size fails 103. Write validates kinds/path/size before exclusive
creation and retains owned partial output on later failure. Syscall argument
registers survive the retry loop; close is attempted once outside its counter.
Source WriteFile expression order is PATH then DATA; the separate development
IR Statement convenience intentionally evaluates DATA then PATH.

The unchanged existing 70-check IR/native harness passed here at the integration
pin. It includes exact 16 MiB and 4095-byte boundaries, byte/NUL/Unicode payloads,
exclusive preservation, leaf-link/FIFO/device/directory refusal, permissions,
mode, both evaluation orders, span/arena guards and controlled executable mutants.
Its size-report mutants are deterministic growth/shrink observations, not actual
concurrent-file races. Its one-byte transfers, lower attempt budget, synthetic
EINTR and disabled-close controls exercise guards; they are not arbitrary kernel
fault injection or safety proof for modified executables. Original author failure
history remains in its README and is not presented as this run failing.

Independent local `sha256sum`/header inspection reconfirmed the recorded Linux
x86-64 syscall numbers 0/1/3/5/257 and stat mode/size layout. Header identities match
the native README: stat `5cca0ba1e1a55cfa1e853e326eaf4a69f48c1d0caf2d3724ee41917fff042ca6`,
unistd `e34e39ab6237ba98b63d03e677f80c780c7416b9374b747f46c474d1920809fe`,
fcntl `61b9dc40467839c0fd8b0693623695eb04b6c2e3c8b9e246377c5eedb322be85`.
No C compiler or libc layout guess supplies the emitted implementation.

## Limits and retained identities

File cap 16 MiB, path cap 4095 UTF-8 bytes plus terminator, transfer chunk 65536,
65536 total operation syscall attempts, eight EINTR retries, one close attempt,
64 MiB arena, 2 MiB source stack plus 4096 helper reserve, call depth 256 and inherited
source/IR limits remain fixed. Conversion descriptors retain immutable storage;
there is no reclamation, GC or catchable exception claim. Actual forced close
errors, concurrent shrink/growth, same-size concurrent modification, arbitrary
pointer provenance and every allocation/OS-fault path were not independently
injected. Full non-file native regressions and other targets were not rerun here.
Ordinary parent links/permissions apply; filesystem calls can block despite
O_NONBLOCK. No IO deadline, snapshot, confinement, rollback, durability, sandbox,
general module/filesystem, self-hosting, FC1 or HATCH completion follows.

Local ignored evidence: `target/files-native-V7Nu9F/`,
`target/files-independent-NIXlMX/`, `target/files-independent-olgiwv/`,
`target/files-bounds-X4QfQj/` and `target/files-review-test-list.txt`. Console check
results are also retained in the review tool transcript. SHA-256 identities:

| File | SHA-256 |
| --- | --- |
| Native `dynamic.rs` | `f08ef671c8d6e16ddca1d23b8a75ab157ff3a534b4c4288f5d3514f5b390876d` |
| Native `routines/files.rs` | `b149edfc48c1b1e25e05bf37b1fc97fd70e02da945e02c122e42d388c234140f` |
| Native `routines/utf8.rs` | `e54312a8f1789c026d2fef3b6ad58d27030f14e1b4623c9b9c7ba5be6b8b5ab4` |
| Driver `lib.rs` | `2f234b6ee458e9f2dce7931fa5b2a1ed788fbaaca705330fdb7e7f3a04e726c8` |
| Driver `values.rs` | `b10b0d1494b515714c896247e654315a70aa384a693247747930ec4eb039c1a1` |
| Existing native harness | `e5ded1ce99acfad05cee072c2059be4a06b83cdb65b268392e015eabc234ffdf` |
| Built `naja.exe` | `ce6273724b63aec70e84b0d1686c6bd5eedec3a4cdcc248b913b3ce9a80fa34d` |
| Initial `probe.mjs` | `cdc8e7bfd0a541dff31237bffed9861ac2b4984808c8b054adf79019cdd5d8c7` |
| Initial failed `summary.json` | `a83cd40fd726bad437c124af5d76fe93c2129343385bce968fb04598af19dc55` |
| Continuation `probe.mjs` | `19bbce23a3cdbcf8b8fb4a152c9d34dc63107e838bc021dd618fbded9cbd4ce8` |
| Continuation `summary.json` | `26e070d552f3c8775ffbe8f6b804d8eec9fffb3ae2105b8e1e03a5afa3d506a6` |
| UTF8 corpus plan | `1647f5c90b08c4781fb1a82eac11342c97a6ede4266889537269691308454a15` |
| Corpus ELF | `e16a5aba79e42243bf4a5964139f3f7fd4c55e2d3428956b37c59b4f88abb2d2` |
| Low-FD read ELF | `39b370150045f3d618a6e0f1aabf3178eceab4b2baea8dc963e3cbd8d60ac392` |
| Bounds `probe.mjs` | `98051a0d865bcecf0bdcc615d3fe8d5be8c896831289c5f84ad37e316d6fce10` |
| Bounds `summary.json` | `0f44cc5a94b39ae75bcf971b9de45ab9834cf80aa530ada286fe975a76bc2fba` |
| Call256/write ELF | `865e7b412a602e756702b6e8c4c37e6509cc7b82113b9f193673a89b9a01b949` |

No severity is assigned because no actionable product defect was reproduced.
The retained failed assumption, explicit partial limits and inherited open gates
remain visible; this report changes no acceptance status.
