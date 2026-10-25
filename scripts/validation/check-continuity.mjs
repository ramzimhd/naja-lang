#!/usr/bin/env node
// Public observations are separate from private recovery state and authority.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MAX_BYTES = 1024 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const schemaPath = new URL('../../planning/continuity.schema.json', import.meta.url);
const freeze = value => {
  if (object(value) || Array.isArray(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const publicContinuitySchema = freeze(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));

const supportedKeywords = new Set([
  '$schema', '$id', '$defs', '$ref', 'title', 'description', 'type', 'const', 'enum',
  'required', 'properties', 'additionalProperties', 'items', 'minItems', 'maxItems',
  'uniqueItems', 'minLength', 'maxLength', 'pattern', 'format', 'minimum', 'maximum',
  'anyOf', 'allOf', 'if', 'then', 'else',
]);
const propertyNames = new Set();
function inspectSchema(schema, errors) {
  if (!object(schema)) { errors.push({ code: 'schema_definition', path: '$', message: 'Schema must be an object.' }); return; }
  if (Object.keys(schema).some(key => !supportedKeywords.has(key))) errors.push({ code: 'schema_definition', path: '$', message: 'Unsupported public schema assertion.' });
  if (schema.$ref && !/^#\/\$defs\/[A-Za-z_][A-Za-z_0-9]*$/.test(schema.$ref)) errors.push({ code: 'schema_definition', path: '$', message: 'Only local schema definitions are supported.' });
  if (schema.format && schema.format !== 'date-time') errors.push({ code: 'schema_definition', path: '$', message: 'Unsupported public schema format.' });
  if (schema.pattern) { try { new RegExp(schema.pattern); } catch { errors.push({ code: 'schema_definition', path: '$', message: 'Invalid schema pattern.' }); } }
  for (const [name, child] of Object.entries(schema.properties ?? {})) { propertyNames.add(name); inspectSchema(child, errors); }
  for (const child of Object.values(schema.$defs ?? {})) inspectSchema(child, errors);
  for (const child of [...(schema.anyOf ?? []), ...(schema.allOf ?? [])]) inspectSchema(child, errors);
  for (const name of ['items', 'if', 'then', 'else']) if (schema[name]) inspectSchema(schema[name], errors);
}
const schemaErrors = [];
inspectSchema(publicContinuitySchema, schemaErrors);

function validTimestamp(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minuteText, secondText, offsetHour = '0', offsetMinute = '0'] = match;
  const [y, m, d, h, minute, second, offsetH, offsetM] = [year, month, day, hour, minuteText, secondText, offsetHour, offsetMinute].map(Number);
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return m >= 1 && m <= 12 && d >= 1 && d <= days[m - 1] && h < 24 && minute < 60
    && second < 60 && offsetH < 24 && offsetM < 60;
}

function check(value, schema, location, errors, depth = 0) {
  const issue = (code, message) => { if (errors.length < 100) errors.push({ code, path: location, message }); };
  if (depth > 32) { issue('depth', 'Public observations exceed the nesting limit.'); return; }
  if (schema.$ref) {
    const definition = publicContinuitySchema.$defs[schema.$ref.slice('#/$defs/'.length)];
    if (!definition) { issue('schema_definition', 'Unknown local schema definition.'); return; }
    check(value, definition, location, errors, depth + 1);
    return;
  }
  if (Object.hasOwn(schema, 'const') && value !== schema.const) issue('constant', 'Value does not match the required public constant.');
  if (schema.enum && !schema.enum.includes(value)) issue('enum', 'Value is outside the permitted recorded states.');
  const typeMatches = type => ({
    null: value === null, boolean: typeof value === 'boolean', object: object(value),
    array: Array.isArray(value), string: typeof value === 'string',
    integer: Number.isSafeInteger(value), number: typeof value === 'number' && Number.isFinite(value),
  })[type] === true;
  if (schema.type && ![schema.type].flat().some(typeMatches)) { issue('type', 'Value has the wrong public field type.'); return; }
  const matches = candidate => { const candidateErrors = []; check(value, candidate, location, candidateErrors, depth + 1); return !candidateErrors.length; };
  if (schema.anyOf && !schema.anyOf.some(matches)) issue('any_of', 'No permitted field representation matched.');
  for (const assertion of schema.allOf ?? []) check(value, assertion, location, errors, depth + 1);
  if (schema.if) {
    const branch = matches(schema.if) ? schema.then : schema.else;
    if (branch) check(value, branch, location, errors, depth + 1);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) issue('minimum', 'Observed value is below the permitted range.');
    if (schema.maximum !== undefined && value > schema.maximum) issue('maximum', 'Observed value exceeds the permitted range.');
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && [...value].length < schema.minLength) issue('length', 'Public string is too short.');
    if (schema.maxLength !== undefined && [...value].length > schema.maxLength) issue('length', 'Public string is too long.');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) issue('pattern', 'Public string does not match its field syntax.');
    if (schema.format === 'date-time' && !validTimestamp(value)) issue('timestamp', 'Expected a valid timestamp with an explicit offset and no leap second.');
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) issue('items', 'Required public list is empty or too short.');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) issue('items', 'Public list exceeds its item bound.');
    if (schema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) issue('duplicate', 'Public list repeats an entry.');
    if (schema.items) value.forEach((item, index) => check(item, schema.items, `${location}[${index}]`, errors, depth + 1));
  }
  if (object(value)) {
    for (const name of schema.required ?? []) if (!Object.hasOwn(value, name)) {
      if (errors.length < 100) errors.push({ code: 'required', path: `${location}.${name}`, message: 'Required public observation field is missing.' });
    }
    for (const name of Object.keys(value)) {
      if (Object.hasOwn(schema.properties ?? {}, name)) check(value[name], schema.properties[name], `${location}.${name}`, errors, depth + 1);
      else if (schema.additionalProperties === false) issue('closed_object', 'Unexpected field in a closed public observation.');
    }
  }
}

