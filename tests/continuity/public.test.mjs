import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assertPublicContinuity, publicContinuitySchema, readPublicContinuity, unknownPublicBudget, validatePublicContinuity } from '../../scripts/validation/check-continuity.mjs';

const observed = '2026-10-25T12:00:00Z';
const checker = fileURLToPath(new URL('../../scripts/validation/check-continuity.mjs', import.meta.url));
// Explicitly synthetic schema-test data. This function is not live progress,
// product evidence, an ownership claim or a fabricated receiver/supervisor.
function syntheticRecord() {
  return {
    schema_version: 1, contract_revision: '1.3', language_edition: '2026.1',
    session_id: 'synthetic-session', owner: 'synthetic-owner', status: 'running',
    checkpoint_generation: 7, head: 'a'.repeat(40), branch: 'synthetic/observed-branch',
    last_verified_source: null, dirty_paths: ['tests/synthetic-only.naja'],
    task: 'synthetic-schema-fixture', completed: [],
    checks: [{ command: ['synthetic-command-never-executed'], result: 'not_run', exit_code: null }],
    artifacts: [{ path: 'build/synthetic-only.elf', sha256: 'b'.repeat(64), bytes: null }],
    blockers: [], unsafe_intermediate_states: [], next_action: 'Synthetic manual schema test only.',
    next_commands: [['git', 'status', '--short']],
    ownership: { reservation: '<git-common-dir>/naja-integration.lock', fencing_generation: 2,
      status: 'held', observed_at: observed, reclaim: 'explicit verified release only' },
    budget: unknownPublicBudget(),
    automatic_runner: { status: 'manual_only', mode: 'manual_resume', manual_resume_required: true,
      provider_requests_started: false, instructions: 'Synthetic fixture only; manually inspect the source before a fresh authorized session.' },
    updated_at: observed,
  };
}
function reject(record, code) {
  const result = validatePublicContinuity(record);
  assert.equal(result.ok, false);
  if (code) assert.ok(result.errors.some(error => error.code === code), JSON.stringify(result.errors));
  return result;
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'naja-public-continuity-test-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('naja-public-continuity-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const filename = path.join(root, 'synthetic-public.json');
  fs.writeFileSync(filename, JSON.stringify(syntheticRecord()));
  return { root, filename };
}
function observedMetric(record, name) {
  record.budget[name].status = 'observed';
  record.budget[name].observed_at = observed;
  record.budget[name].source = 'Synthetic unit-test telemetry only';
  return record.budget[name];
}

test('synthetic observation validates without asserting readiness or product acceptance', () => {
  const record = syntheticRecord(), before = structuredClone(record);
  assert.deepEqual(validatePublicContinuity(record), { ok: true, errors: [] });
  assert.equal(assertPublicContinuity(record), record);
  assert.deepEqual(record, before);
  assert.equal(record.checkpoint_generation, 7);
  assert.equal(record.ownership.fencing_generation, 2);
});

test('published schema is frozen and every record object is closed', () => {
  assert.ok(Object.isFrozen(publicContinuitySchema));
  function inspect(schema) {
    if (schema.type === 'object') assert.equal(schema.additionalProperties, false);
    for (const child of Object.values(schema.properties ?? {})) inspect(child);
    for (const child of Object.values(schema.$defs ?? {})) inspect(child);
    if (schema.items) inspect(schema.items);
  }
  inspect(publicContinuitySchema);
});

test('all six lifecycle states are observations and never close product gates', () => {
  for (const status of ['running', 'checkpointing', 'ready_for_handoff', 'waiting_for_quota', 'blocked_external', 'complete']) {
    const record = syntheticRecord(); record.status = status;
    assert.equal(validatePublicContinuity(record).ok, true);
  }
  const record = syntheticRecord(); record.status = 'HATCH_complete'; reject(record, 'enum');
});

test('requires source, dirty paths, checkpoints, completed work and exact next commands', () => {
  for (const field of ['head', 'branch', 'last_verified_source', 'dirty_paths', 'completed', 'checks', 'artifacts', 'blockers', 'unsafe_intermediate_states', 'next_commands']) {
    const record = syntheticRecord(); delete record[field]; reject(record, 'required');
  }
  const record = syntheticRecord(); record.next_commands = []; reject(record, 'items');
});

