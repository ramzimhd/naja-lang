// Stage A preparation and opt-in execution; independent Node expectations, no Python.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = resolve(root, 'tests/typed-literals-source');
const sourceBase = 'b2f4fe02e0e26fcb56643479f6958bde5bbf550f';
const adrCommit = 'fabcb6ebe676cf08d11f2b1a1d096f6a0979ecb4';
const hash = value => createHash('sha256').update(value).digest('hex');
const bytes = value => Buffer.from(value, 'utf8');
const portable = value => value.replaceAll('\\', '/');
const budgets = { native_seconds: 5, cli_ms: 20_000, compiler_build_ms: 45_000, overall_ms: 240_000, capture_bytes_per_child: 8 * 1024 * 1024 };
const argv = process.argv.slice(2);
let prepareOnly = false;
let expectedSource = null;
for (let index = 0; index < argv.length; index++) {
  const argument = argv[index];
  if (argument === '--prepare-only') {
    assert.equal(prepareOnly, false, 'duplicate --prepare-only');
    prepareOnly = true;
  } else if (argument === '--expect-source') {
    assert.equal(expectedSource, null, 'duplicate --expect-source');
    expectedSource = argv[++index];
    assert.match(expectedSource ?? '', /^[0-9a-f]{40}$/, '--expect-source requires a full lowercase commit hash');
  } else assert.fail('unsupported harness option: ' + argument);
}
assert.notEqual(prepareOnly, expectedSource !== null, 'choose --prepare-only or --expect-source FULL_COMMIT_HASH');

const cases = [];
const runtime = (name, source, stdout, options = {}) => cases.push({ name, source, stdout, stderr: '', exit: 0, extension: 'naja', mode: 'runtime', ...options });
const reject = (name, source, options = {}) => cases.push({ name, source, extension: 'naja', mode: 'reject', code: 'NJA101', ...options });
const lexical = (name, source, tokenText, tokenKind) => cases.push({ name, source, extension: 'naja', mode: 'lex', tokenText, tokenKind });
const marker = 'from naja.literal import integer_literal\n';
const typeError = 'NJA205: native value type mismatch\n';
const eligibility = 'typed literal suffix requires an earlier explicitly eligible class';
const shadow = 'typed literal type is shadowed by a value binding';
const initializer = 'integer literal capability requires an initializer with exactly one value parameter';
const ordinaryClass = (name, body = '        self.value = value\n', decorator = '@integer_literal\n') => `${decorator}class ${name}:\n    def __init__(self, value):\n${body}`;
const eligible = (name = 'Vessel', body, decorator) => marker + ordinaryClass(name, body, decorator);
const at = (source, needle, occurrence = 0) => {
  let index = -1;
  for (let count = 0; count <= occurrence; count++) index = source.indexOf(needle, index + 1);
  assert.ok(index >= 0, 'original-source range needle missing: ' + needle);
  const position = end => {
    const prefix = source.slice(0, end).split(/\r\n|\r|\n/);
    return { line: prefix.length - 1, character: prefix.at(-1).length };
  };
  return { start: position(index), end: position(index + needle.length), byte_start: Buffer.byteLength(source.slice(0, index)), byte_end: Buffer.byteLength(source.slice(0, index + needle.length)) };
};
const suffixReject = (name, source, spelling, message = eligibility) => {
  const uses = [];
  let index = -1;
  let occurrence = -1;
  while ((index = source.indexOf(spelling, index + 1)) >= 0) {
    occurrence++;
    if (/[0-9]/.test(source[index - 1] ?? '')) uses.push(occurrence);
  }
  assert.equal(uses.length, 1, name + ': unique adjacent numeric suffix occurrence');
  reject(name, source, { message, range: at(source, spelling, uses[0]) });
};

