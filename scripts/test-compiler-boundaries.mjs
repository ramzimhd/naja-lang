// Exercise the real CLI main process, not a larger-stack unit-test thread.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
mkdirSync('target', { recursive: true });
const directory = mkdtempSync(resolve('target/compiler-boundaries-'));
const compiler = resolve('target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
const started = Date.now();
const childLimitMs = 5000, overallLimitMs = 120000, outputLimit = 65536;
let passed = 0, nextOutput = 0;

function command(args) {
  const remaining = overallLimitMs - (Date.now() - started);
  assert.ok(remaining > 0, 'compiler boundary suite deadline exceeded');
  return new Promise((resolveResult, reject) => {
    const child = spawn(compiler, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [], stderr = [];
    let size = 0, refusal = null;
    const timer = setTimeout(() => { refusal = 'CLI exceeded its input/depth probe deadline'; child.kill('SIGKILL'); }, Math.min(childLimitMs, remaining));
    const capture = destination => chunk => {
      size += chunk.length;
      if (size > outputLimit) { refusal = 'CLI probe output exceeded 64 KiB'; child.kill('SIGKILL'); }
      else destination.push(chunk);
    };
    child.stdout.on('data', capture(stdout)); child.stderr.on('data', capture(stderr));
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (refusal) reject(new Error(refusal));
      else resolveResult({ code, signal, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') });
    });
  });
}
async function expect(args, code, diagnostic = null) {
  const result = await command(args);
  assert.equal(result.signal, null, JSON.stringify(result));
  assert.equal(result.code, code, JSON.stringify(result));
  if (diagnostic) assert.match(result.stderr, diagnostic);
  assert.doesNotMatch(result.stderr, /overflowed its stack/);
  passed++;
  return result;
}
function output() { return join(directory, `output-${nextOutput++}.elf`); }
function buildArgs(source, destination, project = []) {
  return ['build', source, '--target', 'x86_64-unknown-linux-gnu', '--output', destination, ...project];
}

for (const [kind, prefix, suffix, count, expected] of [
  ['plus', '+', '', 127, 0], ['plus', '+', '', 128, 1],
  ['not', 'not ', '', 127, 0], ['not', 'not ', '', 128, 1],
  ['parentheses', '(', ')', 128, 0], ['parentheses', '(', ')', 129, 1],
]) {
  const source = join(directory, `${kind}-${count}.naja`);
  writeFileSync(source, 'print(' + prefix.repeat(count) + '1' + suffix.repeat(count) + ')\n');
  const destination = output();
  await expect(['check', source], expected, expected ? /NJA101/ : null);
  await expect(buildArgs(source, destination), expected, expected ? /NJA101/ : null);
  assert.equal(existsSync(destination), expected === 0);
  console.log(`PASS actual CLI ${kind} depth ${count}; unchanged advertised bound`);
}
const combined = join(directory, 'combined-depths.naja');
writeFileSync(combined, Array.from({ length: 64 }, (_, index) => '    '.repeat(index) + 'if True:\n').join('') + '    '.repeat(64) + 'print(' + '+'.repeat(127) + '1)\n');
await expect(buildArgs(combined, output()), 0);
console.log('PASS combined 64 suites and 128 expression nodes in actual CLI');

const project = join(directory, 'project'); mkdirSync(project);
writeFileSync(join(project, 'naja.toml'), '[project]\nname = "input-boundary"\n');
const ordinary = join(project, 'main.naja'); writeFileSync(ordinary, 'print(1)\n');
await expect(['check', ordinary, '--project-root', project], 0);
const nonFile = join(project, 'directory.naja'); mkdirSync(nonFile);
await expect(['check', nonFile], 1, /NJA004.*regular file/);
await expect(['check', nonFile, '--project-root', project], 1, /NJA030/);

async function rejectStream(source, connectionCount) {
  await expect(['lex', source], 1, /NJA004/);
  await expect(['check', source], 1, /NJA004/);
  let destination = output();
  await expect(buildArgs(source, destination), 1, /NJA004/);
  assert.equal(existsSync(destination), false);
  await expect(['check', source, '--project-root', project], 1, /NJA030/);
  destination = output();
  await expect(buildArgs(source, destination, ['--project-root', project]), 1, /NJA030/);
  assert.equal(existsSync(destination), false);
  if (process.platform === 'win32' || (process.platform === 'linux' && process.arch === 'x64')) {
    const runner = process.platform === 'win32' ? ['--runner', 'wsl'] : [];
    for (const operation of ['run', 'test']) {
      // Windows namespace preflight rejects a named pipe before discovery.
      // Unix test discovery owns regular-file/FIFO validation (NJA014),
      // whereas run and lex/check/build use the source reader (NJA004).
      const diagnostic = operation === 'test' && process.platform !== 'win32' ? /NJA014/ : /NJA004/;
      await expect([operation, source, ...runner], 1, diagnostic);
      const ownedDiagnostic = operation === 'test' ? diagnostic : /NJA030/;
      await expect([operation, source, ...runner, '--project-root', project], 1, ownedDiagnostic);
    }
  }
  if (connectionCount) assert.equal(connectionCount(), 0, 'CLI must never connect to the source pipe');
}

if (process.platform === 'win32') {
  const pipe = '\\\\.\\pipe\\naja-source-input-' + randomUUID() + '.naja';
  const sockets = new Set();
  let connections = 0;
  const server = createServer(socket => { connections++; sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  try {
    await new Promise((resolveListening, reject) => { server.once('error', reject); server.listen(pipe, resolveListening); });
    await rejectStream(pipe, () => connections);
  } finally {
    for (const socket of sockets) socket.destroy();
    if (server.listening) await new Promise((resolveClosed, reject) => server.close(error => error ? reject(error) : resolveClosed()));
  }
  console.log('PASS private Windows named-pipe rejection before connection; server and peers closed');
} else {
  const fifo = join(project, 'stream.naja');
  const created = spawnSync('/usr/bin/mkfifo', [fifo], { encoding: 'utf8', timeout: childLimitMs });
  assert.ifError(created.error); assert.equal(created.status, 0, created.stderr);
  await rejectStream(fifo);
  console.log('PASS Unix FIFO rejected before source read; no writer or reader process started');
}
console.log(`Compiler boundary checks: ${passed} passed; child deadline ${childLimitMs}ms, suite deadline ${overallLimitMs}ms; source artifacts retained under target/`);
console.log('Limits: stable-filesystem validation and a capped 8 MiB compilation stack reservation; no hostile-race confinement, universal OS I/O deadline or sandbox claim. macOS native run/test remains unsupported.');
