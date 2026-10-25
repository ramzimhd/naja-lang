# Independent native div/rem review — October 25, 2026

No actionable correctness defect was found in this finite review of implementation
commit `6847becc8b385b79011b9dca5df3a24aca2983cd` followed by verification commit
`8e5344b502cddc6fc6e7a28a27f032c4a1ce370d`. Actual execution was pinned to the
latter SHA on `agent/divrem-review-v13`, with clean source before the report.
The second commit changes only the harness and documentation; the native backend
has no diff between those two commits. This report is the only tracked reviewer
change. Earlier branches and ignored evidence were preserved.

## Scope and inspected behavior

Read the new `dynamic/routines/division.rs`, its descriptor/numeric wrappers,
IR validation/emission changes, the shared integer normalization/allocator
boundary, development adapter, added tests and documented resource contracts.
The review covers native Int/Bool floor quotient and divisor-signed remainder.
It does not establish source grammar, functions, a new public ABI, catchable
exceptions, self-hosting, full Python compatibility, FC1 or HATCH acceptance.
The independently developed function backend is outside this pinned source.

Inspection found that the kernel stores its operands/counts/signs in a bounded
private stack frame, restores rbp/rsp, retains the arena registers, initializes
quotient padding/remainder limbs, and reuses the candidate-product buffer.
One-limb division uses a bounded exact two-limb intermediate. General division
searches a base-1e9 quotient digit, rather than subtracting per quotient unit.
The sign correction increments quotient magnitude only for opposite signs and
nonzero remainder, then complements the remainder against the divisor magnitude.
Normalization returns canonical zero. These observations were exercised by the
native cases below; they are not a general memory-safety proof.

## Environment and baseline commands

Host: Windows x64. Rust `1.97.1 (8bab26f4f 2026-07-14)`; Cargo
`1.97.1 (c980f4866 2026-06-30)`; Node `v24.11.0`. Generated programs executed on
`Linux 6.6.87.2-microsoft-standard-WSL2 x86_64 GNU/Linux` through the declared
local WSL adapter. The emitted target is Linux x86-64, not Windows application
execution. No Python, provider launcher, authentication flow, installation,
network operation or production reservation mutation was used.

| Actual command | Exit | Result |
| --- | --- | --- |
| `cargo test --workspace --locked --offline` | 0 | 174 tests passed: 4 frontend unit, 119 syntax, 11 native, 12 seed library, 10 CLI, 18 project; no failures |
| `cargo build -p naja-native --example dynamic_ir --locked --offline` | 0 | Development IR adapter built offline |
| `cargo clippy -p naja-native --all-targets --locked --offline -- -D warnings` | 0 | No warnings |
| `node scripts/test-dynamic.mjs` | 0 | 85 author-harness checks; 8194 arithmetic/comparison/truth/representation/metamorphic outputs matched; literal and signed-floor mutants detected |
| `node target/divrem-review.mjs` | 0 | 29 independent native artifacts passed their expected outcomes; 479 floor-oracle pairs |

The existing author suite was independently rerun, not newly authored here. It
includes both native execution and explicit invalid-IR rejection checks; its
85-check total is not a count of newly supported language features.

## Independent expectations and execution

The independent generator and full results are retained under ignored
`target/divrem-review-1trFXl/`, including `probe.mjs`, each `.ir`/`.elf`, exact
stdout/stderr files and `summary.json`. The adapter format is development-only
line/RPN input into the public Rust IR, not NAJA source or an interpreter.
Generated programs execute the emitted machine instructions and Linux syscalls.

Node BigInt division truncates toward zero, so the oracle explicitly corrects
both quotient and remainder before comparing native output:

```javascript
let q = a / b;
let r = a % b;
if (r !== 0n && (r < 0n) !== (b < 0n)) {
  q -= 1n;
  r += b;
}
```

For each of 479 pairs, the oracle also checked `a === q*b + r`, strict remainder
magnitude bound and divisor-sign agreement unless zero. Native programs printed
quotient, remainder, reconstructed numerator, original operands and their retained
aliases, and asserted the reconstruction. Exact output comparison therefore
checked values and input immutability rather than merely accepting zero exits.
Bool inputs were converted to numeric 0/1 only by the independent oracle, while
their original native descriptors still printed True/False after division.

The independent set included:

- The full small signed grid `a=-5..5`, `b=-5..5` excluding zero divisors.
- Base-1e9 boundaries with 1/2/3/9/33/127/256-limb numerators and divisors around
  powers with 1/2/7/31 exponents, for all four sign combinations.
- Long floor-correction carries from `(B**k-1)*b+1`, for `k=1,2,7,64,128` and
  `b=B**9` or `B**31+1`, including long remainder-complement borrow chains.
- Sparse quotient digits from `B**96 + (B-1)*B**48 + 1` and a 48-limb divisor.
- 200 independently generated pairs using xorshift32 seed `0x61a209fd`, with up
  to 80/48 magnitude limbs, plus Int/Bool operand combinations.
- Two 90,000-digit numerator cases divided by the one-limb value 999999937,
  with opposite sign combinations; exact large output matched BigInt.
- Numerators 0/1/-1 against positive/negative 1000-limb powers, exercising
  quotient zero/-1 and remainder normalization/complement.

Additional native probes preserved identical operand aliases, restored all 128
outer local slots after kernel calls, and nested quotient/remainder operations
inside further arithmetic. No source/backend edits were made to obtain a pass.

Each artifact was emitted with the actual command shape:

```text
target/debug/examples/dynamic_ir.exe target/divrem-review-1trFXl/NAME.ir target/divrem-review-1trFXl/NAME.elf
wsl.exe --exec /usr/bin/chmod u+x RESOLVED_ELF
wsl.exe --exec /usr/bin/timeout --signal=TERM --kill-after=1s 5 RESOLVED_ELF
```

`RESOLVED_ELF` came from `wsl.exe --exec /usr/bin/wslpath -a DIRECTORY` plus the
artifact name. Commands used separate argument arrays. Native target timeouts
were five seconds with one-second kill-after; ordinary host calls were bounded
to twenty seconds, captured output to 8 MiB and the independent probe suite to
180 seconds. No limit was raised after execution. No target timed out.

## Work, zero and failure boundaries

All 29 independent artifacts emitted successfully. Twenty exited 0, three
deliberate resource cases exited 103, two type cases exited 105, and four
division-by-zero/evaluation-order cases exited 106, with exact expected output.

| Boundary | Actual outcome |
| --- | --- |
| Dense general quotient and remainder, `a=B**2000-1`, `b=B**499+123456789` | Separate quotient/remainder artifacts passed at normalized `N=2000`, `M=500`, exactly 1,000,000 limb pairs; exact BigInt outputs |
| Numerator `B**2000+1`, same divisor | Both operations rejected `N=2001`, `M=500` with exit 103 and `NJA203: native division work limit exceeded` |
| Zero/False numerator with a 2000-limb nonzero divisor | Returned Int zero for both operations; no inappropriate general-work rejection |
| Runtime divisor `77-77` | Both operations exited 106 with `NJA206: integer division by zero` |
| Large numerator with zero divisor | Zero-divisor failure 106 occurred before a work/scratch error |
| Text operand with zero divisor; zero numerator with Text divisor | Type failure 105, consistent with operand guard order |
| Text left operand and a right expression that divides by zero | Right expression failed 106 before the enclosing operator's type guard |
| False `and`/True `or` with zero/work-failing right operands | Original Bool result returned; skipped expressions did not fail |
| Repeated general floor division of -1 by `B**799` | Arena exhaustion exit 103 with `NJA203: native value arena exhausted`, distinct from work-limit diagnostics |
| Leading zero spelling and negative zero literal | Canonical results `0` and `1`; no negative-zero output |

The work cap remains a declared per-operation resource policy, not fixed-width
integer arithmetic, a whole-program time quota, or evidence of a sandbox. The
error exits are process failures rather than exception unwinding.

## Exact identities

Actual reviewed/built input and local evidence SHA-256 digests:

| Input/artifact | SHA-256 |
| --- | --- |
| `dynamic/routines/division.rs` | `a261a201d6e6aff9d72de55ba0fe130620156dc5255b55c70b65e7bb4075bdd2` |
| `backends/native/src/dynamic.rs` | `de01b790cb2042d60c5fef22c5e47c3bdcb2674a1ff79b74fe5108e0107b95d2` |
| `dynamic/routines.rs` | `b73fb24a4e0a1847a104103f415c18b24714c0b61fa5fab436b8cf541ddd4dab` |
| `hosted/runtime.rs` | `939650571e2a4e65ba94bd4da823a9b9bec0c2feea6921cb7b9d96bac44492d9` |
| `backends/native/examples/dynamic_ir.rs` | `ad76e3cd55dcbf390c9d2b3e20599f6f8f1a1e84d262d18586e177104e41a5c4` |
| `scripts/test-dynamic.mjs` | `397403dfbb029f07eda56fc902338fbffaed1be07a7c6ba4a0054082970f8c91` |
| Built `dynamic_ir.exe` | `6e1d1b1fb51caf0bd1c12127ed9310dd81fca32e2472785f4d13c1a1cdf79f92` |
| Independent `probe.mjs` | `ddbddf3106f384ee200c4d93687ac307638d586ae998698f78332dbf69e05362` |
| Independent `summary.json` | `9c98e446835eb3cdaa51ce2a3ca8da696612f49e6823c74ff50f38c8bd3ff770` |

Selected unsigned ELF SHA-256 values, with all input/output hashes retained in
the summary:

| Independent artifact | ELF SHA-256 |
| --- | --- |
| `ninety-thousand-digit-single-limb` | `9c4745635960fdcb70577e4b98ab01de42c4a5f37882f1393336855da2df7f69` |
| `kernel-frame-restores-128-locals` | `0dab3323b0318407620507b0fcf2c285cb86a1e71d654dbe76e1fe618776d15b` |
| `dense-general-exact-one-million-quotient` | `707b3d551f5dc82999cb09f2e485b141a59c812e95acf088f2400f457e51e890` |
| `dense-general-exact-one-million-remainder` | `8e1953dcff30494a202e88ef54db9057fc1c4f727c2f525911bec2ded93d1428` |
| `work-over-limit-q` | `86aed3e017ca10b5069aedb6f807beb1d2253fbf0f9589c4d31ea5a881205eaf` |

## Handoff and limits

No actionable finding or severity is assigned. This review strengthens the
scoped native div/rem evidence at the pinned SHA; it does not prove correctness
for every input or public ABI safety. Descriptor corruption beyond the validated
internal IR, asynchronous signals during arithmetic, direct-Linux host execution,
other emitted targets, performance and human productivity were not independently
certified. The arena/work guards and process failures are documented limits.

The integrator may retain this report alongside the implementation and existing
verification records. Later function/backend/parser changes need their own
appropriate checks; this result must not be silently attached to newer source.