test('rejects ad hoc check text and unknown properties at nested levels', () => {
  const record = syntheticRecord(); record.checks = { integrated: 'passed:68' }; reject(record, 'type');
  for (const mutate of [
    value => { value.extra = 1; },
    value => { value.ownership.process_identity = null; },
    value => { value.budget.context.guessed_percent = 0; },
    value => { value.checks[0].unreviewed_result = 'green'; },
  ]) { const value = syntheticRecord(); mutate(value); reject(value, 'closed_object'); }
});

test('rejects public nonce/authentication fields without revealing their values', () => {
  for (const field of ['nonce', 'token', 'password', 'api_key', 'private_path']) {
    const record = syntheticRecord(); record.ownership[field] = 'SYNTHETIC-PRIVATE-VALUE';
    const result = reject(record, 'private_field');
    assert.ok(!JSON.stringify(result).includes('SYNTHETIC-PRIVATE-VALUE'));
  }
});

test('rejects credential-shaped values and authorization arguments without echoing input', () => {
  for (const candidate of ['ghp_' + 'x'.repeat(40), 'Authorization: Bearer SYNTHETIC-CREDENTIAL', '--token=SYNTHETIC-CREDENTIAL', 'nonce=SYNTHETIC-RESERVATION']) {
    const record = syntheticRecord(); record.completed = [candidate];
    const result = reject(record, 'private_value');
    assert.ok(!JSON.stringify(result).includes(candidate));
  }
});

test('rejects private user-profile and Git checkpoint paths even inside narrative fields', () => {
  for (const candidate of ['C:\\Users\\Synthetic Person\\.ssh\\key', '/home/synthetic/.config/local', '/Users/synthetic/private', '.git/naja-continuity/owner.json', 'src/.git/checkpoint', 'launch/local/environment.json', 'reports/local/failure.log', '.naja/history/state.json', 'naja-continuity/checkpoints/private-id']) {
    const record = syntheticRecord(); record.next_action = candidate;
    reject(record, 'private_path');
  }
});

test('requires relative canonical paths without traversal, drives, aliases or streams', () => {
  for (const candidate of ['../outside', 'src/../outside', './source', '/absolute', 'C:/naja/source', 'src\\source', 'src//source', 'reports/file.log:stream', '   ']) {
    const record = syntheticRecord(); record.dirty_paths = [candidate]; reject(record);
  }
});

test('preserves multilingual relative paths and does not impose ASCII-only data rules', () => {
  const record = syntheticRecord(); record.dirty_paths = ['tests/data/日本語.json'];
  record.completed = ['Synthetic test preserves multilingual user data: مرحبا.'];
  assert.equal(validatePublicContinuity(record).ok, true);
});

test('does not compare observed historical HEAD or source with the current Git revision', () => {
  const record = syntheticRecord(); record.head = '1'.repeat(40); record.last_verified_source = '2'.repeat(40);
  record.branch = null;
  record.checks = [{ command: ['synthetic-command-never-executed'], result: 'passed', exit_code: 0, source: '3'.repeat(40) }];
  assert.equal(validatePublicContinuity(record).ok, true);
});

test('accepts only full source hashes and positive safe checkpoint/fencing generations', () => {
  for (const length of [7, 39, 41, 63, 65]) { const record = syntheticRecord(); record.head = 'a'.repeat(length); reject(record, 'pattern'); }
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const record = syntheticRecord(); record.checkpoint_generation = value; reject(record);
    record.checkpoint_generation = 1; record.ownership.fencing_generation = value; reject(record);
  }
  const record = syntheticRecord(); record.head = 'a'.repeat(64); assert.equal(validatePublicContinuity(record).ok, true);
});

test('a passed check requires observed exit zero while source remains explicitly optional', () => {
  for (const exit of [null, 1, -1]) { const record = syntheticRecord(); record.checks[0].result = 'passed'; record.checks[0].exit_code = exit; reject(record, 'constant'); }
  const record = syntheticRecord(); record.checks[0].result = 'passed'; record.checks[0].exit_code = 0;
  assert.equal(validatePublicContinuity(record).ok, true);
});

