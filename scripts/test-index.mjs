// Independent sequence-index native checks; no interpreter or Python oracle.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const directory = mkdtempSync(resolve('target/index-native-'));
const driver = resolve('target/debug/examples', process.platform === 'win32' ? 'index_ir.exe' : 'index_ir');
function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, {encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024, ...options});
  assert.ifError(result.error); return result;
}
const built = command('cargo', ['build', '-p', 'naja-native', '--example', 'index_ir', '--locked', '--offline']);
assert.equal(built.status, 0, built.stderr);
let target = directory;
if (process.platform === 'win32') {
  const platform = command('wsl.exe', ['--exec', '/usr/bin/uname', '-sm']);
  assert.equal(platform.status, 0, platform.stderr); assert.equal(platform.stdout.trim(), 'Linux x86_64');
  const translated = command('wsl.exe', ['--exec', '/usr/bin/wslpath', '-a', directory.replaceAll('\\', '/')]);
  assert.equal(translated.status, 0, translated.stderr); target = translated.stdout.trim();
} else { assert.equal(process.platform, 'linux'); assert.equal(process.arch, 'x64'); }
let checks = 0, oracleOutputs = 0;
function emit(name, source) {
  const input = join(directory, name + '.ir'), output = join(directory, name + '.elf');
  writeFileSync(input, source);
  const result = command(driver, [input, output]); assert.equal(result.status, 0, name + ': ' + result.stderr);
  return {input, output, linux: target + '/' + name + '.elf'};
}
function execute(artifact) {
  if (process.platform === 'win32') {
    const permission = command('wsl.exe', ['--exec', '/usr/bin/chmod', 'u+x', artifact.linux]); assert.equal(permission.status, 0, permission.stderr);
  } else chmodSync(artifact.output, 0o700);
  const args = ['/usr/bin/timeout', '5', process.platform === 'win32' ? artifact.linux : artifact.output];
  return process.platform === 'win32' ? command('wsl.exe', ['--exec', ...args]) : command(args[0], args.slice(1));
}
function run(name, source, stdout, status = 0, stderr = '') {
  const artifact = emit(name, source), result = execute(artifact);
  assert.equal(result.status, status, name + ': ' + result.stderr);
  assert.equal(result.stdout, stdout, name + ': stdout'); assert.equal(result.stderr, stderr, name + ': stderr');
  console.log(`PASS ${name} exit=${result.status} sha256=${createHash('sha256').update(readFileSync(artifact.output)).digest('hex')}`);
  checks++; return artifact;
}
const text = value => 't:' + Buffer.from(value, 'utf8').toString('hex');
const bytes = value => 'b:' + Buffer.from(value).toString('hex');
const fn = (parameters, body) => `function ${parameters}\n${body}end\n`;
const bounds = 'NJA207: sequence index out of range\n';
const type = 'NJA205: native value type mismatch\n';
const span = 'NJA203: invalid native sequence span\n';
const utf8 = 'NJA205: invalid native UTF-8 text\n';
let source = '', expected = '';
function check(expression, answer) { source += 'print ' + expression + '\n'; expected += answer + '\n'; oracleOutputs++; }
const scalars = [0, 0x7f, 0x80, 0x7ff, 0x800, 0xd7ff, 0xe000, 0xffff, 0x10000, 0x10ffff];
const vectors = ['Aé中😀Z', 'e\u0301', '👩‍💻', '\0\r\n', ...scalars.map(value => String.fromCodePoint(value))];
for (let index = 0; index < 60; index++) vectors.push(Array.from({length: index % 17 + 1}, (_, part) => String.fromCodePoint(scalars[(index * 7 + part * 3) % scalars.length])).join(''));
for (const value of vectors) {
  const characters = Array.from(value);
  for (let index = 0; index < characters.length; index++) {
    check(`${text(value)} ${index} index`, characters[index]);
    check(`${text(value)} ${index - characters.length} index`, characters[index]);
    check(`${text(value)} ${index} index len`, 1);
  }
}
run('unicode-scalar-index-positive-negative-and-length', source, expected);
source = ''; expected = '';
const allBytes = Buffer.from(Array.from({length: 256}, (_, index) => index));
for (let index = 0; index < allBytes.length; index++) {
  check(`${bytes(allBytes)} ${index} index`, index);
  check(`${bytes(allBytes)} ${index - allBytes.length} index`, index);
}
run('all-byte-values-unsigned-both-index-signs', source, expected);
source = ''; expected = '';
for (const value of ['false', '1 1 -', '5 1 %', '0 1 //', 'b:00 0 index']) {
  check(`${text('ab')} ${value} index`, 'a');
  check(`b:007fff ${value} index`, 0);
}
for (const value of ['true', 'false pos 1 +']) { check(`${text('ab')} ${value} index`, 'b'); check('b:007fff ' + value + ' index', 127); }
run('bool-and-computed-shared-zero-indices', source, expected);
run('literal-and-arena-views-survive-aliasing-and-reindexing', readFileSync(new URL('../tests/index/views.ir', import.meta.url), 'utf8'), '𝄞\né\né𝄞\né\n255\n256\n');
run('index-operands-once-left-to-right', 'print call:0:0 call:1:0 index\n' + fn(0, `print 1\nreturn ${text('é𝄞')}\n`) + fn(0, 'print 2\nreturn 1\n'), '1\n2\n𝄞\n');
run('left-failure-precedes-right-side-effect', 'print 1 len call:0:0 index\n' + fn(0, 'print 999\nreturn 0\n'), '', 105, type);
run('both-operands-before-runtime-type-check', 'print call:0:0 call:1:0 index\n' + fn(0, 'print 1\nreturn none\n') + fn(0, 'print 2\nreturn 0\n'), '1\n2\n', 105, type);
run('short-circuit-skips-index-errors', 'print false t: 0 index and\nprint true b: 0 index or\nprint 2 1 none 0 index chain:<,<\n', 'False\nTrue\nFalse\n');
run('128-depth-index-views', 'print ' + text('𝄞') + ' 0 index'.repeat(128) + '\n', '𝄞\n');
run('largest-preregistered-text-walk-fixture', 'print ' + text('a'.repeat(524286) + 'é') + ' -1 index\n', 'é\n');
for (const [name, value, at] of [
  ['empty-text', 't:', '0'], ['empty-bytes', 'b:', '0'], ['empty-negative', 't:', '-1'],
  ['positive-text-length', text('é𝄞'), '2'], ['negative-text-before-start', text('é𝄞'), '-3'],
  ['positive-bytes-length', 'b:00ff', '2'], ['negative-bytes-before-start', 'b:00ff', '-3'],
  ['single-bool-true', text('é'), 'true'], ['empty-bool-false', 'b:', 'false'],
  ...['999999999', '-999999999', '1000000000', '-1000000000', '1' + '0'.repeat(10000), '-1' + '0'.repeat(10000), '1000000000 1000000000 *'].flatMap((at, index) => [['huge-text-' + index, text('ab'), at], ['huge-bytes-' + index, 'b:00ff', at]])
]) run('bounds-' + name, `print ${value} ${at} index\n`, '', 107, bounds);
for (const [name, value, at] of [
  ['int-target', '1', '0'], ['bool-target', 'true', '0'], ['none-target', 'none', '0'],
  ['text-index', text('a'), text('0')], ['bytes-index', 'b:61', 'b:00'], ['none-index', text('a'), 'none'],
]) run('type-' + name, `print ${value} ${at} index\n`, '', 105, type);
// Consume a known bounded prefix, then allocate only index results. The marker
// proves setup completed before the expected resource failure.
for (const [name, token, empty, operation] of [['text', text('x'.repeat(524288)), 't:', 't:61 0 index'], ['bytes', bytes(Buffer.alloc(524288, 120)), 'b:', 'b:ff 0 index']]) {
  const prefix = `set 0 ${token}\n` + `set 1 %0 ${empty} +\n`.repeat(127) + `print ${text('prefill-done')}\n`;
  run('resource-only-index-results-' + name, prefix + 'while true\nset 2 ' + operation + '\nend\n', 'prefill-done\n', 103, 'NJA203: native value arena exhausted\n');
}
for (const [name, invalid] of [
  ['left-uninitialized', 'print %0 0 index\n'], ['right-uninitialized', 'print t:61 %0 index\n'],
  ['skipped-invalid-operand', 'print false t:61 %0 index and\n'],
  ['129-depth', 'print t:61' + ' 0 index'.repeat(129) + '\n'],
  ['invalid-unused-function', 'print none\n' + fn(0, 'return t:61 %0 index\n')],
]) {
  const input = join(directory, 'invalid-' + name + '.ir'), output = join(directory, 'invalid-' + name + '.elf'); writeFileSync(input, invalid);
  const result = command(driver, [input, output]); assert.equal(result.status, 1, name); assert.equal(existsSync(output), false, name);
  console.log('PASS rejected invalid IR: ' + name); checks++;
}
const marker = 'INDEX_DATA_MARKER_ASCII';
for (const [name, mutate, status, diagnostic] of [
  ['null-pointer', (image, p) => image.writeBigUInt64LE(0n, p - 16), 103, span],
  ['code-pointer', (image, p) => image.writeBigUInt64LE(0x401000n, p - 16), 103, span],
  ['after-image', (image, p) => image.writeBigUInt64LE(0x400000n + BigInt(image.length + 1), p - 16), 103, span],
  ['pointer-add-overflow', (image, p) => image.writeBigUInt64LE(0xfffffffffffffff0n, p - 16), 103, span],
  ['cross-image-end', (image, p) => image.writeBigUInt64LE(BigInt(image.length), p - 8), 103, span],
  ['length-over-budget', (image, p) => image.writeBigUInt64LE(67108865n, p - 8), 103, 'NJA203: native value arena exhausted\n'],
  ['invalid-tag', (image, p) => image.writeBigUInt64LE(99n, p - 24), 105, type],
]) {
  const artifact = emit('mutant-' + name, `print ${text(marker)} 0 index\n`), image = readFileSync(artifact.output), p = image.indexOf(marker); assert.ok(p > 4096);
  mutate(image, p); writeFileSync(artifact.output, image); const result = execute(artifact);
  assert.equal(result.status, status, name + ': ' + result.stderr); assert.equal(result.stdout, ''); assert.equal(result.stderr, diagnostic);
  console.log('PASS malformed sequence guarded: ' + name); checks++;
}
for (const invalid of [[0x80], [0xc0, 0x80], [0xc1, 0xbf], [0xc2], [0xe0, 0xa0], [0xf0, 0x90, 0x80], [0xe0, 0x80, 0x80], [0xed, 0xa0, 0x80], [0xf0, 0x80, 0x80, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xf5, 0x80, 0x80, 0x80], [0xff], [0x41, 0x80]]) {
  const name = Buffer.from(invalid).toString('hex'), artifact = emit('mutant-utf8-' + name, `print ${text(marker)} 0 index\n`), image = readFileSync(artifact.output), p = image.indexOf(marker);
  assert.ok(p > 4096); Buffer.from(invalid).copy(image, p); image.writeBigUInt64LE(BigInt(invalid.length), p - 8); writeFileSync(artifact.output, image);
  const result = execute(artifact); assert.equal(result.status, 105, name + ': ' + result.stderr); assert.equal(result.stdout, ''); assert.equal(result.stderr, utf8); checks++;
}
console.log('PASS malformed UTF-8 scalars are rejected before out-of-span reads');
function integerDescriptor(image) {
  const matches = [];
  for (let p = 4096; p + 44 <= image.length; p += 8) {
    if (image.readBigUInt64LE(p) === 0n && image.readBigUInt64LE(p + 8) === 0x400000n + BigInt(p + 24) && image.readBigUInt64LE(p + 16) === 0n && image.readBigInt64LE(p + 24) === 1n && image.readBigUInt64LE(p + 32) === 1n && image.readUInt32LE(p + 40) === 1) matches.push(p);
  }
  assert.equal(matches.length, 1); return matches[0];
}
for (const [name, mutate, status, diagnostic] of [
  ['index-null-payload', (image, p) => image.writeBigUInt64LE(0n, p + 8), 103, span],
  ['index-short-header', (image, p) => image.writeBigUInt64LE(0x400000n + BigInt(image.length - 8), p + 8), 103, span],
  ['index-huge-limb-count', (image, p) => image.writeBigUInt64LE(0xffffffffffffffffn, p + 32), 107, bounds],
  ['index-negative-zero', (image, p) => { image.writeBigInt64LE(-1n, p + 24); image.writeBigUInt64LE(0n, p + 32); }, 107, bounds],
]) {
  const artifact = emit('mutant-' + name, `print ${text(marker)} 1 index\n`), image = readFileSync(artifact.output), p = integerDescriptor(image);
  mutate(image, p); writeFileSync(artifact.output, image); const result = execute(artifact);
  assert.equal(result.status, status, name + ': ' + result.stderr); assert.equal(result.stdout, ''); assert.equal(result.stderr, diagnostic); checks++;
}
console.log('PASS index object spans and normalized positions are guarded');
const a = emit('deterministic-a', 'print ' + text('é𝄞') + ' -1 index\n'), b = emit('deterministic-b', 'print ' + text('é𝄞') + ' -1 index\n');
assert.deepEqual(readFileSync(a.output), readFileSync(b.output)); checks++;
const content = emit('mutant-literal-content', 'print ' + text(marker) + ' 0 index\n'); assert.equal(execute(content).stdout, 'I\n');
const contentImage = readFileSync(content.output), position = contentImage.indexOf(marker); assert.ok(position > 4096); contentImage[position] = 105; writeFileSync(content.output, contentImage); assert.equal(execute(content).stdout, 'i\n'); checks++;
console.log(`PASS ${checks} native index checks; ${oracleOutputs} independent scalar/byte outputs; target=Linux x86_64; artifact timeout=5s; artifacts=${directory}`);
