// Actual mapping source checks; independent Node models, no Python oracle.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = resolve(root, 'tests/mappings-source');
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
const directory = mkdtempSync(resolve('target/mappings-language-'));
const compiler = resolve('target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
const results = [];
const commands = [];
let activeCase = null;
const fixtures = JSON.parse(readFileSync(join(fixtureRoot, 'fixture-index.json'), 'utf8'));
assert.equal(fixtures.schema_version, 1);
for (const entry of fixtures.files) {
  assert.match(entry.path, /^(?:[a-z][a-z0-9-]*\.(?:py|naja)|project\/(?:main\.naja|naja\.(?:toml|alias))|inputs\/key\.txt)$/);
  assert.equal(hash(readFileSync(join(fixtureRoot, entry.path))), entry.sha256, 'static fixture hash: ' + entry.path);
}
const fixture = name => readFileSync(join(fixtureRoot, name), 'utf8');
const cases = [];
const runtime = (name, source, stdout, options = {}) => cases.push({ name, source, stdout, stderr: '', exit: 0, extension: 'naja', ...options });
const reject = (name, source, diagnostic = 'NJA101:', options = {}) => cases.push({ name, source, diagnostic, reject: true, extension: 'naja', ...options });
for (const entry of fixtures.native) for (const extension of entry.extensions) runtime(entry.name + '-' + extension, fixture(entry.path), entry.stdout, { extension });
runtime('project-contextual-aliases-and-members', fixture('project/main.naja'), 'True\nTrue\nTrue\nTrue\n', { project: true });
runtime('crlf-dict-metamorphic', fixture('snapshots.py').replaceAll('\n', '\r\n'), fixtures.native.find(test => test.name === 'snapshots').stdout, { extension: 'py' });
runtime('comment-order-metamorphic', fixture('order.py').split('\n').map(line => line ? line + ' # %% :(999) {# inert # }' : line).join('\n'), fixtures.native.find(test => test.name === 'order').stdout);
const input = readFileSync(join(fixtureRoot, 'inputs/key.txt'));
runtime('private-input-key', fixture('file-key.py'), 'ASCII\n', { extension: 'py', input });

// This ordered linear model implements only the frozen key equivalence. JS Map
// would incorrectly distinguish Bool/Int, so no JS hashing/equality is reused.
const numberKey = (value, source = '(' + value + ')', display = String(value)) => ({ kind: 'number', value, source, display });
const textKey = value => ({ kind: 'text', value, source: JSON.stringify(value), display: value });
const byteKey = value => ({ kind: 'bytes', value: Buffer.from(value), source: 'b"' + [...value].map(byte => '\\x' + byte.toString(16).padStart(2, '0')).join('') + '"', display: "b'" + [...value].map(byte => byte >= 32 && byte <= 126 && byte !== 39 && byte !== 92 ? String.fromCharCode(byte) : '\\x' + byte.toString(16).padStart(2, '0')).join('') + "'" });
const noneKey = { kind: 'none', source: 'None', display: 'None' };
const keyEqual = (left, right) => left.kind === right.kind && (left.kind === 'none' || (left.kind === 'bytes' ? left.value.equals(right.value) : left.value === right.value));
const insert = (entries, key, value) => { const entry = entries.find(entry => keyEqual(entry.key, key)); if (entry) entry.value = value; else entries.push({ key, value }); };
const keys = [numberKey(0n, 'False', 'False'), numberKey(1n, 'True', 'True'), noneKey, ...['', 'K', 'K', 'é', 'é', '𝄞', '\0'].map(textKey), byteKey([]), byteKey([0, 255]), byteKey([195, 169]), numberKey(10n ** 100n + 7n), numberKey(-(10n ** 100n))];
for (let candidate = 2n; keys.length < 128; candidate++) keys.push(numberKey(candidate));
const entries = [];
keys.forEach((key, index) => insert(entries, key, numberKey(BigInt(index))));
let modelSource = 'from naja.collections import keys_snapshot\nvalue = {' + entries.map(entry => entry.key.source + ':' + entry.value.source).join(',') + '}\nalias = value\n', modelOutput = '';
const alias = entries;
const values = [noneKey, numberKey(0n, 'False', 'False'), numberKey(1n, 'True', 'True'), numberKey(10n ** 100n + 9n), textKey('é𝄞'), byteKey([0, 255])];
for (let step = 0; step < 256; step++) {
  const position = (step * 37 + 11) % keys.length, key = keys[position], value = values[(step * 5 + 1) % values.length];
  const query = key.kind === 'number' && (key.value === 0n || key.value === 1n) ? numberKey(key.value) : key;
  insert(alias, query, value);
  modelSource += `alias[${query.source}] = ${value.source}\n`;
  if (step % 17 === 0) { modelSource += `print(value[${key.source}])\n`; modelOutput += entries.find(entry => keyEqual(entry.key, key)).value.display + '\n'; }
}
modelSource += 'snapshot = keys_snapshot(value)\nprint(len(value))\n'; modelOutput += entries.length + '\n';
for (const [index, entry] of entries.entries()) {
  modelSource += `print(snapshot[${index}])\nprint(value[${entry.key.source}])\nprint(${entry.key.source} in value)\n`;
  modelOutput += entry.key.display + '\n' + entry.value.display + '\nTrue\n';
}
for (const extension of ['py', 'naja']) runtime('independent-ordered-dict-model-' + extension, modelSource, modelOutput, { extension });
const setInputs = [keys[0], numberKey(0n), keys[1], numberKey(1n), ...keys.slice(2, 52), textKey('é'), byteKey([195, 169])];
const setEntries = []; for (const key of setInputs) insert(setEntries, key, noneKey);
let setSource = 'value = {' + setInputs.map(key => key.source).join(',') + ',}\nprint(len(value))\n', setOutput = setEntries.length + '\n';
for (const key of [...keys.slice(0, 60), textKey('missing')]) { setSource += `print(${key.source} in value)\nprint(${key.source} not in value)\n`; const found = setEntries.some(entry => keyEqual(entry.key, key)); setOutput += (found ? 'True\nFalse\n' : 'False\nTrue\n'); }
runtime('independent-scalar-set-model', setSource, setOutput);
const allBytes = byteKey(Buffer.from(Array.from({ length: 256 }, (_, index) => index)));
const widthText = '\0A\x7f\u0080\u07ff\u0800\uffff\u{10000}\u{10ffff}';
runtime('all-unsigned-bytes-and-utf8-width-keys', 'from naja.collections import keys_snapshot\nkey = ' + allBytes.source + '\nquery = key + b""\nvalue = {key: True}\nprint(len(keys_snapshot(value)[0]))\nprint(value[query])\nprint(query in {key})\ntext = ' + JSON.stringify(widthText) + '\nquery = text + ""\nvalue = {text: True}\nprint(len(keys_snapshot(value)[0]))\nprint(value[query])\n', '256\nTrue\nTrue\n' + Array.from(widthText).length + '\nTrue\n');
const mark = 'def mark(label, value):\n    print(label)\n    return value\n';
const snapshotImport = 'from naja.collections import keys_snapshot\n';
const emptyClass = 'class C: pass\n';
runtime('duplicate-pair-effects-and-first-descriptor', snapshotImport + mark + 'value = {mark("first key", True): mark("first value", 1), mark("duplicate key", 1): mark("replacement", 2)}\nprint(len(value))\nprint(value[True])\nprint(keys_snapshot(value)[0])\n', 'first key\nfirst value\nduplicate key\nreplacement\n1\n2\nTrue\n');
runtime('dict-values-retain-bool-and-scalar-descriptors', 'value = {False: True, True: False, None: None}\nprint(value[0])\nprint(value[1])\nprint(value[None])\n', 'True\nFalse\nNone\n');
runtime('tuple-held-mapping-and-tuple-value', 'value = {"x": None}\nholder = (value,)\nholder[0]["x"] = True\nvalue["tuple"] = (False,)\nprint(value["x"])\nprint(value["tuple"][0])\n', 'True\nFalse\n');
runtime('alias-survives-mapping-reassignment', 'value = {None: 7}\nalias = value\nvalue = {None: 9}\nprint(alias[None])\nprint(value[None])\n', '7\n9\n');
runtime('bool-int-first-key-order', snapshotImport + 'first = {False: 7, 0: True, True: 9, 1: False}\nsecond = {0: 7, False: True, 1: 9, True: False}\nprint(len(first))\nprint(keys_snapshot(first)[0])\nprint(keys_snapshot(first)[1])\nprint(keys_snapshot(second)[0])\nprint(keys_snapshot(second)[1])\n', '2\nFalse\nTrue\n0\n1\n');
runtime('unbound-empty-set-in-function', 'def empty():\n    return set()\nprint(not empty())\nprint(len(empty()))\n', 'True\n0\n');
runtime('function-set-binding-wins', 'def set():\n    return "function"\nprint(set())\n', 'function\n');
runtime('class-set-binding-wins', 'class set: pass\nprint(not set())\n', 'False\n');
runtime('import-set-binding-wins', 'from naja.collections import keys_snapshot as set\nprint(set({True: 7})[0])\n', 'True\n');
runtime('local-set-binding-remains-value', 'def value(set):\n    return set\nprint(value(True))\n', 'True\n');
runtime('module-set-shadow-after-top-level-use', 'value = set()\nset = True\nprint(set)\nprint(not value)\n', 'True\nTrue\n');
runtime('raw-nfkc-keyword-lookalike-is-binding', 'ｉｎ = "é"\nprint(ｉｎ in {"é": None})\n', 'True\n');
runtime('raw-nfkc-set-binding-wins', 'def ｓｅｔ():\n    return "canonical binding"\nprint(set())\n', 'canonical binding\n');
runtime('unicode-import-and-distinct-api-aliases', 'from naja.collections import (keys_snapshot as 鍵, keys_snapshot as other,)\nprint(鍵({True: 1})[0])\nprint(other({1: True})[0])\n', 'True\n1\n');
runtime('short-circuit-skips-key-and-type-errors', 'print(False and [] in {})\nprint(True or None in len(1))\nif False:\n    {}[None]\nprint(None in {None})\n', 'False\nTrue\nTrue\n');
runtime('membership-normal-precedence', 'print(not 1 in {})\nprint((not 1) in {})\nprint(2 + 3 * 4 in {14})\nprint(1 in {1} and None not in {1})\nprint(1 not in {} or len(1))\n', 'True\nFalse\nTrue\nTrue\nTrue\n');
runtime('relation-middle-effect-once', mark + 'print(8 > mark("middle", 7) in mark("container", {7}))\n', 'middle\ncontainer\nTrue\n');
runtime('mapping-values-truth-and-return', 'def choose(value):\n    if value:\n        return value\n    return {None}\nprint(len(choose({})))\nprint(choose({"value": True})["value"])\nprint({} or "fallback")\nprint({1} and "kept")\n', '1\nTrue\nfallback\nkept\n');
const recursive = depth => 'def descend(value, depth):\n    if depth == 1:\n        return value[None]\n    value[None] = value[None] + 1\n    child = descend(value, depth - 1)\n    assert None in value\n    assert value[None] == child\n    assert depth > 0\n    return child\nprint(descend({None: 0}, ' + depth + '))\n';
runtime('mapping-helpers-preserve-256-call-frames', recursive(256), '255\n');
runtime('mapping-helpers-preserve-257-call-guard', recursive(257), '', { exit: 103, stderr: 'NJA203: native user-call depth limit exceeded\n' });

const typeFailure = { exit: 105, stderr: 'NJA205: native value type mismatch\n' };
const keyFailure = { exit: 105, stderr: 'NJA205: unsupported native mapping key type\n' };
const missingFailure = { exit: 111, stderr: 'NJA211: dictionary key not found\n' };
const zeroFailure = { exit: 106, stderr: 'NJA206: integer division by zero\n' };
const workFailure = { exit: 103, stderr: 'NJA203: native mapping key work limit exceeded\n' };
const arenaFailure = { exit: 103, stderr: 'NJA203: native value arena exhausted\n' };
for (const [name, source] of [['empty', '{}[None]'], ['absent-int', '{1: True}[2]'], ['text-bytes-distinct', '{"é": True}[b"\\xc3\\xa9"]'], ['unicode-not-normalized', '{"é": True}["é"]'], ['none-distinct-from-zero', '{0: True}[None]']]) runtime('missing-key-' + name, 'print(' + source + ')\n', '', missingFailure);
for (const [name, key, prefix] of [['tuple', '()', ''], ['list', '[]', ''], ['object', 'C()', emptyClass], ['dict', '{}', ''], ['set', '{1}', '']]) {
  runtime('unsupported-key-read-' + name, prefix + 'print({}[' + key + '])\n', '', keyFailure);
  runtime('unsupported-key-store-' + name, prefix + 'value = {}\nvalue[' + key + '] = True\n', '', keyFailure);
  runtime('unsupported-key-dict-membership-' + name, prefix + 'print(' + key + ' in {})\n', '', keyFailure);
  runtime('unsupported-key-set-membership-' + name, prefix + 'print(' + key + ' in set())\n', '', keyFailure);
}
for (const [name, container, prefix] of [['none', 'None', ''], ['bool', 'True', ''], ['int', '1', ''], ['text', '"x"', ''], ['bytes', 'b"x"', ''], ['tuple', '()', ''], ['list', '[]', ''], ['object', 'C()', emptyClass]]) runtime('unsupported-membership-container-' + name, prefix + 'print(1 in ' + container + ')\n', '', typeFailure);
runtime('dict-invalid-key-after-value-before-next-pair', mark + 'value = {mark("bad key", []): mark("value", 7), mark("unreachable key", 1): mark("unreachable value", 2)}\n', 'bad key\nvalue\n', keyFailure);
runtime('set-invalid-element-before-next', mark + 'value = {mark("bad key", []), mark("unreachable", 1)}\n', 'bad key\n', keyFailure);
runtime('dict-value-error-before-key-guard', 'value = {[]: 1 // 0}\n', '', zeroFailure);
runtime('dict-store-value-before-key-guard', mark + 'value = {}\nmark("container", value)[mark("key", [])] = mark("value", 7)\n', 'value\ncontainer\nkey\n', keyFailure);
runtime('dict-read-container-before-key', mark + 'print(mark("container", {})[mark("key", None)])\n', 'container\nkey\n', missingFailure);
runtime('dict-store-value-error-before-target', mark + 'mark("unreachable container", {})[mark("unreachable key", 1)] = 1 // 0\n', '', zeroFailure);
runtime('dict-read-container-error-before-key', mark + 'len(1)[mark("unreachable key", 1)]\n', '', typeFailure);
runtime('membership-element-error-before-container', mark + 'print(len(1) in mark("unreachable container", {}))\n', '', typeFailure);
runtime('membership-container-error-after-element', mark + 'print(mark("element", 1) in len(1))\n', 'element\n', typeFailure);
runtime('relation-chain-reuses-original-middle-container', mark + 'print(1 in mark("middle", {1: None}) == mark("last", True))\n', 'middle\nlast\n', typeFailure);
runtime('dict-keys-method-not-snapshot-api', mark + 'mark("receiver", {}).keys(mark("unreachable argument", 1))\n', 'receiver\n', typeFailure);
runtime('set-index-read-not-position', 'print({1}[0])\n', '', typeFailure);
runtime('set-index-store-not-position', 'value = {1}\nvalue[0] = True\n', '', typeFailure);
runtime('set-add-currently-unsupported', 'value = set()\nvalue.add(1)\n', '', typeFailure);
runtime('dictionary-protocol-method-currently-unsupported', 'value = {}\nvalue.get(1)\n', '', typeFailure);
runtime('snapshot-is-immutable', snapshotImport + 'value = keys_snapshot({True: 7})\nvalue[0] = 1\n', '', typeFailure);
for (const [name, container, prefix] of [['none', 'None', ''], ['bool', 'True', ''], ['int', '1', ''], ['text', '"x"', ''], ['bytes', 'b"x"', ''], ['tuple', '()', ''], ['list', '[]', ''], ['set', '{1}', ''], ['object', 'C()', emptyClass]]) runtime('snapshot-wrong-kind-' + name, snapshotImport + prefix + 'keys_snapshot(' + container + ')\n', '', typeFailure);
for (const [name, container] of [['dict', '{}'], ['set', '{1}']]) {
  runtime('display-' + name, 'print(' + container + ')\n', '', typeFailure);
  for (const [number, operator] of ['==', '!=', '<', '<=', '>', '>=', '+', '-', '*', '//', '%'].entries()) runtime('unsupported-operation-' + name + '-' + number, 'value = ' + container + '\nprint(value ' + operator + ' value)\n', '', typeFailure);
  runtime('unary-positive-' + name, '+' + container + '\n', '', typeFailure);
  runtime('unary-negative-' + name, '-' + container + '\n', '', typeFailure);
  runtime('plain-object-equality-' + name, emptyClass + 'print(' + container + ' == C())\n', '', typeFailure);
  runtime('plain-object-reverse-equality-' + name, emptyClass + 'print(C() != ' + container + ')\n', '', typeFailure);
}

const dictLiteral = count => '{' + Array.from({ length: count }, (_, index) => index + ':' + index).join(',') + (count ? ',' : '') + '}';
const setLiteral = count => '{' + Array.from({ length: count }, (_, index) => index).join(',') + ',}';
for (const extension of ['py', 'naja']) {
  runtime('dict-literal-128-' + extension, snapshotImport + 'value = ' + dictLiteral(128) + '\nvalue[True] = True\nprint(len(value))\nprint(value[1])\nprint(keys_snapshot(value)[1])\n', '128\nTrue\n1\n', { extension });
  reject('dict-literal-129-' + extension, 'value = ' + dictLiteral(129) + '\n', '128', { extension });
  runtime('set-literal-128-' + extension, 'value = ' + setLiteral(128) + '\nprint(len(value))\nprint(127 in value)\n', '128\nTrue\n', { extension });
  reject('set-literal-129-' + extension, 'value = ' + setLiteral(129) + '\n', '128', { extension });
}
runtime('dict-duplicate-pairs-count-128', 'value = {' + 'True:None,'.repeat(128) + '}\nprint(len(value))\n', '1\n');
reject('dict-duplicate-pairs-count-129', 'value = {' + 'True:None,'.repeat(129) + '}\n', '128');
runtime('set-duplicate-elements-count-128', 'value = {' + 'True,'.repeat(128) + '}\nprint(len(value))\n', '1\n');
reject('set-duplicate-elements-count-129', 'value = {' + 'True,'.repeat(129) + '}\n', '128');
runtime('dictionary-insertion-capacity-129', 'value = ' + dictLiteral(128) + '\nvalue[128] = None\n', '', { exit: 103, stderr: 'NJA203: native dictionary capacity exceeded\n' });
const depth = count => 'value = {}\nvalue["next"] = value\nresult = value' + '["next"]'.repeat(count) + '\nresult["flag"] = True\nprint(value["flag"])\n';
runtime('mapping-index-ir-height-128', depth(127), 'True\n');
reject('mapping-index-ir-height-129', depth(128));
runtime('mixed-relation-count-128', 'print(' + '0 == '.repeat(127) + '0 in {0})\n', 'True\n');
reject('mixed-relation-count-129', 'print(' + '0 == '.repeat(128) + '0 in {0})\n', '128');

// Frozen09c9ed... algorithm: query preflight once, candidate preflight once,
// same-kind/length comparison2*payload, one saved budget across all candidates.
for (const [kind, source, count] of [['bytes', 'b"x"', 250000], ['text-ascii', '"x"', 250000], ['text-utf8', '"é"', 125000]]) {
  const prefix = 'key = ' + source + ' * ' + count + '\nvalue = {key: True}\n';
  runtime('work-same-descriptor-exact-' + kind, prefix + 'print(value[key])\nprint(key in value)\nvalue[key] = False\nprint(value[key])\n', 'True\nTrue\nFalse\n');
  const over = 'key = ' + source + ' * ' + count + ' + ' + (kind === 'bytes' ? 'b"x"' : '"x"') + '\nvalue = {key: True}\n';
  runtime('work-same-descriptor-over-read-' + kind, over + 'print(value[key])\n', '', workFailure);
  runtime('work-same-descriptor-over-contains-' + kind, over + 'print(key in value)\n', '', workFailure);
  runtime('work-same-descriptor-over-store-' + kind, mark + over + 'value[key] = mark("value", False)\n', 'value\n', workFailure);
}
const cumulative = 'first = b"a" * 499999\nsecond = b"b" * 500001\nvalue = {first: True, second: False}\n';
runtime('work-cumulative-exact-membership-and-snapshot', snapshotImport + cumulative + 'print(None in value)\nprint(b"" in value)\nprint(len(keys_snapshot(value)))\nprint(len(keys_snapshot(value)[0]))\nprint(len(keys_snapshot(value)[1]))\n', 'False\nFalse\n2\n499999\n500001\n');
runtime('work-cumulative-exact-missing-key', cumulative + 'print(value[None])\n', '', missingFailure);
runtime('work-cumulative-over-one', cumulative + 'print(b"z" in value)\n', '', workFailure);
const equalCandidates = count => 'value = {' + Array.from({ length: count }, (_, index) => 'b"' + String.fromCharCode(97 + index) + '" * 100000:None').join(',') + '}\n';
runtime('work-three-equal-length-candidates-exact', equalCandidates(3) + 'print(b"z" * 100000 in value)\n', 'False\n');
runtime('work-four-equal-length-candidates-over', equalCandidates(4) + 'print(b"z" * 100000 in value)\n', '', workFailure);
runtime('work-empty-container-still-preflights-key', 'key = b"x" * 1000001\nprint(key in {})\n', '', workFailure);
runtime('work-empty-container-exact-key', 'key = b"x" * 1000000\nprint(key in {})\n', 'False\n');
const arenaPrefix = 'value = {"key": None}\npayload = "' + 'x'.repeat(524288) + '"\nsmall = "' + 'y'.repeat(65536) + '"\n' + 'discard = payload + ""\n'.repeat(127) + 'discard = small + ""\n'.repeat(7);
runtime('near-arena-dict-updates-reuse-descriptors', 'def update(value, payload):\n' + '    value["key"] = payload\n'.repeat(20) + arenaPrefix + 'update(value, payload)\n'.repeat(100) + 'print(len(value["key"]))\n', '524288\n');
runtime('near-arena-snapshot-allocations-guard', snapshotImport + 'def allocate(value):\n' + '    keys_snapshot(value)\n'.repeat(20) + arenaPrefix + 'allocate(value)\n'.repeat(100), '', arenaFailure);
runtime('set-allocations-retain-arena-bound', 'while True:\n    set()\n', '', arenaFailure);

for (const [name, source, diagnostic] of [
  ['dict-comprehension', 'value = {x:x for x in [1]}\n'], ['set-comprehension', 'value = {x for x in [1]}\n'],
  ['dict-unpacking', 'value = {**{}}\n'], ['set-starred-element', 'value = {*[1]}\n'], ['dict-constructor', 'dict()\n'],
  ['set-arguments', 'set([1])\n'], ['set-keyword', 'set(value=1)\n'], ['delete-key', 'value = {}\ndel value[1]\n'],
  ['mapping-iteration', 'for key in {}:\n    print(key)\n'], ['set-iteration', 'for key in {1}:\n    print(key)\n'],
  ['mapping-slice', '{}[:]\n'], ['mapping-multi-index', '{}[1, 2]\n'], ['mapping-augmented-store', 'value = {}\nvalue[1] += 1\n'],
  ['missing-colon', 'value = {1:2, 3}\n'], ['missing-dict-value', 'value = {1:}\n'], ['missing-set-element', 'value = {,}\n'],
  ['snapshot-no-arguments', snapshotImport + 'keys_snapshot()\n'], ['snapshot-too-many-arguments', snapshotImport + 'keys_snapshot({}, {})\n'],
  ['snapshot-api-value', snapshotImport + 'value = keys_snapshot\n'], ['snapshot-api-rebinding', snapshotImport + 'keys_snapshot = 1\n'],
  ['unknown-collections-import', 'from naja.collections import values\n'], ['late-collections-import', 'value = 1\nfrom naja.collections import keys_snapshot\n'],
  ['duplicate-canonical-import', 'from naja.collections import keys_snapshot as Key, keys_snapshot as Key\n'],
  ['local-set-call', 'set = True\nset()\n'], ['parameter-set-call', 'def invoke(set):\n    return set()\n'],
  ['lexical-set-shadow-after-use', 'def invoke():\n    value = set()\n    set = 1\n    return value\n'],
  ['module-set-shadow-after-function-use', 'def make():\n    return set()\nset = 1\n'], ['import-set-exact-arity-wins', 'from naja.collections import keys_snapshot as set\nset()\n'],
  ['unknown-value-original-span', '# café\nvalue = {"é": 未定義}\n', ':2:15: NJA101:'],
  ['unknown-key-original-span', '# café\nvalue = {}\nvalue[未定義] = True\n', ':3:7: NJA101:'],
]) reject(name, source, diagnostic ?? 'NJA101:');
reject('python-brace-suite-stays-isolated', fixture('blocks.naja'), 'NJA101:', { extension: 'py' });
reject('no-ambient-project-aliases', fixture('project/main.naja'));
cases.push({ ...cases.find(test => test.name === 'snapshots-py'), name: 'wrong-duplicate-source-control', source: fixture('snapshots.py').replace('value[1] = "new"', 'value[1] = "wrong"'), control: true });
cases.push({ ...cases.find(test => test.name === 'private-input-key'), name: 'wrong-key-input-file-control', input: Buffer.from('K\n'), control: true, controlKind: 'input_file' });
assert.equal(new Set(cases.map(test => test.name)).size, cases.length, 'unique case names');

function command(executable, args, options = {}) {
  const { timeout = 20_000, ...rest } = options;
  const remaining = overallLimitMs - (Date.now() - started);
  assert.ok(remaining > 0, 'overall mapping suite deadline exceeded');
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
    let nativeData = null;
    if (test.input) {
      nativeData = join(directory, test.name + '.data');
      mkdirSync(nativeData);
      writeFileSync(join(nativeData, 'key.txt'), test.input);
    }
    const verifyInput = () => {
      if (!nativeData) return;
      assert.deepEqual(readdirSync(nativeData), ['key.txt'], test.name + ': private input inventory');
      assert.deepEqual(readFileSync(join(nativeData, 'key.txt')), test.input, test.name + ': private input bytes');
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
      if (nativeData) Object.assign(record, { private_input_sha256_after_check_build_native: hash(readFileSync(join(nativeData, 'key.txt'))), private_input_inventory: ['key.txt'] });
    }
    record.result = 'passed';
    results.push(record);
    activeCase = null;
    console.log('PASS ' + test.name);
  }
  const summary = { schema_version: 1, state: 'executed', source_commit: sourceHead, source_status: sourceStatus, source_diff_sha256: hash(sourceDiff), host: process.platform + '-' + process.arch, target: 'x86_64-unknown-linux-gnu', node: process.version, compiler_version: version.stdout.toString().trim(), compiler_sha256: hash(readFileSync(compiler)), harness_sha256: hash(readFileSync(fileURLToPath(import.meta.url))), fixture_index_sha256: hash(readFileSync(join(fixtureRoot, 'fixture-index.json'))), native_timeout_seconds: nativeLimitSeconds, overall_limit_ms: overallLimitMs, passed: results.length, not_run: 0, commands, results };
  writeFileSync(join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(`${results.length} actual mapping checks passed. Artifacts: ${portable(relative(root, directory))}`);
  console.log('Scope: bounded Dict/Set source behavior; iteration, resizing/deletion, full key hashing, mapping protocols, complete Python grammar, FC1 and HATCH remain unsupported.');
}