const privateKeyName = /(?:^|_)(?:nonce|token|secret|password|credentials?|api_key|private_path|private_worktree|private_patch)(?:_|$)/i;
const profilePath = /(?:[A-Za-z]:[\\/]+Users[\\/]+|\/(?:Users|home)\/|\/root\/(?:\.ssh|\.config|\.cache|\.codex|\.local|Documents|Downloads)\/)/i;
const privateRepositoryPath = /(?:^|[\\/\s=])(?:\.git(?:[\\/]|$)|(?:launch|logs|reports)[\\/]local(?:[\\/]|$)|\.naja[\\/](?:sessions|history|cache)(?:[\\/]|$)|naja-continuity[\\/](?:checkpoints|released-))/i;
const secretValue = /(?:\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{16,}|(?:AKIA|ASIA)[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|\bAuthorization\s*:\s*(?:Bearer|token)\s+\S+|\b(?:nonce|token|password|api[_-]?key|client[_-]?secret)\s*[:=]\s*\S+|--(?:token|password|api[-_]key|client[-_]secret|authorization)(?:=|$))/i;

function inspectPublicData(value, location, errors, depth = 0) {
  if (depth > 24 || errors.length >= 100) return;
  const issue = (code, message) => errors.push({ code, path: location, message });
  if (typeof value === 'string') {
    if (profilePath.test(value) || privateRepositoryPath.test(value)) issue('private_path', 'A private filesystem path must not be published.');
    if (secretValue.test(value)) issue('private_value', 'Authentication or reservation material must not be published.');
  } else if (Array.isArray(value)) value.forEach((item, index) => inspectPublicData(item, `${location}[${index}]`, errors, depth + 1));
  else if (object(value)) for (const [name, item] of Object.entries(value)) {
    if (privateKeyName.test(name)) issue('private_field', 'Private reservation or authentication fields are forbidden.');
    const label = propertyNames.has(name) ? name : '<unknown>';
    inspectPublicData(item, `${location}.${label}`, errors, depth + 1);
  }
}

function plainJSON(value, ancestors = new Set(), depth = 0) {
  if (depth > 24) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value) || Object.getOwnPropertySymbols(value).length) return false;
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.keys(descriptors).length !== value.length + 1) return false;
      for (let index = 0; index < value.length; index++) {
        const descriptor = descriptors[index];
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || !plainJSON(descriptor.value, ancestors, depth + 1)) return false;
      }
    } else for (const descriptor of Object.values(descriptors)) {
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || !plainJSON(descriptor.value, ancestors, depth + 1)) return false;
    }
    return true;
  } finally { ancestors.delete(value); }
}

