# Observed continuity interfaces

Observed October 25, 2026 on Windows x64. This records discovery, not an installed
supervisor, available paid-provider authorization, or guaranteed auto-resumption.
The OpenAI Docs skill informed the official Codex documentation check.

| Client | Installed observation | Execution/authorization limit |
| --- | --- | --- |
| Codex CLI 0.160.1 | `--help` lists `exec`, `resume`, `fork`, `queue` and agent commands. `exec --help` lists JSON events and output-schema support. `exec resume --help` accepts a selected session ID or `--last`. `resume --help` describes interactive continuation. | Help was inspected; no model request, session launch, queue write, provider change or billing fallback was performed. Explicit session selection avoids accidentally choosing unrelated recent work. |
| Claude Code 2.1.292 | `--help` exposes print, continue and resume interfaces. `--version` reports `2.1.292 (Claude Code)`. | Help presence does not establish authenticated access, quota, payment authorization or API eligibility. No Claude task was launched. |
| Desktop/app session tools | Availability is controlled by the active host/client and the integrator's existing session. | CLI help does not establish desktop session compatibility or permission to message/create another chat. The integrator owns app telemetry and actual handoff decisions. |

The [official non-interactive guide](https://learn.chatgpt.com/docs/non-interactive-mode)
documents exec continuation by selected session. The installed CLI's help confirms
that interface. The [official CLI command reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
separately describes interactive resume and related commands. Documentation may
advance independently of an installed binary; observed help controls this note.
Claude's [official workflow documentation](https://code.claude.com/docs/en/common-workflows)
describes session workflows; installation alone does not authorize their use.

Executed read-only discovery commands, all exit 0:

```text
codex --version
codex --help
codex exec --help
codex exec resume --help
codex resume --help
claude --version
claude --help
node --version
```

Node reports v24.11.0. No credential file was read, copied, parsed or displayed.
No auth/login/logout, doctor repair, service/daemon installation, cron, API model
call, account rotation or permission-bypass option was invoked. Authentication
availability and client-side context/quota/deadline/spend counters were not
established by this discovery; unknown values remain null in helper state.
The parent integration session may record independently observed app telemetry
in its separately governed continuity file.

The implemented component is finite local reservation/checkpoint/recovery logic.
It supplies read-only assessment plus manual resume instructions, not a provider
runner. Simulated warnings, rate/quota classifications and a fresh Node-process
drill test recovery behavior only. They are not actual provider interruptions,
fresh coding-agent handoffs, or a promise that work continues after this process
or computer stops. A real runner/handoff drill remains unverified.

Recovery component verification on this Windows host uses
`node --test tests/continuity/local.test.mjs` with Node v24.11.0 and Git
2.51.0.windows.1. Fourteen disposable-repository tests cover explicit transfer,
competing processes/common worktrees, manual migration, fencing, interrupted
source/metadata, WIP/failed checks, stale/malformed checkpoints, cached newer
remote state, unknown telemetry and simulated provider events. Test logs and the
integrated source commit must be retained by the integration owner. These checks
do not certify macOS/Linux recovery execution or an actual provider interruption.
