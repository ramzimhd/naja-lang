// Frozen independent interval source proof; Node BigInt only, no Python oracle.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = resolve(root, 'tests/intervals-source');
const sourceBase = '8dbea5fc4a189bf4bf39017febe30d4afa37f056';
const adrCommit = '44c091d19b1e6d1b17e697694fd5ea28a768110f';
const hash = value => createHash('sha256').update(value).digest('hex');
const portable = value => value.replaceAll('\\', '/');
const budgets = { native_seconds: 5, cli_ms: 20_000, compiler_build_ms: 45_000, overall_ms: 300_000, capture_bytes_per_child: 8 * 1024 * 1024 };
let prepareOnly = false, expectedSource = null;
const argv = process.argv.slice(2);
for (let index = 0; index < argv.length; index++) {
  if (argv[index] === '--prepare-only') { assert.equal(prepareOnly, false); prepareOnly = true; }
  else if (argv[index] === '--expect-source') { assert.equal(expectedSource, null); expectedSource = argv[++index]; assert.match(expectedSource ?? '', /^[0-9a-f]{40}$/); }
  else assert.fail('unsupported harness option: ' + argv[index]);
}
assert.notEqual(prepareOnly, expectedSource !== null, 'choose --prepare-only or --expect-source FULL_COMMIT_HASH');
const API = 'from naja.numeric import checked_int\n';
const PROBE = API + 'def probe(value, lower, upper):\n    return checked_int(value, lower, upper)\n';
const MARK = 'def mark(label, value):\n    print(label)\n    return value\n';
const TYPE = { exit: 105, stderr: 'NJA205: native value type mismatch\n' };
const RANGE = { exit: 112, stderr: 'NJA212: integer interval check failed\n' };
const EMPTY = { exit: 113, stderr: 'NJA213: empty integer interval\n' };
const WORK = { exit: 103, stderr: 'NJA203: native integer interval work limit exceeded\n' };
const ARENA = { exit: 103, stderr: 'NJA203: native value arena exhausted\n' };
const ZERO = { exit: 106, stderr: 'NJA206: integer division by zero\n' };
const messages = { type: 'integer interval requires Int or Bool', empty: 'integer interval lower bound exceeds upper bound', range: 'constant is outside the inclusive integer interval', endpoint: 'integer interval endpoints require signed decimal integer literals' };
const cases = [];
const runtime = (name, source, stdout = '', options = {}) => cases.push({ name, source, stdout, stderr: '', exit: 0, extension: 'naja', mode: 'runtime', ...options });
const reject = (name, source, options = {}) => cases.push({ name, source, extension: 'naja', mode: 'reject', code: 'NJA101', ...options });
const checkOnly = (name, source, options = {}) => cases.push({ name, source, extension: 'naja', mode: 'check', ...options });
function range(source, text, occurrence = 0) {
  let at = -1;
  for (let index = 0; index <= occurrence; index++) { at = source.indexOf(text, at + 1); assert.ok(at >= 0, 'range text exists'); }
  const position = offset => { const before = source.slice(0, offset).split(/\r\n|\r|\n/); return { line: before.length - 1, character: before.at(-1).length }; };
  return { start: position(at), end: position(at + text.length) };
}
const display = value => typeof value === 'boolean' ? value ? 'True\n' : 'False\n' : value + '\n';
const number = value => typeof value === 'boolean' ? value ? 1n : 0n : value;
const literal = value => typeof value === 'boolean' ? value ? 'True' : 'False' : '(' + value + ')';
function model(value, lower, upper) { const [v, lo, hi] = [value, lower, upper].map(number); return lo > hi ? EMPTY : v < lo || v > hi ? RANGE : { exit: 0, stderr: '' }; }

