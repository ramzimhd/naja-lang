import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { acquireReservation, assessResume, classifyOutcome, inspectReservation, releaseReservation, snapshot, unknownBudget, writeCheckpoint } from '../../tools/continuity/local.mjs';
import { checkpointSchema, counterSchema, reservationSchema, validate } from '../../tools/continuity/schemas.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const moduleUrl = new URL('../../tools/continuity/local.mjs', import.meta.url).href;
function git(repo, ...args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function fixture(t) {
  const base = mkdtempSync(path.join(os.tmpdir(), 'naja-continuity-test-'));
  t.after(() => {
    const resolved = path.resolve(base);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('naja-continuity-test-'));
    rmSync(resolved, { recursive: true, force: true });
  });
  const repo = path.join(base, 'repo'); mkdirSync(repo);
  git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.name', 'Synthetic Continuity Fixture');
  git(repo, 'config', 'user.email', 'fixture@example.invalid');
  git(repo, 'config', 'core.autocrlf', 'false');
  writeFileSync(path.join(repo, 'source.txt'), 'original source\n');
  git(repo, 'add', 'source.txt'); git(repo, 'commit', '-m', 'Synthetic fixture baseline');
  return { repo, base, head: git(repo, 'rev-parse', 'HEAD'), private: path.join(repo, '.git/naja-continuity') };
}
function reserve(repo, owner = 'fixture-owner') { return acquireReservation(repo, { owner, session: randomUUID() }); }
function details(head) { return { task: 'synthetic recovery fixture', last_verified_source: head, next_action: 'Inspect the preserved source and rerun its tests', next_commands: [['git', 'status', '--short']], checks: [{ command: ['synthetic-test'], result: 'not_run', exit_code: null }] }; }
function checkpoint(f, token, more = {}) { return writeCheckpoint(f.repo, token, { ...details(f.head), ...more }); }
function child(code, args = []) {
  return new Promise(resolve => {
    const process_ = spawn(process.execPath, ['--input-type=module', '-e', code, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    process_.stdout.on('data', data => { stdout += data; }); process_.stderr.on('data', data => { stderr += data; });
    process_.on('close', status => resolve({ status, stdout, stderr }));
  });
}

test('fresh session resumes a clean checkpoint after explicit release/acquire', t => {
  const f = fixture(t), outgoing = reserve(f.repo);
  const record = checkpoint(f, outgoing);
  validate(record, checkpointSchema);
  releaseReservation(f.repo, outgoing);
  const incoming = reserve(f.repo, 'fresh-session');
  assert.ok(incoming.fencing_generation > outgoing.fencing_generation);
  const result = assessResume(f.repo, { token: incoming, expected_checkpoint: record.id });
  assert.equal(result.ready, true, JSON.stringify(result.reasons));
  assert.deepEqual(result.checkpoint.budget, unknownBudget());
  assert.equal(result.automatic_runner, false);
  assert.throws(() => checkpoint(f, outgoing), { code: 'FENCE_REJECTED' });
});

test('competing processes have exactly one reservation winner', async t => {
  const f = fixture(t);
  const code = `import {acquireReservation} from ${JSON.stringify(moduleUrl)}; try { console.log(JSON.stringify(acquireReservation(process.argv[1],{owner:process.argv[2],session:'synthetic-session'}))); } catch(e) { console.error(e.code); process.exitCode=2; }`;
  const outcomes = await Promise.all([child(code, [f.repo, 'one']), child(code, [f.repo, 'two'])]);
  assert.deepEqual(outcomes.map(value => value.status).sort(), [0, 2]);
  assert.match(outcomes.find(value => value.status === 2).stderr, /RESERVATION_HELD/);
});

test('same repository worktrees share the reservation and age never steals it', t => {
  const f = fixture(t), token = reserve(f.repo);
  const worktree = path.join(f.base, 'other'); git(f.repo, 'worktree', 'add', '-b', 'worker', worktree);
  const owner = path.join(f.repo, '.git/naja-integration.lock/owner.json');
  utimesSync(owner, new Date(0), new Date(0));
  assert.throws(() => reserve(worktree, 'competitor'), { code: 'RESERVATION_HELD' });
  assert.equal(inspectReservation(worktree).reservation.nonce, token.nonce);
});

test('incomplete or legacy reservation is read-only and cannot be automatically reclaimed', t => {
  const f = fixture(t), lock = path.join(f.repo, '.git/naja-integration.lock'); mkdirSync(lock);
  assert.equal(inspectReservation(f.repo).format, 'incomplete-read-only');
  assert.throws(() => reserve(f.repo), { code: 'RESERVATION_HELD' });
  writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ owner: 'legacy-owner', fencing_generation: 1 }));
  assert.equal(inspectReservation(f.repo).format, 'legacy-or-invalid-read-only');
  assert.throws(() => reserve(f.repo), { code: 'RESERVATION_HELD' });
});

