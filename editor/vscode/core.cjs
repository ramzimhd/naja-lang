'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { TextDecoder } = require('node:util');
const { createHash } = require('node:crypto');

const LIMITS = Object.freeze({ source: 1048576, output: 1048576, diagnostics: 32, code: 64, message: 8192, check: 10000, build: 30000, run: 15000, nativeRun: 5000 });
class AdapterError extends Error { constructor(code, message) { super(message); this.code = code; } }
function fail(code, message) { throw new AdapterError(code, message); }
function exact(value, names) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name)); }
function text(bytes) { try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { fail('encoding', 'Compiler transport or disk source is not valid UTF-8.'); } }

function snapshot(document) {
  return { uri: document.uri.toString(), scheme: document.uri.scheme, authority: document.uri.authority || '', file: document.uri.fsPath, language: document.languageId, version: document.version, text: document.getText(), dirty: document.isDirty, closed: document.isClosed };
}
function eligible(item, trusted) {
  if (!trusted) fail('trust', 'Compiler commands require a trusted workspace.');
  if (item.closed || item.dirty || item.scheme !== 'file' || item.authority || item.language !== 'naja' || !path.isAbsolute(item.file) || path.extname(item.file) !== '.naja') fail('document', 'Select a saved, clean, local .naja file. Save explicitly before invoking this command.');
  if (!Number.isSafeInteger(item.version) || item.version < 0 || typeof item.text !== 'string' || Buffer.byteLength(item.text, 'utf8') > LIMITS.source) fail('source', 'Source exceeds the 1 MiB limit or has an invalid document identity.');
}
function sameSnapshot(before, now) { return ['uri', 'scheme', 'authority', 'file', 'language', 'version', 'text', 'dirty', 'closed'].every(key => before[key] === now[key]); }

async function diskBytes(filename, limit = LIMITS.source, missing = false) {
  let before;
  try { before = await fs.lstat(filename); } catch (error) { if (missing && error.code === 'ENOENT') return null; throw error; }
  if (!before.isFile() || before.isSymbolicLink() || before.size > limit) fail('disk', 'Disk input is not an ordinary file within its read budget.');
  const handle = await fs.open(filename, 'r');
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) fail('disk', 'Disk source identity changed.');
    const bytes = Buffer.alloc(limit + 1); let count = 0;
    while (count < bytes.length) { const read = await handle.read(bytes, count, bytes.length - count, null); if (!read.bytesRead) break; count += read.bytesRead; }
    const after = await handle.stat(), final = await fs.lstat(filename);
    if (count > limit || after.size !== count || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs || final.isSymbolicLink() || final.dev !== opened.dev || final.ino !== opened.ino || final.size !== after.size || final.mtimeMs !== after.mtimeMs) fail('disk', 'Disk source changed during its bounded read.');
    return bytes.subarray(0, count);
  } finally { await handle.close(); }
}
async function diskText(filename) { return text(await diskBytes(filename)); }
async function assertDisk(item) { if (await diskText(item.file) !== item.text) fail('stale', 'Disk contents differ from the saved editor snapshot; results were discarded.'); }
async function projectFingerprint(root) {
  if (!root) return '';
  if (typeof root !== 'string' || !path.isAbsolute(root) || root.includes('\0') || root.split(/[\\/]/).includes('..')) fail('project', 'Project context requires an explicit absolute root without parent traversal.');
  const parts = [];
  for (const name of ['naja.toml', 'naja.alias']) { const bytes = await diskBytes(path.join(root, name), 65536, true); parts.push(bytes === null ? null : createHash('sha256').update(bytes).digest('hex')); }
  return JSON.stringify(parts);
}

async function compilerFile(filename, platform = process.platform) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename) || filename.includes('\0')) fail('compiler', 'Set naja.compilerPath to an explicit absolute native compiler executable.');
  if (platform === 'win32' && path.extname(filename).toLowerCase() !== '.exe') fail('compiler', 'Windows compiler selection requires a native .exe, not a command script.');
  const metadata = await fs.lstat(filename);
  if (!metadata.isFile() || metadata.isSymbolicLink()) fail('compiler', 'Compiler selection must be an ordinary native executable file.');
  const handle = await fs.open(filename, 'r');
  try {
    const magic = Buffer.alloc(4); const read = await handle.read(magic, 0, 4, 0);
    const native = platform === 'win32' ? magic[0] === 0x4d && magic[1] === 0x5a : platform === 'linux' ? magic.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) : platform === 'darwin' ? ['feedface', 'feedfacf', 'cefaedfe', 'cffaedfe', 'cafebabe', 'bebafeca'].includes(magic.toString('hex')) : false;
    if (read.bytesRead < 4 || !native) fail('compiler', 'Selected file is not a native executable for this extension host.');
  } finally { await handle.close(); }
}

function makePlan(kind, item, configuration, { output = null, platform = process.platform, arch = process.arch } = {}) {
  if (!['check', 'build', 'run'].includes(kind)) fail('command', 'Unknown compiler command.');
  const args = [kind, item.file];
  if (kind === 'check') args.push('--json');
  if (kind === 'build') {
    if (typeof output !== 'string' || !path.isAbsolute(output) || output === item.file || output.includes('\0')) fail('output', 'Select a new absolute output file, different from the source. Existing output is refused by the compiler.');
    args.push('--target', 'x86_64-unknown-linux-gnu', '--output', output);
  }
  if (kind === 'run') {
    if (platform === 'win32') { if (configuration.windowsRunner !== 'wsl') fail('runner', 'Windows Run requires explicit naja.windowsRunner = wsl and local WSL prerequisites.'); args.push('--runner', 'wsl'); }
    else if (platform !== 'linux' || arch !== 'x64') fail('runner', 'Run is currently available on Linux x64 or explicitly selected Windows/WSL only.');
    args.push('--timeout-ms', String(LIMITS.nativeRun));
  }
  if (configuration.projectRoot) { if (!path.isAbsolute(configuration.projectRoot) || configuration.projectRoot.includes('\0')) fail('project', 'naja.projectRoot must be an explicit absolute owning root or empty.'); args.push('--project-root', configuration.projectRoot); }
  return { tool: configuration.compilerPath, args, cwd: path.dirname(item.file), timeoutMs: LIMITS[kind], maxOutput: LIMITS.output };
}

