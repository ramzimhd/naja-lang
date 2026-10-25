# Ordinary-class source rerun after the private-name guard

The integrator's frozen source suite passed all 170 cases at exact compiler
source `b0e54cb2db1a2aea20b6056c05f92ea5e6b62560`, with 120 actual emitted
Linux x86-64 ELF executions and zero failed or `not_run` cases. This report
audits that retained run; its author did not execute the suite again. A separate
formal record at the same source passed 261 Rust tests. These observations do
not promote a requirement or release gate.

The original [source run](RUN_2026-10-25.md) and
[results](RESULTS_2026-10-25.json) remain unchanged at
`564461b8066e7b6cd328ff2b362bdabfc33bda0f`. The later independent private-name
probe failed at that source: a textual class-context `__value` silently bound
an ordinary key, rather than receiving the pinned compatibility semantics or
an explicit unsupported diagnostic. That probe was outside the frozen 170
cases. The integrator added the conservative class-context refusal in
`fcbe4575b6dd90b2a012da8e1ddcfc89d6f064c3`; full contextual name mangling
remains unimplemented. The failed observation and separate 43 focused guard
outcomes are retained in [the independent review](../../reports/reviews/OBJECTS_V13.md).
The 170-case rerun does not replace those probes or turn the original failure
into a pass.

| Retained command | Exit | Observed result |
| --- | ---: | --- |
| `node scripts/test-objects-language.mjs --expect-source b0e54cb2db1a2aea20b6056c05f92ea5e6b62560` | 0 | 170 source cases passed; 120 emitted ELF executions |
| `cargo +1.97.1 test --workspace --locked --offline` | 0 | 261 tests passed; zero failed or ignored |

The command records are
`reports/checks/v13-objects-fixed-class-source.json` and
`reports/checks/v13-objects-fixed-rust.json`, with their separately hashed raw
logs. Both pin the source above. Host tools were Windows x64, Node v24.11.0,
Cargo `1.97.1 (c980f4866 2026-06-30)`, Rust
`1.97.1 (8bab26f4f 2026-07-14)`, PowerShell 7.6.4 and Git
2.51.0.windows.1. The emitted target was `x86_64-unknown-linux-gnu`, executed
through actual local WSL reporting `Linux x86_64`. This is not an emitted
Windows target result.

| Source outcome group | Count | Actual result |
| --- | ---: | --- |
| Native semantic/error cases | 118 | 53 exit 0; three resource exits 103, 54 type exits 105, four zero-division exits 106 and four member/bound-method exits 110 |
| Compile rejections | 50 | Both check and build exit 1 with the frozen diagnostic and no ELF |
| Changed-source controls | 2 | Native exit 0; the unchanged output verifier rejects their incorrect observations |

All 587 captured child commands have no spawn error or terminating signal.
They comprise 422 exit-0 results, 100 expected exit-1 results, three exit 103,
54 exit 105, four exit 106 and four exit 110. Their summed elapsed time is
83,248 ms; this is local test bookkeeping, not a performance comparison.
Tracked source was unchanged at the recorded source boundary. The recorded
untracked files were only `reports/checks/` evidence.

Preparation commit `6d7d631a9ccbda934fadb1f67ac3c06e95f89d56` predates native
execution. The audit matched all 13 frozen files against both that preparation
and the actual compiler source: the harness, preparation, fixture index and ten
static fixtures. All 170 generated case identities, expectations and budgets
match the preparation. No source, expectation, diagnostic, tolerance or budget
was changed for the rerun.

Read-only inspection also verified all 170 retained source hashes and sizes,
120 ELF hashes and headers, 1,174 command capture hashes, and 460 check/build/
native capture pairs. Rejected cases have no emitted ELF. Native exits and
captured bytes match the frozen expectations; both changed-source controls
instead retain their expected verifier rejection. The compiler executable
available during this audit matched the run's recorded hash. These checks
audit artifact consistency; they are not another native execution.

| Artifact | SHA-256 |
| --- | --- |
| Run compiler executable | `6bae2980d255b5dd7e983baf354a1283eb63b13555861a338e769cc2dc53bec4` |
| Unchanged frozen source harness | `aab2c7b811426365d872010dfb8cbe0d0329afba8edce04f1596be59fee82bff` |
| Unchanged preparation | `175c66f3603f0e97554cdab05a7b82adaf4288ed3de543f32bb4a169b08ee1f7` |
| Unchanged static fixture index | `7e35843f9fcee78db4c3b394a543f42481a3fa918afac039c3753ce9a1523788` |
| Rerun original full summary | `ee4cc52135f0a2a93d98980796c9cbd41700aa1a41bdf72150e57ef2969e9a59` |
| Rerun actual plan | `d52f9de6919cf728c889b534856c68657ca214162224541de1a687e7bd7d8aa3` |
| Formal source-suite log | `bc93cc837ed71c7b241846acfdbf3e4e1108bcd63e7648c286c9afdf625b8498` |
| Separate formal Rust log | `1e7e43c7e3bf16f1a577d72eeb8a961ecc25f2468707986de8e1518a10bde1c1` |

[PRIVATE_FIX_RESULTS_2026-10-25.json](PRIVATE_FIX_RESULTS_2026-10-25.json)
retains the per-case identities, actual outcomes, formal record identities,
audit counts and limits. Original sources, ELF artifacts, command arguments,
capture files, plan and full summary remain in the integrator's ignored
`target/objects-language-UDNDdE` directory.

Budgets remain five seconds per native process, 20 seconds per ordinary child,
45 seconds per compiler build, 240 seconds overall and 8 MiB captured output
per child. Existing product limits are unchanged. This report establishes no
complete regression result, memory safety, sandbox, other emitted target,
clean installation, self-hosting, native-cell workflow, human productivity,
FC1 or HATCH acceptance. Richer class semantics, full private-name mangling,
first-class class/bound-method values, inheritance, descriptors, extensions
and partial classes remain open.