// Finite independent values, including values beyond every machine integer width.
const huge = 10n ** 91n + 773n;
const vectors = [[0n, 0n, 0n], [false, false, true], [true, false, true], [-1n, -1n, 0n], [1n, 0n, 1n], [-huge, -huge, huge], [huge, -huge, huge], [huge - 1n, -huge, huge]];
for (let index = 0; index < 36; index++) {
  const lower = BigInt((index * 37 + 11) % 101 - 50), width = BigInt(index % 9);
  vectors.push([lower + BigInt(index % (Number(width) + 1)), lower, lower + width]);
}
for (const extension of ['naja', 'py']) {
  const source = PROBE + vectors.map(([v, lo, hi]) => 'print(probe(' + [v, lo, hi].map(literal).join(', ') + '))\n').join('');
  for (const vector of vectors) assert.equal(model(...vector).exit, 0);
  runtime('finite-independent-inclusive-vector-' + extension, source, vectors.map(([value]) => display(value)).join(''), { extension });
}
for (const [name, vector] of [['below-zero', [-1n, 0n, 1n]], ['above-zero', [1n, 0n, 0n]], ['below-huge', [-huge - 1n, -huge, huge]], ['above-huge', [huge + 1n, -huge, huge]], ['empty', [0n, 1n, 0n]], ['bool-empty', [false, true, false]]]) runtime('runtime-' + name, PROBE + 'probe(' + vector.map(literal).join(', ') + ')\n', '', model(...vector));
runtime('static-valid-constants-and-bool-descriptors', API + 'print(checked_int(False, 0, 1))\nprint(checked_int(True, -0, +1))\nprint(checked_int(-(-7), (+7), 7))\nflag: (0 to 1) = True\nprint(flag)\nflag = False\nprint(flag)\n', 'False\nTrue\n7\nTrue\nFalse\n');
runtime('annotation-inclusive-signed-underscores-and-huge', `a: (-${huge} to +${huge}) = -${huge}\nprint(a)\na = ${huge}\nprint(a)\nz: (-0_0 to +0_0) = False\nprint(z)\n`, '-' + huge + '\n' + huge + '\nFalse\n');
runtime('annotation-copy-and-arithmetic-drop-metadata', 'age: (1 to 40) = 40\ncopy = age\ncopy = 99\nprint(copy)\nprint(age + 1)\n', '99\n41\n');
runtime('annotation-runtime-arithmetic-rechecked', 'age: (1 to 40) = 40\nprint(age)\nage = age + 1\n', '40\n', RANGE);
runtime('annotation-dynamic-initialization', 'def identity(value): return value\nage: (1 to 40) = identity(41)\n', '', RANGE);
runtime('annotation-branch-reassignment', 'def choose(value):\n    age: (1 to 40) = 1\n    if True:\n        age = value\n    return age\nprint(choose(40))\nchoose(41)\n', '40\n', RANGE);
runtime('annotation-loop-reassignment', 'age: (1 to 3) = 1\nwhile age < 4:\n    print(age)\n    age = age + 1\n', '1\n2\n3\n', RANGE);
runtime('annotation-function-tables-and-outer-restore', 'age: (1 to 2) = 1\ndef select(value):\n    age: (-5 to 5) = 0\n    age = value\n    return age\nprint(select(-5))\ndef plain(value):\n    age = value\n    return age\nprint(plain(99))\nage = 2\nprint(age)\nage = plain(3)\n', '-5\n99\n2\n', RANGE);
runtime('annotation-braces-named-groups-depth', '{# Native interval #\nage: (1 to 40) = 25\nif True: {\nage = 40\n}\n}\ndef select(value):(0)\n    age: (-2 to 2) = value\n    return age\nprint(age)\nprint(select(-2))\n', '40\n-2\n');
runtime('contextual-to-remains-normal-binding', 'to = 17\nｔｏ = 19\nage: (1 to 40) = to\nprint(age)\n', '19\n');
runtime('interval-does-not-require-int-name', 'int = "user data"\nage: (1 to 40) = 25\nprint(age)\nprint(int)\n', '25\nuser data\n');
runtime('unchanged-py-informational-int-annotation', 'age: int = "retained compatibility"\nage = None\nprint(age)\n', 'None\n', { extension: 'py' });
runtime('unchanged-naja-int-runtime-kind', 'def value(): return "bad"\nage: int = value()\n', '', TYPE);
runtime('canonical-api-alias-and-unicode-slots', 'from ｎａｊａ.ｎｕｍｅｒｉｃ import checked_int as 検査\n年齢: (1 to 40) = 25\nprint(検査(年齢, 1, 40))\n', '25\n');

