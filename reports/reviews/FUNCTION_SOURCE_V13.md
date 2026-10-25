# Independent first-order source/native function review

Review date: October 25, 2026. No actionable correctness defect was found in the
reviewed slice. This is bounded executable evidence, not proof of full function
semantics, stack-fault recovery, Python compatibility, performance, FC1 or HATCH.

## Source and ownership

The clean review branch `agent/function-source-review-v13` was created at exact
source `0168f4605a5208d71138233887ef8ca25039929a`. Its relevant inherited commits are:

- Native core: `5193e9feda4a3e5ae4a98fa0908c0c87465fcbc3`.
- Native harness: `92d529c272dcbf34f6394b9cffe8616e8b347ab8`.
- Shared source integration: `cb13c875a94387da738bcb95c4e30e20e896ad21`.

The review read the shared agent instructions, current language contracts,
ADR-004, bootstrap/native documentation, function backend/harness, shared parser,
value adapter and CLI compilation path. A second agent independently audited
stack/frame/worker code read-only and found no concrete defect. All production
driver/backend files and the source-harness author's paths remained unchanged.
Only this report is committed. Disposable sources, ELF files, script versions and
observations remain in ignored `target/`; all prior review artifacts were kept.
Subsequent source, manifest integration and other agents' tests are outside this pin.

## Environment and commands

Host: Windows x64; Rust `1.97.1 (8bab26f4f 2026-07-14)`, Cargo
`1.97.1 (c980f4866 2026-06-30)`, Node `v24.11.0`.
Actual native target: WSL Linux `6.6.87.2-microsoft-standard-WSL2 x86_64`;
`ulimit -s` reported `8192` KiB. No Linux-host Rust compiler, alternate emitted OS,
small-stack recovery, large inherited environment or production service was tested.
No Python, interpreter oracle, provider, auth flow or external compiler/linker was
used to execute generated programs.

Commands ran from the review checkout:

| Command | Exit | Actual result |
| --- | --- | --- |
| `cargo test --workspace --locked --offline` | 0 | All 211 Rust tests passed |
| `cargo build --workspace --locked --offline` | 0 | Actual seed CLI built |
| `cargo clippy -p naja-seed -p naja-native --all-targets --locked --offline -- -D warnings` | 0 | No warnings |
| `cargo test --workspace --locked --offline -- --list` | 0 | Count confirmation: 4 frontend + 125 syntax + 11 native + 6 function + 17 seed library + 13 CLI + 17 manifest + 18 project |
| `node scripts/test-functions.mjs` | 0 | Existing development-IR harness: 43 checks, 294 independent oracle outputs, including retained artifact mutants |

The final independent probe command was:

```powershell
$env:START_AT = ''
$env:DIRECT_NATIVE = '1'
node target/function-source-review.mjs
```

It exited 0: **82 distinct actual-source programs**, with **35 native outcomes**
and **47 explicit compile rejections**. Of the native outcomes, 27 exited 0,
five deliberately exited resource 103 and three deliberately exited type 105.
Every accepted source passed actual `naja check` and `naja build`; every rejected
source failed both with exit 1 and created no requested ELF. The final complete
probe used 27,039 ms, with unchanged 180,000 ms overall, 20,000 ms host-command,
five-second native and 8 MiB captured-output limits. Native execution used
`wsl.exe --exec /usr/bin/timeout --signal=TERM --kill-after=1s 5 ELF`, after `chmod`.

The probe invokes these product commands with separate arguments:

```text
naja check SOURCE [--project-root ROOT]
naja build SOURCE --target x86_64-unknown-linux-gnu --output NEW_ELF [--project-root ROOT]
naja run SOURCE --runner wsl --timeout-ms 5000 [--project-root ROOT]
```

The first nine native cases also passed the actual `run` route. A later `run` of
the tiny parameter-shadowing case stopped before native execution with exit 1,
`NJA010: WSL adapter command failed (status 124)`. Its exact retained ELF then
ran directly with exit 0, stdout `73\n`, empty stderr. The adapter's existing
five-second control deadline was not increased; its underlying delay was not
diagnosed. The complete final probe uses the direct WSL route above. Consequently
it establishes actual CLI source compilation and native results, not 82 successful
product `run` invocations. This operational failure remains recorded in
`target/function-source-review-hoH2GL/summary.json` and
`adapter-classification.json` beside it.

An earlier probe version used an invalid named-section spelling `{ # search`
and correctly received a syntax rejection. The reviewer corrected its fixture to
the documented `{# search #` before continuing. That initial probe exited 1 and
its partial artifacts remain under `target/function-source-review-FjonEF/`;
duplicate preliminary successes are excluded from the 82-program count. The
continuation commands with `START_AT=function-named-len-statically-resolved` and
`START_AT=source-argument-allocation-once`, both with `DIRECT_NATIVE=1`, exited 0
before the complete final run. No product code or acceptance threshold changed.

