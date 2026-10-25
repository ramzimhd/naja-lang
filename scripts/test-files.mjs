// Independent native file and UTF8 checks; no interpreter or Python oracle.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const directory = mkdtempSync(resolve('target/files-native-'));
const driver = resolve('target/debug/examples', process.platform === 'win32' ? 'files_ir.exe' : 'files_ir');
function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, {encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024, ...options});
  assert.ifError(result.error); return result;
}
const built = command('cargo', ['build', '-p', 'naja-native', '--example', 'files_ir', '--locked', '--offline']);
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
function execute(artifact, shell = null) {
  if (process.platform === 'win32') {
    const permission = command('wsl.exe', ['--exec', '/usr/bin/chmod', 'u+x', artifact.linux]); assert.equal(permission.status, 0, permission.stderr);
  } else chmodSync(artifact.output, 0o700);
  const native = process.platform === 'win32' ? artifact.linux : artifact.output;
  const args = shell ? ['/usr/bin/timeout', '5', '/bin/sh', '-c', shell, 'files-native-test', native] : ['/usr/bin/timeout', '5', native];
  return process.platform === 'win32' ? command('wsl.exe', ['--exec', ...args]) : command(args[0], args.slice(1));
}
function run(name, source, stdout, status = 0, stderr = '') {
  const artifact = emit(name, source), result = execute(artifact);
  assert.equal(result.status, status, name + ': ' + result.stderr);
  assert.equal(result.stdout, stdout, name + ': stdout'); assert.equal(result.stderr, stderr, name + ': stderr');
  console.log(`PASS ${name} exit=${result.status} sha256=${createHash('sha256').update(readFileSync(artifact.output)).digest('hex')}`);
  checks++; return artifact;
}
console.log('Frozen contract SHA256=' + createHash('sha256').update(readFileSync(new URL('../tests/files/CONTRACT.md', import.meta.url))).digest('hex'));
const text = value => 't:' + Buffer.from(value, 'utf8').toString('hex');
const bytes = value => 'b:' + Buffer.from(value).toString('hex');
const fn = (parameters, body) => `function ${parameters}\n${body}end\n`;
const MAX = 16 * 1024 * 1024;
const io = 'NJA208: native file operation failed\n', badPath = 'NJA208: invalid native file path\n', utf8 = 'NJA209: invalid UTF-8 conversion\n', type = 'NJA205: native value type mismatch\n';
const fileLimit = 'NJA203: native file byte limit exceeded\n', pathLimit = 'NJA203: native path byte limit exceeded\n', grew = 'NJA203: native file grew beyond initial size\n', attempts = 'NJA208: native file syscall or EINTR limit exceeded\n';
function linux(executable, args, options = {}) { return process.platform === 'win32' ? command('wsl.exe', ['--exec', executable, ...args], options) : command(executable, args, options); }
const scratchResult = linux('/usr/bin/mktemp', ['-d', '/tmp/naja-native-files-XXXXXX']); assert.equal(scratchResult.status, 0, scratchResult.stderr);
const scratch = scratchResult.stdout.trim(); assert.match(scratch, /^\/tmp\/naja-native-files-[a-zA-Z0-9]+$/);
let hostScratch = scratch;
if (process.platform === 'win32') { const p = linux('/usr/bin/wslpath', ['-w', scratch]); assert.equal(p.status, 0); hostScratch = p.stdout.trim(); }
const nativePath = name => scratch + '/' + name, hostPath = name => join(hostScratch, name);
function hostInput(name, value) { writeFileSync(hostPath(name), value); return nativePath(name); }
function ok(executable, args) { const result = linux(executable, args); assert.equal(result.status, 0, result.stderr); return result; }
function bytesRepr(value) {
  const quote = value.includes(39) && !value.includes(34) ? '"' : "'"; let out = 'b' + quote;
  for (const b of value) { const ch = String.fromCharCode(b); if (ch === quote || b === 92) out += '\\' + ch; else if (b === 9) out += '\\t'; else if (b === 10) out += '\\n'; else if (b === 13) out += '\\r'; else if (b < 32 || b >= 127) out += '\\x' + b.toString(16).padStart(2, '0'); else out += ch; }
  return out + quote;
}
const values = ['', 'ASCII', '\0', 'é𝄞', 'e\u0301', '👩‍💻', 'quote\'"\\\n', ...[0x7f,0x80,0x7ff,0x800,0xd7ff,0xe000,0xffff,0x10000,0x10ffff].map(value => String.fromCodePoint(value))];
let source = '', expected = '';
for (const value of values) {
  source += `print ${text(value)} encode_utf8\nprint ${bytes(Buffer.from(value))} decode_utf8\nprint ${text(value)} encode_utf8 decode_utf8 len\n`;
  expected += bytesRepr(Buffer.from(value)) + '\n' + value + '\n' + Array.from(value).length + '\n'; oracleOutputs += 3;
}
run('strict-utf8-roundtrip-valid-boundaries-and-nul', source, expected);
for (const [index, value] of [[0x80],[0xc0,0x80],[0xc1,0xbf],[0xc2],[0xe0,0xa0],[0xf0,0x90,0x80],[0xe0,0x80,0x80],[0xed,0xa0,0x80],[0xf0,0x80,0x80,0x80],[0xf4,0x90,0x80,0x80],[0xf5,0x80,0x80,0x80],[0xff],[0x41,0x80]].entries()) run('invalid-utf8-' + index, 'print ' + bytes(value) + ' decode_utf8\n', '', 109, utf8);
const allBytes = Buffer.from(Array.from({length: 256}, (_, i) => i)), allInput = hostInput('all-bytes.input', allBytes);
run('read-all-bytes-and-empty-eof', `print ${text(allInput)} read_file\nprint ${text(hostInput('empty.input', Buffer.alloc(0)))} read_file len\n`, bytesRepr(allBytes) + '\n0\n');
const oddName = 'é spaces ; $() quotes\'".data', oddOutput = nativePath(oddName);
run('exclusive-write-none-and-inert-unicode-path', `print ${text(oddOutput)} ${text('é\0𝄞')} encode_utf8 write_file\nprint ${text(oddOutput)} read_file decode_utf8\n`, 'None\né\0𝄞\n');
const oddRead = linux('/usr/bin/cat', ['--', oddOutput], {encoding:null}); assert.equal(oddRead.status, 0); assert.deepEqual(oddRead.stdout, Buffer.from('é\0𝄞')); assert.equal(existsSync(hostPath('SHOULD_NOT_EXIST')), false); checks++;
const existing = hostInput('existing.data', Buffer.from('UNCHANGED\0DATA'));
run('existing-file-not-overwritten', `write b:00 | ${text(existing)}\n`, '', 108, io); assert.deepEqual(readFileSync(hostPath('existing.data')), Buffer.from('UNCHANGED\0DATA')); checks++;
const symlink = nativePath('leaf-link'); ok('/usr/bin/ln', ['-s', '--', existing, symlink]);
run('read-leaf-symlink-rejected', `print ${text(symlink)} read_file\n`, '', 108, io);
run('write-leaf-symlink-rejected', `write b:00 | ${text(symlink)}\n`, '', 108, io); assert.deepEqual(readFileSync(hostPath('existing.data')), Buffer.from('UNCHANGED\0DATA'));
const parent = nativePath('real-parent'), alias = nativePath('parent-link'); ok('/usr/bin/mkdir', ['--', parent]); ok('/usr/bin/ln', ['-s', '--', parent, alias]);
run('parent-directory-link-ordinary-os-policy', `write b:61 | ${text(alias + '/child')}\nprint ${text(parent + '/child')} read_file\n`, "b'a'\n");
const fifo = nativePath('private-fifo'); ok('/usr/bin/mkfifo', ['--mode=600', '--', fifo]);
for (const [name, path] of [['fifo',fifo],['directory',scratch],['device','/dev/null']]) run('nonregular-read-' + name, `print ${text(path)} read_file\n`, '', 108, io);
run('missing-file', `print ${text(nativePath('missing'))} read_file\n`, '', 108, io);
run('embedded-nul-path', `print ${text(nativePath('before\0after'))} read_file\n`, '', 108, badPath);
run('path-over-budget', `print ${text('x'.repeat(4096))} read_file\n`, '', 103, pathLimit);
let deepParent = scratch;
while (4095 - Buffer.byteLength(deepParent) - 1 > 200) { const remaining = 4095 - Buffer.byteLength(deepParent) - 1; deepParent += '/' + 'd'.repeat(Math.min(180, remaining - 200)); }
ok('/usr/bin/mkdir', ['-p', '--', deepParent]); const deepPath = deepParent + '/' + 'f'.repeat(4095 - Buffer.byteLength(deepParent) - 1); assert.equal(Buffer.byteLength(deepPath), 4095);
run('4095-byte-path-exact-boundary', `write b:7a | ${text(deepPath)}\nprint ${text(deepPath)} read_file\n`, "b'z'\n");
const uid = ok('/usr/bin/id', ['-u']).stdout.trim();
if (uid !== '0') {
  const denied = hostInput('denied.data', Buffer.from('private')); ok('/usr/bin/chmod', ['000', '--', denied]);
  run('read-permission-denied', `print ${text(denied)} read_file\n`, '', 108, io); ok('/usr/bin/chmod', ['600', '--', denied]);
  const blocked = nativePath('blocked-parent'); ok('/usr/bin/mkdir', ['--', blocked]); ok('/usr/bin/chmod', ['500', '--', blocked]);
  run('write-permission-denied', `write b:61 | ${text(blocked + '/new')}\n`, '', 108, io); ok('/usr/bin/chmod', ['700', '--', blocked]);
} else console.log('NOT_RUN permission-denial checks: Linux uid0 bypasses ordinary mode denial');
const modeArtifact = emit('mode-0600', `write b:61 | ${text(nativePath('mode.data'))}\n`), modeResult = execute(modeArtifact, 'umask 077; exec "$1"'); assert.equal(modeResult.status, 0, modeResult.stderr); assert.equal(ok('/usr/bin/stat', ['-c','%a','--',nativePath('mode.data')]).stdout.trim(), '600'); checks++;
for (const size of [MAX - 1, MAX, MAX + 1]) {
  const data = Buffer.alloc(size); for (let i = 0; i < size; i++) data[i] = (i * 73 + (i >>> 11)) & 255;
  const input = hostInput('size-' + size + '.input', data), output = nativePath('size-' + size + '.output');
  if (size > MAX) run('read-over-16mib', `print ${text(input)} read_file len\n`, '', 103, fileLimit);
  else { run('read-write-size-' + size, `set 0 ${text(input)} read_file\nprint %0 len\nwrite %0 | ${text(output)}\n`, size + '\n'); assert.deepEqual(readFileSync(hostPath('size-' + size + '.output')), data); checks++; }
}
const tooLargeOutput = nativePath('too-large.output');
run('write-over-16mib-no-output-created', 'set 0 b:61\nset 1 0\nwhile %1 24 <\nset 0 %0 %0 +\nset 1 %1 1 +\nend\nwrite %0 b:00 + | ' + text(tooLargeOutput) + '\n', '', 103, fileLimit); assert.equal(existsSync(hostPath('too-large.output')), false);
const expressionOutput = nativePath('expression-order.output'), statementOutput = nativePath('statement-order.output');
run('expression-path-then-data-order-none', 'print call:0:0 call:1:0 write_file\n' + fn(0, `print 1\nreturn ${text(expressionOutput)}\n`) + fn(0, 'print 2\nreturn b:61\n'), '1\n2\nNone\n');
run('statement-data-then-path-order', 'write call:0:0 | call:1:0\nprint 3\n' + fn(0, 'print 1\nreturn b:62\n') + fn(0, `print 2\nreturn ${text(statementOutput)}\n`), '1\n2\n3\n');
run('expression-first-error-skips-data', `print ${text(nativePath('missing-early'))} read_file call:0:0 write_file\n` + fn(0,'print 999\nreturn b:61\n'), '', 108, io);
run('statement-first-error-skips-path', 'write b:ff decode_utf8 | call:0:0\n' + fn(0,`print 999\nreturn ${text(nativePath('not-created'))}\n`), '', 109, utf8);
run('short-circuit-skips-file-effects', `print false ${text(nativePath('skipped'))} b:61 write_file and\nprint true ${text(nativePath('missing-skipped'))} read_file or\n`, 'False\nTrue\n'); assert.equal(existsSync(hostPath('skipped')), false);
for (const [name, expression] of [['read-int','1 read_file'],['read-bytes','b:61 read_file'],['encode-bytes','b:61 encode_utf8'],['decode-text','t:61 decode_utf8'],['write-path-int','1 b:61 write_file'],['write-data-text',text(nativePath('wrong-data'))+' t:61 write_file']]) run('type-' + name, 'print ' + expression + '\n','',105,type);
for (const [name, invalid] of [['read-uninitialized','print %0 read_file\n'],['encode-uninitialized','print %0 encode_utf8\n'],['write-path-uninitialized','eval %0 b:61 write_file\n'],['statement-data-uninitialized','write %0 | t:61\n'],['skipped-invalid','eval false %0 decode_utf8 and\n'],['unused-invalid','print none\n'+fn(0,'return %0 read_file\n')]]) {
  const input=join(directory,'invalid-'+name+'.ir'),output=join(directory,'invalid-'+name+'.elf');writeFileSync(input,invalid);const result=command(driver,[input,output]);assert.equal(result.status,1,name);assert.equal(existsSync(output),false,name);checks++;
}
function positions(image, pattern) { const out=[]; for(let p=image.indexOf(pattern);p!==-1;p=image.indexOf(pattern,p+1))out.push(p);return out; }
function unique(image, pattern) { const p=positions(image,pattern);assert.equal(p.length,1);assert.ok(p[0]>4096);return p[0]; }
for (const [name, literal, operation, mutate, status, diagnostic] of [
  ['path-data-span', nativePath('PATH_SPAN_MARKER'), value => `print ${text(value)} read_file\n`, (image,p) => image.writeBigUInt64LE(0n,p-16), 103, 'NJA203: invalid native sequence span\n'],
  ['path-tag', nativePath('PATH_TAG_MARKER'), value => `print ${text(value)} read_file\n`, (image,p) => image.writeBigUInt64LE(99n,p-24), 105, type],
  ['decode-data-span', 'DECODE_SPAN_MARKER', value => `print ${bytes(Buffer.from(value))} decode_utf8\n`, (image,p) => image.writeBigUInt64LE(0n,p-16), 103, 'NJA203: invalid native sequence span\n'],
  ['write-data-span', 'WRITE_SPAN_MARKER', value => `write ${bytes(Buffer.from(value))} | ${text(nativePath('span-not-created.output'))}\n`, (image,p) => image.writeBigUInt64LE(0n,p-16), 103, 'NJA203: invalid native sequence span\n'],
]) { const artifact=emit('mutant-'+name,operation(literal)),image=readFileSync(artifact.output),p=unique(image,Buffer.from(literal));mutate(image,p);writeFileSync(artifact.output,image);const result=execute(artifact);assert.equal(result.status,status,name);assert.equal(result.stdout,'');assert.equal(result.stderr,diagnostic);checks++; }
assert.equal(existsSync(hostPath('span-not-created.output')),false);
run('read-buffer-arena-exhaustion', Array.from({length:4},(_,i)=>`set 0 ${text(nativePath('size-'+MAX+'.input'))} read_file\nprint ${i+1}\n`).join(''), '1\n2\n3\n',103,'NJA203: native value arena exhausted\n');
const smallOutput=nativePath('partial-progress.output'), partial=emit('mutant-one-byte-transfers',`write ${text(allInput)} read_file | ${text(smallOutput)}\n`), partialImage=readFileSync(partial.output);
for(const [pattern,offset,wide] of [[Buffer.from([0x48,0x81,0xfa,0,0,1,0]),3,false],[Buffer.from([0x48,0xba,0,0,1,0,0,0,0,0]),2,true]]) {const found=positions(partialImage,pattern);assert.equal(found.length,2);for(const p of found)wide?partialImage.writeBigUInt64LE(1n,p+offset):partialImage.writeInt32LE(1,p+offset);}
writeFileSync(partial.output,partialImage);const partialResult=execute(partial);assert.equal(partialResult.status,0,partialResult.stderr);assert.deepEqual(readFileSync(hostPath('partial-progress.output')),allBytes);checks++;
const budgetPattern=Buffer.from([0x48,0xb8,0,0,1,0,0,0,0,0]);
const partialInput=hostInput('partial-error.input',Buffer.alloc(2*65536+10,0x5a)), retainedOutput=nativePath('partial-error.output');
const retained=emit('mutant-attempt-budget-partial-error',`write ${text(partialInput)} read_file | ${text(retainedOutput)}\n`),retainedImage=readFileSync(retained.output),budgetOffsets=positions(retainedImage,budgetPattern);assert.equal(budgetOffsets.length,4);retainedImage.writeBigUInt64LE(3n,budgetOffsets[1]+2);writeFileSync(retained.output,retainedImage);const retainedResult=execute(retained);assert.equal(retainedResult.status,108);assert.equal(retainedResult.stderr,attempts);assert.deepEqual(readFileSync(hostPath('partial-error.output')),Buffer.alloc(65536,0x5a));checks++;
const interrupts=emit('mutant-eintr-budget',`print ${text(allInput)} read_file len\n`),interruptImage=readFileSync(interrupts.output),interruptOffset=unique(interruptImage,Buffer.from([0x0f,0x05,0x48,0x81,0xf8,0xfc,0xff,0xff,0xff,0x0f,0x85]));
Buffer.from([0x48,0xc7,0xc0,0xfc,0xff,0xff,0xff,0x39,0xc0]).copy(interruptImage,interruptOffset);writeFileSync(interrupts.output,interruptImage);const interruptResult=execute(interrupts);assert.equal(interruptResult.status,108);assert.equal(interruptResult.stderr,attempts);checks++;
for(const [name,offset,status,diagnostic,stdout] of [['growth',-216,103,grew,''],['shrinking-eof',-200,0,'','256\n']]) {const artifact=emit('mutant-stat-'+name,`print ${text(allInput)} read_file len\n`),image=readFileSync(artifact.output),p=unique(image,Buffer.from([0x48,0x8b,0x85,0x30,0xff,0xff,0xff]));image.writeInt32LE(offset,p+3);writeFileSync(artifact.output,image);const result=execute(artifact);assert.equal(result.status,status,name+': '+result.stderr);assert.equal(result.stderr,diagnostic);assert.equal(result.stdout,stdout);checks++;}
const closeSource=`set 0 0\nwhile %0 1000 <\nset 1 ${text(allInput)} read_file\nset 0 %0 1 +\nend\nprint %0\n`,closed=emit('close-under-fd-limit',closeSource),closedResult=execute(closed,'ulimit -n 16; exec "$1"');assert.equal(closedResult.status,0,closedResult.stderr);assert.equal(closedResult.stdout,'1000\n');checks++;
const leaked=emit('mutant-disabled-close',closeSource),leakedImage=readFileSync(leaked.output),closePattern=Buffer.from([0x48,0xb8,3,0,0,0,0,0,0,0,0x0f,0x05]),closeOffsets=positions(leakedImage,closePattern);assert.equal(closeOffsets.length,2);leakedImage.fill(0x90,closeOffsets[0]+10,closeOffsets[0]+12);writeFileSync(leaked.output,leakedImage);const leakedResult=execute(leaked,'ulimit -n 16; exec "$1"');assert.equal(leakedResult.status,108);assert.equal(leakedResult.stderr,io);assert.equal(leakedResult.stdout,'');checks++;
const changed=hostInput('changed.input',Buffer.from('first')),readChanged=emit('read-source-data-control',`print ${text(changed)} read_file decode_utf8\n`);assert.equal(execute(readChanged).stdout,'first\n');writeFileSync(hostPath('changed.input'),Buffer.from('other'));assert.equal(execute(readChanged).stdout,'other\n');checks++;
const marker='WRITE_DATA_MARKER',written=emit('mutant-written-content',`write ${text(marker)} encode_utf8 | ${text(nativePath('marker.output'))}\n`),writtenImage=readFileSync(written.output),markerOffset=unique(writtenImage,Buffer.from(marker));writtenImage[markerOffset]=119;writeFileSync(written.output,writtenImage);assert.equal(execute(written).status,0);assert.deepEqual(readFileSync(hostPath('marker.output')),Buffer.from('wRITE_DATA_MARKER'));checks++;
const a=emit('deterministic-a',`print ${text('é\0𝄞')} encode_utf8 decode_utf8\n`),b=emit('deterministic-b',`print ${text('é\0𝄞')} encode_utf8 decode_utf8\n`);assert.deepEqual(readFileSync(a.output),readFileSync(b.output));checks++;
console.log(`PASS ${checks} native file/UTF8 checks; ${oracleOutputs} independent conversion outputs; target=Linux x86_64; timeout=5s; data=${scratch}; artifacts=${directory}`);
