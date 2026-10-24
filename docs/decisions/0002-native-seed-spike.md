# ADR-002 — Bounded independent native seed spike

Date: October 24, 2026. Status: accepted for experimentation by the integrator.
Requirements: CMP-03/CMP-04, SEM-01, BE-01–BE-05 and IND-01–IND-04 remain
incomplete. This decision does not waive their final acceptance.

The launch package provides no implementation. Establish a small end-to-end
proof using the shared lossless frontend and an independent Linux x86-64 emitter
while H0 repository/environment work proceeds. Keep parsing, checking and machine
code emission separate. Do not simulate a native program by printing precomputed
results or invoking a foreign compiler/runtime.

Only explicitly constructed checked `i64(...)` values are executable initially.
Every bare integer remains a hosted integer and is rejected as unsupported at
this checkpoint, even after an import or annotation. Importing a primitive must
never silently narrow ordinary literals. Constructors currently accept a signed
decimal literal only, with out-of-range conversion rejected during checking.
General values, arbitrary-precision integers and full HATCH semantics remain
mandatory future work.

Use `naja lex`, `check` and `build` to expose exactly the implemented surface.
The source limit is 1 MiB, with bounded nesting/locals/statement counts and capped
diagnostic output. Generated files use direct Linux syscalls, checked arithmetic,
relative branches/calls, an RX load segment and a non-executable stack declaration.
ELF creation is deterministic. Source output is new-file-only, avoiding accidental
overwrite. Ordinary Linux signal policy remains; this is not a sandbox.

Alternatives: C translation would not exercise the required independent backend;
an LLVM-only seed would postpone independent emission; silently treating all
integers as machine values would violate the founder's semantics. A full hosted
runtime before any native execution would delay feedback. The bounded explicit
subset permits early evidence without claiming those larger obligations complete.

The frontend contributor independently reviewed emitter/driver boundaries and
found three defects: implicit bare-literal narrowing, unbounded diagnostic output,
and same-line suite accounting bypasses. The integrator fixed all three and added
regression tests; focused re-review confirmed those fixes. This is internal
AI-assisted review, not an independent human or external security audit.

Verification: workspace Rust tests, Clippy/formatting, real emitted-program tests
in Ubuntu WSL, boundary/overflow/output-error tests and reproducibility checks.
Logs are linked through planning evidence. No self-hosting, complete grammar,
clean-host support, speed, cells, VSIX or productivity claim follows.
