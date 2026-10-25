// Actual source/native checks; expectations are specification-derived, never Python execution.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync,
  symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
mkdirSync(resolve('target'), { recursive: true });
const directory = mkdtempSync(resolve('target/values-language-'));
const compiler = resolve('target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
const started = Date.now();
const overallLimitMs = 180_000;
const nativeLimitSeconds = '5';
const results = [];
const hash = value => createHash('sha256').update(value).digest('hex');
const fixture = name => readFileSync(new URL('../tests/values/' + name, import.meta.url), 'utf8');
const bytes = value => Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
const runnerOptions = process.platform === 'win32' ? ['--runner', 'wsl'] : [];
process.on('uncaughtExceptionMonitor', error => {
  // Retain partial results without replacing Node's failing exit or stack trace.
  try {
    writeFileSync(join(directory, 'failure.json'), JSON.stringify({
      schema_version: 1, state: 'failed', completed_results: results,
      error: { name: error.name, message: error.message },
    }, null, 2) + '\n');
  } catch { /* The original failure remains authoritative if evidence storage fails. */ }
});

function command(executable, args, options = {}) {
  const { timeout = 20_000, ...otherOptions } = options;
  const remaining = overallLimitMs - (Date.now() - started);
  assert.ok(remaining > 0, 'overall source/native suite deadline exceeded');
  const result = spawnSync(executable, args, {
    cwd: root, maxBuffer: 8 * 1024 * 1024, ...otherOptions,
    timeout: Math.min(timeout, remaining), encoding: null,
  });
  assert.ifError(result.error);
  return result;
}

const built = command('cargo', ['build', '--workspace', '--locked', '--offline'], { timeout: 30_000 });
assert.equal(built.status, 0, built.stderr.toString());
let linuxDirectory = directory;
if (process.platform === 'win32') {
  const platform = command('wsl.exe', ['--exec', '/usr/bin/uname', '-sm']);
  assert.equal(platform.status, 0, platform.stderr.toString());
  assert.equal(platform.stdout.toString().trim(), 'Linux x86_64');
  const translated = command('wsl.exe', ['--exec', '/usr/bin/wslpath', '-a', directory.replaceAll('\\', '/')]);
  assert.equal(translated.status, 0, translated.stderr.toString());
  linuxDirectory = translated.stdout.toString().trim();
} else {
  assert.equal(process.platform, 'linux');
  assert.equal(process.arch, 'x64');
}

function record(result) {
  results.push(result);
  console.log(`${result.result.toUpperCase()} ${result.name}${result.native_exit === undefined ? '' : ' exit=' + result.native_exit}`);
}

function emit(name, source, { extension = 'naja', projectRoot = null, input = null, cwd = root } = {}) {
  input ??= join(directory, name + '.' + extension);
  const sourcePath = resolve(cwd, input);
  if (!existsSync(sourcePath)) writeFileSync(sourcePath, source);
  else assert.equal(readFileSync(sourcePath, 'utf8'), source, 'fixture source differs from requested source');
  const output = join(directory, name + '.elf');
  const project = projectRoot === null ? [] : ['--project-root', projectRoot];
  const checked = command(compiler, ['check', input, ...project], { cwd });
  assert.equal(checked.status, 0, name + ': check: ' + checked.stderr);
  const compiled = command(compiler, ['build', input, '--target', 'x86_64-unknown-linux-gnu', '--output', output, ...project], { cwd });
  assert.equal(compiled.status, 0, name + ': build: ' + compiled.stderr);
  const owner = projectRoot === null ? null : resolve(cwd, projectRoot);
  const aliasPath = owner === null ? null : join(owner, 'naja.alias');
  return { input: sourcePath, output, linux: linuxDirectory + '/' + name + '.elf', source,
    project_root: owner === null ? null : relative(root, owner).replaceAll('\\', '/'),
    alias_sha256: aliasPath !== null && existsSync(aliasPath) ? hash(readFileSync(aliasPath)) : null,
  };
}

function execute(artifact) {
  if (process.platform === 'win32') {
    const permission = command('wsl.exe', ['--exec', '/usr/bin/chmod', 'u+x', artifact.linux]);
    assert.equal(permission.status, 0, permission.stderr.toString());
    return command('wsl.exe', ['--exec', '/usr/bin/timeout', '--signal=TERM', '--kill-after=1s', nativeLimitSeconds, artifact.linux]);
  }
  chmodSync(artifact.output, 0o700);
  return command('/usr/bin/timeout', ['--signal=TERM', '--kill-after=1s', nativeLimitSeconds, artifact.output]);
}

function run(name, source, stdout, { exit = 0, stderr = '', ...options } = {}) {
  const artifact = emit(name, source, options);
  const result = execute(artifact);
  assert.equal(result.status, exit, name + ': native stderr: ' + result.stderr);
  assert.deepEqual(result.stdout, bytes(stdout), name + ': stdout bytes');
  assert.deepEqual(result.stderr, bytes(stderr), name + ': stderr bytes');
  writeFileSync(join(directory, name + '.stdout'), result.stdout);
  writeFileSync(join(directory, name + '.stderr'), result.stderr);
  record({ name, result: 'passed', native_exit: result.status,
    source: relative(root, artifact.input).replaceAll('\\', '/'), source_sha256: hash(source),
    project_root: artifact.project_root, alias_sha256: artifact.alias_sha256,
    elf_sha256: hash(readFileSync(artifact.output)), stdout_sha256: hash(result.stdout), stderr_sha256: hash(result.stderr) });
  return { artifact, result };
}

function reject(name, source, { code = /NJA1\d\d|F\d{4}/, extension = 'naja', projectRoot = null, input = null, cwd = root } = {}) {
  input ??= join(directory, name + '.' + extension);
  const sourcePath = resolve(cwd, input);
  if (!existsSync(sourcePath)) writeFileSync(sourcePath, source);
  else assert.equal(readFileSync(sourcePath, 'utf8'), source, 'rejection fixture differs from requested source');
  const output = join(directory, name + '.rejected.elf');
  const project = projectRoot === null ? [] : ['--project-root', projectRoot];
  const result = command(compiler, ['build', input, '--target', 'x86_64-unknown-linux-gnu', '--output', output, ...project], { cwd });
  assert.equal(result.status, 1, name + ': expected compile/project rejection');
  assert.match(result.stderr.toString(), code, name + ': diagnostic');
  assert.equal(existsSync(output), false, name + ': rejected source created output');
  record({ name, result: 'passed', compile_exit: result.status, source_sha256: hash(source) });
}

function bytesRepr(value) {
  const quote = value.includes(39) && !value.includes(34) ? '"' : "'";
  let output = 'b' + quote;
  for (const byte of value) {
    const character = String.fromCharCode(byte);
    if (character === quote || byte === 92) output += '\\' + character;
    else if (byte === 9) output += '\\t';
    else if (byte === 10) output += '\\n';
    else if (byte === 13) output += '\\r';
    else if (byte < 32 || byte >= 127) output += '\\x' + byte.toString(16).padStart(2, '0');
    else output += character;
  }
  return output + quote;
}

const textLiteral = value => JSON.stringify(value);
const bytesLiteral = value => 'b"' + [...value].map(byte => '\\x' + byte.toString(16).padStart(2, '0')).join('') + '"';
const truth = value => value.kind === 'none' ? false : value.kind === 'int' ? value.value !== 0n :
  value.kind === 'bool' ? value.value : value.value.length !== 0;
const numeric = value => value.kind === 'int' ? value.value : value.value ? 1n : 0n;
const isNumeric = value => value.kind === 'int' || value.kind === 'bool';
const display = value => value.kind === 'none' ? 'None' : value.kind === 'bool' ? value.value ? 'True' : 'False' :
  value.kind === 'bytes' ? bytesRepr(value.value) : value.value.toString();
function sequenceCompare(left, right) {
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return Math.sign(left.length - right.length);
}
function compare(left, right) {
  if (isNumeric(left) && isNumeric(right)) return numeric(left) < numeric(right) ? -1 : numeric(left) > numeric(right) ? 1 : 0;
  if (left.kind !== right.kind) return null;
  if (left.kind === 'none') return 0;
  return sequenceCompare(left.kind === 'text' ? [...left.value].map(char => char.codePointAt(0)) : left.value,
    right.kind === 'text' ? [...right.value].map(char => char.codePointAt(0)) : right.value);
}

run('literal-values', fixture('literals.naja'),
  "Hello,\nNAJA\0\né𝄞e\u0301\nb'A\\x00\\xff\\n'\nTrue\nFalse\nNone\n4\n2\n0\n0\n\\n equalTo display length\n");
run('literal-values-python', fixture('literals.naja'),
  "Hello,\nNAJA\0\né𝄞e\u0301\nb'A\\x00\\xff\\n'\nTrue\nFalse\nNone\n4\n2\n0\n0\n\\n equalTo display length\n", { extension: 'py' });
run('truthy-control', fixture('control.naja'), 'text\nbytes\nnone is false\nempty bytes are false\n6\ntext loop\ncontrol complete\n');
run('boolean-precedence-and-operands', fixture('boolean-operators.naja'),
  "fallback\nright\n17\n0\ntruth\nFalse\nTrue\nFalse\nfallback\n3\n5\nFalse\nb'kept'\nNone\nNone\n");
run('naja-int-annotation', fixture('int-annotations.naja'), '12345678901234567890123456789012345678901234567890\nTrue\n2\nFalse\n0\n-1\n');
run('python-informational-annotation', fixture('informational-annotations.py'), "annotation is informational\nNone\nb'bytes'\n", { extension: 'py' });
run('comparison-chains', fixture('comparison-chains.naja'), 'True\nTrue\nTrue\nFalse\nTrue\nTrue\nTrue\nchain operand\n');

const values = [
  ...[0n, 1n, -1n, 10n ** 70n].map(value => ({ kind: 'int', value, source: '(' + value + ')' })),
  ...[false, true].map(value => ({ kind: 'bool', value, source: value ? 'True' : 'False' })),
  { kind: 'none', value: null, source: 'None' },
  ...['', '0', 'a', 'é𝄞', 'e\u0301', '\ue000', '\u{10000}', '\0'].map(value => ({ kind: 'text', value, source: textLiteral(value) })),
  ...[[], [0], [255], [97, 0]].map(value => ({ kind: 'bytes', value, source: bytesLiteral(value) })),
];
let source = '', expected = '';
for (const left of values) for (const right of values) {
  const order = compare(left, right);
  for (const operator of ['==', '!=']) {
    const answer = order === 0;
    source += `print(${left.source} ${operator} ${right.source})\n`;
    expected += (operator === '==' ? answer : !answer) ? 'True\n' : 'False\n';
  }
}
run('equality-cross-kinds', source, expected);
source = ''; expected = '';
for (const left of values) for (const right of values) {
  if (!(isNumeric(left) && isNumeric(right)) && (left.kind !== right.kind || left.kind === 'none')) continue;
  const order = compare(left, right);
  for (const [operator, answer] of [['<', order < 0], ['<=', order <= 0], ['>', order > 0], ['>=', order >= 0]]) {
    source += `print(${left.source} ${operator} ${right.source})\n`;
    expected += answer ? 'True\n' : 'False\n';
  }
}
run('ordered-value-comparisons', source, expected);
source = ''; expected = '';
for (const left of values) for (const right of values) {
  source += `print(${left.source} and ${right.source})\nprint(${left.source} or ${right.source})\n`;
  expected += display(truth(left) ? right : left) + '\n' + display(truth(left) ? left : right) + '\n';
}
for (const value of values) { source += `print(not ${value.source})\n`; expected += truth(value) ? 'False\n' : 'True\n'; }
run('truth-and-returned-operand-matrix', source, expected);

source = ''; expected = '';
for (const left of values.filter(isNumeric)) {
  source += `print(+${left.source})\nprint(-${left.source})\n`;
  expected += numeric(left) + '\n' + -numeric(left) + '\n';
  for (const right of values.filter(isNumeric)) for (const operator of ['+', '-', '*']) {
    source += `print(${left.source} ${operator} ${right.source})\n`;
    expected += (operator === '+' ? numeric(left) + numeric(right) : operator === '-' ? numeric(left) - numeric(right) : numeric(left) * numeric(right)) + '\n';
  }
}
run('numeric-bool-arithmetic', source, expected);
// BigInt truncates toward zero; explicitly derive floor division and its
// divisor-signed remainder. No Python implementation is used as an oracle.
const floorDivrem = (a, b) => {
  let q = a / b, r = a % b;
  if (r !== 0n && (a < 0n) !== (b < 0n)) { q -= 1n; r += b; }
  assert.equal(a, q * b + r);
  assert.ok(r === 0n || (r < 0n) === (b < 0n));
  return [q, r];
};
const numerators = ['0', '1', '-1', '7', '-7', 'True', 'False', '999999999999999999999999999', '-1000000000000000000000000001'];
const divisors = ['1', '-1', '3', '-3', 'True', '1000000001', '-1000000001'];
for (const extension of ['naja', 'py']) {
  source = ''; expected = '';
  for (const a of numerators) for (const b of divisors) {
    const number = value => value === 'True' ? 1n : value === 'False' ? 0n : BigInt(value);
    const answers = floorDivrem(number(a), number(b));
    for (const [index, operator] of ['//', '%'].entries()) {
      source += `print(${a} ${operator} ${b})\n`;
      expected += answers[index] + '\n';
    }
  }
  run('signed-divrem-matrix-' + extension, source, expected, { extension });
}
const giant = BigInt('9'.repeat(1200)), large = BigInt('7'.repeat(120));
const [giantQ, giantR] = floorDivrem(-giant, large);
run('divrem-large-immutable-alias', `a = -${giant}\nb = ${large}\ncopy = a\nprint(a // b)\nprint(a % b)\nprint(a == copy)\nprint(a // a)\nprint(a % a)\nassert a == (a // b) * b + a % b\n`, `${giantQ}\n${giantR}\nTrue\n1\n0\n`);
run('divrem-precedence-associativity', 'print(20 // 3 // 2)\nprint(20 % 6 * 3)\nprint(20 * 3 // 4 % 7)\nprint(-7 // 3)\nprint(-7 % -3)\nprint(1 + 20 // 3 * 2)\nprint(7 // -3 == -3 and 7 % -3 == -2)\n', '3\n6\n1\n-3\n-1\n13\nTrue\n');
run('divrem-short-circuit', 'print(False and 1 // 0)\nprint(True or 1 % 0)\nprint(3 < 2 < 1 // 0)\n', 'False\nTrue\nFalse\n');
for (const [name, operator, zero] of [['floor-zero', '//', '0'], ['modulo-computed-zero', '%', '(7 - 7)'], ['floor-false', '//', 'False']]) {
  run(name, `print(17)\nprint(7 ${operator} ${zero})\nprint(999)\n`, '17\n', { exit: 106, stderr: 'NJA206: integer division by zero\n' });
}
run('divrem-left-error-order', 'print(len(1) // (1 // 0))\n', '', { exit: 105, stderr: 'NJA205: native value type mismatch\n' });
run('divrem-right-before-operand-guard', 'print("x" // (1 // 0))\n', '', { exit: 106, stderr: 'NJA206: integer division by zero\n' });
run('divrem-work-limit', `print(${ '1' + '0'.repeat(9000) } // ${ '1' + '0'.repeat(8991) })\n`, '', { exit: 103, stderr: 'NJA203: native division work limit exceeded\n' });
for (const operator of ['//', '%']) reject('divrem-fixed-domain-' + (operator === '//' ? 'floor' : 'modulo'), `from naja.core import i64\nprint(i64(7) ${operator} i64(3))\n`, { code: /NJA1\d\d/ });
const allBytes = Array.from({ length: 256 }, (_, index) => index);
source = [allBytes, [39], [34], [39, 34, 92], [9, 10, 13, 0, 127, 255]].map(value => 'print(' + bytesLiteral(value) + ')').join('\n') + '\n';
expected = [allBytes, [39], [34], [39, 34, 92], [9, 10, 13, 0, 127, 255]].map(bytesRepr).join('\n') + '\n';
run('all-byte-formatting', source, expected);
run('immutable-text-and-byte-aliases', 's = "é"\nt = s\ns = s + "𝄞"\nprint(t)\nprint(s)\nprint(len(s))\nb = b"a"\nc = b\nb = b + b"\\xff"\nprint(c)\nprint(b)\nprint(len(b))\n', "é\né𝄞\n2\nb'a'\nb'a\\xff'\n2\n");

const typeFailure = { exit: 105, stderr: 'NJA205: native value type mismatch\n' };
for (const [name, body] of [
  ['text-subtraction', 'print("text" - "other")'], ['mixed-concatenation', 'print(b"x" + "x")'],
  ['numeric-text-addition', 'print(True + "x")'], ['text-negation', 'print(-"x")'],
  ['text-positive', 'print(+"x")'], ['numeric-len', 'print(len(1))'], ['bool-len', 'print(len(True))'],
  ['text-floor-division', 'print("7" // 3)'], ['bytes-modulo', 'print(b"7" % 3)'],
  ['none-ordering', 'print(None < None)'], ['unrelated-ordering', 'print("x" < 1)'],
  ['byte-text-ordering', 'print(b"x" < "x")'], ['runtime-text-repetition', 's = "nonnumeric"\nprint(s * 2)'],
  ['byte-repetition', 's = b"x"\nprint(s * 2)'], ['chain-live-type-error', 'print(3 > 2 < len(1))'],
  ['and-live-type-error', 'print(True and len(1))'], ['or-live-type-error', 'print(False or len(1))'],
  ['annotation-initial-guard', 'x: int = "bad"\nprint(999)'],
  ['annotation-reassignment-guard', 'x: int = 0\nx = "bad"\nprint(999)'],
  ['annotation-none-guard', 'x: int = None\nprint(999)'],
  ['tuple-display-guard', 'print((1, 2))'],
  ['list-display-guard', 'print([1, 2])'],
]) run(name, body + '\n', '', typeFailure);
for (const [index, value] of ['False', 'None', '0', '""', 'b""'].entries()) {
  run('false-truth-assertion-' + index, 'assert ' + value + '\nprint(999)\n', '', { exit: 104, stderr: 'NJA204: assertion failed\n' });
}

run('chain-middle-once-arena', fixture('chain-once-arena.naja'), '8388608\n16777216\n');
const duplicate = fixture('chain-once-arena.naja').replace('assert s < s + s > s', 'middle_first = s + s\nmiddle_second = s + s\nassert middle_first == middle_second\nassert s < middle_first > s');
run('duplicate-middle-resource-control', duplicate, '', { exit: 103, stderr: 'NJA203: native value arena exhausted\n' });
for (const [name, body, code] of [
  ['float', 'print(1.25)', /NJA1\d\d/], ['function-default', 'def f(x=1):\n    return x', /NJA1\d\d/],
  ['list-comprehension', 'print([value for value in [1, 2]])', /NJA1\d\d/], ['dictionary', 'print({"a": 1})', /NJA1\d\d/],
  ['tuple-unpacking', 'a, b = (1, 2)', /NJA1\d\d/], ['set', 'print({1, 2})', /NJA1\d\d/],
  ['method', 'print("x".Repeat(2))', /NJA1\d\d/], ['formatted-string', 'print(f"{1}")', /F0011/],
  ['named-escape', String.raw`print("\N{SNAKE}")`, /F0034/], ['surrogate-escape', String.raw`print("\ud800")`, /F0035/],
  ['byte-octal', String.raw`print(b"\400")`, /F0037/], ['adjacent-literals', 'print("a" "b")', /NJA1\d\d/],
  ['other-annotation', 'x: str = "x"', /NJA1\d\d/], ['division', 'print(1 / 2)', /NJA1\d\d/],
]) reject('unsupported-' + name, body + '\n', { code });

const projects = join(directory, 'projects');
mkdirSync(projects);
const explicit = join(projects, 'explicit');
cpSync(new URL('../tests/values/projects/explicit/', import.meta.url), explicit, { recursive: true });
const explicitInput = join(explicit, 'main.naja');
const aliasExpected = '2\nTrue\nTrue\nTrue\nTrue\n3\nTrue\nequalTo display length\n7\nbound display\n99\nTrue\n';
run('explicit-project-aliases', readFileSync(explicitInput, 'utf8'), aliasExpected, { input: explicitInput, projectRoot: explicit });
reject('no-ambient-alias-activation', readFileSync(explicitInput, 'utf8'), { input: explicitInput, cwd: explicit, code: /NJA1\d\d/ });
const explicitRun = command(compiler, ['run', explicitInput, '--project-root', explicit, ...runnerOptions]);
assert.equal(explicitRun.status, 0, explicitRun.stderr.toString()); assert.deepEqual(explicitRun.stdout, bytes(aliasExpected));
record({ name: 'run-explicit-project-root', result: 'passed', native_exit: explicitRun.status });
const explicitTest = command(compiler, ['test', explicitInput, '--project-root', explicit, ...runnerOptions, '--json']);
assert.equal(explicitTest.status, 0, explicitTest.stderr.toString());
const testReport = JSON.parse(explicitTest.stdout.toString());
assert.equal(testReport.passed, 1); assert.equal(testReport.tests[0].stdout, aliasExpected);
record({ name: 'test-explicit-project-root', result: 'passed', native_exit: explicitTest.status });
reject('bound-builtin-alias-not-rewritten', 'display = 3\ndisplay(7)\n', { projectRoot: explicit, input: join(explicit, 'bound.naja'), code: /NJA1\d\d/ });
reject('builtin-alias-not-an-operator', 'print(1 display 2)\n', { projectRoot: explicit, input: join(explicit, 'wrong-context.naja'), code: /NJA1\d\d/ });
reject('operator-alias-not-a-builtin', 'lessThan(1)\n', { projectRoot: explicit, input: join(explicit, 'wrong-builtin.naja'), code: /NJA1\d\d/ });
reject('alias-case-is-not-corrected', 'print(1 EqualTo 1)\n', { projectRoot: explicit, input: join(explicit, 'case-sensitive.naja'), code: /NJA1\d\d/ });
reject('alias-use-retains-source-position', '# café\nprint(1 equalTo unknown_name)\n', {
  projectRoot: explicit, input: join(explicit, 'original-position.naja'), code: /:2:17: NJA101:/,
});

function project(name, alias, source = 'print(1 eq 1)\n') {
  const path = join(projects, name); mkdirSync(path);
  writeFileSync(join(path, 'naja.toml'), '[project]\nname = ' + JSON.stringify(name) + '\n');
  if (alias !== null) writeFileSync(join(path, 'naja.alias'), alias);
  const input = join(path, 'main.naja'); writeFileSync(input, source);
  return { path, input, source };
}
const config = target => '[operators]\n"' + target + '" = "eq"\n';
const first = project('first', config('=='));
const second = project('second', config('!='));
run('project-a-table', first.source, 'True\n', { input: first.input, projectRoot: first.path });
run('project-b-table', second.source, 'False\n', { input: second.input, projectRoot: second.path });
run('project-a-remains-owned', first.source, 'True\n', { input: first.input, projectRoot: first.path });
writeFileSync(join(first.path, 'naja.alias'), config('!='));
run('changed-table-not-stale', first.source, 'False\n', { input: first.input, projectRoot: first.path });
reject('module-outside-root', second.source, { input: second.input, projectRoot: first.path, code: /NJA030/ });
const nested = join(first.path, 'nested'); mkdirSync(nested);
writeFileSync(join(nested, 'naja.toml'), '[project]\nname = "nested-owner"\n'); writeFileSync(join(nested, 'naja.alias'), config('=='));
const nestedInput = join(nested, 'main.naja'); writeFileSync(nestedInput, first.source);
reject('nested-module-owner-boundary', first.source, { input: nestedInput, projectRoot: first.path, code: /NJA030/ });
run('nested-explicit-owner', first.source, 'True\n', { input: nestedInput, projectRoot: nested });
const relativeInput = relative(projects, second.input);
run('cwd-relative-source-with-explicit-root', second.source, 'False\n', { input: relativeInput, projectRoot: relative(projects, second.path), cwd: projects });

const unicode = project('unicode', '[operators]\n"<" = "小于"\n"==" = "eq"\n[builtins]\n"print" = "表示"\n"len" = "長さ"\n', '表示((1 小于 2) eq True)\n表示(長さ("é𝄞"))\n');
run('unicode-contextual-aliases', unicode.source, 'True\n2\n', { input: unicode.input, projectRoot: unicode.path });
const nfkc = project('nfkc', '[operators]\n"<" = "lt"\n', 'print(1 ｌｔ 2)\n');
run('nfkc-alias-use', nfkc.source, 'True\n', { input: nfkc.input, projectRoot: nfkc.path });
const missing = project('missing-optional-alias', null, 'print("canonical")\n');
run('optional-missing-alias-table', missing.source, 'canonical\n', { input: missing.input, projectRoot: missing.path });
const invalidAmbient = project('invalid-ambient', '[keywords]\n"if" = "when"\n', 'print("no ambient config")\n');
run('ambient-invalid-config-not-loaded', invalidAmbient.source, 'no ambient config\n', { input: invalidAmbient.input, cwd: invalidAmbient.path });
const pythonInput = join(explicit, 'ordinary.py'); writeFileSync(pythonInput, 'print("Python dialect")\n');
reject('python-project-activation-is-error', 'print("Python dialect")\n', { input: pythonInput, extension: 'py', projectRoot: explicit, code: /NJA030/ });

for (const [name, alias] of [
  ['unsupported-table', '[keywords]\n"if" = "when"\n'],
  ['duplicate-target', '[operators]\n"==" = "eq"\n"==" = "same"\n'],
  ['context-name-collision', '[operators]\n"<" = "same"\n[builtins]\n"print" = "same"\n'],
  ['nfkc-name-collision', '[operators]\n"<" = "Key"\n[builtins]\n"len" = "Key"\n'],
  ['oversized-table', '#'.repeat(65_537)],
]) {
  const invalid = project(name, alias, 'print(1)\n');
  reject('project-' + name, invalid.source, { input: invalid.input, projectRoot: invalid.path, code: /NJA030/ });
}
const noMarker = project('missing-marker', null, 'print(1)\n'); unlinkSync(join(noMarker.path, 'naja.toml'));
for (const [name, manifest] of [
  ['comment-only', '# The old ownership marker is no longer a valid project.\n'],
  ['malformed', '[project\nname = "broken"\n'],
  ['profile', '[project]\nname = "core"\nprofile = "core"\n'],
  ['target', '[project]\nname = "other"\ntarget = "aarch64-unknown-linux-gnu"\n'],
  ['style', '[project]\nname = "style"\n[style]\nrequire_block_levels = true\n'],
  ['dependencies', '[project]\nname = "deps"\n[dependencies.other]\npath = "../sibling"\n'],
  ['dialect', '[project]\nname = "python"\ndialect = "python"\n'],
]) {
  const invalid = project('manifest-' + name, null, 'print(1)\n');
  writeFileSync(join(invalid.path, 'naja.toml'), manifest);
  reject('manifest-' + name, invalid.source, { input: invalid.input, projectRoot: invalid.path, code: /NJA030/ });
}
reject('project-marker-required', noMarker.source, { input: noMarker.input, projectRoot: noMarker.path, code: /NJA030/ });
const traversalInput = first.path + '/nested/../main.naja';
reject('module-parent-traversal-rejected', first.source, { input: traversalInput, projectRoot: first.path, code: /NJA030/ });
try {
  const linkOwner = project('module-link-owner', null, 'print(1)\n');
  const link = join(linkOwner.path, 'linked.naja'); symlinkSync(linkOwner.input, link, 'file');
  reject('module-link-rejected', linkOwner.source, { input: link, projectRoot: linkOwner.path, code: /NJA030/ });
  const rootLink = join(projects, 'root-link'); symlinkSync(second.path, rootLink, process.platform === 'win32' ? 'junction' : 'dir');
  reject('root-link-rejected', second.source, { input: second.input, projectRoot: rootLink, code: /NJA030/ });
  const aliasLink = project('alias-link', null, 'print(1)\n');
  symlinkSync(join(second.path, 'naja.alias'), join(aliasLink.path, 'naja.alias'), 'file');
  reject('alias-link-rejected', aliasLink.source, { input: aliasLink.input, projectRoot: aliasLink.path, code: /NJA030/ });
} catch (error) {
  if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error;
  record({ name: 'project-symlink-fixtures', result: 'not_run', reason: error.code });
}

const sourceHead = command('git', ['rev-parse', 'HEAD']);
assert.equal(sourceHead.status, 0, sourceHead.stderr.toString());
const sourceStatus = command('git', ['status', '--short']);
assert.equal(sourceStatus.status, 0, sourceStatus.stderr.toString());
const summary = { schema_version: 1, source: sourceHead.stdout.toString().trim(), target: 'x86_64-unknown-linux-gnu',
  host: process.platform + '-' + process.arch, native_timeout_seconds: Number(nativeLimitSeconds),
  source_status: sourceStatus.stdout.toString(), compiler_sha256: hash(readFileSync(compiler)),
  harness_sha256: hash(readFileSync(fileURLToPath(import.meta.url))), overall_limit_ms: overallLimitMs,
  passed: results.filter(result => result.result === 'passed').length,
  not_run: results.filter(result => result.result === 'not_run').length, results };
writeFileSync(join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(`Source/native value checks: ${summary.passed} passed; ${summary.not_run} not run; artifacts retained under target/${directory.split(/[\\/]/).at(-1)}.`);
console.log('Limits: supported value slice and explicit project alias ownership; no Python, full compatibility, cache implementation, managed memory, FC1 or HATCH claim.');
