// Independent native mapping checks; no interpreter or Python oracle.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const directory = mkdtempSync(resolve('target/mappings-native-'));
const driver = resolve('target/debug/examples', process.platform === 'win32' ? 'mappings_ir.exe' : 'mappings_ir');
function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, {encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024, ...options});
  assert.ifError(result.error); return result;
}
const built = command('cargo', ['build', '-p', 'naja-native', '--example', 'mappings_ir', '--locked', '--offline']);
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
  const args = shell ? ['/usr/bin/timeout', '5', '/bin/sh', '-c', shell, 'mappings-native-test', native] : ['/usr/bin/timeout', '5', native];
  return process.platform === 'win32' ? command('wsl.exe', ['--exec', ...args]) : command(args[0], args.slice(1));
}
function run(name, source, stdout, status = 0, stderr = '') {
  const artifact = emit(name, source), result = execute(artifact);
  assert.equal(result.status, status, name + ': ' + result.stderr);
  assert.equal(result.stdout, stdout, name + ': stdout'); assert.equal(result.stderr, stderr, name + ': stderr');
  console.log(`PASS ${name} exit=${result.status} sha256=${createHash('sha256').update(readFileSync(artifact.output)).digest('hex')}`);
  checks++; oracleOutputs += stdout.split('\n').length - 1; return artifact;
}
console.log('Frozen contract SHA256='+createHash('sha256').update(readFileSync('tests/mappings/CONTRACT.md')).digest('hex'));
const hex=v=>Buffer.from(v,'utf8').toString('hex'), text=v=>'t:'+hex(v), bytes=v=>'b:'+Buffer.from(v).toString('hex');
const fn=(parameters,body)=>`function ${parameters}\n${body}end\n`;
const type='NJA205: native value type mismatch\n', keyType='NJA205: unsupported native mapping key type\n', missing='NJA211: dictionary key not found\n', keyWork='NJA203: native mapping key work limit exceeded\n';
const N=v=>({kind:'n',value:BigInt(v),ir:String(v)}),B=v=>({kind:'n',value:BigInt(v),ir:v?'true':'false',bool:v}),T=v=>({kind:'t',value:v,ir:text(v)}),Y=v=>({kind:'b',value:Buffer.from(v),ir:bytes(v)}),Z={kind:'z',value:null,ir:'none'};
const canonical=k=>k.kind+':'+(k.kind==='n'?k.value.toString():k.kind==='t'?hex(k.value):k.kind==='b'?k.value.toString('hex'):'');
function repr(v){if('bool'in v)return v.bool?'True':'False';if(v.kind==='n')return String(v.value);if(v.kind==='t')return v.value;if(v.kind==='z')return'None';const q=v.value.includes(39)&&!v.value.includes(34)?'"':"'";let out='b'+q;for(const b of v.value){const c=String.fromCharCode(b);if(c===q||b===92)out+='\\'+c;else if(b===9)out+='\\t';else if(b===10)out+='\\n';else if(b===13)out+='\\r';else if(b<32||b>=127)out+='\\x'+b.toString(16).padStart(2,'0');else out+=c;}return out+q;}
function model(pairs){const m=new Map();for(const[key,value]of pairs){const id=canonical(key);if(m.has(id))m.get(id).value=value;else m.set(id,{key,value});}return m;}
const dict=pairs=>pairs.map(([k,v])=>k.ir+' '+v.ir).join(' ')+` dict:${pairs.length}`;
const keys=[B(true),N(1),B(false),N(0),T('1'),Y([49]),Z,N('123456789012345678901234567890123456789'),N('-999999999999999999999'),T('é\0𝄞'),Y([0,255]),T('e\u0301'),T('é')];
const pairs=keys.map((k,i)=>[k,N(i*7)]),m=model(pairs);
let source='set 0 '+dict(pairs)+'\nset 1 %0 dict_keys\nprint %0 len\nprint %1 len\n',expected=m.size+'\n'+m.size+'\n';
let index=0;for(const{key,value}of m.values()){source+=`print %1 ${index++} index\nprint %0 ${key.ir} index\n`;expected+=repr(key)+'\n'+repr(value)+'\n';}
run('scalar-key-equivalence-order-and-first-descriptor-retention',source,expected);
run('empty-dict-set-length-truth-and-snapshot','print dict:0 len\nprint set:0 len\nprint dict:0 not\nprint set:0 not\nprint dict:0 dict_keys len\nprint none dict:0 contains\n','0\n0\nTrue\nTrue\n0\nFalse\n');
run('sets-deduplicate-exact-scalar-keys','set 0 '+keys.map(k=>k.ir).join(' ')+` set:${keys.length}\nprint %0 len\n`+keys.map(k=>`print ${k.ir} %0 contains\n`).join(''),m.size+'\n'+'True\n'.repeat(keys.length));
run('bytes-and-text-remain-distinct',`set 0 ${text('x')} 10 b:78 20 dict:2\nprint %0 ${text('x')} index\nprint %0 b:78 index\nprint ${text('x')} b:78 set:1 contains\n`,'10\n20\nFalse\n');
let seed=0x8123ab7f;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
const pool=[...keys,...[-1n,2n,10n**80n,-(10n**80n)].map(N),T('same'),Y([115,97,109,101])];
for(let batch=0;batch<4;batch++){source='';expected='';for(let c=0;c<8;c++){const pairs=Array.from({length:24},()=>[pool[random()%pool.length],N(BigInt(random())*123456789012345678901n)]),map=model(pairs);source+='set 0 '+dict(pairs)+'\nset 1 %0 dict_keys\nprint %0 len\n';expected+=map.size+'\n';let i=0;for(const{key,value}of map.values()){source+=`print %1 ${i++} index\nprint %0 ${key.ir} index\n`;expected+=repr(key)+'\n'+repr(value)+'\n';}source+='print '+pool.map(k=>k.ir).join(' ')+` set:${pool.length} len\n`;expected+=new Set(pool.map(canonical)).size+'\n';}run('independent-ordered-map-oracle-'+batch,source,expected);}
run('aliases-parameters-self-and-indirect-cycles','set 0 dict:0\nset 1 %0\nset 2 dict:0\nstore %0 | %1 | '+text('self')+'\nstore %2 | %0 | '+text('next')+'\nstore %0 | %2 | '+text('next')+'\nprint %0 call:0:1\nprint %0 '+text('self')+' index len\nprint %0 '+text('next')+' index '+text('next')+' index '+text('x')+' index\n'+fn(1,'store 77 | %0 | '+text('x')+'\nreturn %0 len\n'),'3\n3\n77\n');
run('snapshot-array-is-independent-and-first-key-stable','set 0 true 10 2 20 dict:2\nset 1 %0 dict_keys\nstore 99 | %0 | 1\nstore 30 | %0 | 3\nprint %1 len\nprint %1 0 index\nprint %1 1 index\nprint %0 len\nprint %0 1 index\n','2\nTrue\n2\n3\n99\n');
run('literal-key-value-pair-order-once','set 0 call:0:0 call:1:0 call:2:0 call:3:0 dict:2\nprint %0 2 index\n'+[1,2,3,4].map((n,i)=>fn(0,`print ${n}\nreturn ${i===2?2:n}\n`)).join(''),'1\n2\n3\n4\n4\n');
run('invalid-first-key-follows-its-value-and-skips-next-pair','eval tuple:0 call:0:0 call:1:0 7 dict:2\n'+fn(0,'print 1\nreturn 2\n')+fn(0,'print 999\nreturn 3\n'),'1\n',105,keyType);
run('set-first-error-skips-later-element','eval tuple:0 call:0:0 set:2\n'+fn(0,'print 999\nreturn 3\n'),'',105,keyType);
run('duplicate-set-elements-still-evaluate-left-to-right','print call:0:0 call:1:0 call:2:0 set:3 len\n'+[1,2,3].map(n=>fn(0,`print ${n}\nreturn 1\n`)).join(''),'1\n2\n3\n1\n');
run('dict-index-container-before-key-once','set 0 7 8 dict:1\nprint %0 call:0:1 call:1:0 index\n'+fn(1,'print 1\nreturn %0\n')+fn(0,'print 2\nreturn 7\n'),'1\n2\n8\n');
run('mapping-assignment-value-container-key-order','set 0 dict:0\nstore call:0:0 | %0 call:1:1 | call:2:0\nprint %0 7 index\n'+fn(0,'print 1\nreturn 10\n')+fn(1,'print 2\nreturn %0\n')+fn(0,'print 3\nreturn 7\n'),'1\n2\n3\n10\n');
run('mapping-rhs-error-precedes-container-effects','store b:ff decode_utf8 | call:0:0 | 1\n'+fn(0,'print 999\nreturn dict:0\n'),'',109,'NJA209: invalid UTF-8 conversion\n');
run('membership-element-container-order','set 0 7 9 dict:1\nprint call:0:0 %0 call:1:1 contains\n'+fn(0,'print 1\nreturn 7\n')+fn(1,'print 2\nreturn %0\n'),'1\n2\nTrue\n');
run('membership-evaluates-both-before-key-type-check','print tuple:0 call:0:0 contains\n'+fn(0,'print 1\nreturn dict:0\n'),'1\n',105,keyType);
run('mixed-relation-chain-middle-operand-once','set 0 2 9 dict:1\nprint 2 call:0:0 %0 relations:==,in\nprint 1 2 %0 relations:<,in\nprint 2 2 dict:0 relations:==,notin\n'+fn(0,'print 1\nreturn 2\n'),'1\nTrue\nTrue\nTrue\n');
run('mixed-chain-short-circuit-skips-operand','print 2 3 call:0:0 relations:==,in\n'+fn(0,'print 999\nreturn dict:0\n'),'False\n');
run('128-relations-use-original-middle-operands','print '+'1 '.repeat(128)+'1 set:1 relations:'+Array(127).fill('==').concat('in').join(',')+'\n','True\n');
run('membership-chain-reuses-container-not-boolean','set 0 2 9 dict:1\nset 1 1 9 dict:1\nprint 2 %0 %1 relations:in,in\n','',105,keyType);
run('old-compare-chain-and-boolean-short-circuit-preserved','print 1 2 3 chain:<,<\nprint false 1 none contains and\nprint true dict:0 1 index or\n','True\nFalse\nTrue\n');
for(const expression of ['dict:0 1 index','1 7 dict:1 2 index'])run('missing-key-'+expression.replaceAll(/[^a-z0-9]/g,'-'),'print '+expression+'\n','',111,missing);
for(const [name,k]of[['tuple','tuple:0'],['list','list:0'],['dict','dict:0'],['set','set:0']])for(const operation of ['contains','index'])run('unsupported-key-'+name+'-'+operation,operation==='contains'?`print ${k} dict:0 contains\n`:`print dict:0 ${k} index\n`,'',105,keyType);
run('object-key-explicitly-unsupported','print new:0:0 dict:0 contains\nclass\n','',105,keyType);
for(const expression of ['1 none contains','1 tuple:0 contains','1 list:0 contains','1 '+text('x')+' contains','set:0 1 index','set:0 dict_keys'])run('unsupported-membership-or-index-'+checks,'print '+expression+'\n','',105,type);
run('set-index-store-unsupported','store 1 | 1 set:1 | 0\n','',105,type);
for(const tag of ['dict:0','set:0'])for(const operation of ['print '+tag+'\n','print '+tag+' '+tag+' ==\n','print '+tag+' 1 +\n'])run('unsupported-mapping-operation-'+checks,operation,'',105,type);
source=Array.from({length:128},(_,i)=>`${i} ${i*2}`).join(' ')+' dict:128';
run('128-dictionary-entries-update-at-capacity',`set 0 ${source}\nstore 999 | %0 | false\nprint %0 len\nprint %0 0 index\nprint %0 dict_keys 127 index\n`,'128\n999\n127\n');
run('dictionary-129th-unique-entry-fails',`set 0 ${source}\nstore 1 | %0 | 128\n`,'',103,'NJA203: native dictionary capacity exceeded\n');
run('128-set-elements-boundary','print '+Array.from({length:128},(_,i)=>i).join(' ')+' set:128 len\n','128\n');
run('literal-128-duplicate-elements-count-source-not-unique','print '+'true '.repeat(128)+'set:128 len\nprint '+'true 1 '.repeat(128)+'dict:128 len\n','1\n1\n');
for(const [name,kind,size,status]of[['bytes-exact','bytes',250000,0],['bytes-over','bytes',250001,103],['text-exact','text',250000,0],['text-over','text',250001,103]]){const k=kind==='text'?text('a'.repeat(size)):bytes(Buffer.alloc(size,0x61));run('key-work-'+name,`set 0 ${k}\nset 1 %0 7 dict:1\nprint %0 %1 contains\n`,status===0?'True\n':'',status,status===0?'':keyWork);}
const largeA=bytes(Buffer.alloc(499999,0x61)),largeB=bytes(Buffer.alloc(500001,0x62)),cumulative=`set 0 ${largeA} 1 ${largeB} 2 dict:2\n`;
run('cumulative-key-work-snapshot-and-none-boundary',cumulative+'print %0 dict_keys len\nprint none %0 contains\n','2\nFalse\n');
run('cumulative-key-work-not-reset-per-candidate',cumulative+'print b:00 %0 contains\n','',103,keyWork);
run('canonical-large-integer-key-work-exhaustion','set 0 1'+'0'.repeat(999999)+'\nset 1 dict:0\nset 2 0\nwhile %2 4 <\nstore %2 | %1 | %0 %2 +\nprint %2\nset 2 %2 1 +\nend\n','0\n1\n2\n',103,keyWork);
run('shared-arena-dictionaries-exhaustion','while true\nset 0 dict:0\nend\n','',103,'NJA203: native value arena exhausted\n');
run('shared-arena-sets-exhaustion','while true\nset 0 set:0\nend\n','',103,'NJA203: native value arena exhausted\n');
const invalids=[['dict-key','eval %0 1 dict:1\n'],['dict-value','eval 1 %0 dict:1\n'],['set-element','eval %0 set:1\n'],['contains-left','eval %0 dict:0 contains\n'],['contains-right','eval 1 %0 contains\n'],['snapshot','eval %0 dict_keys\n'],['skipped-chain','eval 1 2 %0 relations:==,in\n'],['unused','eval none\n'+fn(0,'return %0 dict_keys\n')],['dict129','eval '+'1 1 '.repeat(129)+'dict:129\n'],['set129','eval '+'1 '.repeat(129)+'set:129\n']];
for(const[name,ir]of invalids){const input=join(directory,'invalid-'+name+'.ir'),output=join(directory,'invalid-'+name+'.elf');writeFileSync(input,ir);const r=command(driver,[input,output]);assert.equal(r.status,1,name);assert.equal(existsSync(output),false);checks++;}
function unique(image,pattern){const p=image.indexOf(pattern,4096);assert.ok(p>=4096,'missing mutation signature');assert.equal(image.indexOf(pattern,p+1),-1,'ambiguous mutation signature');return p;}
for(const[name,change]of[['sign',(b,p)=>b.writeBigInt64LE(2n,p)],['count',(b,p)=>b.writeBigUInt64LE(0xffffffffffffffffn,p+8)],['limb-range',(b,p)=>b.writeUInt32LE(1000000000,p+16)],['canonical-high-zero',(b,p)=>b.writeUInt32LE(0,p+20)],['payload-pointer',(b,p)=>b.writeBigUInt64LE(0n,p-16)]]){const a=emit('mutant-key-'+name,'set 0 999999999999999999\nprint %0 7 dict:1 len\n'),image=readFileSync(a.output),signature=Buffer.alloc(24);signature.writeBigInt64LE(1n);signature.writeBigUInt64LE(2n,8);signature.writeUInt32LE(999999999,16);signature.writeUInt32LE(999999999,20);const p=unique(image,signature);assert.equal(image.readBigUInt64LE(p-24),0n);assert.equal(image.readBigUInt64LE(p-16),0x400000n+BigInt(p));change(image,p);writeFileSync(a.output,image);const r=execute(a);assert.equal(r.status,103,name);assert.equal(r.stderr,'NJA203: invalid native mapping key span\n');checks++;}
const boolKey=emit('mutant-bool-key-is-canonical','print true 7 dict:1 len\n'),boolImage=readFileSync(boolKey.output),one=Buffer.alloc(20);one.writeBigInt64LE(1n);one.writeBigUInt64LE(1n,8);one.writeUInt32LE(1,16);const boolOffset=unique(boolImage,one);boolImage.writeUInt32LE(2,boolOffset+16);writeFileSync(boolKey.output,boolImage);const boolResult=execute(boolKey);assert.equal(boolResult.status,103);assert.equal(boolResult.stderr,'NJA203: invalid native mapping key span\n');checks++;
for(const[name,mutate]of[['invalid-utf8',(b,p)=>b[p]=0xff],['text-data-pointer',(b,p)=>b.writeBigUInt64LE(0n,p-16)]]){const a=emit('mutant-key-'+name,`print ${text('KEY_TEXT_MARKER')} dict:0 contains\n`),image=readFileSync(a.output),p=unique(image,Buffer.from('KEY_TEXT_MARKER'));mutate(image,p);writeFileSync(a.output,image);const r=execute(a);assert.equal(r.status,103,name);assert.equal(r.stderr,'NJA203: invalid native mapping key span\n');checks++;}
for(const[name,pattern,change,diagnostic]of[
 ['table-pointer',Buffer.from([0x4c,0x89,0xa8,8,0,0,0]),(b,p)=>b[p+2]=0xb8,'NJA203: invalid native mapping span\n'],
 ['count',Buffer.from([0x4c,0x89,0xa8,8,0,0,0,0x48,0x31,0xd2,0x48,0x89,0x90,16,0,0,0]),(b,p)=>Buffer.from([0x48,0x89,0xc2]).copy(b,p+7),'NJA203: invalid native mapping span\n'],
 ['selected-value',Buffer.from([0x48,0x8b,0x95,0xe8,0xff,0xff,0xff,0x49,0x89,0x94,0x24,8,0,0,0]),(b,p)=>b[p+9]=0xa4,'NJA203: invalid native sequence span\n'],
]){const a=emit('mutant-map-'+name,'set 0 7 8 dict:1\nprint %0 7 index\n'),image=readFileSync(a.output),p=unique(image,pattern);change(image,p);writeFileSync(a.output,image);const r=execute(a);assert.equal(r.status,103,name+': '+r.stderr);assert.equal(r.stderr,diagnostic);checks++;}
const budget=emit('mutant-budget-debit',`set 0 ${bytes(Buffer.alloc(250001,0x61))}\nset 1 %0 7 dict:1\nprint %0 %1 contains\n`),budgetImage=readFileSync(budget.output),debit=unique(budgetImage,Buffer.from([0x49,0x29,0xd3,0x4c,0x89,0x9d,0xc0,0xff,0xff,0xff]));budgetImage.fill(0x90,debit,debit+3);writeFileSync(budget.output,budgetImage);const br=execute(budget);assert.equal(br.status,0);assert.equal(br.stdout,'True\n');checks++;
const capacity=emit('mutant-set-capacity',`print ${Array.from({length:128},(_,i)=>i).join(' ')} set:128 len\n`),capacityImage=readFileSync(capacity.output),cap=unique(capacityImage,Buffer.from([0x49,0x81,0xfc,128,0,0,0]));capacityImage.writeInt32LE(127,cap+3);writeFileSync(capacity.output,capacityImage);const cr=execute(capacity);assert.equal(cr.status,103);assert.equal(cr.stderr,'NJA203: native set capacity exceeded\n');checks++;
const snapshot=emit('mutant-snapshot-budget','print b:61 1 dict:1 dict_keys len\n'),snapshotImage=readFileSync(snapshot.output),snapshotFrame=unique(snapshotImage,Buffer.from([0x48,0x81,0xec,0x80,4,0,0,0x48,0xb8,0x40,0x42,0x0f,0,0,0,0,0]));snapshotImage.writeBigUInt64LE(0n,snapshotFrame+9);writeFileSync(snapshot.output,snapshotImage);const snapshotResult=execute(snapshot);assert.equal(snapshotResult.status,103);assert.equal(snapshotResult.stderr,keyWork);checks++;
const controlled=emit('mutant-value-source-control',`set 0 7 ${text('MAPPING_DATA_MARKER')} dict:1\nprint %0 7 index\n`),controlImage=readFileSync(controlled.output),marker=unique(controlImage,Buffer.from('MAPPING_DATA_MARKER'));controlImage[marker]=0x6d;writeFileSync(controlled.output,controlImage);const changed=execute(controlled);assert.equal(changed.status,0);assert.equal(changed.stdout,'mAPPING_DATA_MARKER\n');checks++;
const deterministic='print 1 7 dict:1 1 index\n',a=emit('deterministic-a',deterministic),b=emit('deterministic-b',deterministic);assert.deepEqual(readFileSync(a.output),readFileSync(b.output));checks++;
console.log(`PASS ${checks} native mapping checks; ${oracleOutputs} independent output lines; target=Linux x86_64; artifact timeout=5s; artifacts=${directory}`);
