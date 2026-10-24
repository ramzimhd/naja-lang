# 13 — Claude, Codex or Both: Working Protocol

## Interchangeable roles

One integrator owns contracts, ready-task selection, integration and validation. A second contributor/reviewer implements a distinct area or audits evidence. Provider choice does not determine authority. A single agent performs roles sequentially and discloses that review was not independent.

`AGENTS.md` is the shared short instruction source; `CLAUDE.md` explicitly points to it. Provider mechanisms for reading these files do not themselves guarantee compliance. [S21, S22]

## No concurrent conflicting writes

Use one branch/worktree per agent, such as `agent/frontend-T05`. Only the integrator writes the integration branch and assigns paths/contracts in `planning/assignments.json`.

A JSON file is not a distributed lock. Use a real atomic reservation or a sole queue owner locally; across hosts centrally confirm assignments and serialize merges. Stale local state does not authorize work on another agent's files.

Shared contracts, manifests, lockfiles and IR definitions belong to the integrator. Contributors propose changes through a reviewed patch/PR. Never force-push shared branches or use destructive resets to remove someone else's work.

## Task cycle

Read the necessary context/specifications; check prerequisites; write acceptance fixtures/tests; implement; execute; fix; document limitations; present a focused change. Recheck tests on the integrated commit, not only an older branch.

Review actual implementation, logs, external calls, disabled tests and hidden stubs. Do not accept an agent's “green” assertion without evidence or silently rewrite requirements. English migration must preserve technical meanings, IDs, code behavior and existing evidence.

## Machine-readable progress

`state.json` tracks current work/blockers/checkpoint; `requirements.json` tracks obligations/evidence; `tasks.json` is the dependency graph. Status vocabulary: `not_started`, `in_progress`, `implemented`, `verified`, `blocked`, `failed`. Implemented does not mean verified.

Evidence records requirement ID, exact commit, target, actual command, versions, exit code, timestamp, sanitized log/hash and limitations. Compute counts from data. Do not remove failed requirements from denominators without a recorded owner decision.

## Sessions and handoff

Before interruption preserve changes safely, identify buildable/broken state, update `launch/HANDOFF.md` with actual tests, changed files, known errors, next command and restart conditions. Prepare `launch/RESUME_PROMPT.md`; release or expire task reservations.

Never claim another agent is active unless actually launched. Do not bypass quotas/permissions or promise work after session termination. On resume reread Git and state rather than relying only on a narrative summary.

## Communication

Keep public project reports, prompts, handoffs and evidence narratives in English. At startup report the real context and first task; at milestones report observable results/tests/blockers. Ask only for genuinely unavailable identity/permission/founding decisions and continue independent work. Do not ask “continue?” after each file.

The endpoint is acceptance, not context exhaustion. Say “checkpoint saved; HATCH is not complete” when that is the truth. Productivity auditors should be distinct from benchmark implementers when possible; otherwise disclose self-review.
