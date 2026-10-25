// Actual mutable list source checks; independent Node models, no Python oracle.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = resolve(root, 'tests/lists-source');
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
const directory = mkdtempSync(resolve('target/lists-language-'));
const compiler = resolve('target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
const results = [];
const commands = [];
let activeCase = null;
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
for (const entry of fixtures.native) for (const extension of entry.extensions) runtime(entry.name + '-' + extension, fixture(entry.path), entry.stdout, { extension });
runtime('project-aliases-and-nfkc', fixture('project/main.naja'), 'κόσμος\n2\nTrue\n表示 equalTo 長さ\n', { project: true });
runtime('crlf-alias-metamorphic', fixture('aliases.py').replaceAll('\n', '\r\n'), fixtures.native.find(test => test.name === 'aliases').stdout, { extension: 'py' });
runtime('comment-order-metamorphic', fixture('order.py').split('\n').map(line => line ? line + ' # %% [999] {# unused # }' : line).join('\n'), fixtures.native.find(test => test.name === 'order').stdout);

// This independent model shares JS arrays for aliases and chooses scalar
// values directly. It never consumes compiler IR, addresses or a Python oracle.
const scalars = [
  { source: 'None', display: 'None' }, { source: 'False', display: 'False' }, { source: 'True', display: 'True' },
  ...[0n, -1n, 10n ** 100n + 7n].map(value => ({ source: '(' + value + ')', display: String(value) })),
  { source: '"é𝄞"', display: 'é𝄞' }, { source: 'b"\\x00\\xff"', display: "b'\\x00\\xff'" },
];
const list = values => '[' + values.map(value => value.source).join(', ') + (values.length ? ',' : '') + ']';
const vector = Array.from({ length: 128 }, (_, index) => ({ source: String(index), display: String(index) }));
const alias = vector;
let vectorSource = 'values = ' + list(vector) + '\nalias = values\n', vectorOutput = '';
for (let step = 0; step < 256; step++) {
  const index = (step * 37 + 11) % 128;
  const value = scalars[(step * 3 + 1) % scalars.length];
  alias[index] = value;
  vectorSource += `alias[${step % 2 ? index - 128 : index}] = ${value.source}\n`;
  if (step % 17 === 0) { vectorSource += `print(values[${index}])\n`; vectorOutput += vector[index].display + '\n'; }
}
for (let index = 0; index < 128; index++) {
  vectorSource += `print(values[${index}])\nprint(alias[${index - 128}])\n`;
  vectorOutput += vector[index].display + '\n' + vector[index].display + '\n';
}
for (const extension of ['py', 'naja']) runtime('independent-mutating-vector-' + extension, vectorSource, vectorOutput, { extension });
runtime('bool-computed-and-negative-stores', 'values = [0, 1, 2]\nvalues[False] = True\nvalues[True] = False\nvalues[-True] = None\nprint(values[2 - 2])\nprint(values[True])\nprint(values[-1])\nprint(len(values))\n', 'True\nFalse\nNone\n3\n');
runtime('repeated-alias-arguments', 'def change(first, second):\n    first[0] = 7\n    print(second[0])\n    second[0] = True\n    return first\nvalues = [None]\nprint(change(values, values)[0])\n', '7\nTrue\n');
runtime('recursive-parameter-mutation', 'def change(values, depth):\n    if depth == 0:\n        values[0] = "leaf"\n        return values\n    return change(values, depth - 1)\nvalues = [None]\nprint(change(values, 5)[0])\nprint(values[0])\n', 'leaf\nleaf\n');
runtime('tuple-retains-mutable-list-child', 'values = [0]\nholder = (values,)\nholder[0][0] = True\nprint(values[0])\n', 'True\n');
runtime('index-effect-before-final-store', 'def index(values):\n    values[0] = 99\n    return 0\nvalues = [1]\nvalues[index(values)] = 7\nprint(values[0])\n', '7\n');
runtime('python-informational-int-annotation', 'value: int = [0]\nvalue[0] = "kept"\nprint(value[0])\n', 'kept\n', { extension: 'py' });
const elementsSource = count => 'values = [' + Array.from({ length: count }, (_, index) => index).join(', ') + ',]\nprint(len(values))\nindex = 0\nwhile index < ' + count + ':\n    assert values[index] == index\n    values[index] = True\n    assert values[index - ' + count + '] == True\n    index = index + 1\nprint(values[-1])\n';
const depthSource = count => 'value = ' + '['.repeat(count) + '"x"' + ']'.repeat(count) + '\nindex = 0\nwhile index < ' + count + ':\n    value = value[0]\n    index = index + 1\nprint(value)\n';
for (const extension of ['py', 'naja']) {
  runtime('elements-128-' + extension, elementsSource(128), '128\nTrue\n', { extension });
  reject('elements-129-' + extension, elementsSource(129), 'list element limit of 128', { extension });
  runtime('list-ir-height-128-' + extension, depthSource(127), 'x\n', { extension });
  reject('list-ir-height-129-' + extension, depthSource(128), 'NJA101:', { extension });
}
// The resource prefix is preregistered in tests/lists/CONTRACT.md. No loop
// arithmetic allocations obscure the stores: 100 calls with 20 operations
// each reuse existing descriptors without exceeding the source parser budget.
// The allocation control uses the same call counts to create 2000 lists.
const arenaPrefix = 'payload = "' + 'x'.repeat(524288) + '"\nsmall = "' + 'y'.repeat(65536) + '"\nvalues = [None]\n' + 'discard = payload + ""\n'.repeat(127) + 'discard = small + ""\n'.repeat(7);
runtime('near-arena-stores-reuse-descriptors', 'def store(values, payload):\n' + '    values[0] = payload\n'.repeat(20) + arenaPrefix + 'store(values, payload)\n'.repeat(100) + 'print(len(values[0]))\n', '524288\n');
runtime('near-arena-allocation-control', 'def allocate(payload):\n' + '    [payload]\n'.repeat(20) + arenaPrefix + 'allocate(payload)\n'.repeat(100) + 'print("unreachable")\n', '', { exit: 103, stderr: 'NJA203: native value arena exhausted\n' });

const typeFailure = { exit: 105, stderr: 'NJA205: native value type mismatch\n' };
// Generic member syntax is accepted; list methods still fail the receiver guard.
// The original source was independently executed before migrating this baseline.
runtime('append-method-receiver-guard', 'value = []\nvalue.append(1)\n', '', typeFailure);
const boundsFailure = { exit: 107, stderr: 'NJA207: sequence index out of range\n' };
const zeroFailure = { exit: 106, stderr: 'NJA206: integer division by zero\n' };
for (const [name, source] of [
  ['empty', 'print([])\n'], ['single', 'print([1])\n'], ['nested', 'print([[1]])\n'],
  ['cyclic', 'value = [None]\nvalue[0] = value\nprint(value)\n'],
  ['naja-int-annotation', 'value: int = [1]\nprint(999)\n'],
]) runtime('list-print-or-kind-guard-' + name, source, '', typeFailure);
for (const [number, operator] of ['==', '!=', '<', '<=', '>', '>='].entries()) for (const [kind, source] of [
  ['same', `value = [1]\nprint(value ${operator} value)\n`], ['empty', `print([] ${operator} [])\n`], ['distinct', `print([1] ${operator} [1])\n`],
]) runtime('list-comparison-' + number + '-' + kind, source, '', typeFailure);
for (const [number, other] of ['None', 'True', '0', '"x"', 'b"x"', '()'].entries()) for (const [side, left, right] of [['left', '[1]', other], ['right', other, '[1]']]) for (const [operation, operator] of ['==', '!='].entries()) runtime('list-mixed-equality-' + number + '-' + side + '-' + operation, `print(${left} ${operator} ${right})\n`, '', typeFailure);
for (const [number, operator] of ['+', '-', '*', '//', '%'].entries()) for (const [kind, left, right] of [['both', '[1]', '[2]'], ['left', '[1]', '1'], ['right', '1', '[1]']]) runtime('list-arithmetic-' + number + '-' + kind, `print(${left} ${operator} ${right})\n`, '', typeFailure);
for (const [name, expression] of [['positive', '+[1]'], ['negative', '-[1]'], ['zero-repetition', '[1] * 0'], ['text-concatenation', '[1] + "x"'], ['bytes-concatenation', 'b"x" + [1]']]) runtime('list-arithmetic-' + name, 'print(' + expression + ')\n', '', typeFailure);
for (const [name, target] of [['tuple', '(1,)'], ['text', '"a"'], ['bytes', 'b"a"'], ['int', '7'], ['bool', 'True'], ['none', 'None']]) runtime('immutable-or-wrong-store-' + name, `value = ${target}\nvalue[0] = 9\n`, '', typeFailure);
for (const [name, index] of [['text', '"0"'], ['bytes', 'b"0"'], ['none', 'None'], ['tuple', '()'], ['list', '[]']]) {
  runtime('wrong-index-read-' + name, 'print([1][' + index + '])\n', '', typeFailure);
  runtime('wrong-index-store-' + name, 'value = [1]\nvalue[' + index + '] = 7\n', '', typeFailure);
}
for (const [name, value, index] of [['empty', '[]', '0'], ['empty-false', '[]', 'False'], ['empty-negative', '[]', '-1'], ['at-length', '[1, 2]', '2'], ['below-negative-length', '[1, 2]', '-3']]) for (const operation of ['read', 'store']) runtime('bounds-' + name + '-' + operation, 'value = ' + value + '\n' + (operation === 'read' ? 'print(value[' + index + '])' : 'value[' + index + '] = 9') + '\n', '', boundsFailure);
for (const [number, index] of [2n ** 63n, 2n ** 64n - 1n, 2n ** 64n, -(2n ** 64n), 10n ** 100n, -(10n ** 100n)].entries()) for (const operation of ['read', 'store']) runtime('huge-exact-index-' + number + '-' + operation, 'value = [1, 2]\n' + (operation === 'read' ? 'print(value[(' + index + ')])' : 'value[(' + index + ')] = 9') + '\n', '', boundsFailure);
const mark = 'def mark(label, value):\n    print(label)\n    return value\n';
runtime('value-error-before-target-effects', mark + 'mark("unreachable sequence", [0])[mark("unreachable index", 0)] = len(1)\n', '', typeFailure);
runtime('sequence-error-before-index-effects', mark + 'len(1)[mark("unreachable index", 0)] = mark("value", 7)\n', 'value\n', typeFailure);
runtime('all-effects-before-target-kind-guard', mark + 'mark("sequence", (1,))[mark("index", 0)] = mark("value", 7)\n', 'value\nsequence\nindex\n', typeFailure);
runtime('index-error-before-target-kind-guard', 'value = (1,)\nvalue[1 // 0] = 9\n', '', zeroFailure);
runtime('index-kind-before-empty-bounds', 'value = []\nvalue["0"] = 9\n', '', typeFailure);
runtime('value-zero-before-immutable-target', 'value = (1,)\nvalue[0] = 1 // 0\n', '', zeroFailure);
runtime('nested-read-bounds-before-final-index', mark + 'values = [[]]\nvalues[0][0][mark("unreachable index", 0)] = mark("value", 9)\n', 'value\n', boundsFailure);
runtime('child-error-stops-later-child', mark + 'value = [mark("first", 1), len(1), mark("unreachable", 3)]\n', 'first\n', typeFailure);
runtime('discarded-expression-still-errors', '1 // 0\nprint("unreachable")\n', '', zeroFailure);
runtime('list-comparison-right-error-order', 'print([1] == 1 // 0)\n', '', zeroFailure);
runtime('list-false-assertion', 'assert []\n', '', { exit: 104, stderr: 'NJA204: assertion failed\n' });

for (const [name, source, diagnostic] of [
  ['resize', 'value = [1]\ndel value[0]\n', 'NJA101:'],
  ['slice-read', 'print([1, 2][0:1])\n', 'slices and multidimensional indices'], ['slice-store', 'value = [1]\nvalue[:] = []\n', 'NJA101:'],
  ['augmented-store', 'value = [1]\nvalue[0] += 1\n', 'NJA101:'], ['unpacking', 'a, b = [1, 2]\n', 'NJA101:'],
  ['comprehension', 'value = [x for x in [1]]\n', 'NJA101:'], ['iteration', 'for value in [1]:\n    print(value)\n', 'NJA101:'],
  ['list-constructor', 'print(list())\n', 'NJA101:'], ['starred-element', 'value = [*[1]]\n', 'NJA101:'],
  ['empty-index', 'print([1][])\n', 'NJA101:'], ['multidimensional', 'print([1][0, 0])\n', 'slices and multidimensional indices'],
  ['non-index-target', '[1] = [2]\n', 'NJA101:'], ['chained-assignment', 'a = b = [1]\n', 'NJA101:'],
  ['unknown-original-span', '# café\nvalues = ["é", 未定義]\n', ':2:16: NJA101:'],
  ['unknown-store-index-span', '# café\nvalues = [0]\nvalues[未定義] = "é"\n', ':3:8: NJA101:'],
]) reject(name, source, diagnostic);
reject('aliases-no-ambient-activation', fixture('project/main.naja'), 'NJA101:');
cases.push({ ...cases.find(test => test.name === 'aliases-py'), name: 'disabled-store-source-control', source: fixture('aliases.py').replace('child[-1] = True', 'True'), control: true });
cases.push({ ...cases.find(test => test.name === 'order-py'), name: 'wrong-effect-source-control', source: fixture('order.py').replace('mark("value", 7)', 'mark("injected value", 7)'), control: true });
assert.equal(new Set(cases.map(test => test.name)).size, cases.length, 'unique case names');

function command(executable, args, options = {}) {
  const { timeout = 20_000, ...rest } = options;
  const remaining = overallLimitMs - (Date.now() - started);
  assert.ok(remaining > 0, 'overall list suite deadline exceeded');
  const commandStarted = Date.now();
  const result = spawnSync(executable, args, { cwd: root, maxBuffer: 8 * 1024 * 1024, ...rest, timeout: Math.min(timeout, remaining), encoding: null });
  output('command-' + commands.length, result);
  commands.push({ executable, arguments: args, exit: result.status, signal: result.signal, error: result.error?.code ?? null, elapsed_ms: Date.now() - commandStarted, stdout_sha256: hash(result.stdout ?? Buffer.alloc(0)), stderr_sha256: hash(result.stderr ?? Buffer.alloc(0)) });
  assert.ifError(result.error);
  assert.equal(result.signal, null, 'unexpected child signal');
  return result;
}
function output(name, result) {
  writeFileSync(join(directory, name + '.stdout'), result.stdout ?? Buffer.alloc(0));
  writeFileSync(join(directory, name + '.stderr'), result.stderr ?? Buffer.alloc(0));
}
const identity = test => ({ name: test.name, source_bytes: Buffer.byteLength(test.source), source_sha256: hash(test.source), extension: test.extension, project: test.project ?? false, expectation: test.reject ? 'compile_rejection' : test.control ? 'output_oracle_rejects_mutated_source' : 'native_execution', expected_exit: test.reject ? 1 : test.exit, expected_diagnostic: test.diagnostic ?? null, expected_stdout_sha256: test.reject ? null : hash(test.stdout), expected_stderr_sha256: test.reject ? null : hash(test.stderr) });
const sourceHead = command('git', ['rev-parse', 'HEAD']).stdout.toString().trim();
if (expectedSource !== null) assert.equal(sourceHead, expectedSource, 'source commit mismatch');
const sourceStatus = command('git', ['status', '--short']).stdout.toString();
const sourceDiff = command('git', ['diff', '--binary', 'HEAD']).stdout;
writeFileSync(join(directory, 'plan.json'), JSON.stringify({ schema_version: 1, source_commit: sourceHead, fixture_index_sha256: hash(readFileSync(join(fixtureRoot, 'fixture-index.json'))), cases: cases.map(identity) }, null, 2) + '\n');
process.on('uncaughtExceptionMonitor', error => {
  const completed = new Set(results.map(result => result.name));
  const pending = cases.filter(test => !completed.has(test.name)).map(test => ({ ...identity(test), result: test === activeCase ? 'failed' : 'not_run' }));
  try { writeFileSync(join(directory, 'failure.json'), JSON.stringify({ schema_version: 1, state: 'failed', source_commit: sourceHead, results: [...results, ...pending], commands, error: { name: error.name, message: error.message } }, null, 2) + '\n'); }
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
    activeCase = test;
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
    activeCase = null;
    console.log('PASS ' + test.name);
  }
  const summary = { schema_version: 1, state: 'executed', source_commit: sourceHead, source_status: sourceStatus, source_diff_sha256: hash(sourceDiff), host: process.platform + '-' + process.arch, target: 'x86_64-unknown-linux-gnu', node: process.version, compiler_version: version.stdout.toString().trim(), compiler_sha256: hash(readFileSync(compiler)), harness_sha256: hash(readFileSync(fileURLToPath(import.meta.url))), fixture_index_sha256: hash(readFileSync(join(fixtureRoot, 'fixture-index.json'))), native_timeout_seconds: nativeLimitSeconds, overall_limit_ms: overallLimitMs, passed: results.length, not_run: 0, commands, results };
  writeFileSync(join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(`${results.length} actual list checks passed. Artifacts: ${portable(relative(root, directory))}`);
  console.log('Scope: bounded fixed-count mutable lists; display/comparison/arithmetic, resizing, general containers, complete Python grammar, FC1 and HATCH remain unsupported.');
}
