// Independent direct-function native checks; no interpreter or Python oracle.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const directory = mkdtempSync(resolve('target/functions-native-'));
const driver = resolve('target/debug/examples', process.platform === 'win32' ? 'functions_ir.exe' : 'functions_ir');
function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, {encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024, ...options});
  assert.ifError(result.error); return result;
}
const built = command('cargo', ['build', '-p', 'naja-native', '--example', 'functions_ir', '--locked', '--offline']);
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
const fn = (parameters, body) => `function ${parameters}\n${body}end\n`;
const depthError = 'NJA203: native user-call depth limit exceeded\n';
const resource = 'NJA203: native value arena exhausted\n';
run('nested-calls-independent-local-frames', readFileSync(new URL('../tests/functions/control.ir', import.meta.url), 'utf8'), '42\nmain-local\n12\nNone\n');

let source = '', expected = '';
function check(expression, answer) { source += 'print ' + expression + '\n'; expected += answer + '\n'; oracleOutputs++; }
const integers = [0n, 1n, -1n, 999999999n, 1000000000n, -(10n ** 100n), BigInt('1234567890'.repeat(200))];
let state = 0x7a05f11bn;
for (let index = 0; index < 80; index++) { state = (state * 6364136223846793005n + 1442695040888963407n) & ((1n << 192n) - 1n); integers.push(index % 2 ? -state : state); }
for (let index = 0; index < integers.length; index++) {
  const a = integers[index], b = integers[(index * 7 + 2) % integers.length];
  check(`${a} ${b} call:0:2`, (a + b) * (a - b));
  check(`${a} ${b} call:0:2 ${a} ${b} call:0:2 ==`, 'True');
}
source += fn(2, 'set 2 %0 %1 +\nset 3 %0 %1 -\nreturn %2 %3 *\n');
run('arbitrary-integer-call-oracle-and-repeated-results', source, expected);

source = ''; expected = '';
let factorial = 1n, fibonacciA = 0n, fibonacciB = 1n;
for (let value = 0; value <= 100; value++) {
  if (value > 0) factorial *= BigInt(value);
  check(`${value} call:0:1`, factorial);
  if (value <= 18) { check(`${value} call:1:1`, fibonacciA); [fibonacciA, fibonacciB] = [fibonacciB, fibonacciA + fibonacciB]; }
}
source += fn(1, 'if %0 1 <=\nreturn 1\nend\nreturn %0 %0 1 - call:0:1 *\n') + fn(1, 'if %0 2 <\nreturn %0\nend\nreturn %0 1 - call:1:1 %0 2 - call:1:1 +\n');
run('self-recursion-factorial-and-branching-fibonacci', source, expected);

run('return-exits-loops-groups-and-skips-body', 'print 9 call:0:1\nprint 0 call:0:1\n' + fn(1, 'group\nwhile %0 0 >\nif %0 3 ==\nreturn %0\nend\nset 0 %0 1 -\nend\nend\nreturn 99\nprint 1 0 //\n'), '3\n99\n');
run('returning-branch-preserves-live-local-initialization', 'print false call:0:1\nprint true call:0:1\n' + fn(1, 'if %0\nreturn none\nelse\nset 1 77\nend\nreturn %1\n'), '77\nNone\n');
run('fallthrough-none-and-returned-descriptor-types', `print call:0:0\nprint true call:1:1\nprint false call:1:1\nprint none call:1:1\nprint ${text('é\0𝄞')} call:1:1\nprint b:27005cff call:1:1\n` + fn(0, '') + fn(1, 'return %0\n'), "None\nTrue\nFalse\nNone\né\0𝄞\nb\"'\\x00\\\\\\xff\"\n");
run('forward-known-native-label', 'print 40 call:0:1\n' + fn(1, 'return %0 2 call:1:2\n') + fn(2, 'return %0 %1 +\n'), '42\n');
run('arguments-once-left-to-right-with-observable-print', 'print 1 call:0:1 2 call:0:1 3 call:0:1 call:1:3\n' + fn(1, 'print %0\nreturn %0\n') + fn(3, 'return %0 100 * %1 10 * + %2 +\n'), '1\n2\n3\n123\n');
run('nested-argument-calls-preserve-pending-values', 'print 10 20 call:0:1 30 40 call:0:1 call:1:2 call:2:3\n' + fn(1, 'return %0 1 +\n') + fn(2, 'return %0 %1 -\n') + fn(3, 'return %0 %1 + %2 +\n'), '20\n');
run('arguments-before-depth-check-and-first-error', 'print call:0:0\n' + fn(0, 'return 1 0 // call:1:1\n') + fn(1, 'return %0\n'), '', 106, 'NJA206: integer division by zero\n');
run('argument-first-error-stops-later-call', 'print 1 len 0 call:0:1 call:1:2\n' + fn(1, 'print 999\nreturn %0\n') + fn(2, 'return none\n'), '', 105, 'NJA205: native value type mismatch\n');
run('short-circuit-skips-call-side-effects', 'print false call:0:0 and\nprint true call:0:0 or\nprint 2 1 call:0:0 chain:<,<\n' + fn(0, 'print 999\nreturn 1 0 //\n'), 'False\nTrue\nFalse\n');
run('caller-aliases-remain-immutable', `set 0 ${text('original')}\nset 1 %0\nprint %0 call:0:1\nprint %0\nprint %1\nset 2 999999999999999999999999999999\nprint %2 call:1:1\nprint %2\n` + fn(1, `set 0 %0 ${text('-changed')} +\nreturn %0\n`) + fn(1, 'set 0 %0 1 +\nreturn %0\n'), 'original-changed\noriginal\noriginal\n1000000000000000000000000000000\n999999999999999999999999999999\n');