`node target/function-depth-review.mjs` additionally exited 0 for two actual-source
and two development-IR expression-boundary probes. Source accepts 127 nested
identity calls plus its leaf (128 tree levels), and rejects the next level in
both CLI check/build. The development adapter accepts 128 call-nesting edges,
emits an ELF which prints `1`, and rejects 129 before output creation. The
workspace's `call_arguments_share_expression_depth_and_suite_limits` test also
checks the direct Rust validator boundary. These four supplemental probes are
separate from the 82-program complete run above.

## Independent source results

The independent source scripts and expected results were written before executing
their cases. They use observable output, algebra and Node BigInt for `120!`, with
no Python execution. Key adversarial results were:

- Argument calls print `1`, `2`, `3` once and in order before the callee returns
  `123`. Nested argument calls preserve earlier pending values. A first argument
  type failure exits 105 before a later printing argument executes. A failing
  argument at active depth 256 produces type 105 before the next callee's depth
  check. Comparison-chain middle calls execute once, and false chains/Boolean
  short circuits skip later printing calls.
- All value kinds cross a native frame. Bare return and fallthrough return None;
  a discarded call still prints its side effect. Rebinding parameters and
  arithmetic leave retained caller aliases unchanged. Returned Text/Bytes and
  large integers remain usable after frame cleanup.
- Returning conditional branches do not incorrectly remove initialization from
  live branches. Nested branch joins return their expected values. Conditional
  or zero-iteration-loop initialization gaps reject before output creation.
  Functions cannot read main/other-function locals. Recursive locals remain
  isolated, and loop/named-group early return survives 1,000 repeated calls.
- All 128 positional parameters are printed individually in declaration order,
  using names deliberately opposed to lexical sort order. Another case fills all
  128 main slots and all 128 parameter slots simultaneously and returns `190`
  while main endpoints remain `0` and `127`. A 128-function table resolves calls
  to entries 0, 63 and 127 correctly; 129 definitions, parameters or arguments reject.
- Actual source self-recursion returns exact `120!`. The descending-call case
  accepts 256 active calls and rejects the 257th with
  `NJA203: native user-call depth limit exceeded`, exit 103. Repeated depth-256
  calls restore the counter through 300 iterations.
- Eight nested 128-argument wrappers retain 1,016 descriptors per recursive
  level. The preregistered source input 204 succeeds; 205 fails with
  `NJA203: native source stack limit exceeded`, exit 103, before depth 256.
  Each uses the actual shared parser and CLI emitter rather than hand-built IR.
- A function body plus 63 nested `if` suites, ending in a 128-level unary
  expression, passes actual CLI `check`, `build` and native execution. Thus this
  accepted case also exercises main-thread cleanup of the checked IR. The next
  suite level and an over-depth expression reject without process abort or ELF.
- An 8 MiB text doubling sequence and retained 16 MiB concatenation leave room
  for one 16 MiB argument. `identity(s+s)` succeeds; an explicit two-argument
  duplicate control fails arena 103. A separate repeated allocating function
  exhausts the shared arena across returns, rather than reclaiming it silently.
- Equivalent `.py` indentation and `.naja` brace function programs emit identical
  ELF bytes; `.naja` depth markers and transparent named groups execute. Unicode
  canonical function/parameter names resolve, canonical parameter collisions
  reject, and a CRLF/Unicode undefined-name diagnostic retains source line 2,
  scalar column 16.
- An explicit valid project manifest and Unicode print/len/comparison aliases
  operate inside functions. Parameter shadowing of a builtin alias returns the
  parameter, while later local/module rebindings of a used builtin alias reject.
  Conventional `len` can be an earlier statically resolved user function.
  `.naja` local `: int` preserves Bool and rejects a later Text assignment;
  `.py`'s annotation remains informational. Shadowed `int` annotations reject.

The 47 rejection programs also cover defaults, positional-only/keyword-only/
variadic parameters, parameter/return annotations, kwargs/star calls, nested or
later definitions, calls before declaration, globals/global rebinding, function
values/rebinding, calls through parameters, arity, unused invalid functions,
invalid dead/skipped source, return in main and explicit checked-i64 functions.
These are documented implementation limits, not accepted alternative semantics.

## Static stack and binding assessment

At this source, parser function signatures are installed before their bodies
(self calls) and only already installed definitions are callable. Local/parameter
bindings take precedence and unsupported value calls are diagnosed. Functions
have separate initialization, annotation and local maps. Static builtin-use
tracking deliberately rejects later module/local rebinding; it does not silently
freeze a different runtime global value. This conservative restriction is part of
the documented slice and was tested as rejection, not general Python binding.

