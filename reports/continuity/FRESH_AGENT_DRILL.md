# Fresh coding-agent recovery drill — October 25, 2026

## Scope and source

This was a genuinely separate coding-agent handoff in an explicitly disposable
Git repository. The incoming agent used its on-disk `HANDOFF.md`, actual Git
state and private checkpoint to continue a synthetic work item. It was not a
provider interruption, production integration transfer, compiler acceptance
result, or evidence of unattended continuation.

The production reservation, product source and public planning were not changed
by this reviewer. The review branch is
`agent/recovery-review-v13`, based on
`dcbee519ad4da6a60d93bfba1cd5a4c280c7d2ec`. The reviewed continuity implementation
was last changed in `bbb35e0555e28573c5bcca5f772b58db25797a09`.
The helper used by the drill and the review checkout's helper had matching bytes:

| Source | SHA-256 |
| --- | --- |
| `tools/continuity/local.mjs` | `39c277705dc2a89bb8ab7e5f78b604a4cec17e181e096dfbc09d9af88ef89a1d` |
| `tools/continuity/schemas.mjs` | `ffac4db943369f89df0948a1c6b2fa11f91addd06b2eb1c4d89a1163cc4d6f00` |

Execution host: Windows, `win32 x64`; Node `v24.11.0`; Git
`2.51.0.windows.1`. No model/provider CLI, credential extraction, paid fallback,
service, production fetch, reset, force-push or public publication was used.
The existing tests fetch only their disposable local remote fixture.

## Actual ownership and task outcome

The outgoing owner had already checkpointed and released reservation generation
1. The incoming agent inspected clean branch `agent/recovery-drill` at
`9c6d487b653e8984fd90ff3af0652076c93acadc` and outgoing checkpoint
`366dfc3e-9986-4d73-b510-1fa21140bdf8`, checkpoint generation 1. Its pointer
SHA-256 was `760270ef422a4862831606a74aa2e365064476e72afe60b26ca2bdfed8943b19`.

The incoming agent called `acquireReservation` with its assigned identity,
received reservation generation 2, and called
`assessResume(repo, {token, expected_checkpoint})` against that exact checkpoint.
The inline Node command exited 0; assessment returned `ready: true`, no reasons,
and `automatic_runner: false`. The ownership token remained in private Git
storage and is omitted here.

The assigned task was to change only `work.json` from value 7/status pending to
value 8/status complete. The initial `node verify.mjs` exited 1 and reported the
expected two-field mismatch. After the edit, verification passed. The staged
diff was inspected and contained only those two field changes. The commit is
`56ef0fd0d0856d7df0cd6c66a67b889cdb4a96be`; the worktree was clean afterward.

| Actual command/operation | Context | Exit/result |
| --- | --- | --- |
| `node verify.mjs` before editing | Disposable drill | 1; expected assertion failure |
| `node verify.mjs` after editing | Disposable drill | 0; `PASS independent recovery drill task; not compiler acceptance` |
| `git diff --check` | Disposable drill | 0 |
| `git add -- work.json` | Disposable drill | 0 |
| `git diff --cached --check` | Disposable drill | 0 |
| `git diff --cached -- work.json` | Disposable drill | 0; two-field diff reviewed |
| `git commit -m "test: complete independent fresh-agent recovery drill"` | Disposable drill | 0 |
| `git rev-parse HEAD` | Disposable drill | 0; full commit above |
| `git status --porcelain=v1` | Disposable drill | 0; empty output |
| `node verify.mjs` after committing | Disposable drill | 0; same passing message |
| `node --test tests/continuity/local.test.mjs` | Review checkout | 0; 14 passed, 0 failed/skipped/cancelled; duration 46979.0679 ms |

Git emitted its configured LF-to-CRLF warning while inspecting/staging
`work.json`; this was not a test failure. The suite duration is process timing,
not human productivity evidence. The final checkpoint retains the continuity
suite command among its checks; its execution context is the separate review
checkout as recorded in this table, not the disposable drill.

