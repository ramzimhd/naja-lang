#!/usr/bin/env node
// Contract traceability checks do not execute or verify language features.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validatePlanning } from './check-planning.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const array = value => Array.isArray(value) ? value : [];
const ids = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(2, '0')}`);
const statuses = ['open', 'in_progress', 'implemented', 'verified', 'blocked', 'failed'];
const results = ['not_run', 'passed', 'blocked', 'failed'];
const stages = ['not_implemented', 'parsed', 'semantically_supported', 'generated', 'executed', 'verified'];
const hash = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const sha256 = /^[0-9a-f]{64}$/;
// The inherited Python 3.15.0 identifier set is a fixed compatibility obligation.
const pythonProductionIdDigest = '39112660f4e9dec3ce26b4719f145df2ee17cd69eaedd62f8149bd265ea0a847';
const featureIds = ids('L', 15);
const continuityIds = ids('C', 7);
const fc1Ids = ids('FC1-', 12);
const expansionIds = ids('X', 13);
const reflectionCounts = [3, 4, 3, 3, 2, 3, 3, 4, 4, 3, 4, 4, 4, 3, 4];
const requiredGroups = [
  'TG-IDENTITY', 'TG-BLOCKS', 'TG-ALIASES', 'TG-OBJECTS',
  'TG-LITERALS-RELATIONS', 'TG-SMART-VALUES', 'TG-ORGANIZATION',
  'TG-CONVERSIONS', 'TG-NUMERICAL-DATA', 'TG-CONCURRENCY-EVENTS',
  'TG-CELLS-RELEASE', 'TG-COMPILER-TRUST', 'TG-RECOVERY',
  'TG-TOOLING', 'TG-INSTALL', 'TG-DOMAINS',
];
const featureGroupContract = [
  ['TG-IDENTITY', 'TG-TOOLING'], ['TG-BLOCKS', 'TG-CELLS-RELEASE'],
  ['TG-ALIASES', 'TG-TOOLING'], ['TG-OBJECTS', 'TG-COMPILER-TRUST'],
  ['TG-ORGANIZATION', 'TG-TOOLING'], ['TG-ORGANIZATION'],
  ['TG-LITERALS-RELATIONS'], ['TG-LITERALS-RELATIONS', 'TG-CONVERSIONS'],
  ['TG-SMART-VALUES'], ['TG-SMART-VALUES'],
  ['TG-CONVERSIONS', 'TG-NUMERICAL-DATA'], ['TG-NUMERICAL-DATA', 'TG-COMPILER-TRUST'],
  ['TG-CONCURRENCY-EVENTS'], ['TG-DOMAINS', 'TG-CONCURRENCY-EVENTS'],
  ['TG-COMPILER-TRUST', 'TG-TOOLING'],
];
const featureFc1Contract = [
  ['FC1-01', 'FC1-04', 'FC1-10', 'FC1-12'], ['FC1-03', 'FC1-11'],
  ['FC1-04'], ['FC1-02'], ['FC1-07'], ['FC1-07'], ['FC1-05'],
  ['FC1-05'], ['FC1-06'], ['FC1-06'], ['FC1-02', 'FC1-08'],
  ['FC1-08'], ['FC1-09'], [], ['FC1-04', 'FC1-10', 'FC1-12'],
];
const fc1GroupContract = [
  ['TG-INSTALL'], ['TG-OBJECTS', 'TG-CONVERSIONS'], ['TG-BLOCKS'],
  ['TG-ALIASES', 'TG-TOOLING'], ['TG-LITERALS-RELATIONS'], ['TG-SMART-VALUES'],
  ['TG-ORGANIZATION'], ['TG-CONVERSIONS', 'TG-NUMERICAL-DATA'],
  ['TG-CONCURRENCY-EVENTS'], ['TG-TOOLING', 'TG-INSTALL'],
  ['TG-CELLS-RELEASE'], ['TG-INSTALL', 'TG-RECOVERY'],
];
const common = ['status', 'result', 'evidence'];

export function validateFoundations(directory) {
  const root = path.resolve(directory);
  const errors = [];
  const fail = (code, message) => errors.push({ code, message });
  const inherited = validatePlanning(root);
  for (const issue of inherited.errors) fail(`inherited_${issue.code}`, issue.message);
  let realRoot;
  try { realRoot = fs.realpathSync(root); } catch { fail('root', 'Repository root does not exist'); }
  function file(relative) {
    if (!text(relative) || /^(?:[A-Za-z]:|\/)/.test(relative)
        || relative.replaceAll('\\', '/').split('/').some(part => part === '..' || part === '.')
        || relative.includes('\0')) throw new Error('Expected an in-repository relative file');
    const real = fs.realpathSync(path.join(root, ...relative.replaceAll('\\', '/').split('/')));
    const remainder = path.relative(realRoot, real);
    if (path.isAbsolute(remainder) || remainder === '..' || remainder.startsWith(`..${path.sep}`)
        || !fs.statSync(real).isFile()) throw new Error('File escapes the repository or is not a file');
    return real;
  }
  function load(relative) {
    try { return JSON.parse(fs.readFileSync(file(relative), 'utf8').replace(/^\uFEFF/, '')); }
    catch { fail('file', `Missing, invalid, or out-of-repository JSON: ${relative}`); return null; }
  }
  function shape(value, required, optional = [], location = 'object') {
    if (!object(value)) { fail('schema', `${location} must be an object`); return false; }
    for (const key of required) if (!Object.hasOwn(value, key)) fail('schema', `${location} is missing ${key}`);
    for (const key of Object.keys(value)) if (![...required, ...optional].includes(key)) fail('schema', `${location} has unknown field ${key}`);
    return true;
  }
  function strings(value, location, allowEmpty = false) {
    if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some(item => !text(item))) {
      fail('schema', `${location} must be ${allowEmpty ? 'an' : 'a nonempty'} array of strings`);
      return [];
    }
    if (new Set(value).size !== value.length) fail('duplicate', `${location} repeats a value`);
    return value;
  }
  function index(entries, required, location) {
    const found = new Map();
    if (!Array.isArray(entries)) fail('schema', `${location} must be an array`);
    for (const entry of array(entries)) {
      if (!object(entry) || !text(entry.id)) { fail('schema', `${location} has an invalid ID`); continue; }
      if (required.length && !required.includes(entry.id) && !location.endsWith('reflections') && !location.startsWith('inherited')) fail('id', `${location} has an unrecognized contract ID ${entry.id}`);
      if (found.has(entry.id)) fail('duplicate', `${location} repeats ${entry.id}`);
      else found.set(entry.id, entry);
    }
    for (const id of required) if (!found.has(id)) fail('scope', `${location} is missing mandatory ID ${id}`);
    return found;
  }
  const foundations = load('planning/foundations.json');
  const fc1 = load('planning/fc1.json');
  const migration = load('planning/contract-migration.json');
  shape(foundations, ['schema_version', 'contract_revision', 'language_edition', 'status', 'result', 'source', 'mapping_semantics', 'features', 'test_groups', 'expansions'], [], 'foundations');
  shape(fc1, ['schema_version', 'contract_revision', 'source', 'milestone', 'publication_label', 'reference_target', 'host_target_rule', 'hatch_completion', 'status', 'result', 'checks'], [], 'fc1');
  shape(migration, ['schema_version', 'contract_revision', 'previous_contract_revision', 'language_edition', 'source_commit', 'source', 'adr', 'status', 'result', 'inherited_counts', 'evidence_policy', 'inherited_snapshots', 'inherited_requirements', 'inherited_task_ids', 'inherited_gate_ids', 'compatibility_preservation', 'migrations', 'continuity_contracts'], [], 'migration');
  for (const [name, document] of [['foundations', foundations], ['fc1', fc1], ['migration', migration]]) {
    if (document?.schema_version !== 1 || document?.contract_revision !== '1.3') fail('revision', `${name} must use schema 1 and contract 1.3`);
    if (!statuses.includes(document?.status) || !results.includes(document?.result)) fail('status', `${name} has an invalid status/result`);
    try { file(document?.source); } catch { fail('file', `${name} source does not exist inside the repository`); }
  }
  if (!text(foundations?.mapping_semantics)) fail('schema', 'Foundation mappings must explain their subset/traceability scope');
  try { file(migration?.adr); } catch { fail('file', 'The governing migration ADR must exist inside the repository'); }
  if (foundations?.language_edition !== '2026.1' || migration?.language_edition !== '2026.1') fail('revision', 'The NAJA edition must remain 2026.1');
  if (fc1?.milestone !== 'FC1' || fc1?.publication_label !== 'experimental_preview' || fc1?.hatch_completion !== false) fail('scope', 'FC1 must remain a preview without a HATCH completion claim');
  if (!text(fc1?.reference_target) || !text(fc1?.host_target_rule)) fail('schema', 'FC1 needs a declared target and host/target distinction');
  const features = index(foundations?.features, featureIds, 'features');
  const groups = index(foundations?.test_groups, requiredGroups, 'test groups');
  const expansions = index(foundations?.expansions, expansionIds, 'expansions');
  const checks = index(fc1?.checks, fc1Ids, 'FC1 checks');
  const continuity = index(migration?.continuity_contracts, continuityIds, 'continuity contracts');
  const mappings = index(migration?.migrations, ids('M', 15), 'migration mappings');
  const oldRequirements = load('planning/requirements.json');
  const requirementIndex = index(oldRequirements?.requirements, [], 'inherited requirements');
  function references(value, target, location, allowEmpty = false) {
    const list = strings(value, location, allowEmpty);
    for (const id of list) if (!target.has(id)) fail('reference', `${location} references missing ${id}`);
    return list;
  }
  const allSubjects = new Map([...features, ...groups, ...expansions, ...checks, ...continuity]);
  function progress(subject) {
    if (!statuses.includes(subject.status) || !results.includes(subject.result)) fail('status', `${subject.id} has an invalid status/result`);
    if (Object.hasOwn(subject, 'implementation_stage') && !stages.includes(subject.implementation_stage)) fail('stage', `${subject.id} has an invalid implementation stage`);
    if (!Array.isArray(subject.evidence) || subject.evidence.some(item => !text(item))) fail('schema', `${subject.id}.evidence must be an array of record paths`);
    if (subject.status === 'verified' || subject.result === 'passed' || subject.implementation_stage === 'verified') {
      if (subject.status !== 'verified' || subject.result !== 'passed'
          || (Object.hasOwn(subject, 'implementation_stage') && subject.implementation_stage !== 'verified')) fail('false_green', `${subject.id} has inconsistent verification fields`);
    }
  }
  for (const [position, id] of featureIds.entries()) {
    const feature = features.get(id);
    if (!feature) continue;
    shape(feature, ['id', 'title', 'implementation_stage', 'hatch_required', ...common, 'inherited_requirement_ids', 'test_groups', 'fc1_checks', 'fc1_scope', 'reflections'], [], id);
    if (feature.hatch_required !== true) fail('scope', `${id} cannot be reclassified as optional/future`);
    if (!text(feature.title) || !text(feature.fc1_scope)) fail('schema', `${id} needs a title and explicit FC1 scope`);
    references(feature.inherited_requirement_ids, requirementIndex, `${id}.inherited_requirement_ids`);
    references(feature.test_groups, groups, `${id}.test_groups`);
    references(feature.fc1_checks, checks, `${id}.fc1_checks`, true);
    for (const group of featureGroupContract[position]) if (!array(feature.test_groups).includes(group)) fail('mandatory_group', `${id} must retain ${group}`);
    for (const check of featureFc1Contract[position]) if (!array(feature.fc1_checks).includes(check)) fail('mapping', `${id} must retain its ${check} subset mapping`);
    const reflections = index(feature.reflections, ids(`${id}-R`, reflectionCounts[position]), `${id} reflections`);
    for (const reflection of reflections.values()) {
      shape(reflection, ['id', 'classification', 'hatch_required', 'contract'], ['expansion_id'], reflection.id);
      if (!text(reflection.contract)) fail('schema', `${reflection.id} needs a concrete contract`);
      if (reflection.id.startsWith(`${id}-R`)) {
        if (!['required_foundation', 'inherited_foundation'].includes(reflection.classification) || reflection.hatch_required !== true) fail('scope', `${reflection.id} cannot become expansion work`);
      } else if (reflection.id !== `${id}-${reflection.expansion_id}` || reflection.classification !== 'named_expansion' || reflection.hatch_required !== false || !expansions.has(reflection.expansion_id)) fail('expansion', `${reflection.id} needs a stable named expansion reference`);
    }
  }
  for (const group of groups.values()) {
    shape(group, ['id', 'title', 'hatch_required', ...common, 'positive_boundaries', 'negative_boundaries', 'defect_injection_required', 'test_command'], [], group.id);
    if (group.hatch_required !== true || group.defect_injection_required !== true) fail('scope', `${group.id} must retain mandatory positive/negative/injected-defect checks`);
    strings(group.positive_boundaries, `${group.id}.positive_boundaries`);
    strings(group.negative_boundaries, `${group.id}.negative_boundaries`);
    if (group.test_command !== null && (!Array.isArray(group.test_command) || !group.test_command.length || group.test_command.some(argument => !text(argument)))) fail('schema', `${group.id}.test_command needs nonempty arguments`);
  }
  for (const expansion of expansions.values()) {
    shape(expansion, ['id', 'title', 'classification', 'hatch_required', 'foundation_feature_ids', 'test_groups', 'interface_contract', 'reason', 'implementation_stage', ...common], [], expansion.id);
    if (expansion.classification !== 'named_expansion' || expansion.hatch_required !== false || !text(expansion.reason) || !text(expansion.interface_contract)) fail('expansion', `${expansion.id} must name an interface and a sequencing reason`);
    references(expansion.foundation_feature_ids, features, `${expansion.id}.foundation_feature_ids`);
    references(expansion.test_groups, groups, `${expansion.id}.test_groups`);
    for (const id of array(expansion.foundation_feature_ids)) {
      if (!array(features.get(id)?.reflections).some(reflection => reflection.expansion_id === expansion.id)) fail('expansion', `${expansion.id} is missing its reflection in ${id}`);
    }
  }
  for (const check of checks.values()) {
    shape(check, ['id', 'contract', 'feature_ids', 'continuity_ids', 'test_groups', 'required_for_fc1', 'hatch_gate_waiver', ...common], [], check.id);
    if (check.required_for_fc1 !== true || check.hatch_gate_waiver !== false) fail('scope', `${check.id} must remain required and cannot waive HATCH gates`);
    if (!text(check.contract)) fail('schema', `${check.id} needs an executable acceptance contract`);
    references(check.feature_ids, features, `${check.id}.feature_ids`);
    references(check.continuity_ids, continuity, `${check.id}.continuity_ids`, true);
    references(check.test_groups, groups, `${check.id}.test_groups`);
    for (const group of fc1GroupContract[fc1Ids.indexOf(check.id)] ?? []) if (!array(check.test_groups).includes(group)) fail('mandatory_group', `${check.id} must retain ${group}`);
  }
  for (const contract of continuity.values()) {
    shape(contract, ['id', 'title', 'contract', 'hatch_required', 'implementation_stage', ...common, 'inherited_requirement_ids', 'fc1_checks', 'test_groups'], [], contract.id);
    if (contract.hatch_required !== true || !text(contract.contract)) fail('scope', `${contract.id} must retain its continuity contract`);
    references(contract.inherited_requirement_ids, requirementIndex, `${contract.id}.inherited_requirement_ids`);
    references(contract.fc1_checks, checks, `${contract.id}.fc1_checks`);
    references(contract.test_groups, groups, `${contract.id}.test_groups`);
    if (!array(contract.test_groups).includes('TG-RECOVERY') || !array(contract.fc1_checks).includes('FC1-12')) fail('mapping', `${contract.id} must map recovery into FC1-12`);
  }
  for (const subject of [...features.values(), ...continuity.values()]) {
    const field = features.has(subject.id) ? 'feature_ids' : 'continuity_ids';
    for (const id of array(subject.fc1_checks)) if (!array(checks.get(id)?.[field]).includes(subject.id)) fail('mapping', `${subject.id} -> ${id} must map both ways`);
    for (const check of checks.values()) if (array(check[field]).includes(subject.id) && !array(subject.fc1_checks).includes(check.id)) fail('mapping', `${check.id} -> ${subject.id} must map both ways`);
  }
  const expected = { requirements: 147, mandatory: 139, future: 8, tasks: 38, gates: 19 };
  shape(migration?.inherited_counts, Object.keys(expected), [], 'inherited_counts');
  for (const [key, value] of Object.entries(expected)) if (migration?.inherited_counts?.[key] !== value || inherited.counts[key] !== value) fail('scope', `Inherited ${key} must remain ${value}; new contracts are additive separate rows`);
  if (migration?.previous_contract_revision !== '1.2' || !hash.test(migration?.source_commit ?? '') || !text(migration?.evidence_policy)) fail('migration', 'Migration must identify the original revision/source and retention policy');
  const snapshots = index(migration?.inherited_requirements, [...requirementIndex.keys()], 'inherited snapshots');
  for (const snapshot of snapshots.values()) {
    shape(snapshot, ['id', 'gate', 'release_required', 'status_at_snapshot', 'contract_revision', 'evidence'], [], `snapshot ${snapshot.id}`);
    const current = requirementIndex.get(snapshot.id);
    if (!['not_started', 'in_progress', 'implemented', 'verified', 'blocked', 'failed'].includes(snapshot.status_at_snapshot) || !Array.isArray(snapshot.evidence) || snapshot.evidence.some(reference => !text(reference))) fail('schema', `${snapshot.id} needs its actual historical status/evidence`);
    if (!current || current.gate !== snapshot.gate || current.release_required !== snapshot.release_required || snapshot.contract_revision !== '1.2') fail('scope', `${snapshot.id} inherited scope/contract changed`);
    for (const reference of array(snapshot.evidence)) if (!array(current?.evidence).includes(reference)) fail('evidence_erasure', `${snapshot.id} lost historical evidence ${reference}`);
  }
  if (!Array.isArray(migration?.inherited_snapshots) || migration.inherited_snapshots.length !== 3) fail('migration', 'Three inherited planning source snapshots must remain identified');
  for (const snapshot of array(migration?.inherited_snapshots)) {
    if (!shape(snapshot, ['path', 'source_commit', 'sha256'], [], 'planning source snapshot')) continue;
    if (!['planning/requirements.json', 'planning/tasks.json', 'planning/release-gates.json'].includes(snapshot.path) || !hash.test(snapshot.source_commit ?? '') || !sha256.test(snapshot.sha256 ?? '')) fail('migration', 'Planning source snapshot identity is invalid');
  }
  for (const required of ['planning/requirements.json', 'planning/tasks.json', 'planning/release-gates.json']) if (!array(migration?.inherited_snapshots).some(snapshot => snapshot?.path === required)) fail('migration', `Original planning snapshot ${required} is missing`);
  for (const id of ids('T', 38)) if (!array(migration?.inherited_task_ids).includes(id)) fail('scope', `Migration dropped ${id}`);
  for (const id of ids('R', 19)) if (!array(migration?.inherited_gate_ids).includes(id)) fail('scope', `Migration dropped ${id}`);
  for (const mapping of mappings.values()) {
    shape(mapping, ['id', 'feature_id', 'from_contract_revision', 'to_contract_revision', 'inherited_requirement_ids', 'revalidation_required', 'reason', ...common], [], mapping.id);
    const feature = features.get(mapping.feature_id);
    if (!feature || mapping.from_contract_revision !== '1.2' || mapping.to_contract_revision !== '1.3' || mapping.revalidation_required !== true || !text(mapping.reason)) fail('migration', `${mapping.id} needs a feature and a reason for revalidation`);
    if (JSON.stringify([...array(mapping.inherited_requirement_ids)].sort()) !== JSON.stringify([...array(feature?.inherited_requirement_ids)].sort())) fail('mapping', `${mapping.id} disagrees with its feature's inherited mapping`);
  }
  for (const id of featureIds) if (![...mappings.values()].some(mapping => mapping.feature_id === id)) fail('mapping', `${id} has no migration mapping`);
  const compatible = load(migration?.compatibility_preservation?.path ?? 'compatibility/productions.json');
  shape(migration?.compatibility_preservation, ['path', 'reference_commit', 'grammar_sha256', 'production_ids', 'policy'], [], 'compatibility preservation');
  if (!text(migration?.compatibility_preservation?.policy)) fail('compatibility', 'Compatibility preservation must retain an explicit policy');
  strings(migration?.compatibility_preservation?.production_ids, 'preserved production IDs');
  const recordedIds = array(migration?.compatibility_preservation?.production_ids);
  if (crypto.createHash('sha256').update(JSON.stringify([...recordedIds].sort())).digest('hex') !== pythonProductionIdDigest) fail('compatibility', 'The original pinned production identifier set cannot be replaced or reduced');
  if (compatible?.source_commit !== migration?.compatibility_preservation?.reference_commit || compatible?.source_sha256 !== migration?.compatibility_preservation?.grammar_sha256) fail('compatibility', 'The preserved .py grammar identity changed without a migration');
  const productionIds = new Set(array(compatible?.productions).map(row => row?.id));
  if (array(migration?.compatibility_preservation?.production_ids).length !== 278) fail('compatibility', 'The original 278-production inventory must remain recorded');
  for (const id of array(migration?.compatibility_preservation?.production_ids)) if (!productionIds.has(id)) fail('compatibility', `The separate .py inventory lost ${id}`);

  const evidenceCache = new Map();
  function evidence(reference) {
    if (evidenceCache.has(reference)) return evidenceCache.get(reference);
    const before = errors.length;
    const record = load(reference);
    if (!shape(record, ['subject_id', 'test_group', 'kind', 'contract_revision', 'source_commit', 'dirty_tree_sha256', 'host', 'target', 'command', 'tool_versions', 'exit_code', 'result', 'timestamp', 'log_path', 'log_sha256', 'limitations'], ['defect_injection'], reference)) return null;
    if (!allSubjects.has(record.subject_id) || !groups.has(record.test_group) || !['positive', 'negative', 'defect_injection'].includes(record.kind) || record.contract_revision !== '1.3') fail('evidence_scope', `${reference} has invalid subject/group/kind/contract identity`);
    if ((record.source_commit !== null && !hash.test(record.source_commit)) || (record.dirty_tree_sha256 !== null && !sha256.test(record.dirty_tree_sha256)) || (!record.source_commit && !record.dirty_tree_sha256)) fail('evidence_source', `${reference} needs a full tested source identity`);
    if (!Array.isArray(record.command) || !record.command.length || record.command.some(argument => !text(argument))) fail('evidence_schema', `${reference}.command needs nonempty arguments`);
    if (!text(record.host) || !text(record.target) || !object(record.tool_versions) || Object.keys(record.tool_versions).length === 0 || Object.values(record.tool_versions).some(value => !text(value))) fail('evidence_schema', `${reference} needs real host/target/tool identity`);
    if (!results.includes(record.result) || (record.exit_code !== null && !Number.isInteger(record.exit_code)) || !text(record.timestamp) || !Number.isFinite(Date.parse(record.timestamp)) || !Array.isArray(record.limitations) || record.limitations.some(value => !text(value))) fail('evidence_schema', `${reference} has invalid result/time/limits`);
    if (record.result === 'passed') {
      if (record.exit_code !== 0 || !sha256.test(record.log_sha256 ?? '')) fail('false_green', `${reference} passed requires exit 0 and a retained SHA-256 log`);
      try {
        const bytes = fs.readFileSync(file(record.log_path));
        if (!bytes.toString('utf8').trim() || crypto.createHash('sha256').update(bytes).digest('hex') !== record.log_sha256) fail('evidence_log', `${reference} log is empty or does not match retained bytes`);
      } catch { fail('evidence_log', `${reference} needs an in-repository retained log`); }
      if (record.kind === 'defect_injection') {
        const mutation = record.defect_injection;
        if (!object(mutation) || !text(mutation.defect_id) || !sha256.test(mutation.mutant_source_sha256 ?? '') || mutation.control_result !== 'passed' || mutation.mutant_result !== 'failed' || !Number.isInteger(mutation.mutant_exit_code) || mutation.mutant_exit_code === 0 || mutation.detected !== true) fail('defect_not_detected', `${reference} must show a passing control and a failing injected feature defect`);
      }
    }
    const valid = before === errors.length ? record : null;
    evidenceCache.set(reference, valid);
    return valid;
  }
  for (const subject of allSubjects.values()) {
    progress(subject);
    const records = array(subject.evidence).map(evidence).filter(Boolean);
    const mappedGroups = groups.has(subject.id) ? [subject.id] : array(subject.test_groups);
    for (const record of records) if (record.subject_id !== subject.id || !mappedGroups.includes(record.test_group)) fail('evidence_scope', `${subject.id} cannot reuse evidence for a different subject/group`);
    if (subject.status !== 'verified') continue;
    const accepted = records.filter(record => record.result === 'passed' && record.subject_id === subject.id && mappedGroups.includes(record.test_group));
    const identities = new Set(accepted.map(record => `${record.source_commit}:${record.dirty_tree_sha256}:${record.target}`));
    if (identities.size !== 1) fail('false_green', `${subject.id} verification must cover one exact source/target identity`);
    for (const group of mappedGroups) for (const kind of ['positive', 'negative', 'defect_injection']) if (!accepted.some(record => record.test_group === group && record.kind === kind)) fail('false_green', `${subject.id} lacks passed ${kind} evidence for ${group}`);
    if (groups.has(subject.id) && !Array.isArray(subject.test_command)) fail('false_green', `${subject.id} has no implemented test command`);
  }
  for (const [name, document, members] of [['foundations', foundations, [...features.values(), ...groups.values()]], ['fc1', fc1, [...checks.values()]], ['migration', migration, [...mappings.values(), ...continuity.values()]]]) {
    if ((document?.status === 'verified' || document?.result === 'passed') && (document.status !== 'verified' || document.result !== 'passed' || members.some(member => member.status !== 'verified'))) fail('false_green', `${name} cannot be green while its mandatory members remain open`);
  }
  for (const mapping of mappings.values()) {
    if (!statuses.includes(mapping.status) || !results.includes(mapping.result)) fail('status', `${mapping.id} has an invalid migration status/result`);
    if (mapping.status === 'verified' || mapping.result === 'passed') {
      const feature = features.get(mapping.feature_id);
      if (mapping.status !== 'verified' || mapping.result !== 'passed' || feature?.status !== 'verified' || !array(mapping.evidence).length || array(mapping.evidence).some(reference => !array(feature?.evidence).includes(reference))) fail('migration', `${mapping.id} needs its verified revision 1.3 feature evidence`);
    }
  }
  return {
    ok: errors.length === 0, errors,
    counts: { inherited: inherited.counts, foundations: features.size, continuity: continuity.size, fc1_checks: checks.size, mandatory_test_groups: groups.size, named_expansions: expansions.size },
    verified: { foundations: [...features.values()].filter(row => row.status === 'verified').length, continuity: [...continuity.values()].filter(row => row.status === 'verified').length, fc1_checks: [...checks.values()].filter(row => row.status === 'verified').length },
    limits: ['This validates contract metadata, retained log consistency and necessary coverage references; it does not execute feature tests or prove truthful/sufficient evidence.', 'Inherited evidence stays at its original source and contract; structural success does not verify FC1 or HATCH.', 'Commit syntax is checked; source-object existence, actual injected source behavior and release coverage require separate reproducible execution/review.'],
  };
}

export function main(args = process.argv.slice(2)) {
  let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  let json = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--root' && args[index + 1]) root = path.resolve(args[++index]);
    else if (args[index] === '--json') json = true;
    else if (args[index] === '--help') { process.stdout.write('Usage: node scripts/validation/check-foundations.mjs [--root DIRECTORY] [--json]\nContract integrity does not establish executable feature acceptance.\n'); return 0; }
    else { process.stderr.write('Usage: node scripts/validation/check-foundations.mjs [--root DIRECTORY] [--json]\n'); return 2; }
  }
  const result = validateFoundations(root);
  process.stdout.write(json ? `${JSON.stringify(result, null, 2)}\n` : `Foundation contract integrity: ${result.ok ? 'PASS' : 'FAIL'}\n${JSON.stringify(result.counts)}\nVerified new contracts: ${JSON.stringify(result.verified)}\n${result.errors.map(issue => `[${issue.code}] ${issue.message}\n`).join('')}Contract integrity does not establish executable feature, FC1 or HATCH acceptance.\n`);
  return result.ok ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = main();
