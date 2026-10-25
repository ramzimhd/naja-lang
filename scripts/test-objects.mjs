// Independent native object checks; no interpreter or Python oracle.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const directory = mkdtempSync(resolve('target/objects-native-'));
const driver = resolve('target/debug/examples', process.platform === 'win32' ? 'objects_ir.exe' : 'objects_ir');
function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, {encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024, ...options});
  assert.ifError(result.error); return result;
}
const built = command('cargo', ['build', '-p', 'naja-native', '--example', 'objects_ir', '--locked', '--offline']);
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
  const args = shell ? ['/usr/bin/timeout', '5', '/bin/sh', '-c', shell, 'objects-native-test', native] : ['/usr/bin/timeout', '5', native];
  return process.platform === 'win32' ? command('wsl.exe', ['--exec', ...args]) : command(args[0], args.slice(1));
}
function run(name, source, stdout, status = 0, stderr = '') {
  const artifact = emit(name, source), result = execute(artifact);
  assert.equal(result.status, status, name + ': ' + result.stderr);
  assert.equal(result.stdout, stdout, name + ': stdout'); assert.equal(result.stderr, stderr, name + ': stderr');
  console.log(`PASS ${name} exit=${result.status} sha256=${createHash('sha256').update(readFileSync(artifact.output)).digest('hex')}`);
  checks++; oracleOutputs += stdout.split('\n').length - 1; return artifact;
}
console.log('Frozen contract SHA256=' + createHash('sha256').update(readFileSync('tests/objects/CONTRACT.md')).digest('hex'));
const hex = value => Buffer.from(value, 'utf8').toString('hex');
const text = value => 't:' + hex(value), get = name => 'get:' + hex(name), method = (name, count) => `method:${hex(name)}:${count}`;
const attr = (value, object, name) => `attr ${value} | ${object} | ${hex(name)}\n`;
const fn = (count, body) => `function ${count}\n${body}end\n`;
const cls = members => 'class' + members.map(([name, index]) => ` ${hex(name)}:${index}`).join('') + '\n';
const emptyClass = cls([]), type = 'NJA205: native value type mismatch\n', missing = 'NJA210: native object attribute not found\n';
const arity = 'NJA205: native method argument count mismatch\n', objectSpan = 'NJA203: invalid native object span\n';
run('plain-instance-truth-identity-and-unrelated-scalars', `set 0 new:0:0\nset 1 %0\nprint %0 not\nprint %0 %1 ==\nprint %0 new:0:0 ==\nprint %0 new:0:0 !=\nprint %0 none ==\nprint 1 %0 !=\nprint %0 false and\nprint false %0 or %0 ==\n${emptyClass}`, 'False\nTrue\nFalse\nTrue\nFalse\nTrue\nFalse\nTrue\n');
let source = 'set 0 new:0:0\n', expected = '';
for (const [name, value, output] of [['integer','123456789012345678901234567890','123456789012345678901234567890'],['text',text('é\0𝄞'),'é\0𝄞'],['bytes','b:000aff',"b'\\x00\\n\\xff'"],['boolean','true','True'],['none','none','None']]) {
  source += attr(value,'%0',name) + `print %0 ${get(name)}\n`; expected += output + '\n';
}
run('stored-values-preserve-kinds-and-exact-data', source + emptyClass, expected);
run('independent-fields-same-name-across-instances-and-classes', 'set 0 new:0:0\nset 1 new:0:0\nset 2 new:1:0\n' + [0,1,2].map(i=>attr(String(i+1),'%'+i,'x')).join('') + [0,1,2].map(i=>`print %${i} ${get('x')}\n`).join('') + emptyClass + emptyClass, '1\n2\n3\n');
run('aliases-self-and-indirect-cycles-have-shared-identity', 'set 0 new:0:0\nset 1 %0\nset 2 new:0:0\n' + attr('%0','%0','self') + attr('%2','%0','next') + attr('%0','%2','next') + attr('77','%1','x') + `print %0 ${get('self')} %0 ==\nprint %0 ${get('next')} ${get('next')} %0 ==\nprint %0 ${get('x')}\nprint %0 ${get('self')} not\n` + emptyClass, 'True\nTrue\n77\nFalse\n');
run('list-and-tuple-stored-descriptors-retain-sharing', 'set 0 new:0:0\nset 1 1 2 list:2\n' + attr('%1','%0','items') + attr('%0','%0','self') + 'store 99 | %1 | 0\n' + `print %0 ${get('items')} 0 index\nprint %0 7 tuple:2 0 index %0 ==\n` + emptyClass, '99\nTrue\n');
run('unknown-and-uninitialized-field', 'set 0 new:0:0\nprint %0 '+get('x')+'\n'+emptyClass, '',110,missing);
run('no-bound-method-value-fallback', `print new:0:0 ${get('m')}\n`+fn(1,'return 1\n')+cls([['m',0]]),'',110,'NJA210: native bound-method values are unsupported\n');
for(const [name,value] of [['int','1'],['text',text('x')],['bytes','b:00'],['bool','false'],['none','none'],['tuple','tuple:0'],['list','list:0']]) {
  run('wrong-kind-get-'+name,`print ${value} ${get('x')}\n`, '',105,type);
  run('wrong-kind-set-'+name,attr('1',value,'x'),'',105,type);
}
for(const [name,operation] of [['print','print %0\n'],['len','print %0 len\n'],['numeric','print %0 1 +\n'],['index','print %0 0 index\n'],['ordered','print %0 %0 <=\n'],['container-compare','print %0 tuple:0 ==\n']]) run('unsupported-object-'+name,'set 0 new:0:0\n'+operation+emptyClass,'',105,type);
run('method-receiver-before-arguments-once', 'set 0 new:0:0\nprint %0 call:0:1 call:1:0 '+method('m',1)+'\n'+fn(1,'print 1\nreturn %0\n')+fn(0,'print 2\nreturn 42\n')+fn(2,'print 3\nreturn %1\n')+cls([['m',2]]),'1\n2\n3\n42\n');
run('missing-method-skips-arguments',`print new:0:0 call:0:0 ${method('missing',1)}\n`+fn(0,'print 999\nreturn 1\n')+emptyClass,'',110,missing);
run('wrong-receiver-skips-arguments',`print none call:0:0 ${method('m',1)}\n`+fn(0,'print 999\nreturn 1\n'),'',105,type);
run('stored-field-shadows-method-before-argument-effects','set 0 new:0:0\n'+attr('42','%0','m')+`print %0 call:0:0 ${method('m',1)}\n`+fn(0,'print 999\nreturn 1\n')+fn(1,'return 7\n')+cls([['m',1]]),'',105,type);
run('dynamic-arity-failure-follows-argument-effects',`print new:0:0 call:0:0 ${method('m',1)}\n`+fn(0,'print 123\nreturn 1\n')+fn(1,'return 7\n')+cls([['m',1]]),'123\n',105,arity);
run('method-selection-retained-across-argument-mutation', 'set 0 new:0:0\nprint %0 %0 call:0:1 '+method('m',1)+'\n'+fn(1,attr('99','%0','m')+'print 1\nreturn 5\n')+fn(2,'print 2\nreturn %1\n')+cls([['m',1]]),'1\n2\n5\n');
run('attribute-assignment-value-before-object-once','set 0 new:0:0\n'+attr('call:0:0','%0 call:1:1','x')+`print %0 ${get('x')}\n`+fn(0,'print 1\nreturn 77\n')+fn(1,'print 2\nreturn %0\n')+emptyClass,'1\n2\n77\n');
run('attribute-rhs-error-skips-object-effect',attr('b:ff decode_utf8','call:0:0','x')+fn(0,'print 999\nreturn none\n'),'',109,'NJA209: invalid UTF-8 conversion\n');
run('constructor-arguments-before-initializer-ltr-once',`set 0 call:0:0 call:1:0 new:0:2\nprint %0 ${get('sum')}\n`+fn(0,'print 1\nreturn 10\n')+fn(0,'print 2\nreturn 20\n')+fn(3,'print 3\n'+attr('%1 %2 +','%0','sum')+'return none\n')+cls([['__init__',2]]),'1\n2\n3\n30\n');
run('initializer-fallthrough-is-none',`set 0 19 new:0:1\nprint %0 ${get('x')}\n`+fn(2,attr('%1','%0','x'))+cls([['__init__',0]]),'19\n');
run('initializer-non-none-is-explicit-error','eval new:0:0\n'+fn(1,'return 1\n')+cls([['__init__',0]]),'',105,'NJA205: native initializer must return None\n');
const maximumArguments=Array.from({length:127},(_,i)=>String(i+1)).join(' ');
run('127-explicit-method-arguments-plus-receiver',`print new:0:0 ${maximumArguments} ${method('m',127)}\n`+fn(128,'return %1 %127 -\n')+cls([['m',0]]),'-126\n');
run('127-constructor-arguments-copied-in-source-order',`set 0 ${maximumArguments} new:0:127\nprint %0 ${get('difference')}\n`+fn(128,attr('%1 %127 -','%0','difference')+'return none\n')+cls([['__init__',0]]),'-126\n');
run('constructor-first-argument-error-skips-later-effect',`eval b:ff decode_utf8 call:0:0 new:0:2\n`+fn(0,'print 999\nreturn 1\n')+fn(3,'return none\n')+cls([['__init__',1]]),'',109,'NJA209: invalid UTF-8 conversion\n');
run('method-early-return-from-loop',`print new:0:0 3 ${method('m',1)}\n`+fn(2,'set 2 0\nwhile true\nif %2 %1 ==\nreturn %2\nend\nset 2 %2 1 +\nend\n')+cls([['m',0]]),'3\n');
run('mutation-through-parameter-and-return-alias','set 0 new:0:0\nprint %0 call:0:1 %0 ==\n'+`print %0 ${get('x')}\n`+fn(1,attr('88','%0','x')+'return %0\n')+emptyClass,'True\n88\n');
const unicodeNames=['é','e\u0301','字段','é'.repeat(128)]; source='set 0 new:0:0\n'; expected='';
unicodeNames.forEach((name,i)=>{source+=attr(String(i+10),'%0',name)+`print %0 ${get(name)}\n`;expected+=(i+10)+'\n';});
run('exact-unicode-keys-and-256-byte-boundary',source+emptyClass,expected);
source='set 0 new:0:0\n'; for(let i=0;i<128;i++)source+=attr(String(i),'%0','f'+i);
run('128-fields-and-update-at-capacity',source+attr('999','%0','f0')+`print %0 ${get('f0')}\nprint %0 ${get('f127')}\n`+emptyClass,'999\n127\n');
run('129th-new-field-is-resource-error',source+attr('128','%0','extra')+emptyClass,'',103,'NJA203: native object field limit exceeded\n');
source=''; expected=''; let functions='',classes='';
for(let i=0;i<8;i++){functions+=fn(1,`return %0 ${get('x')} ${i*100} +\n`);classes+=cls([['m',i]]);}
for(let i=0;i<24;i++){const c=(i*5)%8,value=BigInt('123456789012345678901234567890')+BigInt(i);source+=`set 0 new:${c}:0\n`+attr(value.toString(),'%0','x')+`print %0 ${method('m',0)}\n`;expected+=(value+BigInt(c*100))+'\n';}
run('general-dynamic-class-dispatch-exact-integer-oracle',source+functions+classes,expected);
source=`print new:127:0 ${method('m',0)}\n`+fn(1,'return 127\n')+emptyClass.repeat(127)+cls([['m',0]]);
run('128th-class-dispatch-boundary',source,'127\n');
run('128th-method-dispatch-boundary',`print new:0:0 ${method('m127',0)}\n`+fn(1,'return 128\n')+cls(Array.from({length:128},(_,i)=>['m'+i,0])),'128\n');
const recursion=fn(2,`if %1 0 ==\nreturn none\nend\nreturn %0 %1 1 - ${method('recur',1)}\n`)+cls([['recur',0]]);
run('256-native-method-call-depth-boundary',`print new:0:0 255 ${method('recur',1)}\n`+recursion,'None\n');
run('257th-native-method-call-fails-before-frame',`print new:0:0 256 ${method('recur',1)}\n`+recursion,'',103,'NJA203: native user-call depth limit exceeded\n');
run('native-recursive-initializer-depth-guard','eval new:0:0\n'+fn(1,'eval new:0:0\nreturn none\n')+cls([['__init__',0]]),'',103,'NJA203: native user-call depth limit exceeded\n');
run('shared-arena-object-allocation-exhaustion','set 0 0\nwhile %0 40000 <\nset 1 new:0:0\nset 0 %0 1 +\nend\n'+emptyClass,'',103,'NJA203: native value arena exhausted\n');
run('short-circuit-skips-object-effects',`print false new:0:0 ${get('missing')} and\nprint true new:0:0 ${method('missing',0)} or\n`+emptyClass,'False\nTrue\n');
const invalids=[['unknown-class','eval new:0:0\n'],['constructor-arity','eval 1 new:0:1\n'+emptyClass],['unknown-function','eval none\n'+cls([['m',0]])],['method-no-receiver','eval none\n'+fn(0,'return none\n')+cls([['m',0]])],['duplicate-method','eval none\n'+fn(1,'return none\n')+cls([['m',0],['m',0]])],['magic-method','eval none\n'+fn(1,'return none\n')+cls([['__bool__',0]])],['name-too-long',`eval none ${get('x'.repeat(257))}\n`],['skipped-uninitialized',`eval false %0 ${get('x')} and\n`],['unused-uninitialized','eval none\n'+fn(0,attr('%0','none','x'))],['method-uninitialized-argument',`eval none %0 ${method('m',1)}\n`],['attribute-uninitialized-object',attr('1','%0','x')],['attribute-uninitialized-value',attr('%0','none','x')]];
for(const [name,ir]of invalids){const input=join(directory,'invalid-'+name+'.ir'),output=join(directory,'invalid-'+name+'.elf');writeFileSync(input,ir);const r=command(driver,[input,output]);assert.equal(r.status,1,name);assert.equal(existsSync(output),false);checks++;}
function unique(image,pattern){const p=image.indexOf(pattern);assert.ok(p>4096,'missing mutation signature');assert.equal(image.indexOf(pattern,p+1),-1,'ambiguous mutation signature');return p;}
const spanSource='set 0 new:0:0\n'+attr('7','%0','x')+`print %0 ${get('x')}\n`+emptyClass;
for(const [name,pattern,mutate,diagnostic]of [
  ['table-pointer',Buffer.from([0x48,0x89,0x98,8,0,0,0]),(b,p)=>b[p+2]=0x90,objectSpan],
  ['class-id',Buffer.from([0x48,0x89,0xb8,16,0,0,0]),(b,p)=>b[p+2]=0x90,'NJA203: invalid native class metadata\n'],
  ['table-count',Buffer.from([0x48,0x31,0xd2,0x48,0x89,0x93,0,0,0,0]),(b,p)=>Buffer.from([0x48,0x89,0xc2]).copy(b,p),objectSpan],
  ['selected-value-span',Buffer.from([0x48,0x8b,0x95,0xf8,0xff,0xff,0xff,0x48,0x89,0x90,0,0,0,0]),(b,p)=>b[p+9]=0xa0,'NJA203: invalid native sequence span\n'],
]) {const artifact=emit('mutant-'+name,spanSource),image=readFileSync(artifact.output),p=unique(image,pattern);mutate(image,p);writeFileSync(artifact.output,image);const r=execute(artifact);assert.equal(r.status,103,name+': '+r.stderr);assert.equal(r.stderr,diagnostic);assert.equal(r.stdout,'');checks++;}
const stack=emit('mutant-source-stack-floor',`print new:0:0 1 ${method('m',1)}\n`+fn(2,'return %1\n')+cls([['m',0]])),stackImage=readFileSync(stack.output),floor=unique(stackImage,Buffer.from([0x48,0x81,0xe8,0,0,0x20,0]));stackImage.writeInt32LE(4096,floor+3);writeFileSync(stack.output,stackImage);const sr=execute(stack);assert.equal(sr.status,103);assert.equal(sr.stderr,'NJA203: native source stack limit exceeded\n');checks++;
const dispatch=emit('mutant-native-method-entry',`print new:0:0 ${method('m',0)}\n`+fn(1,'return 41\n')+fn(1,'return 42\n')+cls([['m',0]])+cls([['m',1]])),dispatchImage=readFileSync(dispatch.output),entries=[];
for(let p=4096;p<dispatchImage.length-18;p++)if(dispatchImage.subarray(p,p+3).equals(Buffer.from([0x48,0x8d,5]))&&dispatchImage.subarray(p+7,p+9).equals(Buffer.from([0x48,0xba]))&&dispatchImage[p+17]===0xc3)entries.push(p);
assert.equal(entries.length,2);const target1=entries[1]+7+dispatchImage.readInt32LE(entries[1]+3);dispatchImage.writeInt32LE(target1-entries[0]-7,entries[0]+3);writeFileSync(dispatch.output,dispatchImage);const dr=execute(dispatch);assert.equal(dr.status,0);assert.equal(dr.stdout,'42\n');assert.notEqual(dr.stdout,'41\n');checks++;
const controlled=emit('mutant-field-data-controls-result','set 0 new:0:0\n'+attr(text('OBJECT_DATA_MARKER'),'%0','x')+`print %0 ${get('x')}\n`+emptyClass),controlledImage=readFileSync(controlled.output),marker=unique(controlledImage,Buffer.from('OBJECT_DATA_MARKER'));controlledImage[marker]=0x6f;writeFileSync(controlled.output,controlledImage);assert.equal(execute(controlled).stdout,'oBJECT_DATA_MARKER\n');checks++;
const deterministicSource='set 0 new:0:0\n'+attr('123','%0','x')+`print %0 ${get('x')}\n`+emptyClass,a=emit('deterministic-a',deterministicSource),b=emit('deterministic-b',deterministicSource);assert.deepEqual(readFileSync(a.output),readFileSync(b.output));checks++;
console.log(`PASS ${checks} native object checks; ${oracleOutputs} independent output lines; target=Linux x86_64; artifact timeout=5s; artifacts=${directory}`);
