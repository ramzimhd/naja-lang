// Execute source functions as actual ELF code; no Python interpreter or oracle.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = resolve(root, 'tests/functions-source');
const hash = value => createHash('sha256').update(value).digest('hex');
const bytes = value => Buffer.from(value, 'utf8');
const portable = value => value.replaceAll('\\', '/');
const started = Date.now();
const overallLimitMs = 240_000;
const nativeLimitSeconds = 5;
const argv = process.argv.slice(2);
const prepareOnly = argv.includes('--prepare-only');
const expectAt = argv.indexOf('--expect-source');
const expectedSource = expectAt < 0 ? null : argv[expectAt + 1];
assert.ok(expectedSource === null || /^[0-9a-f]{40}$/.test(expectedSource), '--expect-source requires a full lowercase commit hash');
assert.deepEqual(argv.filter((argument, index) => argument !== '--prepare-only' && !(expectAt >= 0 && (index === expectAt || index === expectAt + 1))), [], 'unsupported harness options');
process.chdir(root);
mkdirSync(resolve('target'), { recursive: true });
const directory = mkdtempSync(resolve('target/functions-language-'));
const compiler = resolve('target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
const results = [];
const commands = [];
const fixtures = JSON.parse(readFileSync(join(fixtureRoot, 'fixture-index.json'), 'utf8'));
assert.equal(fixtures.schema_version, 1);
for (const entry of fixtures.files) {
  assert.match(entry.path, /^(?:[a-z][a-z0-9-]*\.(?:py|naja)|project\/(?:main\.naja|naja\.(?:toml|alias)))$/);
  assert.equal(hash(readFileSync(join(fixtureRoot, entry.path))), entry.sha256, 'static fixture hash: ' + entry.path);
}
const fixture = name => readFileSync(join(fixtureRoot, name), 'utf8');
const cases = [];
const runtime = (name, source, stdout, options = {}) => cases.push({ name, source, stdout, stderr: '', exit: 0, extension: 'naja', ...options });
const reject = (name, source, diagnostic = 'NJA101:', options = {}) => cases.push({ name, source, diagnostic, reject: true, extension: 'naja', ...options });

for (const entry of fixtures.native) for (const extension of entry.extensions) {
  runtime(entry.name + '-' + extension, fixture(entry.path), entry.stdout, { extension });
}
runtime('aliases-in-functions', fixture('project/main.naja'), 'function called\n2\nliteral 表示 equalTo 小于\nTrue\n', { project: true });
runtime('flow-crlf-metamorphic', fixture('flow.py').replaceAll('\n', '\r\n'), '7\n9\n2\n-1\nyes\nno\n', { extension: 'py' });
runtime('flow-comments-metamorphic', fixture('flow.py').split('\n').map(line => line ? line + ' # %% {# return 999 # }' : line).join('\n'), '7\n9\n2\n-1\nyes\nno\n');
runtime('inline-and-trailing-commas', 'def increment(value,): return value + 1\ndef empty(): pass\nprint(increment(5,))\nprint(empty())\n', '6\nNone\n');
runtime('parameter-shadow-is-an-ordinary-value', 'def first(value):\n    return value + 1\ndef second(first):\n    return first\nprint(second(7))\nprint(first(7))\n', '7\n8\n');

let factorial = 1n;
for (let value = 1n; value <= 50n; value++) factorial *= value;
runtime('recursive-factorial-bigint', 'def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n - 1)\nprint(factorial(50))\n', factorial + '\n');
const floorDivrem = (a, b) => {
  let q = a / b, r = a % b;
  if (r !== 0n && (a < 0n) !== (b < 0n)) { q--; r += b; }
  assert.equal(a, q * b + r);
  assert.ok(r === 0n || (r < 0n) === (b < 0n));
  return [q, r];
};
let divisionSource = 'def quotient(a, b):\n    return a // b\ndef remainder(a, b):\n    return a % b\n';
let divisionOutput = '';
for (const a of [0n, 1n, -1n, 7n, -7n, 10n ** 90n + 3n, -(10n ** 100n) - 1n]) {
  for (const b of [1n, -1n, 3n, -3n, 10n ** 25n + 1n, -(10n ** 25n) - 1n]) {
    const answers = floorDivrem(a, b);
    divisionSource += `print(quotient((${a}), (${b})))\nprint(remainder((${a}), (${b})))\n`;
    divisionOutput += answers.join('\n') + '\n';
  }
}
runtime('function-divrem-independent-bigint-matrix', divisionSource, divisionOutput);
runtime('call-short-circuit-and-comparison-once', 'def mark(label, value):\n    print(label)\n    return value\nprint(False and mark("bad and", 1))\nprint(True or mark("bad or", 2))\nprint(mark("left", 3) < mark("middle", 4) < mark("right", 5))\nprint(mark("first", 3) < mark("middle fail", 2) < mark("bad chain", 1))\n', 'False\nTrue\nleft\nmiddle\nright\nTrue\nfirst\nmiddle fail\nFalse\n');
runtime('return-runtime-type-error', 'def size(value):\n    return len(value)\nprint("before")\nprint(size(1))\nprint("unreachable")\n', 'before\n', { exit: 105, stderr: 'NJA205: native value type mismatch\n' });
runtime('argument-error-order', 'def mark(label, value):\n    print(label)\n    return value\ndef first(a, b, c):\n    return a\nprint(first(mark("first", 1), 7 // 0, mark("unreachable", 3)))\n', 'first\n', { exit: 106, stderr: 'NJA206: integer division by zero\n' });
const depthSource = depth => 'def count(n):\n    if n == 1:\n        return 1\n    return count(n - 1) + 1\nprint(count(' + depth + '))\n';
runtime('active-calls-256', depthSource(256), '256\n');
runtime('active-calls-257-resource-control', depthSource(257), '', { exit: 103, stderr: 'NJA203: native user-call depth limit exceeded\n' });
runtime('depth-counter-restored-after-early-return', 'def down(n):\n    if n == 1:\n        return n\n    return down(n - 1)\nindex = 0\nwhile index < 300:\n    assert down(32) == 1\n    index = index + 1\nprint(index)\n', '300\n');
const parameters = count => Array.from({ length: count }, (_, index) => 'p' + index);
const parameterSource = count => 'def all_parameters(' + parameters(count).join(', ') + '):\n' + parameters(count).map((name, index) => '    assert ' + name + ' == ' + index + '\n').join('') + '    return p0 + p' + (count - 1) + '\nprint(all_parameters(' + parameters(count).map((_, index) => index).join(', ') + '))\n';
runtime('parameters-128-all-positions', parameterSource(128), '127\n');
reject('parameters-129-limit', parameterSource(129), 'parameter limit of 128');
const functionSource = count => Array.from({ length: count }, (_, index) => 'def f' + index + '():\n    return ' + index + '\n').join('') + 'print(f0())\nprint(f' + (count - 1) + '())\n';
runtime('functions-128', functionSource(128), '0\n127\n');
reject('functions-129-limit', functionSource(129), 'function limit of 128');
const shortSource = 'def f(): return 1\nprint(f())\n#';
const fullSource = shortSource + 'x'.repeat(1_048_576 - Buffer.byteLength(shortSource));
runtime('source-exact-1mib', fullSource, '1\n');
reject('source-over-1mib', fullSource + 'x', 'NJA100:');

for (const [name, source, diagnostic] of [
  ['nested-definition', 'def outer():\n    def inner():\n        return 1\n    return 2\nprint(outer())\n', 'NJA101:'],
  ['lambda', 'def f(value):\n    return lambda: value\nprint(f(1))\n', 'NJA101:'],
  ['function-value', 'def f():\n    return 1\nx = f\nprint(x)\n', 'NJA101:'],
  ['forward-call', 'def first():\n    return later()\ndef later():\n    return 1\nprint(first())\n', 'earlier top-level'],
  ['module-forward-call', 'print(later())\ndef later():\n    return 1\n', 'earlier top-level'],
  ['global-variable-read', 'global_value = 7\ndef f():\n    return global_value\nprint(f())\n', 'NJA101:'],
  ['function-rebinding', 'def f():\n    return 1\nf = 2\n', 'rebinding'],
  ['duplicate-function', 'def f(): return 1\ndef f(): return 2\n', 'rebinding'],
  ['module-name-collision', 'f = 7\ndef f(): return 1\n', 'collision'],
  ['default-argument', 'def f(value=1): return value\nprint(f())\n', 'NJA101:'],
  ['keyword-call', 'def f(value): return value\nprint(f(value=1))\n', 'NJA101:'],
  ['star-parameter', 'def f(*values): return 1\n', 'NJA101:'],
  ['double-star-parameter', 'def f(**values): return 1\n', 'NJA101:'],
  ['positional-only-separator', 'def f(value, /): return value\n', 'NJA101:'],
  ['parameter-annotation', 'def f(value: int): return value\n', 'NJA101:'],
  ['return-annotation', 'def f() -> int: return 1\n', 'NJA101:'],
  ['star-call', 'def f(value): return value\nprint(f(*1))\n', 'NJA101:'],
  ['call-parameter', 'def f(callback):\n    return callback(1)\nprint(f(2))\n', 'calling local values or parameters'],
  ['local-read-before-assignment', 'def f():\n    print(value)\n    value = 1\nprint(f())\n', 'NJA101:'],
  ['conditional-uninitialized-return', 'def f(flag):\n    if flag:\n        value = 1\n    return value\nprint(f(False))\n', 'NJA101:'],
  ['loop-uninitialized-return', 'def f(flag):\n    while flag:\n        value = 1\n        return value\n    return value\nprint(f(False))\n', 'NJA101:'],
  ['return-outside-function', 'return 1\n', 'NJA101:'],
  ['print-parameter-binding', 'def f(print): return print\n', 'NJA101:'],
  ['print-function-binding', 'def print(value): return value\n', 'NJA101:'],
  ['print-local-binding', 'def f():\n    print = 1\n    return print\n', 'NJA101:'],
  ['lexical-len-shadow-after-use', 'def f():\n    print(len("abc"))\n    len = 1\n    return len\nprint(f())\n', 'NJA101:'],
  ['earlier-module-len-binding', 'len = 7\ndef f():\n    return len("abc")\nprint(f())\n', 'NJA101:'],
  ['later-module-len-binding', 'def f():\n    return len("abc")\nlen = 7\nprint(f())\n', 'NJA101:'],
  ['later-len-definition', 'def f():\n    return len("abc")\ndef len(value): return value\nprint(f())\n', 'NJA101:'],
  ['duplicate-nfkc-parameters', 'def f(Key, Key): return Key\n', 'canonical Unicode'],
  ['duplicate-combining-parameters', 'def f(é, é): return é\n', 'canonical Unicode'],
  ['duplicate-nfkc-functions', 'def Key(): return 1\ndef Key(): return 2\n', 'rebinding'],
  ['too-few-arguments', 'def one(value):\n    return value\nprint(one())\n', 'requires 1 positional arguments; received 0'],
  ['too-many-arguments-original-span', 'def one(value):\n    return value\nprint(one(1, 2))\n', ':3:16: NJA101:'],
  ['unicode-original-span', '# café\ndef écho(value):\n    return missing_name\nprint(écho(1))\n', ':3:12: NJA101:'],
  ['arguments-129-limit', 'def f(value): return value\nprint(f(' + Array.from({ length: 129 }, () => '1').join(',') + '))\n', 'argument limit of 128'],
]) reject(name, source, diagnostic);
reject('braces-do-not-leak-into-python', fixture('braces.naja'), 'NJA101:', { extension: 'py' });
reject('markers-do-not-leak-into-python', fixture('markers.naja'), 'NJA101:', { extension: 'py' });
reject('aliases-require-explicit-project', fixture('project/main.naja'), 'NJA101:');
reject('python-explicit-project-is-rejected', fixture('ordinary.py'), 'NJA030:', { extension: 'py', project: true });
reject('builtin-alias-static-local-conflict', 'def f():\n    表示(長さ("abc"))\n    長さ = 1\n    return 長さ\n表示(f())\n', 'NJA101:', { project: true });
cases.push({ ...cases.find(test => test.name === 'order-py'), name: 'mutated-order-output-control', source: fixture('order.py').replace('"second"', '"injected second"'), control: true });
cases.push({ ...cases.find(test => test.name === 'flow-py'), name: 'mutated-return-value-control', source: fixture('flow.py').replace('return 7', 'return 8'), control: true });
assert.equal(new Set(cases.map(test => test.name)).size, cases.length, 'unique case names');

function command(executable, args, options = {}) {
  const { timeout = 20_000, ...rest } = options;
  const remaining = overallLimitMs - (Date.now() - started);
  assert.ok(remaining > 0, 'overall function suite deadline exceeded');
  const result = spawnSync(executable, args, { cwd: root, maxBuffer: 8 * 1024 * 1024, ...rest, timeout: Math.min(timeout, remaining), encoding: null });
  commands.push({ executable, arguments: args, exit: result.status, signal: result.signal, error: result.error?.code ?? null });
  assert.ifError(result.error);
  assert.equal(result.signal, null, 'unexpected child signal');
  return result;
}
function output(name, result) {
  writeFileSync(join(directory, name + '.stdout'), result.stdout);
  writeFileSync(join(directory, name + '.stderr'), result.stderr);
}
const identity = test => ({ name: test.name, source_bytes: Buffer.byteLength(test.source), source_sha256: hash(test.source), extension: test.extension, project: test.project ?? false, expectation: test.reject ? 'compile_rejection' : test.control ? 'output_oracle_rejects_mutated_source' : 'native_execution' });
const sourceHead = command('git', ['rev-parse', 'HEAD']).stdout.toString().trim();
if (expectedSource !== null) assert.equal(sourceHead, expectedSource, 'source commit mismatch');
const sourceStatus = command('git', ['status', '--short']).stdout.toString();
const sourceDiff = command('git', ['diff', '--binary', 'HEAD']).stdout;
writeFileSync(join(directory, 'plan.json'), JSON.stringify({ schema_version: 1, source_commit: sourceHead, fixture_index_sha256: hash(readFileSync(join(fixtureRoot, 'fixture-index.json'))), cases: cases.map(identity) }, null, 2) + '\n');
process.on('uncaughtExceptionMonitor', error => {
  try { writeFileSync(join(directory, 'failure.json'), JSON.stringify({ schema_version: 1, state: 'failed', source_commit: sourceHead, results, commands, error: { name: error.name, message: error.message } }, null, 2) + '\n'); }
  catch { /* Preserve the original failure if evidence storage fails. */ }
});
if (prepareOnly) {
  writeFileSync(join(directory, 'summary.json'), JSON.stringify({ schema_version: 1, state: 'prepared', source_commit: sourceHead, passed: 0, not_run: cases.length, results: cases.map(test => ({ ...identity(test), result: 'not_run' })) }, null, 2) + '\n');
  console.log(`Prepared ${cases.length} cases and verified ${fixtures.files.length} static fixture hashes. Native outcomes: not_run. Artifacts: ${portable(relative(root, directory))}`);
} else {
  const built = command('cargo', ['+1.97.1', 'build', '--workspace', '--locked', '--offline'], { timeout: 45_000 });
  output('compiler-build', built);
  assert.equal(built.status, 0, built.stderr.toString());
  const version = command(compiler, ['--version']);
  assert.equal(version.status, 0, version.stderr.toString());
  let linuxDirectory = directory;
  if (process.platform === 'win32') {
    const platform = command('wsl.exe', ['--exec', '/usr/bin/uname', '-sm']);
    assert.equal(platform.status, 0, platform.stderr.toString());
    assert.equal(platform.stdout.toString().trim(), 'Linux x86_64');
    const translated = command('wsl.exe', ['--exec', '/usr/bin/wslpath', '-a', directory.replaceAll('\\', '/')]);
    assert.equal(translated.status, 0, translated.stderr.toString());
    linuxDirectory = translated.stdout.toString().trim();
  } else {
    assert.equal(process.platform, 'linux', 'native checks require Linux x86-64 or Windows with x86-64 WSL');
    assert.equal(process.arch, 'x64');
  }
  const projectRoot = join(directory, 'project');
  cpSync(join(fixtureRoot, 'project'), projectRoot, { recursive: true });
  const verify = (test, result) => {
    assert.equal(result.status, test.exit, test.name + ': native exit; stderr: ' + result.stderr);
    assert.deepEqual(result.stdout, bytes(test.stdout), test.name + ': stdout bytes');
    assert.deepEqual(result.stderr, bytes(test.stderr), test.name + ': stderr bytes');
  };
  for (const test of cases) {
    const input = join(test.project ? projectRoot : directory, test.name + '.' + test.extension);
    const artifact = join(directory, test.name + '.elf');
    writeFileSync(input, test.source);
    const project = test.project ? ['--project-root', projectRoot] : [];
    const checked = command(compiler, ['check', input, ...project]);
    output(test.name + '.check', checked);
    const emitted = command(compiler, ['build', input, '--target', 'x86_64-unknown-linux-gnu', '--output', artifact, ...project]);
    output(test.name + '.build', emitted);
    const record = { ...identity(test), check_exit: checked.status, build_exit: emitted.status };
    if (test.reject) {
      for (const [stage, result] of [['check', checked], ['build', emitted]]) {
        assert.equal(result.status, 1, test.name + ': expected ' + stage + ' rejection: ' + result.stderr);
        assert.ok(result.stderr.toString().includes(test.diagnostic), test.name + ': original diagnostic: ' + result.stderr);
        assert.deepEqual(result.stdout, Buffer.alloc(0), test.name + ': rejection stdout');
      }
      assert.equal(existsSync(artifact), false, test.name + ': rejected source emitted an ELF');
      record.diagnostic = test.diagnostic;
    } else {
      assert.equal(checked.status, 0, test.name + ': check: ' + checked.stderr);
      assert.equal(emitted.status, 0, test.name + ': build: ' + emitted.stderr);
      const linuxArtifact = linuxDirectory + '/' + test.name + '.elf';
      let executed;
      if (process.platform === 'win32') {
        const permission = command('wsl.exe', ['--exec', '/usr/bin/chmod', 'u+x', linuxArtifact]);
        assert.equal(permission.status, 0, permission.stderr.toString());
        executed = command('wsl.exe', ['--exec', '/usr/bin/timeout', '--signal=TERM', '--kill-after=1s', String(nativeLimitSeconds), linuxArtifact]);
      } else {
        chmodSync(artifact, 0o700);
        executed = command('/usr/bin/timeout', ['--signal=TERM', '--kill-after=1s', String(nativeLimitSeconds), artifact]);
      }
      output(test.name + '.native', executed);
      if (test.control) {
        assert.equal(executed.status, 0, test.name + ': mutated source must execute normally');
        assert.throws(() => verify(test, executed), error => error.code === 'ERR_ASSERTION' && error.message.includes('stdout bytes'), test.name + ': oracle accepted injected wrong behavior');
        record.control_outcome = 'output_oracle_rejected_mutated_source';
      } else verify(test, executed);
      Object.assign(record, { native_exit: executed.status, elf_sha256: hash(readFileSync(artifact)), stdout_sha256: hash(executed.stdout), stderr_sha256: hash(executed.stderr) });
    }
    record.result = 'passed';
    results.push(record);
    console.log('PASS ' + test.name);
  }
  const summary = { schema_version: 1, state: 'executed', source_commit: sourceHead, source_status: sourceStatus, source_diff_sha256: hash(sourceDiff), host: process.platform + '-' + process.arch, target: 'x86_64-unknown-linux-gnu', node: process.version, compiler_version: version.stdout.toString().trim(), compiler_sha256: hash(readFileSync(compiler)), harness_sha256: hash(readFileSync(fileURLToPath(import.meta.url))), fixture_index_sha256: hash(readFileSync(join(fixtureRoot, 'fixture-index.json'))), native_timeout_seconds: nativeLimitSeconds, overall_limit_ms: overallLimitMs, passed: results.length, not_run: 0, commands, results };
  writeFileSync(join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(`${results.length} actual function checks passed. Artifacts: ${portable(relative(root, directory))}`);
  console.log('Scope: bounded top-level function slice; no complete Python grammar, closures, full module system, FC1 or HATCH completion claim.');
}