export function validatePublicContinuity(record) {
  const errors = [...schemaErrors];
  try {
    if (!plainJSON(record)) return { ok: false, errors: [{ code: 'json_data', path: '$', message: 'Observation must contain bounded plain JSON data without accessors or sparse arrays.' }] };
    const serialized = JSON.stringify(record);
    if (!serialized || Buffer.byteLength(serialized) > MAX_BYTES) return { ok: false, errors: [{ code: 'size', path: '$', message: 'Public observation must be JSON data within 1 MiB.' }] };
    if (errors.length === 0) check(record, publicContinuitySchema, '$', errors);
    inspectPublicData(record, '$', errors);
    const quota = record?.budget?.provider_quota;
    if (quota?.status === 'observed' && typeof quota.used_percent === 'number' && typeof quota.remaining_percent === 'number'
        && Math.abs(quota.used_percent + quota.remaining_percent - 100) > 1e-9) errors.push({ code: 'quota_consistency', path: '$.budget.provider_quota', message: 'Observed used and remaining percentages contradict each other.' });
    const spend = record?.budget?.spend;
    if (typeof spend?.remaining === 'number' && typeof spend?.monetary_ceiling === 'number' && spend.remaining > spend.monetary_ceiling) errors.push({ code: 'spend_consistency', path: '$.budget.spend', message: 'Remaining spend exceeds the recorded ceiling.' });
    const artifacts = Array.isArray(record?.artifacts) ? record.artifacts : [];
    if (new Set(artifacts.map(item => item?.path)).size !== artifacts.length) errors.push({ code: 'duplicate_artifact', path: '$.artifacts', message: 'Artifact paths must identify one recorded hash each.' });
    for (const [index, result] of (Array.isArray(record?.checks) ? record.checks : []).entries()) {
      if (object(result) && Object.hasOwn(result, 'log_path') !== Object.hasOwn(result, 'log_sha256')) errors.push({ code: 'log_identity', path: `$.checks[${index}]`, message: 'Optional log path and hash must be recorded together.' });
    }
    for (const value of [...(Array.isArray(record?.dirty_paths) ? record.dirty_paths : []), ...artifacts.map(item => item?.path)]) {
      if (typeof value === 'string' && !value.trim()) errors.push({ code: 'path', path: '$', message: 'Repository paths cannot be whitespace-only.' });
    }
  } catch {
    errors.push({ code: 'json_data', path: '$', message: 'Observation must contain bounded plain JSON data.' });
  }
  return { ok: errors.length === 0, errors };
}

export function assertPublicContinuity(record) {
  const result = validatePublicContinuity(record);
  if (!result.ok) {
    const error = new TypeError('Public continuity observation rejected; inspect sanitized validation errors.');
    error.code = 'PUBLIC_CONTINUITY_INVALID'; error.errors = result.errors;
    throw error;
  }
  return record;
}

export function unknownPublicBudget() {
  const unknown = fields => ({ status: 'unknown', ...fields, observed_at: null, source: null });
  return {
    context: unknown({ remaining_tokens: null }),
    provider_quota: unknown({ account_shared: true, used_percent: null, remaining_percent: null, window_minutes: null, resets_at: null }),
    rate_limit: unknown({ limited: null, retry_after_seconds: null, resets_at: null }),
    execution_deadline: unknown({ at: null, remaining_seconds: null }),
    spend: unknown({ extra_billing_authorized: false, remaining: null, monetary_ceiling: null, currency: null }),
    limitations: [],
  };
}

export function readPublicContinuity(filename) {
  try {
    if (fs.statSync(filename).size > MAX_BYTES) return { ok: false, errors: [{ code: 'size', path: '$', message: 'Public observation exceeds 1 MiB.' }] };
    const raw = fs.readFileSync(filename, 'utf8');
    // Scan raw strings as well so a duplicate JSON field cannot hide a known
    // credential prefix or encoded profile path from the parsed-object scan.
    if (secretValue.test(raw) || profilePath.test(raw.replaceAll('\\\\', '\\'))) return { ok: false, errors: [{ code: 'private_value', path: '$', message: 'Raw public observation contains forbidden private material.' }] };
    return validatePublicContinuity(JSON.parse(raw.replace(/^\uFEFF/, '')));
  } catch { return { ok: false, errors: [{ code: 'read', path: '$', message: 'Public observation is unavailable or invalid JSON.' }] }; }
}

export function main(args = process.argv.slice(2)) {
  let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  let filename;
  let json = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--root' && args[index + 1]) root = path.resolve(args[++index]);
    else if (args[index] === '--file' && args[index + 1]) filename = path.resolve(args[++index]);
    else if (args[index] === '--json') json = true;
    else if (args[index] === '--help') { process.stdout.write('Usage: node scripts/validation/check-continuity.mjs [--root DIRECTORY | --file JSON] [--json]\nChecks a public recorded observation; no Git readiness, locking or product acceptance is performed.\n'); return 0; }
    else { process.stderr.write('Invalid continuity validation arguments; use --help.\n'); return 2; }
  }
  const result = readPublicContinuity(filename ?? path.join(root, 'planning/continuity.json'));
  const limitation = 'Recorded observation only; no current Git, reservation, runner or product acceptance checks were performed.';
  process.stdout.write(json ? `${JSON.stringify({ ...result, limitation }, null, 2)}\n` : `Public continuity observation: ${result.ok ? 'PASS' : 'FAIL'}\n${result.errors.map(error => `[${error.code}] ${error.path}: ${error.message}\n`).join('')}${limitation}\n`);
  return result.ok ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = main();
