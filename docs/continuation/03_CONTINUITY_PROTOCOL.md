Multi-Agent Continuity, Context and Quota Protocol
Purpose: Keep implementation recoverable across Claude, Codex, session compaction, client restarts and provider limits. This is a protocol to implement and test, not a claim that an unattended runner is already installed.
C01 — Distinguish the limits
Track these independently when the current client exposes them:
Limit	Meaning	Permitted response
Context window	Current session's working context	Persist state, compact or create/resume a supported session, reload the small authoritative checkpoint.
Provider usage quota	Subscription/API allowance	Reduce duplicate work, checkpoint early, use an already-authorized independent agent if available, or wait through supported provider/client behavior.
Rate limit	Temporary throughput cap	Respect actual retry/reset information with bounded backoff; do not spin.
Execution deadline	Current tool/process/session can end	Persist progress before long operations; capture job identifiers and recovery instructions.
Spend budget	Authorized monetary ceiling	Never exceed it or switch to metered billing without explicit consent.


A context summary does not reset a usage quota. Additional agents may share the same quota and may consume it faster. Unknown telemetry remains unknown; no guessed percentages or reset times.

Use actual client version/help and official provider documentation to discover supported status, compaction, resume, subagent and auto-continuation features. Do not assume both clients share a command, unlimited contexts, or the ability to launch one another. Commands shown in a chat UI are not automatically shell commands.
C02 — Budget-aware work units
Before each work unit, identify the implementation scope, affected paths, checks and checkpoint plan. Prefer small vertical slices that leave the main integration branch usable. Keep context small by searching targeted source ranges and retaining long test output in files.

Operational default: reserve approximately 20% of an actually exposed remaining context/work budget for validation, review and checkpointing. This is a conservative workflow policy, not a guarantee about token accounting. When counters are unavailable, checkpoint after each testable slice and before a costly build/refactor; do not wait for a warning that may never arrive.

When a limit warning arrives:
1. Stop dispatching new work and broad investigations.
2. Persist current source/worktree state immediately.
3. Run the smallest relevant checks only if capacity remains; record missing checks honestly.
4. Write a concise handoff and the first exact resume command.
5. Compact/resume or transfer through an actually supported authorized mechanism.
Do not start a repository-wide rewrite when there is only enough capacity to edit half of it. Do not reduce verification requirements just because the quota is low. An unexpected provider interruption can still occur; checkpoints bound the recoverable gap, not eliminate every possible loss.
C03 — Durable state, separate from chat
Preserve existing files and schemas. Add narrowly scoped state where necessary rather than replacing planning/state.json with a new template.
File	Responsibility
AGENTS.md	Short stable invariants and pointers, not a transcript.
CLAUDE.md	Explicitly load/reference shared instructions in the supported installed-client form.
planning/state.json	Existing product/milestone/requirement state.
planning/assignments.json	Actual task ownership and path reservations.
planning/continuity.json	Current session/owner, checkpoint identity, observed budget, next action and resume conditions.
launch/HANDOFF.md	Concise human/agent-readable handoff with exact commands.
launch/RESUME_PROMPT.md	Minimal portable takeover prompt.
reports/progress.md	Current factual summary for read-only followers.
reports/checks/	Exact retained evidence tied to tested source.
reports/agent-journal/	Bounded durable events and checkpoint records, sanitized for publication.


Persist file changes atomically with schema validation where applicable. Keep state small and factual. Record decisions/reasons, not private chain-of-thought. Separate public source/evidence from ignored private auth/configuration and personal logs.

Each checkpoint records: actual HEAD and branch, last verified source, worktree/dirty paths, current task, completed implementation, tests passed/failed/not run, relevant artifacts/hashes, ownership, blockers, known unsafe intermediate states, next action and commands. Include the language contract revision and pending migration decisions.

Do not claim a clean workspace without inspecting it. Do not label uncommitted work as belonging to a clean commit. If safe, preserve incomplete edits in a clearly named WIP branch/commit after secret review; otherwise retain the working tree plus a private recovery patch, exact base and hashes. Never push unreviewed private material just to save tokens. last_verified_commit must not move to an unverified WIP checkpoint.
C04 — One integrator, real coordination
One agent owns integration and shared contract/planning updates. Other agents work only on assigned branches/worktrees and confirmed non-overlapping paths. Prefer a small number of useful parallel tasks over recursive delegation. Available workers may specialize in frontend, runtime, testing/editor or review, but availability must be established rather than invented.

