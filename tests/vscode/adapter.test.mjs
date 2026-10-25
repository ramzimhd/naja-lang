import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
const require = createRequire(import.meta.url);
const core = require('../../editor/vscode/core.cjs');
const extension = require('../../editor/vscode/extension.cjs');
const root = new URL('../../', import.meta.url);
const item = (text = 'print("é𝄞" + missing)\n') => ({ uri: 'file:///synthetic.naja', scheme: 'file', authority: '', file: path.resolve('synthetic é & inert.naja'), language: 'naja', version: 1, text, dirty: false, closed: false });
const config = () => ({ compilerPath: process.execPath, projectRoot: '', windowsRunner: 'disabled' });
const result = (value, exitCode = 1) => ({ exitCode, stdout: Buffer.from(JSON.stringify(value)), stderr: Buffer.alloc(0) });
const report = (source = item()) => ({ schema_version: 1, source: source.file, status: 'failed', diagnostics: [{ code: 'NJA101', message: 'Undefined name.', start: { line: 0, character: 14 }, end: { line: 0, character: 21 } }], omitted_diagnostics: 0 });
async function fixture(t) { const base = await mkdtemp(path.join(os.tmpdir(), 'naja-vscode-unit-')); t.after(async () => { assert.equal(path.dirname(path.resolve(base)), path.resolve(os.tmpdir())); assert.ok(path.basename(base).startsWith('naja-vscode-unit-')); await rm(base, { recursive: true, force: true }); }); return base; }

test('frozen budgets and package association keep Python and automatic activation untouched', async () => {
  assert.deepEqual(core.LIMITS, { source: 1048576, output: 1048576, diagnostics: 32, code: 64, message: 8192, check: 10000, build: 30000, run: 15000, nativeRun: 5000 });
  const pkg = JSON.parse(await readFile(new URL('editor/vscode/package.json', root)));
  assert.deepEqual(pkg.contributes.languages[0].extensions, ['.naja']);
  assert.ok(pkg.activationEvents.every(event => event.startsWith('onCommand:')));
  assert.equal(pkg.capabilities.untrustedWorkspaces.supported, 'limited');
  assert.equal(pkg.capabilities.virtualWorkspaces.supported, false);
  assert.equal(pkg.contributes.configuration.properties['naja.compilerPath'].scope, 'machine');
  assert.deepEqual(pkg.dependencies ?? {}, {});
  assert.equal(pkg.contributes.debuggers, undefined);
});

test('trust, URI, extension, dirty/closed state and source budget gate every launch', () => {
  core.eligible(item(), true);
  assert.throws(() => core.eligible(item(), false), { code: 'trust' });
  for (const mutation of [{ scheme: 'untitled' }, { authority: 'server' }, { language: 'python' }, { file: path.resolve('source.py') }, { dirty: true }, { closed: true }, { version: NaN }, { text: 'x'.repeat(1048577) }]) assert.throws(() => core.eligible({ ...item(), ...mutation }, true));
});

test('check/build/run plans preserve literal argument boundaries and explicit project selection', () => {
  const source = item(), settings = { ...config(), projectRoot: path.resolve('project é & $(literal)') };
  assert.deepEqual(core.makePlan('check', source, settings).args, ['check', source.file, '--json', '--project-root', settings.projectRoot]);
  const output = path.resolve('new é & ; $(literal).elf');
  assert.deepEqual(core.makePlan('build', source, settings, { output }).args, ['build', source.file, '--target', 'x86_64-unknown-linux-gnu', '--output', output, '--project-root', settings.projectRoot]);
  assert.throws(() => core.makePlan('build', source, settings, { output: source.file }), { code: 'output' });
  assert.throws(() => core.makePlan('run', source, settings, { platform: 'win32' }), { code: 'runner' });
  assert.deepEqual(core.makePlan('run', source, { ...settings, windowsRunner: 'wsl' }, { platform: 'win32' }).args.slice(0, 6), ['run', source.file, '--runner', 'wsl', '--timeout-ms', '5000']);
  assert.equal(core.makePlan('run', source, settings, { platform: 'linux', arch: 'x64' }).timeoutMs, 15000);
  for (const options of [{ platform: 'darwin', arch: 'arm64' }, { platform: 'linux', arch: 'arm64' }]) assert.throws(() => core.makePlan('run', source, settings, options), { code: 'runner' });
  assert.throws(() => core.makePlan('check', source, { ...settings, projectRoot: 'relative' }), { code: 'project' });
});

