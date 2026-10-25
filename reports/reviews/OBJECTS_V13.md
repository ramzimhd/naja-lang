# Independent ordinary-object source/native review

Reviewed October 25, 2026. **One P2 source defect was reproduced at
`564461b8066e7b6cd328ff2b362bdabfc33bda0f` and fixed subsequently by the integrator.**
Targeted follow-up passed at exact source
`b0e54cb2db1a2aea20b6056c05f92ea5e6b62560`; no additional concrete supported-path
defect was reproduced. The original source did not pass the private-name probe.

Separate branch `agent/objects-review-v13` began clean at the first pin and later
fast-forwarded to the supplied fix pin. Only this report is committed. Product,
harness and planning changes remain integrator/other-agent work; ignored earlier
artifacts and the original compiler binary are preserved. Read AGENTS, documents
03/05/07, continuation L05/L06/FC1, object contract/runtime, class parser and frozen
170-case source preparation. That separate source harness was not run or claimed
by this review. Full ordinary classes, L05 extensions and L06 partial classes
remain required work.

## P2: unsupported private names silently received ordinary keys

At the original pin, `member_name` rejected most special dunder members but
accepted private identifiers such as `__value`. The frontend stored/read those
ordinary keys without contextual mangling, despite documenting private-name
mangling as unsupported. Both `.py` and `.naja` accepted this program:

```text
class Secret:
    def __init__(self):
        self.__value = 7
print(Secret().__value)
```