// Explicit API imports must precede classes and functions; definitions follow PROBE.
const badKinds = [['text', '"x"', '', ''], ['bytes', 'b"x"', '', ''], ['none', 'None', '', ''], ['tuple', '()', '', ''], ['list', '[]', '', ''], ['dict', '{}', '', ''], ['set', '{1}', '', ''], ['object', 'C()', '', 'class C: pass\n'], ['rational', 'rational(1, 1)', 'from naja.numeric import rational\n', '']];
for (const [name, source, imports, definitions] of badKinds) for (let index = 0; index < 3; index++) { const args = ['0', '0', '1']; args[index] = source; runtime('runtime-kind-' + name + '-' + index, imports + PROBE + definitions + 'probe(' + args.join(', ') + ')\n', '', TYPE); }
runtime('effects-all-children-once-left-to-right', PROBE + MARK + 'print(probe(mark("value", 2), mark("lower", 1), mark("upper", 3)))\n', 'value\nlower\nupper\n2\n');
runtime('effects-all-children-before-kind-and-empty', PROBE + MARK + 'probe(mark("value", "bad"), mark("lower", 2), mark("upper", 1))\n', 'value\nlower\nupper\n', TYPE);
runtime('effects-later-kind-before-early-range', PROBE + MARK + 'probe(mark("value", -1), mark("lower", 0), mark("upper", "bad"))\n', 'value\nlower\nupper\n', TYPE);
runtime('effects-child-error-stops-later-arguments', PROBE + MARK + 'probe(mark("value", 1), 1 // 0, mark("unreachable", 3))\n', 'value\n', ZERO);
runtime('effects-later-child-error-before-outer-kind', PROBE + MARK + 'probe(mark("value", "bad"), mark("lower", 1), 1 // 0)\n', 'value\nlower\n', ZERO);
runtime('short-circuit-skips-checks', PROBE + 'print(False and probe(2, 0, 1))\nprint(True or probe(0, 2, 1))\n', 'False\nTrue\n');
runtime('discard-return-container-and-truth-preserve-values', PROBE + 'def get(value):\n    probe(value, 0, 1)\n    return probe(value, 0, 1)\nitems = [get(True), get(False)]\nprint(items[0])\nprint(items[1])\nassert items[0]\nassert not items[1]\n', 'True\nFalse\n');

