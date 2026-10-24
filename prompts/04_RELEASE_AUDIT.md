# Final HATCH Release Audit

Read AGENTS, acceptance document 14, requirements and actual evidence on the proposed release commit. Audit R01–R19 independently when possible; identify self-review honestly otherwise. Do not approve merely because another agent says tests passed.

Reproduce clean-user workflows, native target execution, no-Python dependencies, Linux independent backend/linking, NAJA source closure, B1/B2/B3 and an actual compiler change in NAJA. Inspect dialect/alias correctness, memory/resource guarantees, network limits, real VSIX LSP/debug/Test Explorer and all announced targets.

Execute cell cases C01–C34 and AOT P01–P04: correct native state/versions, no automatic replay or false rollback, safe stop/reset and no session-dependent final build. Audit privacy/trust/loading protections without destructive tests on personal data.

Audit English official docs/prompts/comments/diagnostics/VSIX/help and narrow exception records. Execute DX01–DX06 against both idiomatic Rust/C++ baselines, review the complete normalized source ledger, shared behavior tests, library costs, resource budgets and actual timed creation/change sessions. Check for inflated baselines, hidden code, fake timings or cherry-picked exclusions.

Write reports/HATCH_RELEASE_AUDIT.md with PASS/FAIL/BLOCKED per gate and blocking defects. No obligatory failure or missing evidence can produce overall PASS. Do not silently fix the criteria, fabricate independent review or publish a final HATCH release with an unmet mandatory gate.