// Arbitrary renamed classes and Node BigInt supply exact values independently.
const names = ['Vessel', 'Calcite', 'Orbit23', 'Saffron', 'QUnit', 'Ωmega'];
const integers = [0n, 1n, 9n, (1n << 63n), (1n << 128n) + 73n, (1n << 521n) - 1n];
for (let index = 0; index < 24; index++) {
  const name = names[index % names.length];
  const value = integers[index % integers.length] + BigInt(Math.floor(index / names.length));
  const digits = value.toString();
  const text = index % 2 ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '_') : digits;
  runtime('renamed-exact-' + index, eligible(name) + `a = ${text}${name}\nb = ${name}(${text})\nprint(a.value)\nprint(b.value)\nprint(a == b)\n`, `${value}\n${value}\nFalse\n`);
}
for (const [name, text, value] of [['zero-group', '0_0_0', 0n], ['zero-leading', '000', 0n], ['underscore', '1_234_567_890_123_456_789', 1234567890123456789n]]) {
  runtime('decimal-' + name, eligible() + `print(${text}Vessel.value)\n`, `${value}\n`);
}
runtime('two-unrelated-eligible-types', marker + ordinaryClass('Cobalt', '        self.value = value + 7\n') + ordinaryClass('Topaz', '        self.value = value * 3\n') + 'print(10Cobalt.value)\nprint(10Topaz.value)\n', '17\n30\n');
runtime('ordinary-constructor-without-opt-in', ordinaryClass('Plain', undefined, '') + 'print(Plain(-10).value)\n', '-10\n');
runtime('py-marker-ordinary-constructor', eligible('Packet') + 'print(Packet(-340282366920938463463374607431768211457).value)\n', '-340282366920938463463374607431768211457\n', { extension: 'py' });
runtime('marker-aliased-import', 'from naja.literal import integer_literal as literal\n' + ordinaryClass('Parcel', undefined, '@literal\n') + 'print(27Parcel.value)\n', '27\n');
runtime('canonical-marker-alias-and-type', 'from ｎａｊａ.ｌｉｔｅｒａｌ import ｉｎｔｅｇｅｒ＿ｌｉｔｅｒａｌ as ℒiteral\n' + ordinaryClass('Kappa', undefined, '@Literal\n') + 'print(31Kappa.value)\n', '31\n');
runtime('unicode-type-and-data', eligible('量子', '        self.value = value\n        self.label = "é🙂量子"\n') + 'print(17量子.value)\nprint(17量子.label)\n', '17\né🙂量子\n');
runtime('decorator-logical-adjacency', marker + '@integer_literal\n\n# @wrong 9Other :(999)\nclass Crate:\n    def __init__(self, value): self.value = value\nprint(4Crate.value)\n', '4\n');
runtime('brace-suites', marker + '@integer_literal\nclass Box: {\ndef __init__(self, value): {\nself.value = value\n}\ndef read(self): {\nreturn self.value\n}\n}\nprint((19Box).read())\n', '19\n');
runtime('depth-marked-suites', marker + '@integer_literal\nclass Gauge:(0)\n    def __init__(self, value):(1)\n        self.value = value\n    def read(self):(1)\n        return self.value\nprint(29Gauge.read())\n', '29\n');
runtime('named-transparent-group', eligible() + '{# Stage A #\nvalue = 33Vessel\n}\nprint(value.value)\n', '33\n');
runtime('postfix-parentheses-method-index', marker + ordinaryClass('Vector', '        self.value = value\n        self.parts = [value, value + 1]\n') + '    def read(self): return self.parts[1]\nprint((10Vector).value)\nprint(10Vector.read())\nprint(10Vector.parts[-1])\n', '10\n11\n11\n');
runtime('original-identifiers-strings-comments-inert', eligible() + 'amountVessel = 23\nprint(amountVessel)\nprint("10Vessel @integer_literal")\n# 77Unknown 0xffVessel @wrong\nprint(3Vessel.value)\n', '23\n10Vessel @integer_literal\n3\n');
runtime('crlf-metamorph', eligible('Frame').replaceAll('\n', '\r\n') + 'print(47Frame.value)\r\n', '47\n');
runtime('comment-metamorph', (eligible('Frame') + 'print(47Frame.value)\n').split('\n').map(line => line ? line + ' # 10Unknown @wrong {}' : line).join('\n'), '47\n');
runtime('earlier-type-function-return', eligible() + 'def make(): return 123Vessel\nvalue = make()\nprint(value.value)\n', '123\n');

