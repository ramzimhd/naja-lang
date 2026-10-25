// Actual AOT program execution. Windows explicitly selects the local WSL target.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const executable = resolve('target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
assert.ok(process.platform === 'win32' || (process.platform === 'linux' && process.arch === 'x64'), 'requires Linux x86-64 or explicit Windows WSL');
const directory = mkdtempSync(resolve('target/cli-execution-'));
const temporary = join(directory, 'temporary café');
mkdirSync(temporary);
const runner = process.platform === 'win32' ? ['--runner', 'wsl'] : [];
const environment = { ...process.env, TMP: temporary, TEMP: temporary, TMPDIR: temporary };
let passed = 0;

function cli(args, expected = 0, options = {}) {
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024, env: environment, ...options });
  assert.ifError(result.error);
  assert.equal(result.status, expected, `${args[0]} status: ${result.stderr}\n${result.stdout}`);
  assert.deepEqual(readdirSync(temporary), [], 'owned temporary artifacts must be cleaned');
  return result;
}
function pass(name) { passed++; console.log('PASS ' + name); }
function fixture(name, source) { const path = join(directory, name); writeFileSync(path, source); return path; }
function test(args, expected = 0) { return JSON.parse(cli(['test', ...args, ...runner, '--json'], expected).stdout); }

for (const command of ['lex', 'check', 'build', 'run', 'test']) {
  assert.match(cli([command, '--help']).stdout, new RegExp(`Usage: naja ${command} `));
  pass(command + ' command-specific help');
}
const unicode = fixture('native café 𝄞.naja', 'print(99999999999999999999999999999999999999 * 7)\n');
assert.equal(cli(['run', unicode, ...runner]).stdout, '699999999999999999999999999999999999993\n');
pass('native hosted AOT execution with Unicode and spaces in paths');
const marker = join(directory, 'must-not-be-created');
assert.equal(cli(['run', unicode, ...runner, '--', '', '--runner', `$(touch ${marker}); &`, 'é\" \\']).stdout, '699999999999999999999999999999999999993\n');
assert.equal(existsSync(marker), false);
pass('literal child arguments after -- without shell interpretation');

const invalid = resolve('tests/cli/cases/invalid.naja');
assert.match(cli(['run', invalid, ...runner], 1).stderr, /NJA1\d\d/);
pass('compile failure never executes and cleans temporary state');
const overflow = resolve('tests/cli/cases/overflow.py');
const failure = cli(['run', overflow, ...runner], 101);
assert.equal(failure.stderr, 'NJA201: checked i64 overflow\n');
pass('numeric native runtime exit 101 and stderr preserved');
const assertion = fixture('assertion failure.naja','x = 123456789012345678901234567890\nassert x + 1 == x\nprint(x)\n');
assert.equal(cli(['run', assertion, ...runner], 104).stderr, 'NJA204: assertion failed\n');
const assertionReport = test([assertion], 1);
assert.equal(assertionReport.failed, 1); assert.equal(assertionReport.tests[0].exit_code, 104);
assert.equal(assertionReport.tests[0].stdout, '');
pass('native assertions fail run and machine test reports without executing later output');
const assertionPass = fixture('assertion pass.naja','x = 123456789012345678901234567890\nif x > 0: assert x + 1 > x\n');
assert.equal(test([assertionPass]).passed, 1);
pass('program-file tests execute passing native comparison assertions');
const deadline = resolve('tests/cli/cases/deadline.py');
const timeout = cli(['run', deadline, ...runner, '--timeout-ms', '100'], 124);
assert.match(timeout.stderr, /NJA013/);
pass('bounded nonterminating native execution and artifact cleanup');
assert.match(cli(['check', deadline]).stdout, /Checked/);
pass('check does not execute nonterminating source');

