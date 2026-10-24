import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validatePlanning } from '../../scripts/validation/check-planning.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const checker = path.join(sourceRoot, 'scripts/validation/check-planning.mjs');

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'naja-planning-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(path.join(sourceRoot, 'planning'), path.join(root, 'planning'), { recursive: true });
  cpSync(path.join(sourceRoot, 'docs'), path.join(root, 'docs'), { recursive: true });
  // Mutation fixtures always start from the unchanged specification statuses,
  // regardless of legitimate progress in the integration branch.
  for (const [name, key] of [['requirements', 'requirements'], ['tasks', 'tasks'], ['release-gates', 'gates']]) {
    edit(root, name, document => {
      for (const entry of document[key]) { entry.status = 'not_started'; entry.evidence = []; }
      if (key === 'tasks') for (const entry of document[key]) { entry.owner = null; entry.branch = null; }
    });
  }
  edit(root, 'assignments', document => { document.integrator = null; document.assignments = []; });
  edit(root, 'state', document => {
    document.development_started = false;
    document.current_gate = 'H0';
    document.last_verified_commit = null;
    document.active_tasks = [];
  });
  return root;
}

function edit(root, name, mutate) {
  const filename = path.join(root, 'planning', `${name}.json`);
  const document = JSON.parse(readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
  mutate(document);
  writeFileSync(filename, `${JSON.stringify(document, null, 2)}\n`);
}

function rejects(root, code) {
  const result = validatePlanning(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === code), JSON.stringify(result.errors));
  return result;
}

function evidence(root, requirementId = 'GOV-01', mutate = () => {}) {
  const relative = `reports/evidence/${requirementId}.json`;
  const logPath = `reports/evidence/${requirementId}.log`;
  const log = Buffer.from('Synthetic mutation-test log only; not project acceptance evidence.\n');
  const record = {
    requirement_id: requirementId,
    commit: 'a'.repeat(40),
    target: 'synthetic-unit-test-fixture',
    command: ['node', 'synthetic-fixture-command.mjs'],
    tool_versions: { node: 'synthetic-fixture-version' },
    exit_code: 0,
    result: 'passed',
    timestamp: '2026-10-24T12:00:00Z',
    log_path: logPath,
    log_sha256: createHash('sha256').update(log).digest('hex'),
    limitations: ['Synthetic data validates the checker; it proves no NAJA capability.'],
  };
  mutate(record);
  mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
  writeFileSync(path.join(root, logPath), log);
  writeFileSync(path.join(root, relative), JSON.stringify(record));
  return relative;
}

function verifiedRequirement(root, id, reference) {
  edit(root, 'requirements', document => {
    const requirement = document.requirements.find(item => item.id === id);
    requirement.status = 'verified';
    requirement.evidence = [reference];
  });
}

function assignment(owner, branch, worktree, paths, taskId = 'T04') {
  return { task_id: taskId, owner, branch, worktree, paths, status: 'active' };
}

test('baseline reports the actual scope and no fabricated verification', t => {
  const result = validatePlanning(fixture(t));
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.counts, {
    requirements: 147, mandatory: 139, future: 8, tasks: 38, gates: 19,
    evidence_records: 0, active_assignments: 0,
  });
  assert.equal(result.statuses.requirements.verified, 0);
  assert.equal(result.statuses.tasks.verified, 0);
  assert.equal(result.statuses.gates.verified, 0);
});

for (const [filename, key] of [['requirements', 'requirements'], ['tasks', 'tasks'], ['release-gates', 'gates']]) {
  test(`rejects duplicate IDs in ${filename}`, t => {
    const root = fixture(t);
    edit(root, filename, document => document[key].push(structuredClone(document[key][0])));
    rejects(root, 'duplicate_id');
  });
}

test('rejects an unknown implementation status', t => {
  const root = fixture(t);
  edit(root, 'tasks', document => { document.tasks[0].status = 'done'; });
  rejects(root, 'status');
});

