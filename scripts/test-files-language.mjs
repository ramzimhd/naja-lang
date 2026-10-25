// Actual file/UTF-8 source checks. Fixtures and independent byte oracles use Node only.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, closeSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readlinkSync, readSync, readdirSync, symlinkSync, writeFileSync, writeSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = resolve(root, 'tests/files-source');
const hash = value => createHash('sha256').update(value).digest('hex');
const portable = value => value.replaceAll('\\', '/');
const bytes = value => Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_PATH_BYTES = 4095;
const overallLimitMs = 240_000;
const nativeLimitSeconds = 5;
const started = Date.now();
const argv = process.argv.slice(2);
const prepareOnly = argv.includes('--prepare-only');
const expectAt = argv.indexOf('--expect-source');
const expectedSource = expectAt < 0 ? null : argv[expectAt + 1];
assert.ok(expectedSource === null || /^[0-9a-f]{40}$/.test(expectedSource), '--expect-source requires a full commit hash');
assert.deepEqual(argv.filter((argument, index) => argument !== '--prepare-only' && !(expectAt >= 0 && (index === expectAt || index === expectAt + 1))), []);
process.chdir(root);
mkdirSync(resolve('target'), { recursive: true });
const directory = mkdtempSync(resolve('target/files-language-'));
const compiler = resolve('target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
const results = [], commands = [];
let activeCase = null;
const fixtureIndex = JSON.parse(readFileSync(join(fixtureRoot, 'fixture-index.json'), 'utf8'));
assert.equal(fixtureIndex.schema_version, 1);
for (const entry of fixtureIndex.files) {
  assert.match(entry.path, /^(?:[a-z][a-z0-9-]*\.(?:py|naja)|project\/(?:main\.naja|naja\.(?:toml|alias)))$/);
  assert.equal(hash(readFileSync(join(fixtureRoot, entry.path))), entry.sha256, entry.path + ': immutable fixture hash');
}
const fixture = name => readFileSync(join(fixtureRoot, name), 'utf8');
const errors = Object.freeze({
  io: 'NJA208: native file operation failed\n',
  path: 'NJA208: invalid native file path\n',
  utf8: 'NJA209: invalid UTF-8 conversion\n',
  pathLimit: 'NJA203: native path byte limit exceeded\n',
  fileLimit: 'NJA203: native file byte limit exceeded\n',
  type: 'NJA205: native value type mismatch\n',
});
const cases = [];
const runtime = (name, source, stdout, options = {}) => cases.push({ name, source, stdout, stderr: '', exit: 0, extension: 'naja', inputs: {}, outputs: {}, directories: [], links: [], ...options });
const reject = (name, source, diagnostic = 'NJA101:', options = {}) => runtime(name, source, '', { reject: true, diagnostic, ...options });
const repeated = (size, byte) => Object.freeze({ size, byte });
const IO = 'from naja.io import read_bytes, write_bytes\n';
const UTF8 = 'from naja.text import encode_utf8, decode_utf8\n';
const byteLiteral = value => 'b"' + [...value].map(byte => '\\x' + byte.toString(16).padStart(2, '0')).join('') + '"';
const allBytes = Buffer.from(Array.from({ length: 256 }, (_, index) => index));
for (const entry of fixtureIndex.native) for (const extension of entry.extensions) {
  runtime(entry.name + '-' + extension, fixture(entry.path), entry.stdout, {
    extension, inputs: entry.input === undefined ? {} : { 'input.bin': entry.input === 'all-bytes' ? allBytes : bytes(entry.input) },
    outputs: entry.output === undefined ? {} : { 'output.bin': entry.output === 'all-bytes' ? allBytes : bytes(entry.output) },
  });
}
runtime('explicit-project-aliases', fixture('project/main.naja'), 'café\nNone\nTrue\n', { project: true, inputs: { 'input.bin': bytes('café') }, outputs: { 'output.bin': bytes('表示 equalTo 長さ') } });
runtime('crlf-import-metamorphic', fixture('functions.py').replaceAll('\n', '\r\n'), 'é𝄞\0\nTrue\n', { extension: 'py', inputs: { 'input.bin': bytes('é𝄞\0') }, outputs: { 'output.bin': bytes('é𝄞\0') } });
runtime('no-filesystem-execution-during-check-build', IO + 'write_bytes("output.bin", b"created only by native execution")\nprint("executed")\n', 'executed\n', { outputs: { 'output.bin': bytes('created only by native execution') } });
runtime('empty-file-roundtrip', IO + 'print(len(read_bytes("input.bin")))\nprint(write_bytes("output.bin", b""))\nprint(len(read_bytes("output.bin")))\n', '0\nNone\n0\n', { inputs: { 'input.bin': bytes('') }, outputs: { 'output.bin': bytes('') } });
runtime('all-bytes-unsigned-and-copy', IO + 'value = read_bytes("input.bin")\nindex = 0\nwhile index < 256:\n    assert value[index] == index\n    index = index + 1\nwrite_bytes("output.bin", value)\nprint(len(value))\nprint(value[-1])\n', '256\n255\n', { inputs: { 'input.bin': allBytes }, outputs: { 'output.bin': allBytes } });
const inertName = 'café space ;$[]{}.bin';
runtime('unicode-space-inert-metachar-path', IO + `value = read_bytes(${JSON.stringify(inertName)})\nwrite_bytes("output.bin", value)\nprint(len(value))\n`, '256\n', { inputs: { [inertName]: allBytes }, outputs: { 'output.bin': allBytes } });
runtime('ordinary-parent-component-stays-private', IO + 'print(len(read_bytes("child/../input.bin")))\n', '256\n', { inputs: { 'input.bin': allBytes }, directories: ['child'] });
runtime('ambient-module-file-is-not-a-resolver', IO + 'print(len(read_bytes("input.bin")))\n', '256\n', { inputs: { 'input.bin': allBytes, 'naja/io.py': bytes('print("ambient module must not execute")\n') } });
runtime('ordinary-object-property-filename', IO + 'print(len(read_bytes("__proto__")))\n', '3\n', { inputs: { ['__proto__']: bytes('abc') } });

const validTexts = ['', 'ASCII', '\0', 'é𝄞e\u0301', 'e\u0301é', 'Kｅ①', '\r\n', '\u007f\u0080\u07ff\u0800\ud7ff\ue000\uffff\u{10000}\u{10ffff}'];
for (const [index, text] of validTexts.entries()) {
  const encoded = Buffer.from(text, 'utf8');
  runtime('utf8-scalar-boundaries-' + index, UTF8 + IO + `value = encode_utf8(${JSON.stringify(text)})\nprint(len(value))\nprint(len(decode_utf8(value)))\nprint(decode_utf8(value))\nwrite_bytes("output.bin", value)\n`, encoded.length + '\n' + Array.from(text).length + '\n' + text + '\n', { outputs: { 'output.bin': encoded } });
}
const invalidUtf8 = [
  [0x80], [0xbf], [0xc0], [0xc1], [0xc0, 0x80], [0xc1, 0xbf], [0xc2], [0xc2, 0x41],
  [0xe0], [0xe0, 0xa0], [0xe0, 0x80, 0x80], [0xe1, 0x80], [0xe1, 0x80, 0x41],
  [0xed, 0xa0, 0x80], [0xed, 0xbf, 0xbf], [0xf0], [0xf0, 0x90], [0xf0, 0x90, 0x80],
  [0xf0, 0x80, 0x80, 0x80], [0xf1, 0x80, 0x80, 0x41], [0xf4, 0x8f, 0xbf],
  [0xf4, 0x90, 0x80, 0x80], [0xf5, 0x80, 0x80, 0x80], [0xfe], [0xff], [0xc2, 0x80, 0x80],
];
for (const [index, value] of invalidUtf8.entries()) runtime('strict-invalid-utf8-' + index, UTF8 + 'print(decode_utf8(' + byteLiteral(value) + '))\n', '', { exit: 109, stderr: errors.utf8 });
runtime('raw-read-then-strict-decode', IO + UTF8 + 'value = read_bytes("input.bin")\nprint(len(value))\ndecode_utf8(value)\n', '1\n', { exit: 109, stderr: errors.utf8, inputs: { 'input.bin': Buffer.from([255]) } });
for (const [name, call] of [
  ['read-bytes-path', 'read_bytes(b"input.bin")'], ['read-int-path', 'read_bytes(7)'], ['read-none-path', 'read_bytes(None)'],
  ['write-int-path', 'write_bytes(7, b"x")'], ['write-text-data', 'write_bytes("output.bin", "x")'],
  ['write-list-data', 'write_bytes("output.bin", [1])'], ['encode-bytes', 'encode_utf8(b"x")'],
  ['encode-none', 'encode_utf8(None)'], ['decode-text', 'decode_utf8("x")'], ['decode-list', 'decode_utf8([1])'],
]) runtime('wrong-kind-' + name, IO + UTF8 + call + '\n', '', { exit: 105, stderr: errors.type });
runtime('read-missing-file', IO + 'print(read_bytes("missing.bin"))\n', '', { exit: 108, stderr: errors.io });
runtime('read-directory', IO + 'read_bytes("directory")\n', '', { exit: 108, stderr: errors.io, directories: ['directory'] });
runtime('write-missing-parent', IO + 'write_bytes("missing/output.bin", b"x")\n', '', { exit: 108, stderr: errors.io });
runtime('write-existing-foreign-file-unchanged', IO + 'print("before")\nwrite_bytes("foreign.bin", b"replacement")\n', 'before\n', { exit: 108, stderr: errors.io, inputs: { 'foreign.bin': bytes('FOREIGN\0unchanged\xff') } });
runtime('write-existing-directory', IO + 'write_bytes("directory", b"x")\n', '', { exit: 108, stderr: errors.io, directories: ['directory'] });
runtime('second-exclusive-write-retains-owned-file', IO + 'print(write_bytes("output.bin", b"first"))\nwrite_bytes("output.bin", b"second")\n', 'None\n', { exit: 108, stderr: errors.io, outputs: { 'output.bin': bytes('first') } });
runtime('completed-owned-output-survives-later-error', IO + UTF8 + 'write_bytes("output.bin", b"completed")\ndecode_utf8(b"\\xff")\n', '', { exit: 109, stderr: errors.utf8, outputs: { 'output.bin': bytes('completed') } });
runtime('nul-read-path-refused', IO + 'read_bytes("input.bin\\0suffix")\n', '', { exit: 108, stderr: errors.path, inputs: { 'input.bin': allBytes } });
runtime('nul-write-path-refused', IO + 'write_bytes("output.bin\\0suffix", b"x")\n', '', { exit: 108, stderr: errors.path });
runtime('nul-never-overwrites-foreign-prefix', IO + 'write_bytes("foreign.bin\\0suffix", b"replacement")\n', '', { exit: 108, stderr: errors.path, inputs: { 'foreign.bin': bytes('FOREIGN') } });
const exactPath = './'.repeat(2043) + 'edge0.bin';
const unicodePath = './'.repeat(2042) + 'éedge0.bin';
assert.equal(Buffer.byteLength(exactPath), MAX_PATH_BYTES);
assert.equal(Buffer.byteLength(unicodePath), MAX_PATH_BYTES);
runtime('path-exact-4095-bytes', IO + `print(len(read_bytes(${JSON.stringify(exactPath)})))\n`, '3\n', { inputs: { 'edge0.bin': bytes('abc') } });
runtime('path-unicode-exact-4095-bytes', IO + `write_bytes(${JSON.stringify(unicodePath)}, b"abc")\nprint(len(read_bytes(${JSON.stringify(unicodePath)})))\n`, '3\n', { outputs: { 'éedge0.bin': bytes('abc') } });
for (const [index, path] of [exactPath + 'x', './'.repeat(2042) + 'éedge00.bin'].entries()) {
  assert.equal(Buffer.byteLength(path), MAX_PATH_BYTES + 1);
  runtime('path-over-4095-read-' + index, IO + `read_bytes(${JSON.stringify(path)})\n`, '', { exit: 103, stderr: errors.pathLimit });
  runtime('path-over-4095-write-' + index, IO + `write_bytes(${JSON.stringify(path)}, b"x")\n`, '', { exit: 103, stderr: errors.pathLimit });
}
for (const size of [MAX_FILE_BYTES - 1, MAX_FILE_BYTES]) runtime('read-file-boundary-' + size, IO + 'value = read_bytes("input.bin")\nprint(len(value))\nprint(value[0])\nprint(value[-1])\n', size + '\n42\n42\n', { inputs: { 'input.bin': repeated(size, 42) } });
runtime('read-file-over-16mib', IO + 'read_bytes("input.bin")\n', '', { exit: 103, stderr: errors.fileLimit, inputs: { 'input.bin': repeated(MAX_FILE_BYTES + 1, 42) } });
const growBytes = 'value = b"x"\n' + 'value = value + value\n'.repeat(24);
runtime('write-file-exact-16mib', IO + growBytes + 'print(write_bytes("output.bin", value))\n', 'None\n', { outputs: { 'output.bin': repeated(MAX_FILE_BYTES, 120) } });
runtime('write-file-over-16mib-preflight', IO + growBytes + 'value = value + b"x"\nwrite_bytes("output.bin", value)\n', '', { exit: 103, stderr: errors.fileLimit });
runtime('conversion-view-over-file-cap', UTF8 + growBytes + 'value = value + b"x"\ntext = decode_utf8(value)\nprint(len(text))\nprint(len(encode_utf8(text)))\n', '16777217\n16777217\n');
const mark = 'def mark(label, value):\n    print(label)\n    return value\n';
runtime('path-error-before-data-effect', IO + UTF8 + mark + 'write_bytes(decode_utf8(b"\\xff"), mark("unreachable data", b"x"))\n', '', { exit: 109, stderr: errors.utf8 });
runtime('data-error-after-path-effect-before-open', IO + UTF8 + mark + 'write_bytes(mark("path", "output.bin"), decode_utf8(b"\\xff"))\n', 'path\n', { exit: 109, stderr: errors.utf8 });
runtime('both-argument-effects-before-type-guard', IO + mark + 'write_bytes(mark("path", 7), mark("data", b"x"))\n', 'path\ndata\n', { exit: 105, stderr: errors.type });
runtime('read-before-encode-kind-guard', IO + UTF8 + 'encode_utf8(read_bytes("missing.bin"))\n', '', { exit: 108, stderr: errors.io });
runtime('short-circuit-skips-file-effects', IO + UTF8 + 'print(False and read_bytes("missing.bin"))\nprint(True or write_bytes("output.bin", b"unreachable"))\nprint(3 < 2 < decode_utf8(b"\\xff"))\n', 'False\nTrue\nFalse\n');
runtime('leaf-symlink-refused-if-capable', IO + 'read_bytes("link.bin")\n', '', { exit: 108, stderr: errors.io, inputs: { 'input.bin': allBytes }, links: [{ path: 'link.bin', target: 'input.bin', type: 'file' }] });
runtime('parent-symlink-applies-ordinary-os-paths-if-capable', IO + 'print(len(read_bytes("alias/input.bin")))\n', '256\n', { directories: ['real'], inputs: { 'real/input.bin': allBytes }, links: [{ path: 'alias', target: 'real', type: 'dir' }] });

for (const [name, source, diagnostic] of [
  ['unknown-module', 'from naja.other import read_bytes\nprint(1)\n', 'NJA101:'],
  ['unknown-api', 'from naja.io import read_text\nprint(1)\n', 'NJA101:'],
  ['wildcard', 'from naja.io import *\nprint(1)\n', 'NJA101:'],
  ['relative-import', 'from .naja.io import read_bytes\nprint(1)\n', 'NJA101:'],
  ['general-import', 'import naja.io\nprint(1)\n', 'NJA101:'],
  ['duplicate-bound-name', 'from naja.io import read_bytes, read_bytes\nprint(1)\n', 'NJA101:'],
  ['duplicate-across-lines', 'from naja.io import read_bytes as read\nfrom naja.io import write_bytes as read\nprint(1)\n', 'NJA101:'],
  ['nfkc-bound-collision', 'from naja.io import read_bytes as Key, write_bytes as Key\nprint(1)\n', 'NJA101:'],
  ['reserved-binding', 'from naja.io import read_bytes as if\nprint(1)\n', 'NJA101:'],
  ['late-after-statement', 'print(1)\n' + IO, 'NJA101:'],
  ['late-after-function', 'def value(): return 1\n' + IO + 'print(value())\n', 'NJA101:'],
  ['nested-import', 'def value():\n    from naja.io import read_bytes\n    return 1\nprint(value())\n', 'NJA101:'],
  ['import-rebinding', IO + 'read_bytes = 1\n', 'NJA101:'],
  ['import-function-rebinding', IO + 'def read_bytes(): return 1\nprint(1)\n', 'NJA101:'],
  ['local-import-rebinding', IO + 'def value():\n    read_bytes = 1\n    return read_bytes\nprint(value())\n', 'NJA101:'],
  ['local-call-unsupported', IO + 'def value(read_bytes):\n    return read_bytes("input.bin")\nprint(value(1))\n', 'NJA101:'],
  ['imported-function-value', IO + 'value = read_bytes\nprint(value)\n', 'NJA101:'],
  ['read-no-arguments', IO + 'read_bytes()\n', 'NJA101:'],
  ['read-too-many-arguments', IO + 'read_bytes("input.bin", "extra")\n', 'NJA101:'],
  ['write-too-few-arguments', IO + 'write_bytes("output.bin")\n', 'NJA101:'],
  ['write-too-many-arguments', IO + 'write_bytes("output.bin", b"x", b"y")\n', 'NJA101:'],
  ['encode-too-many-arguments', UTF8 + 'encode_utf8("x", "y")\n', 'NJA101:'],
  ['decode-no-arguments', UTF8 + 'decode_utf8()\n', 'NJA101:'],
  ['keyword-call', IO + 'read_bytes(path="input.bin")\n', 'NJA101:'],
  ['unknown-original-span', '# café\n' + UTF8 + 'decode_utf8(未定義)\n', ':3:13: NJA101:'],
]) reject(name, source, diagnostic);
cases.push({ ...cases.find(test => test.name === 'roundtrip-py'), name: 'changed-file-data-source-control', source: fixture('roundtrip.py').replace('write_bytes("output.bin", data)', 'write_bytes("output.bin", b"BAD")'), control: true });
runtime('file-content-verifier-source-control', IO + 'write_bytes("output.bin", b"abd")\nprint("written")\n', 'written\n', { outputs: { 'output.bin': bytes('abc') }, control: true });
assert.equal(new Set(cases.map(test => test.name)).size, cases.length);

const specHashes = new WeakMap();
function specIdentity(spec) {
  if (specHashes.has(spec)) return specHashes.get(spec);
  const digest = createHash('sha256');
  const size = Buffer.isBuffer(spec) ? spec.length : spec.size;
  if (Buffer.isBuffer(spec)) digest.update(spec);
  else {
    assert.ok(Number.isInteger(size) && size >= 0 && size <= MAX_FILE_BYTES + 1);
    const chunk = Buffer.alloc(65536, spec.byte);
    for (let offset = 0; offset < size; offset += chunk.length) digest.update(chunk.subarray(0, Math.min(chunk.length, size - offset)));
  }
  const result = { type: 'file', size, sha256: digest.digest('hex') };
  specHashes.set(spec, result);
  return result;
}
const fileIdentities = files => Object.fromEntries(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, value]) => [portable(name), specIdentity(value)]));
const identity = test => ({ name: test.name, source_bytes: Buffer.byteLength(test.source), source_sha256: hash(test.source), extension: test.extension, project: test.project ?? false,
  expectation: test.reject ? 'compile_rejection' : test.control ? 'verifier_rejects_changed_source' : 'native_execution',
  expected_exit: test.reject ? 1 : test.exit, expected_diagnostic: test.diagnostic ?? null,
  expected_stdout_sha256: hash(test.stdout), expected_stderr_sha256: hash(test.stderr),
  input_files: fileIdentities(test.inputs), expected_new_files: fileIdentities(test.outputs), directories: test.directories, links: test.links });