function proofReject(name, source, message, text, occurrence = 0) { reject(name, source, { message, range: range(source, text, occurrence) }); }
for (const [name, value] of [['below', '-1'], ['above', '2'], ['paren', '((+2))'], ['unary-bool', '-(-(-True))']]) {
  const source = API + `checked_int(${value}, 0, 1)\n`; proofReject('static-api-' + name, source, messages.range, value);
  const annotated = `age: (0 to 1) = ${value}\n`; proofReject('static-annotation-' + name, annotated, messages.range, value);
}
for (const [name, value] of [['text', '"é🙂"'], ['bytes', 'b"bad"'], ['none', 'None'], ['unary-text', '-(+"x")']]) {
  for (let index = 0; index < 3; index++) { const args = ['0', '2', '1']; args[index] = value; const source = API + 'checked_int(' + args.join(', ') + ')\n'; proofReject('static-known-kind-' + name + '-' + index, source, messages.type, value); }
  const source = 'age: (0 to 1) = ' + value + '\n'; proofReject('static-annotation-kind-' + name, source, messages.type, value);
}
proofReject('static-type-priority-in-argument-order', API + 'checked_int(None, "x", b"y")\n', messages.type, 'None');
proofReject('static-empty-even-unknown-value', API + 'def value(): return 0\nchecked_int(value(), 2, 1)\n', messages.empty, '2, 1');
proofReject('static-annotation-empty-even-call', 'def value(): return 0\nage: (2 to 1) = value()\n', messages.empty, '(2 to 1)');
proofReject('static-later-assignment-outside', 'age: (1 to 40) = 25\nage = 41\n', messages.range, '41');
proofReject('static-unused-assignment-still-checked', 'age: (1 to 40) = 25\nif False:\n    age = 41\n', messages.range, '41');
const originalSpan = '# é🙂\r\n年齢: (0 to 1) = ((+2))\r\n';
proofReject('original-unicode-crlf-rhs-span', originalSpan, messages.range, '((+2))');
runtime('unknown-arithmetic-is-runtime-guarded', API + 'checked_int(1 + 1, 0, 1)\n', '', RANGE);
runtime('unknown-container-is-runtime-guarded', API + 'checked_int([], 0, 1)\n', '', TYPE);
runtime('single-known-bound-no-static-range-proof', API + 'def lower(): return 0\nchecked_int(-1, lower(), 1)\n', '', RANGE);
runtime('known-wrong-bound-with-unknown-sibling-type-at-runtime', API + 'def text(): return "bad"\nchecked_int(-1, 0, text())\n', '', TYPE);
for (const [name, spelling] of [['decimal', '1.0'], ['base', '0x1'], ['exponent', '1e0'], ['bool', 'True'], ['expression', '1 + 1'], ['double-sign', '--1'], ['suffix', '1Unknown']]) reject('endpoint-refuses-' + name, `age: (${spelling} to 40) = 25\n`, { message: messages.endpoint });
for (const [name, source] of [['lookalike-to', 'age: (1 ｔｏ 40) = 25\n'], ['uppercase-to', 'age: (1 To 40) = 25\n'], ['missing-to', 'age: (1 40) = 25\n'], ['named-refinement-open', 'type Age = (1 to 40)\n'], ['field-refinement-open', 'class C:\n    age: (1 to 40) = 25\n'], ['parameter-refinement-open', 'def f(age: (1 to 40)): return age\n'], ['duplicate-annotation', 'age: (1 to 40) = 25\nage: (1 to 40) = 26\n']]) reject(name, source);
reject('python-interval-grammar-refuses', 'age: (1 to 40) = 25\n', { extension: 'py' });
for (const [name, source] of [['no-import', 'checked_int(0, 0, 1)\n'], ['arity-zero', API + 'checked_int()\n'], ['arity-two', API + 'checked_int(0, 1)\n'], ['arity-four', API + 'checked_int(0, 0, 1, 2)\n'], ['keyword-arguments', API + 'checked_int(value=0, lower=0, upper=1)\n'], ['starred-arguments', API + 'checked_int(*[0, 0, 1])\n'], ['import-value', API + 'value = checked_int\n'], ['import-rebinding', API + 'checked_int = 7\n'], ['import-parameter-call', API + 'def f(checked_int): return checked_int(0, 0, 1)\n'], ['late-import', 'value = 0\n' + API], ['nested-import', 'def f():\n    from naja.numeric import checked_int\n'], ['canonical-import-collision', 'from naja.numeric import checked_int as Key, checked_int as Key\n']]) reject(name, source);
const imports = count => Array.from({ length: count }, (_, index) => 'from naja.numeric import checked_int as check' + index + '\n').join('');
checkOnly('shared-import-budget-128', imports(128) + 'check127(0, 0, 0)\n');
reject('shared-import-budget-129', imports(129) + 'print(None)\n', { messageIncludes: '128' });

