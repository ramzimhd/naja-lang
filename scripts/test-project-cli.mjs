// Real project creation, standalone compiler use and explicit native execution.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const compileOnly = process.argv.includes('--compile-only');
assert.deepEqual(process.argv.slice(2), compileOnly ? ['--compile-only'] : []);
mkdirSync('target', { recursive: true });
const directory = mkdtempSync(resolve('target/project-cli-'));
const captureDirectory = join(directory, 'captures');
mkdirSync(captureDirectory);
const compiler = resolve('target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
const started = Date.now(), suiteLimitMs = 120000;
const results = [];
const commands = [];
const hash = value => createHash('sha256').update(value).digest('hex');
process.on('uncaughtExceptionMonitor', error => {
  try { writeFileSync(join(directory, 'failure.json'), JSON.stringify({ schema_version: 1, state: 'failed', error: { name: error.name, message: error.message }, commands, results }, null, 2) + '\n'); }
  catch { /* Preserve the original failing process if evidence writing also fails. */ }
});
const environment = { ...process.env };
// Windows environment keys are case-insensitive. Remove every spelling before
// adding the empty value, so a second inherited Path cannot restore tools.
for (const key of Object.keys(environment)) if (key.toLowerCase() === 'path') delete environment[key];
environment.PATH = '';
function command(executable, args, options = {}) {
  const remaining = suiteLimitMs - (Date.now() - started);
  assert.ok(remaining > 0, 'project CLI suite deadline exceeded');
  const result = spawnSync(executable, args, { cwd: directory, encoding: 'utf8', maxBuffer: 1024 * 1024, ...options, timeout: Math.min(30000, remaining) });
  const prefix = 'command-' + commands.length;
  for (const stream of ['stdout', 'stderr']) writeFileSync(join(captureDirectory, prefix + '.' + stream), result[stream] ?? '');
  commands.push({ command: [executable, ...args], cwd: options.cwd ?? directory, empty_path: options.env === environment, exit_code: result.status, signal: result.signal, spawn_error: result.error?.code ?? null, stdout_sha256: hash(result.stdout ?? ''), stderr_sha256: hash(result.stderr ?? '') });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  return result;
}
function cli(args, expected = 0, options = {}) {
  const result = command(compiler, args, options);
  assert.equal(result.status, expected, `${args[0]} status: ${result.stderr}\n${result.stdout}`);
  return result;
}
function pass(name, extra = {}) {
  results.push({ name, result: 'passed', ...extra });
  console.log('PASS ' + name);
}
function refuse(name, args, code, options = {}) {
  const result = cli(args, 1, options);
  assert.match(result.stderr, code);
  assert.equal(result.stdout, '');
  pass(name);
}
const built = command('cargo', ['build', '--workspace', '--locked', '--offline'], { cwd: root });
assert.equal(built.status, 0, built.stderr);
for (const operation of ['doctor', 'init']) {
  assert.match(cli([operation, '--help']).stdout, new RegExp('Usage: naja ' + operation + ' '));
  pass(operation + '-help');
}
const beforeDoctor = readdirSync(directory);
// Deliberately invalid ambient project files must not affect read-only doctor.
writeFileSync(join(directory, 'naja.toml'), 'invalid ambient manifest\n');
writeFileSync(join(directory, 'naja.alias'), 'invalid ambient aliases\n');
const ambientHashes = ['naja.toml', 'naja.alias'].map(name => hash(readFileSync(join(directory, name))));
const observation = JSON.parse(cli(['doctor', '--json'], 0, { env: environment }).stdout);
assert.equal(observation.schema_version, 1);
assert.equal(observation.execution.preparation, 'not_probed');
assert.equal(observation.execution.user_program_executed, false);
assert.equal(observation.self_hosted, false);
assert.deepEqual(observation.emitted_targets, ['x86_64-unknown-linux-gnu']);
assert.equal(observation.host.os, { win32: 'windows', darwin: 'macos' }[process.platform] ?? process.platform);
assert.equal(observation.execution.direct_option_supported, process.platform === 'linux' && process.arch === 'x64');
assert.equal(observation.execution.wsl_option_supported, process.platform === 'win32');
assert.deepEqual(ambientHashes, ['naja.toml', 'naja.alias'].map(name => hash(readFileSync(join(directory, name)))));
assert.deepEqual(readdirSync(directory).sort(), beforeDoctor.concat('naja.toml', 'naja.alias').sort());
pass('doctor-with-empty-path-ignores-ambient-project-files');
assert.match(cli(['doctor']).stdout, /preparation: not_probed/);
pass('doctor-readable-default');
for (const [name, args] of [
  ['unknown', ['doctor', '--install']], ['duplicate-json', ['doctor', '--json', '--json']],
  ['missing-runner', ['doctor', '--runner']], ['unknown-runner', ['doctor', '--runner', 'remote']],
  ['duplicate-runner', ['doctor', '--runner', 'direct', '--runner', 'direct']],
]) refuse('doctor-' + name, args, /NJA041/);
const unsupportedRunner = process.platform === 'win32' ? 'direct' : 'wsl';
refuse('doctor-unsupported-runner', ['doctor', '--runner', unsupportedRunner, '--json'], /NJA010/);

const project = join(directory, 'project café 𝄞');
const initialized = cli(['init', project], 0, { env: environment });
assert.match(initialized.stdout, /Created NAJA project/);
assert.deepEqual(readdirSync(project).sort(), ['main.naja', 'naja.toml', 'test_smoke.naja']);
const files = Object.fromEntries(readdirSync(project).map(name => [name, hash(readFileSync(join(project, name)))]));
pass('init-with-empty-path-creates-only-declared-files', { files });
refuse('existing-project-is-preserved', ['init', project], /NJA040/);
assert.deepEqual(files, Object.fromEntries(readdirSync(project).map(name => [name, hash(readFileSync(join(project, name)))])));
const sentinel = join(directory, 'existing-file'); writeFileSync(sentinel, 'preserve existing bytes\n');
refuse('existing-file-is-preserved', ['init', sentinel], /NJA040/);
assert.equal(readFileSync(sentinel, 'utf8'), 'preserve existing bytes\n');
const missingParent = join(directory, 'missing', 'project');
refuse('missing-parent-does-not-create-directories', ['init', missingParent], /NJA040/);
assert.equal(existsSync(join(directory, 'missing')), false);
const extraTarget = join(directory, 'extra-options');
refuse('init-extra-option-before-writes', ['init', extraTarget, '--run'], /NJA040/);
assert.equal(existsSync(extraTarget), false);
refuse('init-missing-directory', ['init'], /NJA040/);
refuse('init-parent-traversal', ['init', project + '/../escape'], /NJA040/);
const maliciousName = join(directory, 'bad"name');
refuse('init-invalid-name-before-writes', ['init', maliciousName], /NJA040/);
assert.equal(existsSync(maliciousName), false);

const main = join(project, 'main.naja');
cli(['check', main, '--project-root', project], 0, { env: environment });
pass('generated-project-check-without-path-tools');
const artifact = join(directory, 'main.elf');
cli(['build', main, '--project-root', project, '--target', 'x86_64-unknown-linux-gnu', '--output', artifact], 0, { env: environment });
const image = readFileSync(artifact);
assert.equal(image.subarray(0, 4).toString('hex'), '7f454c46');
assert.equal(image.readUInt16LE(18), 62);
pass('generated-project-build-without-path-tools', { elf_sha256: hash(image) });
assert.deepEqual(files, Object.fromEntries(readdirSync(project).map(name => [name, hash(readFileSync(join(project, name)))])));

if (!compileOnly && (process.platform === 'win32' || (process.platform === 'linux' && process.arch === 'x64'))) {
  const runner = process.platform === 'win32' ? ['--runner', 'wsl'] : [];
  const requestedRunner = process.platform === 'win32' ? 'wsl' : 'direct';
  const prepared = JSON.parse(cli(['doctor', '--runner', requestedRunner, '--json']).stdout);
  assert.equal(prepared.execution.preparation, 'prepared');
  assert.equal(prepared.execution.user_program_executed, false);
  pass('explicit-local-runner-preparation');
  const executed = cli(['run', main, '--project-root', project, ...runner, '--timeout-ms', '2000']);
  assert.equal(executed.stdout, '42\n'); assert.equal(executed.stderr, '');
  pass('initialized-main-executes-native-code');
  const tested = JSON.parse(cli(['test', project, '--project-root', project, ...runner, '--json', '--timeout-ms', '2000']).stdout);
  assert.equal(tested.passed, 1); assert.equal(tested.failed, 0);
  pass('initialized-program-file-smoke-runs');
} else {
  for (const name of ['explicit-local-runner-preparation', 'initialized-main-executes-native-code', 'initialized-program-file-smoke-runs']) results.push({ name, result: 'not_run', reason: compileOnly ? 'explicit compile-only mode' : 'host native execution is unsupported' });
}
const summary = { schema_version: 1, source_commit: command('git', ['rev-parse', 'HEAD'], { cwd: root }).stdout.trim(), source_status: command('git', ['status', '--short'], { cwd: root }).stdout, host: process.platform + '-' + process.arch, target: 'x86_64-unknown-linux-gnu', compiler_sha256: hash(readFileSync(compiler)), harness_sha256: hash(readFileSync(fileURLToPath(import.meta.url))), passed: results.filter(r => r.result === 'passed').length, not_run: results.filter(r => r.result === 'not_run').length, commands, results };
writeFileSync(join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(`Project CLI checks: ${summary.passed} passed; ${summary.not_run} not run; artifacts=${relative(root, directory).replaceAll('\\', '/')}`);
console.log('Limits: empty-PATH checks do not establish a clean host; runner preparation is separate from user-program execution; no self-hosting, complete CLI or HATCH claim.');
