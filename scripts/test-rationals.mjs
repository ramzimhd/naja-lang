// Exact native Rational checks; Node BigInt fractions are the independent oracle.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)); process.chdir(root);
const hash=x=>createHash('sha256').update(x).digest('hex');
const argv=process.argv.slice(2),prepare=argv.length===1&&argv[0]==='--prepare-only';
const expected=argv.length===2&&argv[0]==='--expect-source'?argv[1]:null;
assert.ok(prepare||(expected!==null&&/^[0-9a-f]{40}$/.test(expected)),'use --prepare-only or --expect-source FULL_COMMIT_HASH');
const budgets={native_seconds:5,command_ms:20000,build_ms:45000,overall_ms:240000,capture_bytes:8*1024*1024};
const type='NJA205: native value type mismatch\n',invalid='NJA203: invalid native rational span\n',work='NJA203: native rational work limit exceeded\n',zero='NJA206: integer division by zero\n';
const keyType='NJA205: unsupported native mapping key type\n';
const hex=s=>Buffer.from(s).toString('hex'),text=s=>'t:'+hex(s);
const abs=n=>n<0n?-n:n;
function gcd(a,b){a=abs(a);b=abs(b);while(b!==0n)[a,b]=[b,a%b];return a;}
function fraction(n,d=1n){n=BigInt(n);d=BigInt(d);assert.notEqual(d,0n);if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return{n:n/g,d:d/g};}
const count=n=>n===0n?0n:BigInt(Math.ceil(abs(n).toString().length/9));
function divisionCost(n,m){return n===0n?1n:m===1n?1n+8n*(n+2n):1n+132n*n*(m+1n)+8n*(m+1n);}
function normalizationCost(n,d){let cost=0n;if(d<0n){cost+=1n+2n*count(n)+1n+2n*count(d);n=-n;d=-d;}if(n===0n)return cost;let a=abs(n),b=d;if(n<0n)cost+=1n+2n*count(n);while(b!==0n){cost+=1n+divisionCost(count(a),count(b));[a,b]=[b,a%b];}return cost+divisionCost(count(n),count(a))+divisionCost(count(d),count(a));}
const constructorCost=(n,d)=>2n+count(n)+2n+count(d)+normalizationCost(n,d);
assert.equal(constructorCost(0n,1n),5n);assert.equal(constructorCost(1n,1n),82n);
assert.equal(constructorCost(10n**432n,10n**432n),971506n);
assert.equal(constructorCost(10n**441n,10n**441n),1011132n);
assert.equal(constructorCost(-(10n**432n),-(10n**432n)),971704n);
assert.equal(constructorCost(0n,-(10n**891n)),306n);
const cases=[];
const run=(name,source,stdout='',exit=0,stderr='',options={})=>cases.push({name,source,stdout,exit,stderr,...options});
const rejected=(name,source)=>cases.push({name,source,reject:true});
const rational=(n,d)=>`${n} ${d} rational`;
const observe=expression=>`set 0 ${expression}\nprint %0 num\nprint %0 den\n`;
const expectedFraction=f=>`${f.n}\n${f.d}\n`;
const fn=(n,body)=>`function ${n}\n${body}end\n`;

