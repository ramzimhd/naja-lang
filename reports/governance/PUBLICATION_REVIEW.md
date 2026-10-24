# Bounded publication review — October 24, 2026

Reviewed source commit: `6e702caec0dae3ec90a92d57490387f97d7e09a8`.
Repository: [ramzimhd/naja-lang](https://github.com/ramzimhd/naja-lang).
Reviewer: an AI-assisted contributor in a separate worktree, assigned by the
integrator. This is an internal review, not an independent human, external
security, legal or trademark audit. It does not accept a HATCH release.

The public source tree contains an explicitly limited Rust seed and honest
documentation of the remaining compiler/runtime/tooling work. No credential,
private profile path, contact address or binary was found by the bounded scans
below. Retained pre-publication review evidence is incomplete, so this review
does not establish GOV-05 as verified.

## Source and access checks

Unauthenticated Node.js HTTPS requests, without an Authorization header or
cookies, returned these results on October 24, 2026:

| Endpoint | Observed result |
|---|---|
| `https://api.github.com/repos/ramzimhd/naja-lang` | HTTP 200; `private=false`; owner login `ramzimhd`, owner ID `29204956`; default branch `main`; license identified as `Apache-2.0`; not archived |
| `https://raw.githubusercontent.com/ramzimhd/naja-lang/6e702caec0dae3ec90a92d57490387f97d7e09a8/README.md` | HTTP 200; 2,717 bytes |
| `https://api.github.com/repos/ramzimhd/naja-lang/private-vulnerability-reporting` | HTTP 200; `enabled=true`, checked after the integrator enabled the setting during this review |
| `https://www.apache.org/licenses/LICENSE-2.0.txt` | HTTP 200; exact raw SHA-256 matches the reviewed `LICENSE` |

Owner identity and license authorization were supplied by the integrator from
the authorized session: the owner expressly selected Apache-2.0. The review
confirmed the public repository's account ID rather than inventing a new identity.
It did not create a repository, change account settings or publish files.

## Governance, provenance and public claims

| Area | Observation at the reviewed source commit |
|---|---|
| License | Complete Apache License 2.0 text. Both the Git blob and official raw license have SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`. All three Cargo packages declare or inherit `Apache-2.0`. This is a text/metadata check, not an opinion on all possible licensing rights. |
| NOTICE | Records the owner's license selection, owner-supplied specifications and AI-assisted work. Explicitly disclaims an external audit and a complete release SBOM. Attributes Python reference material to the Python Software Foundation and contributors. |
| Current Cargo dependencies | `Cargo.lock` contains three workspace packages. The driver depends only on the two local workspace paths; frontend and native backend have no external crate dependencies. This does not audit the Rust distribution, host SDK or future dependencies. |
| Reference material | Compatibility metadata retains source hashes, production names and coordinates. No upstream Python grammar rule bodies or implementation actions are copied there. Pinned source-license references remain linked; upstream source is not presented as newly Apache-licensed NAJA implementation. |
| Origin narrative | README describes the founder's long-held language goal and AI assistance without inventing biography, dates, partners or a human development team. |
| Implementation status | README calls the product an experimental Rust seed and explicitly lists missing complete parsing, hosted integers, self-hosting, native sessions and VSIX. Its bounded explicit-`i64` spike and Linux x86-64 target are named. No universal Python compatibility, Rust safety, C++ speed or measured productivity claim is made. |
| Contribution policy | CONTRIBUTING requires authorized contributions, English official material, preserved evidence/IDs, scoped coordination, actual tests and provenance disclosure. It does not fabricate a signed DCO or contributor agreement. |
| Security and conduct | Files exist and honestly state experimental status, OS privileges, absent supported releases and absent response guarantees. Their original private-contact directions needed improvement; the working-tree/configuration follow-up is recorded below. |
| CI and artifacts | Workflow is named experimental, uses read-only repository permissions and pinned action commits, and does not claim completed platform acceptance. No VSIX, installer, built executable, private reading attachment or logo is tracked in this source commit. Remote CI outcomes and release signing were not audited. |
| Original package evidence | HOST_SUMMARY explicitly identifies `SHA256SUMS.txt` and `PACKAGE_VALIDATION.md` as original launch-package evidence. They are not checksums or acceptance results for the implementation tree. |

## Concrete findings and follow-up

1. **GOV-05 retained pre-push evidence is incomplete.** The integrator reports
   that explicit staging lists, staged-diff inspection and secret scans actually
   ran before the initial commits and first push: 61 baseline files, followed by
   a 28-file implementation commit (`d9846dd83389562841beea040061e56d1ff95508`).
   No retained initial transcript file was available in the reviewed tree.
   This contributor did not independently retrieve those earlier tool outputs.
   The retrospective committed-history scan below is real new evidence, but
   cannot establish that the earlier review occurred before publication. Preserve
   that distinction and leave GOV-05 unverified unless adequate original evidence
   becomes available. Do not manufacture a historical scan transcript.

2. **Published planning state needs the repository transition recorded.** At
   this commit, `planning/state.json` line 7 has `repository_url=null`, and line 16
   still says public repository creation awaits CLI authorization. The repository
   is now publicly accessible. Update state and the related task/handoff evidence
   additively on the integration branch. This report does not modify their
   statuses or erase the earlier authentication blocker.

3. **Private reporting directions were incomplete at the reviewed commit.**
   SECURITY.md lines 8–11 and CODE_OF_CONDUCT.md lines 8–10 relied on a previously
   existing private channel without giving a newcomer a concrete route. During
   this review the integrator enabled GitHub private vulnerability reporting;
   an independent unauthenticated GET then returned `enabled=true`. The current
   uncommitted SECURITY.md now links
   [the private reporting form](https://github.com/ramzimhd/naja-lang/security/advisories/new).
   The uncommitted conduct policy provides a public request for a private contact
   route, explicitly forbidding names, allegations or sensitive details in that
   request, and discloses the absence of a dedicated moderation address. These
   working-tree changes were inspected read-only. Their publication remains an
   integration step; they are not part of source commit `6e702ca`.

4. **Issue and PR templates remain absent.** The reviewed `.github/` tree
   contains the seed workflow only. Document 11 section E5 calls for issue/PR
   templates. CONTRIBUTING provides useful rules but does not itself supply
   those submission templates. Treat that as remaining public-governance work,
   without claiming all official surfaces are delivered.

## Retrospective content and history inspection

The inspected history contains **9 commits, 121 files at the tip and 146 unique
historical blobs**, totaling **787,925 bytes**. All blob objects reachable from
the reviewed commit were scanned, including earlier versions of changed or
deleted files. All nine author and committer identities use the authorized
`ramzimhd` account's GitHub no-reply identity. No unexpected author identity was
found. The review inspected the commit range's changed-file inventory and read
the governance/provenance/status files; it was not a line-by-line security audit
of all compiler implementation changes.

The bounded scanner checked recognizable GitHub/OpenAI/AWS/Google/Slack credential
formats, private-key headers, obvious secret assignments, credentials embedded
in HTTP URLs, user-profile paths and email addresses. It printed candidate
categories and paths only, never candidate values. It found zero candidates.
No NUL-containing or invalid-UTF-8 blob was found. No prohibited private/build/
reading/binary path was present in the tip inventory. These are findings from
specified checks, not a guarantee that every possible secret encoding or form
of personal information is absent. No external secret-scanning service was used.

`reading/NAJA_HATCH_Project_Brief_EN_v1.2.docx`, the legacy French summary and
`naja logo.png` match the repository's ignore rules. None appears among any
reachable tracked blobs. Their private contents were not opened or reviewed.

Ten committed evidence JSON records were examined. Their ten referenced log
hashes matched both exact Git blob bytes and the current checkout bytes; no log
was missing. `.gitattributes` sets `reports/checks/*.log -text`, and
`git check-attr --source=6e702ca... text eol` confirms `text: unset` for the tested
logs. The inherited `eol: lf` does not enable conversion when `text` is unset.
This review checked retained byte integrity; it did not rerun the recorded
compiler checks or establish the records' complete behavioral coverage.

The original source commit has no tracked binary payloads despite the evidence
logs being marked `-text`. Disabling text conversion preserves raw evidence
bytes; it is not an indication that a compiler or seed binary is embedded.

## Commands, tools and boundaries

Tools: Node.js `v24.11.0`, Git `2.51.0.windows.1`, Windows x64. The read-only
commands and Node stdin checks completed with exit code 0. No Python executable,
package installation, secret value output, external billing, security bypass or
source-tree/account mutation was used for the checks. The final report is the only
assigned file changed by this contributor.

```text
git show -s --format=fuller 6e702caec0dae3ec90a92d57490387f97d7e09a8
git ls-tree -r --name-only 6e702caec0dae3ec90a92d57490387f97d7e09a8
git log --format=%H%x09%an%x09%ae%x09%cn%x09%ce 6e702ca
git diff --stat 684f59efb35ec10e5fa43026e616c3df358108ea 6e702caec0dae3ec90a92d57490387f97d7e09a8
git check-attr --source=6e702caec0dae3ec90a92d57490387f97d7e09a8 text eol -- reports/checks/seed-rust-tests.log reports/checks/h0-inventory.log compatibility/baseline.json
git check-ignore -- reading/NAJA_HATCH_Project_Brief_EN_v1.2.docx DOSSIER_DE_SYNTHESE.md "naja logo.png"
node --input-type=module
```

The Node stdin checks used built-in `fetch`, `crypto`, `fs`, `child_process` and
`buffer` APIs. HTTPS checks examined status and the specific public metadata
fields listed above. License checks compared actual raw SHA-256 values. Log
checks read committed JSON, hashed exact referenced blobs and then hashed the
same checkout files. The history scanner used `git rev-list --objects`,
`git cat-file --batch-check` and `git cat-file blob` to inspect each unique blob;
its zero-candidate result does not depend on excluding a failing file.

This report covers the named source commit and the explicitly observed security
configuration/working-tree follow-up. Later commits, untracked evidence, branch
protection, account ownership beyond the checked public account ID, trademark
clearance, release SBOM completeness, signing and full HATCH acceptance remain
outside its conclusions. Findings were sent to the integrator; no external
correspondence was sent.
