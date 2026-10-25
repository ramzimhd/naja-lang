# Independent mapping source review — October 25, 2026

No concrete product defect was reproduced in the reviewed bounded slice at
exact source `b2f4fe02e0e26fcb56643479f6958bde5bbf550f`. There are 41 completed
independent outcomes: 31 native outcomes, nine check/build refusals and one
original-source JSON-span refusal. Two incorrect reviewer diagnostic assumptions
failed separately and remain retained. No gate or requirement is promoted.

The separate clean branch `agent/mappings-source-review-v13` started at that
source. Only this report is committed. The review read AGENTS, the mapping
contract, frozen 202-case preparation and relevant shared parser/value/runtime
paths. It did not run the separate 202-case suite, alter its fixtures, or run
the full Rust test suite; no full Rust-suite result is claimed here.

## Scope and actual observations

An independent 49-pair integer table produced 98 expected precedence results
for arithmetic, `not`, `in`, `not in`, `or` and mixed comparison chains. Native
results matched those expectations. Chains retained their original Dict/Set
middle descriptors rather than substituting Bool results; later operations
received the required unsupported-key/type error. False pairs suppressed later
invalid operands. A huge-integer middle operand evaluated once with ordered
markers, retaining its full precision.

Dict literals evaluated KEY then VALUE before insertion. An unsupported key
still allowed that pair's value effects; a zero-division value failed before
key validation and suppressed later pairs. Invalid first Set elements suppressed
later elements. Indexed stores observed VALUE, CONTAINER, KEY before the relevant
kind/key guard. Snapshot keys retained the first Bool descriptor despite later
equal Int updates, insertion order and the original snapshot length.

The independent BigInt model used 37 signed keys beyond machine precision and
111 deterministic updates. All final values, key order and membership matched.
A separately frozen changed-last-update program executed successfully and
differed from that independent model's expected output, as required. No Python
supplied expectations.
Unicode data keys `K`/`K` and composed/decomposed text remained distinct while
identifier canonicalization resolved the variable binding. Text, Bytes, None,
NUL/unsigned bytes and signed huge integer keys remained distinct as specified.
Aliases through functions, class fields and nested holders preserved mutation
and cycles without copying or recursive traversal.

Function/class/import/parameter bindings named `set` took their declared paths;
local callable values rejected. An ordinary method named `set` did not disable
the unbound builtin. Later module/function/class rebinding after a static builtin
use rejected. Raw keyword lookalikes remained identifiers. An explicitly declared
comparison alias spelled `ｉｎ` participated only in operator context; the same
unconfigured spelling did not become membership. A canonical `ｓｅｔ` builtin
alias rejected with A0007. Member spellings matching aliases remained ordinary
members. Imported `keys_snapshot` rejected Set receivers.

Dict attributes, Set method calls, mapping/object comparisons and `.naja` int
annotation boundaries produced type exit 105; a wrong method receiver suppressed
argument effects. The identical `.py` annotation remained informational.
Thirty-eight assignments containing 128-pair duplicate-key literals passed;
39 rejected at the unchanged 10,000 parse-operation limit. Mixed literal forms,
private class-context names and unsupported callable cases rejected. A CRLF
source containing a non-BMP character retained the undefined Unicode name's
exact zero-based UTF-16 range: line 1, characters 15..18.

Static inspection found the shared relation parser preserves comparison-only IR
and lowers mixed chains to native original-middle reuse. New mapping tags have
explicit check/truth/index/store dispatch; Set reads/stores and unsupported
object operations reach type guards. This inspection and the probes do not
prove arbitrary-pointer provenance, exhaustive tag coverage or memory safety.

## Commands, failures and retained evidence

Host: Windows x64, Node v24.11.0, Cargo
`1.97.1 (c980f4866 2026-06-30)`, Rust `1.97.1 (8bab26f4f 2026-07-14)`.
Actual native target: WSL Linux x86_64, kernel
`6.6.87.2-microsoft-standard-WSL2`. Every execution phase verified exact HEAD,
an empty tracked diff, then built with
`cargo +1.97.1 build --workspace --locked --offline` (exit 0).
Compiler SHA-256: `3a524154ae47c56e91e76d4a603a2694eab410ce8ae30a29b7ba6c540a7ddc5a`.

Each source/expectation plan was written with all outcomes `not_run` before
its native execution. Commands used actual CLI check/build and local WSL
`/usr/bin/timeout --signal=TERM --kill-after=1s 5 ELF`. Budgets were 240 seconds
per phase, 45 seconds per compiler build, 20 seconds per ordinary child, five
seconds per ELF and 1 MiB capture per child. No spawn error or signal occurred;
no budget, product limit or tolerance was raised. Completed native exits were
18 zero (including the changed-source control), 12 type 105 and one division
106. Including the original failed-assertion program, 32 actual ELF executions
occurred. The model ELF inspection found no INTERP segment or dynamic section.

| Actual probe command | Exit | Retained observation |
| --- | ---: | --- |
| `node target/mappings-source-independent.mjs --execute 7d800de958d8d809b3d0bdd4f76645ead2942ba05ac30edbf523b69f62597a36` | 1 | Six cases passed; next program correctly exited 106, but reviewer expected incorrect stderr wording |
| `node target/mappings-source-independent-continuation.mjs --execute ed709f138b1326b44c5d23e194b51cd263e0c49cd75bc3c96d0f2cf9d102ca07` | 1 | 25 cases passed; next source correctly rejected, but reviewer expected incorrect A0007 punctuation |
| `node target/mappings-source-independent-final.mjs --execute d8e37ca47eca1d058971d43ee9b19d758212477fada295061c8fc4d197cae728` | 0 | Ten remaining/corrected cases passed |

The first mistaken expectation was `NJA206: native integer division by zero`;
the existing diagnostic is `NJA206: integer division by zero`. The second expected
`A0007:` while project diagnostics say `A0007 at config bytes 21..32:`. Separate
continuations froze the correct exact wording before rerunning those cases;
original failed plans/captures remain unchanged. Before reaching its annotation
case, review corrected an expectation that contradicted `.py` informational
annotations, then added the separate `.naja` guard case. Two earlier preparation
plans had ineffective changed-source controls; both remain entirely `not_run`.
The executed control changes the final retained update, not an overwritten one.
None of these review preparation/assertion errors required a product change.

Original probe scripts remain at ignored `target/mappings-source-independent*.mjs`.
Plans, sources/configs, commands, captures, ELF hashes and partial/final summaries
remain under ignored
`target/mappings-source-independent-{01,02,03,04,05}` in this review worktree.
All 164 recorded child commands' 328 capture hashes, planned source hashes and
completed ELF hashes were independently checked afterward. Summed child elapsed
time was 32,185 ms; it is not performance or human productivity evidence.

| Execution directory suffix | RESULTS.json SHA-256 |
| --- | --- |
| `03` | `553a55ae976f2a9c3219e2b3a57223a9c382bd00afb83fe3cc68b58633e8aaf8` |
| `04` | `ed2034ac753c41f94c2c04139b8b9a09c06defab2c1b89887de7bec17a46c4b0` |
| `05` | `f5b68f3972a2ae59b40b41d09e30f206841eaa61be19001d88aa9b6bb0bc51cd` |

No corrupt-descriptor injection, full key-work/arena boundary rerun, exhaustive
syntax/hash protocol, general collection iteration/mutation, structural equality,
reclamation, installation, self-hosting, cells, FC1 or HATCH proof follows.
Existing broader source/backend evidence retains its own pins and scope.