The final `writeCheckpoint` recorded clean source
`56ef0fd0d0856d7df0cd6c66a67b889cdb4a96be`, both the baseline failure and the later
pass, actual artifact digests, and a next action restricted to read-only review.
Its ID is `0da15013-c358-4ddb-bedb-5adaeae52774`, checkpoint generation 2; pointer
SHA-256 is `31dd7bcc548158a6f8c6f191df4cc8c48e7270105a53b66333e3794ad77b71b3`.
Assessment of this exact checkpoint returned ready with no reasons. The command
exited 0, then `releaseReservation` returned `released: true`, generation 2.
Inspection confirmed no reservation held. All disposable writes stopped at that
release. A subsequent read-only assessment exited 0 and remained ready.

These readiness observations apply to the exact pre-fix helper digest listed
above. A later change to the helper's index/fingerprint representation requires
revalidation; the old checkpoint records were retained and were not
automatically upgraded. No checkpoint rewrite was attempted after release.

`last_verified_source` remained `null` throughout; checkpointing did not invent
or advance retained verification. Context, provider quota, rate limit, execution
deadline and spend telemetry all remained `null`. The checkpoint's `complete`
state applies only to this synthetic work item.

Final retained artifact hashes:

| Artifact | SHA-256 |
| --- | --- |
| `work.json` | `387a168dc96b1d91665d463e84f0b4dd21e35b465abfe3efcc2034f6cb4cb36a` |
| `verify.mjs` | `0175380c5bb37ff5f28f1970c4888ba284c01d73141eb0d679c5dbd9d70f17b4` |

## Review finding: changed conflict stages can pass exact-index assessment

**P2 — Hash unmerged index entries or block conflicted checkpoints.**
At `tools/continuity/local.mjs:142`, `index_sha256` hashes
`git diff --cached --binary HEAD`. For an unmerged path this output omits the
stage-1/2/3 blob identities. The assessment only requires dirty-work
acknowledgment for a `UU` regular file, so changing a conflict stage while keeping
the worktree text unchanged can return ready against the old checkpoint.

A separate private synthetic fixture reproduced the issue. No product source
was edited. The inline Node reproduction exited 0 and observed:

```json
{
  "git_index_changed": true,
  "index_digest_equal": true,
  "fingerprint_equal": true,
  "dirty": [{"path":"source.txt","status":"UU","kind":"file"}],
  "ready": true,
  "reasons": [],
  "released": true
}
```

Minimal reproduction, using a newly initialized disposable Git repository with
a committed `source.txt` and the exported helper APIs:

1. Write distinct Git blobs for the base, ours, theirs A and theirs B using
   `git hash-object -w --stdin`. Record their object IDs.
2. Feed `git update-index --index-info` these lines, using tabs before the path:
   `0 <zero-object-id>\tsource.txt`, then
   `100644 <base> 1\tsource.txt`, `100644 <ours> 2\tsource.txt`, and
   `100644 <theirs-A> 3\tsource.txt`.
3. Write fixed unresolved working text to `source.txt`. Acquire a fixture
   reservation and call `writeCheckpoint` with an ordinary task and read-only
   next command. Retain its ID and `snapshot(repo)`.
4. Repeat step 2 with only `<theirs-A>` replaced by `<theirs-B>`. Do not edit the
   working text. `git ls-files --stage` now differs, while `snapshot(repo)` has
   the same index digest and fingerprint.
5. Call `assessResume(repo, {token, expected_checkpoint: record.id,
   acknowledge_dirty: true})`. It returns `ready: true` with no reasons.
   Release the fixture reservation.

The false readiness weakens the documented comparison of the actual source/index
against an exact checkpoint. Either include the staged entry identities, for
example bounded `git ls-files --stage -z`, in the digest, or reject all unmerged
states for manual review. Add a regression that changes only a stage-2 or
stage-3 object while retaining identical working text. The integrator received
the reproduction before this report; this reviewer made no implementation fix.

## Limits and sanitized reporting

The exercised transfer followed an orderly outgoing release; it did not test a
real provider outage or prove restart after arbitrary machine/power loss. The
existing helper tests are simulations with explicitly synthetic identities.
Remote freshness remained unknown; no network inspection occurred. No HATCH or
FC1 product gate is closed by this exercise.

One initial metadata directory listing exposed a retired reservation identifier
in private tool output. That identifier is deliberately omitted from this
report; subsequent reads selected sanitized fields. This is a reporting error,
not evidence that all tool output was sanitized. No credentials were read.

Next action: the integrator reviews this scoped report and the conflict-index
finding. The incoming drill agent has released disposable ownership and must
not resume writes there without a new assignment and reservation.