test('valid original UTF16 diagnostics handle astral scalars and LF/CRLF/CR', () => {
  for (const ending of ['\n', '\r\n', '\r']) {
    const source = item('# é𝄞' + ending + 'print("é𝄞" + missing)' + ending), value = report(source);
    value.diagnostics[0].start = { line: 1, character: 14 }; value.diagnostics[0].end = { line: 1, character: 21 };
    assert.equal(core.validateReport(result(value), source).diagnostics.length, 1);
  }
  const source = item('𝄞x'), value = report(source); value.diagnostics[0].start.character = 1; value.diagnostics[0].end.character = 2;
  assert.throws(() => core.validateReport(result(value), source), { code: 'transport' });
});

test('malformed schema/status/source/ranges and oversized diagnostics never become passes', () => {
  const mutations = [value => value.schema_version = 2, value => value.source += 'other', value => value.status = 'passed', value => value.extra = true,
    value => value.omitted_diagnostics = -1, value => value.omitted_diagnostics = NaN, value => value.diagnostics = [], value => value.diagnostics = Array(33).fill(value.diagnostics[0]),
    value => value.diagnostics[0].code = '', value => value.diagnostics[0].message = 'x'.repeat(8193), value => value.diagnostics[0].start.line = 99,
    value => value.diagnostics[0].end.character = 999, value => value.diagnostics[0].start.character = 22, value => value.diagnostics[0].start.character = 0.5,
    value => value.diagnostics[0].start.extra = 1, value => value.diagnostics[0].unknown = true];
  for (const mutate of mutations) { const value = report(); mutate(value); assert.throws(() => core.validateReport(result(value), item())); }
  for (const stdout of ['{}{}', '', 'not-json', JSON.stringify(report()) + '\ntrailing']) assert.throws(() => core.validateReport({ ...result(report()), stdout: Buffer.from(stdout) }, item()));
  assert.throws(() => core.validateReport({ ...result(report()), stdout: Buffer.from([0xff]) }, item()), { code: 'encoding' });
  assert.throws(() => core.validateReport({ ...result(report()), stderr: Buffer.from('input failure') }, item()), { code: 'transport' });
  assert.throws(() => core.validateReport(result(report(), 2), item()), { code: 'transport' });
  const passed = { ...report(), status: 'passed', diagnostics: [] };
  assert.equal(core.validateReport(result(passed, 0), item()).status, 'passed');
  passed.omitted_diagnostics = 1; assert.throws(() => core.validateReport(result(passed, 0), item()));
});

test('disk and project snapshots reject unsaved, external, invalid UTF8 and oversized changes', async t => {
  const directory = await fixture(t), file = path.join(directory, 'source é.naja'), source = { ...item(), file };
  await writeFile(file, source.text); await core.assertDisk(source);
  await writeFile(file, 'external change'); await assert.rejects(core.assertDisk(source), { code: 'stale' });
  await writeFile(file, Buffer.from([0xff])); await assert.rejects(core.diskText(file), { code: 'encoding' });
  await writeFile(file, Buffer.alloc(1048577)); await assert.rejects(core.diskText(file), { code: 'disk' });
  const missing = await core.projectFingerprint(directory); await writeFile(path.join(directory, 'naja.toml'), '[project]\nname="test"\n');
  const before = await core.projectFingerprint(directory); assert.notEqual(before, missing);
  await writeFile(path.join(directory, 'naja.alias'), '# changed'); assert.notEqual(await core.projectFingerprint(directory), before);
  await writeFile(path.join(directory, 'naja.alias'), Buffer.alloc(65537)); await assert.rejects(core.projectFingerprint(directory), { code: 'disk' });
  await assert.rejects(core.projectFingerprint('relative'), { code: 'project' });
});