test('rejects missing task dependencies and primary requirements', t => {
  const root = fixture(t);
  edit(root, 'tasks', document => {
    document.tasks[0].depends_on = ['T999'];
    document.tasks[0].primary_requirement = 'MISSING-01';
  });
  assert.equal(rejects(root, 'missing_reference').errors.filter(error => error.code === 'missing_reference').length, 2);
});

test('rejects direct and indirect dependency cycles', t => {
  const root = fixture(t);
  edit(root, 'tasks', document => { document.tasks[0].depends_on = ['T04']; });
  rejects(root, 'dependency_cycle');
  edit(root, 'tasks', document => { document.tasks[0].depends_on = ['T01']; });
  rejects(root, 'dependency_cycle');
});

test('rejects missing gates and mismatched bidirectional requirement mappings', t => {
  const root = fixture(t);
  edit(root, 'requirements', document => { document.requirements[0].gate = 'R99'; });
  rejects(root, 'missing_reference');
  rejects(root, 'gate_mapping');
});

test('rejects missing gate requirements and duplicate references', t => {
  const root = fixture(t);
  edit(root, 'release-gates', document => { document.gates[0].requirement_ids = ['GOV-01', 'GOV-01', 'MISSING-01']; });
  rejects(root, 'missing_reference');
  rejects(root, 'duplicate_reference');
  rejects(root, 'gate_mapping');
});

test('rejects removing an obligation or reclassifying mandatory scope', t => {
  const root = fixture(t);
  edit(root, 'requirements', document => { document.requirements[0].release_required = false; });
  rejects(root, 'scope');
  edit(root, 'requirements', document => { document.requirements.shift(); });
  rejects(root, 'scope');
});

test('permits additive IDs without resetting earlier scope', t => {
  const root = fixture(t);
  edit(root, 'requirements', document => document.requirements.push({
    ...structuredClone(document.requirements[0]), id: 'GOV-07', title: 'Additional owner obligation',
  }));
  edit(root, 'release-gates', document => document.gates[0].requirement_ids.push('GOV-07'));
  const result = validatePlanning(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.counts.mandatory, 140);
});

test('rejects missing specification files and malformed planning JSON', t => {
  const root = fixture(t);
  edit(root, 'requirements', document => { document.requirements[0].spec = 'docs/missing.md'; });
  rejects(root, 'file_reference');
  writeFileSync(path.join(root, 'planning/tasks.json'), '{');
  rejects(root, 'json');
});

test('rejects active development without exactly one integrator', t => {
  const root = fixture(t);
  edit(root, 'state', document => { document.development_started = true; });
  rejects(root, 'integrator');
  edit(root, 'assignments', document => { document.integrator = ['agent-a', 'agent-b']; });
  rejects(root, 'integrator');
});

test('permits distinct confirmed paths for contributors on the same task', t => {
  const root = fixture(t);
  edit(root, 'state', document => { document.development_started = true; document.active_tasks = ['T04']; });
  edit(root, 'tasks', document => { document.tasks.find(task => task.id === 'T04').status = 'in_progress'; });
  edit(root, 'assignments', document => {
    document.integrator = '/root';
    document.assignments = [
      assignment('/root', 'main', '.', ['planning/']),
      assignment('/root/validator', 'agent/validator', '../naja-worktrees/validator', ['scripts/validation/**', 'tests/planning/']),
    ];
  });
  const result = validatePlanning(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.counts.active_assignments, 2);
});

test('rejects cross-owner path overlap including case differences and parent scopes', t => {
  const root = fixture(t);
  edit(root, 'assignments', document => {
    document.integrator = 'agent-a';
    document.assignments = [
      assignment('agent-a', 'branch-a', '../worktree-a', ['scripts/']),
      assignment('agent-b', 'branch-b', '../worktree-b', ['Scripts/validation/']),
    ];
  });
  rejects(root, 'path_overlap');
});

test('does not confuse adjacent directories with overlapping scopes', t => {
  const root = fixture(t);
  edit(root, 'assignments', document => {
    document.integrator = 'agent-a';
    document.assignments = [
      assignment('agent-a', 'branch-a', '../worktree-a', ['scripts/dev/']),
      assignment('agent-b', 'branch-b', '../worktree-b', ['scripts/development/']),
    ];
  });
  assert.equal(validatePlanning(root).ok, true);
});

