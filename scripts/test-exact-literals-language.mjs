// Independent exact-decimal source preparation and opt-in native proof; no Python.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = resolve(root, 'tests/exact-literals-source');
const sourceBase = '546f8e366bba182263afd5be1cb4068c15356ea7';
const adrCommit = '3fa7e09ceb82365948dd2f9793cdbf44dc5dc12f';
const hash = value => createHash('sha256').update(value).digest('hex');
const bytes = value => Buffer.from(value, 'utf8');
const portable = value => value.replaceAll('\\', '/');
const MAX = 1_048_576n;
const WORK = 1_000_000n;
const budgets = { native_seconds: 5, cli_ms: 20_000, compiler_build_ms: 45_000, overall_ms: 240_000, capture_bytes_per_child: 8 * 1024 * 1024 };
let prepareOnly = false, expectedSource = null;
const argv = process.argv.slice(2);
for (let index = 0; index < argv.length; index++) {
  if (argv[index] === '--prepare-only') { assert.equal(prepareOnly, false); prepareOnly = true; }
  else if (argv[index] === '--expect-source') { assert.equal(expectedSource, null); expectedSource = argv[++index]; assert.match(expectedSource ?? '', /^[0-9a-f]{40}$/); }
  else assert.fail('unsupported harness option: ' + argv[index]);
}
assert.notEqual(prepareOnly, expectedSource !== null, 'choose --prepare-only or --expect-source FULL_COMMIT_HASH');

const abs = value => value < 0n ? -value : value;
function gcd(a, b) { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a; }
function fraction(n, d = 1n) { assert.notEqual(d, 0n); if (d < 0n) { n = -n; d = -d; } if (!n) return { n: 0n, d: 1n }; const g = gcd(n, d); return { n: n / g, d: d / g }; }
const display = value => value.n + '\n' + value.d + '\n';
const add = (a, b) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
const multiply = (a, b) => fraction(a.n * b.n, a.d * b.d);
const digitGroup = text => /^[0-9](?:_?[0-9])*$/.test(text);

// Layout is independent of value reduction. It counts raw coefficient digits,
// including zeros, BEFORE allocating a coefficient, power or emitted pair.
function layout(raw) {
  const parts = raw.split(/[eE]/); assert.ok(parts.length <= 2);
  const mantissa = parts[0], exponentText = parts[1] ?? '0';
  const exponentDigits = exponentText.replace(/^[+-]/, '');
  assert.ok(digitGroup(exponentDigits), 'invalid oracle exponent: ' + raw);
  const point = mantissa.indexOf('.');
  const whole = point < 0 ? mantissa : mantissa.slice(0, point);
  const tail = point < 0 ? '' : mantissa.slice(point + 1);
  assert.ok(!tail.includes('.'));
  assert.ok((whole === '' || digitGroup(whole)) && (tail === '' || digitGroup(tail)) && whole + tail !== '', 'invalid oracle mantissa: ' + raw);
  if (point < 0 && parts.length === 1) assert.ok(!whole.startsWith('0') || /^[0_]+$/.test(whole));
  const digits = text => { let count = 0n; for (const character of text) if (character !== '_') count++; return count; };
  const coefficientBytes = digits(whole) + digits(tail);
  const fractionalDigits = digits(tail);
  // BigInt handles exponent text, not a float or a machine-sized accumulator.
  // Test inputs are source-bounded; powers are never constructed before reserve.
  const exponent = BigInt(exponentText.replaceAll('_', ''));
  const shift = exponent - fractionalDigits;
  const numeratorBytes = coefficientBytes + (shift > 0n ? shift : 0n);
  const denominatorBytes = 1n + (shift < 0n ? -shift : 0n);
  return { raw, mantissa, exponent, fractionalDigits, coefficientBytes, shift, numeratorBytes, denominatorBytes, pairBytes: numeratorBytes + denominatorBytes };
}
const layoutIdentity = row => Object.fromEntries(['raw', 'exponent', 'fractionalDigits', 'coefficientBytes', 'shift', 'numeratorBytes', 'denominatorBytes', 'pairBytes'].map(key => [key, typeof row[key] === 'bigint' ? String(row[key]) : row[key]]));
function exact(raw) {
  const row = layout(raw); assert.ok(row.pairBytes <= MAX, 'oracle power allocation requires prior bounded pair');
  const coefficient = row.mantissa.replaceAll('_', '').replace('.', '');
  const numerator = coefficient + '0'.repeat(Number(row.shift > 0n ? row.shift : 0n));
  const denominator = '1' + '0'.repeat(Number(row.shift < 0n ? -row.shift : 0n));
  assert.equal(BigInt(numerator.length), row.numeratorBytes); assert.equal(BigInt(denominator.length), row.denominatorBytes);
  return { row, numerator, denominator, value: fraction(BigInt(numerator), BigInt(denominator)) };
}
class Ledger {
  total = 0n; entries = [];
  ordinary(kind, data) { const length = BigInt(Buffer.byteLength(data)); this.total += length; this.entries.push({ kind, bytes: String(length), cumulative: String(this.total), sha256: hash(data) }); return this; }
  name(name) { return this.ordinary('static_name_occurrence', name.normalize('NFKC')); }
  pair(raw) { const row = layout(raw), next = this.total + row.pairBytes, accepted = next <= MAX; this.entries.push({ kind: 'atomic_exact_pair', ...layoutIdentity(row), prior: String(this.total), attempted_total: String(next), accepted }); if (accepted) this.total = next; return accepted; }
  identity() { return { limit: String(MAX), reserved_bytes: String(this.total), entries: this.entries }; }
}
function constructorWork(n, d) {
  const count = value => { let size = 0n; for (value = abs(value); value; value /= 1_000_000_000n) size++; return size; };
  let total = 0n; const trace = [];
  const debit = (primitive, units) => { const previous = total; total += units; trace.push({ primitive, units: String(units), cumulative: String(total), first_excess: previous <= WORK && total > WORK }); };
  const divide = (a, b) => { const x = count(a), y = count(b); debit('divrem', x === 0n ? 1n : y === 1n ? 1n + 8n * (x + 2n) : 1n + 132n * x * (y + 1n) + 8n * (y + 1n)); return a % b; };
  for (const value of [n, d]) { debit('input_descriptor', 1n); debit('input_raw', 1n + count(value)); }
  if (n) { let a = n, b = d; while (b) { debit('euclid_iteration', 1n); [a, b] = [b, divide(a, b)]; } assert.equal(divide(n, a), 0n); assert.equal(divide(d, a), 0n); }
  return { limit: String(WORK), required_units_if_completed: String(total), exceeds: total > WORK, trace };
}
const workCheckpoints = [
  { numerator: '0', denominator: '1', units: '5' },
  { numerator: '1', denominator: '1', units: '82' },
];
for (const point of workCheckpoints) assert.equal(constructorWork(BigInt(point.numerator), BigInt(point.denominator)).required_units_if_completed, point.units);

