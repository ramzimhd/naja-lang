import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateFoundations } from '../../scripts/validation/check-foundations.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'naja-foundation-tests-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of ['planning', 'docs', 'compatibility', 'reports']) {
    fs.cpSync(path.join(source, directory), path.join(root, directory), { recursive: true });
  }
  return root;
}
function edit(root, name, mutation) {
  const filename = path.join(root, 'planning', `${name}.json`);
  const document = JSON.parse(fs.readFileSync(filename, 'utf8'));
  mutation(document);
  fs.writeFileSync(filename, `${JSON.stringify(document, null, 2)}\n`);
}
function rejected(root, code) {
  const result = validateFoundations(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(issue => issue.code === code), JSON.stringify(result.errors));
  return result;
}
function syntheticEvidence(root, subject, group, kind, mutation = () => {}) {
  const folder = 'tests/synthetic-evidence';
  fs.mkdirSync(path.join(root, folder), { recursive: true });
  const base = `${folder}/${subject}-${group}-${kind}`;
  const log = Buffer.from('SYNTHETIC metadata-validator unit test only; no NAJA feature was executed.\n');
  const record = {
    subject_id: subject, test_group: group, kind, contract_revision: '1.3',
    source_commit: 'a'.repeat(40), dirty_tree_sha256: null,
    host: 'synthetic-host', target: 'synthetic-target',
    command: ['node', 'synthetic-unit-test-only.mjs'], tool_versions: { node: 'synthetic-fixture' },
    exit_code: 0, result: 'passed', timestamp: '2026-10-25T12:00:00Z',
    log_path: `${base}.log`, log_sha256: crypto.createHash('sha256').update(log).digest('hex'),
    limitations: ['This is not feature, FC1 or HATCH evidence.'],
  };
  if (kind === 'defect_injection') record.defect_injection = {
    defect_id: 'SYNTHETIC-DEFECT', mutant_source_sha256: 'b'.repeat(64),
    control_result: 'passed', mutant_result: 'failed', mutant_exit_code: 1, detected: true,
  };
  mutation(record);
  fs.writeFileSync(path.join(root, `${base}.log`), log);
  fs.writeFileSync(path.join(root, `${base}.json`), JSON.stringify(record));
  return `${base}.json`;
}
function verifyFeature(root, mutation = () => {}) {
  edit(root, 'foundations', document => {
    const feature = document.features.find(row => row.id === 'L02');
    feature.status = 'verified'; feature.result = 'passed'; feature.implementation_stage = 'verified';
    feature.evidence = feature.test_groups.flatMap(group => ['positive', 'negative', 'defect_injection'].map(kind => syntheticEvidence(root, feature.id, group, kind, record => mutation(record, kind))));
  });
}

test('initial contracts preserve inherited denominators and make no new progress claim', t => {
  const root = fixture(t);
  const result = validateFoundations(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.verified, { foundations: 0, continuity: 0, fc1_checks: 0 });
  assert.deepEqual(Object.fromEntries(['requirements', 'mandatory', 'future', 'tasks', 'gates'].map(key => [key, result.counts.inherited[key]])), { requirements: 147, mandatory: 139, future: 8, tasks: 38, gates: 19 });
  assert.equal(result.counts.foundations, 15);
  assert.equal(result.counts.continuity, 7);
  assert.equal(result.counts.fc1_checks, 12);
  const documents = ['foundations', 'fc1', 'contract-migration'].map(name => JSON.parse(fs.readFileSync(path.join(root, 'planning', `${name}.json`))));
  for (const document of documents) { assert.equal(document.status, 'open'); assert.equal(document.result, 'not_run'); }
  for (const row of [...documents[0].features, ...documents[0].test_groups, ...documents[0].expansions, ...documents[1].checks, ...documents[2].continuity_contracts, ...documents[2].migrations]) {
    assert.equal(row.status, 'open'); assert.equal(row.result, 'not_run'); assert.deepEqual(row.evidence, []);
  }
});

test('rejects missing stable features, continuity requirements and FC1 checks', t => {
  for (const [name, collection] of [['foundations', 'features'], ['fc1', 'checks'], ['contract-migration', 'continuity_contracts']]) {
    const root = fixture(t);
    edit(root, name, document => document[collection].pop());
    rejected(root, 'scope');
  }
});

