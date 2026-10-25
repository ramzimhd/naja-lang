# Corrected-alias mapping source run — failed, October 25, 2026

The 202-case suite with the separately corrected alias configuration failed at
exact source `d0dd2804eec72291017799ad6e2289fef90a7daa`: 146 cases passed,
one failed and 55 remain `not_run`. This second failure is another preparation
error. It does not establish a mapping implementation defect or source-gate pass.
The original 11/1/190 alias-fixture failure remains retained separately.

The command was:

```text
node scripts/test-mappings-language.mjs --expect-source d0dd2804eec72291017799ad6e2289fef90a7daa
```

It exited 1. The failed case is `work-same-descriptor-exact-bytes`:

```naja
key = b"x" * 250000
value = {key: True}
print(value[key])
print(key in value)
value[key] = False
print(value[key])
```

Both check and build exited zero and emitted an ELF. Native execution exited
105 with empty stdout and exact stderr
`NJA205: native value type mismatch\n`, instead of expected exit zero with
`True\nTrue\nFalse\n`. Its source SHA-256 is
`20d37cd5e0c2734b28b94de2a13245502c0020f09fc9e7fb922618ef6b34defc`.

The first line uses unsupported Bytes repetition. The current seed's
`backends/native/src/dynamic/routines.rs:282` routes multiplication through
`numeric_pair`, which converts both operands through the integer-only numeric
guard. Text/Bytes concatenation is separately supported by addition. The
key-construction line therefore correctly fails before the Dict literal,
lookup or key-work boundary. The preparation wrongly assumed repetition support.
Existing file-boundary source checks use concatenation to construct large data.
No production expansion or relaxation is required by this observation.

The completed cases comprised 138 native semantic/error cases and eight compile
rejections. Another native artifact ran and produced the unexpected type exit,
for 139 actual ELF executions. The corrected alias case, independent Dict/Set
models, all-byte/UTF-8-width keys, frame/effect/type/membership checks and
literal/capacity/expression/relation bounds before this work case passed.
Later work/resource cases, remaining compile rejections and both mutants did
not run. No successful key-work boundary observation follows from this run.

The 579 recorded child commands produced 470 exit-zero results, 16 expected
compile exits 1, two limit exits 103, 83 exits 105 (including the unexpected
failure), two zero-division exits 106 and six missing-key exits 111. No spawn
error or terminating signal occurred. No timeout satisfied a language result.
The compiler host was Windows x64 with Node v24.11.0, using pinned locked/offline
Rust 1.97.1. Emitted Linux x86-64 programs executed through actual local WSL.

No harness logic, payload source, expectation, hash, cap or tolerance changed
for this run. Corrected alias preparation commit
`2ec748511cfe97e1dd83a174e82927f341e8ffa7` was integrated unchanged; all
202 source-case identities remained those of the original preparation. The
budgets remained five seconds per native process, 20 seconds per ordinary
command, 45 seconds per compiler build, 240 seconds overall and 8 MiB capture.
The tracked tree was clean; inherited untracked `bootstrap/frontend/Cargo.lock`
was preserved and was not the workspace lockfile.

[FAILED_REPETITION_RESULTS_2026-10-25.json](FAILED_REPETITION_RESULTS_2026-10-25.json)
retains all 202 original identities/outcomes, commands, exits/signals, source
and capture hashes. Original sources, ELF files, full captures, plan and the
original `failure.json` remain in ignored `target/mappings-language-88K0z0`.

| Artifact | SHA-256 |
|---|---|
| Compiler executable | `584e643d2dc651e0105464656406ed1d6deb8e625815ca89da8e1ca21858b91e` |
| Frozen harness | `9305262115d2e8282f1e621a1dba47a15ddaf36ac945257fc23fe4e5b46f0bfc` |
| Corrected fixture index | `956ce17ebb381d9654a28ee22807a860a752da6b3346237ad540ca7546b7f375` |
| Original failure JSON | `49507d604c80f66676dec79484f3f09ede869a249cef72fa0b5dbd547ea3039e` |
| Failed native ELF | `24cd0aae28188f572fbe37011c32bda9d096930b7b9ab5659399cab00859b754` |
| Actual-run plan | `88eef3d14edc2eb1ed8aff4b12fee0bf3d20daeb2e38acf4a544c43a6a1d16e2` |

A separately authorized repair may replace only unsupported key-construction
repetition with finite native concatenation, preserving actual bytes, alias
identity, work formulas and oracles. It must be frozen before another exact-source
run and cannot relabel this failure. This evidence commit itself changes no
test inputs. No independent Rust baseline was run by this worker; the
integrator's concurrent formal records remain separately owned. No full
mapping, installation, self-hosting, FC1 or HATCH result follows.