const cases = [];
const runtime = (name, source, stdout, options = {}) => cases.push({ name, source, stdout, stderr: '', exit: 0, extension: 'naja', mode: 'runtime', ...options });
const reject = (name, source, options = {}) => cases.push({ name, source, extension: 'naja', mode: 'reject', code: 'NJA101', ...options });
const lexical = (name, source, tokenText, tokenKind) => cases.push({ name, source, extension: 'naja', mode: 'lex', tokenText, tokenKind });
const checkOnly = (name, source, options = {}) => cases.push({ name, source, extension: 'naja', mode: 'check', ...options });
const api = 'from naja.numeric import rational, numerator, denominator\n';
const marker = 'from naja.literal import exact_literal\n';
const typeError = 'NJA205: native value type mismatch\n';
const workError = 'NJA203: native rational work limit exceeded\n';
const expansionError = 'typed exact literal expansion exceeds the 1 MiB literal budget';
const eligibility = 'typed literal suffix requires an earlier explicitly eligible class';
const shadow = 'typed literal type is shadowed by a value binding';
const integerOnly = 'decimal typed literal requires an explicitly eligible exact literal class';
const definition = (name = 'Parcel', body = '        self.value = value\n', decorator = '@exact_literal\n') => `${decorator}class ${name}:\n    def __init__(self, value):\n${body}`;
const eligible = (name = 'Parcel', body, decorator) => api + marker + definition(name, body, decorator);
const observe = expression => `value = ${expression}\nprint(numerator(value))\nprint(denominator(value))\n`;
function range(source, needle, offset = 0) {
  const start = source.indexOf(needle, offset); assert.ok(start >= 0, 'range needle absent');
  const position = index => { const lines = source.slice(0, index).split(/\r\n|\r|\n/); return { line: lines.length - 1, character: lines.at(-1).length }; };
  return { start: position(start), end: position(start + needle.length), byte_start: Buffer.byteLength(source.slice(0, start)), byte_end: Buffer.byteLength(source.slice(0, start + needle.length)) };
}
function suffixReject(name, source, numeric, suffix, message = eligibility) { const token = source.indexOf(numeric + suffix); assert.ok(token >= 0); reject(name, source, { message, range: range(source, suffix, token + numeric.length) }); }

