// Actual ordinary-class source checks; independent Node models, no Python oracle.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = resolve(root, 'tests/objects-source');
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
assert.ok(prepareOnly || expectedSource !== null, 'native execution requires an explicit --expect-source commit');
assert.deepEqual(argv.filter((argument, index) => argument !== '--prepare-only' && !(expectAt >= 0 && (index === expectAt || index === expectAt + 1))), [], 'unsupported harness options');
process.chdir(root);
mkdirSync(resolve('target'), { recursive: true });
const directory = mkdtempSync(resolve('target/objects-language-'));
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
runtime('project-aliases-and-nfkc', fixture('project/main.naja'), '表示 equalTo 長さ\n7\n表示 equalTo 長さ\nTrue\nTrue\n', { project: true });
runtime('crlf-member-metamorphic', fixture('members.py').replaceAll('\n', '\r\n'), fixtures.native.find(test => test.name === 'members').stdout, { extension: 'py' });
runtime('comment-order-metamorphic', fixture('order.py').split('\n').map(line => line ? line + ' # %% :(999) {# inert # }' : line).join('\n'), fixtures.native.find(test => test.name === 'order').stdout);

// JS objects supply independent reference identity and alias mutation. Scalar
// display expectations come from explicit values, never compiler IR/addresses.
const scalars = [
  { source: 'None', display: 'None' }, { source: 'False', display: 'False' }, { source: 'True', display: 'True' },
  ...[0n, -1n, 10n ** 100n + 7n].map(value => ({ source: '(' + value + ')', display: String(value) })),
  { source: '"é𝄞"', display: 'é𝄞' }, { source: 'b"\\x00\\xff"', display: "b'\\x00\\xff'" },
];
const cellClass = 'class Cell:\n    def __init__(self, value):\n        self.value = value\n    def get(self):\n        return self.value\n    def replace(self, value):\n        self.value = value\n        return self\n';
const model = Array.from({ length: 128 }, (_, index) => ({ value: { source: String(index), display: String(index) } }));
const alias = model;
let vectorSource = cellClass + 'values = [' + model.map(value => 'Cell(' + value.value.source + ')').join(', ') + ']\nalias = values\n', vectorOutput = '';
for (let step = 0; step < 256; step++) {
  const index = (step * 37 + 11) % 128;
  const value = scalars[(step * 3 + 1) % scalars.length];
  alias[index].value = value;
  vectorSource += `alias[${step % 2 ? index - 128 : index}].replace(${value.source})\n`;
  if (step % 17 === 0) { vectorSource += `print(values[${index}].get())\n`; vectorOutput += model[index].value.display + '\n'; }
}
for (let index = 0; index < 128; index++) {
  vectorSource += `print(values[${index}].value)\nprint(alias[${index - 128}].get())\n`;
  vectorOutput += model[index].value.display + '\n' + model[index].value.display + '\n';
}
for (const extension of ['py', 'naja']) runtime('independent-object-vector-' + extension, vectorSource, vectorOutput, { extension });
const empty = 'class Empty:\n    pass\n';
const mark = 'def mark(label, value):\n    print(label)\n    return value\n';
const identityObjects = [{}, {}, {}];
const identityAliases = [identityObjects[0], identityObjects[0], identityObjects[1], identityObjects[2]];
let identitySource = empty + 'class Other:\n    pass\na = Empty()\nalias = a\nb = Empty()\nc = Other()\n', identityOutput = '';
for (const [left, nameLeft] of ['a', 'alias', 'b', 'c'].entries()) for (const [right, nameRight] of ['a', 'alias', 'b', 'c'].entries()) for (const operation of ['==', '!=']) {
  identitySource += `print(${nameLeft} ${operation} ${nameRight})\n`;
  const equal = identityAliases[left] === identityAliases[right];
  identityOutput += ((operation === '==' ? equal : !equal) ? 'True' : 'False') + '\n';
}
runtime('independent-object-identity', identitySource, identityOutput);
for (const [number, scalar] of ['None', 'True', '0', '"x"', 'b"x"'].entries()) for (const [side, left, right] of [['left', 'value', scalar], ['right', scalar, 'value']]) runtime('unrelated-scalar-equality-' + number + '-' + side, empty + 'value = Empty()\nprint(' + left + ' == ' + right + ')\nprint(' + left + ' != ' + right + ')\n', 'False\nTrue\n');
runtime('definition-only', 'class Empty: pass\nclass Counter:\n    def __init__(self, value):\n        self.value = value\n    def get(self):\n        return self.value\n', '');
runtime('receiver-name-is-ordinary', 'class C:\n    def get(any_name):\n        return any_name\nvalue = C()\nprint(value.get() == value)\n', 'True\n');
runtime('method-ordinary-local-and-return-flow', 'class C:\n    def choose(self, flag):\n        if flag:\n            value = True\n        else:\n            return None\n        return value\nprint(C().choose(True))\nprint(C().choose(False))\n', 'True\nNone\n');
runtime('instance-return-and-nested-target', empty + 'def identity(value):\n    return value\nvalue = Empty()\nwrapper = (value,)\nidentity(wrapper[0]).field = [None]\nidentity(value).field[0] = True\nprint(value.field[0])\n', 'True\n');
runtime('self-and-earlier-class-construction', empty + 'class Node:\n    def child(self):\n        value = Node()\n        value.other = Empty()\n        return value\nvalue = Node().child()\nprint(value == value)\nprint(not value.other)\n', 'True\nFalse\n');
runtime('initializer-none-paths', 'class A:\n    def __init__(self):\n        return\nclass B:\n    def __init__(self):\n        return None\nclass C:\n    def __init__(self):\n        pass\nprint(not A())\nprint(not B())\nprint(not C())\n', 'False\nFalse\nFalse\n');
runtime('attribute-rhs-replaces-receiver', empty + 'def replace(holder):\n    holder[0] = Empty()\n    return True\nholder = [Empty()]\nold = holder[0]\nholder[0].value = replace(holder)\nprint(holder[0].value)\nprint(holder[0] != old)\n', 'True\nTrue\n');
runtime('early-return-through-method-suites', 'class C:\n    def choose(self, value):\n        while True:\n            if value:\n                return value\n            return None\nprint(C().choose(True))\nprint(C().choose(False))\n', 'True\nNone\n');
runtime('early-return-through-named-method-group', 'class C: {\ndef get(self): {\n{# transparent #\nreturn True\n}\n}\n}\nprint(C().get())\n', 'True\n');
runtime('method-member-keywords-as-ordinary-fields', empty + 'value = Empty()\nvalue.print = True\nvalue.i64 = False\nprint(value.print)\nprint(value.i64)\n', 'True\nFalse\n');
runtime('import-visible-in-method', 'from naja.text import encode_utf8\nclass C:\n    def convert(self, value):\n        return encode_utf8(value)\nprint(C().convert("é"))\n', "b'\\xc3\\xa9'\n");

