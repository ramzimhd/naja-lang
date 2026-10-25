// Exercise ordinary source through the real shared frontend, checker and emitter.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmodSync,existsSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const compiler=resolve('target/debug',process.platform==='win32'?'naja.exe':'naja');
const directory=mkdtempSync(resolve('target/hosted-language-'));
function command(executable,args){
  const result=spawnSync(executable,args,{encoding:'utf8',timeout:20000,maxBuffer:8*1024*1024});
  assert.ifError(result.error); return result;
}
let target=directory;
if(process.platform==='win32'){
  const probe=command('wsl.exe',['--exec','uname','-sm']);
  assert.equal(probe.status,0,probe.stderr); assert.match(probe.stdout,/Linux x86_64/);
  const translated=command('wsl.exe',['--exec','wslpath','-a',directory]);
  assert.equal(translated.status,0,translated.stderr); target=translated.stdout.trim();
}else{assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');}
let passed=0;
function build(name,source,extension='naja'){
  const input=join(directory,name+'.'+extension),output=join(directory,name+'.elf');
  writeFileSync(input,source);
  const checked=command(compiler,['check',input]); assert.equal(checked.status,0,checked.stderr);
  const built=command(compiler,['build',input,'--target','x86_64-unknown-linux-gnu','--output',output]);
  assert.equal(built.status,0,built.stderr);
  const linux=target+'/'+name+'.elf';
  if(process.platform==='win32')assert.equal(command('wsl.exe',['--exec','chmod','u+x',linux]).status,0);
  else chmodSync(output,0o700);
  return {input,output,linux};
}
function run(name,source,expected,{extension='naja',status=0,stderr=''}={}){
  const artifact=build(name,source,extension);
  const result=process.platform==='win32'?command('wsl.exe',['--exec','/usr/bin/timeout','5',artifact.linux]):command('/usr/bin/timeout',['5',artifact.linux]);
  assert.equal(result.status,status,name+': '+result.stderr);
  assert.equal(result.stdout,expected,name+': stdout'); assert.equal(result.stderr,stderr,name+': stderr');
  const sha256=createHash('sha256').update(readFileSync(artifact.output)).digest('hex');
  console.log(`PASS ${name} exit=${result.status} sha256=${sha256}`);passed++;
  return artifact;
}
const huge=12345678901234567890123456789012345678901234567890n;
run('documented-hosted-fixture',readFileSync('tests/native/fixtures/integers.naja','utf8'),'123456789012345678901234567893\n');
run('ordinary-arithmetic',`x = ${huge}\ny: int = 9_999_999_999_999_999_999\nprint(x + y)\nprint((x - y) * -x)\nprint(x - x)\n`,`${huge+9999999999999999999n}\n${(huge-9999999999999999999n)*-huge}\n0\n`);
run('both-branch-initialization','if 1 > 2:\n    result = 99\nelse:\n    result = 123456789012345678901234567890\nprint(result)\n','123456789012345678901234567890\n');
run('immutable-source-alias',`x = ${huge}\ny = x\nx = x + 1\nprint(y)\nprint(x)\nprint(-y)\nprint(y)\n`,`${huge}\n${huge+1n}\n${-huge}\n${huge}\n`);
run('unicode-canonical-bindings',`变量 = ${huge}\nＫ = 变量\nK = K + 1\nｐｒｉｎｔ(Ｋ)\nｉｆ = 7\nprint(ｉｆ)\n`,`${huge+1n}\n7\n`,{extension:'py'});
run('ordinary-runtime-assertion',`x = ${huge}\nif x == ${huge}: assert x + 3 == ${huge+3n}\nif 0 == 1: assert 0 == 1\nprint(x)\n`,`${huge}\n`);
run('ordinary-failed-assertion',`x = ${huge}\nassert x + 3 == ${huge+2n}\nprint(x)\n`,'',{status:104,stderr:'NJA204: assertion failed\n'});
run('fixed-failed-assertion','from naja.core import i64\nx: i64 = i64(2)\nassert x == i64(3)\nprint(x)\n','',{status:104,stderr:'NJA204: assertion failed\n'});
const baseline='x = 0\ntotal = 0\nwhile x < 4:\n    total = total + x * 1000000000000000000000000000000\n    x = x + 1\nif total == 6000000000000000000000000000000:\n    print(total)\nelse:\n    print(-1)\n';
const reference=run('ordinary-indentation',baseline,'6000000000000000000000000000000\n',{extension:'py'});
for(const [name,source] of [
  ['ordinary-braces','{# State #\nx = 0\ntotal = 0\n}\nwhile x < 4: {# Accumulate #\ntotal = total + x * 1000000000000000000000000000000\nx = x + 1\n}\nif total == 6000000000000000000000000000000: {\n{# Output #\nprint(total)\n}\n} else: {\nprint(-1)\n}\n'],
  ['ordinary-markers','x = 0\ntotal = 0\nwhile x < 4:(0)\n    total = total + x * 1000000000000000000000000000000\n    x = x + 1\nif total == 6000000000000000000000000000000:(0)\n    print(total)\nelse:(0)\n    print(-1)\n'],
  ['ordinary-mixed','x = 0\ntotal = 0\nwhile x < 4: {\n  total = total + x * 1000000000000000000000000000000\n  x = x + 1\n}\nif total == 6000000000000000000000000000000:\n    {# Output #\nprint(total)\n    }\nelse: {\nprint(-1)\n}\n'],
]){
  const variant=run(name,source,'6000000000000000000000000000000\n');
  assert.deepEqual(readFileSync(variant.output),readFileSync(reference.output),name+': equivalent native lowering');
  console.log('PASS '+name+' emits identical unsigned ELF bytes to the hosted baseline');passed++;
}
run('ordinary-resource-bound','x = 0\nwhile 0 == 0:\n    x = x + 1\n','',{status:103,stderr:'NJA203: hosted integer arena exhausted\n'});
for(const [name,source,extension,code] of [
  ['conditional-uninitialized','if 1 == 2:\n    x = 1\nprint(x)\n','py','NJA101'],
  ['loop-uninitialized','while 1 == 2:\n    x = 1\nprint(x)\n','naja','NJA101'],
  ['self-uninitialized','x = x + 1\n','naja','NJA101'],
  ['mixed-domains','from naja.core import i64\nx: i64 = 1\n','naja','NJA101'],
  ['unsupported-float','x = 1.5\n','py','NJA101'],
  ['unsupported-base','x = 0xffff\n','naja','NJA101'],
  ['ordinary-python-isolation','if 1 == 1: {\nprint(1)\n}\n','py','NJA101'],
]){
  const input=join(directory,name+'.'+extension),output=join(directory,name+'.rejected');writeFileSync(input,source);
  const result=command(compiler,['build',input,'--target','x86_64-unknown-linux-gnu','--output',output]);
  assert.equal(result.status,1,name);assert.ok(result.stderr.includes(code),result.stderr);assert.equal(existsSync(output),false,name);
  console.log('PASS rejected '+name+' before output creation');passed++;
}
console.log(`${passed} hosted source/CLI/native checks passed; Linux x86-64 (${process.platform==='win32'?'WSL':'native host'}).`);
console.log('Limits: decimal integer slice, 64 MiB temporary arena, incomplete values/objects/modules/diagnostics, no FC1/HATCH/performance/self-hosting claim.');