test('rejects duplicate feature IDs and unknown schema fields', t => {
  const root = fixture(t);
  edit(root, 'foundations', document => { document.features.push(structuredClone(document.features[0])); document.features[0].future = true; });
  rejected(root, 'duplicate');
  rejected(root, 'schema');
});

test('rejects unknown stable contract IDs', t => {
  const root = fixture(t);
  edit(root, 'foundations', document => document.features.push({ ...structuredClone(document.features[0]), id: 'L99' }));
  rejected(root, 'id');
});

test('rejects mandatory foundations reclassified as future/optional', t => {
  const root = fixture(t);
  edit(root, 'foundations', document => { document.features[1].hatch_required = false; });
  rejected(root, 'scope');
});

test('rejects deleting or relabeling an inherited/foundational reflection', t => {
  const root = fixture(t);
  edit(root, 'foundations', document => { document.features[1].reflections[0].classification = 'named_expansion'; document.features[1].reflections[0].hatch_required = false; document.features[1].reflections[0].expansion_id = 'X03'; });
  rejected(root, 'scope');
  edit(root, 'foundations', document => { document.features[1].reflections.shift(); });
  rejected(root, 'scope');
});

test('rejects removing a mandatory test group globally or from its feature mapping', t => {
  const root = fixture(t);
  edit(root, 'foundations', document => { document.features[1].test_groups = ['TG-CELLS-RELEASE']; });
  rejected(root, 'mandatory_group');
  edit(root, 'foundations', document => { document.test_groups = document.test_groups.filter(group => group.id !== 'TG-BLOCKS'); });
  rejected(root, 'scope');
});

test('rejects groups without positive, negative or injected-defect acceptance', t => {
  const root = fixture(t);
  edit(root, 'foundations', document => { document.test_groups[0].negative_boundaries = []; document.test_groups[0].defect_injection_required = false; });
  rejected(root, 'schema');
  rejected(root, 'scope');
});

test('rejects missing inherited, FC1 and group references', t => {
  const root = fixture(t);
  edit(root, 'foundations', document => { document.features[0].inherited_requirement_ids = ['MISSING-01']; document.features[0].fc1_checks = ['FC1-99']; document.features[0].test_groups = ['TG-NONEXISTENT']; });
  rejected(root, 'reference');
});

test('rejects mismatched bidirectional FC1 mappings', t => {
  const root = fixture(t);
  edit(root, 'foundations', document => { document.features[1].fc1_checks = []; });
  rejected(root, 'mapping');
});

test('rejects substituting an unrelated valid group for required FC1 coverage', t => {
  const root = fixture(t);
  edit(root, 'fc1', document => { document.checks.find(row => row.id === 'FC1-03').test_groups = ['TG-OBJECTS']; });
  rejected(root, 'mandatory_group');
});

test('rejects named expansions that erase their required foundation links', t => {
  const root = fixture(t);
  edit(root, 'foundations', document => { document.expansions[0].foundation_feature_ids = []; document.expansions[0].reason = ''; });
  rejected(root, 'expansion');
  rejected(root, 'schema');
});

test('rejects FC1 being used to waive HATCH scope', t => {
  const root = fixture(t);
  edit(root, 'fc1', document => { document.hatch_completion = true; document.checks[0].hatch_gate_waiver = true; document.checks[0].required_for_fc1 = false; });
  rejected(root, 'scope');
});

test('rejects changed inherited scope and loss of retained 1.2 evidence', t => {
  const root = fixture(t);
  edit(root, 'requirements', document => { document.requirements.find(row => row.id === 'CMP-02').evidence = []; });
  rejected(root, 'evidence_erasure');
  edit(root, 'contract-migration', document => { document.inherited_counts.mandatory = 138; });
  rejected(root, 'scope');
});

test('rejects migration mappings that skip reasons or disagree with the feature', t => {
  const root = fixture(t);
  edit(root, 'contract-migration', document => { document.migrations[0].reason = ''; document.migrations[0].revalidation_required = false; document.migrations[0].inherited_requirement_ids = ['SEM-01']; });
  rejected(root, 'migration'); rejected(root, 'mapping');
});