function command(executable, args, options = {}) {
  const { timeout = 20_000, ...rest } = options;
  const remaining = overallLimitMs - (Date.now() - started);
  assert.ok(remaining > 0, 'overall file source suite deadline exceeded');
  const result = spawnSync(executable, args, { cwd: root, maxBuffer: 8 * 1024 * 1024, ...rest, timeout: Math.min(timeout, remaining), encoding: null });
  const index = commands.length;
  writeFileSync(join(directory, 'command-' + index + '.stdout'), result.stdout ?? Buffer.alloc(0));
  writeFileSync(join(directory, 'command-' + index + '.stderr'), result.stderr ?? Buffer.alloc(0));
  commands.push({ executable, arguments: args, exit: result.status, signal: result.signal, error: result.error?.code ?? null,
    stdout_sha256: hash(result.stdout ?? Buffer.alloc(0)), stderr_sha256: hash(result.stderr ?? Buffer.alloc(0)) });
  assert.ifError(result.error);
  assert.equal(result.signal, null, 'unexpected command signal');
  return result;
}
function ownedPath(owner, name) {
  const result = resolve(owner, name);
  const child = relative(owner, result);
  assert.ok(child !== '' && child !== '..' && !child.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')) && !isAbsolute(child), 'fixture path escapes private case directory');
  return result;
}
function writeSpec(path, spec) {
  const descriptor = openSync(path, 'wx');
  try {
    const size = Buffer.isBuffer(spec) ? spec.length : spec.size;
    const buffer = Buffer.isBuffer(spec) ? spec : Buffer.alloc(65536, spec.byte);
    let offset = 0;
    while (offset < size) {
      const count = writeSync(descriptor, buffer, Buffer.isBuffer(spec) ? offset : 0, Math.min(65536, size - offset));
      assert.ok(count > 0, 'fixture write made no progress');
      offset += count;
    }
  } finally { closeSync(descriptor); }
}
function fileDigest(path, size) {
  assert.ok(size <= 64 * 1024 * 1024, 'private snapshot file exceeds harness bound');
  const descriptor = openSync(path, 'r'), digest = createHash('sha256'), buffer = Buffer.alloc(65536);
  try {
    let observed = 0;
    while (true) {
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      observed += count;
      assert.ok(observed <= 64 * 1024 * 1024, 'private snapshot read exceeds harness bound');
      digest.update(buffer.subarray(0, count));
    }
    assert.equal(observed, size, 'private snapshot file size changed');
  } finally { closeSync(descriptor); }
  return digest.digest('hex');
}
function snapshot(owner) {
  const entries = Object.create(null);
  function visit(path, prefix, depth) {
    assert.ok(depth <= 16, 'private snapshot directory depth exceeded');
    for (const name of readdirSync(path).sort()) {
      assert.ok(Object.keys(entries).length < 128, 'private snapshot entry limit exceeded');
      const child = join(path, name), key = portable(prefix + name), stat = lstatSync(child);
      if (stat.isSymbolicLink()) entries[key] = { type: 'symlink', target: readlinkSync(child) };
      else if (stat.isDirectory()) { entries[key] = { type: 'directory' }; visit(child, prefix + name + '/', depth + 1); }
      else {
        assert.ok(stat.isFile(), 'unexpected special file in private Node fixture inventory');
        entries[key] = { type: 'file', size: stat.size, sha256: fileDigest(child, stat.size) };
      }
    }
  }
  visit(owner, '', 0);
  return entries;
}
const head = command('git', ['rev-parse', 'HEAD']);
assert.equal(head.status, 0);
const sourceHead = head.stdout.toString().trim();
if (expectedSource !== null) assert.equal(sourceHead, expectedSource, 'source commit mismatch');
if (!prepareOnly) assert.ok(expectedSource !== null, 'native execution requires an explicit approved --expect-source');
const status = command('git', ['status', '--short']); assert.equal(status.status, 0);
const diff = command('git', ['diff', '--binary', 'HEAD']); assert.equal(diff.status, 0);
const scope = {
  no_python: true, filesystem: 'private Node-created case directories only; ordinary OS rights apply',
  source_special_file_capabilities: 'Node symlink cases run only if creation succeeds; unavailable capability is not_run',
  backend_owned_not_run_in_this_source_suite: ['FIFO/device fixtures', 'concurrent shrink/growth races', 'syscall/EINTR/close fault injection', 'partial transfer fault injection', 'corrupt descriptor machine-code probes', 'POSIX mode verification'],
};
writeFileSync(join(directory, 'plan.json'), JSON.stringify({ schema_version: 1, source_commit: sourceHead, contract_revision: '39c4b3fbd20e4fcabd4b00c8faa23d2b3189edd2',
  harness_sha256: hash(readFileSync(fileURLToPath(import.meta.url))), static_fixture_index_sha256: hash(readFileSync(join(fixtureRoot, 'fixture-index.json'))),
  budgets: { native_seconds: nativeLimitSeconds, command_ms: 20000, build_ms: 45000, overall_ms: overallLimitMs, capture_bytes: 8 * 1024 * 1024 }, scope, cases: cases.map(identity) }, null, 2) + '\n');
process.on('uncaughtExceptionMonitor', error => {
  const completed = new Set(results.map(result => result.name));
  const pending = cases.filter(test => !completed.has(test.name)).map(test => ({ ...identity(test), result: test === activeCase ? 'failed' : 'not_run' }));
  try { writeFileSync(join(directory, 'failure.json'), JSON.stringify({ schema_version: 1, state: 'failed', source_commit: sourceHead, results: [...results, ...pending], commands,
    error: { name: error.name, message: error.message } }, null, 2) + '\n'); }
  catch { /* Retain the original failure if evidence storage fails. */ }
});
if (prepareOnly) {
  writeFileSync(join(directory, 'summary.json'), JSON.stringify({ schema_version: 1, state: 'prepared', source_commit: sourceHead, scope, passed: 0, not_run: cases.length,
    results: cases.map(test => ({ ...identity(test), result: 'not_run' })) }, null, 2) + '\n');
  console.log(`Prepared ${cases.length} cases and ${fixtureIndex.files.length} static hashes. Native outcomes: not_run. Artifacts: ${portable(relative(root, directory))}`);
} else {
  const built = command('cargo', ['+1.97.1', 'build', '--workspace', '--locked', '--offline'], { timeout: 45_000 });
  assert.equal(built.status, 0, built.stderr.toString());
  const version = command(compiler, ['--version']); assert.equal(version.status, 0);
  let linuxDirectory = directory;
  if (process.platform === 'win32') {
    const platform = command('wsl.exe', ['--exec', '/usr/bin/uname', '-sm']); assert.equal(platform.status, 0);
    assert.equal(platform.stdout.toString().trim(), 'Linux x86_64');
    const translated = command('wsl.exe', ['--exec', '/usr/bin/wslpath', '-a', directory.replaceAll('\\', '/')]); assert.equal(translated.status, 0);
    linuxDirectory = translated.stdout.toString().trim();
  } else { assert.equal(process.platform, 'linux'); assert.equal(process.arch, 'x64'); }
  mkdirSync(join(directory, 'cases'));
  for (const test of cases) {
    activeCase = test;
    const caseDirectory = join(directory, 'cases', test.name); mkdirSync(caseDirectory);
    for (const name of test.directories) mkdirSync(ownedPath(caseDirectory, name), { recursive: true });
    for (const [name, spec] of Object.entries(test.inputs)) {
      const path = ownedPath(caseDirectory, name), parent = resolve(path, '..'); mkdirSync(parent, { recursive: true }); writeSpec(path, spec);
    }
    if (test.project) for (const name of ['naja.toml', 'naja.alias']) writeSpec(ownedPath(caseDirectory, name), bytes(fixture('project/' + name)));
    let unavailable = null;
    for (const link of test.links) {
      ownedPath(caseDirectory, link.target);
      try { symlinkSync(link.target, ownedPath(caseDirectory, link.path), link.type); }
      catch (error) {
        if (!['EPERM', 'EACCES', 'ENOTSUP', 'ENOSYS'].includes(error.code)) throw error;
        unavailable = error.code; break;
      }
    }
    const input = join(caseDirectory, 'program.' + test.extension); writeSpec(input, bytes(test.source));
    const before = snapshot(caseDirectory);
    writeFileSync(join(directory, test.name + '.before.json'), JSON.stringify(before, null, 2) + '\n');
    if (unavailable !== null) {
      results.push({ ...identity(test), result: 'not_run', reason: 'Node symlink fixture capability: ' + unavailable });
      activeCase = null; console.log('NOT_RUN ' + test.name + ' ' + unavailable); continue;
    }
    const artifact = join(directory, test.name + '.elf'), project = test.project ? ['--project-root', caseDirectory] : [];
    const checked = command(compiler, ['check', input, ...project]);
    const afterCheck = snapshot(caseDirectory);
    writeFileSync(join(directory, test.name + '.after-check.json'), JSON.stringify(afterCheck, null, 2) + '\n');
    assert.deepEqual(afterCheck, before, test.name + ': check executed or changed fixture filesystem');
    const emitted = command(compiler, ['build', input, '--target', 'x86_64-unknown-linux-gnu', '--output', artifact, ...project]);
    const afterBuild = snapshot(caseDirectory);
    writeFileSync(join(directory, test.name + '.after-build.json'), JSON.stringify(afterBuild, null, 2) + '\n');
    assert.deepEqual(afterBuild, before, test.name + ': build executed or changed fixture filesystem');
    const record = { ...identity(test), compiler_source: portable(relative(root, input)), compiler_source_platform: process.platform,
      native_cwd: linuxDirectory + '/cases/' + test.name, data_paths_are_relative_to_native_cwd: true, check_exit: checked.status, build_exit: emitted.status,
      before_filesystem_sha256: hash(JSON.stringify(before)), after_check_filesystem_sha256: hash(JSON.stringify(afterCheck)), after_build_filesystem_sha256: hash(JSON.stringify(afterBuild)) };
    if (test.reject) {
      for (const result of [checked, emitted]) {
        assert.equal(result.status, 1, test.name + ': expected compile rejection: ' + result.stderr);
        assert.ok(result.stderr.toString().includes(test.diagnostic), test.name + ': original diagnostic: ' + result.stderr);
        assert.equal(result.stdout.length, 0);
      }
      assert.equal(existsSync(artifact), false, test.name + ': rejected source emitted an ELF');
    } else {
      assert.equal(checked.status, 0, test.name + ': check: ' + checked.stderr);
      assert.equal(emitted.status, 0, test.name + ': build: ' + emitted.stderr);
      const linuxArtifact = linuxDirectory + '/' + test.name + '.elf';
      let executed;
      if (process.platform === 'win32') {
        const permission = command('wsl.exe', ['--exec', '/usr/bin/chmod', 'u+x', linuxArtifact]); assert.equal(permission.status, 0);
        executed = command('wsl.exe', ['--cd', record.native_cwd, '--exec', '/usr/bin/timeout', '--signal=TERM', '--kill-after=1s', String(nativeLimitSeconds), linuxArtifact]);
      } else {
        chmodSync(artifact, 0o700);
        executed = command('/usr/bin/timeout', ['--signal=TERM', '--kill-after=1s', String(nativeLimitSeconds), artifact], { cwd: caseDirectory });
      }
      const afterNative = snapshot(caseDirectory), expectedAfter = Object.assign(Object.create(null), before);
      for (const [name, spec] of Object.entries(test.outputs)) {
        assert.ok(!Object.hasOwn(before, portable(name)), 'expected output would overwrite a preexisting fixture');
        expectedAfter[portable(name)] = specIdentity(spec);
      }
      writeFileSync(join(directory, test.name + '.after-native.json'), JSON.stringify(afterNative, null, 2) + '\n');
      const verify = () => {
        assert.equal(executed.status, test.exit, test.name + ': native exit; stderr: ' + executed.stderr);
        assert.deepEqual(executed.stdout, bytes(test.stdout), test.name + ': stdout bytes');
        assert.deepEqual(executed.stderr, bytes(test.stderr), test.name + ': stderr bytes');
        assert.deepEqual(afterNative, expectedAfter, test.name + ': native filesystem snapshot');
      };
      if (test.control) {
        assert.equal(executed.status, 0, test.name + ': changed source must execute normally');
        assert.throws(verify, error => error.code === 'ERR_ASSERTION' && /stdout bytes|native filesystem snapshot/.test(error.message), test.name + ': verifier accepted changed file data');
        record.control_outcome = 'verifier_rejected_changed_source';
      } else verify();
      Object.assign(record, { native_exit: executed.status, elf_sha256: hash(readFileSync(artifact)), stdout_sha256: hash(executed.stdout), stderr_sha256: hash(executed.stderr),
        actual_filesystem: afterNative, expected_filesystem: expectedAfter, after_native_filesystem_sha256: hash(JSON.stringify(afterNative)) });
    }
    record.result = 'passed'; results.push(record); activeCase = null; console.log('PASS ' + test.name);
  }
  const summary = { schema_version: 1, state: 'executed', source_commit: sourceHead, source_status: status.stdout.toString(), source_diff_sha256: hash(diff.stdout),
    host: process.platform + '-' + process.arch, target: 'x86_64-unknown-linux-gnu', node: process.version,
    compiler_version: version.stdout.toString().trim(), compiler_sha256: hash(readFileSync(compiler)), harness_sha256: hash(readFileSync(fileURLToPath(import.meta.url))),
    fixture_index_sha256: hash(readFileSync(join(fixtureRoot, 'fixture-index.json'))), native_timeout_seconds: nativeLimitSeconds, overall_limit_ms: overallLimitMs,
    scope, passed: results.filter(result => result.result === 'passed').length, not_run: results.filter(result => result.result === 'not_run').length, commands, results };
  writeFileSync(join(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(`${summary.passed} file source checks passed; ${summary.not_run} not_run. Artifacts: ${portable(relative(root, directory))}`);
  console.log('Scope: private stable-file and strict UTF-8 source cases; no sandbox, OS I/O deadline, complete filesystem/Python, FC1 or HATCH claim.');
}