const typeFailure = { exit: 105, stderr: 'NJA205: native value type mismatch\n' };
const missingFailure = { exit: 110, stderr: 'NJA210: native object attribute not found\n' };
const boundFailure = { exit: 110, stderr: 'NJA210: native bound-method values are unsupported\n' };
const arityFailure = { exit: 105, stderr: 'NJA205: native method argument count mismatch\n' };
const zeroFailure = { exit: 106, stderr: 'NJA206: integer division by zero\n' };
const methodClass = 'class C:\n    def method(self, value):\n        return value\n';
runtime('missing-read', empty + 'print(Empty().missing)\n', '', missingFailure);
runtime('missing-call-before-arguments', mark + empty + 'mark("receiver", Empty()).missing(mark("unreachable argument", 1))\n', 'receiver\n', missingFailure);
runtime('bound-method-extraction', methodClass + 'value = C().method\n', '', boundFailure);
runtime('field-shadow-call-before-arguments', mark + methodClass + 'value = C()\nvalue.method = 0\nmark("receiver", value).method(mark("unreachable argument", 1))\n', 'receiver\n', typeFailure);
runtime('method-too-many-arguments-after-effects', mark + methodClass + 'C().method(mark("first", 1), mark("second", 2))\n', 'first\nsecond\n', arityFailure);
runtime('method-too-few-arguments-after-receiver', mark + methodClass + 'mark("receiver", C()).method()\n', 'receiver\n', arityFailure);
runtime('argument-error-before-arity-guard', mark + methodClass + 'C().method(mark("first", 1), 1 // 0)\n', 'first\n', zeroFailure);
runtime('constructor-argument-error-before-initializer', mark + 'class C:\n    def __init__(self, first, second):\n        print("unreachable initializer")\nC(mark("first", 1), 1 // 0)\n', 'first\n', zeroFailure);
runtime('attribute-rhs-error-before-receiver', mark + empty + 'mark("unreachable receiver", Empty()).value = 1 // 0\n', '', zeroFailure);
runtime('attribute-receiver-error-after-rhs', mark + 'len(1).value = mark("value", 7)\n', 'value\n', typeFailure);
runtime('missing-nested-receiver-after-rhs', mark + empty + 'Empty().missing.value = mark("value", 7)\n', 'value\n', missingFailure);
runtime('instance-comparison-right-error-first', empty + 'print(Empty() < 1 // 0)\n', '', zeroFailure);
for (const [name, value] of [['int', '1'], ['bool', 'True'], ['none', 'None'], ['text', '"x"'], ['bytes', 'b"x"'], ['tuple', '()'], ['list', '[]']]) {
  runtime('wrong-receiver-read-' + name, 'print((' + value + ').field)\n', '', typeFailure);
  runtime('wrong-receiver-write-' + name, mark + '(' + value + ').field = mark("value", 7)\n', 'value\n', typeFailure);
  runtime('wrong-receiver-call-' + name, mark + '(' + value + ').method(mark("unreachable argument", 7))\n', '', typeFailure);
}
for (const [name, value] of [['bool', 'True'], ['int', '7'], ['text', '"x"'], ['bytes', 'b"x"'], ['tuple', '()'], ['list', '[]']]) runtime('initializer-non-none-' + name, 'class C:\n    def __init__(self, value):\n        print("initializer")\n        return value\nC(' + value + ')\n', 'initializer\n', { exit: 105, stderr: 'NJA205: native initializer must return None\n' });
for (const [name, expression] of [['display', 'print(value)'], ['len', 'print(len(value))'], ['index', 'print(value[0])'], ['positive', '+value'], ['negative', '-value'], ['sequence-store', 'value[0] = 1']]) runtime('unsupported-object-operation-' + name, empty + 'value = Empty()\n' + expression + '\n', '', typeFailure);
for (const [number, operator] of ['+', '-', '*', '//', '%', '<', '<=', '>', '>='].entries()) runtime('object-arithmetic-or-order-' + number, empty + `value = Empty()\nprint(value ${operator} value)\n`, '', typeFailure);
for (const [kind, other] of [['tuple', '()'], ['list', '[]']]) for (const [side, left, right] of [['left', 'value', other], ['right', other, 'value']]) for (const [number, operator] of ['==', '!='].entries()) runtime('unsupported-container-comparison-' + kind + '-' + side + '-' + number, empty + `value = Empty()\nprint(${left} ${operator} ${right})\n`, '', typeFailure);

