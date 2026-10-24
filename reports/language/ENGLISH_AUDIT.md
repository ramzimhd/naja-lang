# English audit of the initial tracked source tree

Date: October 24, 2026. Task: T35, partial current-tree audit.

Audited source commit: `6e702caec0dae3ec90a92d57490387f97d7e09a8` in
`ramzimhd/naja-lang`. The report was prepared by the frontend contributor using
read-only access to that commit's Git objects, in a separate worktree. This is
internal AI-assisted editorial review, not independent human translation
certification or full R18 acceptance. The contributor also authored the initial
frontend; that portion includes self-review.

## Result and scope

No untranslated official prose or active rule requiring bilingual publication
was found in the inspected current surfaces. The 12 final term-scan matches are
English policy/history statements, migration instructions or a description of a
local legacy attachment. They do not require a French companion publication.

All **121 tracked text paths**, totaling **643119 UTF-8 bytes**, were enumerated
and scanned from the specified commit. Their paths were inspected for meaningful
English names or established project/machine identifiers. Editorial review
covered current documentation, policy-sensitive specification sections, prompts,
existing source comments and APIs, CLI strings, scripts, example explanations,
workflow labels and planning/evidence metadata. Long inherited specifications,
the reading summary and generated planning/reference inventories received
editorial sampling alongside the all-path scan; this is not exhaustive
line-by-line proofreading or a translation-equivalence proof.

