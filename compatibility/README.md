# Pinned grammar reference and compatibility inventory

NAJA's working reference is **Python 3.15.0**, released on October 9, 2026.
The [official release page](https://www.python.org/downloads/release/python-3150/)
was available during this audit. The annotated upstream `v3.15.0` tag resolves to
commit `d220409a13b77de7a6c30abe16ea90db01528edc`. All raw reference URLs use that
commit. The series documentation at `docs.python.org/3.15` currently identifies
3.15.1, so it is unsuitable as an immutable 3.15.0 byte baseline.

[baseline.json](baseline.json) records the access timestamp, release/tag/commit
metadata, exact SHA-256 hashes and Git blob identities. Ten upstream files were
downloaded as bytes: the grammar, token list, seven English reference chapters
and upstream license. Every byte length and computed Git blob SHA-1 matched the
official Git trees. Git independently confirmed both the annotated tag object
and its peeled commit. GitHub reports the tag and commit as unsigned; these
checks establish reference identity and consistency without claiming a signed
release. No Python executable was installed or run.

[productions.json](productions.json) contains **278 distinct declarations**:
209 syntax declarations and 69 declarations named `invalid_...` for diagnostics.
It retains identifiers, categories and source-header lines, without upstream
rule bodies, C actions or documentation paragraphs. The inventory count is a
denominator for future work. It does not measure NAJA grammar coverage.

Every complete-production `parsed`, `supported` and `verified` field is `false`;
every `test_result` is `not_run`, verification commit is `null` and evidence list
is empty. A lexer test or bounded expression parser does not establish support
for an entire upstream production. An eventual row update needs positive and
negative NAJA fixtures covering its declared alternatives, retained execution
evidence and review of its exact scope. Parsing, executable semantics, standard
library support and CPython ABI compatibility are separate dimensions.

The `invalid_` category remains visible in the total inventory. These rules
describe specialized upstream errors; matching their names does not prove NAJA
rejects the corresponding inputs correctly. NAJA independently implements its
frontend, diagnostics and runtime. The upstream implementation actions and
return types are reference annotations. Planned `.naja` extensions
include the edition 2026.1 additions in L01–L15 and ADR-003; `.py` retains
standard source forms by default. Their complete acceptance tests remain open.

The Python Software Foundation and contributors provide the upstream reference
material. Its license is linked and hashed in `baseline.json`. This contribution
does not copy grammar implementation code or relicense upstream material under
NAJA's license. The root `NOTICE` is maintained by the integrator.

To repeat the reference acquisition from PowerShell, use Node.js and Git. This
audit operation needs network access; normal compiler builds and tests must not
download or execute CPython:

```powershell
git ls-remote https://github.com/python/cpython.git 'refs/tags/v3.15.0' 'refs/tags/v3.15.0^{}'
@'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const baseline = JSON.parse(fs.readFileSync('compatibility/baseline.json'));
const inventory = JSON.parse(fs.readFileSync('compatibility/productions.json'));
const sha = (kind, bytes) => crypto.createHash(kind).update(bytes).digest('hex');
const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'naja-reference-audit-'));
let grammar;
const sources = [baseline.grammar, baseline.tokens,
  ...baseline.english_reference_sources, baseline.license_reference];
for (const source of sources) {
  const response = await fetch(source.url);
  assert.equal(response.status, 200, source.path);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.length, source.byte_length, source.path);
  assert.equal(sha('sha256', bytes), source.sha256, source.path);
  const blob = Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]);
  assert.equal(sha('sha1', blob), source.git_blob_sha1, source.path);
  const destination = path.join(cache, ...source.path.split('/'));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
  if (source.path === 'Grammar/python.gram') grammar = bytes.toString('utf8');
}
const marker = '# ========================= START OF THE GRAMMAR';
assert.ok(grammar.includes(marker));
const lines = grammar.split('\n');
const start = lines.findIndex(line => line.startsWith(marker));
const pattern = new RegExp(inventory.header_pattern);
const declarations = [];
for (let index = start; index < lines.length; index++) {
  const line = lines[index];
  const match = pattern.exec(line);
  if (match) declarations.push({ id: match[1], source_line: index + 1 });
  else assert.ok(!line || /^\s|^#/.test(line), `Unknown declaration at ${index + 1}`);
}
assert.equal(new Set(declarations.map(row => row.id)).size, declarations.length);
assert.deepEqual(declarations, inventory.productions.map(({ id, source_line }) => ({ id, source_line })));
const matrixBytes = execFileSync('git', ['show', 'HEAD:compatibility/productions.json']);
assert.equal(sha('sha256', matrixBytes), baseline.inventory.sha256);
for (const source of baseline.local_specification_snapshots) {
  const bytes = execFileSync('git', ['show', `${source.source_commit}:${source.path}`]);
  assert.equal(bytes.length, source.byte_length, source.path);
  assert.equal(sha('sha256', bytes), source.sha256, source.path);
}
console.log(JSON.stringify({ sources: sources.length, declarations: declarations.length,
  syntax: declarations.filter(row => !row.id.startsWith('invalid_')).length,
  diagnostic: declarations.filter(row => row.id.startsWith('invalid_')).length,
  reference_checks: 'passed', compiler_coverage: 'not_run' }));
'@ | node --input-type=module
```

The private audit cache can be removed after review. It is not part of the build
closure. The local specification hashes and inventory hash use exact Git blob
bytes, so Windows checkout line-ending conversion does not change their meaning.
Any future baseline migration must preserve prior IDs, evidence and limitations;
an inventory-only change never establishes a parser or runtime success.