const recursion = depth => 'class C:\n    def down(self, depth):\n        if depth == 1:\n            return self\n        return self.down(depth - 1)\nvalue = C()\nprint(value.down(' + depth + ') == value)\n';
runtime('active-method-calls-256', recursion(256), 'True\n');
runtime('active-method-calls-257', recursion(257), '', { exit: 103, stderr: 'NJA203: native user-call depth limit exceeded\n' });
const fields = count => empty + 'value = Empty()\n' + Array.from({ length: count }, (_, index) => `value.field${index} = ${index}\n`).join('');
runtime('fields-128-and-update-at-capacity', fields(128) + 'value.field0 = True\n' + Array.from({ length: 128 }, (_, index) => `print(value.field${index})\n`).join(''), 'True\n' + Array.from({ length: 127 }, (_, index) => String(index + 1) + '\n').join(''));
runtime('fields-129', fields(129), '', { exit: 103, stderr: 'NJA203: native object field limit exceeded\n' });
const classes = count => Array.from({ length: count }, (_, index) => 'class C' + index + ': pass\n').join('') + 'print(not C0())\nprint(not C' + (count - 1) + '())\n';
runtime('classes-128', classes(128), 'False\nFalse\n');
reject('classes-129', classes(129), '128');
const methods = count => 'class C:\n' + Array.from({ length: count }, (_, index) => '    def m' + index + '(self):\n        return ' + index + '\n').join('') + 'print(C().m0())\nprint(C().m' + (count - 1) + '())\n';
runtime('methods-128', methods(128), '0\n127\n');
reject('methods-129', methods(129), '128');
const parameters = count => 'class C:\n    def method(self, ' + Array.from({ length: count }, (_, index) => 'p' + index).join(', ') + '):\n' + Array.from({ length: count }, (_, index) => '        print(p' + index + ')\n').join('') + 'value = C().method(' + Array.from({ length: count }, (_, index) => index).join(', ') + ')\nprint(value)\n';
runtime('receiver-plus-127-parameters', parameters(127), Array.from({ length: 127 }, (_, index) => index + '\n').join('') + 'None\n');
reject('receiver-plus-128-parameters', parameters(128), '128');
for (const [name, identifier] of [['ascii', 'a'.repeat(256)], ['unicode', 'é'.repeat(128)]]) {
  runtime('member-name-256-' + name, empty + 'value = Empty()\nvalue.' + identifier + ' = True\nprint(value.' + identifier + ')\n', 'True\n');
  reject('member-name-over-256-' + name, empty + 'value = Empty()\nvalue.' + identifier + 'a = True\n', '256');
}
runtime('method-name-256', 'class C:\n    def ' + 'm'.repeat(256) + '(self):\n        return True\nprint(C().' + 'm'.repeat(256) + '())\n', 'True\n');
reject('method-name-257', 'class C:\n    def ' + 'm'.repeat(257) + '(self):\n        return True\n', '256');
runtime('class-name-has-no-new-member-cap', 'class ' + 'C'.repeat(257) + ': pass\nprint(not ' + 'C'.repeat(257) + '())\n', 'False\n');
const names = count => empty + 'if False:\n' + Array.from({ length: count }, (_, index) => '    Empty().field' + index + '\n').join('') + 'print("validated")\n';
runtime('static-member-names-1024-in-skipped-code', names(1024), 'validated\n');
reject('static-member-names-1025-in-skipped-code', names(1025), '1024');
const height = count => empty + 'value = Empty()\nvalue.next = value\nresult = value' + '.next'.repeat(count) + '\nprint(result == value)\n';
runtime('attribute-ir-height-128', height(127), 'True\n');
reject('attribute-ir-height-129', height(128));
const callHeight = count => 'class C:\n    def next(self):\n        return self\nvalue = C()\nresult = value' + '.next()'.repeat(count) + '\nprint(result == value)\n';
runtime('method-call-ir-height-128', callHeight(127), 'True\n');
reject('method-call-ir-height-129', callHeight(128));
// The same prerecorded payload sizes used by the existing collection resource
// probes leave less than 64 KiB. Repeated field updates must retain descriptors.
const arenaPrefix = 'value = Empty()\nvalue.field = None\npayload = "' + 'x'.repeat(524288) + '"\nsmall = "' + 'y'.repeat(65536) + '"\n' + 'discard = payload + ""\n'.repeat(127) + 'discard = small + ""\n'.repeat(7);
runtime('near-arena-field-updates-reuse-descriptors', empty + 'def update(value, payload):\n' + '    value.field = payload\n'.repeat(20) + arenaPrefix + 'update(value, payload)\n'.repeat(100) + 'print(len(value.field))\n', '524288\n');
runtime('object-allocations-retain-arena-bound', empty + 'while True:\n    Empty()\n', '', { exit: 103, stderr: 'NJA203: native value arena exhausted\n' });