Actual check/build exited 0; native execution printed `7` and exited 0. Changing
only the external read to `_Secret__value` also checked/built with 0 but exited
110, `NJA210: native object attribute not found`. These are actual emitted ELF
observations, not Python execution. The pinned Python reference requires private
class-context names to be transformed before generation; this is a semantic
lookup difference. [Python 3.15.0 expression specification](https://raw.githubusercontent.com/python/cpython/v3.15.0/Doc/reference/expressions.rst).

Given this slice's documented unsupported status, explicit rejection was needed
instead of silently binding different names. Original probe
`node target/objects-private-name-review.mjs` exited 1 after its expected-rejection
assertions failed: all four programs were unexpectedly accepted. Source,
original ELF, streams, hashes and failed summary remain under
`target/objects-private-name-ZZD04A/`. The unmangled-read source SHA-256 is
`2082aaf388dd420ec40b0e49b2eae7a38e3d248caa512a54d3e4a1380e4765dc`;
the mangled-read variant is
`ae07a9f91b9b9361fb4eebb787b85482e79a987064a807a228740b3a67213483`.

The integrator's correction is
`fcbe4575b6dd90b2a012da8e1ddcfc89d6f064c3`. Shared canonical-name resolution now
diagnoses leading-`__`, non-trailing-`__` identifiers in textual class scope,
including methods, parameters, locals, attributes and referenced names. It keeps
original token spans, outside-class names/data and `__init__`. Backend exact-byte
keys were not redefined. Full contextual name mangling remains unimplemented.

Before that fix was available, the review froze 34 cases: 13 refusal forms and
four positive forms in both dialects. They cover field reads/writes, method
definitions/calls, parameters, local writes, module-global reads/calls and class
references; NFKC `_＿secret` canonicalizes to `__secret` without raw double ASCII
underscores. Controls preserve outside-class names/fields, strings, single
underscores and initialization. Preparation records all 34 as `not_run`.

At the fix pin, all unchanged 34 cases passed: 26 check/build rejections and eight
actual native positive controls. The executed script and all case definitions
were compared byte-for-byte/structurally with the pre-fix freeze. Four additional
private print/len project-alias calls inside methods rejected correctly. Four
outside-class alias controls still ran, and an NFKC error covered exactly the
original UTF-16 token at line 2, characters 29..37. These 43 focused outcomes
establish the tested conservative guard, not full mangling or complete conformance.

## Actual commands and source boundaries

Host: Windows x64, Node `v24.11.0`, Rust `1.97.1 (8bab26f4f 2026-07-14)`, Cargo
`1.97.1 (c980f4866 2026-06-30)`. Native target: WSL Linux x86_64, kernel
`6.6.87.2-microsoft-standard-WSL2`, reported stack limit 8192 KiB. No Python,
foreign native compiler/linker, provider/auth operation, service, installation,
ownership change or paid fallback was used. Only primary reference text was
consulted online; no Python interpreter supplied an oracle.

| Source | Actual command | Exit/result |
| --- | --- | --- |
| Original pin | `cargo test --workspace --locked --offline` | 0; 260 tests |
| Original pin | `cargo clippy -p naja-seed -p naja-native --all-targets --locked --offline -- -D warnings` | 0 |
| Original pin | `cargo build --workspace --locked --offline` | 0 |
| Original pin | `node scripts/test-objects.mjs` | 0; existing 74 native checks, 78 oracle output lines |
| Original pin | `cargo test --workspace --locked --offline -- --list` | 0; 4+125+11+3+6+3+3+4+4+27+16+17+23+14 = 260 |
| Original pin | `node target/objects-independent-review.mjs` | 1; 26 completed cases, then incorrect reviewer diagnostic wording |
| Original pin | `node target/objects-independent-continuation.mjs` | 0; 40 cases, 25,100 ms |
| Original pin | `node target/objects-stack-span-review.mjs` | 0; three cases, 1,676 ms |
| Original pin | `node target/objects-private-guard-followup.mjs --prepare-only` | 0; 34 cases, all native `not_run` |
| Fix pin | `cargo test -p naja-seed --lib --locked --offline` | 0; 28 seed library tests |
| Fix pin | `cargo build --workspace --locked --offline` | 0 |
| Fix pin | `node target/objects-private-guard-followup.mjs --expect-source b0e54cb2db1a2aea20b6056c05f92ea5e6b62560` | 0; 34 cases, 14,363 ms |
| Fix pin | `node target/objects-private-alias-review.mjs` | 0; four check/build refusals |
| Fix pin | `node target/objects-private-outside-span-review.mjs` | 0; four native positives plus one JSON range refusal |

Original supported-path probes comprise **69 completed cases**: 51 native
outcomes, 17 check/build refusals and one semantic JSON span refusal. The native
exits are 19 zero, 26 type 105, four resource 103 and two attribute 110. Private-name
defect observations and failed review assumptions are reported separately.
New-source targeted results are not a rerun of the original full 260-test/native
suite; other agents own integration-wide regressions.

Main independent probes fixed 240 seconds overall, 20 seconds per child, five
seconds per ELF and 8 MiB captured output. Stack/span probes fixed 90 seconds;
private defect/fix probes used their frozen 60/90/180-second suite caps with the
same child/native/output bounds. Real ELF used literal argv through
`/usr/bin/timeout --signal=TERM --kill-after=1s 5 ELF` under explicit WSL. No timeout,
signal, expectation loosening or raised product budget counted as success.

## Independent supported-path evidence

- A Node BigInt/reference-identity model uses 48 objects across six classes,
  503 deterministic updates through a permuted alias table, distinct class
  arithmetic and final field/identity observations. All 599 outputs match without
  using backend IR or addresses as the expected-value source.
- A selected receiver/native method remains selected while arguments replace its
  holder with another class, shadow its method field and mutate its value. Method
  body observes the original receiver's updated state. Noncallable fields and
  missing members reject before argument effects; wrong arity follows argument
  effects. An argument-created file remains while a mismatched method body never
  executes its write.
- Attribute VALUE precedes OBJECT once, including replacing the target holder.
  Rebinding the initializer's receiver local does not replace the original
  constructed result. Self/indirect cycles, fields inside tuple/list references
  and returned aliases preserve shallow identity and per-instance state.
- Canonical class/member keys, parameters shadowing class names, deferred
  initializer metadata, later instance methods and project alias/member contexts
  work. Indented and brace-labeled class/method forms emit identical unsigned ELF;
  Python indentation also executes. Unsupported collisions, class values/body
  effects, inheritance/defaults/keywords/decorators/special methods and uninitialized
  skipped/unused operands reject rather than silently executing another meaning.
- Existing object numeric, ordering, len, indexing/store, container-comparison,
  file and conversion type guards report 105, including the corrected object-index
  path. Initializers returning False/self fail the None restriction explicitly;
  completed effects remain. Capacity 128 fields still permits existing-field updates,
  then a new field fails 103. Source member height 128 accepts and 129 rejects;
  method call depth 256 accepts and 257 fails 103.
- Actual main CLI execution with eight nested lists, each holding 127 pending
  descriptors, succeeds with recursion input 180. Input 220 hits the unchanged
  source-stack 103 guard below the call limit, without crashing. Deferred constructor
  arity after completed class metadata maps original `Key` to UTF-16 line 3, 15..18.
- Exact private layout accounting admits 32,263 instances of 2080 bytes in 64 MiB.
  Literal-only argument/initializer marker output matches that count and has one
  final argument marker before allocation 103. Changed method-source controls print
  41 versus 42 through actual native code, detecting a method-result substitution.

The initial independent suite's arena case matched exit 103 and every output/count
but expected generic `hosted integer arena exhausted`; this emitter actually uses
`native value arena exhausted`. That reviewer message assumption remains a failed
run under `target/objects-independent-TNiFVc/`, with its original script/expectations.
A separate continuation used the exact documented diagnostic without changing
counts, effects, source, compiler or budgets. The original defect probe remains
failed separately. Neither failure is relabeled as an original passing run.

## Runtime audit, identities and remaining scope

The audit found no additional supported-path defect in constructor argument copies,
guarded method metadata/arguments, frame cleanup or object-table operations. Private
tag 7 owns a fixed table; counts/class/name/selected-value spans are checked before
payload interpretation. Stores update pointers without allocating; child objects
are not recursively traversed. Dispatch selects compiled native entries, while
ordinary call/frame/arena guards remain shared. Region checks are not provenance
proofs for arbitrary modified executables. The existing authored mutants exercise
spans/count/class/selected values and relocated entry/output controls; their
historical index 107/type 105 and Rust E0502 failures remain documented.

Limits remain: 128 classes/methods-per-class/fields, 128 total functions/locals/
parameters including receiver, 1024 static member names, 256 UTF-8 bytes/name,
128 expression depth, 64 suites, 10000 nodes, 1 MiB aggregate literal/source limits,
256 calls, 2 MiB source stack plus 4096 helper reserve and 64 MiB arena. No arbitrary
pointer safety, GC/reclamation, concurrency, exception unwinding, general callable
fields/class values, inheritance, descriptors, full private mangling, extensions,
partial classes, cross-target/clean-host, self-hosting, FC1 or HATCH claim follows.
The full non-object harness set was not independently repeated here.

Retained local evidence is under `target/objects-native-9GSm82/`,
`target/objects-independent-TNiFVc/`, `target/objects-independent-2JNk5K/`,
`target/objects-stack-span-W9Gg2y/`, `target/objects-private-name-ZZD04A/`,
`target/objects-private-followup-6agBIM/` (prepared),
`target/objects-private-followup-j8vO2C/` (executed),
`target/objects-private-alias-pN4Jh0/` and
`target/objects-private-outside-span-B8kruB/`. Original compiler:
`target/objects-review-old-naja.exe`. These ignored artifacts are preserved, not
included in this report commit. SHA-256 identities:

| File | SHA-256 |
| --- | --- |
| Frozen object contract | `a2252c416e58025a0aa4660f9438800df7c80e525195fec784bef7b92307a20c` |
| Native `dynamic.rs`, unchanged at fix | `5ec5b51facc7c4a4aac73ca04134e6648063a013b1c4ab1357ee399d4b608e37` |
| Native `routines/objects.rs`, unchanged | `c7b9172935975aff465bcb40ff22fec7ce7210d31e81a7d5b23cf584932976ce` |
| Original driver `lib.rs` | `fc0121389670df342967f38f133a56ffa8920679828c9fe83c9c18dbb5eb71d4` |
| Fixed driver `lib.rs` | `df1e8d0f73f5bbeefb921e393b5f8bbdf125ab0bb74ab9c5e46fbd4cfb950758` |
| Original compiler | `0b5c2ba9356cf6823ea7b8d6f8c40090e55bb5bf4e21a394d154ac89ec2e7e03` |
| Fixed compiler | `242242bac21c81eef0cd3d6b58e05aa7aafa580f54bdc76e1c5a4c56863a6638` |
| Original supported `probe.mjs` | `ef88d83cb635c1cc9c48137222ffec81c8f35d20607580b1f40a0da1783b687e` |
| Original failed `summary.json` | `e180efd5526856021e1482c64318253add62608b332e7c97b26d6f970030e29c` |
| Continuation `summary.json` | `4b9127686010ed9b0350099e35245ac80942b557fa60d2d92656969b14b70608` |
| BigInt dispatch ELF | `56a26283c7d227f8635d2347486f279007855552ad6bf9c5e3c1f0c5e4161ed0` |
| Stack/span `summary.json` | `4f65387127b45b4c07286d5cb49b9de1536d9010f5f1bd9985514b63e58da6ec` |
| Private defect `summary.json` | `cca0e5bb9713653366a0b380477f62144850e2901e1427577e5b029ad0bab803` |
| Frozen/executed private `probe.mjs` | `2eebc210449c20619d5a09c3dad6f611ebfae089ec1891db07cf9a10a816a60f` |
| Pre-fix private freeze `plan.json` | `d9b8a0eb1a0daac5d7550209c770ffff4a15f488c287c747655b5733f0542cfe` |
| Fixed private `summary.json` | `00ef4bbbbd2b32fa99a30ff4c50de9ffb418ff8f37a4529a6190f678caef9c33` |
| Private alias `summary.json` | `5dcd9f2a18370a5536156c2408f35bb2b97e0e6a28d1a13b30726c9dd8553632` |
| Outside/span `summary.json` | `141ab6828e113bf34806345cb3fa33d18ba840ae7f6e9c5b6ebacea423aa5109` |

Disposition: the P2 finding is fixed at the stated subsequent source with targeted
proof. Original failures, partial semantics and all inherited open acceptance gates
remain visible; this review promotes no gate.