A task assignment includes: ID, owner, base commit, branch/worktree, allowed paths, forbidden/shared files, deliverable, acceptance commands, status and handoff location. Changes outside ownership require integrator coordination. Review-only agents do not silently become writers.

Implement an atomic local lock/reservation mechanism if multiple processes operate on the same machine; a JSON owner field is not a lock. Include owner/session identity and fencing/checkpoint generation where needed. An expired timestamp alone is not proof an owner died. Verify owner/process/worktree state before reclaiming. Across machines use a supported coordination mechanism or keep a single confirmed integration owner; do not pretend a local file lock is distributed exclusion.

Transfer ownership in a documented sequence:
1. Outgoing agent checkpoints and stops integration writes.
2. Incoming agent verifies base/source, assignments, locks and the checkpoint.
3. Incoming agent acquires the integration role and acknowledges the checkpoint.
4. Outgoing role becomes released; new tests/edits proceed from verified reality.
If no receiver exists, status is ready_for_handoff, not handoff_completed or running_elsewhere. A colleague can monitor through read-only progress, branches, CI and evidence without editing shared state.
C05 — Automatic continuation, only when supported
Prefer the installed client's supported session persistence/compaction/continuation mechanisms. Keep critical instructions on disk and re-read them after compaction.

If useful and supported by the authorized installed clients, implement a small Python-free local supervisor in the seed tooling (Node or Rust is acceptable temporarily). It must:
- Discover the actual supported noninteractive/resume interface, authentication availability and permission boundaries.
- Keep a stable state machine: running, checkpointing, ready_for_handoff, waiting_for_quota, blocked_external, complete.
- Resume from committed/checkpointed state with idempotent startup, not repeat an entire finished task.
- Serialize integration, cap workers/retries, and stop duplicate invocations.
- Distinguish quota/rate-limit failures from compile/test failures. A failing test requires engineering, not automatic provider switching.
- Honor provider reset/retry signals and cost ceilings, with a cancellation path for the owner.
- Recheck repository/lock state on recovery and tolerate client or machine restarts without overwriting newer work.
- Log only sanitized operational facts; never tokens, secrets or raw unrelated chat content.
- Be tested in a disposable repository with simulated quota/exits/crashes before controlling the real checkout.
Do not build an unbounded agent-launch loop. Do not rotate accounts, change subscriptions, enable paid overflow, extract credentials from unrelated files, disable sandboxes or create persistent system services/cron tasks without explicit authorization. If another already-authorized provider is available, transfer work normally within its own limits; do not treat it as a way to evade platform controls.

A supervisor cannot execute after its process/machine is gone unless a separately authorized persistent service exists. If no runner is available, supply the one-command or one-prompt resume path and truthfully record that manual relaunch is required. Never promise invisible background activity.
C06 — Verification of recovery itself
In a disposable worktree/repository, test:
1. A normal checkpoint and resumption by a fresh session with no private chat history.
2. A simulated context/quota warning during a work unit.
3. A forced process exit between source editing and metadata writing.
4. A second agent arriving while another still owns integration.
5. A stale or malformed checkpoint, mismatched commit and dirty working tree.
6. Missing credentials, unavailable second provider and unknown budget telemetry.
7. A failed test, uncommitted edits and an incomplete WIP branch preserved without falsely advancing verification.
8. A newer remote commit and conflicting ownership; no destructive reset or force-push.
Record the observed recovery behavior. Simulated quota tests validate orchestration logic, not the provider's actual account allowance or a guaranteed future auto-resume. A real handoff drill needs a genuinely separate agent/session or must be labeled a local simulation.
C07 — Progress and stop behavior
Give updates at meaningful implementation/test boundaries and before a long operation. Write reports/progress.md at checkpoints so collaborators can follow without the original chat. Report exact verified counts and explicit remaining areas, not a fabricated overall percentage.

At an unavoidable pause, provide:
- Why execution cannot continue now, distinguishing hard limit from engineering choice.
- Last good source, preserved work and its verification state.
- Whether a real receiver/supervisor is running, waiting, unavailable or requires manual launch.
- The next exact command/action and any required external permission.
A pause is not completion. Do not erase failed/not-run tests, discard uncommitted work or lower scope to create a green summary. Continue other independent authorized work when one engineering area is blocked.
