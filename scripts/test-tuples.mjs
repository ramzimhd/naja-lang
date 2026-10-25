// Independent immutable-tuple native checks; no interpreter or Python oracle.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const directory = mkdtempSync(resolve('target/tuples-native-'));
const driver = resolve('target/debug/examples', process.platform === 'win32' ? 'tuples_ir.exe' : 'tuples_ir');
function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, {encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024, ...options});
  assert.ifError(result.error); return result;
}
const built = command('cargo', ['build', '-p', 'naja-native', '--example', 'tuples_ir', '--locked', '--offline']);
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
const tuple = elements => elements.join(' ') + (elements.length ? ' ' : '') + 'tuple:' + elements.length;
const fn = (parameters, body) => `function ${parameters}\n${body}end\n`;
const type = 'NJA205: native value type mismatch\n';
const bounds = 'NJA207: sequence index out of range\n';
const tupleSpan = 'NJA203: invalid native tuple span\n';
const operatorName = {'+':'add', '-':'subtract', '*':'multiply', '//':'floor-divide', '%':'modulo', '==':'equal', '!=':'not-equal', '<':'less', '<=':'less-equal', '>':'greater', '>=':'greater-equal'};
run('empty-tuple-length-truth-and-selected-operands', 'set 0 tuple:0\nprint %0 len\nprint %0 not\nprint %0 99 or\nprint 99 %0 and len\nprint %0 99 and len\nprint %0 %0 or len\nprint 1 tuple:1 99 and\nprint 1 tuple:1 tuple:0 or len\n', '0\nTrue\n99\n0\n0\n0\n99\n1\n');
run('mixed-nested-tuple-values-and-original-elements', readFileSync(new URL('../tests/tuples/values.ir', import.meta.url), 'utf8'), "999999999999999999999999999999999999\né\u0000𝄞\nb'\\x00\\xff'\nTrue\nFalse\nNone\n2\n2\n0\nTrue\n");
let source = 'set 0 ' + tuple(Array.from({length: 128}, (_, index) => String(BigInt(index) ** 5n - 17n))) + '\n', expected = '';
for (let index = 0; index < 128; index++) for (const at of [index, index - 128]) {
  source += `print %0 ${at} index\n`; expected += (BigInt(index) ** 5n - 17n) + '\n'; oracleOutputs++;
}
source += 'print %0 len\nprint %0 false index\nprint %0 true index\n'; expected += '128\n-17\n-16\n'; oracleOutputs += 3;
run('128-elements-source-order-both-index-signs-bool-and-length', source, expected);
run('alias-view-and-function-return-lifetimes', `set 0 ${text('original')}\nset 1 %0 tuple:1\nset 2 %1\nset 0 ${text('changed')}\nset 1 tuple:0\nprint %2 0 index\nset 3 %2 call:0:1\nprint %3 len\nprint %3 0 index\nprint %3 0 index -1 index\n` + fn(1, 'set 1 %0 tuple:1\nreturn %1 0 index\n'), 'original\n1\noriginal\nl\n');
run('tuple-elements-once-left-to-right', 'set 0 1 call:0:1 2 call:0:1 3 call:0:1 tuple:3\nprint %0 0 index\nprint %0 -1 index\n' + fn(1, 'print %0\nreturn %0\n'), '1\n2\n3\n1\n3\n');
run('tuple-element-error-stops-later-element', 'eval 1 call:0:1 1 len 3 call:0:1 tuple:3\n' + fn(1, 'print %0\nreturn %0\n'), '1\n', 105, type);
run('short-circuit-skips-construction-errors', 'print false 1 len tuple:1 and\nprint true t: 0 index tuple:1 or\nprint 2 1 1 len tuple:1 chain:<,<\n', 'False\nTrue\nFalse\n');
run('128-depth-tuples-without-recursive-traversal', 'set 0 none' + ' tuple:1'.repeat(128) + '\nprint %0 len\nprint %0 not\n', '1\nFalse\n');
run('nested-returned-elements-preserve-tag-and-identity-semantics', 'set 0 true none 1 tuple:3\nset 1 %0 tuple:1\nprint %1 0 index 0 index require_int\nprint %1 0 index 0 index pos\nprint %1 0 index 1 index\nprint %1 0 index 2 index\n', 'True\n1\nNone\n1\n');
for (const [name, target, at] of [
  ['empty-zero', 'tuple:0', '0'], ['empty-negative', 'tuple:0', '-1'], ['empty-false', 'tuple:0', 'false'],
  ['past-end', '1 2 tuple:2', '2'], ['before-start', '1 2 tuple:2', '-3'],
  ['huge-positive', '1 tuple:1', '1' + '0'.repeat(10000)], ['huge-negative', '1 tuple:1', '-1' + '0'.repeat(10000)],
  ['huge-computed', '1 tuple:1', '1000000000 1000000000 *'],
]) run('tuple-bounds-' + name, `print ${target} ${at} index\n`, '', 107, bounds);
for (const [name, operation] of [
  ['print', 'print 1 tuple:1'], ['empty-print', 'print tuple:0'], ['nested-print', 'print tuple:0 tuple:1 0 index'],
  ['negate', 'print 1 tuple:1 neg'], ['positive', 'print 1 tuple:1 pos'], ['require-int', 'print 1 tuple:1 require_int'],
  ['tuple-as-index', 'print b:ff 0 tuple:1 index'], ['invalid-tuple-index-type', 'print 1 tuple:1 none index'],
  ...['+', '-', '*', '//', '%'].flatMap(operator => [['left-' + operatorName[operator], 'print 1 tuple:1 1 ' + operator], ['right-' + operatorName[operator], 'print 1 1 tuple:1 ' + operator], ['both-' + operatorName[operator], 'print tuple:0 tuple:0 ' + operator]]),
  ...['==', '!=', '<', '<=', '>', '>='].flatMap(operator => [['compare-left-' + operatorName[operator], 'print tuple:0 none ' + operator], ['compare-right-' + operatorName[operator], 'print 1 tuple:0 ' + operator], ['compare-both-' + operatorName[operator], 'print tuple:0 tuple:0 ' + operator]]),
]) run('unsupported-' + name, operation + '\n', '', 105, type);
// A bounded known prefix leaves space for index/tuple results. The marker
// ensures exhaustion happens after setup, with only tuple allocation in loop.
const prefix = `set 0 ${text('x'.repeat(524288))}\n` + 'set 1 %0 t: +\n'.repeat(127) + `print ${text('prefill-done')}\n`;
run('shared-arena-tuple-allocation-exhaustion', prefix + 'while true\nset 2 1 true none tuple:3\nend\n', 'prefill-done\n', 103, 'NJA203: native value arena exhausted\n');
// Pending tuple children are protected by the same source stack budget as
// pending function arguments. Eight tuple layers retain 1016 values per call.
const pending = 'none '.repeat(127).repeat(8) + '%0 1 - call:0:1 ' + 'tuple:128 '.repeat(8);
const functions = fn(1, 'if %0 0 ==\nreturn none\nend\nreturn ' + pending + '\n');
run('nested-tuple-pending-stack-boundary-success', 'print 204 call:0:1 len\n' + functions, '128\n');
run('nested-tuple-pending-stack-resource-before-depth', 'print 205 call:0:1 len\n' + functions, '', 103, 'NJA203: native source stack limit exceeded\n');
for (const [name, invalid] of [
  ['129-elements', 'eval ' + tuple(Array(129).fill('none')) + '\n'],
  ['129-depth', 'set 0 none' + ' tuple:1'.repeat(129) + '\n'],
  ['uninitialized-child', 'eval 1 %0 tuple:2\n'], ['skipped-invalid-child', 'eval false %0 tuple:1 and\n'],
  ['unused-function-invalid-child', 'print none\n' + fn(0, 'return %0 tuple:1\n')],
]) {
  const input = join(directory, 'invalid-' + name + '.ir'), output = join(directory, 'invalid-' + name + '.elf'); writeFileSync(input, invalid);
  const result = command(driver, [input, output]); assert.equal(result.status, 1, name); assert.equal(existsSync(output), false, name); checks++;
}
function unique(image, pattern) { const position = image.indexOf(pattern); assert.ok(position > 4096); assert.equal(image.indexOf(pattern, position + 1), -1); return position; }
// Runtime constructors make the tuple descriptor; mutate instruction immediates
// instead of assuming it exists as a serialized object in the file.
for (const [name, pattern, offset, value, status, diagnostic] of [
  ['constructor-count', Buffer.from([0x48, 0xbe, 1, 0, 0, 0, 0, 0, 0, 0]), 2, 129n, 103, tupleSpan],
  ['descriptor-count', Buffer.from([0x4c, 0x89, 0xa8, 16, 0, 0, 0]), 0, null, 103, tupleSpan],
  ['descriptor-array-offset', Buffer.from([0x49, 0x81, 0xc0, 24, 0, 0, 0]), 3, 4096n, 103, tupleSpan],
  ['descriptor-tag', Buffer.from([0x48, 0xba, 5, 0, 0, 0, 0, 0, 0, 0, 0x48, 0x89, 0x90, 0, 0, 0, 0]), 2, 99n, 105, type],
]) {
  const artifact = emit('mutant-' + name, 'print 77 tuple:1 len\n'), image = readFileSync(artifact.output), p = unique(image, pattern);
  if (name === 'descriptor-count') { // Replace store-count register with the source-stack pointer.
    image[p + 2] = 0xa0;
  } else if (offset === 2) image.writeBigUInt64LE(value, p + offset); else image.writeInt32LE(Number(value), p + offset);
  writeFileSync(artifact.output, image); const result = execute(artifact);
  assert.equal(result.status, status, name + ': ' + result.stderr); assert.equal(result.stdout, ''); assert.equal(result.stderr, diagnostic); checks++;
}
console.log('PASS tuple count/tag/array-span mutants fail before array access');
const elementPointer = emit('mutant-element-descriptor-span', 'print 77 tuple:1 0 index\n');
const pointerImage = readFileSync(elementPointer.output), pointerOffset = unique(pointerImage, Buffer.from([0x49, 0x89, 0x90, 0, 0, 0, 0]));
pointerImage[pointerOffset + 2] = 0x88; // Store the source stack address instead of its descriptor.
writeFileSync(elementPointer.output, pointerImage);
const pointerResult = execute(elementPointer); assert.equal(pointerResult.status, 103); assert.equal(pointerResult.stdout, ''); assert.equal(pointerResult.stderr, 'NJA203: invalid native sequence span\n'); checks++;
// An unsupported tuple operation must reject tag5 before consulting corrupt
// array metadata, including equality's otherwise-unrelated false fallback.
for (const [name, operation] of [['print', 'print 77 tuple:1'], ['compare', 'print 77 tuple:1 none =='], ['add', 'print 77 tuple:1 1 +']]) {
  const artifact = emit('mutant-unsupported-' + name, operation + '\n'), image = readFileSync(artifact.output), offset = unique(image, Buffer.from([0x49, 0x81, 0xc0, 24, 0, 0, 0]));
  image.writeInt32LE(4096, offset + 3); writeFileSync(artifact.output, image);
  const result = execute(artifact); assert.equal(result.status, 105); assert.equal(result.stdout, ''); assert.equal(result.stderr, type); checks++;
}
const selected = emit('mutant-selected-element', 'print ' + text('TUPLE_SELECTED_MARKER') + ' tuple:1 0 index\n');
assert.equal(execute(selected).stdout, 'TUPLE_SELECTED_MARKER\n');
const selectedImage = readFileSync(selected.output), selectedPosition = selectedImage.indexOf('TUPLE_SELECTED_MARKER'); assert.ok(selectedPosition > 4096); selectedImage[selectedPosition] = 116; writeFileSync(selected.output, selectedImage); assert.equal(execute(selected).stdout, 'tUPLE_SELECTED_MARKER\n'); checks++;
const a = emit('deterministic-a', 'print 1 2 tuple:2 -1 index\n'), b = emit('deterministic-b', 'print 1 2 tuple:2 -1 index\n'); assert.deepEqual(readFileSync(a.output), readFileSync(b.output)); checks++;
console.log(`PASS ${checks} immutable tuple checks; ${oracleOutputs} independent element outputs; target=Linux x86_64; artifact timeout=5s; artifacts=${directory}`);