const effectClass = eligible('Pulse', '        print(value)\n        self.value = value\n');
runtime('effect-once-per-construction', effectClass + 'a = 7Pulse\nb = 7Pulse\nprint(a.value + b.value)\n', '7\n7\n14\n');
runtime('effect-order-list-and-call', effectClass + 'def choose(a, b):\n    return a.value * 100 + b.value\nitems = [1Pulse, 2Pulse]\nprint(choose(3Pulse, 4Pulse))\nprint(items[0].value)\n', '1\n2\n3\n4\n304\n1\n');
runtime('short-circuit-keeps-effects', effectClass + 'print(False and 10Pulse)\nprint(True or 20Pulse)\nprint((True and 30Pulse).value)\nif False:\n    40Pulse\n', 'False\nTrue\n30\n30\n');
runtime('loop-construction-is-not-folded', effectClass + 'index = 0\nvalue = None\nwhile index < 3:\n    value = 9Pulse\n    index = index + 1\nprint(value.value)\n', '9\n9\n9\n9\n');
runtime('aliases-share-ordinary-instance', eligible() + 'a = 6Vessel\nb = a\nb.value = 19\nprint(a.value)\nprint(a == b)\n', '19\nTrue\n');
runtime('function-parameter-retains-object', eligible() + 'def update(value):\n    value.value = value.value + 1\n    return value\na = 55Vessel\nb = update(a)\nprint(a.value)\nprint(a == b)\n', '56\nTrue\n');
runtime('constructor-initializer-failure-keeps-effects', eligible('Fault', '        print(value)\n        return 1\n') + '5Fault\nprint("unreachable")\n', '5\n', { exit: 105, stderr: 'NJA205: native initializer must return None\n' });
runtime('constructor-assertion-failure-keeps-effects', eligible('Fault', '        print(value)\n        assert value < 3\n        self.value = value\n') + '4Fault\nprint("unreachable")\n', '4\n', { exit: 104, stderr: 'NJA204: assertion failed\n' });
for (const sign of ['-', '+']) runtime('unary-' + (sign === '-' ? 'minus' : 'plus') + '-after-construction', effectClass + `${sign}10Pulse\nprint("unreachable")\n`, '10\n', { exit: 105, stderr: typeError });
runtime('ordinary-negative-argument-is-distinct', effectClass + 'print(Pulse(-10).value)\n', '-10\n-10\n');
runtime('truthiness-remains-object-semantics', eligible() + 'print(not 0Vessel)\nprint(not 1Vessel)\n', 'False\nFalse\n');
runtime('no-implicit-quantity-arithmetic', eligible() + '1Vessel + 2Vessel\n', '', { exit: 105, stderr: typeError });
runtime('no-implicit-object-display', eligible() + 'print(1Vessel)\n', '', { exit: 105, stderr: typeError });