test('native compiler selection rejects script files and relative paths without executing', async t => {
  const directory = await fixture(t), script = path.join(directory, process.platform === 'win32' ? 'fake.exe' : 'fake'); await writeFile(script, '#!/bin/sh\necho no\n');
  await assert.rejects(core.compilerFile(script), { code: 'compiler' }); await assert.rejects(core.compilerFile('relative'), { code: 'compiler' });
  await core.compilerFile(process.execPath);
});

test('subprocess API uses shell false, literal args, null stdin and forced direct-child cancellation', async () => {
  let options, actualArgs, kills = 0; const controller = new AbortController();
  const spawnFn = (_, args, value) => { actualArgs = args; options = value; const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = signal => { assert.equal(signal, 'SIGKILL'); kills++; }; return child; };
  const args = ['check', 'é & $(literal);.naja', '--json'];
  const pending = core.runProcess({ tool: 'explicit', args, cwd: 'explicit-cwd', timeoutMs: 1000, maxOutput: 1024 }, { spawnFn, signal: controller.signal });
  controller.abort(); await assert.rejects(pending, { code: 'cancelled' }); assert.equal(kills, 1);
  assert.deepEqual(actualArgs, args); assert.equal(options.shell, false); assert.equal(options.windowsHide, true); assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
  let called = false; await assert.rejects(core.runProcess({}, { signal: controller.signal, spawnFn: () => { called = true; } }), { code: 'cancelled' }); assert.equal(called, false);
});

test('real observed child output, timeout, cancellation and missing-tool errors are bounded', async () => {
  const plan = args => ({ tool: process.execPath, args: ['-e', ...args], cwd: process.cwd(), timeoutMs: 2000, maxOutput: 1024 });
  const good = await core.runProcess(plan(['process.stdout.write(process.argv[1])', 'é & $(literal);'])); assert.equal(good.stdout.toString(), 'é & $(literal);');
  await assert.rejects(core.runProcess({ ...plan(['setInterval(()=>{},1000)']), timeoutMs: 50 }), { code: 'timeout' });
  await assert.rejects(core.runProcess(plan(['process.stdout.write("x".repeat(2048))'])), { code: 'overflow' });
  const abort = new AbortController(), pending = core.runProcess(plan(['setInterval(()=>{},1000)']), { signal: abort.signal }); abort.abort(); await assert.rejects(pending, { code: 'cancelled' });
  await assert.rejects(core.runProcess({ ...plan([]), tool: path.resolve('does-not-exist-compiler') }), { code: 'spawn' });
});

test('new sessions and changed URI/version/text/config discard responses before and after launch', async () => {
  const sessions = new core.Sessions(), old = sessions.begin(), next = sessions.begin(); assert.equal(old.current(), false); assert.equal(next.current(), true); old.cancel(); assert.equal(next.current(), true);
  const original = item(); for (const change of [{ uri: 'file:///other.naja' }, { version: 2 }, { text: 'changed' }, { dirty: true }, { closed: true }]) assert.equal(core.sameSnapshot(original, { ...original, ...change }), false);
  let launches = 0; await assert.rejects(core.executeFresh({}, next, async () => false, async () => { launches++; }), { code: 'stale' }); assert.equal(launches, 0);
  let calls = 0; await assert.rejects(core.executeFresh({}, next, async () => ++calls === 1, async () => ({ exitCode: 0 })), { code: 'stale' });
  next.dispose(); assert.equal(next.current(), false);
});