const workOracles = [];
function workModel(nv, nl, nu, stop = 3) {
  let total = 0; const trace = [];
  const debit = (primitive, units) => { const previous = total; total += units; trace.push({ primitive, units, cumulative: total, first_excess: previous <= 1_000_000 && total > 1_000_000 }); };
  for (const [name, n] of [['value', nv], ['lower', nl], ['upper', nu]]) { debit(name + '-descriptor', 1); debit(name + '-raw-scan', 1 + n); }
  for (const [name, n, m] of [['lower-upper', nl, nu], ['value-lower', nv, nl], ['value-upper', nv, nu]].slice(0, stop)) debit(name + '-signed-compare', 1 + 2 * Math.max(n, m));
  return { limit: 1_000_000, required_units_if_completed: total, exceeds: total > 1_000_000, trace };
}
assert.equal(workModel(0, 0, 0).required_units_if_completed, 9);
assert.equal(workModel(1, 1, 1).required_units_if_completed, 18);
for (const [n, expected] of [[111110, 999999], [111111, 1000008]]) {
  const value = '1' + '0'.repeat(9 * (n - 1)), work = workModel(n, n, n); assert.equal(work.required_units_if_completed, expected);
  const name = 'shared-pointer-work-' + n; workOracles.push({ name, counts: [n, n, n], ...work });
  runtime(name, API + 'value = ' + value + '\nchecked_int(value, value, value)\n' + (n === 111110 ? 'print("checked")\n' : ''), n === 111110 ? 'checked\n' : '', { ...(n === 111111 ? WORK : {}), work });
}
const exactWork = workModel(111109, 111109, 111111); assert.equal(exactWork.required_units_if_completed, 1_000_000);
workOracles.push({ name: 'exact-million-work', counts: [111109, 111109, 111111], ...exactWork });
runtime('exact-million-work', API + 'upper = 1' + '0'.repeat(9 * 111110) + '\nvalue = upper // 1000000000000000000\nchecked_int(value, value, upper)\nprint("checked")\n', 'checked\n', { work: exactWork });
const lowWork = workModel(111111, 111111, 111111, 2); assert.equal(lowWork.exceeds, false);
runtime('work-stops-after-below-lower', API + 'value = 1' + '0'.repeat(9 * 111110) + '\nchecked_int(-value, value, value)\n', '', { ...RANGE, work: lowWork });
runtime('work-type-before-large-scans', PROBE + 'value = 1' + '0'.repeat(9 * 111110) + '\nprobe(value, value, None)\n', '', TYPE);