suffixReject('unknown-type-original-span', '# café🙂\r\nitems = ["é🙂", 10未定義]\r\n', '未定義');
suffixReject('ineligible-type-original-span', ordinaryClass('Plain', undefined, '') + 'print(10Plain.value)\n', 'Plain');
suffixReject('later-type-is-not-earlier', marker + 'print(1Later.value)\n' + ordinaryClass('Later'), 'Later');
suffixReject('unknown-canonical-spelling-original-span', '# é🙂\nitems = ["é🙂", 10Ｌａｔｅｒ]\n', 'Ｌａｔｅｒ');
suffixReject('parameter-shadow', eligible() + 'def read(Vessel):\n    return 10Vessel\nprint(read(0))\n', 'Vessel', shadow);
suffixReject('canonical-parameter-shadow', eligible('Kappa') + 'def read(Kappa):\n    return 10Kappa\nprint(read(0))\n', 'Kappa', shadow);
suffixReject('reassigned-parameter-shadow', eligible() + 'def read(Vessel):\n    Vessel = 7\n    return 10Vessel\nprint(read(0))\n', 'Vessel', shadow);
suffixReject('value-not-an-eligible-type', 'Measure = 7\nprint(10Measure)\n', 'Measure', shadow);
reject('new-local-class-rebinding-stays-refused', eligible() + 'def read():\n    Vessel = 7\n    return 10Vessel\n', { messageIncludes: 'rebinding a statically resolved class name' });
for (const [name, definition] of [['absent', '    pass\n'], ['receiver-only', '    def __init__(self): pass\n'], ['two-values', '    def __init__(self, a, b): pass\n']]) {
  reject('capability-initializer-' + name, marker + '@integer_literal\nclass Invalid:\n' + definition, { message: initializer });
}
for (const [name, source] of [
  ['ambient-marker', '@integer_literal\nclass C:\n    def __init__(self, value): pass\n'],
  ['old-name-after-alias', 'from naja.literal import integer_literal as literal\n@integer_literal\nclass C:\n    def __init__(self, value): pass\n'],
  ['called-marker', marker + '@integer_literal()\nclass C:\n    def __init__(self, value): pass\n'],
  ['attribute-decorator', marker + '@integer_literal.extra\nclass C:\n    def __init__(self, value): pass\n'],
  ['stacked-decorator', marker + '@integer_literal\n@integer_literal\nclass C:\n    def __init__(self, value): pass\n'],
  ['function-decorator', marker + '@integer_literal\ndef f(value): return value\n'],
  ['orphan-decorator', marker + '@integer_literal\nprint(1)\n'],
  ['nested-decorator', marker + 'if True:\n    @integer_literal\n    class C:\n        def __init__(self, value): pass\n'],
  ['capability-call', marker + 'integer_literal(1)\n'],
  ['capability-value', marker + 'value = integer_literal\n'],
  ['decorator-user-function', 'def mark(value): return value\n@mark\nclass C: pass\n'],
  ['late-marker-import', 'print(1)\n' + marker],
  ['duplicate-import-canonical', 'from naja.literal import integer_literal as Key, integer_literal as Key\n'],
  ['class-canonical-collision', eligible('Kappa') + ordinaryClass('Kappa')],
  ['marker-class-binding-collision', marker + ordinaryClass('integer_literal')],
  ['unsupported-capability-api', 'from naja.literal import decimal_literal\n'],
  ['unsupported-imported-type', 'from example import Parcel\nprint(1Parcel)\n'],
  ['unsupported-qualified-type', eligible() + 'print(1module.Vessel)\n'],
  ['missing-adjacency-space', eligible() + 'print(10 Vessel)\n'],
  ['missing-adjacency-tab', eligible() + 'print(10\tVessel)\n'],
]) reject(name, source);

for (const spelling of ['10eUnit', '10EUnit', '10jUnit', '10JUnit', '1.5Vessel', '.5Vessel', '1.Vessel', '1e3Vessel', '1E-3Vessel', '0xffVessel', '0b10Vessel', '0o7Vessel']) {
  reject('ambiguous-' + Buffer.from(spelling).toString('hex'), eligible() + `print(${spelling})\n`, { code: 'F0006', messageIncludes: 'use an explicit constructor' });
}
for (const spelling of ['01Vessel', '1__0Vessel', '10_Vessel', '10__Vessel', '1e_Vessel', '0x_Vessel', '0b2Vessel', '١Vessel']) {
  reject('malformed-' + Buffer.from(spelling).toString('hex'), eligible() + `print(${spelling})\n`, { code: spelling === '١Vessel' ? 'F0010' : 'F0006' });
}
for (const spelling of ['10Vessel', '1_000Vessel', '10Ωmega']) reject('py-suffix-' + Buffer.from(spelling).toString('hex'), `print(${spelling})\n`, { extension: 'py', code: 'F0006' });
reject('py-marker-still-no-suffix', eligible() + 'print(10Vessel.value)\n', { extension: 'py', code: 'F0006' });
for (const spelling of ['1e3', '1E+3', '1e-3', '1.25', '.5', '10.']) {
  lexical('ordinary-float-lex-' + Buffer.from(spelling).toString('hex'), `print(${spelling})\n`, spelling, 'Float');
  reject('ordinary-float-source-' + Buffer.from(spelling).toString('hex'), `print(${spelling})\n`);
}
for (const spelling of ['0xff', '0X_FF', '0b_101', '0o7', '1_000', '00', '0_0']) lexical('ordinary-integer-lex-' + Buffer.from(spelling).toString('hex'), `print(${spelling})\n`, spelling, 'Integer');
for (const spelling of ['1j', '1J', '1.5j']) reject('ordinary-imaginary-' + Buffer.from(spelling).toString('hex'), `print(${spelling})\n`, { code: 'F0013' });

