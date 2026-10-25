import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { budgetSchema, checkpointSchema, counterSchema, pointerSchema, reservationSchema, validate } from './schemas.mjs';

const MAX_FILE = 64 * 1024 * 1024;
const MAX_TOTAL = 128 * 1024 * 1024;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const unknownBudget = () => ({ context: null, provider_quota: null, rate_limit: null, execution_deadline: null, spend: null });
function stop(code, message) { const error = new Error(message); error.code = code; throw error; }
function git(repo, args, allowFailure = false) {
  const result = spawnSync('git', ['--no-optional-locks', '-C', repo, ...args], { encoding: null, timeout: 10000, maxBuffer: MAX_FILE });
  if (result.error || (!allowFailure && result.status !== 0)) stop('GIT_FAILED', `Git inspection failed: ${args[0]}`);
  return result;
}
function gitText(repo, args) { return git(repo, args).stdout.toString('utf8').trim(); }
function safeDirectory(directory) {
  if (!existsSync(directory)) { try { mkdirSync(directory, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
  if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) stop('UNSAFE_METADATA_PATH', 'Metadata directory must be an ordinary directory');
}
function context(repo, create = false) {
  const worktree = realpathSync(gitText(repo, ['rev-parse', '--show-toplevel']));
  const common = realpathSync(gitText(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir']));
  const base = path.join(common, 'naja-continuity');
  const lock = path.join(common, 'naja-integration.lock');
  if (create) safeDirectory(base);
  for (const value of [base, lock]) if (existsSync(value) && lstatSync(value).isSymbolicLink()) stop('UNSAFE_METADATA_PATH', 'Private state cannot be a symlink');
  return { worktree, common, base, lock };
}
function privateRead(filename, schema) {
  if (lstatSync(filename).isSymbolicLink() || lstatSync(filename).size > 1024 * 1024) stop('INVALID_METADATA', 'Private metadata is a symlink or exceeds 1 MiB');
  return validate(JSON.parse(readFileSync(filename, 'utf8')), schema);
}
function atomicJSON(filename, value, schema) {
  validate(value, schema);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  if (bytes.length > 1024 * 1024) stop('METADATA_LIMIT', 'Private metadata exceeds 1 MiB');
  const temporary = `${filename}.${randomUUID()}.tmp`;
  let fd;
  try {
    fd = openSync(temporary, 'wx', 0o600);
    writeFileSync(fd, bytes); fsyncSync(fd); closeSync(fd); fd = undefined;
    renameSync(temporary, filename);
    // Directory fsync is unavailable on some Windows/filesystem combinations.
    try { const directory = openSync(path.dirname(filename), 'r'); try { fsyncSync(directory); } finally { closeSync(directory); } } catch { /* No universal power-loss durability claim. */ }
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}
function nextCounter(filename) {
  const current = existsSync(filename) ? privateRead(filename, counterSchema).value : 0;
  if (current === Number.MAX_SAFE_INTEGER) stop('GENERATION_LIMIT', 'Generation counter exhausted');
  atomicJSON(filename, { schema_version: 1, value: current + 1 }, counterSchema);
  return current + 1;
}
function preserveFile(filename, bytes) {
  const fd = openSync(filename, 'wx', 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
}
export function inspectReservation(repo) {
  const c = context(repo);
  if (!existsSync(c.lock)) return { held: false };
  try {
    const filename = path.join(c.lock, 'owner.json');
    if (lstatSync(filename).isSymbolicLink() || lstatSync(filename).size > 1024 * 1024) return { held: true, format: 'incompatible-read-only' };
    const raw = JSON.parse(readFileSync(filename, 'utf8'));
    try { validate(raw, reservationSchema); return { held: true, format: 'schema-1', reservation: raw }; }
    catch { return { held: true, format: 'legacy-or-invalid-read-only', owner: typeof raw.owner === 'string' ? raw.owner : null }; }
  } catch { return { held: true, format: 'incomplete-read-only' }; }
}
export function acquireReservation(repo, identity) {
  const reservation = { schema_version: 1, owner: identity.owner, session: identity.session, nonce: randomUUID(), fencing_generation: 1, process_identity: { pid: process.pid, observed_at: new Date().toISOString() } };
  validate(reservation, reservationSchema);
  const c = context(repo, true);
  try { mkdirSync(c.lock, { mode: 0o700 }); } catch (error) { if (error.code === 'EEXIST') stop('RESERVATION_HELD', 'An existing owner or incomplete reservation requires explicit coordination; age never authorizes reclaim'); throw error; }
  // A crash here leaves an incomplete reservation. Fail closed; do not reclaim it.
  const counter = path.join(c.base, 'reservation-sequence.json');
  if (!existsSync(counter) && readdirSync(c.base).length > 0) stop('COUNTER_MISSING', 'Existing private state has no fencing counter; manual reconciliation is required');
  reservation.fencing_generation = nextCounter(counter);
  atomicJSON(path.join(c.lock, 'owner.json'), reservation, reservationSchema);
  return reservation;
}
function sameFence(a, b) { return ['owner', 'session', 'nonce', 'fencing_generation'].every(key => a[key] === b[key]); }
function assertFence(c, token) {
  validate(token, reservationSchema);
  let actual;
  try { actual = privateRead(path.join(c.lock, 'owner.json'), reservationSchema); } catch { stop('FENCE_REJECTED', 'Reservation is absent, incomplete or incompatible'); }
  if (!sameFence(actual, token)) stop('FENCE_REJECTED', 'Reservation identity or fencing generation changed');
}
function ownedOperation(repo, token, operation) {
  const c = context(repo, true);
  assertFence(c, token);
  const operationName = '.operation';
  try { mkdirSync(path.join(c.lock, operationName), { mode: 0o700 }); } catch (error) { if (error.code === 'EEXIST') stop('OPERATION_BUSY', 'Another operation or interrupted owner still holds the mutation guard'); throw error; }
  try { assertFence(c, token); return operation(c); }
  finally { rmdirSync(path.join(c.lock, operationName)); }
}
export function releaseReservation(repo, token) {
  return ownedOperation(repo, token, c => {
    const retired = path.join(c.base, `released-${token.nonce}`);
    renameSync(c.lock, retired);
    c.lock = retired; // Guard cleanup must never remove a new owner's guard.
    return { released: true, fencing_generation: token.fencing_generation };
  });
}
function contents(worktree, filename) {
  const full = path.join(worktree, filename);
  const parts = filename.replaceAll('\\', '/').split('/');
  let parent = worktree;
  for (const part of parts.slice(0, -1)) {
    parent = path.join(parent, part);
    if (existsSync(parent) && lstatSync(parent).isSymbolicLink()) stop('UNSAFE_SOURCE_PATH', 'A dirty path traverses a symlink; preserve the worktree for manual review');
  }
  let info;
  try { info = lstatSync(full); } catch (error) { if (error.code === 'ENOENT') return { kind: 'missing', mode: 0, bytes: Buffer.alloc(0) }; throw error; }
  if (info.isSymbolicLink()) return { kind: 'symlink', mode: info.mode & 0o777, bytes: Buffer.from(readlinkSync(full)) };
  if (info.isDirectory()) return { kind: 'directory', mode: info.mode & 0o777, bytes: Buffer.alloc(0) };
  if (!info.isFile() || info.size > MAX_FILE) stop('SOURCE_LIMIT', 'Dirty source entry is unsupported or exceeds 64 MiB');
  return { kind: 'file', mode: info.mode & 0o777, bytes: readFileSync(full) };
}
export function snapshot(repo) {
  const c = context(repo);
  const head = gitText(repo, ['rev-parse', 'HEAD']);
  const branch = gitText(repo, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const raw = git(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all']).stdout.toString('utf8').split('\0');
  const dirty = [];
  let total = 0;
  for (let index = 0; index < raw.length && raw[index]; index++) {
    const status = raw[index].slice(0, 2), filename = raw[index].slice(3);
    if (/[RC]/.test(status)) index++; // Git -z gives destination, then original path.
    const normalized = filename.replaceAll('\\', '/');
    if (path.isAbsolute(filename) || normalized.split('/').includes('..') || normalized.includes('\0')) stop('UNSAFE_SOURCE_PATH', 'Git source path escapes the worktree');
    const value = contents(c.worktree, filename);
    total += value.bytes.length;
    if (dirty.length >= 10000 || total > MAX_TOTAL) stop('SOURCE_LIMIT', 'Dirty checkpoint exceeds its file/byte budget');
    dirty.push({ path: filename, status, kind: value.kind, mode: value.mode, sha256: ['file', 'symlink'].includes(value.kind) ? sha(value.bytes) : null, bytes: value.bytes.length });
  }
  const remote = git(repo, ['rev-parse', '--verify', '@{upstream}'], true);
  const upstream = remote.status === 0 ? remote.stdout.toString('utf8').trim() : null;
  // A cached diff omits conflict-stage blob identities. Preserve their identity
  // and index visibility flags as well as the binary staged patch.
  const index_sha256 = sha(Buffer.concat([
    Buffer.from('index-entries-v1\0'),
    git(repo, ['ls-files', '--stage', '-v', '-z']).stdout,
    git(repo, ['diff', '--cached', '--binary', 'HEAD']).stdout,
  ]));
  const body = { head, branch, worktree: c.worktree, dirty, index_sha256, upstream, remote_freshness: 'cached-ref-only; no fetch performed' };
  return { ...body, fingerprint: sha(JSON.stringify(body)) };
}
function latest(c) {
  const pointer = privateRead(path.join(c.base, 'latest.json'), pointerSchema);
  const directory = path.join(c.base, 'checkpoints', pointer.id);
  if (lstatSync(path.dirname(directory)).isSymbolicLink() || lstatSync(directory).isSymbolicLink()) stop('INVALID_METADATA', 'Checkpoint directory cannot be a symlink');
  const filename = path.join(directory, 'checkpoint.json');
  const record = privateRead(filename, checkpointSchema);
  if (sha(readFileSync(filename)) !== pointer.sha256 || record.id !== pointer.id || record.checkpoint_generation !== pointer.checkpoint_generation) stop('INVALID_METADATA', 'Checkpoint pointer identity/hash mismatch');
  if (privateRead(path.join(c.base, 'checkpoint-sequence.json'), counterSchema).value !== record.checkpoint_generation) stop('STALE_CHECKPOINT', 'Checkpoint pointer is older than the durable generation counter');
  return { record, directory };
}
export function writeCheckpoint(repo, token, details) {
  return ownedOperation(repo, token, c => {
    const previous = existsSync(path.join(c.base, 'latest.json')) ? latest(c).record : null;
    const before = snapshot(repo);
    const lastVerified = details.last_verified_source ?? previous?.last_verified_source ?? null;
    if (previous && lastVerified !== previous.last_verified_source) stop('VERIFICATION_CHANGE', 'Checkpointing cannot advance last_verified_source; retained verification must be audited separately');
    if (lastVerified !== null) gitText(repo, ['cat-file', '-e', `${lastVerified}^{commit}`]);
    const budget = details.budget ?? unknownBudget(); validate(budget, budgetSchema);
    const id = randomUUID();
    safeDirectory(path.join(c.base, 'checkpoints'));
    const directory = path.join(c.base, 'checkpoints', id); safeDirectory(directory);
    safeDirectory(path.join(directory, 'files'));
    before.dirty.forEach((entry, index) => {
      const data = contents(c.worktree, entry.path);
      if (['file', 'symlink'].includes(entry.kind)) {
        if (sha(data.bytes) !== entry.sha256) stop('SOURCE_CHANGED', 'Source changed while preserving dirty files');
        preserveFile(path.join(directory, 'files', String(index)), data.bytes);
      }
    });
    const staged = git(repo, ['diff', '--cached', '--binary', 'HEAD']).stdout;
    const unstaged = git(repo, ['diff', '--binary']).stdout;
    preserveFile(path.join(directory, 'staged.patch'), staged);
    preserveFile(path.join(directory, 'unstaged.patch'), unstaged);
    const counter = path.join(c.base, 'checkpoint-sequence.json');
    const generation = (existsSync(counter) ? privateRead(counter, counterSchema).value : 0) + 1;
    const record = { schema_version: 1, id, checkpoint_generation: generation, language_contract: '1.3 / NAJA 2026.1', created_at: new Date().toISOString(), reservation: token, snapshot: before, last_verified_source: lastVerified, task: details.task, completed: details.completed ?? [], checks: details.checks ?? [], artifacts: details.artifacts ?? [], blockers: details.blockers ?? [], unsafe_intermediate_states: details.unsafe_intermediate_states ?? [], next_action: details.next_action, next_commands: details.next_commands, budget, state: details.state ?? 'ready_for_handoff', preservation: { staged_patch_sha256: sha(staged), unstaged_patch_sha256: sha(unstaged) } };
    validate(record, checkpointSchema);
    for (const check of record.checks) if (check.command.length === 0 || (check.result === 'passed' && check.exit_code !== 0)) stop('FALSE_PASS', 'Passed checks require a nonempty command and exit 0');
    if (record.next_commands.length === 0 || record.next_commands.some(command => command.length === 0)) stop('INVALID_CHECKPOINT', 'An exact nonempty resume command is required');
    if (snapshot(repo).fingerprint !== before.fingerprint) stop('SOURCE_CHANGED', 'Source changed before checkpoint publication; WIP and orphan recovery files remain intact');
    if (nextCounter(counter) !== generation) stop('GENERATION_CHANGED', 'Checkpoint generation changed while the mutation guard was held');
    atomicJSON(path.join(directory, 'checkpoint.json'), record, checkpointSchema);
    assertFence(c, token);
    atomicJSON(path.join(c.base, 'latest.json'), { schema_version: 1, id, checkpoint_generation: generation, sha256: sha(readFileSync(path.join(directory, 'checkpoint.json'))) }, pointerSchema);
    return record;
  });
}
export function assessResume(repo, { token, acknowledge_dirty = false, expected_checkpoint = null } = {}) {
  const reasons = [];
  let record;
  try {
    const c = context(repo);
    const item = latest(c); record = item.record;
    if (expected_checkpoint && expected_checkpoint !== record.id) reasons.push('checkpoint_identity_mismatch');
    const held = inspectReservation(repo);
    if (held.held) { if (!token) reasons.push('ownership_requires_transfer'); else { try { assertFence(c, token); } catch { reasons.push('conflicting_owner'); } } }
    if (existsSync(path.join(c.lock, '.operation'))) reasons.push('ownership_operation_busy');
    const actual = snapshot(repo);
    if (actual.head !== record.snapshot.head) reasons.push('source_commit_mismatch');
    if (actual.branch !== record.snapshot.branch || actual.worktree !== record.snapshot.worktree) reasons.push('worktree_or_branch_mismatch');
    if (actual.fingerprint !== record.snapshot.fingerprint) reasons.push('source_or_metadata_changed');
    if (actual.dirty.length && !acknowledge_dirty) reasons.push('dirty_worktree_requires_acknowledgment');
    if (actual.dirty.some(entry => entry.kind === 'directory')) reasons.push('directory_or_submodule_requires_manual_review');
    if (actual.dirty.some(entry => entry.status.includes('U') || ['AA', 'DD'].includes(entry.status))) reasons.push('unmerged_index_requires_manual_review');
    if (actual.upstream) {
      if (actual.upstream !== record.snapshot.upstream) reasons.push('upstream_ref_changed');
      if (Number(gitText(repo, ['rev-list', '--count', 'HEAD..@{upstream}'])) > 0) reasons.push('newer_upstream_commit');
    }
    if (sha(readFileSync(path.join(item.directory, 'staged.patch'))) !== record.preservation.staged_patch_sha256 || sha(readFileSync(path.join(item.directory, 'unstaged.patch'))) !== record.preservation.unstaged_patch_sha256) reasons.push('recovery_patch_hash_mismatch');
    record.snapshot.dirty.forEach((entry, index) => { if (entry.sha256 && sha(readFileSync(path.join(item.directory, 'files', String(index)))) !== entry.sha256) reasons.push('recovery_file_hash_mismatch'); });
  } catch (error) { reasons.push(error.code === 'STALE_CHECKPOINT' ? 'stale_checkpoint' : 'malformed_or_missing_checkpoint'); }
  return { ready: reasons.length === 0, state: reasons.length ? 'blocked_external' : 'ready_for_handoff', reasons, checkpoint: record ?? null, automatic_runner: false, remote_freshness: 'cached-ref-only; manually confirm remote freshness before integration' };
}
export function classifyOutcome(event) {
  const actions = {
    test_failure: ['running', 'fix_tests'], provider_quota: ['waiting_for_quota', 'manual_resume_after_observed_reset'],
    rate_limit: ['waiting_for_quota', 'respect_observed_retry_signal'], context_warning: ['checkpointing', 'checkpoint_then_supported_resume'],
    execution_deadline: ['checkpointing', 'persist_before_deadline'], missing_auth: ['blocked_external', 'owner_authentication_required'],
    provider_unavailable: ['blocked_external', 'manual_authorized_handoff'], cancelled: ['ready_for_handoff', 'manual_resume_required'],
    completed: ['complete', 'task_completed'], unknown: ['blocked_external', 'inspect_unknown_failure'],
  };
  const [state, next_action] = actions[event.kind] ?? actions.unknown;
  const retry = Number.isSafeInteger(event.retry_after_ms) && event.retry_after_ms >= 0 ? event.retry_after_ms : null;
  return { classification: Object.hasOwn(actions, event.kind) ? event.kind : 'unknown', state, next_action, retry_after_ms: retry, budget: event.budget ? validate(event.budget, budgetSchema) : unknownBudget(), automatic_retry: false, automatic_provider_switch: false };
}