if (process.platform === 'win32') {
  assert.match(cli(['run', unicode], 1).stderr, /NJA010.*--runner wsl/);
  assert.match(cli(['test', unicode, '--json'], 1).stderr, /NJA010.*--runner wsl/);
  pass('Windows requires explicit WSL runner');
} else {
  assert.match(cli(['run', unicode, '--runner', 'wsl'], 1).stderr, /NJA010/);
  pass('Linux rejects Windows-only WSL adapter');
}

for (const args of [
  ['run', unicode, '--runner', 'wsl', '--runner', 'wsl'], ['run', unicode, '--unknown'],
  ['run', unicode, 'bare-child-arg'], ['run', unicode, '--timeout-ms', '0'],
  ['run', unicode, '--timeout-ms', '60001'], ['run', unicode, '--timeout-ms', '1.5'],
  ['run', unicode, '--timeout-ms'], ['run', '--runner', 'wsl', unicode],
  ['run', unicode, '--filter', 'x'], ['test', unicode, '--json', '--json'],
  ['test', unicode, '--filter', 'x', '--filter', 'x'], ['test', unicode, '--', 'arg'],
  ['check', unicode, '--runner', 'wsl'], ['test', unicode, '--help'],
]) {
  assert.match(cli(args, 1).stderr, /NJA001/);
  pass('strict options: ' + args.filter(value => value.startsWith('--')).join(' '));
}

let report = test([resolve('tests/cli/programs')]);
assert.equal(report.schema_version, 1);
assert.equal(report.kind, 'native_program_tests');
assert.equal(report.passed, 2);
assert.equal(report.failed, 0);
assert.deepEqual(report.tests.map(item => item.path), ['nested/test_control.py', 'test_arithmetic.naja']);
assert.deepEqual(report.tests.map(item => item.stdout), ['3\n', '9999999999999999999999999999999999999800000000000000000000000000000000000002\n']);
assert.deepEqual(report, test([resolve('tests/cli/programs')]));
pass('deterministic sorted program discovery and stable machine JSON');
report = test([resolve('tests/cli/programs'), '--filter', 'arithmetic']);
assert.equal(report.selected, 1);
assert.equal(report.tests[0].path, 'test_arithmetic.naja');
assert.match(cli(['test', resolve('tests/cli/programs'), ...runner, '--filter', 'absent'], 1).stderr, /NJA014/);
pass('case-sensitive substring filtering and empty-selection diagnostic');
report = test([invalid], 1);
assert.equal(report.tests[0].status, 'compile_failed');
assert.equal(report.tests[0].exit_code, null);
assert.match(report.tests[0].diagnostic, /NJA1\d\d/);
pass('compile failure is a structured per-program result');
report = test([overflow], 1);
assert.equal(report.tests[0].status, 'failed');
assert.equal(report.tests[0].exit_code, 101);
assert.equal(report.tests[0].stderr, 'NJA201: checked i64 overflow\n');
assert.equal(report.tests[0].stderr_utf8_valid, true);
assert.equal(Buffer.from(report.tests[0].stderr_hex, 'hex').toString('utf8'), report.tests[0].stderr);
pass('runtime failure retains exact observed exit and captured stderr');
report = test([deadline, '--timeout-ms', '100'], 1);
assert.equal(report.tests[0].status, process.platform === 'win32' ? 'timeout_or_exit_124' : 'timed_out');
assert.equal(report.signal_observation, process.platform === 'win32' ? 'unavailable_through_wsl' : 'direct');
pass('deadline report distinguishes observed from unavailable signal data');