const imports = count => Array.from({ length: count }, (_, index) => `from naja.literal import integer_literal as literal${index}\n`).join('');
runtime('marker-import-bindings-128', imports(128) + ordinaryClass('Boundary', undefined, '@literal127\n') + 'print(3Boundary.value)\n', '3\n');
reject('marker-import-bindings-129', imports(129) + 'print(1)\n', { messageIncludes: '128' });
runtime('marker-shares-import-budget', 'from naja.text import encode_utf8\n' + imports(127) + ordinaryClass('Boundary', undefined, '@literal126\n') + 'print(3Boundary.value)\nprint(len(encode_utf8("é")))\n', '3\n2\n');
reject('marker-shared-import-budget-over', 'from naja.text import encode_utf8\n' + imports(128) + 'print(1)\n', { messageIncludes: '128' });
const classes = count => marker + Array.from({ length: count }, (_, index) => ordinaryClass('Typed' + index)).join('') + `print(7Typed${count - 1}.value)\n`;
runtime('eligible-classes-and-initializers-128', classes(128), '7\n');
reject('eligible-classes-or-functions-129', classes(129), { messageIncludes: '128' });
runtime('postfix-tree-height-128', eligible('Chain', '        self.next = self\n') + 'value = 1Chain' + '.next'.repeat(126) + '\nprint(value == value.next)\n', 'True\n');
reject('postfix-tree-height-129', eligible('Chain', '        self.next = self\n') + 'value = 1Chain' + '.next'.repeat(127) + '\n', { messageIncludes: '128' });
reject('unchanged-node-budget', eligible() + '1Vessel\n'.repeat(10_001), { messageIncludes: '10000' });
reject('unchanged-suite-budget', eligible() + Array.from({ length: 65 }, (_, index) => '    '.repeat(index) + 'if True:\n').join('') + '    '.repeat(65) + '1Vessel\n', { messageIncludes: '64' });
reject('unchanged-source-byte-budget', '# ' + 'x'.repeat(1_048_576) + '\n', { code: 'NJA100', json: false });
runtime('unchanged-arena-budget', eligible() + 'while True:\n    1Vessel\n', '', { exit: 103, stderr: 'NJA203: native value arena exhausted\n' });
runtime('unchanged-call-depth-budget', eligible('Recursive', '        self.next = Recursive(value)\n') + '1Recursive\n', '', { exit: 103, stderr: 'NJA203: native user-call depth limit exceeded\n' });

// Actual changed-source controls execute different programs. Both their exact
// new output and rejection by the original oracle must be demonstrated.
runtime('changed-constructor-control', eligible('Quartz', '        self.value = value + 7\n') + 'print(10Quartz.value)\n', '17\n', { controlOriginalStdout: '10\n' });
runtime('changed-numeric-source-control', eligible('Quartz') + 'print(78Quartz.value)\n', '78\n', { controlOriginalStdout: '77\n' });
suffixReject('removed-marker-control', ordinaryClass('Quartz', undefined, '') + 'print(10Quartz.value)\n', 'Quartz');

