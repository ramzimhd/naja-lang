// Development IR execution tests, not a NAJA parser or an interpreter oracle.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024, ...options });
  assert.ifError(result.error);
  return result;
}
const build = command('cargo', ['build', '-p', 'naja-native', '--example', 'hosted_ir', '--locked', '--offline']);
assert.equal(build.status, 0, build.stderr);
const driver = path.join(root, 'target/debug/examples', process.platform === 'win32' ? 'hosted_ir.exe' : 'hosted_ir');
const directory = mkdtempSync(path.join(root, 'target/hosted-native-'));
let linuxDirectory = directory;
if (process.platform === 'win32') {
  const query = command('wsl.exe', ['-d', 'Ubuntu', '--exec', 'uname', '-sm']);
  assert.equal(query.status, 0, query.stderr); assert.match(query.stdout, /Linux x86_64/);
  const translated = command('wsl.exe', ['-d', 'Ubuntu', '--exec', 'wslpath', '-a', directory.replaceAll('\\', '/')]);
  assert.equal(translated.status, 0, translated.stderr); linuxDirectory = translated.stdout.trim();
} else { assert.equal(process.platform, 'linux'); assert.equal(process.arch, 'x64'); }
let checks = 0;
function emit(name, source) {
  const input = path.join(directory, `${name}.ir`), output = path.join(directory, `${name}.elf`);
  writeFileSync(input, source);
  const result = command(driver, [input, output]);
  assert.equal(result.status, 0, `${name}: ${result.stderr}`);
  return { input, output, linux: `${linuxDirectory}/${name}.elf` };
}
function execute(artifact, shell = null) {
  if (process.platform === 'win32') {
    const permission = command('wsl.exe', ['-d', 'Ubuntu', '--exec', 'chmod', 'u+x', artifact.linux]);
    assert.equal(permission.status, 0, permission.stderr);
  } else { chmodSync(artifact.output, 0o700); }
  const args = shell ? ['/usr/bin/timeout', '5', 'sh', '-c', shell, 'hosted-native-test', artifact.linux] : ['/usr/bin/timeout', '5', artifact.linux];
  return process.platform === 'win32' ? command('wsl.exe', ['-d', 'Ubuntu', '--exec', ...args]) : command(args[0], args.slice(1));
}
function run(name, source, expected, status = 0, stderr = '') {
  const artifact = emit(name, source), result = execute(artifact);
  assert.equal(result.status, status, `${name}: ${result.stderr}`);
  assert.equal(result.stdout, expected, `${name}: stdout`);
  assert.equal(result.stderr, stderr, `${name}: stderr`);
  const sha256 = createHash('sha256').update(readFileSync(artifact.output)).digest('hex');
  console.log(`PASS ${name} exit=${result.status} sha256=${sha256}`); checks++;
  return artifact;
}
const values = ['0', '-0', '0000000001', '-0000000001', '999999999', '1000000000', '1000000001', '-999999999', '-1000000000', '9223372036854775808', '-9223372036854775809', '340282366920938463463374607431768211456', '-12345678901234567890123456789012345678901234567890'];
const large = '9876543210'.repeat(100);
values.push(large, `-${large}`);
const smoke = run('lossless-literals', values.map(value => `print ${value}`).join('\n') + '\n', values.map(value => BigInt(value).toString()).join('\n') + '\n');
assert.equal(readFileSync(smoke.output).subarray(0, 4).toString('hex'), '7f454c46');
let source = '', expected = '';
let oracleCases = 0;
function check(expression, value) { source += `print ${expression}\n`; expected += `${value}\n`; oracleCases++; }
const boundary = [0n, 1n, -1n, 999999999n, 1000000000n, 1000000001n, -999999999n, -1000000000n, 10n ** 90n - 1n, -(10n ** 90n), BigInt(large)];
for (let index = 0; index < boundary.length; index++) {
  const a = boundary[index], b = boundary[(index * 3 + 1) % boundary.length];
  check(`${a} ${b} +`, a + b); check(`${a} ${b} -`, a - b); check(`${a} ${b} *`, a * b); check(`${a} neg`, -a);
}
let seed = 0x63d5e12;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; }
function integer() {
  const digits = 1 + random() % 110;
  let value = String(1 + random() % 9);
  for (let index = 1; index < digits; index++) value += String(random() % 10);
  return BigInt((random() & 1 ? '-' : '') + value);
}
for (let index = 0; index < 50; index++) {
  const a = integer(), b = integer(), c = integer();
  check(`${a} ${b} +`, a + b); check(`${a} ${b} -`, a - b); check(`${a} ${b} *`, a * b);
  check(`${a} ${b} + ${b} -`, a); check(`${a} ${b} ${c} + *`, a * (b + c));
  check(`${a} ${b} * ${a} ${c} * +`, a * b + a * c);
  check(`${a} ${b} - ${b} ${a} - +`, 0n);
}
run('arithmetic-and-metamorphic', source, expected);
let comparisons = '', comparisonExpected = '';
for (const a of [-1000000000000000000000000001n, -2n, 0n, 2n, 1000000000000000000000000001n]) {
  for (const b of [-1000000000000000000000000001n, -2n, 0n, 2n, 1000000000000000000000000001n]) {
    for (const operator of ['==', '!=', '<', '<=', '>', '>=']) {
      const answer = { '==': a === b, '!=': a !== b, '<': a < b, '<=': a <= b, '>': a > b, '>=': a >= b }[operator];
      comparisons += `if ${operator} ${a} | ${b}\nprint 1\nelse\nprint 0\nend\n`;
      comparisonExpected += `${answer ? 1 : 0}\n`;
    }
  }
}
run('all-signed-comparisons', comparisons, comparisonExpected);
run('immutable-aliases', 'set 0 1000000000000000000000000000000000000001\nset 1 %0\nset 0 %0 1 +\nset 2 %1 neg\nprint %1\nprint %0\nprint %2\nprint %1\n', '1000000000000000000000000000000000000001\n1000000000000000000000000000000000000002\n-1000000000000000000000000000000000000001\n1000000000000000000000000000000000000001\n');
run('group-loop-control', 'set 0 0\nset 1 0\nwhile < %0 | 12\ngroup\nif < %0 | 6\nset 1 %1 %0 1000000000000000000000000000000 * +\nelse\nset 1 %1 %0 -\nend\nset 0 %0 1 +\nend\nend\nprint %1\nprint %0\n', `${15n * 10n ** 30n - 51n}\n12\n`);
run('arena-resource-exhaustion', 'set 0 0\nwhile == 0 | 0\nset 0 %0 1 +\nend\n', '', 103, 'NJA203: hosted integer arena exhausted\n');
const io = emit('output-failure', 'print 123456789012345678901234567890\n');
const ioResult = execute(io, 'exec "$1" > /dev/full');
assert.equal(ioResult.status, 102, ioResult.stderr); assert.equal(ioResult.stderr, 'NJA202: native stdout write failed\n');
console.log('PASS output failure exit=102'); checks++;
for (const [name, text] of [['uninitialized-local', 'print %0\n'], ['invalid-literal', 'print 12x34\n'], ['out-of-frame', 'set 128 1\n'], ['deep-expression', `print 1 ${'neg '.repeat(140)}\n`]]) {
  const input = path.join(directory, `${name}.ir`), output = path.join(directory, `${name}.elf`);
  writeFileSync(input, text); const result = command(driver, [input, output]);
  assert.equal(result.status, 1, name); assert.equal(existsSync(output), false, name);
  console.log(`PASS rejected ${name} before output creation`); checks++;
}
const repeated = emit('repeat-a', 'print 123456789123456789 987654321987654321 *\n');
const repeatedAgain = emit('repeat-b', 'print 123456789123456789 987654321987654321 *\n');
assert.deepEqual(readFileSync(repeated.output), readFileSync(repeatedAgain.output));
console.log('PASS identical unsigned ELF bytes across repeated emission'); checks++;
const mutant = emit('mutant-literal', 'print 7\n');
const original = readFileSync(mutant.output), signature = Buffer.alloc(20);
signature.writeBigInt64LE(1n, 0); signature.writeBigUInt64LE(1n, 8); signature.writeUInt32LE(7, 16);
const offset = original.lastIndexOf(signature); assert.ok(offset >= 4096);
const changed = Buffer.from(original); changed.writeUInt32LE(8, offset + 16); writeFileSync(mutant.output, changed);
const changedResult = execute(mutant); assert.equal(changedResult.status, 0, changedResult.stderr); assert.equal(changedResult.stdout, '8\n'); assert.notEqual(changedResult.stdout, '7\n');
console.log('PASS native output changes with an injected literal mutant; incorrect baseline expectation is detected'); checks++;
console.log(`${checks} hosted native/IR checks passed; ${oracleCases} arithmetic/metamorphic and 150 comparison outputs matched Node BigInt.`);
console.log('Limits: development IR adapter; Linux x86-64 via declared WSL/native target; 64 MiB arena; no complete hosted runtime, frontend, FC1, performance or self-hosting claim.');