function runProcess(plan, { signal, spawnFn = spawn } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new AdapterError('cancelled', 'Compiler command cancelled.')); return; }
    let child, timer, reason = null, settled = false, count = 0;
    const out = [], err = [];
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel); if (error) reject(error); else resolve(value); };
    const terminate = code => { if (!reason) reason = new AdapterError(code, code === 'timeout' ? 'Compiler deadline exceeded.' : code === 'overflow' ? 'Compiler output exceeded 1 MiB.' : 'Compiler command cancelled.'); try { child?.kill('SIGKILL'); } catch { /* Report bounded failure below; no tree-termination claim. */ } finish(reason); };
    const cancel = () => terminate('cancelled');
    try { child = spawnFn(plan.tool, plan.args, { cwd: plan.cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch { finish(new AdapterError('spawn', 'Unable to launch the selected compiler.')); return; }
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => terminate('timeout'), plan.timeoutMs);
    const collect = target => bytes => { if (settled) return; const data = Buffer.from(bytes); count += data.length; if (count > plan.maxOutput) { terminate('overflow'); return; } target.push(data); };
    child.stdout.on('data', collect(out)); child.stderr.on('data', collect(err));
    child.on('error', () => finish(new AdapterError('spawn', 'Unable to launch the selected compiler.')));
    child.on('close', (exitCode, exitSignal) => { if (exitSignal || !Number.isInteger(exitCode)) finish(new AdapterError('process', 'Compiler terminated without an ordinary exit code.')); else finish(null, { exitCode, stdout: Buffer.concat(out), stderr: Buffer.concat(err) }); });
    if (signal?.aborted) cancel();
  });
}

function validateReport(result, item) {
  if (result.stderr.length || ![0, 1].includes(result.exitCode)) fail('transport', 'Compiler check did not return the semantic JSON protocol; inspect its bounded output.');
  let value; try { value = JSON.parse(text(result.stdout)); } catch (error) { if (error instanceof AdapterError) throw error; fail('transport', 'Compiler check returned malformed or extra JSON output.'); }
  if (!exact(value, ['schema_version', 'source', 'status', 'diagnostics', 'omitted_diagnostics']) || value.schema_version !== 1 || value.source !== item.file || value.status !== (result.exitCode === 0 ? 'passed' : 'failed') || !Array.isArray(value.diagnostics) || value.diagnostics.length > LIMITS.diagnostics || !Number.isSafeInteger(value.omitted_diagnostics) || value.omitted_diagnostics < 0) fail('transport', 'Compiler report identity, version or status is invalid.');
  if (value.status === 'passed' && (value.diagnostics.length || value.omitted_diagnostics) || value.status === 'failed' && !value.diagnostics.length && !value.omitted_diagnostics) fail('transport', 'Compiler diagnostic count contradicts its status.');
  const lines = item.text.split(/\r\n|\r|\n/);
  const position = point => {
    if (!exact(point, ['line', 'character']) || !Number.isSafeInteger(point.line) || !Number.isSafeInteger(point.character) || point.line < 0 || point.line >= lines.length || point.character < 0 || point.character > lines[point.line].length) fail('transport', 'Compiler diagnostic range is outside the captured source.');
    const line = lines[point.line], offset = point.character;
    if (offset && offset < line.length && /[\uD800-\uDBFF]/.test(line[offset - 1]) && /[\uDC00-\uDFFF]/.test(line[offset])) fail('transport', 'Compiler diagnostic range splits a Unicode scalar.');
  };
  for (const diagnostic of value.diagnostics) {
    if (!exact(diagnostic, ['code', 'message', 'start', 'end']) || typeof diagnostic.code !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(diagnostic.code) || typeof diagnostic.message !== 'string' || !diagnostic.message.trim() || diagnostic.message.length > LIMITS.message) fail('transport', 'Compiler diagnostic fields are invalid or oversized.');
    position(diagnostic.start); position(diagnostic.end);
    if (diagnostic.end.line < diagnostic.start.line || diagnostic.end.line === diagnostic.start.line && diagnostic.end.character < diagnostic.start.character) fail('transport', 'Compiler diagnostic range is reversed.');
  }
  return value;
}

class Sessions {
  constructor() { this.active = null; }
  cancel() { this.active?.controller.abort(); this.active = null; }
  begin() { this.cancel(); const slot = { controller: new AbortController() }; this.active = slot; return { signal: slot.controller.signal, current: () => this.active === slot && !slot.controller.signal.aborted, cancel: () => slot.controller.abort(), dispose: () => { if (this.active === slot) this.active = null; } }; }
}
async function executeFresh(plan, ticket, current, runner = runProcess) {
  if (!ticket.current() || !await current() || !ticket.current()) fail('stale', 'Compiler request became stale before launch.');
  const result = await runner(plan, { signal: ticket.signal });
  if (!ticket.current() || !await current() || !ticket.current()) fail('stale', 'Compiler result became stale and was discarded.');
  return result;
}
module.exports = { LIMITS, AdapterError, snapshot, eligible, sameSnapshot, diskText, assertDisk, projectFingerprint, compilerFile, makePlan, runProcess, validateReport, Sessions, executeFresh };
