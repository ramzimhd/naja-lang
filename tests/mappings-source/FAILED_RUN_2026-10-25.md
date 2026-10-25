# First frozen mapping source run — failed, October 25, 2026

The unchanged 202-case source suite failed at exact integrated source
`b2f4fe02e0e26fcb56643479f6958bde5bbf550f`: 11 cases passed, one failed and
190 remain `not_run`. This is not a mapping source gate pass. The failure is a
preparation-fixture configuration error; it establishes no compiler defect.

Preparation commit `93d2be2a9314653726ec83a055a56d9fb792fa21` froze the cases,
hashes and budgets before execution. Its assigned-path diff against the
integrated source was empty. No harness, fixture, expectation, diagnostic,
hash, cap or tolerance changed for this run. This failure-evidence commit changes
none of those inputs. The frozen
source/config and original failed observation remain available unchanged.

| Command | Exit | Observation |
|---|---:|---|
| `node scripts/test-mappings-language.mjs --expect-source b2f4fe02e0e26fcb56643479f6958bde5bbf550f` | 1 | 11 passed, one failed, 190 not run |
| Failed case: `naja check SOURCE --project-root PROJECT` | 1 | NJA030/A0003 rejected the alias configuration |
| Failed case: `naja build SOURCE --target x86_64-unknown-linux-gnu --output NEW_ELF --project-root PROJECT` | 1 | Same rejection; no ELF emitted |

The failed case is `project-contextual-aliases-and-members`. Its frozen
`project/naja.alias` contains:

```toml
[operators]
"==" = "equalTo"
[builtins]
print = "表示"
len = "長さ"
```

The supported strict alias grammar requires double-quoted keys and values.
The unquoted keys in this preparation are therefore invalid. Both compiler
stages correctly reported `NJA030: invalid alias configuration`, followed by
`A0003` at original config byte ranges `40..56` and `57..71`:

```text
Alias keys and values require one-line double-quoted TOML basic strings; other forms are unsupported.
```

The failed source SHA-256 is
`55ed6282c3ca6611dfb19200d5ba09b3da246ba20fea06b59a9c9801ee161bd8`.
The frozen invalid configuration SHA-256 is
`005db0c79b2d85f61ea0c20d984abf671e444c6baff930eee9ed981daa09f691`.
Its expected native exit was zero, but native execution was never reached.
This fixture needs a separately recorded correction and new preparation before
rerunning; changing compiler behavior to accept it is not required by this
observation. The original failed run must remain failed.

The 11 completed cases were `forms`, `snapshots`, `order`, `cycles` and `chains`
in both `.py` and `.naja`, plus `.naja` `blocks`. All 11 emitted ELF programs
actually executed through local WSL `Linux x86_64` and matched exact exit-zero
stdout/stderr bytes. They exercised basic literals, snapshots, effect order,
aliases/cycles, membership chains and shared suites. Later model, type/error,
resource and mutant cases did not run and receive no execution claim.

The compiler host was Windows x64 with Node v24.11.0. The compiler was built
using `cargo +1.97.1 build --workspace --locked --offline`; the emitted target
was `x86_64-unknown-linux-gnu`. The 53 recorded child commands had 51 exit-zero
results and the two expectedly observed compiler rejections above. No spawn
error or terminating signal occurred. No timeout satisfied any expectation.
The budgets remained five seconds per native process, 20 seconds per ordinary
command, 45 seconds per workspace build, 240 seconds overall and 8 MiB captured
output per child. They were not increased.

[FAILED_RESULTS_2026-10-25.json](FAILED_RESULTS_2026-10-25.json) retains all
202 original case identities/outcomes, exact executed command arguments,
exits/signals and capture hashes. Full sources, original captures, emitted
ELF files, plan and original `failure.json` remain in ignored
`target/mappings-language-rG7F3Z` in the frontend worktree. The tracked tree
was clean during execution; inherited untracked
`bootstrap/frontend/Cargo.lock` was preserved and not used as the workspace
lockfile. No production, old-harness or shared-planning paths changed.

| Artifact | SHA-256 |
|---|---|
| Compiler executable | `584e643d2dc651e0105464656406ed1d6deb8e625815ca89da8e1ca21858b91e` |
| Frozen harness | `9305262115d2e8282f1e621a1dba47a15ddaf36ac945257fc23fe4e5b46f0bfc` |
| Static fixture index | `3aa873689b266e8865e1e6aabfb92cc5c7cf67ef59ce85378d79d16984635d29` |
| Original failure JSON | `210e74e278a4137657271a39fffb942e8ed5df243ece206f023c1aec818593bd` |

No independent Rust workspace baseline was run by this worker. The integrator's
concurrent formal regressions are separately owned and are not claimed here.
This failed suite establishes no source gate, full container semantics, clean
installation, self-hosting, FC1 or HATCH result.