test('not-run checks keep unknown exit null and do not turn blocked/failed into passes', () => {
  const record = syntheticRecord(); record.checks[0].exit_code = 0; reject(record, 'constant');
  record.checks = [{ command: ['synthetic-failure'], result: 'failed', exit_code: 1 }, { command: ['synthetic-unavailable'], result: 'blocked', exit_code: null }];
  assert.equal(validatePublicContinuity(record).ok, true);
});

test('artifact and optional log identities need valid hashes and unambiguous paths', () => {
  const record = syntheticRecord(); record.artifacts[0].sha256 = 'short'; reject(record, 'pattern');
  record.artifacts[0].sha256 = 'b'.repeat(64); record.artifacts.push({ path: record.artifacts[0].path, sha256: 'c'.repeat(64) });
  reject(record, 'duplicate_artifact');
  record.artifacts.pop(); record.checks[0].log_path = 'reports/checks/synthetic.log'; reject(record, 'log_identity');
  record.checks[0].log_sha256 = 'd'.repeat(64); assert.equal(validatePublicContinuity(record).ok, true);
});

test('unknown telemetry remains null in all five independent categories', () => {
  for (const [name, key, value] of [['context', 'remaining_tokens', 0], ['provider_quota', 'used_percent', 0], ['rate_limit', 'limited', false], ['execution_deadline', 'remaining_seconds', 0], ['spend', 'remaining', 0]]) {
    const record = syntheticRecord(); record.budget[name][key] = value; reject(record, 'constant');
  }
});

test('unknown telemetry cannot carry guessed source or observation time', () => {
  const record = syntheticRecord(); record.budget.context.observed_at = observed; record.budget.context.source = 'Guessed';
  reject(record, 'constant');
});

test('observed metrics need real identity fields and at least one measured value', () => {
  const record = syntheticRecord(); record.budget.context.status = 'observed'; record.budget.context.remaining_tokens = 0;
  reject(record);
  record.budget.context.observed_at = observed; record.budget.context.source = 'Synthetic fixture observation';
  assert.equal(validatePublicContinuity(record).ok, true);
  record.budget.context.remaining_tokens = null; reject(record, 'any_of');
});

test('provider quota never substitutes for context and percentage observations stay consistent', () => {
  const record = syntheticRecord(), quota = observedMetric(record, 'provider_quota');
  quota.used_percent = 25; quota.remaining_percent = 75; quota.window_minutes = 10080;
  assert.equal(validatePublicContinuity(record).ok, true);
  assert.equal(record.budget.context.remaining_tokens, null);
  quota.remaining_percent = 80; reject(record, 'quota_consistency');
  quota.remaining_percent = 75; record.budget.context.used_percent = 25; reject(record, 'closed_object');
});

test('rate/deadline/spend observations cannot authorize extra billing or paid fallback', () => {
  const record = syntheticRecord(); observedMetric(record, 'rate_limit').limited = false;
  observedMetric(record, 'execution_deadline').remaining_seconds = 60;
  const spend = observedMetric(record, 'spend'); spend.remaining = 0; spend.monetary_ceiling = 0; spend.currency = 'CAD';
  assert.equal(validatePublicContinuity(record).ok, true);
  spend.extra_billing_authorized = true; reject(record, 'constant');
  spend.extra_billing_authorized = false; spend.remaining = 1; reject(record, 'spend_consistency');
  spend.remaining = 0; spend.currency = null; reject(record, 'type');
});

test('rejects out-of-range, unsafe and mistyped numeric telemetry', () => {
  for (const value of [-1, 101, '0', NaN, Infinity]) {
    const record = syntheticRecord(); observedMetric(record, 'provider_quota').used_percent = value; reject(record);
  }
});

test('manual continuation cannot be promoted into a running automatic provider', () => {
  for (const [key, value] of [['status', 'running'], ['mode', 'automatic_resume'], ['manual_resume_required', false], ['provider_requests_started', true]]) {
    const record = syntheticRecord(); record.automatic_runner[key] = value; reject(record);
  }
});