let source='',stdout='';
for(const[n,d]of[[0n,1n],[0n,-9n],[1n,1n],[-1n,1n],[1n,-1n],[-1n,-1n],[42n,30n],[-42n,30n],[42n,-30n],[-42n,-30n],[(1n<<255n)*37n,(1n<<193n)*37n],[999999999999999999999999999n,1000000000000000000000000001n]]){source+=observe(rational(n,d));stdout+=expectedFraction(fraction(n,d));}
run('normalization-sign-zero-common-factors',source,stdout);
run('bool-constructors-and-exact-int-division',observe('true true rational')+observe('false true rational')+observe('7 2 exact'), '1\n1\n0\n1\n7\n2\n');
const huge=10n**9999n+123456789n;
run('ten-thousand-digit-exact-integer',observe(rational(huge,-1n)),expectedFraction(fraction(huge,-1n)));
let seed=0x13a7c5e9;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed);};
for(let group=0;group<8;group++){
  source='';stdout='';
  for(let index=0;index<4;index++){
    const a=fraction((random()<<95n)+random(),(random()%100000n)+1n),b=fraction(-((random()<<67n)+random()),(random()%100003n)+1n);
    for(const operator of ['+','-','*','exact']){
      const f=operator==='+'?fraction(a.n*b.d+b.n*a.d,a.d*b.d):operator==='-'?fraction(a.n*b.d-b.n*a.d,a.d*b.d):operator==='*'?fraction(a.n*b.n,a.d*b.d):fraction(a.n*b.d,a.d*b.n);
      source+=observe(`${rational(a.n,a.d)} ${rational(b.n,b.d)} ${operator}`);stdout+=expectedFraction(f);
    }
  }
  run('independent-fraction-oracle-'+group,source,stdout);
}
run('mixed-int-bool-arithmetic',observe('2 3 rational 2 +')+observe('true 2 3 rational -')+observe('2 3 rational false *')+observe('true 2 3 rational exact'),'8\n3\n1\n3\n0\n1\n3\n2\n');
run('unary-and-numeric-truth',observe('6 -8 rational neg')+observe('-6 8 rational pos')+'print 0 9 rational not\nprint 1 9 rational not\n','3\n4\n-3\n4\nTrue\nFalse\n');
source='';stdout='';
for(const[a,b]of[[fraction(1n,2n),fraction(2n,4n)],[fraction(-3n,2n),fraction(-1n)],[fraction(3n,2n),fraction(2n)],[fraction(0n),fraction(1n)]])for(const op of['==','!=','<','<=','>','>=']){source+=`print ${rational(a.n,a.d)} ${rational(b.n,b.d)} ${op}\n`;const l=a.n*b.d,r=b.n*a.d;stdout+=(op==='=='?l===r:op==='!='?l!==r:op==='<'?l<r:op==='<='?l<=r:op==='>'?l>r:l>=r)?'True\n':'False\n';}
run('numeric-comparison-matrix',source,stdout);
run('numeric-comparison-chain-middle-once','print 0 1 2 rational call:0:1 1 chain:<,<\n'+fn(1,'print 7\nreturn %0\n'),'7\nTrue\n');
run('short-circuit-skips-invalid-construction','print false 1 0 rational and\nprint true '+text('bad')+' 0 rational or\nprint 2 1 1 0 rational chain:<,<\n','False\nTrue\nFalse\n');
for(const value of[text('x'),'b:ff','none','new:0:0']){
  const suffix=value.startsWith('new:')?'class\n':'';
  run('unrelated-equality-'+cases.length,`print 1 2 rational ${value} ==\nprint ${value} 1 2 rational !=\n`+suffix,'False\nTrue\n');
  run('unrelated-order-'+cases.length,`eval 1 2 rational ${value} <\n`+suffix,'',105,type);
}
for(const value of['tuple:0','list:0','dict:0','set:0'])run('unsupported-container-comparison-'+cases.length,`eval 1 2 rational ${value} ==\n`,'',105,type);
for(const expression of['1 2 rational len','1 2 rational 1 //','1 2 rational 1 %','1 2 rational 0 index','1 num','true den','none num','1 2 rational get:78','1 2 rational '+text('x')+' +'])run('unsupported-operation-'+cases.length,'eval '+expression+'\n','',105,type);
run('unsupported-rational-display','print 1 2 rational\n','',105,type);
run('unsupported-rational-store-target','store 7 | 1 2 rational | 0\n','',105,type);
run('unsupported-rational-attribute-target','attr 7 | 1 2 rational | 78\n','',105,type);
for(const expression of['1 2 rational dict:0 contains','1 2 rational 7 dict:1','1 2 rational set:1'])run('unsupported-rational-key-'+cases.length,'eval '+expression+'\n','',105,keyType);
for(const expression of['1 0 rational','0 0 rational','true false rational','1 0 exact','0 7 rational 0 exact'])run('zero-divisor-'+cases.length,'eval '+expression+'\n','',106,zero);
for(const expression of[text('bad')+' 0 rational','0 '+text('bad')+' rational',text('bad')+' 0 exact','1 2 rational 1 rational'])run('kind-before-zero-'+cases.length,'eval '+expression+'\n','',105,type);
run('children-before-type-and-zero','eval call:0:0 call:1:0 rational\n'+fn(0,'print 1\nreturn '+text('bad')+'\n')+fn(0,'print 2\nreturn 0\n'),'1\n2\n',105,type);
run('child-failure-precedes-outer-type','eval '+text('bad')+' 1 0 // rational\n','',106,zero);
run('arithmetic-operands-left-to-right-once',observe('1 2 rational call:0:1 1 3 rational call:1:1 +')+fn(1,'print 1\nreturn %0\n')+fn(1,'print 2\nreturn %0\n'),'1\n2\n5\n6\n');
run('aliases-returns-and-container-values','set 0 5 7 rational\nset 1 %0 call:0:1\nset 2 %0 %1 list:2\nset 3 9 %0 dict:1\nprint %2 0 index num\nprint %3 9 index den\nprint %0 %1 ==\n'+fn(1,'return %0\n'),'5\n7\nTrue\n');
const nearArena=`set 0 2 3 rational\nset 1 %0 list:1\nset 2 new:0:0\nattr %0 | %2 | 78\nset 3 7 %0 dict:1\nset 4 %0 tuple:1\nset 5 ${text('x'.repeat(524288))}\nset 7 ${text('y'.repeat(65536))}\n`+'eval %5 t: +\n'.repeat(127)+'eval %7 t: +\n'.repeat(7)+'set 6 0\nwhile %6 1000 <\nstore %0 | %1 | 0\nattr %0 | %2 | 78\nstore %0 | %3 | 7\neval %1 0 index not\neval %4 0 index not\neval %3 7 index not\neval %2 get:78 not\nset 6 %6 1 +\nend\nprint %6\nclass\n';
run('near-arena-generic-checks-do-not-allocate',nearArena,'1000\n');
for(const[name,n,d,exit]of[['positive-49',10n**432n,10n**432n,0],['positive-50',10n**441n,10n**441n,103],['negative-49',-(10n**432n),-(10n**432n),0],['zero-negative-100',0n,-(10n**891n),0]])run('work-boundary-'+name,exit===0?observe(rational(n,d)):'eval '+rational(n,d)+'\n',exit===0?expectedFraction(fraction(n,d)):'',exit,exit===0?'':work);
let fa=1n,fb=1n;for(let i=0;i<600;i++)[fa,fb]=[fb,fa+fb];
run('cumulative-euclid-work-not-reset','eval '+rational(fa,fb)+'\n','',103,work);
run('shared-arena-rational-results-exhaust','while true\neval 1 2 rational\nend\n','',103,'NJA203: native value arena exhausted\n');
for(const[name,ir]of[['left','eval %0 1 rational\n'],['right','eval 1 %0 rational\n'],['reader','eval %0 num\n'],['skipped','eval false %0 1 rational and\n'],['unused','eval none\n'+fn(0,'return %0 den\n')],['depth129','eval 1'+' num'.repeat(129)+'\n']])rejected('invalid-ir-'+name,ir);

