# Public continuity observation schema

`planning/continuity.schema.json` is the closed public C01/C03/C07 observation
schema. It is separate from `tools/continuity/schemas.mjs`, private reservations,
private checkpoint/patch storage and `assessResume`. No private helper or actual
`planning/continuity.json` record was changed by this contribution.

```text
node scripts/validation/check-continuity.mjs
node scripts/validation/check-continuity.mjs --file PATH_TO_JSON --json
node --test tests/continuity/public.test.mjs
```

Exit 0 means the observation conforms, 1 means invalid/unavailable data and 2
means invalid CLI arguments. Validation does not run Git, execute stored commands,
inspect a lock, advance verified source, establish receiver/provider availability,
verify artifact bytes or accept C01/C03/C07, FC1 or HATCH. An observation's HEAD
can precede its metadata commit. A historical passed check can identify an older
source; no equality with current HEAD is required or implied.

All top-level fields are required. Object shapes are closed at every level:

| Fields | Recorded meaning |
|---|---|
| `schema_version`, `contract_revision`, `language_edition` | Constants `1`, `1.3`, `2026.1`. |
| `session_id`, `owner`, `status`, `updated_at` | Public session/owner identity and observation time. Status is `running`, `checkpointing`, `ready_for_handoff`, `waiting_for_quota`, `blocked_external` or `complete`. These are lifecycle observations, not product verdicts. |
| `head`, `branch`, `last_verified_source` | Full 40/64-character source hashes; branch and retained verified source may be null. HEAD is observed, not automatically read by validation. |
| `checkpoint_generation` | Positive public/private checkpoint sequence observation. It is independent of the reservation's fencing generation. |
| `dirty_paths`, `task`, `completed` | Observed repository-relative dirty paths, current work and factual completion notes. An empty dirty list requires a real inspection by the producer. |
| `checks` | Arrays of actual command arguments, `result` and nullable integer `exit_code`. `passed` requires exit 0; `not_run` requires null. Optional `source`, `dirty_tree_sha256`, paired `log_path`/`log_sha256`, and `limitations` preserve exact scope. Source is optional; its absence establishes no source-specific acceptance. |
| `artifacts` | Relative `path` plus SHA-256. Optional `bytes` is a measured nonnegative integer or null. One path has one recorded hash. Missing current files are not treated as proof of readiness. |
| `blockers`, `unsafe_intermediate_states` | Explicit factual recovery risks and limitations. Old checkpoint fingerprints can remain historical without being declared current/resumable. |
| `next_action`, `next_commands` | Concrete next action and at least one nonempty command-argument array. The validator never executes these commands. |
| `ownership` | Symbolic reservation `<git-common-dir>/naja-integration.lock`, positive `fencing_generation`, observed `held`/`released`/`unconfirmed` state and timestamp, and fixed `reclaim: "explicit verified release only"`. It confers no ownership authority. |
| `budget` | The five independent categories below, plus public limitations. |
| `automatic_runner` | Current schema permits only `manual_only`, `unavailable_not_tested` or `not_configured`; `mode` is `manual_resume`, `manual_resume_required` is true, `provider_requests_started` is false, and instructions are explicit. A running chat is not an unattended runner. |

Budget categories each carry `status: unknown|observed`, `observed_at` and `source`:

- `context`: `remaining_tokens`.
- `provider_quota`: `used_percent`, `remaining_percent`, `window_minutes`,
  `resets_at`, and fixed `account_shared: true`.
- `rate_limit`: `limited`, `retry_after_seconds`, `resets_at`.
- `execution_deadline`: `at`, `remaining_seconds`.
- `spend`: `remaining`, `monetary_ceiling`, `currency`, and fixed
  `extra_billing_authorized: false`.

Unknown measurements, source and observation time are null. Unknown is never
zero, false or an inferred provider reset. An observed category needs source/time
and at least one real measurement; numeric zero and observed `limited: false`
remain legitimate observations. Observed money requires a currency. Used and
remaining percentages cannot contradict each other; observed remaining money
cannot exceed its ceiling. These consistency checks do not authorize spending,
paid fallback, automatic retries or provider launches.

