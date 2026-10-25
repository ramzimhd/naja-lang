// Original-source editor protocol checks through the real native compiler CLI.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
assert.deepEqual(process.argv.slice(2), []);
mkdirSync('target', { recursive: true });
const directory = mkdtempSync(resolve('target/check-json-'));
const captures = join(directory, 'captures'); mkdirSync(captures);
const compiler = resolve('target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
const started = Date.now(), commands = [], results = [];
const hash = value => createHash('sha256').update(value).digest('hex');
process.on('uncaughtExceptionMonitor', error => writeFileSync(join(directory, 'failure.json'), JSON.stringify({ state: 'failed', error: error.message, commands, results }, null, 2) + '\n'));
function command(tool, args, options = {}) {
  const remaining = 120000 - (Date.now() - started); assert.ok(remaining > 0, 'suite deadline');
  const result = spawnSync(tool, args, { encoding: 'utf8', cwd: directory, maxBuffer: 1024 * 1024, ...options, timeout: Math.min(options.build ? 45000 : 5000, remaining) });
  const name = 'command-' + commands.length;
  for (const stream of ['stdout', 'stderr']) writeFileSync(join(captures, name + '.' + stream), result[stream] ?? '');
  commands.push({ command: [tool, ...args], exit_code: result.status, signal: result.signal, spawn_error: result.error?.code ?? null, stdout_sha256: hash(result.stdout ?? ''), stderr_sha256: hash(result.stderr ?? '') });
  assert.ifError(result.error); assert.equal(result.signal, null, result.stderr);
  return result;
}
const build = command('cargo', ['build', '--workspace', '--locked', '--offline'], { cwd: root, build: true });
assert.equal(build.status, 0, build.stderr);
const sourceCommit = command('git', ['rev-parse', 'HEAD'], { cwd: root }).stdout.trim();
const environment = { ...process.env };
for (const key of Object.keys(environment)) if (key.toLowerCase() === 'path') delete environment[key];
environment.PATH = '';
function pass(name) { results.push({ name, result: 'passed' }); console.log('PASS ' + name); }
function source(name, contents, extension = 'naja') { const file = join(directory, name + '.' + extension); writeFileSync(file, contents); return file; }
function check(file, expected, options = []) {
  const before = hash(readFileSync(file));
  const result = command(compiler, ['check', file, '--json', ...options], { env: environment });
  assert.equal(result.status, expected); assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.equal(report.schema_version, 1); assert.equal(report.source, file);
  assert.equal(report.status, expected === 0 ? 'passed' : 'failed');
  assert.ok(Array.isArray(report.diagnostics)); assert.ok(report.diagnostics.length <= 32);
  assert.ok(Number.isSafeInteger(report.omitted_diagnostics) && report.omitted_diagnostics >= 0);
  assert.equal(hash(readFileSync(file)), before, 'source changed');
  return report;
}
function verifyMissing(report, contents) {
  const before = contents.slice(0, contents.indexOf('missing'));
  const lines = before.split(/\r\n|\r|\n/);
  assert.equal(report.diagnostics.length, 1); assert.equal(report.omitted_diagnostics, 0);
  const diagnostic = report.diagnostics[0]; assert.equal(diagnostic.code, 'NJA101');
  assert.deepEqual(diagnostic.start, { line: lines.length - 1, character: lines.at(-1).length });
  assert.deepEqual(diagnostic.end, { line: lines.length - 1, character: lines.at(-1).length + 'missing'.length });
}
const valid = source('valid é & inert', 'print("é𝄞")\nwhile True:\n    print(999)\n');
const entries = readdirSync(directory).sort();
assert.deepEqual(check(valid, 0).diagnostics, []);
assert.deepEqual(readdirSync(directory).sort(), entries, 'check created a project artifact');
pass('empty-path-valid-check-does-not-execute-or-create-artifacts');
for (const extension of ['py', 'naja']) for (const [index, ending] of ['\n', '\r', '\r\n'].entries()) {
  const contents = '# original é𝄞' + ending + 'print("é𝄞" + missing)' + ending;
  verifyMissing(check(source('unicode-' + index, contents, extension), 1), contents);
  pass('original-utf16-' + extension + '-' + index);
}
for (const [name, contents] of [
  ['brace', 'if True: {\nprint("é𝄞" + missing)\n}\n'],
  ['depth', 'if True:(0)\n    print("é𝄞" + missing)\n'],
  ['named', '{# Original é𝄞 #\nprint("é𝄞" + missing)\n}\n'],
]) { verifyMissing(check(source(name, contents), 1), contents); pass('original-suite-' + name); }
const project = join(directory, 'project é'); mkdirSync(project);
writeFileSync(join(project, 'naja.toml'), 'schema = 1\n[project]\nname = "editor-check"\n');
writeFileSync(join(project, 'naja.alias'), 'schema = 1\n[builtins]\n"print" = "表示"\n');
const aliasFile = join(project, 'main.naja'), aliasSource = '表示("é𝄞" + missing)\n';
writeFileSync(aliasFile, aliasSource);
verifyMissing(check(aliasFile, 1, ['--project-root', project]), aliasSource); pass('alias-preserves-original-utf16-range');
const lexical = check(source('many-lexical-errors', '?\n'.repeat(40)), 1);
assert.equal(lexical.diagnostics.length, 32); assert.ok(lexical.omitted_diagnostics >= 8);
for (const [line, diagnostic] of lexical.diagnostics.entries()) {
  assert.deepEqual(diagnostic.start, { line, character: 0 }); assert.deepEqual(diagnostic.end, { line, character: 1 });
}
pass('diagnostic-cap-and-explicit-omission-count');
const corrected = check(source('corrected-control', 'print("é𝄞" + "fixed")\n'), 0);
assert.throws(() => verifyMissing(corrected, 'print("é𝄞" + missing)\n'), assert.AssertionError);
pass('changed-source-invalidates-error-expectation');
for (const [name, args, code] of [
  ['duplicate-json', [valid, '--json', '--json'], /NJA001/],
  ['duplicate-root', [valid, '--json', '--project-root', project, '--project-root', project], /NJA001/],
  ['missing-root-value', [valid, '--json', '--project-root'], /NJA001/],
  ['missing-source', [join(directory, 'absent.naja'), '--json'], /NJA004/],
  ['wrong-extension', [join(directory, 'absent.txt'), '--json'], /NJA002/],
  ['invalid-utf8', [source('invalid-utf8', Buffer.from([0xff])), '--json'], /NJA005/],
  ['directory-input', [join(directory, 'directory.naja'), '--json'], /NJA004/],
  ['invalid-project', [valid, '--json', '--project-root', directory], /NJA030/],
]) {
  if (name === 'directory-input') mkdirSync(args[0]);
  const result = command(compiler, ['check', ...args], { env: environment });
  assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.match(result.stderr, code); pass(name);
}
writeFileSync(join(directory, 'result.json'), JSON.stringify({ schema_version: 1, source_commit: sourceCommit, state: 'passed', native_user_programs_executed: false, results, commands }, null, 2) + '\n');
console.log(`Structured source checks: ${results.length} passed; 0 failed.`);
console.log('Artifacts: ' + relative(root, directory).replaceAll('\\', '/'));