const recurse = fn(1, 'if %0 0 ==\nreturn %0\nend\nreturn %0 1 - call:0:1\n');
run('depth-256-succeeds', 'print 255 call:0:1\n' + recurse, '0\n');
run('depth-257-is-explicit-resource-failure', 'print 256 call:0:1\n' + recurse, '', 103, depthError);
run('unbounded-recursion-stops-before-frame-allocation', 'print call:0:0\n' + fn(0, 'return call:0:0\n'), '', 103, depthError);
run('argument-type-error-precedes-next-depth-check', 'print 255 call:0:1\n' + fn(1, 'if %0 0 ==\nreturn 1 len call:1:1\nend\nreturn %0 1 - call:0:1\n') + fn(1, 'return %0\n'), '', 105, 'NJA205: native value type mismatch\n');
run('depth-counter-restored-on-every-return', 'set 0 0\nwhile %0 400 <\nassert 255 call:0:1 0 ==\nset 0 %0 1 +\nend\nprint %0\n' + recurse, '400\n');
// Eight wrappers each retain 127 pending arguments across the recursive call:
// 1016 descriptors plus the frame per level. The boundary is calculated from
// the private ABI's 2048-byte frame, caller arguments/context/return/base, and
// the fixed 4096-byte helper reserve; it is not raised after execution.
const pending = 'none '.repeat(127).repeat(8) + '%0 1 - call:0:1 ' + 'call:1:128 '.repeat(8);
const pendingFunctions = fn(1, 'if %0 0 ==\nreturn 0\nend\nreturn ' + pending + '\n') + fn(128, 'return %127\n');
run('nested-pending-stack-calculated-boundary-succeeds', 'print 204 call:0:1\n' + pendingFunctions, '0\n');
run('nested-pending-stack-exceeds-before-depth-limit', 'print 205 call:0:1\n' + pendingFunctions, '', 103, 'NJA203: native source stack limit exceeded\n');
const args128 = Array.from({length: 128}, (_, index) => String(index));
run('128-parameters-stack-layout', 'print ' + args128.join(' ') + ' call:0:128\n' + fn(128, 'return %0 %63 + %127 +\n'), '190\n');
source = 'print call:127:0\n'; for (let index = 0; index < 128; index++) source += fn(0, `return ${index}\n`);
run('128-functions-direct-label-table', source, '127\n');
const pressure = 'set 0 t:58\nset 1 0\nwhile %1 24 <\nset 0 %0 %0 +\nset 1 %1 1 +\nend\n';
run('argument-once-allocation-pressure', pressure + 'print %0 t: + call:0:1 len\n' + fn(1, 'return %0\n'), '16777216\n');
run('shared-arena-accumulates-across-function-returns', 'while true\nset 0 true call:0:1\nend\n' + fn(1, 'return %0 pos\n'), '', 103, resource);
run('function-assertion-failure', 'print call:0:0\n' + fn(0, 'assert false\nreturn 999\n'), '', 104, 'NJA204: assertion failed\n');
run('function-type-failure', 'print none call:0:1\n' + fn(1, 'return %0 1 +\n'), '', 105, 'NJA205: native value type mismatch\n');
run('function-division-and-remainder-retain-exact-semantics', 'print -10000000000000000000000001 999999999 call:0:2\nprint -10000000000000000000000001 999999999 call:1:2\n' + fn(2, 'return %0 %1 //\n') + fn(2, 'return %0 %1 %\n'), '-10000000010000001\n989999998\n');