test('explicit confirmed manual migration retains old ownership and acquires generation two', t => {
  const f = fixture(t), lock = path.join(f.repo, '.git/naja-integration.lock');
  const legacy = { schema_version: 1, owner: 'synthetic-outgoing', session: randomUUID(), nonce: randomUUID(), fencing_generation: 1, created_at: new Date(0).toISOString(), process_identity: null };
  mkdirSync(lock); writeFileSync(path.join(lock, 'owner.json'), JSON.stringify(legacy));
  assert.equal(inspectReservation(f.repo).format, 'legacy-or-invalid-read-only');
  assert.throws(() => reserve(f.repo), { code: 'RESERVATION_HELD' });
  // Simulated explicit coordination: outgoing writer stopped, identity confirmed.
  const counter = { schema_version: 1, value: 1 }; validate(counter, counterSchema);
  writeFileSync(path.join(f.private, 'counter.migration.tmp'), JSON.stringify(counter), { flag: 'wx' });
  renameSync(path.join(f.private, 'counter.migration.tmp'), path.join(f.private, 'reservation-sequence.json'));
  const retired = path.join(f.private, `released-${legacy.nonce}`);
  renameSync(lock, retired);
  const incoming = reserve(f.repo, 'synthetic-incoming');
  assert.equal(incoming.fencing_generation, 2);
  assert.deepEqual(JSON.parse(readFileSync(path.join(retired, 'owner.json'))), legacy);
  assert.throws(() => checkpoint(f, legacy));
});

test('dirty WIP, untracked bytes and failed tests are retained without advancing verification', t => {
  const f = fixture(t), token = reserve(f.repo); checkpoint(f, token);
  git(f.repo, 'switch', '-c', 'fixture/wip');
  writeFileSync(path.join(f.repo, 'source.txt'), 'incomplete WIP\n');
  writeFileSync(path.join(f.repo, 'new.txt'), 'untracked WIP café\n');
  const record = checkpoint(f, token, { checks: [{ command: ['synthetic-failing-test'], result: 'failed', exit_code: 1 }], unsafe_intermediate_states: ['Fixture source is intentionally unfinished'] });
  assert.equal(record.last_verified_source, f.head);
  assert.equal(record.snapshot.dirty.length, 2);
  const result = assessResume(f.repo, { token });
  assert.equal(result.ready, false); assert.ok(result.reasons.includes('dirty_worktree_requires_acknowledgment'));
  assert.equal(assessResume(f.repo, { token, acknowledge_dirty: true }).ready, true);
  const backups = path.join(f.private, 'checkpoints', record.id, 'files');
  record.snapshot.dirty.forEach((entry, index) => assert.equal(hash(readFileSync(path.join(backups, String(index)))), entry.sha256));
  git(f.repo, 'add', '.'); git(f.repo, 'commit', '-m', 'Synthetic incomplete WIP commit');
  assert.throws(() => checkpoint(f, token, { last_verified_source: git(f.repo, 'rev-parse', 'HEAD') }), { code: 'VERIFICATION_CHANGE' });
});

test('source edit followed by forced process exit makes old metadata non-resumable', async t => {
  const f = fixture(t), token = reserve(f.repo); checkpoint(f, token);
  const outcome = await child(`import {writeFileSync} from 'node:fs'; writeFileSync(process.argv[1], 'crash-preserved source\\n'); process.exit(73);`, [path.join(f.repo, 'source.txt')]);
  assert.equal(outcome.status, 73);
  const result = assessResume(f.repo, { token });
  assert.equal(result.ready, false); assert.ok(result.reasons.includes('source_or_metadata_changed'));
  assert.equal(readFileSync(path.join(f.repo, 'source.txt'), 'utf8'), 'crash-preserved source\n');
  assert.equal(result.checkpoint.last_verified_source, f.head);
});