const output = fixture('output-limit.py', 'from naja.core import i64\nwhile i64(1) == i64(1):\n    print(i64(1234567890123456789))\n');
report = test([output, '--timeout-ms', '1000'], 1);
assert.equal(report.tests[0].status, 'output_limit');
assert.equal(Buffer.byteLength(report.tests[0].stdout), 65536);
pass('test output capture is bounded and overflow fails the case');
const unrelated = join(directory, 'discovery'); mkdirSync(unrelated);
writeFileSync(join(unrelated, 'ordinary.naja'), 'print(unknown_name)');
writeFileSync(join(unrelated, 'test_é.naja'), 'print(7)');
writeFileSync(join(unrelated, 'test_a.py'), 'print(3)');
report = test([unrelated]);
assert.deepEqual(report.tests.map(item => item.path), ['test_a.py', 'test_é.naja']);
pass('unmatched negative fixtures are not blindly executed');
try {
  symlinkSync(join(unrelated, 'test_a.py'), join(unrelated, 'test_link.py'));
  report = test([unrelated]); assert.equal(report.selected, 2);
  assert.match(cli(['test', join(unrelated, 'test_link.py'), ...runner], 1).stderr, /NJA014.*symbolic link/);
  pass('discovery skips symlinks and explicit symlink sources fail');
} catch (error) {
  if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error;
  console.log('NOT_RUN symbolic-link fixture: host cannot create symlinks without extra privileges');
}
const oversized = fixture('oversized.naja', '#'.repeat(1048577));
assert.match(cli(['run', oversized, ...runner], 1).stderr, /NJA100/);
const malformed = fixture('malformed.naja', Buffer.from([0xff]));
assert.match(cli(['run', malformed, ...runner], 1).stderr, /NJA005/);
pass('source UTF-8 and 1 MiB limits remain enforced');
const existing = fixture('preserve.elf', 'original bytes');
assert.match(cli(['build', unicode, '--target', 'x86_64-unknown-linux-gnu', '--output', existing], 1).stderr, /NJA006/);
assert.equal(readFileSync(existing, 'utf8'), 'original bytes');
pass('build preserves existing output bytes');
const deep = join(directory, 'deep'); mkdirSync(deep);
let level = deep;
for (let index = 0; index < 17; index++) { level = join(level, 'nested'); mkdirSync(level); }
writeFileSync(join(level, 'test_deep.naja'), 'print(1)');
assert.match(cli(['test', deep, ...runner], 1).stderr, /NJA014.*depth 16/);
pass('directory traversal depth is bounded before execution');
const entries = join(directory, 'entries'); mkdirSync(entries);
for (let index = 0; index < 4097; index++) writeFileSync(join(entries, `unmatched_${index}.txt`), '');
assert.match(cli(['test', entries, ...runner], 1).stderr, /NJA014.*4096 entries/);
pass('unmatched discovery entries still count toward the traversal budget');
const blockedTemp = fixture('blocked-temp-root', 'preserve this file');
assert.match(cli(['run', unicode, ...runner], 1, {env:{...environment,TMP:blockedTemp,TEMP:blockedTemp,TMPDIR:blockedTemp}}).stderr, /NJA011/);
assert.equal(readFileSync(blockedTemp, 'utf8'), 'preserve this file');
pass('unusable temporary root fails without changing existing bytes');
// Development-only Rust fixture driver reuses the production adapter. It is
// compiled here, never by the distributed CLI or generated native program.
const probe = join(directory, process.platform === 'win32' ? 'execution-probe.exe' : 'execution-probe');
const compiled = spawnSync('rustc', ['--edition=2024','tests/cli/execution_probe.rs','-o',probe], {encoding:'utf8',timeout:30000});
assert.ifError(compiled.error); assert.equal(compiled.status,0,compiled.stderr);
const probed = spawnSync(probe, runner, {encoding:'utf8',timeout:30000,env:environment});
assert.ifError(probed.error); assert.equal(probed.status,0,probed.stderr);
assert.match(probed.stdout,/PASS native adapter argv bytes/);
assert.match(probed.stdout,/raw non-UTF-8 output/);
assert.deepEqual(readdirSync(temporary), []);
pass('native fixture observes argv bytes, arbitrary exit42 and platform signal status');
console.log(`CLI execution checks passed: ${passed}; target=${process.platform === 'win32' ? 'Linux x86-64 via explicit Windows WSL' : 'Linux x86-64 direct'}; fixture artifacts retained under target/`);
