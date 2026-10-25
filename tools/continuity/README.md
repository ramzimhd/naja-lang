# Local continuity helpers

This Python-free Node/Git component implements bounded local recovery state.
It does not launch an agent, run a supervisor, schedule a service, fetch/push,
reset Git, establish provider authentication, or verify product acceptance.

Run `node --test tests/continuity/local.test.mjs` before any integration use.
The tests mutate only disposable repositories and use explicitly synthetic
identities. A fresh child process reads the checkpoint without chat history;
this is a local process drill, not a completed handoff to another coding agent.

`local.mjs` exports `acquireReservation`, `inspectReservation`,
`releaseReservation`, `snapshot`, `recordVerificationAudit`, `writeCheckpoint`, `assessResume`,
`classifyOutcome` and `unknownBudget`. `schemas.mjs` exports closed schema
objects and their assertion validator. `node tools/continuity/cli.mjs schemas`
prints them. Shared `planning/continuity.json` has a separate integrator-owned
schema; no helper writes that file or any public evidence/status.

## Reservation and fencing

The reservation is an atomic `mkdir` at `naja-integration.lock` in Git's common
directory, so linked worktrees of the same repository coordinate. The owner
record includes owner/session, a random nonce, a durable fencing generation and
the observed PID/time. That process observation is not proof of OS process
identity or death. A private mutation guard serializes checkpoint/release
operations. Release renames the held directory before another owner can acquire;
old tokens cannot write through a new generation. Completed owner records remain
private as `naja-continuity/released-NONCE/owner.json`.

There is no expiration or reclaim command. An old timestamp, missing owner,
interrupted operation, absent counter, malformed record or different owner
requires explicit human/integrator reconciliation. Do not delete these records
while a writer might still run. Existing manual/legacy root reservations are
readable, but are **not automatically adopted** into the helper's counter history.
The integrator must separately coordinate any migration with stopped writers and
known generation history. The live NAJA integration reservation was not mutated
while implementing or testing this component.

These are cooperative local filesystem reservations, not a distributed lock,
security boundary against other programs, or a permission bypass. Distinct clones
do not share a Git common directory. Network-filesystem semantics and malicious
changes inside private Git metadata are outside the tested boundary.

### Explicit migration of a confirmed manual reservation

Do not run this sequence merely because a timestamp is old. It is a coordinated
integrator operation, outside automatic recovery, and was tested only in fixtures:

1. Stop integration writes and confirm the outgoing owner/session, exact nonce,
   fencing generation and worktree state through the actual owner. Retain the
   manual owner JSON privately. Reject unexpected owners, symlinks, an operation
   guard, existing helper counter history, or an unconfirmed writer.
2. Resolve the actual common directory with
   `git rev-parse --path-format=absolute --git-common-dir`. While the manual
   `naja-integration.lock` directory **still exists**, create the ordinary private
   `naja-continuity` directory if absent. Atomically create and flush
   `naja-continuity/reservation-sequence.json`, without replacing an existing
   counter. For a confirmed manual generation 1 its exact schema/value is
   `{ "schema_version": 1, "value": 1 }`. Use a same-directory exclusive temporary
   file and rename; validate it with exported `schemas.counter` first.
3. Recheck that the manual owner JSON still matches the confirmed identity and
   nonce and no writer/operation guard appeared. Rename the manual directory to
   `naja-continuity/released-NONCE`, requiring that destination not exist. Retain
   its original fields; do not rewrite manual history into a helper owner record.
4. Call `acquireReservation(repo, {owner, session})` for the confirmed incoming
   owner. The helper increments the initialized counter to generation 2 and
   returns a fresh nonce/token. If another owner won, stop and coordinate; never
   overwrite it. Update public continuity/assignments separately through the
   integrator's validated flow, and then create/assess a private checkpoint.

Initializing the counter before releasing the old directory closes the otherwise
unguarded rename/initialization gap. A crash leaves the manual reservation or an
initialized counter; neither condition authorizes automatic takeover. The old
manual token cannot use helper mutation APIs when it has extra legacy fields.
The helpers expose no automatic adoption, expired-lock theft, or migration CLI.

## Checkpoints and recovery

A checkpoint contains HEAD/branch/worktree, Git-visible dirty paths and file
digests, an index digest, cached upstream identity, task/check results, retained
verification, artifacts, blockers, unsafe intermediate states, exact next
commands, separate budget categories and contract revision `1.3 / NAJA 2026.1`.
Unknown telemetry is `null`. Nothing guesses percentages, remaining money or
reset times. `last_verified_source` is caller-supplied retained history initially;
subsequent checkpoints can advance it only through the explicit bounded evidence
audit described below. That audit checks report integrity, not test coverage or
product acceptance. Existing initial retained history is never relabeled as audited.

### Explicit verification advancement

Hold the existing reservation; do not acquire a second owner or modify live
ownership to run an audit. First retain the real reports and raw logs. Then call:

```javascript
const reference = recordVerificationAudit(repo, token, {
  source_commit: fullTestedCommit,
  records: ['reports/checks/actual-check.json'],
});
const checkpoint = writeCheckpoint(repo, token, {
  // Supply the ordinary task, checks, next_action and next_commands as before.
  ...checkpointDetails,
  last_verified_source: fullTestedCommit,
  verification_audit: reference,
});
```

