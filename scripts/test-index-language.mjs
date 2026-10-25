// Execute actual source indexing; Node scalar/byte oracles never invoke Python.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = resolve(root, 'tests/index-source');
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
const directory = mkdtempSync(resolve('target/index-language-'));
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
for (const entry of fixtures.native) for (const extension of entry.extensions) {
  runtime(entry.name + '-' + extension, fixture(entry.path), entry.stdout, { extension });
}
runtime('explicit-project-aliases', fixture('project/main.naja'), '𝄞\nTrue\n表\né\n', { project: true });
runtime('crlf-view-metamorphic', fixture('views.py').replaceAll('\n', '\r\n'), 'A𝄞é\n𝄞\n𝄞\n𝄞\n𝄞\n255\n0\n', { extension: 'py' });
runtime('comment-order-metamorphic', fixture('order.py').split('\n').map(line => line ? line + ' # %% [999] {# unused # }' : line).join('\n'), fixtures.native.find(test => test.name === 'order').stdout);

// Array.from iterates Unicode scalar values; UTF-16 code-unit indexing is not
// an oracle for the source Text contract. Signed bytes are never used here.
const textLiteral = value => JSON.stringify(value);
const byteLiteral = value => 'b"' + value.map(byte => '\\x' + byte.toString(16).padStart(2, '0')).join('') + '"';
const scalarTexts = [
  'A', 'é', '中', '𝄞', 'e\u0301', '\0', 'Aé中𝄞e\u0301\0', '\r\n',
  '\u007f\u0080\u07ff\u0800\ud7ff\ue000\uffff\u{10000}\u{10ffff}',
];
let scalarSource = '', scalarOutput = '';
for (const text of scalarTexts) {
  const scalars = Array.from(text);
  scalarSource += `sequence = ${textLiteral(text)}\n`;
  for (let index = 0; index < scalars.length; index++) {
    scalarSource += `print(sequence[${index}])\nprint(sequence[${index - scalars.length}])\n`;
    scalarOutput += scalars[index] + '\n' + scalars[index] + '\n';
  }
}
for (const extension of ['py', 'naja']) runtime('scalar-width-boundary-matrix-' + extension, scalarSource, scalarOutput, { extension });
const allBytes = Array.from({ length: 256 }, (_, index) => index);
let byteSource = 'sequence = ' + byteLiteral(allBytes) + '\n', byteOutput = '';
for (const [index, byte] of allBytes.entries()) {
  byteSource += `print(sequence[${index}])\nprint(sequence[${index - 256}])\n`;
  byteOutput += byte + '\n' + byte + '\n';
}
for (const extension of ['py', 'naja']) runtime('all-unsigned-bytes-' + extension, byteSource, byteOutput, { extension });
runtime('computed-zero-and-bool-indices', 'print("abc"[2 - 2])\nprint("abc"[False])\nprint("abc"[True])\nprint("abc"[-True])\nprint(b"\\x00\\xff"[False])\nprint(b"\\x00\\xff"[True])\nprint(b"\\x00\\xff"[-True])\n', 'a\na\nb\nc\n0\n255\n255\n');
runtime('empty-truthy-short-circuit-index', 'print(("" or "é")[0])\nprint((b"" or b"\\xff")[0])\nprint((None or "x")[0])\nprint(("abc" and "𝄞")[-1])\n', 'é\n255\nx\n𝄞\n');
runtime('local-index-and-returned-view', 'def first(value):\n    return value[0]\ndef twice(value):\n    return first(value)[-1]\nindex = 0\nwhile index < 4:\n    print(twice("é𝄞"))\n    index = index + 1\n', 'é\né\né\né\n');

