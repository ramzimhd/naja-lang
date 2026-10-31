// Frozen native interval checks; Node BigInt is an independent exact-value oracle.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const hash=x=>createHash('sha256').update(x).digest('hex');
const argv=process.argv.slice(2),prepare=argv.length===1&&argv[0]==='--prepare-only';
const expected=argv.length===2&&argv[0]==='--expect-source'?argv[1]:null;
assert.ok(prepare||(expected!==null&&/^[0-9a-f]{40}$/.test(expected)),'use --prepare-only or --expect-source FULL_COMMIT_HASH');
const budgets={native_seconds:5,command_ms:20000,build_ms:45000,overall_ms:240000,capture_bytes:8*1024*1024};
const type='NJA205: native value type mismatch\n',invalid='NJA203: invalid native integer interval span\n',work='NJA203: native integer interval work limit exceeded\n',outside='NJA212: integer interval check failed\n',empty='NJA213: empty integer interval\n',arena='NJA203: native value arena exhausted\n',zero='NJA206: integer division by zero\n';
const cases=[],run=(name,source,stdout='',exit=0,stderr='',options={})=>cases.push({name,source,stdout,exit,stderr,...options});
const reject=(name,source)=>cases.push({name,source,reject:true});
const text=s=>'t:'+Buffer.from(s).toString('hex'),fn=(n,body)=>`function ${n}\n${body}end\n`;
const abs=n=>n<0n?-n:n,count=n=>n===0n?0n:BigInt(Math.ceil(abs(n).toString().length/9));
const maximum=(a,b)=>a>b?a:b;
function model(v,l,u){v=BigInt(v);l=BigInt(l);u=BigInt(u);let cost=6n+count(v)+count(l)+count(u);cost+=1n+2n*maximum(count(l),count(u));if(l>u)return{exit:113,cost};cost+=1n+2n*maximum(count(v),count(l));if(v<l)return{exit:112,cost};cost+=1n+2n*maximum(count(v),count(u));return{exit:v>u?112:0,cost};}
assert.equal(model(0n,0n,0n).cost,9n);assert.equal(model(1n,1n,1n).cost,18n);
let source='',stdout='';
for(const[v,l,u]of[[0n,0n,0n],[1n,1n,1n],[-1n,-1n,-1n],[0n,-1n,1n],[-42n,-50n,-30n],[1n<<200n,-(1n<<256n),1n<<256n],[-(1n<<300n),-(1n<<301n),0n],[999999999999999999999n,999999999999999999998n,1000000000000000000000n]]){assert.equal(model(v,l,u).exit,0);source+=`print ${v} ${l} ${u} interval\n`;stdout+=v+'\n';}
run('inclusive-signed-arbitrary-precision',source,stdout);
for(const v of[false,true])for(const l of[false,true])for(const u of[false,true]){const m=model(BigInt(v),BigInt(l),BigInt(u));run(`bool-${v}-${l}-${u}`,`print ${v} ${l} ${u} interval\n`,m.exit?'':(v?'True\n':'False\n'),m.exit,m.exit===113?empty:m.exit===112?outside:'');}
for(const[v,l,u]of[[-2n,-1n,1n],[2n,-1n,1n],[0n,2n,1n],[-9n,-4n,-6n],[1n<<200n,0n,(1n<<200n)-1n],[-(1n<<200n),-(1n<<200n)+1n,0n]]){const m=model(v,l,u);run('range-failure-'+cases.length,`eval ${v} ${l} ${u} interval\n`,'',m.exit,m.exit===113?empty:outside);}
let seed=0x1a7e194d;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed);};
for(let group=0;group<8;group++){source='';stdout='';for(let i=0;i<4;i++){const l=-(random()<<BigInt(group*13)),u=(random()<<BigInt(group*17))+1n,v=l+(random()%(u-l+1n));assert.equal(model(v,l,u).exit,0);source+=`print ${v} ${l} ${u} interval\n`;stdout+=v+'\n';}run('independent-bigint-oracle-'+group,source,stdout);}
for(const bad of[text('x'),'b:ff','none','list:0','tuple:0','dict:0','set:0','new:0:0','1 1 rational'])for(let position=0;position<3;position++){const parts=['1','0','2'];parts[position]=bad;run('unsupported-kind-'+cases.length,'eval '+parts.join(' ')+' interval\n'+(bad.startsWith('new:')?'class\n':''),'',105,type);}
run('children-left-to-right-once-before-type','eval call:0:0 call:1:0 call:2:0 interval\n'+fn(0,'print 1\nreturn '+text('bad')+'\n')+fn(0,'print 2\nreturn 2\n')+fn(0,'print 3\nreturn 1\n'),'1\n2\n3\n',105,type);
run('children-before-empty-and-range','eval call:0:0 call:1:0 call:2:0 interval\n'+fn(0,'print 1\nreturn 9\n')+fn(0,'print 2\nreturn 2\n')+fn(0,'print 3\nreturn 1\n'),'1\n2\n3\n',113,empty);
run('child-failure-stops-later-child','eval call:0:0 1 0 // call:1:0 interval\n'+fn(0,'print 1\nreturn '+text('bad')+'\n')+fn(0,'print 3\nreturn 2\n'),'1\n',106,zero);
run('upper-child-failure-precedes-outer-type','eval '+text('bad')+' 0 1 0 // interval\n','',106,zero);
run('successful-nested-call-effects','print 1 call:0:1 0 call:1:1 2 call:2:1 interval\n'+fn(1,'print 11\nreturn %0\n')+fn(1,'print 22\nreturn %0\n')+fn(1,'print 33\nreturn %0\n'),'11\n22\n33\n1\n');
run('short-circuit-and-chains-skip-check','print false 9 0 1 interval and\nprint true 1 2 1 interval or\nprint 2 1 9 0 1 interval chain:<,<\n','False\nTrue\nFalse\n');
run('nested-checks-and-unrefined-results','set 0 7 0 9 interval\nprint %0 1 +\nprint %0 0 9 interval 0 9 interval\nprint true false true interval\n','8\n7\nTrue\n');
run('aliases-returns-collections-and-fields','set 0 7\nset 1 %0 0 9 interval call:0:1\nset 2 %1 list:1\nset 3 4 %1 dict:1\nset 4 new:0:0\nattr %1 | %4 | 78\nprint %2 0 index\nprint %3 4 index\nprint %4 get:78\n'+fn(1,'return %0\n')+'class\n','7\n7\n7\n');
for(let position=0;position<3;position++){const p=['1','0','2'];p[position]='%0';reject('invalid-ir-child-'+position,'eval '+p.join(' ')+' interval\n');reject('invalid-ir-skipped-child-'+position,'eval false '+p.join(' ')+' interval and\n');}
reject('invalid-ir-unused-function','eval none\n'+fn(0,'return 1 0 %0 interval\n'));
reject('invalid-ir-height129','eval 1'+' 0 2 interval'.repeat(129)+'\n');
reject('invalid-ir-nodes10001','eval 1 0 2 interval\n'.repeat(2001));
reject('invalid-ir-literal-over-aggregate','eval '+('1'.repeat(1_048_576))+' 0 2 interval\n');
for(const[name,v,l,u]of[['zero',0n,0n,0n],['one',1n,1n,1n],['mixed',1n,0n,2n],['empty',1n,2n,1n],['below',-1n,0n,1n],['above',2n,0n,1n],['opposite-signs',-1n,-2n,2n]]){const m=model(v,l,u);for(const delta of[0n,-1n])run(`counter-${name}-${delta===0n?'exact':'one-under'}`,`eval ${v} ${l} ${u} interval\n`, '',delta===0n?m.exit:103,delta===0n?(m.exit===113?empty:m.exit===112?outside:''):work,{mutation:{kind:'budget',budget:Number(m.cost+delta)},work_units:Number(m.cost)});}
for(const budget of[0,1,2,3,5,8,11,14])run('counter-cumulative-phase-'+budget,'eval 1 0 2 interval\n','',103,work,{mutation:{kind:'budget',budget}});
for(const[n,exit]of[[111110,0],[111111,103]])run('natural-shared-pointer-work-'+n,'set 0 1'+'0'.repeat(9*(n-1))+'\neval %0 %0 %0 interval\n'+(exit?'':'print 7\n'),exit?'':'7\n',exit,exit?work:'',{work_units:9+9*n});
run('natural-exact-million-work','set 0 1'+'0'.repeat(9*(111111-1))+'\nset 1 %0 1000000000000000000 //\neval %1 %1 %0 interval\nprint 7\n','7\n',0,'',{work_units:1_000_000});
const fullArena='set 0 '+text('x'.repeat(524288))+'\nset 1 '+text('y'.repeat(521216))+'\n'+'eval %0 t: +\n'.repeat(127)+'eval %1 t: +\n';
assert.equal(127*(524288+24)+521216+24,64*1024*1024);
run('full-arena-checks-allocate-nothing',fullArena+'eval 7 0 9 interval\n'.repeat(200)+'print true false true interval\n','True\n');
run('full-arena-next-allocation-fails',fullArena+'eval 1 1 +\n','',103,arena);
for(const field of['sign','count','limb-range','high-zero','payload-pointer','raw-unaligned','metadata','descriptor-pointer','descriptor-unaligned'])run('malformed-'+field,'eval 999999999999999999 0 1000000000000000000 interval\n','',103,invalid,{mutation:{kind:'integer',field}});
run('malformed-bool-positive-two','eval true -7 7 interval\n','',103,invalid,{mutation:{kind:'bool'}});
run('kind-before-corrupt-earlier-payload','eval 999999999999999999 '+text('wrong')+' 2 interval\n','',105,type,{mutation:{kind:'integer',field:'sign'}});
run('kind-before-zero-work','eval 1 0 '+text('wrong')+' interval\n','',105,type,{mutation:{kind:'budget',budget:0}});
run('raw-span-before-raw-debit','eval 999999999999999999 0 1000000000000000000 interval\n','',103,invalid,{mutation:{kind:'integer',field:'payload-pointer',budget:1}});
run('raw-debit-before-bad-limb','eval 999999999999999999 0 1000000000000000000 interval\n','',103,work,{mutation:{kind:'integer',field:'limb-range',budget:1}});
run('metadata-after-descriptor-debit','eval 999999999999999999 0 1000000000000000000 interval\n','',103,work,{mutation:{kind:'integer',field:'metadata',budget:0}});
run('mutant-disabled-debit-control','eval 1 1 1 interval\n','',0,'',{mutation:{kind:'no-debit',budget:17},control_original_exit:103});
run('mutant-changed-data-control','print 123456789 0 999999999 interval\n','123456791\n',0,'',{mutation:{kind:'literal-change'},control_original_stdout:'123456789\n'});
run('deterministic-emission','print -42 -50 -30 interval\n','-42\n',0,'',{deterministic:true});
const identity=t=>({name:t.name,source_sha256:hash(t.source),source_bytes:Buffer.byteLength(t.source),expected_exit:t.reject?1:t.exit,expected_stdout:t.stdout??null,expected_stderr:t.stderr??null,reject:t.reject??false,mutation:t.mutation??null,work_units:t.work_units??null,control_original_exit:t.control_original_exit??null,control_original_stdout:t.control_original_stdout??null,deterministic:t.deterministic??false});
assert.equal(new Set(cases.map(t=>t.name)).size,cases.length);
mkdirSync(resolve('target'),{recursive:true});const directory=mkdtempSync(resolve('target/intervals-native-')),driver=resolve('target/debug/examples',process.platform==='win32'?'intervals_ir.exe':'intervals_ir');
const commands=[],results=[];let active=null;const started=Date.now();
function command(executable,args,timeout=budgets.command_ms){const remaining=budgets.overall_ms-(Date.now()-started);assert.ok(remaining>0,'overall interval deadline');const r=spawnSync(executable,args,{encoding:null,timeout:Math.min(timeout,remaining),maxBuffer:budgets.capture_bytes});const i=commands.length;writeFileSync(join(directory,`command-${i}.stdout`),r.stdout??Buffer.alloc(0));writeFileSync(join(directory,`command-${i}.stderr`),r.stderr??Buffer.alloc(0));commands.push({executable,arguments:args,exit:r.status,signal:r.signal,error:r.error?.code??null,stdout_sha256:hash(r.stdout??Buffer.alloc(0)),stderr_sha256:hash(r.stderr??Buffer.alloc(0))});assert.ifError(r.error);assert.equal(r.signal,null);return r;}
const sourceHead=command('git',['rev-parse','HEAD']).stdout.toString().trim();if(expected!==null)assert.equal(sourceHead,expected);
const plan={schema_version:1,state:'prepared',harness_sha256:hash(readFileSync(fileURLToPath(import.meta.url))),contract_sha256:hash(readFileSync('tests/intervals/CONTRACT.md')),budgets,passed:0,not_run:cases.length,results:cases.map(t=>({...identity(t),result:'not_run'}))};
writeFileSync(join(directory,'plan.json'),JSON.stringify(plan,null,2)+'\n');
process.on('uncaughtExceptionMonitor',error=>{try{const done=new Set(results.map(t=>t.name));writeFileSync(join(directory,'failure.json'),JSON.stringify({source_commit:sourceHead,state:'failed',results:[...results,...cases.filter(t=>!done.has(t.name)).map(t=>({...identity(t),result:t===active?'failed':'not_run'}))],commands,error:error.message},null,2)+'\n');}catch{/* Preserve the original failure. */}});
function unique(image,pattern){const p=image.indexOf(pattern,4096);assert.ok(p>=4096,'missing NEW interval mutation signature '+pattern.toString('hex'));assert.equal(image.indexOf(pattern,p+1),-1,'ambiguous NEW interval mutation signature '+pattern.toString('hex'));return p;}
function integer(image,value){let n=BigInt(value),v=abs(n);const limbs=[];while(v){limbs.push(Number(v%1000000000n));v/=1000000000n;}const b=Buffer.alloc(16+4*limbs.length);b.writeBigInt64LE(n<0n?-1n:n===0n?0n:1n);b.writeBigUInt64LE(BigInt(limbs.length),8);limbs.forEach((v,i)=>b.writeUInt32LE(v,16+4*i));return unique(image,b);}
function mutate(image,m){
 if(m.budget!==undefined){const p=unique(image,Buffer.from('48b840420f0000000000488985f0ffffff','hex'));image.writeBigUInt64LE(BigInt(m.budget),p+2);}
 if(m.kind==='integer'){const p=integer(image,999999999999999999n);assert.equal(image.readBigUInt64LE(p-24),0n);if(m.field==='sign')image.writeBigInt64LE(2n,p);else if(m.field==='count')image.writeBigUInt64LE(0xffffffffffffffffn,p+8);else if(m.field==='limb-range')image.writeUInt32LE(1000000000,p+16);else if(m.field==='high-zero')image.writeUInt32LE(0,p+20);else if(m.field==='metadata')image.writeBigUInt64LE(1n,p-8);else if(m.field==='raw-unaligned')image.writeBigUInt64LE(0x400000n+BigInt(p)+1n,p-16);else if(m.field==='descriptor-pointer'||m.field==='descriptor-unaligned'){const target=0x400000n+BigInt(p-24),matches=[];for(let i=4096;i<image.length-7;i++)if(image[i]===0x48&&image[i+1]===0x8d&&image[i+2]===0x05&&0x400000n+BigInt(i+7+image.readInt32LE(i+3))===target)matches.push(i);assert.equal(matches.length,1,'unique interval literal descriptor address');const i=matches[0],newTarget=m.field==='descriptor-pointer'?0n:target+1n;image.writeInt32LE(Number(newTarget-(0x400000n+BigInt(i+7))),i+3);}else image.writeBigUInt64LE(0n,p-16);}
 if(m.kind==='bool'){const p=integer(image,1n);image.writeUInt32LE(2,p+16);}
 if(m.kind==='no-debit'){const p=unique(image,Buffer.from('4929d34c899df0ffffff','hex'));image.fill(0x90,p,p+3);}
 if(m.kind==='literal-change'){const p=integer(image,123456789n);image.writeUInt32LE(123456791,p+16);}
}
if(prepare){console.log(`Prepared ${cases.length} native interval checks; all outcomes not_run. ${relative(root,directory).replaceAll('\\','/')}`);}
else{
 assert.deepEqual(JSON.parse(readFileSync('tests/intervals/PREPARATION.json')),plan,'frozen harness/contract/cases/budgets');
 assert.equal(command('git',['diff','--exit-code','HEAD','--','backends/native']).status,0,'native source changed');assert.equal(command('git',['ls-files','--others','--exclude-standard','--','backends/native']).stdout.length,0,'untracked native source');
 const build=command('cargo',['+1.97.1','build','-p','naja-native','--example','intervals_ir','--locked','--offline'],budgets.build_ms);assert.equal(build.status,0,build.stderr.toString());
 let target=directory;if(process.platform==='win32'){const platform=command('wsl.exe',['--exec','/usr/bin/uname','-sm']);assert.equal(platform.status,0);assert.equal(platform.stdout.toString().trim(),'Linux x86_64');const mapped=command('wsl.exe',['--exec','/usr/bin/wslpath','-a',directory.replaceAll('\\','/')]);assert.equal(mapped.status,0);target=mapped.stdout.toString().trim();}else{assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');}
 for(const test of cases){active=test;const input=join(directory,test.name+'.ir'),output=join(directory,test.name+'.elf');writeFileSync(input,test.source);const emitted=command(driver,[input,output]);let record={...identity(test),emit_exit:emitted.status};if(test.reject){assert.equal(emitted.status,1,test.name+': '+emitted.stderr);assert.equal(existsSync(output),false);}else{assert.equal(emitted.status,0,test.name+': '+emitted.stderr);if(test.deterministic){const second=join(directory,test.name+'-second.elf');assert.equal(command(driver,[input,second]).status,0);assert.deepEqual(readFileSync(output),readFileSync(second));}if(test.mutation){const image=readFileSync(output);mutate(image,test.mutation);writeFileSync(output,image);}const linux=target+'/'+test.name+'.elf';if(process.platform==='win32')assert.equal(command('wsl.exe',['--exec','/usr/bin/chmod','u+x',linux]).status,0);else chmodSync(output,0o700);const args=['/usr/bin/timeout','--signal=TERM','--kill-after=1s',String(budgets.native_seconds),process.platform==='win32'?linux:output];const result=process.platform==='win32'?command('wsl.exe',['--exec',...args]):command(args[0],args.slice(1));assert.equal(result.status,test.exit,test.name+': '+result.stderr);assert.deepEqual(result.stdout,Buffer.from(test.stdout),test.name+': stdout');assert.deepEqual(result.stderr,Buffer.from(test.stderr),test.name+': stderr');if(test.control_original_exit!==undefined)assert.notEqual(result.status,test.control_original_exit);if(test.control_original_stdout!==undefined)assert.throws(()=>assert.deepEqual(result.stdout,Buffer.from(test.control_original_stdout)),e=>e.code==='ERR_ASSERTION');Object.assign(record,{native_exit:result.status,elf_sha256:hash(readFileSync(output)),stdout_sha256:hash(result.stdout),stderr_sha256:hash(result.stderr)});}record.result='passed';results.push(record);active=null;console.log('PASS '+test.name);}
 writeFileSync(join(directory,'summary.json'),JSON.stringify({schema_version:1,source_commit:sourceHead,state:'executed',harness_sha256:plan.harness_sha256,contract_sha256:plan.contract_sha256,budgets,passed:results.length,not_run:0,commands,results},null,2)+'\n');console.log(`PASS ${results.length} actual native interval checks; artifacts=${relative(root,directory).replaceAll('\\','/')}`);
}