for (const [name, source, diagnostic] of [
  ['inheritance', 'class C(object):\n    pass\n'], ['decorator', '@decorator\nclass C:\n    pass\n'],
  ['class-variable', 'class C:\n    value = 1\n'], ['class-body-effect', 'class C:\n    print("effect")\n'],
  ['nested-class', 'class C:\n    class D:\n        pass\n'], ['nested-method-definition', 'class C:\n    def method(self):\n        def nested():\n            pass\n'],
  ['method-no-receiver', 'class C:\n    def method():\n        pass\n'], ['method-parameter-default', 'class C:\n    def method(self, value=1):\n        pass\n'],
  ['method-uninitialized-local', 'class C:\n    def method(self, flag):\n        if flag:\n            value = True\n        return value\n'],
  ['method-parameter-annotation', 'class C:\n    def method(self, value: int):\n        pass\n'], ['method-return-annotation', 'class C:\n    def method(self) -> int:\n        return 1\n'],
  ['method-kwargs', methodClass + 'C().method(value=1)\n'], ['method-starargs', methodClass + 'C().method(*[1])\n'],
  ['staticmethod', 'class C:\n    @staticmethod\n    def method():\n        pass\n'], ['property', 'class C:\n    @property\n    def value(self):\n        return 1\n'],
  ['special-member', 'class C:\n    def __str__(self):\n        return "value"\n'], ['dynamic-class-value', empty + 'value = Empty\n'],
  ['class-rebinding', empty + 'Empty = 1\n'], ['class-function-collision', empty + 'def Empty():\n    pass\n'],
  ['duplicate-class-canonical', 'class Key: pass\nclass Key: pass\n'], ['duplicate-method-canonical', 'class C:\n    def Key(self):\n        pass\n    def Key(self):\n        pass\n'],
  ['duplicate-receiver-canonical', 'class C:\n    def method(Key, Key):\n        pass\n'], ['raw-method-is-not-global', 'class C:\n    def method(self):\n        return method(self)\n'],
  ['later-class-reference', 'class C:\n    def method(self):\n        return Later()\nclass Later: pass\n'],
  ['later-global-function-reference', 'class C:\n    def method(self):\n        return later()\ndef later():\n    pass\n'],
  ['parameter-class-shadow-call', empty + 'def invoke(Empty):\n    return Empty()\n'], ['local-class-shadow-call', empty + 'def invoke():\n    Empty = 1\n    return Empty()\n'],
  ['constructor-too-many', empty + 'Empty(1)\n'], ['constructor-too-few', 'class C:\n    def __init__(self, value):\n        pass\nC()\n'],
  ['constructor-keyword', 'class C:\n    def __init__(self, value):\n        pass\nC(value=1)\n'],
  ['class-before-definition', 'value = C()\nclass C: pass\n'], ['bound-method-call-through-local', methodClass + 'method = C().method\nmethod(1)\n'],
  ['import-class-collision', 'from naja.text import encode_utf8\nclass encode_utf8: pass\n'],
  ['empty-brace-class', 'class C: {\n}\n'], ['named-section-in-class', 'class C: {\n{# unsupported class section #\npass\n}\n}\n'],
  ['wrong-class-depth-marker', 'class C:(1)\n    pass\n'], ['wrong-method-depth-marker', 'class C:(0)\n    def method(self):(0)\n        pass\n'],
  ['unknown-member-assignment-value-span', '# café\nclass C: pass\nvalue = C()\nvalue.値 = 未定義\n', ':4:11: NJA101:'],
]) reject(name, source, diagnostic ?? 'NJA101:');
reject('python-does-not-enable-braces', fixture('blocks.naja'), 'NJA101:', { extension: 'py' });
reject('python-does-not-enable-depth-markers', 'class C:(0)\n    pass\n', 'NJA101:', { extension: 'py' });
reject('aliases-no-ambient-activation', fixture('project/main.naja'));
cases.push({ ...cases.find(test => test.name === 'counters-py'), name: 'wrong-method-result-source-control', source: fixture('counters.py').replace('return self.value', 'return amount'), control: true });
cases.push({ ...cases.find(test => test.name === 'order-py'), name: 'wrong-assignment-effect-source-control', source: fixture('order.py').replace('mark("assigned value", 7)', 'mark("injected value", 7)'), control: true });
assert.equal(new Set(cases.map(test => test.name)).size, cases.length, 'unique case names');

