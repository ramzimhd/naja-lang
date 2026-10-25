// Execute emitted machine code. WSL is a declared local execution target on Windows.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const executable = resolve('target/debug', process.platform === 'win32' ? 'naja.exe' : 'naja');
const directory = mkdtempSync(resolve('target/native-execution-'));
const prefix = 'from naja.core import i64\n';
function command(exe,args,options={}) {
  const result = spawnSync(exe,args,{encoding:'utf8',timeout:15000,...options});
  assert.ifError(result.error);
  return result;
}
let target;
if (process.platform === 'win32') {
  const query = command('wsl.exe',['--exec','uname','-sm']);
  assert.equal(query.status,0,'WSL native execution unavailable: '+query.stderr);
  assert.match(query.stdout,/Linux x86_64/);
  const path = command('wsl.exe',['--exec','wslpath','-a',directory]);
  assert.equal(path.status,0,path.stderr);
  target = path.stdout.trim();
} else {
  assert.equal(process.platform,'linux','this test requires Linux x86-64 or Windows with x86-64 WSL');
  assert.equal(process.arch,'x64');
  target = directory;
}
let passed = 0;
function build(name,source,extension='py') {
  const input = join(directory,name+'.'+extension);
  const output = join(directory,name+'.elf');
  writeFileSync(input,prefix+source);
  const result = command(executable,['build',input,'--target','x86_64-unknown-linux-gnu','--output',output]);
  assert.equal(result.status,0,result.stderr);
  if (process.platform === 'win32') {
    const permission = command('wsl.exe',['--exec','chmod','u+x',target+'/'+name+'.elf']);
    assert.equal(permission.status,0,permission.stderr);
  } else { chmodSync(output,0o700); }
  return {input,output,target:target+'/'+name+'.elf'};
}
function run(name,source,stdout,status=0,stderr='',extension='py') {
  const artifact = build(name,source,extension);
  const result = process.platform === 'win32'
    ? command('wsl.exe',['--exec','/usr/bin/timeout','5',artifact.target])
    : command('/usr/bin/timeout',['5',artifact.target]);
  assert.equal(result.status,status,name+': '+result.stderr);
  assert.equal(result.stdout,stdout,name+': stdout');
  assert.equal(result.stderr,stderr,name+': stderr');
  const hash = createHash('sha256').update(readFileSync(artifact.output)).digest('hex');
  console.log(`PASS ${name} exit=${result.status} sha256=${hash}`);
  passed++;
  return artifact;
}

run('sum','index: i64 = i64(0)\ntotal: i64 = i64(0)\nwhile index < i64(10):\n    total = total + index * i64(2)\n    index = index + i64(1)\nif total == i64(90):\n    print(total)\nelse:\n    print(i64(-1))\n','90\n');
run('signed-boundaries','print(i64(-9223372036854775808))\nprint(i64(9223372036854775807))\nprint(i64(0))\nprint(i64(-1))\nprint(i64(1234567890123456789))\n','-9223372036854775808\n9223372036854775807\n0\n-1\n1234567890123456789\n');
run('precedence','print(i64(2) + i64(3) * i64(4))\nprint((i64(2) + i64(3)) * i64(4))\nprint(i64(10) - i64(3) - i64(2))\nprint(i64(3) - i64(10))\nprint(-(-i64(7)))\n','14\n20\n5\n-7\n7\n');
for (const [index,operator] of ['==','!=','<','<=','>','>='].entries()) {
  const expected = {'==':[0,1,0],'!=':[1,0,1],'<':[1,0,0],'<=':[1,1,0],'>':[0,0,1],'>=':[0,1,1]}[operator];
  let source='';
  for(const [i,value] of [-2,0,2].entries()) {
    source+=`if i64(${value}) ${operator} i64(0):\n    print(i64(1))\nelse:\n    print(i64(0))\n`;
  }
  run('comparison-'+index,source,expected.join('\n')+'\n');
}
run('nested-control','x: i64 = i64(0)\ny: i64 = i64(0)\nwhile x < i64(3):\n    y = i64(0)\n    while y < i64(2):\n        if x != y:\n            print(x * i64(10) + y)\n        else:\n            print(i64(-1))\n        y = y + i64(1)\n    x = x + i64(1)\n','-1\n1\n10\n-1\n20\n21\n');
const blockReference = run('block-reference','x: i64 = i64(0)\nwhile x < i64(3):\n    x = x + i64(1)\nif x == i64(3):\n    print(x)\nelse:\n    print(i64(-1))\n','3\n');
for (const [name,body] of [
  ['brace-sections','{# State #\nx: i64 = i64(0)\n}\nwhile x < i64(3): {# Advance #\nx = x + i64(1)\n}\nif x == i64(3): {\n{# Output #\nprint(x)\n}\n} else: {\nprint(i64(-1))\n}\n'],
  ['depth-markers','x: i64 = i64(0)\nwhile x < i64(3):(0)\n    x = x + i64(1)\nif x == i64(3):(0)\n    print(x)\nelse:(0)\n    print(i64(-1))\n'],
  ['mixed-styles','x: i64 = i64(0)\nwhile x < i64(3): {\n  x = x + i64(1)\n}\nif x == i64(3):\n    {# Output #\nprint(x)\n    }\nelse: {\nprint(i64(-1))\n}\n'],
]) {
  const variant = run(name,body,'3\n',0,'','naja');
  assert.deepEqual(readFileSync(variant.output),readFileSync(blockReference.output),name+': transparent native lowering');
  console.log('PASS '+name+' emits identical machine code to indentation baseline');
  passed++;
}
run('adjacent-mixed-closers','if i64(1) == i64(1): {\n    if i64(1) == i64(1):\n        if i64(1) == i64(1): {\nprint(i64(7))\n}}\n','7\n',0,'','naja');
const compatibilityBlock = join(directory,'brace-isolation.py');
writeFileSync(compatibilityBlock,prefix+'if i64(1) == i64(1): {\nprint(i64(1))\n}\n');
const compatibilityCheck = command(executable,['check',compatibilityBlock]);
assert.equal(compatibilityCheck.status,1, 'CLI .py dialect must reject NAJA suite braces');
console.log('PASS CLI .py dialect keeps NAJA brace syntax isolated');
passed++;
for(const [name,expression] of [['add','i64(9223372036854775807) + i64(1)'],['subtract','i64(-9223372036854775808) - i64(1)'],['multiply','i64(9223372036854775807) * i64(2)'],['negate','-x']]) {
  run('overflow-'+name,'x: i64 = i64(-9223372036854775808)\nprint('+expression+')\n','',101,'NJA201: checked i64 overflow\n');
}
const original = run('Unicode path café','print(i64(42))\n','42\n');
const hash = readFileSync(original.output);
const overwrite = command(executable,['build',original.input,'--target','x86_64-unknown-linux-gnu','--output',original.output]);
assert.equal(overwrite.status,1);
assert.match(overwrite.stderr,/NJA006/);
assert.deepEqual(readFileSync(original.output),hash);
console.log('PASS refused output overwrite; original artifact preserved');
passed++;