test('rejects erasing the separately pinned .py production inventory', t => {
  const root = fixture(t);
  const filename = path.join(root, 'compatibility/productions.json');
  const document = JSON.parse(fs.readFileSync(filename)); document.productions.pop();
  fs.writeFileSync(filename, JSON.stringify(document));
  rejected(root, 'compatibility');
});

test('rejects replacing matching compatibility snapshot and inventory IDs together', t => {
  const root = fixture(t);
  edit(root, 'contract-migration', document => { document.compatibility_preservation.production_ids[0] = 'invented_rule'; });
  const filename = path.join(root, 'compatibility/productions.json');
  const document = JSON.parse(fs.readFileSync(filename)); document.productions[0].id = 'invented_rule';
  fs.writeFileSync(filename, JSON.stringify(document));
  rejected(root, 'compatibility');
});

test('rejects invalid progress stages and false green without actual matching records', t => {
  const root = fixture(t);
  edit(root, 'foundations', document => { document.features[0].implementation_stage = 'done'; document.features[0].status = 'verified'; document.features[0].result = 'passed'; });
  rejected(root, 'stage'); rejected(root, 'false_green');
});

test('rejects overall FC1 success while any acceptance check remains open', t => {
  const root = fixture(t);
  edit(root, 'fc1', document => { document.status = 'verified'; document.result = 'passed'; });
  rejected(root, 'false_green');
});

test('synthetic consistent evidence exercises structural acceptance only', t => {
  const root = fixture(t); verifyFeature(root);
  const result = validateFoundations(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.verified.foundations, 1);
  assert.match(result.limits[0], /does not execute feature tests/);
});

test('rejects injected feature defects whose mutant tests remain green', t => {
  const root = fixture(t);
  verifyFeature(root, (record, kind) => { if (kind === 'defect_injection') { record.defect_injection.mutant_result = 'passed'; record.defect_injection.mutant_exit_code = 0; } });
  rejected(root, 'defect_not_detected'); rejected(root, 'false_green');
});

test('rejects claimed defect detection without the positive control or mutant identity', t => {
  const root = fixture(t);
  verifyFeature(root, (record, kind) => { if (kind === 'defect_injection') { record.defect_injection.control_result = 'failed'; record.defect_injection.mutant_source_sha256 = null; } });
  rejected(root, 'defect_not_detected');
});

test('rejects evidence from another contract, subject or group', t => {
  const root = fixture(t);
  verifyFeature(root, record => { record.contract_revision = '1.2'; record.subject_id = 'L03'; });
  rejected(root, 'evidence_scope'); rejected(root, 'false_green');
});

test('rejects partial coverage and mixing tested source identities', t => {
  const root = fixture(t); verifyFeature(root);
  edit(root, 'foundations', document => { document.features[1].evidence.pop(); });
  rejected(root, 'false_green');
  verifyFeature(root, (record, kind) => { if (kind === 'negative') record.source_commit = 'c'.repeat(40); });
  rejected(root, 'false_green');
});

test('rejects a passed record with nonzero exit or tampered retained bytes', t => {
  const root = fixture(t); verifyFeature(root, record => { record.exit_code = 1; });
  rejected(root, 'false_green');
  verifyFeature(root);
  fs.appendFileSync(path.join(root, 'tests/synthetic-evidence/L02-TG-BLOCKS-positive.log'), 'tampered\n');
  rejected(root, 'evidence_log');
});

test('rejects missing evidence files and incomplete source identities', t => {
  const root = fixture(t);
  edit(root, 'foundations', document => { document.features[0].evidence = ['reports/missing-record.json']; });
  rejected(root, 'file');
  verifyFeature(root, record => { record.source_commit = 'a'.repeat(41); });
  rejected(root, 'evidence_source');
});

test('CLI distinguishes structural success from acceptance and rejects invalid options', t => {
  const root = fixture(t);
  const checker = path.join(source, 'scripts/validation/check-foundations.mjs');
  const run = args => spawnSync(process.execPath, [checker, ...args], { encoding: 'utf8' });
  const passed = run(['--root', root]);
  assert.equal(passed.status, 0, passed.stderr);
  assert.match(passed.stdout, /does not establish executable feature/);
  edit(root, 'fc1', document => { document.checks.shift(); });
  assert.equal(run(['--root', root]).status, 1);
  assert.equal(run(['--unknown']).status, 2);
  assert.equal(run(['--help']).status, 0);
});
