# 20 — English Official Project Policy

**Founder requirement, effective in package revision 1.2.**

## Scope

English is the single canonical language for official NAJA HATCH project material: charter/specifications, README, architecture/ADR/RFC, prompts and agent instructions, requirements/tasks/evidence narratives, API names/documentation, source comments/docstrings, CLI help/diagnostics, VS Code labels/settings/walkthroughs, examples, contribution/security guides, issue/PR templates, release notes and supported website content.

Use clear international technical English. Preserve established technical terms, stable IDs and exact API spellings. Use meaningful identifiers; avoid unnecessary abbreviations. Public source filenames should use English or established machine identifiers. `NAJA`, `HATCH`, `.naja`, `.py`, `:(x)`, `naja.alias` and requirement/task/gate IDs retain their meaning.

This is the founder's collaboration policy, not a claim that every open-source project must use English.

## What this policy does not prohibit

Unicode identifiers and string data, user-defined aliases in other languages, internationalized applications and multilingual test fixtures remain allowed. A fixture deliberately testing non-English data must have an English explanation. Do not restrict the language's capabilities to satisfy a repository-language audit.

Preserve third-party license texts verbatim. Do not rewrite external raw evidence and present it as original output. Where a tool emits localized text, retain a faithful sanitized original as necessary and provide an English interpretation; prefer English locale for future reproducible test runs. Never invent or alter machine results during translation.

HATCH ships English official UI/messages. Localization hooks may exist, but translated bundles are not a new HATCH deliverable. User applications may localize freely.

## Migration rules

Translate every normative document and prompt, not only the README. Replace the previous mandatory EN/FR README requirement with an English README. Rename the former summary document to `PROJECT_BRIEF.md`; update references. Preserve all existing requirement IDs, task IDs, acceptance intent and evidence references.

On an active repository do not overwrite source, lockfiles, Git history or progress with launch templates. Translate title/description fields by ID; append new requirements/tasks/gates. A previously verified requirement whose acceptance expands is marked for revalidation without erasing its original proof. Existing functional code strings change only when they are official UI/examples, with tests and migration notes where behavior is observable.

## Language gate R18

Audit tracked official surfaces, including generated help, VSIX package metadata, diagnostic catalogues, example comments and document metadata. Check for leftover mandatory bilingual instructions. Use an English editorial review plus a term scan; an ASCII-only scan is insufficient and a “no accented characters” rule would reject legitimate data.

Keep a small explicit exception list for third-party legal text, proper nouns, intentional test data and raw evidence. Each exception has a path and rationale; it is not a loophole for untranslated official prose. Review semantic fidelity of translations, especially negations, safety limits and scope.

Produce `reports/language/ENGLISH_AUDIT.md` linked to the exact commit and checked surfaces. A documentation-only audit cannot prove future generated runtime diagnostics are English; test them once implemented.