const names = ['Parcel', 'Vessel', 'Calcite', 'Orbit23', 'Ωmega', '量子'];
const vectors = ['0', '000', '0_0_0', '1', '340282366920938463463374607431768211457', '0.0', '.5', '1.', '1.e3', '01.5', '001.500', '1.000', '123.456', '1_234.5_00', '1e0', '1E+3', '1e-3', '1.25e2', '1.25e-2', '1_2.3_4e+0_2', '0e-0', '2.5000', '100e-2', '.0000000000000000000000001', '999999999999999999999999999999999999999.125', '1e99', '1e-99', '0.000e+3', '000.000e-3', '9_9.9_9E-0_2'];
for (const [index, text] of vectors.entries()) {
  const name = names[index % names.length], model = exact(text);
  runtime('exact-vector-' + index, eligible(name) + observe(`${text}${name}.value`), display(model.value), { decimal: layoutIdentity(model.row), fraction: { numerator: String(model.value.n), denominator: String(model.value.d) } });
}
runtime('always-ratio-even-integral', eligible() + observe('10Parcel.value') + observe('1.000Parcel.value') + 'print(10Parcel.value == 10)\n', '10\n1\n1\n1\nTrue\n');
runtime('integer-marker-remains-int', 'from naja.literal import integer_literal\n' + definition('Whole', undefined, '@integer_literal\n') + 'print(17Whole.value)\n', '17\n');
runtime('integer-marker-reader-proves-int', api + 'from naja.literal import integer_literal\n' + definition('Whole', undefined, '@integer_literal\n') + 'print(numerator(17Whole.value))\n', '', { exit: 105, stderr: typeError });
runtime('ordinary-exact-class-int-is-not-coerced', eligible() + 'print(Parcel(10).value)\nprint(numerator(Parcel(10).value))\n', '10\n', { exit: 105, stderr: typeError });
runtime('py-exact-marker-conventional-ratio', eligible() + observe('Parcel(rational(-5, 2)).value'), '-5\n2\n', { extension: 'py' });
runtime('ordinary-negative-ratio-constructor', eligible() + observe('Parcel(rational(-5, 2)).value'), '-5\n2\n');
runtime('two-unrelated-exact-classes', api + marker + definition('Cobalt', '        self.value = value + 7\n') + definition('Topaz', '        self.value = value * 3\n') + observe('1.25Cobalt.value') + observe('2.5Topaz.value'), '33\n4\n15\n2\n');
runtime('aliased-marker', api + 'from naja.literal import exact_literal as precise\n' + definition('Packet', undefined, '@precise\n') + observe('.75Packet.value'), '3\n4\n');
runtime('canonical-marker-type-and-data', api + 'from ｎａｊａ.ｌｉｔｅｒａｌ import ｅｘａｃｔ＿ｌｉｔｅｒａｌ as ℒiteral\n' + definition('Kappa', '        self.value = value\n        self.label = "é🙂量子"\n', '@Literal\n') + observe('0.125Kappa.value') + 'print(0.125Kappa.label)\n', '1\n8\né🙂量子\n');
runtime('logical-decorator-adjacency', api + marker + '@exact_literal\n\n# 9.9Wrong @other\n' + definition('Crate', undefined, '') + observe('1.5Crate.value'), '3\n2\n');
runtime('brace-suites', api + marker + '@exact_literal\nclass Box: {\ndef __init__(self, value): {\nself.value = value\n}\ndef read(self): {\nreturn self.value\n}\n}\n' + observe('(1.25Box).read()'), '5\n4\n');
runtime('depth-marked-suites', api + marker + '@exact_literal\nclass Gauge:(0)\n    def __init__(self, value):(1)\n        self.value = value\n    def read(self):(1)\n        return self.value\n' + observe('1.25Gauge.read()'), '5\n4\n');
runtime('named-transparent-group', eligible() + '{# Exact stage #\nvalue = .25Parcel\n}\n' + observe('value.value'), '1\n4\n');
runtime('postfix-method-and-index', eligible('Vector', '        self.items = [value, value + 1]\n') + '    def read(self): return self.items[1]\n' + observe('(1.25Vector).read()') + observe('1.25Vector.items[-1]'), '9\n4\n9\n4\n');
runtime('inert-identifiers-strings-comments', eligible() + 'amountParcel = 23\nprint(amountParcel)\nprint("1.25Parcel @exact_literal")\n# 1e99999Unknown\n' + observe('.25Parcel.value'), '23\n1.25Parcel @exact_literal\n1\n4\n');

const effectClass = eligible('Pulse', '        print(numerator(value))\n        print(denominator(value))\n        self.value = value\n');
runtime('constructor-once-per-use-and-alias', effectClass + 'a = 1.5Pulse\nb = a\nb.value = b.value + 1\n' + observe('a.value') + 'print(a == b)\nprint(a == 1.5Pulse)\n', '3\n2\n5\n2\nTrue\n3\n2\nFalse\n');
runtime('constructor-argument-effects-left-to-right', effectClass + 'def pick(a, b): return a.value + b.value\n' + observe('pick(.5Pulse, 1.25Pulse)'), '1\n2\n5\n4\n7\n4\n');
runtime('list-construction-order', effectClass + 'items = [.5Pulse, 1.25Pulse]\n' + observe('items[1].value'), '1\n2\n5\n4\n5\n4\n');
runtime('short-circuit-skips-effectful-construction', effectClass + 'print(False and .5Pulse)\nprint(True or 1.25Pulse)\n' + observe('(True and .75Pulse).value') + 'if False:\n    9.25Pulse\n', 'False\nTrue\n3\n4\n3\n4\n');
runtime('loop-constructor-is-never-folded', effectClass + 'index = 0\nitem = None\nwhile index < 3:\n    item = .5Pulse\n    index = index + 1\n' + observe('item.value'), '1\n2\n1\n2\n1\n2\n1\n2\n');
runtime('function-return-and-parameter-mutation', eligible() + 'def make(): return .5Parcel\ndef update(item):\n    item.value = item.value + 1\n    return item\na = make()\nb = update(a)\n' + observe('a.value') + 'print(a == b)\n', '3\n2\nTrue\n');
for (const sign of ['-', '+']) runtime('unary-after-construction-' + (sign === '-' ? 'minus' : 'plus'), effectClass + sign + '1.25Pulse\n', '5\n4\n', { exit: 105, stderr: typeError });
runtime('initializer-return-failure-preserves-effects', eligible('Fault', '        print(numerator(value))\n        return 1\n') + '.5Fault\n', '1\n', { exit: 105, stderr: 'NJA205: native initializer must return None\n' });
runtime('initializer-assertion-failure-preserves-effects', eligible('Fault', '        print(numerator(value))\n        assert value < 0\n') + '.5Fault\n', '1\n', { exit: 104, stderr: 'NJA204: assertion failed\n' });
runtime('ordinary-object-truth-and-display-boundary', eligible() + 'print(not 0Parcel)\nprint(not 0.0Parcel)\nprint(.5Parcel)\n', 'False\nFalse\n', { exit: 105, stderr: typeError });
runtime('no-implicit-quantity-arithmetic', eligible() + '.5Parcel + .25Parcel\n', '', { exit: 105, stderr: typeError });
runtime('ratio-arithmetic-through-field', eligible() + observe('(.1Parcel.value + .2Parcel.value) * 10') + 'print(.1Parcel.value + .2Parcel.value == .3Parcel.value)\n', '3\n1\nTrue\n');

