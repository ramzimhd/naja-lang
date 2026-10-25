import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { auditableEvidenceSchema, budgetSchema, checkpointSchema, counterSchema, pointerSchema, reservationSchema, validate, verificationAdvanceSchema, verificationAuditInputSchema, verificationAuditReferenceSchema, verificationAuditSchema } from './schemas.mjs';

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
function checkpointPointer(c) {
  // latest also verifies the immutable checkpoint and durable counter.
  latest(c);
  return privateRead(path.join(c.base, 'latest.json'), pointerSchema);
}
function samePointer(a, b) { return ['id', 'checkpoint_generation', 'sha256'].every(key => a[key] === b[key]); }
function fullCommit(repo, source) {
  if (typeof source !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(source)) stop('INVALID_SOURCE', 'An exact full commit object ID is required');
  if (gitText(repo, ['cat-file', '-t', source]) !== 'commit') stop('INVALID_SOURCE', 'Verification source must be a commit object');
}
function ancestor(repo, older, newer) {
  const result = git(repo, ['merge-base', '--is-ancestor', older, newer], true);
  if (result.error || ![0, 1].includes(result.status)) stop('GIT_FAILED', 'Git ancestry inspection failed');
  if (result.status !== 0) stop('INVALID_SOURCE', 'Verification must advance along existing ancestry to the observed HEAD');
}
function evidenceFile(c, relative, limit) {
  if (typeof relative !== 'string' || !relative.startsWith('reports/checks/') || /[\\:\u0000-\u001f\u007f]/.test(relative) || relative.split('/').some(part => !part || /[. ]$/.test(part) || ['.', '..', '.git'].includes(part.toLowerCase()) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) stop('UNSAFE_EVIDENCE_PATH', 'Evidence must use an ordinary repository-relative reports/checks path');
  const inspect = () => {
    let current = c.worktree;
    const parts = relative.split('/');
    for (let index = 0; index < parts.length; index++) {
      current = path.join(current, parts[index]);
      const info = lstatSync(current);
      if (info.isSymbolicLink() || (index < parts.length - 1 && !info.isDirectory()) || (index === parts.length - 1 && !info.isFile())) stop('UNSAFE_EVIDENCE_PATH', 'Evidence cannot traverse symlinks or special files');
    }
    const resolved = realpathSync(current), within = path.relative(c.worktree, resolved);
    if (within === '' || path.isAbsolute(within) || within.split(path.sep).includes('..')) stop('UNSAFE_EVIDENCE_PATH', 'Evidence resolves outside the repository');
    return { full: current, info: lstatSync(current) };
  };
  const before = inspect();
  if (before.info.size < 1 || before.info.size > limit) stop('EVIDENCE_LIMIT', 'Retained evidence is empty or exceeds the bounded read budget');
  const fd = openSync(before.full, 'r');
  let bytes;
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.dev !== before.info.dev || opened.ino !== before.info.ino || opened.size !== before.info.size) stop('EVIDENCE_CHANGED', 'Evidence identity changed before reading');
    bytes = readFileSync(fd);
    const after = fstatSync(fd);
    if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs || bytes.length !== opened.size) stop('EVIDENCE_CHANGED', 'Evidence changed while reading');
  } finally { closeSync(fd); }
  const after = inspect();
  if (after.info.dev !== before.info.dev || after.info.ino !== before.info.ino || after.info.size !== before.info.size || after.info.mtimeMs !== before.info.mtimeMs || after.info.ctimeMs !== before.info.ctimeMs) stop('EVIDENCE_CHANGED', 'Evidence identity changed after reading');
  return bytes;
}
function auditRecords(c, records, source) {
  if (new Set(records).size !== records.length) stop('INVALID_EVIDENCE', 'Duplicate evidence record paths do not add evidence');
  let total = 0;
  const reportPaths = new Set(records);
  return records.map(filename => {
    if (!filename.endsWith('.json')) stop('INVALID_EVIDENCE', 'Explicit check records must be JSON files');
    const raw = evidenceFile(c, filename, 1024 * 1024);
    const report = validate(JSON.parse(raw.toString('utf8')), auditableEvidenceSchema);
    if (report.commit !== source) stop('EVIDENCE_SOURCE_MISMATCH', 'Every passed report must name the exact audited source');
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(report.timestamp) || !Number.isFinite(Date.parse(report.timestamp))) stop('INVALID_EVIDENCE', 'A recorded report timestamp is required');
    if (reportPaths.has(report.log_path)) stop('INVALID_EVIDENCE', 'Raw logs must be separate from selected JSON records');
    const log = evidenceFile(c, report.log_path, MAX_FILE);
    total += raw.length + log.length;
    if (total > MAX_TOTAL) stop('EVIDENCE_LIMIT', 'The selected evidence set exceeds 128 MiB');
    if (sha(log) !== report.log_sha256) stop('EVIDENCE_HASH_MISMATCH', 'Retained raw log bytes do not match their recorded SHA-256');
    return { path: filename, sha256: sha(raw), report, log_bytes: log.length };
  });
}
function auditableSnapshot(repo, observed, records) {
  const allowed = new Set(records.flatMap(item => [item.path, item.report.log_path]));
  if (observed.dirty.some(entry => !allowed.has(entry.path.replaceAll('\\', '/')) || entry.kind !== 'file' || entry.status.includes('U') || ['AA', 'DD'].includes(entry.status))) stop('SOURCE_UNVERIFIED', 'Current source edits require a separate tested source commit before verification can advance');
  // Status can hide edits behind these flags. Fail closed instead of treating
  // an apparently clean status as a complete source inspection.
  const entries = git(repo, ['ls-files', '--stage', '-v', '-z']).stdout.toString('utf8').split('\0').filter(Boolean);
  if (entries.some(entry => /^[a-zS]/.test(entry) || !/^\S \d+ [0-9a-f]+ 0\t/.test(entry))) stop('SOURCE_UNVERIFIED', 'Hidden index entries or unresolved stages require manual review before auditing');
}
function auditUnchanged(repo, c, token, before, pointer, expectedRecords, source) {
  assertFence(c, token);
  if (!samePointer(checkpointPointer(c), pointer)) stop('STALE_AUDIT', 'The baseline checkpoint changed');
  const records = auditRecords(c, expectedRecords.map(item => item.path), source);
  if (JSON.stringify(records) !== JSON.stringify(expectedRecords)) stop('STALE_AUDIT', 'Selected evidence changed after the audit observation');
  const after = snapshot(repo);
  auditableSnapshot(repo, after, records);
  if (after.fingerprint !== before.fingerprint) stop('STALE_AUDIT', 'Source or repository metadata changed after the audit observation');
}
/** Audits retained report integrity only; never executes a reported command. */
export function recordVerificationAudit(repo, token, input) {
  return ownedOperation(repo, token, c => {
    validate(input, verificationAuditInputSchema);
    if (!existsSync(path.join(c.base, 'latest.json'))) stop('AUDIT_BASELINE_REQUIRED', 'Create a retained-history checkpoint before auditing an advancement');
    const baseline = checkpointPointer(c), previous = latest(c).record;
    const before = snapshot(repo);
    fullCommit(repo, input.source_commit); ancestor(repo, input.source_commit, before.head);
    if (previous.last_verified_source !== null) ancestor(repo, previous.last_verified_source, input.source_commit);
    const records = auditRecords(c, input.records, input.source_commit);
    auditableSnapshot(repo, before, records);
    const id = randomUUID();
    const record = { schema_version: 1, id, contract_revision: '1.3', scope: 'retained-report-integrity-only', created_at: new Date().toISOString(), reservation: token, snapshot: before, source_commit: input.source_commit, baseline_checkpoint: baseline, baseline_last_verified_source: previous.last_verified_source, records, commands_executed: false, automatic_status_changes: false };
    validate(record, verificationAuditSchema);
    auditUnchanged(repo, c, token, before, baseline, records, input.source_commit);
    safeDirectory(path.join(c.base, 'verification-audits'));
    const directory = path.join(c.base, 'verification-audits', id);
    mkdirSync(directory, { mode: 0o700 }); // Exclusive immutable audit identity.
    const filename = path.join(directory, 'audit.json');
    atomicJSON(filename, record, verificationAuditSchema);
    // No pointer is published on a failed final observation. Any orphan record
    // remains private and its embedded snapshot/fence must still match on use.
    auditUnchanged(repo, c, token, before, baseline, records, input.source_commit);
    const reference = { id, sha256: sha(readFileSync(filename)) };
    atomicJSON(path.join(directory, 'complete.json'), reference, verificationAuditReferenceSchema);
    return reference;
  });
}
function authorizeVerificationAdvance(repo, c, token, reference, previous, before, source) {
  validate(reference, verificationAuditReferenceSchema);
  const parent = path.join(c.base, 'verification-audits'), directory = path.join(parent, reference.id);
  if (lstatSync(parent).isSymbolicLink() || lstatSync(directory).isSymbolicLink() || !lstatSync(directory).isDirectory()) stop('INVALID_AUDIT', 'Audit storage must be an ordinary private directory');
  const filename = path.join(directory, 'audit.json'), record = privateRead(filename, verificationAuditSchema);
  if (sha(readFileSync(filename)) !== reference.sha256 || record.id !== reference.id) stop('INVALID_AUDIT', 'Immutable audit identity or hash mismatch');
  const complete = privateRead(path.join(directory, 'complete.json'), verificationAuditReferenceSchema);
  if (complete.id !== reference.id || complete.sha256 !== reference.sha256) stop('INVALID_AUDIT', 'Incomplete or mismatched audit publication');
  if (!sameFence(record.reservation, token)) stop('STALE_AUDIT', 'A verification audit cannot cross reservation identities or fencing generations');
  if (record.source_commit !== source || record.baseline_last_verified_source !== previous.last_verified_source || !samePointer(checkpointPointer(c), record.baseline_checkpoint)) stop('STALE_AUDIT', 'Audit source or checkpoint baseline no longer matches');
  if (record.snapshot.fingerprint !== before.fingerprint || record.snapshot.worktree !== before.worktree) stop('STALE_AUDIT', 'The audit observed a different source/index/HEAD/worktree snapshot');
  fullCommit(repo, source); ancestor(repo, source, before.head);
  if (previous.last_verified_source !== null) ancestor(repo, previous.last_verified_source, source);
  auditUnchanged(repo, c, token, before, record.baseline_checkpoint, record.records, source);
  return record;
}
export function writeCheckpoint(repo, token, details) {
  return ownedOperation(repo, token, c => {
    const previous = existsSync(path.join(c.base, 'latest.json')) ? latest(c).record : null;
    const before = snapshot(repo);
    const lastVerified = details.last_verified_source ?? previous?.last_verified_source ?? null;
    const advancing = previous && lastVerified !== previous.last_verified_source;
    let audit;
    if (advancing) {
      if (!details.verification_audit) stop('VERIFICATION_CHANGE', 'Advancing retained verification requires an explicit matching private evidence audit');
      audit = authorizeVerificationAdvance(repo, c, token, details.verification_audit, previous, before, lastVerified);
    } else if (details.verification_audit !== undefined) stop('VERIFICATION_CHANGE', 'An audit reference is used only for an explicit source advancement');
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
    // Recheck raw evidence and the held fence immediately before publication.
    if (audit) auditUnchanged(repo, c, token, before, audit.baseline_checkpoint, audit.records, lastVerified);
    if (nextCounter(counter) !== generation) stop('GENERATION_CHANGED', 'Checkpoint generation changed while the mutation guard was held');
    atomicJSON(path.join(directory, 'checkpoint.json'), record, checkpointSchema);
    assertFence(c, token);
    const pointer = { schema_version: 1, id, checkpoint_generation: generation, sha256: sha(readFileSync(path.join(directory, 'checkpoint.json'))) };
    if (audit) atomicJSON(path.join(directory, 'verification-audit.json'), { schema_version: 1, checkpoint: pointer, audit: details.verification_audit, source_commit: lastVerified, previous_source: previous.last_verified_source }, verificationAdvanceSchema);
    atomicJSON(path.join(c.base, 'latest.json'), pointer, pointerSchema);
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
