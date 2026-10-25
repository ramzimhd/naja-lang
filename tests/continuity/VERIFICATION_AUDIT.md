# Private retained-verification audit

This component provides an explicit integrity audit before a private checkpoint
can advance `last_verified_source`. It does not run a compiler test or prove a
language, continuity or release requirement. All added fixtures use disposable
Git repositories and records labeled `SYNTHETIC-ONLY`; their `passed` fields are
test inputs, not live NAJA evidence.

## Operator API

Keep the existing held reservation token private. The new finite operation is:

```javascript
const reference = recordVerificationAudit(repo, token, {
  source_commit: fullTestedCommit,
  records: ['reports/checks/actual-check.json'],
});
```

`fullTestedCommit` and the path above are placeholders. Supply real retained
reports rather than constructing success records to satisfy the audit. The
returned reference is exactly `{id, sha256}`. Supply it explicitly in the next
ordinary checkpoint's details along with the matching `last_verified_source`:

```javascript
writeCheckpoint(repo, token, {
  ...checkpointDetails,
  last_verified_source: fullTestedCommit,
  verification_audit: reference,
});
```

The CLI equivalent is `node tools/continuity/cli.mjs audit-verification --root
DIRECTORY --input PRIVATE_JSON`, with private input `{token, details}` where
`details` is the source/records object. Existing checkpoint CLI input remains
`{token, details}`. Neither command executes stored command arrays.

An initial caller-supplied source remains retained history under the original
checkpoint behavior. It is not relabeled as audited. To audit a later source,
there must first be a valid baseline checkpoint. The original checkpoint schema,
records, evidence and recovery files remain intact. An advancing checkpoint
adds an adjacent private `verification-audit.json` linkage; it does not add fields
to the original checkpoint JSON.

## Recorded observations and rejection boundaries

- Each of 1–64 explicitly selected distinct JSON reports must contain explicit
  contract `1.3`, the exact same full existing commit, `passed`, exit zero,
  nonempty command/tool-version fields, target, timestamp and limitations.
- Each raw log must be nonempty and match its recorded SHA-256. Shared raw output
  is allowed and supplies no additional coverage claim. A selected report cannot
  double as a raw log. Reads are bounded to 1 MiB per report, 64 MiB per log and
  128 MiB aggregate bytes per pass; private JSON remains limited to 1 MiB.
- The source must be an ancestor of observed HEAD and cannot regress from the
  baseline source. A checkpoint may observe a later metadata HEAD, but retains
  the older audited source. The helper does not classify intervening commits or
  assert that observed HEAD passed tests.
- Selected report/log paths must be ordinary files under `reports/checks/`.
  Traversal, symlinks/junctions, private Git paths, alternate streams and ambiguous
  Windows names reject. File identities and bytes are rechecked around reads.
- Current Git-visible dirty paths may only be the selected report/log files.
  Unfinished source edits, hidden index flags and unresolved stages reject an
  advancement. Ordinary WIP checkpointing still retains the previous source.
- The private audit binds the prior checkpoint identity/hash/generation, full
  source, exact workspace snapshot/fingerprint and owner/session/nonce/fencing
  generation. Snapshot/fence/evidence checks run before and after audit retention
  and again before checkpoint publication.
- The audit directory is a fresh immutable identity. `audit.json` is flushed and
  hashed; `complete.json` is published only after the final observation. Missing
  or mismatched completion references cannot authorize a checkpoint. Audit
  retention does not change the latest checkpoint pointer.
- A changed source/report/log, later metadata commit, superseding checkpoint,
  transferred owner/generation, incomplete audit, altered private record or wrong
  reference rejects. Retry requires a new explicit audit, not automatic replay.

Private mutation operations share the existing `.operation` guard. Failure does
not reset Git, erase WIP, rewrite the prior checkpoint, reclaim a reservation,
fetch a remote, launch a provider or update product statuses. Interrupted private
directories may remain for manual review. Directory fsync depends on the host;
universal power-loss durability is not claimed.

## Validation

Run `node --test tests/continuity/local.test.mjs`. The added cases exercise a
successful explicit transition, later metadata HEAD, immutable history, rejected
unaudited transitions, source/contract/result/exit/command/log mutations, every
selected report, bounded inputs, full commit ancestry, path traversal and an
actual directory symlink/junction escape, unfinished WIP, hidden index flags,
post-audit tampering, stale checkpoints/ownership, missing completion receipts,
strict private schema/reference fields and a stored command that must not run.
Existing disposable recovery and ownership tests remain in the same suite.

`node --test tests/continuity/public.test.mjs` separately checks the public
observation contract. It does not consume private tokens or mutate live state.

On October 25, 2026, `node --test tests/continuity/*.test.mjs` exited 0 on the
development Windows host with Node v24.11.0 and Git 2.51.0.windows.1: 57 passed,
0 failed, 0 skipped (27 private helper tests and 30 public schema tests). This
records the executed local suite, not a live NAJA verification advancement.

The retained reports can be internally consistent while still being fabricated,
mislabeling their source or lacking useful coverage. No log-honesty proof,
external review, whole-source verification, provider outage recovery, production
handoff, automatic runner, FC1 pass or HATCH acceptance follows from this audit.
Cooperative local reservations are not an OS security boundary against other
programs, malicious private-metadata edits or arbitrary filesystem races. No
live NAJA reservation or checkpoint was modified to develop these fixtures.