assert.equal(new Set(cases.map(test => test.name)).size, cases.length, 'duplicate case name');
for (const test of cases) assert.match(test.name, /^[a-z][a-z0-9-]*$/);
const identity = test => ({
  name: test.name,
  extension: test.extension,
  source_bytes: Buffer.byteLength(test.source),
  source_sha256: hash(test.source),
  expectation: test.mode === 'runtime'
    ? test.controlOriginalStdout === undefined ? 'native_execution' : 'changed_source_rejected_by_original_oracle'
    : test.mode === 'lex' ? 'lexical_classification' : 'compile_rejection',
  expected_exit: test.mode === 'runtime' ? test.exit : test.mode === 'reject' ? 1 : 0,
  expected_stdout: test.stdout ?? null,
  expected_stderr: test.stderr ?? null,
  expected_diagnostic_code: test.code ?? null,
  expected_diagnostic_message: test.message ?? null,
  expected_diagnostic_substring: test.messageIncludes ?? null,
  expected_original_range: test.range ?? null,
  expected_lexical_token: test.mode === 'lex' ? {
    text: test.tokenText,
    kind: test.tokenKind,
    byte_start: Buffer.byteLength(test.source.slice(0, test.source.indexOf(test.tokenText))),
    byte_end: Buffer.byteLength(test.source.slice(0, test.source.indexOf(test.tokenText))) + Buffer.byteLength(test.tokenText),
  } : null,
  input_error_without_json: test.json === false,
  control_original_stdout: test.controlOriginalStdout ?? null,
});