function command(executable, args, options = {}) {
  const { timeout = 20_000, ...rest } = options;
  const remaining = overallLimitMs - (Date.now() - started);
  assert.ok(remaining > 0, 'overall object suite deadline exceeded');
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
  const frozen = JSON.parse(readFileSync(join(fixtureRoot, 'PREPARATION.json'), 'utf8'));
  assert.equal(hash(readFileSync(fileURLToPath(import.meta.url))), frozen.harness_sha256, 'frozen harness identity');
  assert.equal(hash(readFileSync(join(fixtureRoot, 'fixture-index.json'))), frozen.fixture_index_sha256, 'frozen fixture-index identity');
  assert.deepEqual(cases.map(identity), frozen.results.map(({ result, ...test }) => test), 'frozen generated cases and expectations');
  assert.deepEqual(frozen.budgets, { native_seconds: nativeLimitSeconds, cli_ms: 20_000, compiler_build_ms: 45_000, overall_ms: overallLimitMs, capture_bytes_per_child: 8 * 1024 * 1024 }, 'frozen resource budgets');
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
  console.log(`${results.length} actual object checks passed. Artifacts: ${portable(relative(root, directory))}`);
  console.log('Scope: bounded ordinary classes; first-class classes/bound methods, inheritance, descriptors, extension/partial classes, complete Python grammar, FC1 and HATCH remain unsupported.');
}