test('rejects shared branches or worktrees across active owners', t => {
  const root = fixture(t);
  edit(root, 'assignments', document => {
    document.integrator = 'agent-a';
    document.assignments = [
      assignment('agent-a', 'same-branch', '../worktree-a', ['scripts/dev/']),
      assignment('agent-b', 'same-branch', '../worktree-b', ['scripts/validation/']),
    ];
  });
  rejects(root, 'assignment_isolation');
  edit(root, 'assignments', document => {
    document.assignments[1].branch = 'branch-b';
    document.assignments[1].worktree = '../worktree-a';
  });
  rejects(root, 'assignment_isolation');
});

test('completed assignments do not reserve active paths', t => {
  const root = fixture(t);
  edit(root, 'assignments', document => {
    document.integrator = 'agent-a';
    document.assignments = [
      { ...assignment('agent-a', 'branch-a', '../worktree-a', ['scripts/']), status: 'completed' },
      assignment('agent-b', 'branch-b', '../worktree-b', ['scripts/validation/']),
    ];
  });
  assert.equal(validatePlanning(root).ok, true);
});

test('rejects path traversal and unsupported ownership globs', t => {
  const root = fixture(t);
  edit(root, 'assignments', document => {
    document.integrator = 'agent-a';
    document.assignments = [assignment('agent-a', 'branch-a', '../worktree-a', ['../outside', 'scripts/*/'])];
  });
  rejects(root, 'path_scope');
});

test('rejects missing active tasks and malformed collection values without crashing', t => {
  const root = fixture(t);
  edit(root, 'state', document => { document.active_tasks = ['T999']; });
  rejects(root, 'missing_reference');
  edit(root, 'tasks', document => { document.tasks[0].depends_on = {}; });
  edit(root, 'release-gates', document => { document.gates[0].requirement_ids = {}; document.gates[0].status = 'verified'; });
  rejects(root, 'document_schema');
});

test('rejects verified requirements, tasks and gates without passed evidence', t => {
  const root = fixture(t);
  edit(root, 'requirements', document => { document.requirements[0].status = 'verified'; });
  edit(root, 'tasks', document => { document.tasks[0].status = 'verified'; });
  edit(root, 'release-gates', document => { document.gates[0].status = 'verified'; });
  const result = rejects(root, 'false_verified');
  assert.ok(result.errors.filter(error => error.code === 'false_verified').length >= 3);
});

test('implemented status does not claim verification or require invented evidence', t => {
  const root = fixture(t);
  edit(root, 'tasks', document => { document.tasks[0].status = 'implemented'; });
  const result = validatePlanning(root);
  assert.equal(result.ok, true);
  assert.equal(result.statuses.tasks.implemented, 1);
  assert.equal(result.statuses.tasks.verified, 0);
});

test('rejects missing evidence records even for an unverified subject', t => {
  const root = fixture(t);
  edit(root, 'requirements', document => { document.requirements[0].evidence = ['reports/missing.json']; });
  rejects(root, 'file_reference');
});

test('valid retained passed evidence supports a matching verified requirement and task', t => {
  const root = fixture(t);
  const reference = evidence(root);
  verifiedRequirement(root, 'GOV-01', reference);
  edit(root, 'tasks', document => {
    const task = document.tasks.find(item => item.id === 'T03');
    task.status = 'verified';
    task.evidence = [reference];
  });
  const result = validatePlanning(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.counts.evidence_records, 1);
  assert.equal(result.statuses.requirements.verified, 1);
});

test('failed and not_run records are retained but do not establish verified status', t => {
  for (const result of ['failed', 'not_run', 'blocked']) {
    const root = fixture(t);
    const reference = evidence(root, 'GOV-01', record => {
      record.result = result;
      record.exit_code = result === 'failed' ? 1 : null;
      record.log_path = null;
      record.log_sha256 = null;
    });
    verifiedRequirement(root, 'GOV-01', reference);
    rejects(root, 'false_verified');
    edit(root, 'requirements', document => { document.requirements[0].status = 'blocked'; });
    assert.equal(validatePlanning(root).ok, true);
  }
});