test('timestamps reject invalid calendars and accept explicit recorded UTC offsets', () => {
  for (const candidate of ['2026-02-31T12:00:00Z', '2026-10-25', '2026-10-25T25:00:00Z', '2026-10-25T12:00:00+24:00']) {
    const record = syntheticRecord(); record.updated_at = candidate; reject(record, 'timestamp');
  }
  const record = syntheticRecord(); record.updated_at = '2024-02-29T12:00:00-05:00'; assert.equal(validatePublicContinuity(record).ok, true);
});

test('unknown budget factory returns independent objects without changing private schemas', () => {
  const first = unknownPublicBudget(), second = unknownPublicBudget(); first.context.remaining_tokens = 99;
  assert.equal(second.context.remaining_tokens, null);
  assert.equal(second.spend.extra_billing_authorized, false);
});

test('assertion API provides sanitized errors and leaves rejected records untouched', () => {
  const record = syntheticRecord(); record.ownership.nonce = 'SYNTHETIC-HIDDEN-VALUE'; const before = structuredClone(record);
  assert.throws(() => assertPublicContinuity(record), error => error.code === 'PUBLIC_CONTINUITY_INVALID' && !JSON.stringify(error).includes('SYNTHETIC-HIDDEN-VALUE'));
  assert.deepEqual(record, before);
});

test('file checks reject hidden duplicate-field credentials and malformed JSON without echoing bytes', t => {
  const f = fixture(t); const secret = 'ghp_' + 'x'.repeat(40);
  const raw = JSON.stringify(syntheticRecord()).replace('"next_action":', `"next_action":"${secret}","next_action":`);
  fs.writeFileSync(f.filename, raw); const result = readPublicContinuity(f.filename);
  assert.equal(result.ok, false); assert.ok(!JSON.stringify(result).includes(secret));
  fs.writeFileSync(f.filename, '{SYNTHETIC-PRIVATE-CONTENT');
  const invalid = readPublicContinuity(f.filename); assert.equal(invalid.ok, false); assert.ok(!JSON.stringify(invalid).includes('SYNTHETIC-PRIVATE-CONTENT'));
});

test('bounded JSON checks reject cycles and oversized documents', t => {
  const record = syntheticRecord(); record.completed = [record]; reject(record, 'json_data');
  const f = fixture(t); fs.writeFileSync(f.filename, ' '.repeat(1024 * 1024 + 1));
  assert.equal(readPublicContinuity(f.filename).errors[0].code, 'size');
});

test('rejects custom prototypes and accessors before serialization can change a checked record', () => {
  const record = syntheticRecord(); let accessed = false;
  Object.defineProperty(record, 'next_action', { enumerable: true, get() { accessed = true; return 'Synthetic accessor'; } });
  reject(record, 'json_data'); assert.equal(accessed, false);
  const changed = Object.assign(Object.create({ toJSON() { throw new Error('Must not execute'); } }), syntheticRecord());
  reject(changed, 'json_data');
});

test('rejects sparse or decorated arrays that do not serialize as the checked structure', () => {
  const record = syntheticRecord(); record.dirty_paths = new Array(1); reject(record, 'json_data');
  record.dirty_paths = []; record.dirty_paths.hidden = 'Synthetic extra field'; reject(record, 'json_data');
});

test('CLI checks recorded files in a directory without Git and never executes next commands', t => {
  const f = fixture(t), before = fs.readFileSync(f.filename);
  const record = syntheticRecord(); record.next_commands = [['synthetic-command-never-executed']]; fs.writeFileSync(f.filename, JSON.stringify(record));
  const run = args => spawnSync(process.execPath, [checker, ...args], { cwd: f.root, encoding: 'utf8' });
  const result = run(['--file', f.filename, '--json']);
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).ok, true);
  assert.match(result.stdout, /no current Git/);
  assert.equal(run(['--help']).status, 0); assert.equal(run(['--bad-option']).status, 2);
  fs.writeFileSync(f.filename, before);
  assert.equal(run(['--file', f.filename]).status, 0);
  fs.writeFileSync(f.filename, '{}'); assert.equal(run(['--file', f.filename]).status, 1);
});