// Every fresh bound leaf and its original signed digits are charged per store.
const literalLedgers = [];
function ledgerCase(name, prefix, prefixBytes, delta = 0) {
  const lowerLength = (1_048_576 - 4 - prefixBytes) / 2; assert.equal(Number.isInteger(lowerLength), true);
  const lower = '-' + '0'.repeat(lowerLength - 1), source = prefix + (delta ? '"x"\n' : '') + `age: (${lower} to +0) = 0\nage = 0\n`;
  const ledger = { limit: 1_048_576, prefix_bytes: prefixBytes + delta, stores: 2, bound_bytes_per_store: lowerLength + 1, rhs_bytes_per_store: 1, attempted_total: 2 * (lowerLength + 2) + prefixBytes + delta };
  assert.equal(ledger.attempted_total, 1_048_576 + delta); literalLedgers.push({ name, ...ledger });
  if (delta) reject(name, source, { messageIncludes: '1 MiB', ledger }); else checkOnly(name, source, { ledger });
}
for (const delta of [0, 1]) {
  ledgerCase('repeated-bound-literal-ledger-' + (delta ? 'one-over' : 'exact'), '', 0, delta);
  ledgerCase('decoded-unicode-literal-ledger-' + (delta ? 'one-over' : 'exact'), '"é🙂"\n', 6, delta);
  ledgerCase('decoded-bytes-literal-ledger-' + (delta ? 'one-over' : 'exact'), 'b"\\x00\\xff"\n', 2, delta);
  ledgerCase('repeated-canonical-member-ledger-' + (delta ? 'one-over' : 'exact'), 'class Holder:\n    def __init__(self, value):\n        self.value = value\n        self.ｖａｌｕｅ = value\n', 18, delta);
}
checkOnly('injected-nodes-exact-10000', 'age: (0 to 0) = 0\n' + 'age = 0\n'.repeat(1999), { nodes: 10000 });
reject('injected-nodes-over-10000', 'age: (0 to 0) = 0\n' + 'age = 0\n'.repeat(2000), { messageIncludes: '10000', nodes: 10005 });
checkOnly('annotation-height-128', 'age: (-1 to 1) = ' + '+'.repeat(126) + '1\n', { height: 128 });
reject('annotation-height-129', 'age: (-1 to 1) = ' + '+'.repeat(127) + '1\n', { messageIncludes: '128', height: 129 });
reject('unchanged-suite-budget', Array.from({ length: 65 }, (_, index) => '    '.repeat(index) + 'if True:\n').join('') + '    '.repeat(65) + 'age: (0 to 1) = 0\n', { messageIncludes: '64' });
reject('unchanged-source-byte-budget', '# ' + 'x'.repeat(1_048_576) + '\n', { code: 'NJA100', json: false });
const recursion = depth => API + 'def descend(value, depth):\n    current: (0 to 1) = value\n    if depth == 1:\n        return checked_int(current, 0, 1)\n    return descend(current, depth - 1)\nprint(descend(True, ' + depth + '))\n';
runtime('native-call-depth-256', recursion(256), 'True\n');
runtime('native-call-depth-257', recursion(257), '', { exit: 103, stderr: 'NJA203: native user-call depth limit exceeded\n' });
const fillArena = 'p = "' + 'p'.repeat(524288) + '"\ns = "' + 's'.repeat(521216) + '"\n' + 'a=p+""\n'.repeat(127) + 'a=s+""\n';
assert.equal(127 * 524312 + 521240, 64 * 1024 * 1024);
runtime('zero-free-arena-api-and-annotated-reassignment', API + 'value = 1\nage: (0 to 1) = True\n' + fillArena + 'checked_int(value, value, value)\nprint(checked_int(True, value, True))\nage = False\nprint(age)\nage = True\nprint(age)\n', 'True\nFalse\nTrue\n');
runtime('zero-free-arena-allocation-control', fillArena + '1 + 1\n', '', ARENA);
const inputSource = 'from naja.io import read_bytes\n' + API + 'data = read_bytes("age.bin")\nprint(checked_int(data[0], 1, 40))\n';
runtime('private-runtime-input-valid', inputSource, '25\n', { input: Buffer.from([25]) });
runtime('private-runtime-input-invalid', inputSource, '', { input: Buffer.from([41]), ...RANGE });
runtime('changed-input-control', inputSource, '26\n', { input: Buffer.from([26]), controlOriginalStdout: '25\n' });
runtime('changed-value-source-control', API + 'print(checked_int(26, 1, 40))\n', '26\n', { controlOriginalStdout: '25\n' });
runtime('changed-bound-source-control', PROBE + 'print(probe(41, 1, 41))\n', '41\n', { controlOriginalStdout: '40\n' });
runtime('crlf-comment-metamorph', (PROBE + '# %% :(999) {# inert #}\nage: (1 to 40) = 25\nprint(probe(age, 1, 40))\nprint("age: (9 to 1) = 25")\n').replaceAll('\n', '\r\n'), '25\nage: (9 to 1) = 25\n');