suffixReject('unknown-original-crlf-nonbmp-span', '# café🙂\r\nitems = ["é🙂", .125未定義]\r\n', '.125', '未定義');
suffixReject('ineligible-original-suffix-span', definition('Plain', undefined, '') + '1.25Plain\n', '1.25', 'Plain');
suffixReject('later-class-original-suffix-span', marker + '1.25Later\n' + definition('Later'), '1.25', 'Later');
suffixReject('canonical-original-suffix-span', '# é🙂\nitems = ["é🙂", 1e-2Ｌａｔｅｒ]\n', '1e-2', 'Ｌａｔｅｒ');
suffixReject('parameter-shadow', eligible() + 'def read(Parcel): return 1.25Parcel\nread(0)\n', '1.25', 'Parcel', shadow);
suffixReject('canonical-parameter-shadow', eligible('Kappa') + 'def read(Kappa): return .5Kappa\nread(0)\n', '.5', 'Kappa', shadow);
suffixReject('reassigned-parameter-shadow', eligible() + 'def read(Parcel):\n    Parcel = 7\n    return 1e2Parcel\nread(0)\n', '1e2', 'Parcel', shadow);
suffixReject('value-binding-shadow', 'Measure = 7\n1.25Measure\n', '1.25', 'Measure', shadow);
for (const text of ['1.5', '.5', '1.', '1e3']) {
  const source = 'from naja.literal import integer_literal\n' + definition('Whole', undefined, '@integer_literal\n') + text + 'Whole\n';
  suffixReject('integer-only-decimal-refusal-' + Buffer.from(text).toString('hex'), source, text, 'Whole', integerOnly);
}
for (const [name, body] of [['absent', '    pass\n'], ['receiver-only', '    def __init__(self): pass\n'], ['two-values', '    def __init__(self, a, b): pass\n']]) {
  const source = marker + '@exact_literal\nclass Invalid:\n' + body;
  reject('initializer-eligibility-' + name, source, { message: 'exact literal capability requires an initializer with exactly one value parameter', range: range(source, 'Invalid') });
}
for (const [name, source] of [
  ['ambient-marker', '@exact_literal\nclass C:\n    def __init__(self, value): pass\n'],
  ['called-marker', marker + '@exact_literal()\nclass C:\n    def __init__(self, value): pass\n'],
  ['attribute-decorator', marker + '@exact_literal.other\nclass C:\n    def __init__(self, value): pass\n'],
  ['stacked-marker', marker + '@exact_literal\n@exact_literal\nclass C:\n    def __init__(self, value): pass\n'],
  ['mixed-stacked-markers', 'from naja.literal import exact_literal, integer_literal\n@exact_literal\n@integer_literal\nclass C:\n    def __init__(self, value): pass\n'],
  ['function-marker', marker + '@exact_literal\ndef f(value): return value\n'],
  ['marker-call', marker + 'exact_literal(1)\n'], ['marker-value', marker + 'x = exact_literal\n'],
  ['nested-marker', marker + 'if True:\n    @exact_literal\n    class C:\n        def __init__(self, value): pass\n'],
  ['late-import', 'print(1)\n' + marker],
  ['canonical-import-collision', 'from naja.literal import exact_literal as Key, integer_literal as Key\n'],
  ['old-marker-spelling-after-alias', 'from naja.literal import exact_literal as precise\n' + definition('C')],
  ['constructor-alone-does-not-opt-in', definition('Plain', undefined, '') + '.5Plain\n'],
  ['unsupported-qualified-type', eligible() + '.5module.Parcel\n'],
  ['whitespace-not-adjacent', eligible() + '1.25 Parcel\n'], ['tab-not-adjacent', eligible() + '.5\tParcel\n'],
]) reject(name, source);

for (const text of ['1.25eUnit', '1.25EUnit', '1.25jUnit', '1.25JUnit', '1e3Elephant', '1e3elephant', '1e3Joule', '1e3joule', '1.25_Type', '1e3_Type', '0xffParcel', '0b10Parcel', '0o7Parcel']) reject('ambiguous-' + Buffer.from(text).toString('hex'), eligible() + text + '\n', { code: 'F0006', messageIncludes: 'use an explicit constructor' });
for (const text of ['01Parcel', '1__0Parcel', '1._5Parcel', '1_.5Parcel', '1.5_Parcel', '1.5__0Parcel', '1e+Parcel', '1e-Parcel', '1e_3Parcel', '1e3_Parcel', '1e3__0Parcel', '1.5e+_2Parcel', '0x_Parcel', '0b2Parcel']) reject('malformed-' + Buffer.from(text).toString('hex'), eligible() + text + '\n', { code: 'F0006' });
for (const text of ['.5Parcel', '1.Parcel', '1.e3Parcel', '01.5Parcel', '1e3Parcel', '10Parcel']) reject('py-suffix-' + Buffer.from(text).toString('hex'), eligible() + text + '\n', { extension: 'py', code: 'F0006' });
for (const text of ['1e3', '1E+3', '1e-3', '1.25', '.5', '1.', '1.e3', '01.5']) {
  lexical('ordinary-float-token-' + Buffer.from(text).toString('hex'), 'print(' + text + ')\n', text, 'Float');
  reject('ordinary-float-source-' + Buffer.from(text).toString('hex'), 'print(' + text + ')\n');
}
for (const text of ['0xff', '0X_FF', '0b_101', '0o7', '1_000', '00', '0_0']) lexical('ordinary-integer-token-' + Buffer.from(text).toString('hex'), 'print(' + text + ')\n', text, 'Integer');
for (const text of ['1j', '1J', '1.5j']) reject('ordinary-imaginary-' + Buffer.from(text).toString('hex'), text + '\n', { code: 'F0013' });
for (const text of ['.5Parcel', '1.Parcel', '1.e3Parcel', '01.5Parcel', '1_2.3_4e+0_2Parcel']) lexical('typed-decimal-token-' + Buffer.from(text).toString('hex'), text + '\n', text, 'TypedDecimal');
lexical('typed-integer-token-unchanged', '10Parcel\n', '10Parcel', 'TypedInteger');

