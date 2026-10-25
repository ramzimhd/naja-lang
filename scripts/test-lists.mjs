// Independent mutable-list native checks; no interpreter or Python oracle.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const directory = mkdtempSync(resolve('target/lists-native-'));
const driver = resolve('target/debug/examples', process.platform === 'win32' ? 'lists_ir.exe' : 'lists_ir');
function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, {encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024, ...options});
  assert.ifError(result.error); return result;
}
const built = command('cargo', ['build', '-p', 'naja-native', '--example', 'lists_ir', '--locked', '--offline']);
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
console.log('Frozen contract SHA256=' + createHash('sha256').update(readFileSync(new URL('../tests/lists/CONTRACT.md', import.meta.url))).digest('hex'));
const text = value => 't:' + Buffer.from(value, 'utf8').toString('hex');
const list = elements => elements.join(' ') + (elements.length ? ' ' : '') + 'list:' + elements.length;
const fn = (parameters, body) => `function ${parameters}\n${body}end\n`;
const type = 'NJA205: native value type mismatch\n', bounds = 'NJA207: sequence index out of range\n', listSpan = 'NJA203: invalid native list span\n';
run('empty-and-nonempty-list-len-truth-selected-operands', 'set 0 list:0\nprint %0 len\nprint %0 not\nprint %0 99 or\nprint %0 99 and len\nprint 1 list:1 not\nprint 1 list:1 99 and\nprint 1 list:1 list:0 or len\n', '0\nTrue\n99\n0\nFalse\n99\n1\n');
run('aliases-parameters-and-stored-view-tags', readFileSync(new URL('../tests/lists/aliases.ir', import.meta.url), 'utf8'), '77\n77\noriginal\n𝄞\nTrue\nNone\n255\n99\n');
let source = 'set 0 ' + list(Array.from({length: 128}, (_, index) => String(BigInt(index) ** 5n - 17n))) + '\nset 1 %0\n', expected = '';
const model = Array.from({length: 128}, (_, index) => BigInt(index) ** 5n - 17n);
for (let step = 0; step < 256; step++) {
  const index = (step * 73 + 19) % 128, at = step % 2 ? index - 128 : index, value = BigInt(step) ** 9n - 10n ** 60n;
  model[index] = value; source += `store ${value} | %0 | ${at}\nprint %1 ${at} index\n`; expected += value + '\n'; oracleOutputs++;
}
for (let index = 0; index < 128; index++) { source += `print %0 ${index} index\n`; expected += model[index] + '\n'; oracleOutputs++; }
source += 'print %0 len\n'; expected += '128\n'; oracleOutputs++;
run('128-elements-independent-alias-mutation-vector', source, expected);
run('bool-and-computed-zero-mutation-indices', 'set 0 1 2 list:2\nstore 5 | %0 | false\nstore 6 | %0 | true\nprint %0 0 index\nprint %0 1 index\nstore 7 | %0 | 1 1 -\nprint %0 false index\n', '5\n6\n7\n');
run('construction-elements-once-in-order', 'set 0 1 call:0:1 2 call:0:1 3 call:0:1 list:3\nprint %0 0 index\nprint %0 -1 index\n' + fn(1, 'print %0\nreturn %0\n'), '1\n2\n3\n1\n3\n');
run('value-sequence-index-once-in-order', 'set 0 0 list:1\nstore call:0:0 | %0 call:1:1 | call:2:0\nprint %0 0 index\n' + fn(0, 'print 1\nreturn 88\n') + fn(1, 'print 2\nreturn %0\n') + fn(0, 'print 3\nreturn 0\n'), '1\n2\n3\n88\n');
run('value-failure-skips-sequence-and-index', 'store 1 len | call:0:0 | call:1:0\n' + fn(0, 'print 2\nreturn 0 list:1\n') + fn(0, 'print 3\nreturn 0\n'), '', 105, type);
run('sequence-failure-after-value-before-index', 'store call:0:0 | 1 len | call:1:0\n' + fn(0, 'print 1\nreturn 7\n') + fn(0, 'print 3\nreturn 0\n'), '1\n', 105, type);
run('all-expressions-before-target-validation', 'store call:0:0 | call:1:0 | call:2:0\n' + fn(0, 'print 1\nreturn 7\n') + fn(0, 'print 2\nreturn none\n') + fn(0, 'print 3\nreturn 0\n'), '1\n2\n3\n', 105, type);
run('index-expression-error-before-target-type-check', 'store 1 | none | t: 0 index\n', '', 107, bounds);
run('construction-error-skips-later-element', 'set 0 1 call:0:1 1 len 3 call:0:1 list:3\n' + fn(1, 'print %0\nreturn %0\n'), '1\n', 105, type);
run('short-circuit-skips-list-construction', 'print false 1 len list:1 and\nprint true t: 0 index list:1 or\n', 'False\nTrue\n');
run('cycles-remain-shallow-and-aliases-see-updates', 'set 0 none list:1\nset 1 %0\nstore %0 | %0 | 0\nprint %0 len\nprint %1 0 index len\nset 2 none list:1\nstore %2 | %0 | 0\nstore %0 | %2 | 0\nprint %1 0 index 0 index len\nprint %2 0 index 0 index not\nstore 99 | %2 | 0\nprint %1 0 index 0 index\n', '1\n1\n1\nFalse\n99\n');
run('128-depth-lists-and-cycle-index-chain', 'set 0 none' + ' list:1'.repeat(128) + '\nprint %0 len\nset 1 none list:1\nstore %1 | %1 | 0\nset 2 %1' + ' 0 index'.repeat(128) + '\nprint %2 len\n', '1\n1\n');
for (const [name, target, at] of [
  ['empty', 'list:0', '0'], ['empty-negative', 'list:0', '-1'], ['end', '1 list:1', '1'], ['before-start', '1 list:1', '-2'],
  ['huge-positive', '1 list:1', '1' + '0'.repeat(10000)], ['huge-negative', '1 list:1', '-1' + '0'.repeat(10000)], ['huge-computed', '1 list:1', '1000000000 1000000000 *'],
]) {
  run('read-bounds-' + name, `print ${target} ${at} index\n`, '', 107, bounds);
  run('store-bounds-' + name, `store 99 | ${target} | ${at}\n`, '', 107, bounds);
}
for (const [name, target] of [['tuple', '1 tuple:1'], ['text', text('x')], ['bytes', 'b:78'], ['int', '1'], ['bool', 'true'], ['none', 'none']]) run('immutable-or-wrong-mutation-target-' + name, `store 99 | ${target} | 0\n`, '', 105, type);
run('wrong-list-index-kind', 'store 99 | 1 list:1 | none\n', '', 105, type);
const operatorName = {'+':'add','-':'subtract','*':'multiply','//':'divide','%':'modulo','==':'equal','!=':'not-equal','<':'less','<=':'less-equal','>':'greater','>=':'greater-equal'};
for (const [name, operation] of [
  ['print', 'print 1 list:1'], ['empty-print', 'print list:0'], ['negate', 'print 1 list:1 neg'], ['positive', 'print 1 list:1 pos'], ['require-int', 'print list:0 require_int'],
  ...['+', '-', '*', '//', '%', '==', '!=', '<', '<=', '>', '>='].flatMap(operator => [['left-' + operatorName[operator], 'print list:0 1 ' + operator], ['right-' + operatorName[operator], 'print 1 list:0 ' + operator], ['both-' + operatorName[operator], 'print list:0 list:0 ' + operator]]),
]) run('unsupported-' + name, operation + '\n', '', 105, type);
const prefix = `set 0 ${text('x'.repeat(524288))}\n` + 'set 1 %0 t: +\n'.repeat(127) + `set 3 ${text('y'.repeat(65536))}\n` + 'set 1 %3 t: +\n'.repeat(7) + `print ${text('prefill-done')}\n`;
run('mutation-does-not-allocate', prefix + 'set 2 none list:1\n' + 'store none | %2 | 0\n'.repeat(2000) + 'print %2 0 index\n', 'prefill-done\nNone\n');
run('allocation-control-exhausts-same-arena', prefix + 'set 2 none list:1\n'.repeat(2000) + 'print none\n', 'prefill-done\n', 103, 'NJA203: native value arena exhausted\n');
const pending = 'none '.repeat(127).repeat(8) + '%0 1 - call:0:1 ' + 'list:128 '.repeat(8), recurse = fn(1, 'if %0 0 ==\nreturn none\nend\nreturn ' + pending + '\n');
run('pending-list-stack-boundary-success', 'print 204 call:0:1 len\n' + recurse, '128\n');
run('pending-list-stack-resource', 'print 205 call:0:1 len\n' + recurse, '', 103, 'NJA203: native source stack limit exceeded\n');
for (const [name, invalid] of [
  ['129-elements', 'eval ' + list(Array(129).fill('none')) + '\n'], ['129-depth', 'set 0 none' + ' list:1'.repeat(129) + '\n'], ['uninitialized-child', 'eval %0 list:1\n'],
  ['store-value-uninitialized', 'store %0 | none | 0\n'], ['store-target-uninitialized', 'store none | %0 | 0\n'], ['store-index-uninitialized', 'store none | none | %0\n'],
  ['skipped-invalid-store', 'if false\nstore %0 | none | 0\nend\n'], ['unused-invalid-function', 'print none\n' + fn(0, 'store %0 | none | 0\n')],
]) {
  const input = join(directory, 'invalid-' + name + '.ir'), output = join(directory, 'invalid-' + name + '.elf'); writeFileSync(input, invalid);
  const result = command(driver, [input, output]); assert.equal(result.status, 1, name); assert.equal(existsSync(output), false, name); checks++;
}
function unique(image, pattern) { const p = image.indexOf(pattern); assert.ok(p > 4096); assert.equal(image.indexOf(pattern, p + 1), -1); return p; }
for (const [name, pattern, mutate, status, diagnostic] of [
  ['constructor-count', Buffer.from([0x48,0xbe,1,0,0,0,0,0,0,0]), (image,p) => image.writeBigUInt64LE(129n,p+2), 103, listSpan],
  ['array-count', Buffer.from([0x4c,0x89,0xa8,16,0,0,0]), (image,p) => image[p+2]=0xa0, 103, listSpan],
  ['array-span', Buffer.from([0x49,0x81,0xc0,24,0,0,0]), (image,p) => image.writeInt32LE(4096,p+3), 103, listSpan],
  ['tag', Buffer.from([0x48,0xba,6,0,0,0,0,0,0,0,0x48,0x89,0x90,0,0,0,0]), (image,p) => image.writeBigUInt64LE(99n,p+2), 105, type],
  ['selected-descriptor', Buffer.from([0x49,0x89,0x90,0,0,0,0]), (image,p) => image[p+2]=0x88, 103, 'NJA203: invalid native sequence span\n'],
]) {
  const artifact=emit('mutant-'+name,'print 77 list:1 0 index\n'),image=readFileSync(artifact.output),p=unique(image,pattern);mutate(image,p);writeFileSync(artifact.output,image);const result=execute(artifact);assert.equal(result.status,status,name+': '+result.stderr);assert.equal(result.stdout,'');assert.equal(result.stderr,diagnostic);checks++;
}
for (const [name, operation] of [['print','print 77 list:1'],['compare','print 77 list:1 none =='],['add','print 77 list:1 1 +']]) {
  const artifact=emit('mutant-unsupported-'+name,operation+'\n'),image=readFileSync(artifact.output),p=unique(image,Buffer.from([0x49,0x81,0xc0,24,0,0,0]));image.writeInt32LE(4096,p+3);writeFileSync(artifact.output,image);const result=execute(artifact);assert.equal(result.status,105);assert.equal(result.stdout,'');assert.equal(result.stderr,type);checks++;
}
const control = value => `set 0 1 list:1\nstore ${value} | %0 | 0\nprint %0 0 index\n`;
run('source-controlled-mutation-value-two',control(2),'2\n');run('source-controlled-mutation-value-three',control(3),'3\n');
const disabled=emit('mutant-disabled-store',control(2));assert.equal(execute(disabled).stdout,'2\n');const image=readFileSync(disabled.output),p=unique(image,Buffer.from([0x49,0x89,0x80,0,0,0,0]));image.fill(0x90,p,p+7);writeFileSync(disabled.output,image);const result=execute(disabled);assert.equal(result.status,0);assert.equal(result.stdout,'1\n');assert.notEqual(result.stdout,'2\n');checks++;
const a=emit('deterministic-a',control(2)),b=emit('deterministic-b',control(2));assert.deepEqual(readFileSync(a.output),readFileSync(b.output));checks++;
console.log(`PASS ${checks} mutable-list checks; ${oracleOutputs} independent element outputs; target=Linux x86_64; artifact timeout=5s; artifacts=${directory}`);