// Mutations are independently specified before execution. Each selector must
// be unique; a selector failure stops, rather than loosening an old harness.
for(const kind of['sign','count','limb-range','high-zero','payload-pointer'])run('mutant-input-'+kind,'print 999999999999999999 1 rational num\n','',103,invalid,{mutation:{kind:'integer',field:kind}});
run('mutant-bool-canonical','print true 2 rational num\n','',103,invalid,{mutation:{kind:'bool'}});
for(const field of['numerator-pointer','denominator-pointer'])run('mutant-rational-'+field,'print 1 2 rational num\n','',103,invalid,{mutation:{kind:'packed',field}});
run('mutant-nonreduced-explicit-reader','print 123456789 num\n','',103,invalid,{mutation:{kind:'synthetic',denominator:'self'}});
run('generic-guard-does-not-run-gcd','print 123456789 not\n','False\n',0,'',{mutation:{kind:'synthetic',denominator:'self'}});
run('mutant-negative-denominator','set 1 -3\nprint 123456789 num\n','',103,invalid,{mutation:{kind:'synthetic',denominator:'negative'}});
for(const[name,ir,cost,synthetic,out]of[
  ['zero','eval 0 1 rational\n',5,null,''],['one','eval 1 1 rational\n',82,null,''],
  ['reader','print 123456789 num\n',31,'one','123456789\n'],
  ['negative-reader','print -123456789 num\n',34,'one','-123456789\n'],
  ['positive','print 123456789 pos num\n',31,'one','123456789\n'],
  ['negate','print 123456789 neg num\n',34,'one','-123456789\n'],
  ['add','print 123456789 2 + num\n',150,'one','123456791\n'],
  ['multiply','print 123456789 2 * num\n',132,'one','246913578\n'],
  ['compare','print 123456789 2 >\n',59,'one','True\n'],
])for(const delta of[0,-1])run(`counter-${name}-${delta===0?'exact':'one-under'}`,ir,delta===0?out:'',delta===0?0:103,delta===0?'':work,{mutation:{kind:'budget',budget:cost+delta,synthetic,negative:ir.includes('-123456789')},work_units:cost});
run('mutant-debit-disabled-oracle-control','eval 1 1 rational\n','',0,'',{mutation:{kind:'no-debit',budget:81},control_original_exit:103});
run('mutant-literal-data-control','print 123456789 2 rational num\n','123456791\n',0,'',{mutation:{kind:'literal-change'},control_original_stdout:'123456789\n'});
run('deterministic-emission',observe('22 14 rational'),'11\n7\n',0,'',{deterministic:true});