// Complete literal inventories for boundary fixtures. No value conversion or
// million-digit power allocation is needed to predict check-only outcomes.
const boundaryDefinition = definition();
const baseLedger = (extraNames = []) => { const ledger = new Ledger(); ledger.name('__init__').name('value'); for (const name of extraNames) ledger.name(name); return ledger; };
function boundary(name, raw, options = {}) {
  const ledger = baseLedger(options.extraNames), prefix = options.prefix ?? '', body = options.body ?? (raw + 'Parcel\n');
  for (const entry of options.ordinary ?? []) ledger.ordinary(entry.kind, entry.data);
  const accepted = ledger.pair(raw);
  const source = marker + (options.definition ?? boundaryDefinition) + prefix + body;
  const details = { ledger: ledger.identity() };
  if (name.endsWith('-exact') || name.endsWith('-exact-expansion')) { assert.equal(accepted, true, name); assert.equal(ledger.total, MAX, name); }
  if (name.endsWith('-one-over')) { assert.equal(accepted, false, name); assert.equal(BigInt(ledger.entries.at(-1).attempted_total), MAX + 1n, name); }
  if (accepted) checkOnly(name, source, details);
  else reject(name, source, { ...details, message: expansionError, range: range(source, raw, source.indexOf(prefix) + prefix.length) });
}
const exactShift = MAX - 13n - 2n;
for (const sign of ['', '-']) for (const delta of [0n, 1n]) boundary('expansion-' + (sign ? 'negative' : 'positive') + '-' + (delta ? 'one-over' : 'exact'), '1e' + sign + (exactShift + delta));
for (const coefficient of ['0', '000.000']) for (const sign of ['+', '-']) boundary('zero-no-shortcut-' + (coefficient === '0' ? 'integer' : 'decimal') + '-' + (sign === '+' ? 'positive' : 'negative'), coefficient + 'e' + sign + '999999999999999999999999999999999999999999999999999999999999');
boundary('huge-positive-exponent-no-overflow', '1e' + '9'.repeat(200));
boundary('huge-negative-exponent-no-overflow', '1e-' + '9'.repeat(200));
boundary('leading-zero-exponent-exact-expansion', '1e+' + '0'.repeat(1024) + exactShift);
runtime('leading-zero-exponent-small-value', eligible() + observe(('1e-' + '0'.repeat(4096) + '2') + 'Parcel.value'), '1\n100\n');
boundary('skipped-branch-expansion-one-over', '1e' + (exactShift + 1n), { body: 'if False:\n    1e' + (exactShift + 1n) + 'Parcel\n' });
boundary('unused-function-expansion-one-over', '1e' + (exactShift + 1n), { body: 'def unused():\n    return 1e' + (exactShift + 1n) + 'Parcel\nprint(None)\n' });
for (const delta of [0n, 1n]) {
  const raw = '1e' + (exactShift - 6n + delta);
  boundary('decoded-text-ledger-' + (delta ? 'one-over' : 'exact'), raw, { prefix: 'text = "é🙂"\n', ordinary: [{ kind: 'decoded_text', data: 'é🙂' }] });
}
for (const delta of [0n, 1n]) {
  const raw = '1e' + (exactShift - 3n + delta);
  boundary('decoded-bytes-ledger-' + (delta ? 'one-over' : 'exact'), raw, { prefix: 'data = b"\\x00\\xffA"\n', ordinary: [{ kind: 'decoded_bytes', data: Buffer.from([0, 255, 65]) }] });
}
for (const delta of [0n, 1n]) {
  const raw = '1e' + (exactShift - 7n + delta);
  boundary('ordinary-int-ledger-' + (delta ? 'one-over' : 'exact'), raw, { prefix: 'ordinary = 1234567\n', ordinary: [{ kind: 'integer_string', data: '1234567' }] });
}
for (const delta of [0n, 1n]) {
  const raw = '1e' + (exactShift - 5n + delta);
  boundary('duplicate-static-name-occurrence-' + (delta ? 'one-over' : 'exact'), raw, { definition: definition('Parcel', '        self.value = value\n        self.ｖａｌｕｅ = value\n'), extraNames: ['value'] });
}
for (const delta of [0n, 1n]) {
  const first = '1e524279', second = '2e' + (524280n + delta), ledger = baseLedger();
  assert.equal(ledger.pair(first), true); const accepted = ledger.pair(second);
  assert.equal(accepted, delta === 0n); assert.equal(BigInt(ledger.entries.at(-1).attempted_total), MAX + delta);
  const source = marker + boundaryDefinition + '(' + first + 'Parcel, ' + second + 'Parcel)\n';
  if (accepted) checkOnly('aggregate-pairs-exact', source, { ledger: ledger.identity() });
  else reject('aggregate-pairs-one-over', source, { ledger: ledger.identity(), message: expansionError, range: range(source, second) });
}
// Source-visible zeros cannot be trimmed or canceled to evade the ledger.
for (const delta of [0n, 1n]) {
  const raw = '000.000e' + (exactShift - 2n + delta);
  boundary('raw-coefficient-zeros-' + (delta ? 'one-over' : 'exact'), raw);
}

