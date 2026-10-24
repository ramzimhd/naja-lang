# Planning and retained-evidence validator

Run from the repository root with Node.js and no package installation:

```text
node scripts/validation/check-planning.mjs
node scripts/validation/check-planning.mjs --json
node --test tests/planning/*.test.mjs
```

`--root DIRECTORY` checks another checkout. Exit codes are 0 for planning integrity,
1 for failed validation and 2 for invalid arguments. The script never runs commands
listed in evidence. It reads files and emits a report; it does not change planning
state or claim that a compiler, benchmark, target platform or release has passed.

The report derives counts and status totals from the actual JSON. Revision 1.2's
139 mandatory requirements, eight future objectives, 38 tasks and 19 gates must
remain present by stable ID. Mandatory IDs retain their required flag and gate;
additional IDs are allowed. This prevents reducing the denominator to hide a
failure. Requirement/gate mappings are checked in both directions. Task dependency
references must exist and the graph must be acyclic. Starting scoped local work
does not falsely imply completion of its prerequisites.

An active development state requires one `integrator` identity string in
`planning/assignments.json`. Each assignment has `task_id`, `owner`, `branch`,
`worktree`, `paths` and optional `status`. The default status is `active`;
`completed`, `released` and `expired` do not reserve paths. Separate active owners
need distinct branches and worktrees and non-overlapping path scopes. Scopes are
repository-relative files or directories, optionally ending with `/**`. Matching
is case insensitive so conflicts visible on Windows are also rejected on Linux.
The validator checks coordination metadata; it does not create an atomic
reservation, confirm a worktree's existence or act as a distributed lock.

Every `evidence` entry is a repository-relative path to one JSON object conforming
to `planning/evidence.schema.json`. The validator implements the schema assertions
currently used there and rejects unsupported new schema keywords. It is not a
general-purpose JSON Schema implementation. Existing optional schema fields stay
optional. Timestamps use RFC 3339 calendar dates and offsets; leap-second timestamps
are unsupported. Evidence must identify an existing requirement, nonempty command
arguments, target and tool versions. Referenced logs must exist inside the
repository. Supplied SHA-256 hashes must match the retained bytes. A `passed`
record additionally needs exit code 0 and a nonempty retained log. `failed`,
`blocked` and `not_run` records remain valid historical outcomes and cannot
establish verification.

A verified requirement needs valid passed evidence for its own ID. A verified
task needs passed evidence for its primary requirement; this is a necessary
consistency condition, not a complete audit of task acceptance. A verified gate
requires every mapped requirement to be verified and covered by passed records,
using the requirement's evidence or the gate's own references. Historical failed
records may coexist with later successful records. The validator does not infer
which result supersedes another.

The checker validates commit syntax, not Git object existence, execution honesty,
release-commit coverage, source/log provenance or sufficient behavioral coverage.
Those require review and reproducible execution under documents 13 and 14.
Synthetic logs in unit-test temporary directories exercise rejection behavior and
are explicitly labeled as test fixtures; they are never NAJA acceptance evidence.
