#!/usr/bin/env node
// Planning integrity checks only; no compiler or release acceptance is implied.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const STATUSES = Object.freeze([
  'not_started', 'in_progress', 'implemented', 'verified', 'blocked', 'failed',
]);

// Preserve revision 1.2 obligations while allowing additive, ID-aware migration.
const BASELINE_GROUPS = [
  ['GOV', 6], ['ENV', 6], ['IND', 5], ['CMP', 5], ['SYN', 9],
  ['SEM', 10], ['CLI', 6], ['BE', 5], ['BOOT', 7], ['SYS', 6],
  ['NET', 7], ['IDE', 11], ['EXT', 4], ['QA', 5], ['REL', 5],
  ['INT', 16], ['PERF', 4], ['EN', 6], ['PROD', 16],
];
const pad = number => String(number).padStart(2, '0');
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const arrayOrEmpty = value => Array.isArray(value) ? value : [];
const hashPattern = /^[0-9a-f]{40,64}$/;
const schemaKeywords = new Set([
  '$schema', 'title', 'description', 'type', 'required', 'properties',
  'additionalProperties', 'items', 'minItems', 'enum', 'pattern', 'format',
]);

function repositoryPath(root, value) {
  if (!nonempty(value)) throw new Error('must be a nonempty repository-relative path');
  const normalized = value.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)
      || normalized.split('/').some(part => part === '..' || part === '.')
      || normalized.includes('\0') || normalized.includes(':')) {
    throw new Error('must stay inside the repository without traversal or a drive prefix');
  }
  return path.join(root, ...normalized.split('/'));
}

function scopePath(root, value) {
  const normalized = value?.replaceAll('\\', '/').replace(/\/\*\*$/, '/');
  repositoryPath(root, normalized);
  if (/[?*\[\]{}]/.test(normalized)) throw new Error('only a trailing /** scope is supported');
  return normalized.replace(/\/+$/, '').toLowerCase();
}

function pathOverlaps(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function validTimestamp(value) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/i.exec(value);
  if (!parts) return false;
  const [, year, month, day, hour, minute, second, , offsetHour = '0', offsetMinute = '0'] = parts;
  const y = Number(year);
  const m = Number(month);
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return m >= 1 && m <= 12 && Number(day) >= 1 && Number(day) <= days[m - 1]
    && Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60
    && Number(offsetHour) < 24 && Number(offsetMinute) < 60;
}

function validateSchemaDefinition(schema, location, error) {
  if (!isObject(schema)) {
    error('evidence_schema', `${location} must be a schema object`);
    return;
  }
  for (const key of Object.keys(schema)) {
    if (!schemaKeywords.has(key)) error('evidence_schema', `${location}: unsupported schema keyword ${key}`);
  }
  if (schema.format && schema.format !== 'date-time') error('evidence_schema', `${location}: unsupported format ${schema.format}`);
  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    validateSchemaDefinition(child, `${location}.properties.${key}`, error);
  }
  if (isObject(schema.additionalProperties)) {
    validateSchemaDefinition(schema.additionalProperties, `${location}.additionalProperties`, error);
  }
  if (schema.items) validateSchemaDefinition(schema.items, `${location}.items`, error);
}