const identity=t=>({name:t.name,source_sha256:hash(t.source),source_bytes:Buffer.byteLength(t.source),expected_exit:t.reject?1:t.exit,expected_stdout:t.stdout??null,expected_stderr:t.stderr??null,reject:t.reject??false,mutation:t.mutation??null,work_units:t.work_units??null,control_original_exit:t.control_original_exit??null,control_original_stdout:t.control_original_stdout??null,deterministic:t.deterministic??false});
assert.equal(new Set(cases.map(x=>x.name)).size,cases.length);
mkdirSync(resolve('target'),{recursive:true});
const directory=mkdtempSync(resolve('target/rationals-native-')),driver=resolve('target/debug/examples',process.platform==='win32'?'rationals_ir.exe':'rationals_ir');
const commands=[],results=[];let active=null;const started=Date.now();
function command(executable,args,timeout=budgets.command_ms){const remaining=budgets.overall_ms-(Date.now()-started);assert.ok(remaining>0,'overall Rational deadline');const r=spawnSync(executable,args,{encoding:null,timeout:Math.min(timeout,remaining),maxBuffer:budgets.capture_bytes});const i=commands.length;writeFileSync(join(directory,`command-${i}.stdout`),r.stdout??Buffer.alloc(0));writeFileSync(join(directory,`command-${i}.stderr`),r.stderr??Buffer.alloc(0));commands.push({executable,arguments:args,exit:r.status,signal:r.signal,error:r.error?.code??null,stdout_sha256:hash(r.stdout??Buffer.alloc(0)),stderr_sha256:hash(r.stderr??Buffer.alloc(0))});assert.ifError(r.error);assert.equal(r.signal,null);return r;}
const sourceHead=command('git',['rev-parse','HEAD']).stdout.toString().trim();if(expected!==null)assert.equal(sourceHead,expected);
const plan={schema_version:1,state:'prepared',harness_sha256:hash(readFileSync(fileURLToPath(import.meta.url))),contract_sha256:hash(readFileSync('tests/rationals/CONTRACT.md')),budgets,passed:0,not_run:cases.length,results:cases.map(t=>({...identity(t),result:'not_run'}))};
writeFileSync(join(directory,'plan.json'),JSON.stringify(plan,null,2)+'\n');
process.on('uncaughtExceptionMonitor',error=>{try{const done=new Set(results.map(x=>x.name));writeFileSync(join(directory,'failure.json'),JSON.stringify({source_commit:sourceHead,state:'failed',results:[...results,...cases.filter(x=>!done.has(x.name)).map(t=>({...identity(t),result:t===active?'failed':'not_run'}))],commands,error:error.message},null,2)+'\n');}catch{/* Keep original failure. */}});
function unique(image,pattern){const p=image.indexOf(pattern,4096);assert.ok(p>=4096,'missing NEW mutation signature '+pattern.toString('hex'));assert.equal(image.indexOf(pattern,p+1),-1,'ambiguous NEW mutation signature '+pattern.toString('hex'));return p;}
function integer(image,value){const n=BigInt(value),limbs=[];let v=abs(n);while(v){limbs.push(Number(v%1000000000n));v/=1000000000n;}const b=Buffer.alloc(16+4*limbs.length);b.writeBigInt64LE(n<0n?-1n:n===0n?0n:1n);b.writeBigUInt64LE(BigInt(limbs.length),8);limbs.forEach((v,i)=>b.writeUInt32LE(v,16+4*i));return unique(image,b);}
function synthetic(image,denominator,negative=false){const p=integer(image,negative?-123456789n:123456789n);assert.equal(image.readBigUInt64LE(p-24),0n);image.writeBigUInt64LE(10n,p-24);const d=denominator==='self'?p:denominator==='negative'?integer(image,-3n):integer(image,1n);image.writeBigUInt64LE(0x400000n+BigInt(d),p-8);}
function mutate(image,m){
  if(m.synthetic)synthetic(image,m.synthetic,m.negative);
  if(m.budget!==undefined){const p=unique(image,Buffer.from('48b840420f0000000000488985f8ffffff','hex'));image.writeBigUInt64LE(BigInt(m.budget),p+2);}
  if(m.kind==='synthetic')synthetic(image,m.denominator);
  if(m.kind==='integer'){const p=integer(image,999999999999999999n);if(m.field==='sign')image.writeBigInt64LE(2n,p);else if(m.field==='count')image.writeBigUInt64LE(0xffffffffffffffffn,p+8);else if(m.field==='limb-range')image.writeUInt32LE(1000000000,p+16);else if(m.field==='high-zero')image.writeUInt32LE(0,p+20);else image.writeBigUInt64LE(0n,p-16);}
  if(m.kind==='bool'){const p=integer(image,1n);image.writeUInt32LE(2,p+16);}
  if(m.kind==='packed'){const pattern=m.field==='numerator-pointer'?'4c8b85b8ffffff4c898008000000':'4c8b8db0ffffff4c898810000000';const p=unique(image,Buffer.from(pattern,'hex'));image[p+9]=0x90;}
  if(m.kind==='no-debit'){const p=unique(image,Buffer.from('4929d34c899df8ffffff','hex'));image.fill(0x90,p,p+3);}
  if(m.kind==='literal-change'){const p=integer(image,123456789n);image.writeUInt32LE(123456791,p+16);}
}
if(prepare){console.log(`Prepared ${cases.length} Rational native checks; all outcomes not_run. ${relative(root,directory).replaceAll('\\','/')}`);}
else{
  assert.deepEqual(JSON.parse(readFileSync('tests/rationals/PREPARATION.json')),plan,'frozen harness/contract/cases/budgets');
  assert.equal(command('git',['diff','--exit-code','HEAD','--','backends/native']).status,0,'native source changed');
  assert.equal(command('git',['ls-files','--others','--exclude-standard','--','backends/native']).stdout.length,0,'untracked native source is not frozen');
  const build=command('cargo',['+1.97.1','build','-p','naja-native','--example','rationals_ir','--locked','--offline'],budgets.build_ms);assert.equal(build.status,0,build.stderr.toString());
  let target=directory;
  if(process.platform==='win32'){const platform=command('wsl.exe',['--exec','/usr/bin/uname','-sm']);assert.equal(platform.status,0);assert.equal(platform.stdout.toString().trim(),'Linux x86_64');const mapped=command('wsl.exe',['--exec','/usr/bin/wslpath','-a',directory.replaceAll('\\','/')]);assert.equal(mapped.status,0);target=mapped.stdout.toString().trim();}else{assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');}
  for(const test of cases){active=test;const input=join(directory,test.name+'.ir'),output=join(directory,test.name+'.elf');writeFileSync(input,test.source);const emitted=command(driver,[input,output]);let record={...identity(test),emit_exit:emitted.status};if(test.reject){assert.equal(emitted.status,1,test.name+': '+emitted.stderr);assert.equal(existsSync(output),false);}else{assert.equal(emitted.status,0,test.name+': '+emitted.stderr);if(test.deterministic){const second=join(directory,test.name+'-second.elf');assert.equal(command(driver,[input,second]).status,0);assert.deepEqual(readFileSync(output),readFileSync(second));}if(test.mutation){const image=readFileSync(output);mutate(image,test.mutation);writeFileSync(output,image);}const linux=target+'/'+test.name+'.elf';if(process.platform==='win32')assert.equal(command('wsl.exe',['--exec','/usr/bin/chmod','u+x',linux]).status,0);else chmodSync(output,0o700);const args=['/usr/bin/timeout','--signal=TERM','--kill-after=1s',String(budgets.native_seconds),process.platform==='win32'?linux:output];const result=process.platform==='win32'?command('wsl.exe',['--exec',...args]):command(args[0],args.slice(1));assert.equal(result.status,test.exit,test.name+': '+result.stderr);assert.deepEqual(result.stdout,Buffer.from(test.stdout),test.name+': stdout');assert.deepEqual(result.stderr,Buffer.from(test.stderr),test.name+': stderr');if(test.control_original_exit!==undefined)assert.notEqual(result.status,test.control_original_exit);if(test.control_original_stdout!==undefined)assert.throws(()=>assert.deepEqual(result.stdout,Buffer.from(test.control_original_stdout)),e=>e.code==='ERR_ASSERTION');Object.assign(record,{native_exit:result.status,elf_sha256:hash(readFileSync(output)),stdout_sha256:hash(result.stdout),stderr_sha256:hash(result.stderr)});}record.result='passed';results.push(record);active=null;console.log('PASS '+test.name);}
  writeFileSync(join(directory,'summary.json'),JSON.stringify({schema_version:1,source_commit:sourceHead,state:'executed',harness_sha256:plan.harness_sha256,contract_sha256:plan.contract_sha256,budgets,passed:results.length,not_run:0,commands,results},null,2)+'\n');
  console.log(`PASS ${results.length} actual native Rational checks; artifacts=${relative(root,directory).replaceAll('\\','/')}`);
}