test('malformed pointer, stale generation, content tampering and changed commit fail closed', t => {
  const f = fixture(t), token = reserve(f.repo), record = checkpoint(f, token);
  const pointer = path.join(f.private, 'latest.json'), saved = readFileSync(pointer);
  writeFileSync(pointer, '{'); assert.equal(assessResume(f.repo, { token }).ready, false); writeFileSync(pointer, saved);
  writeFileSync(pointer, JSON.stringify({ ...JSON.parse(saved), id: '../../outside' })); assert.equal(assessResume(f.repo, { token }).ready, false); writeFileSync(pointer, saved);
  const sequence = path.join(f.private, 'checkpoint-sequence.json'), original = readFileSync(sequence);
  writeFileSync(sequence, JSON.stringify({ schema_version: 1, value: record.checkpoint_generation + 1 }));
  assert.ok(assessResume(f.repo, { token }).reasons.includes('stale_checkpoint')); writeFileSync(sequence, original);
  const filename = path.join(f.private, 'checkpoints', record.id, 'checkpoint.json');
  const recordBytes = readFileSync(filename); writeFileSync(filename, recordBytes.toString().replace('Inspect the preserved source', 'tampered source'));
  assert.equal(assessResume(f.repo, { token }).ready, false); writeFileSync(filename, recordBytes);
  writeFileSync(path.join(f.repo, 'source.txt'), 'new commit\n'); git(f.repo, 'commit', '-am', 'Synthetic newer source');
  assert.ok(assessResume(f.repo, { token }).reasons.includes('source_commit_mismatch'));
});

test('cached newer remote commit blocks recovery without fetch, reset or overwriting source', t => {
  const f = fixture(t), remote = path.join(f.base, 'remote.git'), peer = path.join(f.base, 'peer');
  git(f.repo, 'init', '--bare', remote); git(f.repo, 'remote', 'add', 'origin', remote); git(f.repo, 'push', '-u', 'origin', 'main');
  const token = reserve(f.repo); checkpoint(f, token);
  git(f.repo, 'clone', '-b', 'main', remote, peer); git(peer, 'config', 'user.name', 'Synthetic Peer'); git(peer, 'config', 'user.email', 'fixture@example.invalid');
  writeFileSync(path.join(peer, 'source.txt'), 'new remote source\n'); git(peer, 'commit', '-am', 'Synthetic remote change'); git(peer, 'push');
  git(f.repo, 'fetch', 'origin'); // Test arrangement only; the helper never fetches.
  const result = assessResume(f.repo, { token });
  assert.ok(result.reasons.includes('newer_upstream_commit'));
  assert.equal(git(f.repo, 'rev-parse', 'HEAD'), f.head);
  assert.equal(readFileSync(path.join(f.repo, 'source.txt'), 'utf8'), 'original source\n');
});

test('strict schemas and outcome classification retain unknown telemetry and distinguish tests from quotas', () => {
  const ordinary = classifyOutcome({ kind: 'test_failure', message: 'a test named quota failed' });
  assert.equal(ordinary.state, 'running'); assert.equal(ordinary.automatic_provider_switch, false);
  assert.deepEqual(ordinary.budget, unknownBudget());
  for (const kind of ['provider_quota', 'rate_limit']) {
    const result = classifyOutcome({ kind, retry_after_ms: 2000 });
    assert.equal(result.state, 'waiting_for_quota'); assert.equal(result.retry_after_ms, 2000); assert.equal(result.automatic_retry, false);
  }
  for (const kind of ['missing_auth', 'provider_unavailable']) assert.equal(classifyOutcome({ kind }).state, 'blocked_external');
  for (const kind of ['context_warning', 'execution_deadline']) assert.equal(classifyOutcome({ kind }).state, 'checkpointing');
  assert.equal(classifyOutcome({ kind: 'unrecognized' }).classification, 'unknown');
  assert.equal(classifyOutcome({ kind: 'cancelled' }).state, 'ready_for_handoff');
  assert.equal(classifyOutcome({ kind: 'completed' }).state, 'complete');
  assert.throws(() => validate({ schema_version: 1, owner: 'x', unauthorized: true }, reservationSchema));
});