process.chdir(root);
mkdirSync(resolve('target'), { recursive: true });
const directory = mkdtempSync(resolve('target/typed-literals-language-'));
const compiler = resolve('target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
const started = Date.now();
const commands = [];
const results = [];
let activeCase = null;
function command(executable, args, options = {}) {
  const { timeout = budgets.cli_ms, ...rest } = options;
  const remaining = budgets.overall_ms - (Date.now() - started);
  assert.ok(remaining > 0, 'overall typed literal suite deadline exceeded');
  const result = spawnSync(executable, args, { cwd: root, maxBuffer: budgets.capture_bytes_per_child, ...rest, timeout: Math.min(timeout, remaining), encoding: null });
  const number = commands.length;
  writeFileSync(join(directory, `command-${number}.stdout`), result.stdout ?? Buffer.alloc(0), { flag: 'wx' });
  writeFileSync(join(directory, `command-${number}.stderr`), result.stderr ?? Buffer.alloc(0), { flag: 'wx' });
  commands.push({ executable, arguments: args, exit: result.status, signal: result.signal, error: result.error?.code ?? null, stdout_sha256: hash(result.stdout ?? Buffer.alloc(0)), stderr_sha256: hash(result.stderr ?? Buffer.alloc(0)) });
  assert.ifError(result.error);
  assert.equal(result.signal, null, 'unexpected child signal');
  return result;
}
const sourceHead = command('git', ['rev-parse', 'HEAD']).stdout.toString().trim();
if (expectedSource !== null) assert.equal(sourceHead, expectedSource, 'source commit mismatch');
const harnessHash = hash(readFileSync(fileURLToPath(import.meta.url)));
const contractHash = hash(readFileSync(join(fixtureRoot, 'STAGE_A_CONTRACT.md')));
const plan = { schema_version: 1, state: 'prepared', source_base_commit: sourceBase, authority_adr_commit: adrCommit, host: process.platform + '-' + process.arch, node: process.version, target: 'x86_64-unknown-linux-gnu', harness_sha256: harnessHash, contract_sha256: contractHash, budgets, passed: 0, not_run: cases.length, results: cases.map(test => ({ ...identity(test), result: 'not_run' })) };
writeFileSync(join(directory, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
for (const test of cases) writeFileSync(join(directory, `${test.name}.${test.extension}`), test.source, { flag: 'wx' });
process.on('uncaughtExceptionMonitor', error => {
  const completed = new Set(results.map(result => result.name));
  try { writeFileSync(join(directory, 'failure.json'), JSON.stringify({ schema_version: 1, state: 'failed', source_commit: sourceHead, results: [...results, ...cases.filter(test => !completed.has(test.name)).map(test => ({ ...identity(test), result: test === activeCase ? 'failed' : 'not_run' }))], commands, error: { name: error.name, message: error.message } }, null, 2) + '\n', { flag: 'wx' }); }
  catch { /* Keep the original failure when evidence storage also fails. */ }
});
if (prepareOnly) {
  writeFileSync(join(directory, 'summary.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  console.log(`Prepared ${cases.length} Stage A cases. All outcomes: not_run. No compiler or native executable invoked. Artifacts: ${portable(relative(root, directory))}`);
} else {
  const frozen = JSON.parse(readFileSync(join(fixtureRoot, 'PREPARATION.json'), 'utf8'));
  assert.equal(frozen.schema_version, 1, 'frozen preparation schema');
  assert.equal(frozen.state, 'prepared', 'frozen preparation state');
  assert.equal(frozen.source_base_commit, sourceBase, 'reviewed source base');
  assert.equal(frozen.authority_adr_commit, adrCommit, 'reviewed authority');
  assert.equal(frozen.passed, 0, 'preparation cannot claim passed cases');
  assert.equal(frozen.not_run, cases.length, 'preparation pending count');
  assert.equal(frozen.harness_sha256, harnessHash, 'frozen harness identity');
  assert.equal(frozen.contract_sha256, contractHash, 'frozen contract identity');
  assert.deepEqual(frozen.budgets, budgets, 'frozen resource budgets');
  assert.deepEqual(frozen.results, plan.results, 'frozen cases and independent expectations');
  const clean = command('git', ['diff', '--exit-code', 'HEAD', '--', 'Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml', 'bootstrap', 'backends']);
  assert.equal(clean.status, 0, 'compiler source differs from requested commit');
  assert.equal(command('git', ['ls-files', '--others', '--exclude-standard', '--', 'bootstrap', 'backends']).stdout.length, 0, 'untracked compiler source is not frozen');
  const built = command('cargo', ['+1.97.1', 'build', '--workspace', '--locked', '--offline'], { timeout: budgets.compiler_build_ms });
  assert.equal(built.status, 0, built.stderr.toString());
  const version = command(compiler, ['--version']);
  assert.equal(version.status, 0, version.stderr.toString());
  let linuxDirectory = directory;
  if (process.platform === 'win32') {
    const platform = command('wsl.exe', ['--exec', '/usr/bin/uname', '-sm']);
    assert.equal(platform.status, 0, platform.stderr.toString());
    assert.equal(platform.stdout.toString().trim(), 'Linux x86_64');
    const translated = command('wsl.exe', ['--exec', '/usr/bin/wslpath', '-a', portable(directory)]);
    assert.equal(translated.status, 0, translated.stderr.toString());
    linuxDirectory = translated.stdout.toString().trim();
  } else {
    assert.equal(process.platform, 'linux', 'native checks require Linux x86-64 or Windows with explicit local x86-64 WSL');
    assert.equal(process.arch, 'x64');
  }
  for (const test of cases) {
    activeCase = test;
    const input = join(directory, test.name + '.' + test.extension);
    const artifact = join(directory, test.name + '.elf');
    const record = { ...identity(test) };
    if (test.mode === 'lex') {
      const lexed = command(compiler, ['lex', input]);
      assert.equal(lexed.status, 0, test.name + ': lexical failure: ' + lexed.stderr);
      const token = identity(test).expected_lexical_token;
      assert.ok(lexed.stdout.toString().split(/\r?\n/).includes(`${token.byte_start}..${token.byte_end} ${token.kind} ${JSON.stringify(token.text)}`), test.name + ': original lexical token kind/text/range');
      assert.equal(lexed.stderr.length, 0);
      record.lex_exit = lexed.status;
    } else {
      const checked = command(compiler, ['check', input, ...(test.json === false ? [] : ['--json'])]);
      const emitted = command(compiler, ['build', input, '--target', 'x86_64-unknown-linux-gnu', '--output', artifact]);
      record.check_exit = checked.status;
      record.build_exit = emitted.status;
      if (test.mode === 'reject') {
        assert.equal(checked.status, 1, test.name + ': check must reject');
        assert.equal(emitted.status, 1, test.name + ': build must reject');
        assert.equal(existsSync(artifact), false, test.name + ': rejected source emitted an artifact');
        assert.equal(emitted.stdout.length, 0);
        assert.ok(emitted.stderr.toString().includes(test.code + ':'), test.name + ': build diagnostic code');
        if (test.message !== undefined) assert.ok(emitted.stderr.toString().includes(test.message), test.name + ': build diagnostic message');
        if (test.messageIncludes !== undefined) assert.ok(emitted.stderr.toString().includes(test.messageIncludes), test.name + ': build diagnostic category');
        if (test.json === false) {
          assert.equal(checked.stdout.length, 0);
          assert.ok(checked.stderr.toString().includes(test.code + ':'), test.name + ': input-error diagnostic');
        } else {
          assert.equal(checked.stderr.length, 0, test.name + ': JSON diagnostic on stdout');
          const report = JSON.parse(checked.stdout.toString());
          assert.equal(report.schema_version, 1);
          assert.equal(report.status, 'failed');
          const matching = report.diagnostics.filter(diagnostic => diagnostic.code === test.code && (test.message === undefined || diagnostic.message === test.message) && (test.messageIncludes === undefined || diagnostic.message.includes(test.messageIncludes)));
          assert.ok(matching.length > 0, test.name + ': frozen diagnostic code/message');
          if (test.range !== undefined) assert.ok(matching.some(diagnostic => JSON.stringify({ start: diagnostic.start, end: diagnostic.end }) === JSON.stringify({ start: test.range.start, end: test.range.end })), test.name + ': original suffix UTF-16 range');
          record.diagnostics = report.diagnostics;
        }
      } else {
        assert.equal(checked.status, 0, test.name + ': check: ' + checked.stdout + checked.stderr);
        assert.equal(JSON.parse(checked.stdout.toString()).status, 'passed');
        assert.equal(checked.stderr.length, 0);
        assert.equal(emitted.status, 0, test.name + ': build: ' + emitted.stderr);
        const linuxArtifact = linuxDirectory + '/' + test.name + '.elf';
        let executed;
        if (process.platform === 'win32') {
          const permission = command('wsl.exe', ['--exec', '/usr/bin/chmod', 'u+x', linuxArtifact]);
          assert.equal(permission.status, 0, permission.stderr.toString());
          executed = command('wsl.exe', ['--exec', '/usr/bin/timeout', '--signal=TERM', '--kill-after=1s', String(budgets.native_seconds), linuxArtifact]);
        } else {
          chmodSync(artifact, 0o700);
          executed = command('/usr/bin/timeout', ['--signal=TERM', '--kill-after=1s', String(budgets.native_seconds), artifact]);
        }
        assert.equal(executed.status, test.exit, test.name + ': native exit: ' + executed.stderr);
        assert.deepEqual(executed.stdout, bytes(test.stdout), test.name + ': exact stdout bytes');
        assert.deepEqual(executed.stderr, bytes(test.stderr), test.name + ': exact stderr bytes');
        if (test.controlOriginalStdout !== undefined) {
          assert.throws(() => assert.deepEqual(executed.stdout, bytes(test.controlOriginalStdout)), error => error.code === 'ERR_ASSERTION', test.name + ': original oracle accepted changed source');
          record.control_outcome = 'original_output_oracle_rejected_changed_source';
        }
        Object.assign(record, { native_exit: executed.status, elf_sha256: hash(readFileSync(artifact)), stdout_sha256: hash(executed.stdout), stderr_sha256: hash(executed.stderr) });
      }
    }
    record.result = 'passed';
    results.push(record);
    activeCase = null;
    console.log('PASS ' + test.name);
  }
  writeFileSync(join(directory, 'summary.json'), JSON.stringify({ schema_version: 1, state: 'executed', source_commit: sourceHead, harness_sha256: harnessHash, contract_sha256: contractHash, budgets, host: process.platform + '-' + process.arch, target: 'x86_64-unknown-linux-gnu', node: process.version, compiler_version: version.stdout.toString().trim(), compiler_sha256: hash(readFileSync(compiler)), passed: results.length, not_run: 0, commands, results }, null, 2) + '\n', { flag: 'wx' });
  console.log(`${results.length} Stage A checks passed. Artifacts: ${portable(relative(root, directory))}`);
  console.log('Scope: static same-module integer literal construction only. General protocols, exact Rational/Decimal promotion, scale/affine algebra, productivity, FC1 and HATCH remain open.');
}
