// Native value semantics with independent Node BigInt/codepoint/byte oracles.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync,existsSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const directory=mkdtempSync(resolve('target/dynamic-native-'));
const driver=resolve('target/debug/examples',process.platform==='win32'?'dynamic_ir.exe':'dynamic_ir');
function command(executable,args,options={}) {const result=spawnSync(executable,args,{encoding:'utf8',timeout:20000,maxBuffer:8*1024*1024,...options});assert.ifError(result.error);return result;}
const built=command('cargo',['build','-p','naja-native','--example','dynamic_ir','--locked','--offline']);assert.equal(built.status,0,built.stderr);
let target=directory;
if(process.platform==='win32') {
  const platform=command('wsl.exe',['--exec','/usr/bin/uname','-sm']);assert.equal(platform.status,0,platform.stderr);assert.equal(platform.stdout.trim(),'Linux x86_64');
  const translated=command('wsl.exe',['--exec','/usr/bin/wslpath','-a',directory.replaceAll('\\','/')]);assert.equal(translated.status,0,translated.stderr);target=translated.stdout.trim();
} else {assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');}
let checks=0,oracleOutputs=0;
function emit(name,source) {const input=join(directory,name+'.ir'),output=join(directory,name+'.elf');writeFileSync(input,source);const result=command(driver,[input,output]);assert.equal(result.status,0,result.stderr);return {input,output,linux:target+'/'+name+'.elf'};}
function execute(artifact,shell=null) {
  if(process.platform==='win32') {const permission=command('wsl.exe',['--exec','/usr/bin/chmod','u+x',artifact.linux]);assert.equal(permission.status,0,permission.stderr);}else chmodSync(artifact.output,0o700);
  const args=shell?['/usr/bin/timeout','5','/bin/sh','-c',shell,'dynamic-native-test',artifact.linux]:['/usr/bin/timeout','5',artifact.linux];
  return process.platform==='win32'?command('wsl.exe',['--exec',...args]):command(args[0],args.slice(1));
}
function run(name,source,stdout,status=0,stderr='') {const artifact=emit(name,source),result=execute(artifact);assert.equal(result.status,status,name+': '+result.stderr);assert.equal(result.stdout,stdout,name+': stdout');assert.equal(result.stderr,stderr,name+': stderr');console.log(`PASS ${name} exit=${result.status} sha256=${createHash('sha256').update(readFileSync(artifact.output)).digest('hex')}`);checks++;return artifact;}
const text=value=>'t:'+Buffer.from(value,'utf8').toString('hex');
const bytes=value=>'b:'+Buffer.from(value).toString('hex');
function bytesRepr(value) {
  const quote=value.includes(39)&&!value.includes(34)?'"':"'";
  let output='b'+quote;
  for(const byte of value) {const character=String.fromCharCode(byte);if(character===quote||byte===92)output+='\\'+character;else if(byte===9)output+='\\t';else if(byte===10)output+='\\n';else if(byte===13)output+='\\r';else if(byte<32||byte>=127)output+='\\x'+byte.toString(16).padStart(2,'0');else output+=character;}
  return output+quote;
}
const values=[
  {type:'int',value:0n},{type:'int',value:1n},{type:'int',value:-1n},{type:'int',value:10n**100n},
  {type:'bool',value:false},{type:'bool',value:true},{type:'none',value:null},
  ...['','0','a','ab','ac','é𝄞','\u0000','\ue000','\u{10000}','quote\'"\\'].map(value=>({type:'text',value})),
  ...[[],[0],[255],[39],[34],[39,34],[0,9,10,13,92,127,255]].map(value=>({type:'bytes',value:Buffer.from(value)})),
];
function token(value) {return value.type==='int'?String(value.value):value.type==='bool'?String(value.value):value.type==='none'?'none':value.type==='text'?text(value.value):bytes(value.value);}
function display(value) {return value.type==='none'?'None':value.type==='bool'?(value.value?'True':'False'):value.type==='bytes'?bytesRepr(value.value):String(value.value);}
function truth(value) {return value.type==='none'?false:value.type==='int'?value.value!==0n:value.type==='bool'?value.value:value.value.length!==0;}
function numeric(value) {return value.type==='int'||value.type==='bool';}
function integer(value) {return value.type==='bool'?(value.value?1n:0n):value.value;}
function ordering(a,b) {
  if(numeric(a)&&numeric(b)){const x=integer(a),y=integer(b);return x<y?-1:x>y?1:0;}
  if(a.type!==b.type)return null;
  if(a.type==='none')return null;
  if(a.type==='bytes')return Math.sign(Buffer.compare(a.value,b.value));
  // Compare Unicode scalar values independently of the backend's UTF-8 byte loop.
  const left=Array.from(a.value,c=>c.codePointAt(0)),right=Array.from(b.value,c=>c.codePointAt(0));
  for(let i=0;i<Math.min(left.length,right.length);i++)if(left[i]!==right[i])return left[i]<right[i]?-1:1;
  return Math.sign(left.length-right.length);
}
function equal(a,b) {return a.type==='none'&&b.type==='none'||ordering(a,b)===0;}
let source='',expected='';
function check(expression,value) {source+='print '+expression+'\n';expected+=value+'\n';oracleOutputs++;}
for(const value of values){check(token(value),display(value));check(token(value)+' not',truth(value)?'False':'True');}
check(bytes(Buffer.from(Array.from({length:256},(_,i)=>i))),bytesRepr(Buffer.from(Array.from({length:256},(_,i)=>i))));
run('display-truth-and-all-byte-repr',source,expected);
source='';expected='';
for(const a of values)for(const b of values){check(token(a)+' '+token(b)+' and',display(truth(a)?b:a));check(token(a)+' '+token(b)+' or',display(truth(a)?a:b));}
run('operand-returning-and-or',source,expected);
source='';expected='';
for(const a of values)for(const b of values){
  check(token(a)+' '+token(b)+' ==',equal(a,b)?'True':'False');check(token(a)+' '+token(b)+' !=',equal(a,b)?'False':'True');
  const order=ordering(a,b);if(order!==null)for(const operator of ['<','<=','>','>=']){const answer={'<':order<0,'<=':order<=0,'>':order>0,'>=':order>=0}[operator];check(token(a)+' '+token(b)+' '+operator,answer?'True':'False');}
}
run('numeric-text-bytes-and-unrelated-comparisons',source,expected);
source='';expected='';
const nums=values.filter(numeric);nums.push(...[999999999n,1000000000n,-1000000000n,-(10n**150n),BigInt('9876543210'.repeat(100))].map(value=>({type:'int',value})));
for(const value of nums)check(token(value)+' neg',-integer(value));
for(const a of nums)for(const b of nums){const x=integer(a),y=integer(b);check(token(a)+' '+token(b)+' +',x+y);check(token(a)+' '+token(b)+' -',x-y);check(token(a)+' '+token(b)+' *',x*y);check(token(a)+' '+token(b)+' + '+token(b)+' -',x);}
run('bool-integer-arithmetic-and-metamorphic',source,expected);
source='';expected='';
for(const type of ['text','bytes'])for(const a of values.filter(value=>value.type===type))for(const b of values.filter(value=>value.type===type)){
  const merged={type,value:type==='text'?a.value+b.value:Buffer.concat([a.value,b.value])};check(token(a)+' '+token(b)+' +',display(merged));
  const empty=type==='text'?text(''):bytes([]);check(token(a)+' '+empty+' +',display(a));
}
run('immutable-text-and-bytes-concatenation',source,expected);
run('control-reassignment-and-aliases',readFileSync(new URL('../tests/dynamic/control.ir',import.meta.url),'utf8'),"ééééé\nalias\nb'\\xff\\x00'\nTrue\n5\n");
run('short-circuit-skips-runtime-type-errors',`print false ${text('invalid')} neg and\nprint true ${text('invalid')} neg or\nprint t: ${text('invalid')} neg and\nprint ${text('kept')} none 1 + or\nassert true ${text('invalid')} neg or\n`,'False\nTrue\n\nkept\n');
source='';expected='';
for(const value of nums) {
  check(token(value)+' pos',integer(value));
  check(token(value)+' require_int',display(value));
}
run('positive-and-integer-boundary-preserve-exact-values',source,expected);
source='';expected='';
const unicodeLengths=['','ASCII','\0','é','e\u0301','𝄞','👩‍💻','中文','\r\n'];
const scalars=[0,0x7f,0x80,0x7ff,0x800,0xd7ff,0xe000,0xffff,0x10000,0x10ffff];
for(let index=0;index<100;index++)unicodeLengths.push(Array.from({length:index%31+1},(_,part)=>String.fromCodePoint(scalars[(index*7+part*3)%scalars.length])).join(''));
for(const value of unicodeLengths) {
  const count=BigInt(Array.from(value).length);
  check(text(value)+' len',count);
  check(bytes(Buffer.from(value))+' len',Buffer.byteLength(value));
  check(text(value)+' len true +',count+1n);
}
check(bytes(Array.from({length:256},(_,index)=>index))+' len',256);
for(const value of values.filter(value=>value.type==='text'||value.type==='bytes')) {
  check(token(value)+' '+token(value)+' + len '+token(value)+' len 2 * ==','True');
}
run('unicode-scalar-and-raw-byte-lengths',source,expected);
const chain=(operands,operators)=>operands.join(' ')+' chain:'+operators.join(',');
const operators=['==','!=','<','<=','>','>='];
function compareAnswer(operator,a,b) {
  if(operator==='==')return equal(a,b);if(operator==='!=')return !equal(a,b);
  const order=ordering(a,b);assert.notEqual(order,null,'oracle ordering requires compatible values');
  return {'<':order<0,'<=':order<=0,'>':order>0,'>=':order>=0}[operator];
}
source='';expected='';
for(const group of [values.filter(numeric),values.filter(value=>value.type==='text'),values.filter(value=>value.type==='bytes')]) {
  for(let index=0;index<150;index++) {
    const a=group[index%group.length],b=group[(index*3+1)%group.length],c=group[(index*5+2)%group.length];
    const left=operators[index%operators.length],right=operators[(index*5+1)%operators.length];
    check(chain([token(a),token(b),token(c)],[left,right]),compareAnswer(left,a,b)&&compareAnswer(right,b,c)?'True':'False');
  }
}
for(const a of values)for(const b of values) {
  check(chain([token(a),token(b),token(b)],['==','==']),equal(a,b)?'True':'False');
  check(chain([token(a),token(b),token(a)],['!=','!=']),!equal(a,b)?'True':'False');
}
run('comparison-chain-independent-value-oracles',source,expected);
run('comparison-chain-short-circuit-and-nesting',
  'print '+chain(['2','1',text('invalid')+' neg'],['<','<'])+'\n'+
  'print '+chain(['none','true',text('invalid')+' len'],['==','<='])+'\n'+
  'print '+chain(['0','false','true','2'],['<=','<','<'])+'\n'+
  'print '+chain(['none','none','none'],['==','=='])+'\n'+
  'print '+chain(['0',chain(['0','1','2'],['<','<']),'2'],['<','<'])+'\n'+
  'print false '+text('invalid')+' require_int and\n',
  'False\nFalse\nTrue\nTrue\nTrue\nFalse\n');
run('comparison-chain-max-supported-width','print '+chain(Array(129).fill('true'),Array(128).fill('=='))+'\n','True\n');
const pressure='set 0 t:58\nset 1 0\nwhile %1 24 <\nset 0 %0 %0 +\nset 1 %1 1 +\nend\n';
run('chain-intermediate-evaluated-once-under-arena-bound',pressure+'print '+chain(['t:','%0 t: +','%0'],['<=','<='])+'\n','True\n');
run('repeated-intermediate-control-exhausts-arena',pressure+'print t: %0 t: + <= %0 t: + %0 <= and\n','',103,'NJA203: native value arena exhausted\n');
run('chain-false-skips-resource-failure',pressure+'print '+chain(['2','1','%0 %0 +'],['<','<'])+'\n','False\n');
run('chain-evaluation-order-preserves-first-error',pressure+'print '+chain(['1 len','%0 %0 +','0'],['<','<'])+'\n','',105,'NJA205: native value type mismatch\n');
run('length-result-allocation-obeys-arena-limit','while true\nset 0 t:616263 len\nend\n','',103,'NJA203: native value arena exhausted\n');
run('positive-bool-allocation-obeys-arena-limit','while true\nset 0 true pos\nend\n','',103,'NJA203: native value arena exhausted\n');
for(const [name,expression] of [
  ['int-text-add',`1 ${text('1')} +`],['bool-bytes-multiply',`true ${bytes([1])} *`],
  ['text-bytes-add',`${text('x')} ${bytes([120])} +`],['none-negation','none neg'],
  ['text-text-multiply',`${text('5')} ${text('5')} *`],
  ['text-ordered-int',`${text('1')} 1 <`],['none-ordered-none','none none <='],
  ['bool-ordered-text',`true ${text('x')} >`],['bytes-subtract',`${bytes([0])} ${bytes([0])} -`],
  ['text-positive',text('5')+' pos'],['bytes-positive','b:35 pos'],['none-positive','none pos'],
  ['int-length','1 len'],['bool-length','true len'],['none-length','none len'],
  ['text-int-boundary',text('5')+' require_int'],['bytes-int-boundary','b:35 require_int'],['none-int-boundary','none require_int'],
  ['chain-reached-invalid-order',chain(['0','1','none'],['<','<'])],
])run('type-error-'+name,'print '+expression+'\n','',105,'NJA205: native value type mismatch\n');
run('assertion-failure','assert none\nprint 999\n','',104,'NJA204: assertion failed\n');
run('arena-resource-text-concat',`set 0 ${text('x')}\nwhile true\nset 0 %0 %0 +\nend\n`,'',103,'NJA203: native value arena exhausted\n');
run('arena-resource-integer-descriptors','set 0 0\nwhile true\nset 0 %0 1 +\nend\n','',103,'NJA203: native value arena exhausted\n');
run('arena-resource-bytes-format-buffer','set 0 b:ff\nset 1 0\nwhile %1 24 <\nset 0 %0 %0 +\nset 1 %1 1 +\nend\nprint %0\n','',103,'NJA203: native value arena exhausted\n');
for(const [kind,value] of [['text',text('abc')],['bytes',bytes([0,255])],['bool','true'],['int','99999999999999999999999']]){
  const artifact=emit('io-'+kind,'print '+value+'\n'),result=execute(artifact,'exec "$1" > /dev/full');assert.equal(result.status,102,result.stderr);assert.equal(result.stderr,'NJA202: native stdout write failed\n');console.log('PASS '+kind+' stdout write failure exit102');checks++;
}
for(const [name,input] of [['uninitialized','print %0\n'],['out-of-frame','set 128 none\n'],['bad-literal','print 1_2\n'],['invalid-text-utf8','print t:ff\n'],['deep-expression','print 1 '+'not '.repeat(140)+'\n'],['loop-scope','while false\nset 0 true\nend\nprint %0\n'],['empty-chain','print 1 chain:\n'],['excessive-chain','print '+chain(Array(130).fill('0'),Array(129).fill('<='))+'\n'],['skipped-uninitialized-chain','print '+chain(['2','1','%0'],['<','<'])+'\n']]){
  const inputPath=join(directory,name+'.ir'),output=join(directory,name+'.elf');writeFileSync(inputPath,input);const result=command(driver,[inputPath,output]);assert.equal(result.status,1,name);assert.equal(existsSync(output),false,name);console.log('PASS invalid IR rejected before output: '+name);checks++;
}
const deterministic=emit('repeat-one','print 7 true +\n'),repeat=emit('repeat-two','print 7 true +\n');assert.deepEqual(readFileSync(deterministic.output),readFileSync(repeat.output));console.log('PASS repeated emission has identical unsigned ELF bytes');checks++;
const marker='GUARD_MARKER';
for(const [name,mutate,status,diagnostic] of [
  ['tag',image=>image.writeBigUInt64LE(99n,image.indexOf(marker)-24),105,'NJA205: native value type mismatch\n'],
  ['length',image=>image.writeBigUInt64LE(0xffffffffffffffffn,image.indexOf(marker)-8),103,'NJA203: native value arena exhausted\n'],
]){const artifact=emit('mutant-'+name,'print '+text(marker)+'\n'),image=readFileSync(artifact.output);assert.ok(image.indexOf(marker)>4096);mutate(image);writeFileSync(artifact.output,image);const result=execute(artifact);assert.equal(result.status,status,result.stderr);assert.equal(result.stdout,'');assert.equal(result.stderr,diagnostic);console.log('PASS malformed '+name+' descriptor is guarded before payload access');checks++;}
const content=emit('mutant-content','print '+text('seed-value')+'\n');assert.equal(execute(content).stdout,'seed-value\n');const image=readFileSync(content.output),position=image.indexOf('seed-value');assert.ok(position>4096);image[position]='n'.charCodeAt(0);writeFileSync(content.output,image);assert.equal(execute(content).stdout,'need-value\n');console.log('PASS native output depends on runtime literal data rather than a canned result');checks++;
console.log(`${checks} dynamic native/IR checks passed; ${oracleOutputs} independent arithmetic, comparison, truth, bytes-repr and metamorphic outputs matched.`);
console.log('Limits: B0 development IR; Linuxx64/explicit local WSL; bounded 64MiB temporary arena; no float/container/functions/exception-unwinding, complete runtime, FC1, self-hosting or release claim.');