test('invalid checks cannot publish or poison the last valid checkpoint', t => {
  const f = fixture(t), token = reserve(f.repo), previous = checkpoint(f, token);
  assert.throws(() => validate({ ...token, unauthorized: true }, reservationSchema), /unexpected unauthorized/);
  assert.throws(() => validate({ ...previous, next_commands: [] }, checkpointSchema), /too few items/);
  assert.throws(() => checkpoint(f, token, { checks: [{ command: ['synthetic-test'], result: 'passed', exit_code: 1 }] }), { code: 'FALSE_PASS' });
  const result = assessResume(f.repo, { token });
  assert.equal(result.ready, true); assert.equal(result.checkpoint.id, previous.id);
});

test('quota and context warning checkpoints preserve source and verification without a provider retry', t => {
  const f = fixture(t), token = reserve(f.repo); checkpoint(f, token);
  writeFileSync(path.join(f.repo, 'source.txt'), 'warning-interrupted WIP\n');
  for (const kind of ['context_warning', 'provider_quota']) {
    const outcome = classifyOutcome({ kind });
    const record = checkpoint(f, token, { state: outcome.state, budget: outcome.budget });
    assert.equal(record.state, outcome.state); assert.equal(record.last_verified_source, f.head);
    assert.equal(outcome.automatic_retry, false);
    assert.equal(readFileSync(path.join(f.repo, 'source.txt'), 'utf8'), 'warning-interrupted WIP\n');
  }
});

test('held mutation guards and incomplete atomic temporary files never authorize lock theft', t => {
  const f = fixture(t), token = reserve(f.repo), previous = checkpoint(f, token);
  mkdirSync(path.join(f.repo, '.git/naja-integration.lock/.operation'));
  assert.throws(() => checkpoint(f, token), { code: 'OPERATION_BUSY' });
  assert.throws(() => releaseReservation(f.repo, token), { code: 'OPERATION_BUSY' });
  writeFileSync(path.join(f.private, 'latest.json.interrupted.tmp'), '{unfinished write');
  const result = assessResume(f.repo, { token });
  assert.equal(result.ready, false); assert.ok(result.reasons.includes('ownership_operation_busy')); assert.equal(result.checkpoint.id, previous.id);
});

test('fresh process reads checkpoint without private chat history or provider calls', async t => {
  const f = fixture(t), token = reserve(f.repo); checkpoint(f, token); releaseReservation(f.repo, token);
  const cli = new URL('../../tools/continuity/cli.mjs', import.meta.url);
  const result = spawnSync(process.execPath, [fileURLToPath(cli), 'assess', '--root', f.repo], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).ready, true);
  const outcome = await child(`import {assessResume} from ${JSON.stringify(moduleUrl)}; const r=assessResume(process.argv[1]); console.log(JSON.stringify(r)); process.exitCode=r.ready?0:1;`, [f.repo]);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(JSON.parse(outcome.stdout).checkpoint.task, 'synthetic recovery fixture');
});

test('conflict stages are fingerprinted and unmerged recovery always needs manual review', t => {
  const f = fixture(t), token = reserve(f.repo);
  const blob = text => {
    const result = spawnSync('git', ['-C', f.repo, 'hash-object', '-w', '--stdin'], { input: text, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const base = blob('base\n'), ours = blob('ours\n'), theirs = blob('theirs\n'), newer = blob('changed conflict stage\n');
  function conflict(stage3) {
    const input = `0 ${'0'.repeat(40)}\tsource.txt\n100644 ${base} 1\tsource.txt\n100644 ${ours} 2\tsource.txt\n100644 ${stage3} 3\tsource.txt\n`;
    const result = spawnSync('git', ['-C', f.repo, 'update-index', '--index-info'], { input, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  conflict(theirs);
  const record = checkpoint(f, token), before = snapshot(f.repo);
  const unchanged = assessResume(f.repo, { token, acknowledge_dirty: true, expected_checkpoint: record.id });
  assert.equal(unchanged.ready, false);
  assert.ok(unchanged.reasons.includes('unmerged_index_requires_manual_review'));
  conflict(newer);
  const after = snapshot(f.repo);
  assert.notEqual(after.index_sha256, before.index_sha256);
  assert.notEqual(after.fingerprint, before.fingerprint);
  const changed = assessResume(f.repo, { token, acknowledge_dirty: true, expected_checkpoint: record.id });
  assert.equal(changed.ready, false);
  assert.ok(changed.reasons.includes('source_or_metadata_changed'));
  assert.equal(git(f.repo, 'rev-parse', 'HEAD'), f.head);
  assert.equal(readFileSync(path.join(f.repo, 'source.txt'), 'utf8'), 'original source\n');
});
