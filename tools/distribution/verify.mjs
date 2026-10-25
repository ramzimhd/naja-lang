// Finite developer verification. Never invoked by a packaged compiler/installer.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCE, stagePackage, sha256, inspectReports } from './package.mjs';
import { retainedPreparation } from './prepared.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const start = Date.now(), commands = [];
const args = process.argv.slice(2); assert.ok(!args.length || args.length === 2 && args[0] === '--prepared', 'Usage: node verify.mjs [--prepared ABSOLUTE_PRIOR_OUTPUT]');
assert.equal(process.platform, 'win32', 'This bounded orchestrator currently targets the observed Windows/Ubuntu WSL environment.');
await mkdir(path.join(root, 'tools/distribution/artifacts'), { recursive: true });
const out = await mkdtemp(path.join(root, 'tools/distribution/artifacts/verify-'));
let helperSource = null;
let reused = null;
function sanitize(value) {
  if (typeof value === 'string') { for (const [prefix, replacement] of [[root.replace(/[\\/]$/, ''), '<repo>'], [process.env.USERPROFILE, '<profile>']]) if (prefix) value = value.replaceAll(prefix, replacement).replaceAll(prefix.replaceAll('\\', '/'), replacement); return value.replace(/\/mnt\/c\/naja-worktrees\/planning-validation/g, '<repo>').replace(/\/tmp\/naja-distribution\.[A-Za-z0-9]+/g, '<private-linux>').replace(/\/home\/[^\s/]+/g, '<home>'); }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitize(child)]));
  return value;
}
async function retain(state, error = null, extra = {}) { await writeFile(path.join(out, 'result.json'), JSON.stringify(sanitize({ schema_version: 1, contract_revision: '1.3', state, compiler_source: SOURCE, helper_source: helperSource, reused_preparation: reused, observed_at: new Date().toISOString(), host: 'Windows x64 / Ubuntu 24.04 WSL x86-64', node: process.version, commands, error, ...extra }), null, 2) + '\n'); }
async function command(label, tool, args, budget = 10000, cap = 2097152) {
  assert.ok(Date.now() - start + budget <= 1200000, 'Overall verification deadline');
  const buffers = { stdout: [], stderr: [] }; let total = 0;
  const result = await new Promise((resolve, reject) => {
    const child = spawn(tool, args, { cwd: root, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let failure = null;
    const timer = setTimeout(() => { failure = 'timeout'; child.kill('SIGKILL'); }, budget);
    for (const stream of ['stdout', 'stderr']) child[stream].on('data', value => { total += value.length; if (total <= cap) buffers[stream].push(value); else { failure = 'output_limit'; child.kill('SIGKILL'); } });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (exit_code, signal) => { clearTimeout(timer); resolve({ exit_code, signal, failure }); });
  });
  const logs = {};
  for (const stream of ['stdout', 'stderr']) { const bytes = Buffer.concat(buffers[stream]), name = `${commands.length}-${label}.${stream}.log`; await writeFile(path.join(out, name), bytes); logs[stream] = { path: path.relative(root, path.join(out, name)).replaceAll('\\', '/'), sha256: sha256(bytes), bytes: bytes.length }; }
  commands.push({ label, command: [tool, ...args], budget_ms: budget, output_cap_bytes: cap, ...result, logs }); await retain(result.exit_code === 0 && !result.failure ? 'in_progress' : 'failed');
  assert.equal(result.failure, null, label); assert.equal(result.signal, null, label); assert.equal(result.exit_code, 0, label + ': ' + sanitize(Buffer.concat(buffers.stderr).toString()));
  return Buffer.concat(buffers.stdout);
}
try {
  helperSource = (await command('helper-source', 'git', ['rev-parse', 'HEAD'])).toString().trim();
  assert.equal((await command('source-control', 'git', ['diff', SOURCE, '--', 'bootstrap/', 'backends/', 'Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml', 'third_party/'])).length, 0);
  assert.equal((await command('untracked-compiler-control', 'git', ['ls-files', '--others', '--exclude-standard', '--', 'bootstrap/', 'backends/', 'third_party/'])).length, 0);
  await command('package-units', process.execPath, ['--test', 'tests/distribution/package.test.mjs']);
  if (args.length) {
    const prior = await retainedPreparation(args[1], root); reused = prior.record;
    for (const [name, bytes] of prior.files) { const target = path.join(out, name); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes, { flag: 'wx' }); }
  } else {
    const source = await command('source-archive', 'git', ['archive', '--format=tar', SOURCE], 10000, 67108864); await writeFile(path.join(out, 'source.tar'), source, { flag: 'wx' });
  }
  const linuxOut = (await command('wsl-output-path', 'wsl.exe', ['--distribution', 'Ubuntu', '--exec', '/usr/bin/wslpath', '-a', out])).toString().trim();
  const scripts = (await command('wsl-script-path', 'wsl.exe', ['--distribution', 'Ubuntu', '--exec', '/usr/bin/wslpath', '-a', path.join(root, 'tools/distribution')])).toString().trim();
  if (!reused) await command('prepare-and-offline-build', 'wsl.exe', ['--distribution', 'Ubuntu', '--exec', '/usr/bin/timeout', '-k', '5', '900', '/bin/sh', scripts + '/prepare-linux.sh', linuxOut], 910000);
  const inspection = {};
  for (const [name, flags] of [['dynamic', ['-dW']], ['program', ['-lW']], ['versions', ['--version-info', '-W']]]) inspection[name] = (await command('inspect-' + name, 'wsl.exe', ['--distribution', 'Ubuntu', '--exec', '/usr/bin/readelf', ...flags, linuxOut + '/linux-build/naja'])).toString('utf8');
  const dependencyReport = inspectReports(inspection);
  const packaged = await stagePackage({ binary: path.join(out, 'linux-build/naja'), inspection, rustLicenses: path.join(out, 'linux-build/rust-licenses'), output: path.join(out, 'package') });
  await command('archive-package', 'wsl.exe', ['--distribution', 'Ubuntu', '--exec', '/usr/bin/tar', '--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner', '-czf', linuxOut + '/naja-linux-x86_64-unsigned.tar.gz', '-C', linuxOut + '/package', '.']);
  const archive = path.join(out, 'naja-linux-x86_64-unsigned.tar.gz'); assert.ok((await lstat(archive)).size <= 67108864);
  for (const name of ['independent', 'changed', 'unsupported', 'failure']) await writeFile(path.join(out, name + '.naja'), await readFile(path.join(root, 'tests/distribution/fixtures', name + '.naja')), { flag: 'wx' });
  await command('installed-compiler-rootfs-controls', 'wsl.exe', ['--distribution', 'Ubuntu', '--exec', '/usr/bin/timeout', '-k', '5', '120', '/bin/sh', scripts + '/test-linux.sh', linuxOut, scripts], 130000);
  assert.ok(!(await readFile(path.join(out, 'app-program.txt'), 'utf8')).includes('INTERP'));
  assert.ok(!(await readFile(path.join(out, 'app-dynamic.txt'), 'utf8')).includes('(NEEDED)'));
  const generated = JSON.parse(await readFile(path.join(out, 'generated-tests.json'), 'utf8'));
  assert.equal(generated.selected, 1); assert.equal(generated.passed, 1); assert.equal(generated.failed, 0);
  const unsupported = JSON.parse(await readFile(path.join(out, 'unsupported-check.json'), 'utf8'));
  assert.equal(unsupported.status, 'failed'); assert.ok(unsupported.diagnostics.length > 0);
  const failure = JSON.parse(await readFile(path.join(out, 'failure-tests.json'), 'utf8'));
  assert.equal(failure.selected, 1); assert.equal(failure.failed, 1); assert.equal(failure.tests[0].exit_code, 104);
  assert.ok(Buffer.from(failure.tests[0].stderr_hex, 'hex').toString().includes('NJA204'));
  const rootfs = await readFile(path.join(out, 'rootfs-files.txt'), 'utf8'); assert.ok(!/\/(?:rustc|cargo|python\d*|node|clang|gcc|cc|llvm)(?:\n|$)/.test(rootfs));
  await retain('passed', null, { artifact: { path: path.relative(root, archive).replaceAll('\\', '/'), sha256: sha256(await readFile(archive)), bytes: (await lstat(archive)).size, compiler_sha256: packaged.compiler_sha256, signature: 'unsigned' }, dependencies: dependencyReport, scope: { private_prefix: 'passed', copied_minimal_userland: 'passed', device_bind: '/dev/null only; no host/source/toolchain tree mounts', fresh_vm: 'not_run', other_platforms: 'not_run', fc1_01: 'open', hatch: 'open' }, limits: ['User/mount/PID/network namespace plus copied userland is scoped execution evidence, not a security sandbox or fresh VM.', 'Seed preparation used Rust/LLVM and four pinned crates; installed compiler/application checks use no Rust/Cargo/Node/Python/C compiler in the copied userland.', 'Compiler source is pinned; helper/test source is independently identified.', 'The final rootfs package copy is deliberately corrupted for a checksum rejection control; installed compiler remains unchanged.', 'No release publication or whole-task/gate verification.'] });
  console.log('Scoped distribution checks passed. Retained: ' + path.relative(root, path.join(out, 'result.json')).replaceAll('\\', '/'));
} catch (error) { await retain('failed', error.message); throw error; }