function fakeVscode() {
  const handlers = new Map(), listeners = {}, diagnostics = new Map(), messages = []; let settings = config();
  const document = { uri: { toString: () => 'file:///fake.naja', scheme: 'file', authority: '', fsPath: path.resolve('fake.naja') }, languageId: 'naja', version: 1, isDirty: false, isClosed: false, getText: () => 'print(1)\n' };
  const disposable = () => ({ dispose() {} });
  const api = { workspace: { isTrusted: false, getConfiguration: () => ({ get: (name, fallback) => settings[name] ?? fallback }), onDidChangeTextDocument: fn => { listeners.change = fn; return disposable(); }, onDidCloseTextDocument: fn => { listeners.close = fn; return disposable(); }, onDidChangeConfiguration: fn => { listeners.config = fn; return disposable(); } },
    commands: { registerCommand: (name, fn) => { handlers.set(name, fn); return disposable(); } }, languages: { createDiagnosticCollection: () => ({ set: (uri, value) => diagnostics.set(uri.toString(), value), delete: uri => diagnostics.delete(uri.toString()), clear: () => diagnostics.clear(), dispose() {} }) },
    window: { activeTextEditor: { document }, createOutputChannel: () => ({ clear() {}, append() {}, appendLine() {}, show() {}, dispose() {} }), showErrorMessage: async message => messages.push(message), showSaveDialog: async () => undefined,
      withProgress: async (_, callback) => callback({}, { onCancellationRequested: () => disposable() }) }, ProgressLocation: { Notification: 1 }, DiagnosticSeverity: { Error: 0 }, Range: class { constructor(...args) { this.args = args; } }, Diagnostic: class { constructor(range, message) { this.range = range; this.message = message; } } };
  return { api, handlers, listeners, diagnostics, messages, document, settings: value => { settings = value; } };
}

test('adapter activation and document/config events never launch a compiler; untrusted commands refuse', async () => {
  const fake = fakeVscode(), context = { subscriptions: [] }; extension.activate(context, fake.api);
  assert.equal(fake.handlers.size, 4); assert.equal(fake.messages.length, 0);
  fake.listeners.change({ document: fake.document }); fake.listeners.close(fake.document); fake.listeners.config({}); assert.equal(fake.messages.length, 0);
  for (const kind of ['check', 'build', 'run']) await fake.handlers.get(`naja.${kind}`)();
  assert.equal(fake.messages.length, 3); assert.ok(fake.messages.every(message => message.includes('trusted workspace')));
  context.subscriptions.forEach(value => value.dispose());
});

test('mock host maps validated UTF16 ranges and invalidates them after edits without auto-save', async () => {
  const fake = fakeVscode(), context = { subscriptions: [] }; fake.api.workspace.isTrusted = true;
  let launches = 0, saved = 0; fake.document.save = () => { saved++; };
  const actual = { ...core, compilerFile: async () => {}, assertDisk: async () => {}, projectFingerprint: async () => '', executeFresh: async () => { launches++; const source = core.snapshot(fake.document); return result({ schema_version: 1, source: source.file, status: 'failed', diagnostics: [{ code: 'NJA101', message: 'Example error', start: { line: 0, character: 0 }, end: { line: 0, character: 5 } }], omitted_diagnostics: 0 }); } };
  const module = { exports: {} }; const source = await readFile(new URL('../../editor/vscode/extension.cjs', import.meta.url), 'utf8');
  vm.runInNewContext(source, { require: name => { assert.equal(name, './core.cjs'); return actual; }, module, console, Buffer });
  module.exports.activate(context, fake.api); await fake.handlers.get('naja.check')();
  assert.equal(launches, 1); assert.equal(saved, 0); assert.equal(fake.diagnostics.size, 1); assert.deepEqual([...fake.diagnostics.values()][0][0].range.args, [0, 0, 0, 5]);
  fake.document.version++; fake.document.isDirty = true; fake.listeners.change({ document: fake.document }); assert.equal(fake.diagnostics.size, 0); assert.equal(launches, 1); assert.equal(saved, 0);
  context.subscriptions.forEach(value => value.dispose());
});