const workOracles = [];
for (const [limbs, expected] of [[49, 971506n], [50, 1011132n]]) {
  const raw = '1.' + '0'.repeat(9 * (limbs - 1)), model = exact(raw), work = constructorWork(BigInt(model.numerator), BigInt(model.denominator));
  assert.equal(BigInt(work.required_units_if_completed), expected);
  workOracles.push({ name: 'direct-decimal-work-' + limbs, decimal: layoutIdentity(model.row), ...work });
  runtime('direct-decimal-work-' + limbs, eligible('Pulse', '        print("initialized")\n        self.value = value\n') + (limbs === 49 ? observe(raw + 'Pulse.value') : raw + 'Pulse\nprint("unreachable")\n'), limbs === 49 ? 'initialized\n1\n1\n' : '', { ...(limbs === 50 ? { exit: 103, stderr: workError } : {}), work: workOracles.at(-1) });
}
runtime('short-circuit-skips-native-work-guard', eligible() + 'print(False and 1.' + '0'.repeat(441) + 'Parcel)\nprint(True or 1.' + '0'.repeat(441) + 'Parcel)\n', 'False\nTrue\n');
runtime('postfix-height-128', eligible('Chain', '        self.next = self\n') + 'item = .5Chain' + '.next'.repeat(125) + '\nprint(item == item.next)\n', 'True\n');
reject('postfix-height-129', eligible('Chain', '        self.next = self\n') + 'item = .5Chain' + '.next'.repeat(126) + '\n', { messageIncludes: '128' });
reject('generated-node-budget', eligible() + '.5Parcel\n'.repeat(2501), { messageIncludes: '10000' });
reject('unchanged-suite-budget', eligible() + Array.from({ length: 65 }, (_, index) => '    '.repeat(index) + 'if True:\n').join('') + '    '.repeat(65) + '.5Parcel\n', { messageIncludes: '64' });
reject('unchanged-source-budget', '# ' + 'x'.repeat(1_048_576) + '\n', { code: 'NJA100', json: false });
runtime('unchanged-arena-budget', eligible() + 'while True:\n    1Parcel\n', '', { exit: 103, stderr: 'NJA203: native value arena exhausted\n' });
runtime('unchanged-call-depth-budget', eligible('Recursive', '        self.next = Recursive(value)\n') + '1Recursive\n', '', { exit: 103, stderr: 'NJA203: native user-call depth limit exceeded\n' });
const imports = count => Array.from({ length: count }, (_, i) => 'from naja.literal import exact_literal as exact' + i + '\n').join('');
checkOnly('marker-import-budget-128', imports(128) + definition('Boundary', undefined, '@exact127\n') + '.5Boundary\n');
reject('marker-import-budget-129', imports(129) + 'print(None)\n', { messageIncludes: '128' });

const equalForms = ['1.25', '125e-2', '.0125e2', '01.2500'];
for (const [index, text] of equalForms.entries()) runtime('equal-value-scale-metamorph-' + index, eligible('Prism') + observe(text + 'Prism.value'), '5\n4\n');
runtime('crlf-rename-metamorph', (eligible('Mosaic') + observe('.125Mosaic.value')).replaceAll('\n', '\r\n'), '1\n8\n');
runtime('comment-metamorph', (eligible('Mosaic') + observe('.125Mosaic.value')).split('\n').map(line => line ? line + ' # .5Unknown @wrong {# inert #}' : line).join('\n'), '1\n8\n');
runtime('changed-decimal-control', eligible('Quartz') + observe('.126Quartz.value'), '63\n500\n', { controlOriginalStdout: '1\n8\n' });
runtime('changed-exponent-control', eligible('Quartz') + observe('1.25e1Quartz.value'), '25\n2\n', { controlOriginalStdout: '5\n4\n' });
runtime('changed-constructor-control', eligible('Quartz', '        self.value = value + 7\n') + observe('1.25Quartz.value'), '33\n4\n', { controlOriginalStdout: '5\n4\n' });
suffixReject('removed-marker-control', definition('Quartz', undefined, '') + '1.25Quartz\n', '1.25', 'Quartz');

assert.equal(new Set(cases.map(test => test.name)).size, cases.length);
for (const test of cases) assert.match(test.name, /^[a-z][a-z0-9-]*$/);
const identity = test => ({ name: test.name, extension: test.extension, mode: test.mode, source_bytes: Buffer.byteLength(test.source), source_sha256: hash(test.source), expected_exit: test.mode === 'runtime' ? test.exit : test.mode === 'reject' ? 1 : 0, expected_stdout: test.stdout ?? null, expected_stderr: test.stderr ?? null, expected_diagnostic_code: test.code ?? null, expected_diagnostic_message: test.message ?? null, expected_diagnostic_substring: test.messageIncludes ?? null, expected_original_range: test.range ?? null, expected_lexical_token: test.mode === 'lex' ? { text: test.tokenText, kind: test.tokenKind, byte_start: Buffer.byteLength(test.source.slice(0, test.source.indexOf(test.tokenText))), byte_end: Buffer.byteLength(test.source.slice(0, test.source.indexOf(test.tokenText))) + Buffer.byteLength(test.tokenText) } : null, input_error_without_json: test.json === false, control_original_stdout: test.controlOriginalStdout ?? null, decimal: test.decimal ?? null, expected_fraction: test.fraction ?? null, literal_ledger: test.ledger ?? null, rational_work: test.work ?? null });