The names in this example are placeholders, not evidence of an executed check.
The audit requires an existing valid checkpoint baseline and returns exactly
`{id, sha256}`. It writes a new private immutable identity at
`naja-continuity/verification-audits/ID/audit.json`; the returned digest binds its
exact bytes. A separately flushed `complete.json` reference is required after
the final observation; interrupted audit directories without it cannot authorize
advancement. An advancing checkpoint retains a separate `verification-audit.json`
link in its checkpoint directory. The checkpoint JSON schema and old records
remain unchanged. No audit updates the latest checkpoint, public continuity,
requirements, features, task status or release gates.

Explicitly select between 1 and 64 distinct report JSON paths under
`reports/checks/`. Each must use the existing evidence fields with explicit
contract revision `1.3`, the same full existing commit object ID, `passed`, exit
0, a nonempty command and tool versions, a timestamp, target and limitations.
Every report must name a nonempty raw log under `reports/checks/` with
a matching SHA-256. The audit never executes the recorded command. Report reads
are capped at 1 MiB, each log at 64 MiB, and all selected bytes at 128 MiB per pass.
The private JSON limit remains 1 MiB. Older evidence without a revision retains
its original scope and is preserved; it cannot satisfy this new audit.

Paths must be ordinary repository-relative files. Traversal, private Git paths,
symlinks/junctions, Windows alternate streams and ambiguous trailing dot/space
names reject. File identities and hashes are rechecked. The audit rejects current
Git-visible edits except its exact selected report/log paths, unresolved stages
and hidden index flags. Unfinished WIP remains checkpointable with the old
verification; it cannot become a newly audited source.

The tested source must be an ancestor of observed HEAD and, when present, a
descendant of the previously retained verified source. Observed HEAD may be a
later metadata commit: the older source remains the only audited source. The
helper does not assert that all intervening commits are metadata or that HEAD
was tested. It binds a before/after workspace fingerprint, prior checkpoint
identity/hash/generation and the exact owner/session/nonce/fencing generation.
Any change after auditing, a superseding checkpoint, ownership transfer,
tampered record/log or changed reference requires a fresh audit. Records are
checked again before advancement publication. Interrupted private records remain
for review; no stored command, patch or test is replayed.

These checks establish consistency of caller-selected retained reports. They
cannot establish that a log is honest, that the command actually ran, that its
source label is truthful or that the selected tests cover a language feature.
They provide no external audit, complete source closure, provider handoff,
automatic runner or HATCH/FC1 acceptance claim. Uncooperative edits to private
Git metadata and filesystem races outside the cooperative reservation boundary
remain outside the guarantee.

Private storage under `naja-continuity/checkpoints/ID` retains staged/unstaged
binary patches and copies of dirty/untracked file bytes. Symlinks preserve link
text instead of copying their targets. Ignored files are not backed up; directory
or submodule changes require manual review. Limits are 10000 dirty entries,
64 MiB per file, 128 MiB aggregate dirty bytes, 1 MiB JSON, 64 MiB Git output and
ten seconds per Git inspection. This is not a backup of the entire computer.

Metadata writes validate, create a private temporary file, flush it and rename
within one filesystem. Dirty file/patch copies are flushed before publication.
An immutable checkpoint precedes the atomic latest pointer. Consumed generations
or abandoned temporary directories after a crash fail closed when inconsistent;
they never authorize replay, source overwrite, or advancement of verification.
Directory fsync is attempted where supported. Windows/filesystem power-loss
durability is not guaranteed. Private history is retained for review; prune it
only through separately coordinated maintenance, not an unbounded runner.

The index digest includes staged entry modes, visibility flags and every conflict
stage's blob identity, together with the staged binary diff. Unmerged index states
always require manual review even when dirty source is acknowledged. Older
checkpoint fingerprints use the prior digest definition and must be reconciled;
they are retained rather than automatically upgraded or reported ready.

`assessResume` compares the actual source/index/branch to the checkpoint, verifies
retained recovery hashes, and checks ownership and cached upstream refs. Dirty
work needs explicit `acknowledge_dirty: true`; the result still records the dirty
paths. A changed source, missing/malformed/stale checkpoint or newer cached
upstream blocks readiness. No fetch or credential access occurs, so remote
freshness remains unknown until an authorized operator checks it separately.
The helper never applies patches, replays tasks or executes `next_commands`.

## CLI and manual continuation

```text
node tools/continuity/cli.mjs help
node tools/continuity/cli.mjs status
node tools/continuity/cli.mjs snapshot
node tools/continuity/cli.mjs assess
```

Mutation commands require a private JSON input: `acquire` takes `{owner,session}`;
`audit-verification` takes `{token,details}` where details is the source/records
object above; `checkpoint` takes `{token,details}`; `release` takes `{token}`. `assess` optionally
takes `{token,acknowledge_dirty,expected_checkpoint}`. Pass it with
`--input PRIVATE_JSON`; `--root DIRECTORY` selects the repository. Acquisition
returns the token; keep it and all checkpoint/input/output data in private Git
storage, never public logs. `status` omits the nonce. Exit 0 means the requested
operation succeeded; assess returns 1 when recovery is blocked; invalid input,
held ownership or other errors return 2. These exits are not compiler test passes.

After explicit ownership transfer and a successful assessment, launch a fresh
authorized agent with `docs/continuation/05_RESUME_AGENT.md`, or manually use the
installed client's supported resume command with an explicitly selected session.
The exact session and permissions remain an operator decision. No provider is
started by these helpers. `classifyOutcome` consumes explicit structured events;
a test failure containing the word “quota” still requires engineering, while
provider quota/rate signals request a checkpoint/wait. Retry information is
retained only when supplied; automatic retries/provider switches are always false.