`bootstrap/driver/src/lib.rs` reserves an 8 MiB scoped compilation worker, joins
it, and reports spawn/join failures as NJA107/NJA108. Parsing, validation, emission
and compile-owned IR cleanup occur inside the worker. `check` returns bounded IR
to its caller, and the CLI drops that result on its main thread. The combined
maximum-depth source probe above exercises that real path; arbitrary Rust API
callers' stack sizes and OS worker-allocation failures were not injected.

`backends/native/src/dynamic.rs` checks every source push against the common
2 MiB floor plus 4,096 helper bytes. Callee entry accounts for the already pushed
return address, saved base pointer and 2,048-byte frame before reservation.
Parameter `i` is copied from `rbp + 24 + 8*(parameters-i-1)`, including the first
and last of 128 parameters. Locals end at `rbp-1024`; context/counter/floor slots
at `-2032/-2040/-2048` do not overlap them. Explicit returns and fallthrough share
one epilogue which decrements depth and restores stack/base pointers. No concrete
unbalanced path or missing source-push guard was found.

The guards assume ordinary OS stack availability: the documented 8 MiB process
stack, available address space and inherited argv/environment still matter.
They do not catch stack faults, impose a loop quota or sandbox execution.
The 64 MiB arena, one-million division limb-pair cap, 10,000 aggregate IR-node and
1 MiB source/literal limits remain. This review exercised call/stack, arena,
function/parameter/local and depth boundaries; it did not independently exhaust
every source/aggregate-literal/node boundary or retest the full div/rem slice.

## Retained identities

Final evidence: `target/function-source-review-yUi13Y/`, containing each actual
source, emitted ELF, captured streams, rejection diagnostics, probe and summary.
Supplemental call-depth evidence is in `target/function-depth-review-hNkxre/`.
The existing IR harness retained `target/functions-native-UwtoIk/`.
SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `bootstrap/driver/src/lib.rs` | `56846e759fc311f1430783eb8f3d3e41307db27f3f5886e7e6e6ce8426923943` |
| `bootstrap/driver/src/values.rs` | `57a3790f66d76521c47fe93473dcff9a58ddafa627e53b4f7adfd7afda1f5134` |
| `bootstrap/driver/src/main.rs` | `c7b4039066b28f0527e745b0e019c36a2bacf4657ce24205f209c9dc09c4a43d` |
| `backends/native/src/dynamic.rs` | `94922e7985a87386febc915741bbe83d369c6da1e6d479c9f433f28682ea1c04` |
| `backends/native/src/hosted/runtime.rs` | `939650571e2a4e65ba94bd4da823a9b9bec0c2feea6921cb7b9d96bac44492d9` |
| `scripts/test-functions.mjs` | `6878a7c7d46c4c62c9e02225f67c5831981488e32ea64fd01fb86a4dc284eb18` |
| `target/debug/naja.exe` | `c00bc9aa2be13139ca73522f116489513f02885c6f3e79f843ec7948f2482f8b` |
| Final `probe.mjs` | `b3fd930539a53faa8bf9fe9518ff786a5b682bc47d9e69c1e9bcb3bf3c44e806` |
| Final `summary.json` | `fc9f56a7ab65d2345c55a3338c928301e23f2f0e2e0f7976b727958a9167e857` |
| Supplemental depth `probe.mjs` | `e9d5f66ccb0c6c39fea0300d52aa82a3d073b542b3b4158b4a6df747e2852631` |
| Supplemental depth `summary.json` | `49e6a47e8e5028a7b058a08ffca56a5492fa00a4394c3f2ac16bd3253537ea62` |

Selected final native artifact hashes:

| Case | ELF SHA-256 |
| --- | --- |
| Argument order/once | `89592a4f0e4e7abe0edb54d86463922d96fe205f9407d05239d28f4f236663e4` |
| 256 active calls | `5015a1cace9114460301a7356d57c7ccdb880be250cb4a292160c4951bcbb2ff` |
| 257 active calls | `cc9f4da3eb81fce36a57aa13c6e5789cbe51daaa5fd2defa80107eb207fc4c7b` |
| Pending-stack 204 | `d235b077309a3691c06c1a30c711bd1042d98c4b5fa1e14d9b5df3b189cbeff6` |
| Pending-stack 205 | `b18ef9fcb6819b91e759dd3efdedf8686bf7defcb762672932f3e20da3665bdb` |
| Combined maximum source depths | `444507457ed43a20a6754b8dcdbf75c3b16470aea2bf3e251697a75ffb467430` |
| Allocation-once argument | `241a6368e5a523941decb4617fe3eb07befa2281e944a69fdf4f2a3ffa22d390` |
| Explicit duplicate control | `3935d80c552797ef887f8ab2bf62a16f8cc71aa96034fc82dce2c6d3a0609cf6` |

No correctness severity is assigned because no actionable defect was reproduced.
The recorded WSL control failure remains an execution limitation; it is not
reported as a passing product `run` or a native semantic failure.
