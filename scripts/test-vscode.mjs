// Frozen CLI-adapter checks. No editor workflow or native program execution claim.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), core = require('../editor/vscode/core.cjs');
const root = fileURLToPath(new URL('../', import.meta.url));
const pinned = '662bcdcff3a5742d9271b5f449becaa724503d78';
assert.deepEqual(process.argv.slice(2), []);
mkdirSync(path.join(root, 'editor/vscode/artifacts'), { recursive: true });
const directory = mkdtempSync(path.join(root, 'editor/vscode/artifacts/checks-'));
const started = Date.now(), commands = [], cases = [];
let adapterSource = null;
const hash = value => createHash('sha256').update(value).digest('hex');
const clean = value => {
  if (typeof value === 'string') { for (const [prefix, replacement] of [[root, '<repo>/'], [os.tmpdir(), '<temporary>'], [process.env.USERPROFILE, '<profile>'], [process.env.HOME, '<profile>']]) if (prefix) { value = value.replaceAll(prefix, replacement).replaceAll(prefix.replaceAll('\\', '/'), replacement).replaceAll(prefix.replaceAll('/', '\\'), replacement); } return value; }
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clean(child)]));
  return value;
};
function record(state, error = null) { writeFileSync(path.join(directory, 'result.json'), JSON.stringify(clean({ schema_version: 1, contract_revision: '1.3', state, compiler_source: pinned, adapter_source: adapterSource, node: process.version, host: process.platform + '-' + process.arch, timestamp: new Date().toISOString(), commands, cases, error, limits: { build_ms: 45000, command_ms: 10000, suite_ms: 120000, output_bytes: 1048576 }, scope: 'Unit mock host and real compiler CLI only; no IDE end-to-end or source execution claim.' }), null, 2) + '\n'); }
process.on('uncaughtExceptionMonitor', error => record('failed', error.message));
function command(tool, args, options = {}) {
  const remaining = 120000 - (Date.now() - started); assert.ok(remaining > 0, 'suite deadline');
  const result = spawnSync(tool, args, { cwd: root, encoding: null, maxBuffer: 1048576, ...options, timeout: Math.min(options.build ? 45000 : 10000, remaining) });
  const index = commands.length, logs = {};
  for (const stream of ['stdout', 'stderr']) { const bytes = result[stream] ?? Buffer.alloc(0), name = `command-${index}.${stream}.log`; writeFileSync(path.join(directory, name), bytes); logs[stream] = { path: path.relative(root, path.join(directory, name)).replaceAll('\\', '/'), sha256: hash(bytes) }; }
  commands.push({ command: [tool, ...args], exit_code: result.status, signal: result.signal, spawn_error: result.error?.code ?? null, logs });
  assert.ifError(result.error); assert.equal(result.signal, null);
  return result;
}
function pass(name) { cases.push({ name, result: 'passed' }); console.log('PASS ' + name); }
const diff = command('git', ['diff', pinned, '--', 'bootstrap/', 'backends/', 'Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml']); assert.equal(diff.status, 0); assert.equal(diff.stdout.toString(), '');
const unknown = command('git', ['ls-files', '--others', '--exclude-standard', '--', 'bootstrap/', 'backends/']); assert.equal(unknown.status, 0); assert.equal(unknown.stdout.toString(), '');
const current = command('git', ['rev-parse', 'HEAD']); assert.equal(current.status, 0);
adapterSource = current.stdout.toString().trim(); assert.match(adapterSource, /^[0-9a-f]{40}$/);
const units = command(process.execPath, ['--test', path.join(root, 'tests/vscode/adapter.test.mjs')]); assert.equal(units.status, 0, units.stdout.toString() + units.stderr.toString()); pass('adapter-unit-suite');
const build = command('cargo', ['build', '--workspace', '--locked', '--offline'], { build: true }); assert.equal(build.status, 0, build.stderr.toString()); pass('locked-offline-pinned-compiler-build');
const compiler = path.join(root, 'target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
const environment = { ...process.env }; for (const key of Object.keys(environment)) if (key.toLowerCase() === 'path') delete environment[key]; environment.PATH = '';
async function check(name, contents, exitCode, project = '') {
  const filename = path.join(directory, name + '.naja'); writeFileSync(filename, contents);
  const before = readdirSync(directory).filter(value => !value.startsWith('command-')).sort();
  const item = { file: filename, text: contents }, settings = { compilerPath: compiler, projectRoot: project, windowsRunner: 'disabled' };
  const plan = core.makePlan('check', item, settings);
  const result = command(plan.tool, plan.args, { env: environment }); assert.equal(result.status, exitCode);
  const report = core.validateReport({ exitCode: result.status, stdout: result.stdout, stderr: result.stderr }, item);
  assert.equal(hash(readFileSync(filename)), hash(Buffer.from(contents)));
  assert.deepEqual(readdirSync(directory).filter(value => !value.startsWith('command-')).sort(), before);
  pass(name); return report;
}
await core.compilerFile(compiler);
await check('valid-no-execution-é & inert', 'print(42)\nwhile True:\n    print(999)\n', 0);
for (const [index, ending] of ['\n', '\r\n', '\r'].entries()) {
  const source = '# original é𝄞' + ending + 'print("é𝄞" + missing)' + ending;
  const report = await check('original-utf16-' + index, source, 1);
  assert.deepEqual(report.diagnostics[0].start, { line: 1, character: 14 });
  assert.deepEqual(report.diagnostics[0].end, { line: 1, character: 21 });
}
const project = path.join(directory, 'owner é'); mkdirSync(project);
writeFileSync(path.join(project, 'naja.toml'), 'schema=1\n[project]\nname="editor-check"\n'); writeFileSync(path.join(project, 'naja.alias'), '[builtins]\n"print"="表示"\n');
const file = path.join(project, 'main.naja'), source = '表示("é𝄞" + missing)\n'; writeFileSync(file, source);
const alias = command(compiler, ['check', file, '--json', '--project-root', project], { env: environment }); assert.equal(alias.status, 1);
const mapped = core.validateReport({ exitCode: alias.status, stdout: alias.stdout, stderr: alias.stderr }, { file, text: source }); assert.equal(mapped.diagnostics[0].start.character, source.indexOf('missing')); pass('real-project-alias-original-range');
const failures = command(compiler, ['check', path.join(directory, 'absent.naja'), '--json'], { env: environment }); assert.equal(failures.status, 1); assert.equal(failures.stdout.length, 0); assert.ok(failures.stderr.length); assert.throws(() => core.validateReport({ exitCode: 1, stdout: failures.stdout, stderr: failures.stderr }, { file: 'absent', text: '' })); pass('input-error-is-not-semantic-pass');
const omitted = await check('omission-is-explicit', '?\n'.repeat(40), 1); assert.equal(omitted.diagnostics.length, 32); assert.ok(omitted.omitted_diagnostics >= 8);
record('passed');
console.log(`Compiler pinned ${pinned}; adapter tree ${current.stdout.toString().trim()}; ${cases.length} groups passed.`);
console.log('Retained result: ' + path.relative(root, path.join(directory, 'result.json')).replaceAll('\\', '/'));
