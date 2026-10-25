// Development packager only. Installed compiler workflows do not require Node.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const SOURCE = 'a51c2808bae4b57596f7f957ce53530004a504f8';
export const LIMITS = Object.freeze({ binary: 33554432, text: 2097152, files: 24, libraries: 8 });
const repository = fileURLToPath(new URL('../../', import.meta.url));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function nativeElf(bytes) {
  if (bytes.length < 64 || bytes.length > LIMITS.binary || !bytes.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70])) || bytes[4] !== 2 || bytes[5] !== 1 || bytes.readUInt16LE(18) !== 62 || ![2, 3].includes(bytes.readUInt16LE(16))) throw new Error('Expected a bounded Linux x86-64 ELF compiler.');
}
export function inspectReports({ dynamic, program, versions }) {
  if (![dynamic, program, versions].every(value => typeof value === 'string' && Buffer.byteLength(value) <= LIMITS.text)) throw new Error('ELF inspection exceeds its text budget.');
  const needed = [...dynamic.matchAll(/\(NEEDED\).*?\[([^\]]+)\]/g)].map(match => match[1]).sort();
  const allowed = new Set(['libc.so.6', 'libgcc_s.so.1', 'libm.so.6', 'libdl.so.2', 'libpthread.so.0', 'librt.so.1', 'libutil.so.1']);
  const interpreter = program.match(/Requesting program interpreter:\s*([^\]]+)\]/)?.[1];
  if (!needed.length || needed.length > LIMITS.libraries || new Set(needed).size !== needed.length || needed.some(name => !allowed.has(name)) || interpreter !== '/lib64/ld-linux-x86-64.so.2') throw new Error('Unexpected or missing native OS dependency/interpreter.');
  const glibc = [...new Set([...versions.matchAll(/\bGLIBC_([0-9]+(?:\.[0-9]+)+)\b/g)].map(match => match[1]))].sort((a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0); return 0; });
  if (!glibc.length) throw new Error('Missing glibc symbol-version inventory.');
  return { interpreter, needed, glibc_symbol_versions: glibc, highest_required_glibc_symbol: glibc.at(-1), allowed_runtime: 'Declared Linux loader/glibc/libgcc OS libraries; no bundled Python, Rust compiler, Node or LLVM.' };
}
async function ordinary(file, limit) { const stat = await lstat(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) throw new Error('Input must be an ordinary bounded file.'); const bytes = await readFile(file); if (bytes.length > limit) throw new Error('Input grew beyond its budget.'); return bytes; }
function fromGit(file) { const value = spawnSync('git', ['show', `${SOURCE}:${file}`], { cwd: repository, maxBuffer: LIMITS.text, encoding: null }); if (value.error || value.status !== 0) throw new Error('Pinned source record is unavailable.'); return value.stdout; }
export async function stagePackage({ binary, inspection, rustLicenses, output }) {
  if (![binary, rustLicenses, output].every(value => typeof value === 'string' && path.isAbsolute(value))) throw new Error('Inputs/output require explicit absolute paths.');
  const bytes = await ordinary(binary, LIMITS.binary); nativeElf(bytes); const dependencies = inspectReports(inspection);
  const payload = new Map([['bin/naja', bytes], ['LICENSE', fromGit('LICENSE')], ['NOTICE', fromGit('NOTICE')], ['provenance/Cargo.lock', fromGit('Cargo.lock')], ['provenance/toolchains.json', fromGit('bootstrap/toolchains.json')], ['provenance/unicode.json', fromGit('compatibility/unicode/provenance.json')]]);
  const licenses = [['tinyvec-1.12.0/LICENSE-APACHE.md', 'tinyvec-APACHE.md'], ['tinyvec_macros-0.1.1/LICENSE-APACHE.md', 'tinyvec_macros-APACHE.md'], ['unicode-ident-1.0.24/LICENSE-APACHE', 'unicode-ident-APACHE'], ['unicode-ident-1.0.24/LICENSE-UNICODE', 'unicode-ident-UNICODE'], ['unicode-normalization-0.1.25/LICENSE-APACHE', 'unicode-normalization-APACHE']];
  for (const [input, outputName] of licenses) payload.set('licenses/seed/' + outputName, fromGit('third_party/rust-seed/' + input));
  for (const name of ['COPYRIGHT', 'LICENSE-APACHE', 'LICENSE-MIT']) { const value = await ordinary(path.join(rustLicenses, name), LIMITS.text); if (!value.length) throw new Error('Rust notices must be nonempty.'); payload.set('licenses/rust/' + name, value); }
  payload.set('install.sh', await ordinary(fileURLToPath(new URL('install.sh', import.meta.url)), LIMITS.text));
  payload.set('README.md', Buffer.from(`# NAJA 0.0.1 experimental Rust seed — unsigned Linux x86-64\n\nSource: ${SOURCE}; .naja edition 2026.1. This bounded native compiler is not FC1/HATCH complete or self-hosted. See --help for actual features and exclusions.\n\nExtract this archive into a new owned directory. Inspect manifest.json and SHA256SUMS; hashes establish integrity, not publisher authenticity. Run /bin/sh install.sh NEW_ABSOLUTE_PREFIX with ordinary user rights. Existing prefixes are refused; partial failures are preserved. The installer needs ordinary OS sh/cat/chmod/dirname/grep/mkdir/sha256sum. No downloads or profile edits occur. Unpack uses tar/gzip. Never use sudo.\n\nInvoke NEW_PREFIX/bin/naja --help, init NEW_DIRECTORY, check SOURCE, build SOURCE --target x86_64-unknown-linux-gnu --output NEW_FILE, run SOURCE, or test DIRECTORY --json. Run/test use ordinary OS process rights and bounded deadlines, not a sandbox. No Rust/Cargo, Node, Python, C compiler or LLVM is required by these installed-compiler workflows. The Rust seed build still requires Rust/Cargo and four pinned Unicode crates.\n\nOS loader: ${dependencies.interpreter}; needed: ${dependencies.needed.join(', ')}. Highest observed required GLIBC symbol: ${dependencies.highest_required_glibc_symbol}. Older distributions and other architectures are unverified. Required OS libraries remain separately installed; they are not included in this archive. Native applications from the current backend have a separately inspected dependency closure.\n\nNo LSP/DAP, full module resolver, full language semantics, native cells or cross-platform installation claim follows. CLI --version identifies the experimental seed but does not embed the source SHA; this manifest carries the pinned provenance. Unsigned, local review artifact only; no release publication.\n`));
  if (payload.size + 2 > LIMITS.files) throw new Error('Package inventory budget exceeded.');
  const files = [...payload].map(([name, data]) => ({ path: name, bytes: data.length, sha256: sha256(data) })).sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const manifest = { schema_version: 1, contract_revision: '1.3', kind: 'experimental_native_rust_seed', compiler_version: '0.0.1', source_commit: SOURCE, target: 'x86_64-unknown-linux-gnu', language_edition: '2026.1', signature: 'unsigned', dependencies, files, limits: ['T12 / FC1-01 preparatory scoped artifact, not full milestone acceptance.', 'Rust-built seed; no self-hosting or clean-VM/security-sandbox claim.', 'Seed Unicode licenses and Rust notices retained; OS libraries are supplied by the operating system.'] };
  payload.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  const checksums = [...payload].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([name, data]) => `${sha256(data)}  ${name}\n`).join(''); payload.set('SHA256SUMS', Buffer.from(checksums));
  // All inputs are validated before this exclusive leaf creation. Never clean up.
  await mkdir(output);
  for (const [name, data] of payload) { const target = path.join(output, name); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, data, { flag: 'wx', mode: name === 'bin/naja' ? 0o755 : 0o644 }); }
  assert.equal(sha256(await ordinary(binary, LIMITS.binary)), sha256(bytes), 'Compiler changed while packaging; owned partial output is preserved.');
  return { source_commit: SOURCE, compiler_sha256: sha256(bytes), files: payload.size, manifest };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), options = {};
  if (args.length !== 8) throw new Error('Usage: node package.mjs --binary ELF --inspection JSON --rust-licenses DIRECTORY --output NEW_DIRECTORY');
  for (let i = 0; i < args.length; i += 2) { const key = { '--binary': 'binary', '--inspection': 'inspection', '--rust-licenses': 'rustLicenses', '--output': 'output' }[args[i]]; if (!key || options[key]) throw new Error('Unknown/duplicate packaging option.'); options[key] = args[i + 1]; }
  options.inspection = JSON.parse(await ordinary(options.inspection, LIMITS.text));
  console.log(JSON.stringify(await stagePackage(options), null, 2));
}