const typeFailure = { exit: 105, stderr: 'NJA205: native value type mismatch\n' };
const boundsFailure = { exit: 107, stderr: 'NJA207: sequence index out of range\n' };
const zeroFailure = { exit: 106, stderr: 'NJA206: integer division by zero\n' };
for (const [name, sequence] of [['integer', '7'], ['negative-integer', '-1'], ['true', 'True'], ['false', 'False'], ['none', 'None']]) {
  runtime('wrong-sequence-' + name, `print((${sequence})[0])\n`, '', typeFailure);
}
for (const [name, index] of [['text', '"0"'], ['bytes', 'b"0"'], ['none', 'None']]) {
  for (const [kind, sequence] of [['text', '"abc"'], ['bytes', 'b"abc"']]) runtime('wrong-' + kind + '-index-' + name, `print(${sequence}[${index}])\n`, '', typeFailure);
}
for (const [name, sequence, index] of [
  ['empty-text', '""', '0'], ['empty-bytes', 'b""', 'False'],
  ['empty-text-true', '""', 'True'], ['empty-bytes-negative', 'b""', '-1'],
  ['text-at-length', '"é𝄞"', '2'], ['bytes-at-length', 'b"ab"', '2'],
  ['text-below-negative-length', '"é𝄞"', '-3'], ['bytes-below-negative-length', 'b"ab"', '-3'],
]) runtime('bounds-' + name, `print(${sequence}[${index}])\n`, '', boundsFailure);
const hugeIndices = [2n ** 63n, 2n ** 64n - 1n, 2n ** 64n, -(2n ** 64n), 10n ** 100n + 1n, -(10n ** 100n) - 1n];
for (const [number, index] of hugeIndices.entries()) for (const [kind, sequence] of [['text', '"abc"'], ['bytes', 'b"abc"']]) {
  runtime('huge-exact-index-' + kind + '-' + number, `print(${sequence}[(${index})])\n`, '', boundsFailure);
}
const marker = 'def mark(label, value):\n    print(label)\n    return value\n';
runtime('sequence-before-index-type-guards', marker + 'print(mark("sequence", 1)[mark("index", 0)])\n', 'sequence\nindex\n', typeFailure);
runtime('index-error-before-sequence-type-guard', 'print(1[7 // 0])\n', '', zeroFailure);
runtime('sequence-error-before-index-evaluation', marker + 'print(len(1)[mark("unreachable index", 0)])\n', '', typeFailure);
runtime('first-index-error-before-chained-index', marker + 'print("x"[1][mark("unreachable chained index", 0)])\n', '', boundsFailure);
runtime('index-kind-before-empty-bounds', 'print(""["0"])\n', '', typeFailure);
runtime('wrong-sequence-before-huge-bounds', 'print(None[' + (10n ** 100n) + '])\n', '', typeFailure);
runtime('computed-zero-index-division', 'print("abc"[1 // (2 - 2)])\n', '', zeroFailure);
runtime('computed-index-type-error', 'print("abc"["a" + "b"])\n', '', typeFailure);
runtime('valid-byte-then-wrong-chained-sequence', 'print(b"\\xff"[0][0])\n', '', typeFailure);
runtime('function-return-bounds-error', 'def view(value, index):\n    return value[index]\nprint(view("é", 1))\n', '', boundsFailure);

const postfixSource = count => 'print("x"' + '[0]'.repeat(count) + ')\n';
for (const extension of ['py', 'naja']) {
  runtime('postfix-127-' + extension, postfixSource(127), 'x\n', { extension });
  reject('postfix-128-' + extension, postfixSource(128), 'expression tree depth exceeds 128', { extension });
}
for (const [name, expression, diagnostic] of [
  ['empty-index', '"é"[]', ':2:11: NJA101:'],
  ['full-slice', '"abc"[:]', 'NJA101:'],
  ['slice-with-end', '"abc"[0:1]', 'slices and multidimensional indices'],
  ['slice-with-start', '"abc"[1:]', 'slices and multidimensional indices'],
  ['slice-step', '"abc"[0:2:1]', 'slices and multidimensional indices'],
  ['slice-original-span', '"é"[0:1]', ':2:12: NJA101:'],
  ['multidimensional', '"abc"[0, 1]', 'slices and multidimensional indices'],
  ['trailing-comma-index', '"abc"[0,]', 'slices and multidimensional indices'],
  ['unclosed-index', '"abc"[0', 'F0003:'],
  ['unknown-unicode-index', '"é"[未定義]', ':2:11: NJA101:'],
]) reject(name, '# café\nprint(' + expression + ')\n', diagnostic);
runtime('immutable-index-assignment-type-guard', 'sequence = "abc"\nsequence[0] = "x"\n', '', typeFailure);
reject('float-index-unsupported', 'print("abc"[1.0])\n', 'NJA101:');
runtime('index-list-type-guard', 'print("abc"[[0]])\n', '', typeFailure);
runtime('index-tuple-type-guard', 'print("abc"[(0, 1)])\n', '', typeFailure);
reject('aliases-no-ambient-activation', fixture('project/main.naja'), 'NJA101:');
cases.push({ ...cases.find(test => test.name === 'scalars-py'), name: 'wrong-scalar-index-control', source: fixture('scalars.py').replace('print(text[1])', 'print(text[2])'), control: true });
cases.push({ ...cases.find(test => test.name === 'precedence-py'), name: 'wrong-byte-index-control', source: fixture('precedence.py').replace('print(-b"\\x03\\x04"[1])', 'print(-b"\\x03\\x04"[0])'), control: true });
assert.equal(new Set(cases.map(test => test.name)).size, cases.length, 'unique case names');

function command(executable, args, options = {}) {
  const { timeout = 20_000, ...rest } = options;
  const remaining = overallLimitMs - (Date.now() - started);
  assert.ok(remaining > 0, 'overall index suite deadline exceeded');
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
  console.log(`${results.length} actual index checks passed. Artifacts: ${portable(relative(root, directory))}`);
  console.log('Scope: bounded Text/Bytes indexing source slice; no slices, general containers, complete Python grammar, FC1 or HATCH completion claim.');
}