assert.equal(new Set(cases.map(test => test.name)).size, cases.length);
for (const test of cases) assert.match(test.name, /^[a-z][a-z0-9-]*$/);
const identity = test => ({ name: test.name, extension: test.extension, mode: test.mode, source_bytes: Buffer.byteLength(test.source), source_sha256: hash(test.source), expected_exit: test.mode === 'runtime' ? test.exit : test.mode === 'reject' ? 1 : 0, expected_stdout: test.stdout ?? null, expected_stderr: test.stderr ?? null, expected_diagnostic_code: test.code ?? null, expected_diagnostic_message: test.message ?? null, expected_diagnostic_substring: test.messageIncludes ?? null, expected_original_range: test.range ?? null, input_error_without_json: test.json === false, input_bytes: test.input?.length ?? null, input_sha256: test.input ? hash(test.input) : null, control_original_stdout: test.controlOriginalStdout ?? null, integer_work: test.work ?? null, literal_ledger: test.ledger ?? null, expected_ir_nodes: test.nodes ?? null, expected_expression_height: test.height ?? null });

process.chdir(root);
mkdirSync(resolve('target'), { recursive: true });
const directory = mkdtempSync(resolve('target/intervals-language-'));
const compiler = resolve('target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
const started = Date.now(), commands = [], results = [];
let activeCase = null;
function command(executable, args, options = {}) {
  const { timeout = budgets.cli_ms, ...rest } = options, remaining = budgets.overall_ms - (Date.now() - started);
  assert.ok(remaining > 0, 'overall interval suite deadline exceeded');
  const result = spawnSync(executable, args, { cwd: root, maxBuffer: budgets.capture_bytes_per_child, ...rest, timeout: Math.min(timeout, remaining), encoding: null });
  const index = commands.length;
  writeFileSync(join(directory, `command-${index}.stdout`), result.stdout ?? Buffer.alloc(0), { flag: 'wx' });
  writeFileSync(join(directory, `command-${index}.stderr`), result.stderr ?? Buffer.alloc(0), { flag: 'wx' });
  commands.push({ executable, arguments: args, exit: result.status, signal: result.signal, error: result.error?.code ?? null, stdout_sha256: hash(result.stdout ?? Buffer.alloc(0)), stderr_sha256: hash(result.stderr ?? Buffer.alloc(0)) });
  assert.ifError(result.error); assert.equal(result.signal, null, 'unexpected child signal'); return result;
}
const sourceHead = command('git', ['rev-parse', 'HEAD']).stdout.toString().trim();
if (expectedSource !== null) assert.equal(sourceHead, expectedSource, 'source commit mismatch');
const authority = command('git', ['show', adrCommit + ':docs/decisions/0009-inclusive-integer-intervals.md']); assert.equal(authority.status, 0);
const harnessHash = hash(readFileSync(fileURLToPath(import.meta.url))), contractHash = hash(readFileSync(join(fixtureRoot, 'CONTRACT.md')));
const plan = { schema_version: 1, state: 'prepared', source_base_commit: sourceBase, authority_adr_commit: adrCommit, authority_adr_sha256: hash(authority.stdout), host: process.platform + '-' + process.arch, node: process.version, target: 'x86_64-unknown-linux-gnu', harness_sha256: harnessHash, contract_sha256: contractHash, budgets, finite_bigint_vectors: vectors.map(vector => vector.map(value => typeof value === 'boolean' ? value : String(value))), integer_work_oracles: workOracles, literal_ledgers: literalLedgers, passed: 0, not_run: cases.length, results: cases.map(test => ({ ...identity(test), result: 'not_run' })) };
writeFileSync(join(directory, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
for (const test of cases) writeFileSync(join(directory, test.name + '.' + test.extension), test.source, { flag: 'wx' });
process.on('uncaughtExceptionMonitor', error => {
  const completed = new Set(results.map(test => test.name));
  try { writeFileSync(join(directory, 'failure.json'), JSON.stringify({ schema_version: 1, state: 'failed', source_commit: sourceHead, results: [...results, ...cases.filter(test => !completed.has(test.name)).map(test => ({ ...identity(test), result: test === activeCase ? 'failed' : 'not_run' }))], commands, error: { name: error.name, message: error.message } }, null, 2) + '\n', { flag: 'wx' }); }
  catch { /* Preserve the original failure if evidence storage also fails. */ }
});
if (prepareOnly) console.log(`${cases.length} interval source outcomes prepared, all not_run. No compiler/native execution. Artifacts: ${portable(relative(root, directory))}`);
else {
  const frozen = JSON.parse(readFileSync(join(fixtureRoot, 'PREPARATION.json'), 'utf8'));
  const { host: preparationHost, ...frozenContract } = frozen;
  const { host: executionHost, ...executionContract } = plan;
  assert.equal(typeof preparationHost, 'string'); assert.equal(executionHost, process.platform + '-' + process.arch);
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
        let nativeData = null;
        if (test.input) { nativeData = join(directory, test.name + '.data'); mkdirSync(nativeData); writeFileSync(join(nativeData, 'age.bin'), test.input, { flag: 'wx' }); }
        const linuxArtifact = linuxDirectory + '/' + test.name + '.elf'; let executed;
        if (process.platform === 'win32') { assert.equal(command('wsl.exe', ['--exec', '/usr/bin/chmod', 'u+x', linuxArtifact]).status, 0); executed = command('wsl.exe', [...(nativeData ? ['--cd', linuxDirectory + '/' + test.name + '.data'] : []), '--exec', '/usr/bin/timeout', '--signal=TERM', '--kill-after=1s', String(budgets.native_seconds), linuxArtifact]); }
        else { chmodSync(artifact, 0o700); executed = command('/usr/bin/timeout', ['--signal=TERM', '--kill-after=1s', String(budgets.native_seconds), artifact], { cwd: nativeData ?? root }); }
        assert.equal(executed.status, test.exit, test.name + ': native exit: ' + executed.stderr); assert.deepEqual(executed.stdout, Buffer.from(test.stdout), test.name + ': stdout'); assert.deepEqual(executed.stderr, Buffer.from(test.stderr), test.name + ': stderr');
        if (test.controlOriginalStdout !== undefined) { assert.throws(() => assert.deepEqual(executed.stdout, Buffer.from(test.controlOriginalStdout)), error => error.code === 'ERR_ASSERTION'); record.control_outcome = 'original_output_oracle_rejected_changed_source_or_input'; }
        if (nativeData) { assert.deepEqual(readdirSync(nativeData), ['age.bin']); assert.deepEqual(readFileSync(join(nativeData, 'age.bin')), test.input); record.private_input_sha256_after_native = hash(test.input); }
        Object.assign(record, { native_exit: executed.status, elf_sha256: hash(readFileSync(artifact)), stdout_sha256: hash(executed.stdout), stderr_sha256: hash(executed.stderr) });
      }
    }
    record.result = 'passed'; results.push(record); activeCase = null; console.log('PASS ' + test.name);
  }
  writeFileSync(join(directory, 'summary.json'), JSON.stringify({ schema_version: 1, state: 'executed', source_commit: sourceHead, harness_sha256: harnessHash, contract_sha256: contractHash, budgets, host: process.platform + '-' + process.arch, target: 'x86_64-unknown-linux-gnu', node: process.version, compiler_version: version.stdout.toString().trim(), compiler_sha256: hash(readFileSync(compiler)), passed: results.length, not_run: 0, commands, results }, null, 2) + '\n', { flag: 'wx' });
  console.log(`${results.length} interval source outcomes passed. Artifacts: ${portable(relative(root, directory))}`);
  console.log('Scope: inclusive Int/Bool checks and local interval slots. Named refinements, Decimal/Float, fields/parameters, patterns, structured values, FC1 and HATCH remain open.');
}