process.chdir(root);
mkdirSync(resolve('target'), { recursive: true });
const directory = mkdtempSync(resolve('target/exact-literals-language-'));
const compiler = resolve('target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
const started = Date.now(), commands = [], results = [];
let activeCase = null;
function command(executable, args, options = {}) {
  const { timeout = budgets.cli_ms, ...rest } = options, remaining = budgets.overall_ms - (Date.now() - started);
  assert.ok(remaining > 0, 'overall exact-literal deadline exceeded');
  const result = spawnSync(executable, args, { cwd: root, maxBuffer: budgets.capture_bytes_per_child, ...rest, timeout: Math.min(timeout, remaining), encoding: null });
  const index = commands.length;
  writeFileSync(join(directory, `command-${index}.stdout`), result.stdout ?? Buffer.alloc(0), { flag: 'wx' });
  writeFileSync(join(directory, `command-${index}.stderr`), result.stderr ?? Buffer.alloc(0), { flag: 'wx' });
  commands.push({ executable, arguments: args, exit: result.status, signal: result.signal, error: result.error?.code ?? null, stdout_sha256: hash(result.stdout ?? Buffer.alloc(0)), stderr_sha256: hash(result.stderr ?? Buffer.alloc(0)) });
  assert.ifError(result.error); assert.equal(result.signal, null, 'unexpected child signal'); return result;
}
const sourceHead = command('git', ['rev-parse', 'HEAD']).stdout.toString().trim();
if (expectedSource !== null) assert.equal(sourceHead, expectedSource, 'source commit mismatch');
const harnessHash = hash(readFileSync(fileURLToPath(import.meta.url))), contractHash = hash(readFileSync(join(fixtureRoot, 'CONTRACT.md')));
const plan = { schema_version: 1, state: 'prepared', source_base_commit: sourceBase, authority_adr_commit: adrCommit, host: process.platform + '-' + process.arch, node: process.version, target: 'x86_64-unknown-linux-gnu', harness_sha256: harnessHash, contract_sha256: contractHash, budgets, rational_work_checkpoints: workCheckpoints, rational_work_oracles: workOracles, passed: 0, not_run: cases.length, results: cases.map(test => ({ ...identity(test), result: 'not_run' })) };
writeFileSync(join(directory, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
for (const test of cases) writeFileSync(join(directory, test.name + '.' + test.extension), test.source, { flag: 'wx' });
process.on('uncaughtExceptionMonitor', error => {
  const completed = new Set(results.map(test => test.name));
  try { writeFileSync(join(directory, 'failure.json'), JSON.stringify({ schema_version: 1, state: 'failed', source_commit: sourceHead, results: [...results, ...cases.filter(test => !completed.has(test.name)).map(test => ({ ...identity(test), result: test === activeCase ? 'failed' : 'not_run' }))], commands, error: { name: error.name, message: error.message } }, null, 2) + '\n', { flag: 'wx' }); }
  catch { /* Preserve the original failure if evidence storage also fails. */ }
});
if (prepareOnly) console.log(`${cases.length} exact-literal outcomes prepared, all not_run. Artifacts: ${portable(relative(root, directory))}`);
else {
  const frozen = JSON.parse(readFileSync(join(fixtureRoot, 'PREPARATION.json'), 'utf8'));
  // The preparation host is evidence metadata; the execution host is recorded
  // separately. Every semantic identity, budget and pinned tool version stays frozen.
  const { host: preparationHost, ...frozenContract } = frozen;
  const { host: executionHost, ...executionContract } = plan;
  assert.equal(typeof preparationHost, 'string');
  assert.equal(executionHost, process.platform + '-' + process.arch);
  assert.deepEqual(frozenContract, executionContract, 'frozen independent sources, model, expectations, budgets and identities');
  assert.equal(command('git', ['diff', '--exit-code', 'HEAD', '--', 'Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml', 'bootstrap', 'backends']).status, 0, 'compiler sources changed');
  assert.equal(command('git', ['ls-files', '--others', '--exclude-standard', '--', 'bootstrap', 'backends']).stdout.length, 0, 'untracked compiler source');
  const built = command('cargo', ['+1.97.1', 'build', '--workspace', '--locked', '--offline'], { timeout: budgets.compiler_build_ms }); assert.equal(built.status, 0, built.stderr.toString());
  const version = command(compiler, ['--version']); assert.equal(version.status, 0);
  let linuxDirectory = directory;
  if (process.platform === 'win32') {
    const platform = command('wsl.exe', ['--exec', '/usr/bin/uname', '-sm']); assert.equal(platform.status, 0); assert.equal(platform.stdout.toString().trim(), 'Linux x86_64');
    const translated = command('wsl.exe', ['--exec', '/usr/bin/wslpath', '-a', portable(directory)]); assert.equal(translated.status, 0); linuxDirectory = translated.stdout.toString().trim();
  } else { assert.equal(process.platform, 'linux'); assert.equal(process.arch, 'x64'); }
  for (const test of cases) {
    activeCase = test;
    const input = join(directory, test.name + '.' + test.extension), artifact = join(directory, test.name + '.elf'), record = { ...identity(test) };
    if (test.mode === 'lex') {
      const lexed = command(compiler, ['lex', input]); assert.equal(lexed.status, 0, test.name + ': ' + lexed.stderr); assert.equal(lexed.stderr.length, 0);
      const token = identity(test).expected_lexical_token; assert.ok(lexed.stdout.toString().split(/\r?\n/).includes(`${token.byte_start}..${token.byte_end} ${token.kind} ${JSON.stringify(token.text)}`), test.name + ': exact lexical kind/text/range'); record.lex_exit = lexed.status;
    } else {
      const checked = command(compiler, ['check', input, ...(test.json === false ? [] : ['--json'])]); record.check_exit = checked.status;
      if (test.mode === 'check') { assert.equal(checked.status, 0, test.name + ': ' + checked.stdout + checked.stderr); assert.equal(checked.stderr.length, 0); assert.equal(JSON.parse(checked.stdout.toString()).status, 'passed'); }
      else {
        const emitted = command(compiler, ['build', input, '--target', 'x86_64-unknown-linux-gnu', '--output', artifact]); record.build_exit = emitted.status;
        if (test.mode === 'reject') {
          assert.equal(checked.status, 1, test.name + ': check must reject'); assert.equal(emitted.status, 1, test.name + ': build must reject'); assert.equal(existsSync(artifact), false); assert.equal(emitted.stdout.length, 0); assert.ok(emitted.stderr.toString().includes(test.code + ':'), test.name + ': build diagnostic code');
          if (test.message !== undefined) assert.ok(emitted.stderr.toString().includes(test.message), test.name + ': build message');
          if (test.messageIncludes !== undefined) assert.ok(emitted.stderr.toString().includes(test.messageIncludes), test.name + ': build category');
          if (test.json === false) { assert.equal(checked.stdout.length, 0); assert.ok(checked.stderr.toString().includes(test.code + ':')); }
          else {
            assert.equal(checked.stderr.length, 0); const report = JSON.parse(checked.stdout.toString()); assert.equal(report.schema_version, 1); assert.equal(report.status, 'failed');
            const matches = report.diagnostics.filter(row => row.code === test.code && (test.message === undefined || row.message === test.message) && (test.messageIncludes === undefined || row.message.includes(test.messageIncludes))); assert.ok(matches.length, test.name + ': frozen diagnostic');
            if (test.range !== undefined) assert.ok(matches.some(row => JSON.stringify({ start: row.start, end: row.end }) === JSON.stringify({ start: test.range.start, end: test.range.end })), test.name + ': original UTF-16 range'); record.diagnostics = report.diagnostics;
          }
        } else {
          assert.equal(checked.status, 0, test.name + ': ' + checked.stdout + checked.stderr); assert.equal(checked.stderr.length, 0); assert.equal(JSON.parse(checked.stdout.toString()).status, 'passed'); assert.equal(emitted.status, 0, test.name + ': ' + emitted.stderr);
          const linuxArtifact = linuxDirectory + '/' + test.name + '.elf'; let executed;
          if (process.platform === 'win32') { assert.equal(command('wsl.exe', ['--exec', '/usr/bin/chmod', 'u+x', linuxArtifact]).status, 0); executed = command('wsl.exe', ['--exec', '/usr/bin/timeout', '--signal=TERM', '--kill-after=1s', String(budgets.native_seconds), linuxArtifact]); }
          else { chmodSync(artifact, 0o700); executed = command('/usr/bin/timeout', ['--signal=TERM', '--kill-after=1s', String(budgets.native_seconds), artifact]); }
          assert.equal(executed.status, test.exit, test.name + ': native exit: ' + executed.stderr); assert.deepEqual(executed.stdout, bytes(test.stdout), test.name + ': stdout'); assert.deepEqual(executed.stderr, bytes(test.stderr), test.name + ': stderr');
          if (test.controlOriginalStdout !== undefined) { assert.throws(() => assert.deepEqual(executed.stdout, bytes(test.controlOriginalStdout)), error => error.code === 'ERR_ASSERTION'); record.control_outcome = 'original_output_oracle_rejected_changed_source'; }
          Object.assign(record, { native_exit: executed.status, elf_sha256: hash(readFileSync(artifact)), stdout_sha256: hash(executed.stdout), stderr_sha256: hash(executed.stderr) });
        }
      }
    }
    record.result = 'passed'; results.push(record); activeCase = null; console.log('PASS ' + test.name);
  }
  writeFileSync(join(directory, 'summary.json'), JSON.stringify({ schema_version: 1, state: 'executed', source_commit: sourceHead, harness_sha256: harnessHash, contract_sha256: contractHash, budgets, host: process.platform + '-' + process.arch, target: 'x86_64-unknown-linux-gnu', node: process.version, compiler_version: version.stdout.toString().trim(), compiler_sha256: hash(readFileSync(compiler)), passed: results.length, not_run: 0, commands, results }, null, 2) + '\n', { flag: 'wx' });
  console.log(`${results.length} exact-literal checks passed. Artifacts: ${portable(relative(root, directory))}`);
  console.log('Scope: explicit exact same-module literal construction. General Decimal/protocols/quantities, FC1 and HATCH remain open.');
}