for (const [name, invalid] of [
  ['return-main', 'return none\n'], ['unknown-function', 'print call:0:0\n'],
  ['wrong-arity', 'print call:0:0\n' + fn(1, '')],
  ['uninitialized-parameter', 'print none\n' + fn(0, 'return %0\n')],
  ['caller-is-not-global', 'set 0 42\nprint call:0:0\n' + fn(0, 'return %0\n')],
  ['unused-function-invalid', 'print none\n' + fn(0, 'return call:1:0\n')],
  ['dead-code-invalid', 'print none\n' + fn(0, 'return none\nprint %1\n')],
  ['branch-local-not-definite', 'print false call:0:1\n' + fn(1, 'if %0\nset 1 1\nend\nreturn %1\n')],
  ['loop-local-not-definite', 'print none\n' + fn(0, 'while false\nset 0 1\nend\nreturn %0\n')],
  ['129-parameters', 'print none\n' + fn(129, '')],
  ['skipped-call-invalid', 'print false %1 call:0:1 and\n' + fn(1, 'return %0\n')],
]) {
  const input = join(directory, 'invalid-' + name + '.ir'), output = join(directory, 'invalid-' + name + '.elf'); writeFileSync(input, invalid);
  const result = command(driver, [input, output]); assert.equal(result.status, 1, name); assert.equal(existsSync(output), false, name);
  console.log('PASS invalid program rejected before output: ' + name); checks++;
}
const deterministic = emit('deterministic-a', 'print 123 call:0:1\n' + fn(1, 'return %0\n'));
const repeated = emit('deterministic-b', 'print 123 call:0:1\n' + fn(1, 'return %0\n'));
assert.deepEqual(readFileSync(deterministic.output), readFileSync(repeated.output)); checks++;
const stackMutant = emit('mutant-smaller-stack-budget', 'print 4 call:0:1\n' + pendingFunctions);
assert.equal(execute(stackMutant).stdout, '0\n');
const stackImage = readFileSync(stackMutant.output), stackPattern = Buffer.from([0x48, 0x81, 0xe8, 0, 0, 0x20, 0]);
const stackOffset = stackImage.indexOf(stackPattern); assert.ok(stackOffset > 4096); assert.equal(stackImage.indexOf(stackPattern, stackOffset + 1), -1);
stackImage.writeInt32LE(8192, stackOffset + 3); writeFileSync(stackMutant.output, stackImage);
const stackResult = execute(stackMutant); assert.equal(stackResult.status, 103); assert.equal(stackResult.stdout, ''); assert.equal(stackResult.stderr, 'NJA203: native source stack limit exceeded\n');
console.log('PASS nested pending arguments obey the emitted stack floor mutant'); checks++;
const frameMutant = emit('mutant-smaller-frame-budget', 'print 123 call:0:1\n' + fn(1, 'return %0\n'));
assert.equal(execute(frameMutant).stdout, '123\n');
const frameImage = readFileSync(frameMutant.output), frameOffset = frameImage.indexOf(stackPattern);
assert.ok(frameOffset > 4096); assert.equal(frameImage.indexOf(stackPattern, frameOffset + 1), -1);
frameImage.writeInt32LE(6144, frameOffset + 3); writeFileSync(frameMutant.output, frameImage);
const frameResult = execute(frameMutant); assert.equal(frameResult.status, 103); assert.equal(frameResult.stdout, ''); assert.equal(frameResult.stderr, 'NJA203: native source stack limit exceeded\n');
console.log('PASS frame reservation obeys stack floor mutant before allocation'); checks++;
const argumentMutant = emit('mutant-parameter-offset', 'print 10 20 call:0:2\n' + fn(2, 'return %0 %1 -\n'));
assert.equal(execute(argumentMutant).stdout, '-10\n');
const argumentImage = readFileSync(argumentMutant.output), argumentPattern = Buffer.from([0x48, 0x8b, 0x85, 32, 0, 0, 0]);
const argumentOffset = argumentImage.indexOf(argumentPattern); assert.ok(argumentOffset > 4096); assert.equal(argumentImage.indexOf(argumentPattern, argumentOffset + 1), -1);
argumentImage.writeInt32LE(24, argumentOffset + 3); writeFileSync(argumentMutant.output, argumentImage);
const argumentResult = execute(argumentMutant); assert.equal(argumentResult.status, 0); assert.equal(argumentResult.stdout, '0\n'); assert.equal(argumentResult.stderr, '');
console.log('PASS parameter offset mutant changes subtraction result'); checks++;
// Change executable function-body data and verify the generated machine program
// changes behavior. This is a deliberately corrupted test artifact, not source.
const mutant = emit('mutant-function-data', 'print call:0:0\n' + fn(0, 'return ' + text('FUNCTION_BODY_MARKER') + '\n'));
assert.equal(execute(mutant).stdout, 'FUNCTION_BODY_MARKER\n');
const image = readFileSync(mutant.output), offset = image.indexOf('FUNCTION_BODY_MARKER'); assert.ok(offset > 4096);
image[offset] = 'f'.charCodeAt(0); writeFileSync(mutant.output, image);
assert.equal(execute(mutant).stdout, 'fUNCTION_BODY_MARKER\n'); console.log('PASS function body literal mutant changes native result'); checks++;
console.log(`PASS ${checks} direct-function checks; ${oracleOutputs} independent oracle outputs; target=Linux x86_64; artifact timeout=5s; artifacts=${directory}`);