| Inspected paths | Checked surface and finding |
|---|---|
| Root documents, including `README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `NOTICE`, `PROJECT_BRIEF.md`, `START_HERE.md`, `PACKAGE_VALIDATION.md`, `CHANGELOG.md` | English prose, governance, scope qualifiers and publication instructions. Current README distinguishes the implemented seed from HATCH completion. Historical package statements retain their stated origin. |
| `docs/01_*.md` through `docs/23_*.md`, `docs/decisions/*.md`, `prompts/*.md` | English specification/prompt narratives, negations, safety and acceptance boundaries; document 20 supplies this audit's policy. No active EN/FR duplicate requirement found. ADRs distinguish implemented seed behavior from final obligations. |
| `bootstrap/frontend/**`, `bootstrap/driver/**`, `backends/native/**` | English public identifiers, doc comments, ordinary comments, help and frontend/driver/native diagnostic strings. Existing primitive and machine identifiers are retained. |
| `bootstrap/README.md`, `bootstrap/toolchains.json`, `rust-toolchain.toml`, `Cargo.toml`, `Cargo.lock` | English limits, dependency explanations and manifest metadata. Package names, hashes, version/target strings and SPDX identifiers are machine data. |
| `scripts/**`, `tests/**`, `.github/workflows/seed.yml` | English script comments/help/failure text, test descriptions and workflow/step names. Deliberate multilingual data is explained by English test names/comments. |
| `planning/**`, `launch/**`, `reports/**` | English titles, descriptions, acceptance/evidence narratives and configuration comments. IDs, statuses, commands, retained raw output and hashes were not translated or rewritten. |
| `compatibility/**`, `benchmarks/productivity/**`, `spec-examples/**` | English reference/measurement metadata, proposed API names, example comments, labels and limits. These remain inventories or contracts where described; English wording does not prove their implementation. |
| `.gitattributes`, `.gitignore`, `SHA256SUMS.txt`, `LICENSE`, `launch/LICENSE-APACHE-2.0.reference.txt` | English comments or established syntax/hash/legal data. License texts were preserved. |

The current local CLI's `--help` output was executed successfully and compared
byte-for-byte with the `HELP` string extracted from this exact source commit.
`--version` also exited 0 with English output. This checks those observed strings;
it does not authenticate the local executable or establish a clean-host build.
Source inspection includes the existing runtime overflow/output-error text, and
the retained native-test log uses English explanations. This audit did not rerun
the native execution suite or every error branch.

## Explicit exceptions

These exceptions allow data fidelity, not untranslated official instructions.

| Path | Rationale |
|---|---|
| `tests/syntax/frontend.rs` | Arabic, Chinese, Greek, accented Latin text and an emoji deliberately test Unicode source bytes, string/comment data, byte-literal rejection, unsupported identifier diagnostics and generated lexical inputs. Surrounding test names/comments explain those purposes in English. NUL and control-character fixtures also remain data. |
| `bootstrap/driver/src/main.rs` | The `é` fixture checks original Unicode/CRLF diagnostic positions. Its enclosing test name is English. |
| `scripts/test-native.mjs` | `Unicode path café` deliberately tests an accented output/input path; the scenario name and surrounding assertions are English. |
| `reports/checks/seed-native-execution.log` | The matching `café` scenario label is retained raw test evidence. It is not French official prose. Other `reports/checks/*.log` output retains tool symbols, test names, durations and machine identifiers without editorial rewriting. |
| `LICENSE`, `launch/LICENSE-APACHE-2.0.reference.txt`, `NOTICE`, `compatibility/baseline.json` | Third-party legal wording, organization/product names, upstream titles/paths, attribution and SPDX/reference metadata retain their original spellings. This audit makes no legal or trademark determination. |
| `docs/17_SOURCES.md`, `bootstrap/toolchains.json`, `compatibility/productions.json` | External proper nouns, protocol/target/API spellings and upstream grammar identifiers remain exact reference data. URLs were inspected as text, not treated as translated prose. |

Unicode punctuation, mathematical notation and valid multilingual application
data are allowed. No ASCII-only acceptance rule was used. The frontend's missing
Unicode identifier implementation is explicitly documented as an implementation
limit; this report neither approves that limit for HATCH nor turns it into a
permanent identifier restriction.

## Commands and observations

Audit host: Windows x64, PowerShell 7.6.4, Git
`2.51.0.windows.1`, Node.js `v24.11.0`. No Python interpreter, external translation
service or network operation was used. No source, status, evidence log, license,
requirement ID or acceptance condition was edited by this audit.

The following read operations completed with exit 0:

```text
git -C C:/naja rev-parse HEAD
git -C C:/naja ls-tree -r --name-only 6e702caec0dae3ec90a92d57490387f97d7e09a8
git -C C:/naja show 6e702caec0dae3ec90a92d57490387f97d7e09a8:docs/20_ENGLISH_LANGUAGE_POLICY.md
git -C C:/naja show 6e702caec0dae3ec90a92d57490387f97d7e09a8:PATH
C:/naja/target/debug/naja.exe --help
C:/naja/target/debug/naja.exe --version
```

`PATH` in the fourth line represents the enumerated tracked paths, read with
separate structured Git arguments. The exact-commit inventory/term scan below
was run through a PowerShell single-quoted here-string piped to `node`; its final
run exited 0. The broad initial scan included English `implementation` as a false
positive; the final expression removes that ambiguous word.

```javascript
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const commit = '6e702caec0dae3ec90a92d57490387f97d7e09a8';
const git = args => {
  const r = spawnSync('git', ['-C', 'C:/naja', ...args], {
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout;
};
const paths = git(['ls-tree', '-r', '--name-only', commit]).trim().split('\n');
const terms = /\b(?:fran[cç]ais(?:e)?|anglais(?:e)?|bonjour|merci|veuillez|d[ée]marr(?:er|age)|r[ée]ussite|[ée]chou[ée]|compilateur|d[ée]pendances|param[èe]tres|dossier|fichier|chemin|s[ée]curit[ée]|utilisateur|v[ée]rifier|d[ée]veloppeur|aucun|outil|projet|environnement|obligatoire)\b|EN\/FR|README_FR|README_EN|bilingual|French|non-English/iu;
const hash = createHash('sha256');
let matches = 0;
let bytes = 0;
for (const file of paths) {
  const content = git(['show', commit + ':' + file]);
  hash.update(file + '\0');
  hash.update(content);
  hash.update('\0');
  bytes += Buffer.byteLength(content);
  content.split('\n').forEach((line, index) => {
    if (terms.test(line)) {
      matches++;
      console.log(file + ':' + (index + 1) + ': ' + line);
    }
  });
}
console.log(JSON.stringify({
  commit, paths: paths.length, utf8_bytes: bytes,
  term_match_lines: matches,
  path_nul_content_nul_sha256: hash.digest('hex'),
}));
```

Observed final summary:

```json
{"commit":"6e702caec0dae3ec90a92d57490387f97d7e09a8","paths":121,"utf8_bytes":643119,"term_match_lines":12,"path_nul_content_nul_sha256":"b21915528845e46b80cfdc374fa986f287cc62b7bcc62ef3a468613a37659a76"}
```

The digest covers each sorted Git-tree path, a NUL, its decoded UTF-8 content and
a NUL. It identifies this scan inventory; it is not a compiler artifact hash.
The term expression is a heuristic for likely remnants, not a language detector.
A separate diagnostic search for accented/Cyrillic/Arabic/Chinese letters located
the intentional data listed above. Those matches were editorially classified,
not rejected for using Unicode. English review was necessary because French and
other languages can contain only ASCII characters.

The 12 term matches occurred in `CHANGELOG.md`, documents 11, 14, 15, 20 and 23,
`planning/requirements.json`, prompt 06 and
`reports/environment/HOST_SUMMARY.md`. Reading their surrounding paragraphs
showed English explanations that supersede bilingual requirements or preserve
legacy/local provenance. No mandatory French duplicate remained in those matches.

An initial read used the incorrect path
`docs/20_ENGLISH_PROJECT_POLICY.md`; Git reported that it did not exist in the
audited commit. The tracked filename was then discovered and the correct
`docs/20_ENGLISH_LANGUAGE_POLICY.md` read successfully. This failed lookup is
retained here as an audit execution mistake, not a missing-policy finding.

## Historical wording and remaining verification

`START_HERE.md`, `PACKAGE_VALIDATION.md`, the package changelog and the initial
`launch/HANDOFF.md` describe what preparation of the October 22 launch package
did or did not deliver. The audited current `README.md`, seed documentation and
review reports describe actual development separately. English-language status
does not make those historical files an operational progress record. The
integrator must maintain the live handoff/state without replacing prior evidence.

The referenced reading attachment and legacy French summary are local/ignored
material and are absent from the 121-path tracked tree. This audit does not claim
to have inspected their document properties, rendered their contents or translated
them. Future publication would require its own explicit inclusion and review.

No installed VSIX, editor UI/settings/walkthrough package, LSP/DAP service,
native-cell controller, full hosted runtime/library, product installer or final
release bundle exists in this audited tree. Their generated text/metadata is
`not_run`, not English-verified. The workflow was inspected as tracked text;
this report does not assert that every GitHub-hosted job executed successfully.
External linked sites, future dependency output, localized host errors and future
diagnostic catalogues were not validated.

The current surface review found no required language correction. T35 remains
partial, and R18 remains open until all delivered public/generated surfaces and
the non-destructive migration/evidence obligations are checked on the relevant
release commit. New commits must be audited for their own changes; this report
does not certify an uninspected future tree.