test('rejects a passed record with a nonzero exit or no retained log', t => {
  const root = fixture(t);
  const reference = evidence(root, 'GOV-01', record => { record.exit_code = 1; });
  verifiedRequirement(root, 'GOV-01', reference);
  rejects(root, 'false_pass');
  rejects(root, 'false_verified');
  evidence(root, 'GOV-01', record => { record.log_path = null; record.log_sha256 = null; });
  rejects(root, 'false_pass');
});

test('rejects a tampered or empty retained log', t => {
  const root = fixture(t);
  verifiedRequirement(root, 'GOV-01', evidence(root));
  writeFileSync(path.join(root, 'reports/evidence/GOV-01.log'), 'tampered\n');
  rejects(root, 'evidence_hash');
  writeFileSync(path.join(root, 'reports/evidence/GOV-01.log'), '');
  rejects(root, 'false_pass');
});

test('rejects evidence for a different requirement or task primary requirement', t => {
  const root = fixture(t);
  const reference = evidence(root, 'GOV-02');
  verifiedRequirement(root, 'GOV-01', reference);
  rejects(root, 'evidence_mismatch');
  edit(root, 'requirements', document => { document.requirements[0].status = 'not_started'; document.requirements[0].evidence = []; });
  edit(root, 'tasks', document => { document.tasks[0].status = 'verified'; document.tasks[0].evidence = [reference]; });
  rejects(root, 'false_verified');
});

test('honors evidence schema required fields, types and additionalProperties false', t => {
  const root = fixture(t);
  verifiedRequirement(root, 'GOV-01', evidence(root, 'GOV-01', record => {
    delete record.limitations;
    record.command = 'node synthetic-fixture-command.mjs';
    record.unapproved_field = true;
  }));
  const result = rejects(root, 'evidence_schema');
  assert.ok(result.errors.filter(error => error.code === 'evidence_schema').length >= 3);
});

test('fails closed when evidence schema adds unsupported constraints', t => {
  const root = fixture(t);
  edit(root, 'evidence.schema', schema => { schema.allOf = []; });
  rejects(root, 'evidence_schema');
});

test('rejects impossible calendar dates rather than normalizing them into another month', t => {
  const root = fixture(t);
  verifiedRequirement(root, 'GOV-01', evidence(root, 'GOV-01', record => { record.timestamp = '2026-02-31T12:00:00Z'; }));
  rejects(root, 'evidence_schema');
  evidence(root, 'GOV-01', record => { record.timestamp = '2024-02-29T12:00:00-04:00'; });
  assert.equal(validatePlanning(root).ok, true);
});

test('a verified gate needs passed evidence for every verified mapped requirement', t => {
  const root = fixture(t);
  for (let number = 1; number <= 6; number++) {
    const id = `GOV-${String(number).padStart(2, '0')}`;
    verifiedRequirement(root, id, evidence(root, id));
  }
  edit(root, 'release-gates', document => { document.gates[0].status = 'verified'; });
  assert.equal(validatePlanning(root).ok, true);
  edit(root, 'requirements', document => { document.requirements[5].status = 'implemented'; });
  rejects(root, 'false_verified');
});

test('CLI returns distinct success, validation failure and usage error exits', t => {
  const root = fixture(t);
  const run = arguments_ => spawnSync(process.execPath, [checker, ...arguments_], { encoding: 'utf8' });
  const passed = run(['--root', root, '--json']);
  assert.equal(passed.status, 0, passed.stderr);
  assert.equal(JSON.parse(passed.stdout).counts.mandatory, 139);
  edit(root, 'tasks', document => { document.tasks[0].depends_on = ['T01']; });
  const failed = run(['--root', root]);
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /dependency_cycle/);
  assert.match(failed.stdout, /does not establish compiler behavior/);
  assert.equal(run(['--unknown']).status, 2);
});