// Implements every assertion used by the repository's evidence schema. Fail
// closed if that schema adds an unsupported keyword; this is not general AJV.
function checkSchema(value, schema, location, error) {
  const matchesType = type => ({
    object: isObject(value), array: Array.isArray(value), string: typeof value === 'string',
    integer: Number.isInteger(value), number: typeof value === 'number' && Number.isFinite(value),
    boolean: typeof value === 'boolean', null: value === null,
  })[type] === true;
  if (schema.type && ![schema.type].flat().some(matchesType)) {
    error('evidence_schema', `${location}: expected ${[schema.type].flat().join(' or ')}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) error('evidence_schema', `${location}: invalid enum value`);
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      error('evidence_schema', `${location}: does not match the required pattern`);
    }
    if (schema.format === 'date-time' && !validTimestamp(value)) {
      error('evidence_schema', `${location}: expected a valid RFC 3339 timestamp without a leap second`);
    }
    if (schema.format && schema.format !== 'date-time') {
      error('evidence_schema', `${location}: unsupported format ${schema.format}`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      error('evidence_schema', `${location}: requires at least ${schema.minItems} items`);
    }
    if (schema.items) value.forEach((item, index) => checkSchema(item, schema.items, `${location}[${index}]`, error));
  }
  if (isObject(value)) {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) error('evidence_schema', `${location}: missing ${key}`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (Object.hasOwn(schema.properties ?? {}, key)) {
        checkSchema(child, schema.properties[key], `${location}.${key}`, error);
      } else if (schema.additionalProperties === false) {
        error('evidence_schema', `${location}: unexpected property ${key}`);
      } else if (isObject(schema.additionalProperties)) {
        checkSchema(child, schema.additionalProperties, `${location}.${key}`, error);
      }
    }
  }
}

export function validatePlanning(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const errors = [];
  const error = (code, message) => errors.push({ code, message });
  let realRoot;
  try { realRoot = realpathSync(root); } catch { error('repository', 'repository root does not exist'); }

  function existingFile(value, location) {
    try {
      const filename = repositoryPath(root, value);
      const real = realpathSync(filename);
      const relative = path.relative(realRoot, real);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error('resolved file escapes the repository');
      }
      if (!statSync(real).isFile()) throw new Error('is not a file');
      return real;
    } catch (failure) {
      error('file_reference', `${location}: ${JSON.stringify(value)} ${failure.code === 'ENOENT' ? 'does not exist' : failure.message}`);
      return null;
    }
  }

  function readJson(value, location = value) {
    const filename = existingFile(value, location);
    if (!filename) return null;
    try { return JSON.parse(readFileSync(filename, 'utf8').replace(/^\uFEFF/, '')); }
    catch { error('json', `${location}: invalid JSON`); return null; }
  }

  const requirementsDocument = readJson('planning/requirements.json');
  const tasksDocument = readJson('planning/tasks.json');
  const gatesDocument = readJson('planning/release-gates.json');
  const assignmentsDocument = readJson('planning/assignments.json');
  const state = readJson('planning/state.json');
  const evidenceSchema = readJson('planning/evidence.schema.json');
  const documents = [requirementsDocument, tasksDocument, gatesDocument, assignmentsDocument, state];
  documents.forEach((document, index) => {
    if (!isObject(document) || document.schema_version !== 1) {
      error('document_schema', `planning document ${index + 1} must be an object with schema_version 1`);
    }
  });
  if (evidenceSchema) validateSchemaDefinition(evidenceSchema, 'evidence schema', error);

  function entries(document, key) {
    if (!Array.isArray(document?.[key])) {
      error('document_schema', `${key} must be an array`);
      return [];
    }
    return document[key];
  }
  const requirements = entries(requirementsDocument, 'requirements');
  const tasks = entries(tasksDocument, 'tasks');
  const gates = entries(gatesDocument, 'gates');
  const assignments = entries(assignmentsDocument, 'assignments');

  function indexEntries(items, kind, pattern) {
    const index = new Map();
    items.forEach((item, position) => {
      if (!isObject(item) || !nonempty(item.id) || !pattern.test(item.id)) {
        error('id', `${kind}[${position}] has an invalid ID`);
        return;
      }
      if (index.has(item.id)) error('duplicate_id', `${kind} repeats ${item.id}`);
      else index.set(item.id, item);
      if (!STATUSES.includes(item.status)) error('status', `${item.id} has invalid status ${JSON.stringify(item.status)}`);
      if (!Array.isArray(item.evidence)) error('evidence_reference', `${item.id}.evidence must be an array`);
    });
    return index;
  }
  const requirementIndex = indexEntries(requirements, 'requirements', /^[A-Z][A-Z0-9]*-\d{2,}$/);
  const taskIndex = indexEntries(tasks, 'tasks', /^T\d{2,}$/);
  const gateIndex = indexEntries(gates, 'gates', /^R\d{2,}$/);
  const requireReference = (index, id, location) => {
    if (!index.has(id)) error('missing_reference', `${location} references missing ID ${JSON.stringify(id)}`);
  };

  BASELINE_GROUPS.forEach(([prefix, count], gateNumber) => {
    for (let number = 1; number <= count; number++) {
      const id = `${prefix}-${pad(number)}`;
      const requirement = requirementIndex.get(id);
      if (!requirement || requirement.release_required !== true || requirement.gate !== `R${pad(gateNumber + 1)}`) {
        error('scope', `revision 1.2 mandatory obligation ${id} must remain release_required at R${pad(gateNumber + 1)}`);
      }
    }
  });
  for (let number = 1; number <= 8; number++) {
    if (!requirementIndex.has(`FUT-${pad(number)}`)) error('scope', `revision 1.2 future objective FUT-${pad(number)} is missing`);
  }
  for (let number = 1; number <= 38; number++) requireReference(taskIndex, `T${pad(number)}`, 'revision 1.2 task scope');
  for (let number = 1; number <= 19; number++) requireReference(gateIndex, `R${pad(number)}`, 'revision 1.2 gate scope');

  for (const requirement of requirementIndex.values()) {
    if (typeof requirement.release_required !== 'boolean') error('document_schema', `${requirement.id}.release_required must be boolean`);
    if (requirement.gate !== 'FUTURE' || requirement.release_required) {
      requireReference(gateIndex, requirement.gate, `${requirement.id}.gate`);
    }
    existingFile(requirement.spec, `${requirement.id}.spec`);
  }
  for (const gate of gateIndex.values()) {
    if (!Array.isArray(gate.requirement_ids) || gate.requirement_ids.length === 0) {
      error('document_schema', `${gate.id}.requirement_ids must be a nonempty array`);
      continue;
    }
    if (new Set(gate.requirement_ids).size !== gate.requirement_ids.length) error('duplicate_reference', `${gate.id} repeats a requirement reference`);
    for (const id of gate.requirement_ids) {
      requireReference(requirementIndex, id, `${gate.id}.requirement_ids`);
      if (requirementIndex.has(id) && requirementIndex.get(id).gate !== gate.id) {
        error('gate_mapping', `${gate.id} includes ${id}, whose gate is ${requirementIndex.get(id).gate}`);
      }
    }
  }
  for (const requirement of requirementIndex.values()) {
    if (gateIndex.has(requirement.gate) && !arrayOrEmpty(gateIndex.get(requirement.gate).requirement_ids).includes(requirement.id)) {
      error('gate_mapping', `${requirement.id} is absent from its gate ${requirement.gate}`);
    }
  }
  for (const task of taskIndex.values()) {
    requireReference(requirementIndex, task.primary_requirement, `${task.id}.primary_requirement`);
    if (!/^H[0-9]$/.test(task.milestone)) error('milestone', `${task.id} has invalid milestone`);
    if (!Array.isArray(task.depends_on)) error('document_schema', `${task.id}.depends_on must be an array`);
    else {
      if (new Set(task.depends_on).size !== task.depends_on.length) error('duplicate_reference', `${task.id} repeats a dependency`);
      for (const id of task.depends_on) requireReference(taskIndex, id, `${task.id}.depends_on`);
    }
    if (!Array.isArray(task.planned_paths) || task.planned_paths.length === 0) {
      error('document_schema', `${task.id}.planned_paths must be a nonempty array`);
    } else for (const value of task.planned_paths) {
      try { scopePath(root, value); } catch (failure) { error('path_scope', `${task.id}.planned_paths: ${failure.message}`); }
    }
    for (const field of ['owner', 'branch']) {
      if (task[field] !== null && !nonempty(task[field])) error('document_schema', `${task.id}.${field} must be a nonempty string or null`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(id, chain) {
    if (visiting.has(id)) { error('dependency_cycle', `task dependency cycle: ${[...chain, id].join(' -> ')}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of arrayOrEmpty(taskIndex.get(id)?.depends_on)) if (taskIndex.has(next)) visit(next, [...chain, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of taskIndex.keys()) visit(id, []);

  const activeAssignments = [];
  const assignmentKeys = new Set();
  for (const [position, assignment] of assignments.entries()) {
    const location = `assignments[${position}]`;
    if (!isObject(assignment)) { error('assignment', `${location} must be an object`); continue; }
    requireReference(taskIndex, assignment.task_id, location);
    for (const field of ['owner', 'branch', 'worktree']) {
      if (!nonempty(assignment[field])) error('assignment', `${location}.${field} must be a nonempty string`);
    }
    const key = `${assignment.task_id}:${assignment.owner}`;
    if (assignmentKeys.has(key)) error('assignment', `${location} repeats task/owner ${key}`);
    assignmentKeys.add(key);
    if (!['active', 'completed', 'released', 'expired'].includes(assignment.status ?? 'active')) {
      error('assignment', `${location} has invalid assignment status`);
    }
    const scopes = [];
    if (!Array.isArray(assignment.paths) || assignment.paths.length === 0) error('assignment', `${location}.paths must be nonempty`);
    else for (const value of assignment.paths) {
      try {
        const scope = scopePath(root, value);
        if (scopes.some(previous => pathOverlaps(previous, scope))) error('path_overlap', `${location} contains overlapping scopes`);
        scopes.push(scope);
      } catch (failure) { error('path_scope', `${location}.paths: ${failure.message}`); }
    }
    if ((assignment.status ?? 'active') === 'active') activeAssignments.push({ ...assignment, scopes, location });
  }
  const integrator = assignmentsDocument?.integrator;
  if (integrator !== null && !nonempty(integrator)) error('integrator', 'integrator must be one nonempty identity string or null');
  if ((state?.development_started || activeAssignments.length > 0) && !nonempty(integrator)) {
    error('integrator', 'active development requires exactly one integrator identity');
  }
  for (let left = 0; left < activeAssignments.length; left++) {
    for (let right = left + 1; right < activeAssignments.length; right++) {
      const a = activeAssignments[left];
      const b = activeAssignments[right];
      if (a.owner === b.owner) continue;
      const worktreeOf = assignment => path.resolve(root, typeof assignment.worktree === 'string' ? assignment.worktree : '');
      if (a.branch === b.branch || worktreeOf(a) === worktreeOf(b)) {
        error('assignment_isolation', `${a.location} and ${b.location} share a branch or worktree across owners`);
      }
      for (const first of a.scopes) for (const second of b.scopes) {
        if (pathOverlaps(first, second)) error('path_overlap', `${a.location} and ${b.location} overlap at ${first} / ${second}`);
      }
    }
  }
  if (typeof state?.development_started !== 'boolean') error('state', 'development_started must be boolean');
  if (!/^H[0-9]$/.test(state?.current_gate)) error('state', 'current_gate must be a roadmap milestone H0-H9');
  if (state?.last_verified_commit !== null && !hashPattern.test(state?.last_verified_commit ?? '')) {
    error('state', 'last_verified_commit must be null or a full hexadecimal commit hash');
  }
  if (!Array.isArray(state?.active_tasks)) error('state', 'active_tasks must be an array');
  else {
    if (new Set(state.active_tasks).size !== state.active_tasks.length) error('duplicate_reference', 'active_tasks repeats a task');
    for (const id of state.active_tasks) requireReference(taskIndex, id, 'active_tasks');
  }

  const evidenceCache = new Map();
  function evidenceRecord(reference, location) {
    if (!nonempty(reference)) { error('evidence_reference', `${location} must reference a repository-relative JSON record`); return null; }
    if (evidenceCache.has(reference)) return evidenceCache.get(reference);
    const before = errors.length;
    const record = readJson(reference, location);
    if (record && evidenceSchema) checkSchema(record, evidenceSchema, reference, error);
    if (!isObject(record)) { error('evidence_record', `${location} must reference an evidence object`); evidenceCache.set(reference, null); return null; }
    requireReference(requirementIndex, record.requirement_id, `${reference}.requirement_id`);
    for (const field of ['target', 'commit', 'timestamp']) {
      if (!nonempty(record[field])) error('evidence_record', `${reference}.${field} must be nonempty`);
    }
    if (!Array.isArray(record.command) || record.command.some(value => !nonempty(value))) error('evidence_record', `${reference}.command must contain nonempty command arguments`);
    if (!isObject(record.tool_versions) || Object.keys(record.tool_versions).length === 0
        || Object.values(record.tool_versions).some(value => !nonempty(value))) {
      error('evidence_record', `${reference}.tool_versions must record actual nonempty tool versions`);
    }
    let log;
    if (record.log_path !== null && record.log_path !== undefined) {
      const filename = existingFile(record.log_path, `${reference}.log_path`);
      if (filename) log = readFileSync(filename);
    }
    if (record.log_sha256 !== null && record.log_sha256 !== undefined) {
      if (!/^[0-9a-f]{64}$/.test(record.log_sha256)) error('evidence_hash', `${reference}.log_sha256 must be lowercase SHA-256`);
      else if (!log || createHash('sha256').update(log).digest('hex') !== record.log_sha256) error('evidence_hash', `${reference}: retained log does not match SHA-256`);
    }
    if (record.result === 'passed') {
      if (record.exit_code !== 0) error('false_pass', `${reference}: passed evidence requires exit_code 0`);
      if (!log || log.toString('utf8').trim().length === 0) error('false_pass', `${reference}: passed evidence requires a retained nonempty log`);
    }
    const valid = errors.length === before && evidenceSchema ? record : null;
    evidenceCache.set(reference, valid);
    return valid;
  }
  const evidenceBySubject = new Map();
  for (const subject of [...requirementIndex.values(), ...taskIndex.values(), ...gateIndex.values()]) {
    const records = [];
    for (const reference of Array.isArray(subject.evidence) ? subject.evidence : []) {
      const record = evidenceRecord(reference, `${subject.id}.evidence`);
      if (!record) continue;
      const allowed = requirementIndex.has(subject.id) ? [subject.id]
        : taskIndex.has(subject.id) ? [...requirementIndex.keys()] : arrayOrEmpty(subject.requirement_ids);
      if (!allowed.includes(record.requirement_id)) error('evidence_mismatch', `${subject.id} references evidence for ${record.requirement_id}`);
      else records.push(record);
    }
    evidenceBySubject.set(subject.id, records);
  }
  for (const requirement of requirementIndex.values()) {
    if (requirement.status === 'verified' && !evidenceBySubject.get(requirement.id).some(record => record.result === 'passed')) {
      error('false_verified', `${requirement.id}: verified requires valid passed evidence for that requirement`);
    }
  }
  for (const task of taskIndex.values()) {
    if (task.status === 'verified' && !evidenceBySubject.get(task.id).some(record => record.result === 'passed' && record.requirement_id === task.primary_requirement)) {
      error('false_verified', `${task.id}: verified requires valid passed evidence for its primary requirement`);
    }
  }
  for (const gate of gateIndex.values()) {
    if (gate.status !== 'verified') continue;
    for (const id of arrayOrEmpty(gate.requirement_ids)) {
      const records = [...evidenceBySubject.get(gate.id), ...(evidenceBySubject.get(id) ?? [])];
      if (requirementIndex.get(id)?.status !== 'verified'
          || !records.some(record => record.result === 'passed' && record.requirement_id === id)) {
        error('false_verified', `${gate.id}: verified requires verified ${id} with passed evidence`);
      }
    }
  }

  const countStatuses = items => Object.fromEntries(STATUSES.map(status => [status, items.filter(item => item?.status === status).length]));
  return {
    ok: errors.length === 0,
    errors,
    counts: {
      requirements: requirements.length,
      mandatory: requirements.filter(item => item?.release_required === true).length,
      future: requirements.filter(item => item?.release_required === false).length,
      tasks: tasks.length,
      gates: gates.length,
      evidence_records: evidenceCache.size,
      active_assignments: activeAssignments.length,
    },
    statuses: { requirements: countStatuses(requirements), tasks: countStatuses(tasks), gates: countStatuses(gates) },
    limitations: [
      'Checks planning structure, references and retained evidence consistency; it does not execute recorded commands or establish their honesty.',
      'Evidence commit syntax is checked; Git object existence and release-commit coverage require a separate audit.',
      'Path scopes are coordination metadata, not atomic reservations or a distributed lock.',
      'A successful planning check is not compiler, platform, productivity or HATCH release acceptance.',
    ],
  };
}

export function main(arguments_ = process.argv.slice(2)) {
  let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  let json = false;
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    if (argument === '--json') json = true;
    else if (argument === '--root' && arguments_[index + 1]) root = path.resolve(arguments_[++index]);
    else if (argument === '--help') {
      process.stdout.write('Usage: node scripts/validation/check-planning.mjs [--root DIRECTORY] [--json]\nChecks planning/evidence integrity only; does not verify the compiler or HATCH acceptance.\n');
      return 0;
    } else {
      process.stderr.write(`Unknown or incomplete argument: ${argument}\n`);
      return 2;
    }
  }
  const result = validatePlanning(root);
  if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    process.stdout.write(`Planning integrity: ${result.ok ? 'PASS' : 'FAIL'}\n`);
    const count = result.counts;
    process.stdout.write(`Scope: ${count.requirements} requirements (${count.mandatory} mandatory, ${count.future} future), ${count.tasks} tasks, ${count.gates} gates.\n`);
    process.stdout.write(`Verified statuses: ${result.statuses.requirements.verified} requirements, ${result.statuses.tasks.verified} tasks, ${result.statuses.gates.verified} gates.\n`);
    for (const issue of result.errors) process.stdout.write(`[${issue.code}] ${issue.message}\n`);
    process.stdout.write('This result does not establish compiler behavior or HATCH release acceptance.\n');
  }
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main();
}