const ioArtifact = build('io-error','print(i64(42))\n');
// Fixed shell code receives the artifact only through argv, never interpolation.
const ioResult = process.platform === 'win32'
  ? command('wsl.exe',['--exec','sh','-c','exec "$1" > /dev/full','native-io-test',ioArtifact.target])
  : command('sh',['-c','exec "$1" > /dev/full','native-io-test',ioArtifact.target]);
assert.equal(ioResult.status,102,ioResult.stderr);
assert.equal(ioResult.stderr,'NJA202: native stdout write failed\n');
console.log('PASS output failure exit=102');
passed++;

for(const [name,source,code] of [
  ['unsupported-list','x = [1, 2, 3]\n','NJA101'],
  ['unsupported-import','import os\n','NJA101'],
  ['uninitialized','from naja.core import i64\nx: i64 = x + i64(1)\n','NJA101'],
  ['bare-int-after-import',prefix+'print(9223372036854775807 + 1)\n','NJA101'],
  ['lexical-error','from naja.core import i64\nprint("unterminated)\n',null],
  ['expression-limit',prefix+'print('+Array(140).fill('i64(1)').join('+')+')\n','NJA101'],
  ['wrong-depth',prefix+'if i64(1) == i64(1):(1)\n    print(i64(1))\n','NJA101'],
  ['missing-brace',prefix+'if i64(1) == i64(1): {\nprint(i64(1))\n',null],
]) {
  const input=join(directory,name+'.naja');
  const output=join(directory,name+'.rejected');
  writeFileSync(input,source);
  const result=command(executable,['build',input,'--target','x86_64-unknown-linux-gnu','--output',output]);
  assert.equal(result.status,1,name+': expected rejection');
  if(code)assert.ok(result.stderr.includes(code),result.stderr);
  assert.throws(()=>readFileSync(output));
  console.log('PASS rejected '+name+' before output creation');
  passed++;
}
const deterministic=build('deterministic-a','print(i64(7))\n');
const deterministic2=build('deterministic-b','print(i64(7))\n');
assert.deepEqual(readFileSync(deterministic.output),readFileSync(deterministic2.output));
console.log('PASS repeated compilation produces identical unsigned ELF bytes');
passed++;
const pipeArtifact = build('sigpipe','while i64(0) < i64(1): print(i64(42))\n');
const pipeArgs=['-c','set -o pipefail; "$1" | head -c 0','native-pipe-test',pipeArtifact.target];
const pipeResult=process.platform==='win32'
  ? command('wsl.exe',['--exec','/usr/bin/timeout','5','bash',...pipeArgs])
  : command('/usr/bin/timeout',['5','bash',...pipeArgs]);
assert.equal(pipeResult.status,141,pipeResult.stderr);
console.log('PASS default Linux SIGPIPE termination exit=141 (documented policy)');
passed++;
console.log(`${passed} native/CLI checks passed; target Linux x86-64 (${process.platform === 'win32' ? 'WSL' : 'native host'}).`);
console.log('Limits: experimental explicit i64 only; no clean-host, full grammar, self-hosting, performance or release proof.');