The JSON Schema supplies closed types, enums, ranges and conditional assertions.
The Node validator additionally checks public-value privacy patterns, duplicate
artifact paths, paired optional log identities and telemetry consistency. It
supports precisely the schema assertions in this version and rejects unsupported
schema assertions. Timestamps require explicit offsets and valid calendar dates;
leap-second timestamps are currently unsupported.

Public data cannot include nonce/token/authentication fields, recognizable
credential values, private user-profile paths, private Git checkpoint/patch paths
or ignored local/session/history paths. Error messages omit input values and
unknown property names. The string-pattern scan is bounded, not a universal
secret or personal-information detector; review the staged public record.
Relative paths use forward slashes without drives, traversal, backslashes,
repeated separators or stream syntax. Unicode user data and filenames are allowed.

## Producer integration and draft migration

The validator exports `publicContinuitySchema`, `validatePublicContinuity(record)`,
`assertPublicContinuity(record)`, `unknownPublicBudget()` and
`readPublicContinuity(filename)`. Assertion returns the same record on success;
on failure it throws `PUBLIC_CONTINUITY_INVALID` with sanitized `.errors`.
Neither validation nor the fresh-budget factory changes the supplied record.
Input must be plain JSON data, without accessors, custom serialization/prototypes,
cycles, hidden fields or sparse arrays that could change meaning when serialized.
Call the assertion before the integrator's atomic temporary-write/flush/rename.
This module supplies validation, not an atomic writer or lock.

The following is a **shape example**, using an externally gathered `observed`
object. It is not a live record or executable observation collector. Fill every
field from real inspection; do not replace unknown facts with example values:

```javascript
import { assertPublicContinuity, unknownPublicBudget }
  from './scripts/validation/check-continuity.mjs';

const record = {
  schema_version: 1, contract_revision: '1.3', language_edition: '2026.1',
  session_id: observed.session_id, owner: observed.owner, status: observed.status,
  checkpoint_generation: observed.checkpoint_generation,
  head: observed.head, branch: observed.branch,
  last_verified_source: observed.last_verified_source,
  dirty_paths: observed.dirty_paths, task: observed.task,
  completed: observed.completed, checks: observed.checks,
  artifacts: observed.artifacts, blockers: observed.blockers,
  unsafe_intermediate_states: observed.unsafe_intermediate_states,
  next_action: observed.next_action, next_commands: observed.next_commands,
  ownership: {
    reservation: '<git-common-dir>/naja-integration.lock',
    fencing_generation: observed.ownership.fencing_generation,
    status: observed.ownership.status, observed_at: observed.ownership.observed_at,
    reclaim: 'explicit verified release only',
  },
  budget: unknownPublicBudget(), // Populate only actually observed categories.
  automatic_runner: {
    status: observed.manual_runner_status, mode: 'manual_resume',
    manual_resume_required: true, provider_requests_started: false,
    instructions: observed.manual_resume_instructions,
  },
  updated_at: observed.updated_at,
};
assertPublicContinuity(record); // Then use the integrator's atomic writer.
```

Do not spread a private reservation/checkpoint into this object: its nonce,
process/private paths and preservation payloads are intentionally excluded. The
currently observed live reservation generation is 2, but that fact must come
from the integrator's actual observation; the schema is not fixed to generation 2.
Likewise, public checkpoint generation need not equal the fencing generation.

Migrate the earlier draft additively, retaining its Git history. Replace ad hoc
`passed:N` strings with scoped structured check observations; do not attach their
results to a newer source. Replace flat budget booleans/percentages with sourced,
timestamped category observations or unknown/null values. Add actual dirty paths,
completed work, blockers, unsafe states, artifacts and next commands after
inspection. Preserve historical source identities and stale-fingerprint limits.
Only the integrator writes the real public record.

The test fixture in `public.test.mjs` is explicitly synthetic. Its fake hashes,
owner/session, generation values and observations exercise validation only.
It is never copied into live planning and does not claim an actual ownership
transfer, provider outage, background runner, production test or milestone pass.
