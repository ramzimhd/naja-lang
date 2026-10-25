// Actual Rational source checks; independent Node models, no Python oracle.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = resolve(root, 'tests/rationals-source');
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
const directory = mkdtempSync(resolve('target/rationals-language-'));
const compiler = resolve('target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
const results = [];
const commands = [];
let activeCase = null;
const fixtures = JSON.parse(readFileSync(join(fixtureRoot, 'fixture-index.json'), 'utf8'));
assert.equal(fixtures.schema_version, 1);
for (const entry of fixtures.files) {
  assert.match(entry.path, /^(?:[a-z][a-z0-9-]*\.(?:py|naja)|project\/(?:main\.naja|naja\.(?:toml|alias))|inputs\/operands\.bin)$/);
  assert.equal(hash(readFileSync(join(fixtureRoot, entry.path))), entry.sha256, 'static fixture hash: ' + entry.path);
}
const fixture = name => readFileSync(join(fixtureRoot, name), 'utf8');
const cases = [];
const runtime = (name, source, stdout, options = {}) => cases.push({ name, source, stdout, stderr: '', exit: 0, extension: 'naja', ...options });
const reject = (name, source, diagnostic = 'NJA101:', options = {}) => cases.push({ name, source, diagnostic, reject: true, extension: 'naja', ...options });
for (const entry of fixtures.native) for (const extension of entry.extensions) runtime(entry.name + '-' + extension, fixture(entry.path), entry.stdout, { extension });
const API = 'from naja.numeric import rational, divide_exact, numerator, denominator\n';
const observe = source => 'value = ' + source + '\nprint(numerator(value))\nprint(denominator(value))\n';
runtime('project-aliases-members-and-unicode', fixture('project/main.naja'), '1\n2\nTrue\nTrue\n', { project: true });
runtime('crlf-values-metamorphic', fixture('values.py').replaceAll('\n', '\r\n'), fixtures.native.find(test => test.name === 'values').stdout, { extension: 'py' });
runtime('comment-order-metamorphic', fixture('order.py').split('\n').map(line => line ? line + ' # %% :(999) {# inert # }' : line).join('\n'), fixtures.native.find(test => test.name === 'order').stdout);
runtime('private-input-fraction', fixture('file-input.py'), '7\n9\n', { extension: 'py', input: readFileSync(join(fixtureRoot, 'inputs/operands.bin')) });

const abs = value => value < 0n ? -value : value;
function gcd(left, right) { left = abs(left); right = abs(right); while (right) [left, right] = [right, left % right]; return left; }
function fraction(numerator, denominator = 1n) {
  assert.notEqual(denominator, 0n);
  if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
  if (numerator === 0n) return { n: 0n, d: 1n };
  const common = gcd(numerator, denominator);
  return { n: numerator / common, d: denominator / common };
}
const add = (left, right) => fraction(left.n * right.d + right.n * left.d, left.d * right.d);
const subtract = (left, right) => fraction(left.n * right.d - right.n * left.d, left.d * right.d);
const multiply = (left, right) => fraction(left.n * right.n, left.d * right.d);
const divide = (left, right) => fraction(left.n * right.d, left.d * right.n);
const compare = (left, right) => { const difference = left.n * right.d - right.n * left.d; return difference < 0n ? -1 : difference > 0n ? 1 : 0; };
const display = value => value.n + '\n' + value.d + '\n';
const literal = value => '(' + value + ')';
const ratioSource = value => 'rational(' + literal(value.n) + ', ' + literal(value.d) + ')';
const operations = [['+', add], ['-', subtract], ['*', multiply], ['divide_exact', divide]];
let vectorSource = API, vectorOutput = '';
for (let index = 0; index < 80; index++) {
  const left = fraction(BigInt((index * 37 + 19) % 251 - 125), BigInt((index * 11 + 5) % 97 + 1));
  let right = fraction(BigInt((index * 29 + 13) % 241 - 120), BigInt((index * 17 + 3) % 89 + 1));
  const [operator, model] = operations[index % operations.length];
  if (operator === 'divide_exact' && right.n === 0n) right = fraction(1n, 7n);
  const rhs = index % 3 === 0 ? { source: index % 2 ? 'True' : 'False', value: fraction(index % 2 ? 1n : 0n) } : { source: ratioSource(right), value: right };
  if (operator === 'divide_exact' && rhs.value.n === 0n) { rhs.source = 'True'; rhs.value = fraction(1n); }
  vectorSource += observe(operator === 'divide_exact' ? 'divide_exact(' + ratioSource(left) + ', ' + rhs.source + ')' : ratioSource(left) + ' ' + operator + ' ' + rhs.source);
  vectorOutput += display(model(left, rhs.value));
}
for (const extension of ['py', 'naja']) runtime('independent-small-fraction-vector-' + extension, vectorSource, vectorOutput, { extension });
const huge = 10n ** 80n + 7n;
const hugeCases = [
  ['rational(' + huge + ' * 21, -' + huge + ' * 14)', fraction(-3n, 2n)],
  ['rational(' + huge + ', 3) * rational(3, ' + huge + ')', fraction(1n)],
  ['rational(1, ' + huge + ') + rational(' + (huge - 1n) + ', ' + huge + ')', fraction(1n)],
  ['divide_exact(rational(' + huge + ', 7), rational(' + huge + ', 9))', fraction(9n, 7n)],
];
runtime('independent-huge-common-factors-and-cancellation', API + hugeCases.map(([source]) => observe(source)).join(''), hugeCases.map(([, value]) => display(value)).join(''));
const numeric = [{ source: 'rational(0, 9)', value: fraction(0n) }, { source: 'rational(2, -4)', value: fraction(-1n, 2n) }, { source: 'rational(1, 3)', value: fraction(1n, 3n) }, { source: 'rational(3, 2)', value: fraction(3n, 2n) }, { source: 'False', value: fraction(0n) }, { source: 'True', value: fraction(1n) }, { source: '(-2)', value: fraction(-2n) }, { source: '2', value: fraction(2n) }];
const relations = [['==', value => value === 0], ['!=', value => value !== 0], ['<', value => value < 0], ['<=', value => value <= 0], ['>', value => value > 0], ['>=', value => value >= 0]];
let compareSource = API, compareOutput = '';
for (const left of numeric) for (const right of numeric) for (const [operator, predicate] of relations) { compareSource += 'print(' + left.source + ' ' + operator + ' ' + right.source + ')\n'; compareOutput += predicate(compare(left.value, right.value)) ? 'True\n' : 'False\n'; }
runtime('independent-exact-comparison-matrix', compareSource, compareOutput);
for (const [name, source, value] of [['left-bool', 'True + rational(1, 2)', fraction(3n, 2n)], ['right-bool', 'rational(1, 2) - True', fraction(-1n, 2n)], ['zero-product', 'False * rational(-5, 7)', fraction(0n)], ['int-int-exact', 'divide_exact(4, 2)', fraction(2n)], ['int-ratio-exact', 'divide_exact(2, rational(3, 2))', fraction(4n, 3n)], ['ratio-int-exact', 'divide_exact(rational(3, 2), 2)', fraction(3n, 4n)], ['unary-plus', '+rational(2, -4)', fraction(-1n, 2n)], ['unary-minus-zero', '-rational(0, -7)', fraction(0n)]]) runtime('promotion-' + name, API + observe(source), display(value));
const emptyClass = 'class C: pass\n';
for (const [name, source, prefix] of [['text', '"x"', ''], ['bytes', 'b"x"', ''], ['none', 'None', ''], ['object', 'C()', emptyClass]]) for (const [side, left, right] of [['left', 'rational(0, 1)', source], ['right', source, 'rational(0, 1)']]) runtime('unrelated-equality-' + name + '-' + side, API + prefix + 'print(' + left + ' == ' + right + ')\nprint(' + left + ' != ' + right + ')\n', 'False\nTrue\n');
runtime('int-only-results-remain-int', API + 'print(7 + 2)\nprint(7 // 2)\nprint(7 % 2)\nprint(True * 7)\n', '9\n3\n1\n7\n');
runtime('discarded-ratio-and-return', API + 'def make_ratio():\n    rational(1, 2)\n    return rational(-3, 4)\n' + observe('make_ratio()'), '-3\n4\n');
runtime('distinct-import-aliases-and-raw-keyword-lookalike', 'from naja.numeric import rational as 比, rational as other, numerator as ｉｆ, denominator as 分母\nvalue = other(6, 8)\nprint(ｉｆ(value))\nprint(分母(比(1, 2)))\n', '3\n2\n');
runtime('parameter-shadows-api-as-value', API + 'def identity(numerator):\n    numerator = True\n    return numerator\nprint(identity(False))\n', 'True\n');

const typeFailure = { exit: 105, stderr: 'NJA205: native value type mismatch\n' };
const keyFailure = { exit: 105, stderr: 'NJA205: unsupported native mapping key type\n' };
const zeroFailure = { exit: 106, stderr: 'NJA206: integer division by zero\n' };
const arenaFailure = { exit: 103, stderr: 'NJA203: native value arena exhausted\n' };
const workFailure = { exit: 103, stderr: 'NJA203: native rational work limit exceeded\n' };
const mark = 'def mark(label, value):\n    print(label)\n    return value\n';
const badKinds = [['text', '"x"', ''], ['bytes', 'b"x"', ''], ['none', 'None', ''], ['tuple', '()', ''], ['list', '[]', ''], ['dict', '{}', ''], ['set', '{1}', ''], ['object', 'C()', emptyClass]];
for (const [name, source, prefix] of [...badKinds, ['nested-ratio', 'rational(1, 2)', '']]) for (const side of ['numerator', 'denominator']) runtime('constructor-wrong-kind-' + name + '-' + side, API + prefix + 'rational(' + (side === 'numerator' ? source + ', 1' : '1, ' + source) + ')\n', '', typeFailure);
for (const [name, source, prefix] of badKinds) {
  for (const side of ['left', 'right']) runtime('exact-division-wrong-kind-' + name + '-' + side, API + prefix + 'divide_exact(' + (side === 'left' ? source + ', 1' : '1, ' + source) + ')\n', '', typeFailure);
  for (const reader of ['numerator', 'denominator']) runtime('reader-wrong-kind-' + reader + '-' + name, API + prefix + reader + '(' + source + ')\n', '', typeFailure);
}
for (const reader of ['numerator', 'denominator']) for (const [name, source] of [['int', '1'], ['bool', 'True']]) runtime('reader-keeps-ratio-only-' + reader + '-' + name, API + reader + '(' + source + ')\n', '', typeFailure);
for (const [name, source, prefix] of badKinds.filter(([name]) => ['text', 'none', 'tuple', 'object'].includes(name))) for (const [number, operator] of ['+', '-', '*'].entries()) for (const [side, left, right] of [['left', 'rational(1, 2)', source], ['right', source, 'rational(1, 2)']]) runtime('nonnumeric-arithmetic-' + name + '-' + number + '-' + side, API + prefix + left + ' ' + operator + ' ' + right + '\n', '', typeFailure);
for (const [name, source, prefix] of badKinds.filter(([name]) => ['text', 'none', 'object'].includes(name))) for (const [number, operator] of ['<', '<=', '>', '>='].entries()) runtime('unrelated-order-' + name + '-' + number, API + prefix + 'print(rational(1, 2) ' + operator + ' ' + source + ')\n', '', typeFailure);
for (const [name, source] of [['tuple', '()'], ['list', '[]'], ['dict', '{}'], ['set', '{1}']]) for (const [number, operator] of ['==', '!='].entries()) for (const [side, left, right] of [['left', 'rational(1, 2)', source], ['right', source, 'rational(1, 2)']]) runtime('partial-container-comparison-' + name + '-' + number + '-' + side, API + 'print(' + left + ' ' + operator + ' ' + right + ')\n', '', typeFailure);
for (const [name, source] of [['display', 'print(value)'], ['len', 'len(value)'], ['index', 'value[0]'], ['index-store', 'value[0] = 1'], ['attribute', 'value.numerator'], ['attribute-store', 'value.numerator = 1'], ['floor-left', 'value // 2'], ['floor-right', '2 // value'], ['remainder', 'value % 2'], ['floor-zero', 'value // 0'], ['remainder-zero', 'value % 0']]) runtime('unsupported-ratio-operation-' + name, API + 'value = rational(1, 2)\n' + source + '\n', '', typeFailure);
for (const [name, source] of [['dict-literal', 'value = {rational(1, 1): True}'], ['set-literal', 'value = {rational(1, 1)}'], ['dict-read', '{}[rational(1, 1)]'], ['dict-store', 'value = {}\nvalue[rational(1, 1)] = True'], ['dict-membership', 'rational(1, 1) in {}'], ['set-membership', 'rational(1, 1) in set()']]) runtime('unsupported-ratio-mapping-key-' + name, API + source + '\n', '', keyFailure);
for (const [name, source] of [['constructor', 'rational(1, 0)'], ['constructor-bool', 'rational(True, False)'], ['constructor-zero-zero', 'rational(0, 0)'], ['divide-int', 'divide_exact(1, 0)'], ['divide-bool', 'divide_exact(True, False)'], ['divide-ratio-zero', 'divide_exact(rational(1, 2), rational(0, -1))']]) runtime('zero-' + name, API + source + '\n', '', zeroFailure);
runtime('both-children-before-constructor-type-zero-guard', API + mark + 'rational(mark("numerator", "bad"), mark("denominator", 0))\n', 'numerator\ndenominator\n', typeFailure);
runtime('both-kinds-before-zero-numerator-shortcut', API + mark + 'rational(mark("numerator", 0), mark("denominator", "bad"))\n', 'numerator\ndenominator\n', typeFailure);
runtime('both-children-before-exact-division-type-zero-guard', API + mark + 'divide_exact(mark("left", "bad"), mark("right", 0))\n', 'left\nright\n', typeFailure);
runtime('child-zero-before-outer-wrong-kind', API + mark + 'rational(mark("numerator", "bad"), 1 // 0)\n', 'numerator\n', zeroFailure);
runtime('first-child-error-stops-second-effect', API + mark + 'rational(1 // 0, mark("unreachable", 1))\n', '', zeroFailure);
runtime('nested-constructor-error-stops-outer-denominator', API + mark + 'rational(rational(1, 0), mark("unreachable", 1))\n', '', zeroFailure);
runtime('arithmetic-right-error-before-type-guard', API + 'rational(1, 2) + 1 // 0\n', '', zeroFailure);
runtime('chain-short-circuit-skips-rational-zero', API + 'print(3 < 2 < rational(1, 0))\n', 'False\n');
runtime('chain-preserves-nonbool-middle', API + mark + 'print(0 < mark("middle", rational(1, 2)) < rational(3, 4))\n', 'middle\nTrue\n');

const recursion = depth => API + 'def descend(value, depth):\n    if depth == 1:\n        return value\n    result = descend(value + rational(1, 2), depth - 1)\n    assert numerator(result) == 255\n    assert denominator(result) == 2\n    return result\n' + observe('descend(rational(0, 1), ' + depth + ')');
runtime('rational-call-frames-256', recursion(256), '255\n2\n');
runtime('rational-call-guard-257', recursion(257), '', { exit: 103, stderr: 'NJA203: native user-call depth limit exceeded\n' });
const selectedDepth = count => API + 'items = [None, rational(1, 2)]\nitems[0] = items\nresult = items' + '[0]'.repeat(count - 1) + '[1]\nprint(numerator(result))\nprint(denominator(result))\n';
runtime('selected-ratio-expression-height-128', selectedDepth(127), '1\n2\n');
reject('selected-ratio-expression-height-129', selectedDepth(128), 'expression tree depth exceeds 128');
const genericSetup = 'class Holder:\n    def __init__(self, value):\n        self.value = value\n';
const touchBody = '    items[0] = ratio\n    holder.value = items[0]\n    mapping[None] = holder.value\n    assert mapping[None]\n    assert original[0]\n';
const arenaPrefix = 'ratio = rational(1, 2)\nitems = [ratio]\noriginal = (ratio,)\nholder = Holder(ratio)\nmapping = {None: ratio}\npayload = "' + 'x'.repeat(524288) + '"\nsmall = "' + 'y'.repeat(65536) + '"\n' + 'discard = payload + ""\n'.repeat(127) + 'discard = small + ""\n'.repeat(7);
runtime('near-arena-generic-ratio-stores-reads-truth-no-allocation', API + genericSetup + 'def touch(items, holder, mapping, original, ratio):\n' + touchBody.repeat(20) + arenaPrefix + 'touch(items, holder, mapping, original, ratio)\n'.repeat(100) + 'print("preserved")\n', 'preserved\n');
runtime('near-arena-explicit-construction-allocation-control', API + genericSetup + 'def allocate(items):\n' + '    items[0] = rational(1, 2)\n'.repeat(20) + arenaPrefix + 'allocate(items)\n'.repeat(100), '', arenaFailure);

const imports = count => 'from naja.numeric import rational\n' + Array.from({ length: count - 1 }, (_, index) => 'from naja.numeric import numerator as alias' + index + '\n').join('') + 'print(alias' + (count - 2) + '(rational(6, 8)))\n';
runtime('shared-import-bindings-128', imports(128), '3\n');
reject('shared-import-bindings-129', imports(129), '128');
for (const [name, source, diagnostic] of [
  ['missing-explicit-import', 'rational(1, 2)\n'], ['constructor-no-arguments', API + 'rational()\n'], ['constructor-one-argument', API + 'rational(1)\n'], ['constructor-three-arguments', API + 'rational(1, 2, 3)\n'],
  ['divide-one-argument', API + 'divide_exact(1)\n'], ['reader-no-arguments', API + 'numerator()\n'], ['reader-two-arguments', API + 'denominator(1, 2)\n'],
  ['keyword-constructor', API + 'rational(n=1, d=2)\n'], ['starred-constructor', API + 'rational(*[1, 2])\n'], ['api-value', API + 'value = rational\n'], ['api-rebinding', API + 'rational = 7\n'],
  ['api-function-collision', API + 'def rational(value):\n    return value\n'], ['api-class-collision', API + 'class numerator: pass\n'], ['local-api-call', API + 'def value(rational):\n    return rational(1, 2)\n'],
  ['late-import', 'value = 1\n' + API], ['nested-import', 'def value():\n    from naja.numeric import rational\n'], ['unknown-numeric-api', 'from naja.numeric import decimal\n'], ['wildcard-import', 'from naja.numeric import *\n'],
  ['duplicate-canonical-import', 'from naja.numeric import numerator as Key, denominator as Key\n'], ['duplicate-import', 'from naja.numeric import rational, rational\n'],
  ['plain-division-remains-unsupported', 'print(1 / 2)\n'], ['ratio-slash-remains-unsupported', API + 'rational(1, 2) / 2\n'],
  ['original-argument-span', '# café\n' + API + 'rational(未定義, 2)\n', ':3:10: NJA101:'],
]) reject(name, source, diagnostic ?? 'NJA101:');
reject('python-does-not-enable-braces', fixture('blocks.naja'), 'NJA101:', { extension: 'py' });
reject('no-ambient-project-aliases', fixture('project/main.naja'));

// Work math follows frozen 23a6a590... only; no compiler/native output supplies
// either the BigInt values or these abstract debit expectations.
const WORK = 1_000_000n;
function limbs(value) { let count = 0; value = abs(value); while (value) { value /= 1_000_000_000n; count++; } return count; }
class WorkModel {
  total = 0n;
  trace = [];
  debit(primitive, units, left = null, right = null) {
    const previous = this.total; this.total += units;
    this.trace.push({ primitive, left_limbs: left, right_limbs: right, units: String(units), cumulative_units: String(this.total), first_excess: previous <= WORK && this.total > WORK });
  }
  clone(value) { this.debit('clone_or_negate', 1n + 2n * BigInt(limbs(value)), limbs(value)); }
  divrem(left, right) {
    assert.notEqual(right, 0n);
    const n = BigInt(limbs(left)), m = BigInt(limbs(right));
    const units = n === 0n ? 1n : m === 1n ? 1n + 8n * (n + 2n) : 1n + 132n * n * (m + 1n) + 8n * (m + 1n);
    this.debit('divrem', units, Number(n), Number(m));
    return left % right;
  }
  euclid(left, right) { while (right) { this.debit('euclid_iteration', 1n); [left, right] = [right, this.divrem(left, right)]; } return left; }
  input(value, ratio) {
    this.debit('descriptor', 1n);
    this.debit('raw_numerator', 1n + BigInt(limbs(value.n)), limbs(value.n));
    if (!ratio) return;
    this.debit('raw_denominator', 1n + BigInt(limbs(value.d)), limbs(value.d));
    if (value.n) { if (value.n < 0n) this.clone(value.n); assert.equal(this.euclid(abs(value.n), value.d), 1n); }
  }
  normalize(numerator, denominator) {
    assert.notEqual(denominator, 0n);
    if (denominator < 0n) { this.clone(numerator); this.clone(denominator); numerator = -numerator; denominator = -denominator; }
    if (!numerator) return fraction(0n);
    if (numerator < 0n) this.clone(numerator);
    const common = this.euclid(abs(numerator), denominator);
    assert.equal(this.divrem(numerator, common), 0n); assert.equal(this.divrem(denominator, common), 0n);
    return fraction(numerator, denominator);
  }
  multiply(left, right) { const n = BigInt(limbs(left)), m = BigInt(limbs(right)); this.debit('multiply', 1n + 4n * n * m + 3n * (n + m), Number(n), Number(m)); return left * right; }
}
const costCheckpoints = [
  { name: 'constructor-zero-over-one', numerator: '0', denominator: '1', units: '5' },
  { name: 'constructor-one-over-one', numerator: '1', denominator: '1', units: '82' },
  { name: 'reader-one-over-one', numerator: '1', denominator: '1', units: '31' },
];
for (const [n, expected] of [[0n, 5n], [1n, 82n]]) {
  const model = new WorkModel(); model.input(fraction(n), false); model.input(fraction(1n), false); model.normalize(n, 1n); assert.equal(model.total, expected);
}
const readerCheckpoint = new WorkModel(); readerCheckpoint.input(fraction(1n), true); assert.equal(readerCheckpoint.total, 31n);
const workOracles = [];
function workCase(name, source, model, expected, options = {}) {
  const exceeds = model.total > WORK;
  workOracles.push({ name, limit: String(WORK), required_units_if_completed: String(model.total), exceeds, first_excess_index: model.trace.findIndex(row => row.first_excess), expected_numerator: String(expected.n), expected_denominator: String(expected.d), trace: model.trace });
  runtime(name, API + source, exceeds ? options.stdout ?? '' : display(expected), exceeds ? { ...workFailure, ...options } : options);
}
const equalWork = count => {
  const value = 10n ** BigInt(9 * (count - 1));
  const model = new WorkModel(); model.input(fraction(value), false); model.input(fraction(value), false);
  const result = model.normalize(value, value);
  return { value, model, result };
};
const under = equalWork(49), over = equalWork(50);
assert.equal(under.model.total, 971506n); assert.equal(over.model.total, 1011132n);
workCase('work-cumulative-49-limbs-under', observe('rational(' + under.value + ', ' + under.value + ')'), under.model, under.result);
workCase('work-cumulative-50-limbs-over', 'rational(' + over.value + ', ' + over.value + ')\n', over.model, over.result);
workCase('work-both-child-effects-before-cumulative-guard', mark + 'rational(mark("numerator", ' + over.value + '), mark("denominator", ' + over.value + '))\n', over.model, over.result, { stdout: 'numerator\ndenominator\n' });
runtime('work-short-circuit-skips-normalization', API + 'print(False and rational(' + over.value + ', ' + over.value + '))\nprint(True or rational(' + over.value + ', ' + over.value + '))\n', 'False\nTrue\n');
const negative = new WorkModel(); negative.input(fraction(-under.value), false); negative.input(fraction(-under.value), false); const negativeResult = negative.normalize(-under.value, -under.value);
workCase('work-negative-denominator-clones-under', observe('rational(-' + under.value + ', -' + under.value + ')'), negative, negativeResult);
const large = 10n ** 891n;
const zeroWork = new WorkModel(); zeroWork.input(fraction(0n), false); zeroWork.input(fraction(-large), false); const zeroResult = zeroWork.normalize(0n, -large);
assert.equal(zeroWork.total, 306n);
workCase('work-zero-canonical-shortcut', observe('rational(0, -' + large + ')'), zeroWork, zeroResult);
runtime('work-type-before-zero-and-normalization', API + 'rational(' + large + ', "bad")\n', '', typeFailure);
runtime('work-zero-denominator-before-normalization', API + 'rational(' + large + ', 0)\n', '', zeroFailure);
for (const operation of ['multiply', 'divide_exact']) {
  const model = new WorkModel(), left = fraction(over.value), right = operation === 'multiply' ? fraction(1n, over.value) : fraction(over.value);
  model.input(left, true); model.input(right, true);
  const n = model.multiply(left.n, operation === 'multiply' ? right.n : right.d), d = model.multiply(left.d, operation === 'multiply' ? right.d : right.n);
  const result = model.normalize(n, d); assert.ok(model.total > WORK);
  const leftSource = 'rational(' + over.value + ', 1)', rightSource = operation === 'multiply' ? 'rational(1, ' + over.value + ')' : leftSource;
  workCase('work-' + operation + '-no-cross-cancellation-or-reset', (operation === 'multiply' ? leftSource + ' * ' + rightSource : 'divide_exact(' + leftSource + ', ' + rightSource + ')') + '\n', model, result);
}
runtime('comparison-crossproducts-without-normalization', API + 'left = rational(' + over.value + ', 1)\nright = rational(1, ' + over.value + ')\nprint(left > right)\nprint(numerator(-left))\n', 'True\n-' + over.value + '\n');
cases.push({ ...cases.find(test => test.name === 'values-py'), name: 'wrong-rational-source-control', source: fixture('values.py').replace('rational(6, 8)', 'rational(8, 6)'), control: true });
cases.push({ ...cases.find(test => test.name === 'private-input-fraction'), name: 'wrong-rational-input-file-control', input: Buffer.from([136, 137]), control: true, controlKind: 'input_file' });
assert.equal(new Set(cases.map(test => test.name)).size, cases.length, 'unique case names');

function command(executable, args, options = {}) {
  const { timeout = 20_000, ...rest } = options;
  const remaining = overallLimitMs - (Date.now() - started);
  assert.ok(remaining > 0, 'overall Rational suite deadline exceeded');
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
const identity = test => ({ name: test.name, source_bytes: Buffer.byteLength(test.source), source_sha256: hash(test.source), extension: test.extension, project: test.project ?? false, input_bytes: test.input?.length ?? null, input_sha256: test.input ? hash(test.input) : null, control_kind: test.control ? test.controlKind ?? 'source' : null, expectation: test.reject ? 'compile_rejection' : test.control ? 'output_oracle_rejects_mutated_source_or_input' : 'native_execution', expected_exit: test.reject ? 1 : test.exit, expected_diagnostic: test.diagnostic ?? null, expected_stdout_sha256: test.reject ? null : hash(test.stdout), expected_stderr_sha256: test.reject ? null : hash(test.stderr) });
const sourceHead = command('git', ['rev-parse', 'HEAD']).stdout.toString().trim();
if (expectedSource !== null) assert.equal(sourceHead, expectedSource, 'source commit mismatch');
const sourceStatus = command('git', ['status', '--short']).stdout.toString();
const sourceDiff = command('git', ['diff', '--binary', 'HEAD']).stdout;
writeFileSync(join(directory, 'plan.json'), JSON.stringify({ schema_version: 1, source_commit: sourceHead, fixture_index_sha256: hash(readFileSync(join(fixtureRoot, 'fixture-index.json'))), rational_work_contract_commit: '23a6a59042c29502e180940bb38eab3c061a7925', rational_work_checkpoints: costCheckpoints, rational_work_oracles: workOracles, cases: cases.map(identity) }, null, 2) + '\n');
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
  assert.deepEqual(costCheckpoints, frozen.rational_work_checkpoints, 'frozen rational cost checkpoints');
  assert.deepEqual(workOracles, frozen.rational_work_oracles, 'frozen rational debit traces');
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
    let nativeData = null;
    if (test.input) {
      nativeData = join(directory, test.name + '.data');
      mkdirSync(nativeData);
      writeFileSync(join(nativeData, 'operands.bin'), test.input);
    }
    const verifyInput = () => {
      if (!nativeData) return;
      assert.deepEqual(readdirSync(nativeData), ['operands.bin'], test.name + ': private input inventory');
      assert.deepEqual(readFileSync(join(nativeData, 'operands.bin')), test.input, test.name + ': private input bytes');
    };
    verifyInput();
    const project = test.project ? ['--project-root', projectRoot] : [];
    const checked = command(compiler, ['check', input, ...project]);
    output(test.name + '.check', checked);
    verifyInput();
    const emitted = command(compiler, ['build', input, '--target', 'x86_64-unknown-linux-gnu', '--output', artifact, ...project]);
    output(test.name + '.build', emitted);
    verifyInput();
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
        executed = command('wsl.exe', [...(nativeData ? ['--cd', linuxDirectory + '/' + test.name + '.data'] : []), '--exec', '/usr/bin/timeout', '--signal=TERM', '--kill-after=1s', String(nativeLimitSeconds), linuxArtifact]);
      } else {
        chmodSync(artifact, 0o700);
        executed = command('/usr/bin/timeout', ['--signal=TERM', '--kill-after=1s', String(nativeLimitSeconds), artifact], { cwd: nativeData ?? root });
      }
      output(test.name + '.native', executed);
      verifyInput();
      if (test.control) {
        assert.equal(executed.status, 0, test.name + ': mutated source/input must execute normally');
        assert.throws(() => verify(test, executed), error => error.code === 'ERR_ASSERTION' && error.message.includes('stdout bytes'), test.name + ': oracle accepted injected wrong behavior');
        record.control_outcome = test.controlKind === 'input_file' ? 'output_oracle_rejected_mutated_input_file' : 'output_oracle_rejected_mutated_source';
      } else verify(test, executed);
      Object.assign(record, { native_exit: executed.status, elf_sha256: hash(readFileSync(artifact)), stdout_sha256: hash(executed.stdout), stderr_sha256: hash(executed.stderr) });
      if (nativeData) Object.assign(record, { private_input_sha256_after_check_build_native: hash(readFileSync(join(nativeData, 'operands.bin'))), private_input_inventory: ['operands.bin'] });
    }
    record.result = 'passed';
    results.push(record);
    activeCase = null;
    console.log('PASS ' + test.name);
  }
  const summary = { schema_version: 1, state: 'executed', source_commit: sourceHead, source_status: sourceStatus, source_diff_sha256: hash(sourceDiff), host: process.platform + '-' + process.arch, target: 'x86_64-unknown-linux-gnu', node: process.version, compiler_version: version.stdout.toString().trim(), compiler_sha256: hash(readFileSync(compiler)), harness_sha256: hash(readFileSync(fileURLToPath(import.meta.url))), fixture_index_sha256: hash(readFileSync(join(fixtureRoot, 'fixture-index.json'))), native_timeout_seconds: nativeLimitSeconds, overall_limit_ms: overallLimitMs, passed: results.length, not_run: 0, commands, results };
  writeFileSync(join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(`${results.length} actual Rational checks passed. Artifacts: ${portable(relative(root, directory))}`);
  console.log('Scope: bounded exact Rational source behavior; Rational display, full numeric hashing, Decimal and general numeric promotion/scale/affine protocols remain open. No FC1 or HATCH acceptance claim.');
}
