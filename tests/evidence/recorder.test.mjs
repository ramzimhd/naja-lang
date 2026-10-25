import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// These disposable repositories exercise the recorder, never product acceptance.
const source = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function run(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 60_000 });
  assert.ifError(result.error);
  return result;
}
function fixture(t) {
  const base = resolve(tmpdir());
  const root = mkdtempSync(join(base, 'naja-recorder-test-'));
  t.after(() => {
    const target = resolve(root);
    assert.ok(target.startsWith(base + sep) && target.slice(base.length + 1).startsWith('naja-recorder-test-'));
    rmSync(target, { recursive: true });
  });
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'planning'));
  copyFileSync(join(source, 'scripts/record-check.ps1'), join(root, 'scripts/record-check.ps1'));
  writeFileSync(join(root, 'planning/requirements.json'), JSON.stringify({ requirements: [{ id: 'QA-04' }] }));
  writeFileSync(join(root, 'README.md'), 'Synthetic evidence fixture.\n');
  assert.equal(run(root, 'git', ['init', '--initial-branch=main']).status, 0);
  for (const [key, value] of [['user.name', 'NAJA synthetic recorder test'], ['user.email', 'synthetic@example.invalid'], ['commit.gpgsign', 'false']]) {
    assert.equal(run(root, 'git', ['config', '--local', key, value]).status, 0);
  }
  assert.equal(run(root, 'git', ['add', '.']).status, 0);
  assert.equal(run(root, 'git', ['commit', '-m', 'Synthetic recorder source']).status, 0);
  const commit = run(root, 'git', ['rev-parse', 'HEAD']).stdout.trim();
  return { root, commit };
}
function record(root, code) {
  const quote = value => "'" + value.replaceAll("'", "''") + "'";
  const command = `& ${quote(join(root, 'scripts/record-check.ps1'))} -RequirementId QA-04 -Target synthetic -Name fixture -Tool node -ToolArguments @('-e',${quote(code)}); exit $LASTEXITCODE`;
  return run(root, 'pwsh', ['-NoProfile', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')]);
}
function evidence(root) {
  const bytes = readFileSync(join(root, 'reports/checks/fixture.json'));
  assert.equal(bytes.includes(13), false, 'new JSON records use stable LF bytes');
  const value = JSON.parse(bytes);
  const log = readFileSync(join(root, value.log_path));
  assert.equal(createHash('sha256').update(log).digest('hex'), value.log_sha256);
  return value;
}
test('stable success retains exact source, child status, output hash and exclusive names', t => {
  const { root, commit } = fixture(t);
  const result = record(root, 'console.log("synthetic success")');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const value = evidence(root);
  assert.equal(value.commit, commit);
  assert.equal(value.result, 'passed');
  assert.equal(value.exit_code, 0);
  const before = readFileSync(join(root, value.log_path));
  assert.notEqual(record(root, 'console.log("replacement")').status, 0);
  assert.deepEqual(readFileSync(join(root, value.log_path)), before);
});
test('a successful child that changes tracked source cannot produce passed evidence', t => {
  const { root, commit } = fixture(t);
  assert.equal(record(root, 'require("fs").appendFileSync("README.md","changed\\n")').status, 1);
  const value = evidence(root);
  assert.equal(value.commit, commit);
  assert.equal(value.exit_code, 0);
  assert.equal(value.result, 'failed');
  assert.ok(value.limitations.some(text => text.includes('Source or index changed')));
});
test('a successful child that commits changed source cannot relabel its new HEAD as tested', t => {
  const { root, commit } = fixture(t);
  const code = 'require("fs").appendFileSync("README.md","changed\\n");require("child_process").execFileSync("git",["commit","-am","Synthetic child mutation"])';
  assert.equal(record(root, code).status, 1);
  const value = evidence(root);
  assert.equal(value.commit, commit);
  assert.equal(value.exit_code, 0);
  assert.equal(value.result, 'failed');
  assert.notEqual(run(root, 'git', ['rev-parse', 'HEAD']).stdout.trim(), commit);
});
test('nonzero child status is retained without source mutation', t => {
  const { root } = fixture(t);
  assert.equal(record(root, 'console.error("synthetic failure");process.exit(7)').status, 7);
  const value = evidence(root);
  assert.equal(value.exit_code, 7);
  assert.equal(value.result, 'failed');
});
test('hidden index entries reject recording before child execution', t => {
  const { root } = fixture(t);
  assert.equal(run(root, 'git', ['update-index', '--assume-unchanged', 'README.md']).status, 0);
  assert.notEqual(record(root, 'process.exit(0)').status, 0);
  assert.throws(() => evidence(root), { code: 'ENOENT' });
});
