// Scan the exact staged blobs; report paths and counts without exposing matches.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const patterns = [
  ['private-key', /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/],
  ['github-token', /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ['api-key', /\bsk-[A-Za-z0-9]{25,}/],
  ['private-user-path', /C:[\\/]+Users[\\/]+(?!runner(?:admin)?[\\/])/i],
  ['private-contact', /[A-Za-z0-9_.+-]+@(?:hotmail|outlook)\.com/i],
];
const classify = text => patterns.filter(([,pattern])=>pattern.test(text)).map(([name])=>name);
if (process.argv.includes('--self-test')) {
  assert.deepEqual(classify('gh'+'p_'+'A'.repeat(40)),['github-token']);
  assert.deepEqual(classify('-----BEGIN '+'PRIVATE KEY-----'),['private-key']);
  assert.deepEqual(classify('C:'+'\\Users\\'+'PrivateOwner\\project'),['private-user-path']);
  assert.deepEqual(classify('29204956+ramzimhd@users.noreply.github.com'),[]);
  assert.deepEqual(classify('Unicode fixture: café, 日本語'),[]);
  console.log('Publication scanner self-test: 5 positive/negative checks passed.');
  process.exit(0);
}
const git = args => execFileSync('git',args,{maxBuffer:16*1024*1024});
const files = git(['ls-files','-z']).toString('utf8').split('\0').filter(Boolean);
const changed = git(['diff','--cached','--name-status']).toString('utf8');
const findings=[];
for(const file of files) {
  // Stage zero is the to-be-published version, never a possibly different worktree file.
  const bytes=git(['show',':'+file]);
  if(bytes.includes(0)) { findings.push({path:file,rules:['unreviewed-binary']}); continue; }
  const rules=classify(bytes.toString('utf8'));
  if(/^(?:launch\/local\/|reports\/local\/|reading\/)|(?:^|\/)\.env(?:\.|$)/i.test(file)) rules.push('private-file');
  if(rules.length)findings.push({path:file,rules});
}
const report={
  parent_commit:git(['rev-parse','HEAD']).toString('utf8').trim(),
  reviewed_staged_tree:git(['write-tree']).toString('utf8').trim(),
  timestamp:new Date().toISOString(),
  staged_changes:changed.trim().split('\n').filter(Boolean),
  tracked_paths:files,
  tracked_path_list_sha256:createHash('sha256').update(files.join('\n')+'\n').digest('hex'),
  findings,
  result:findings.length?'failed':'passed',
  limits:[
    'A bounded pattern scan complements manual review; it cannot prove absence of every secret or private fact.',
    'The reviewed staged tree precedes adding this generated report. Its own contents must be reviewed separately.',
    'This is a retained review for the current push; it does not recreate a missing historical pre-first-push transcript.',
  ],
};
console.log(JSON.stringify(report,null,2));
process.exitCode=findings.length?1:0;
