// Closed local schemas. These do not replace shared planning schemas.
const text = { type: 'string', minLength: 1 };
const hash = { type: 'string', pattern: '^(?:[0-9a-f]{40}|[0-9a-f]{64})$' };
const digest = { type: 'string', pattern: '^[0-9a-f]{64}$' };
const uuid = { type: 'string', pattern: '^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$' };
const nullable = value => ({ anyOf: [value, { type: 'null' }] });
const list = (items, minItems = 0) => ({ type: 'array', items, minItems });
const object = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const integer = { type: 'integer', minimum: 0 };
const generation = { type: 'integer', minimum: 1 };
export const states = ['running', 'checkpointing', 'ready_for_handoff', 'waiting_for_quota', 'blocked_external', 'complete'];
export const reservationSchema = object({
  schema_version: { const: 1 }, owner: text, session: text, nonce: uuid,
  fencing_generation: generation,
  process_identity: nullable(object({ pid: generation, observed_at: text })),
});
const entry = object({ path: text, status: text, kind: { enum: ['file', 'symlink', 'missing', 'directory'] }, mode: integer, sha256: nullable(digest), bytes: integer });
export const snapshotSchema = object({
  head: hash, branch: text, worktree: text, dirty: list(entry), index_sha256: digest, fingerprint: digest,
  upstream: nullable(hash), remote_freshness: { const: 'cached-ref-only; no fetch performed' },
});
export const budgetSchema = object(Object.fromEntries(['context', 'provider_quota', 'rate_limit', 'execution_deadline', 'spend'].map(name => [name, nullable(text)])));
export const checkSchema = object({ command: list(text, 1), result: { enum: ['passed', 'failed', 'not_run', 'blocked'] }, exit_code: nullable({ type: 'integer' }) });
export const checkpointSchema = object({
  schema_version: { const: 1 }, id: uuid, checkpoint_generation: generation,
  language_contract: { const: '1.3 / NAJA 2026.1' }, created_at: text,
  reservation: reservationSchema, snapshot: snapshotSchema,
  last_verified_source: nullable(hash), task: text, completed: list(text),
  checks: list(checkSchema), artifacts: list(object({ path: text, sha256: digest })),
  blockers: list(text), unsafe_intermediate_states: list(text), next_action: text,
  next_commands: list(list(text, 1), 1), budget: budgetSchema,
  state: { enum: states }, preservation: object({ staged_patch_sha256: digest, unstaged_patch_sha256: digest }),
});
export const pointerSchema = object({ schema_version: { const: 1 }, id: uuid, checkpoint_generation: generation, sha256: digest });
export const counterSchema = object({ schema_version: { const: 1 }, value: integer });
export const schemas = { reservation: reservationSchema, snapshot: snapshotSchema, checkpoint: checkpointSchema, pointer: pointerSchema, counter: counterSchema, budget: budgetSchema };

// Only the assertions above are used; the schema objects are exported for inspection.
export function validate(value, schema, location = '$') {
  if (schema.anyOf) {
    if (schema.anyOf.some(choice => { try { validate(value, choice, location); return true; } catch { return false; } })) return value;
    throw new Error(`${location}: no permitted type matched`);
  }
  if (Object.hasOwn(schema, 'const') && value !== schema.const) throw new Error(`${location}: invalid constant`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${location}: invalid enum`);
  const matches = { null: value === null, string: typeof value === 'string', integer: Number.isSafeInteger(value), array: Array.isArray(value), object: value !== null && typeof value === 'object' && !Array.isArray(value) };
  if (schema.type && !matches[schema.type]) throw new Error(`${location}: expected ${schema.type}`);
  if (schema.minimum !== undefined && value < schema.minimum) throw new Error(`${location}: below minimum`);
  if (typeof value === 'string' && ((schema.minLength && !value.trim()) || (schema.pattern && !new RegExp(schema.pattern).test(value)))) throw new Error(`${location}: invalid string`);
  if (Array.isArray(value)) {
    if (value.length < schema.minItems) throw new Error(`${location}: too few items`);
    value.forEach((child, index) => validate(child, schema.items, `${location}[${index}]`));
  }
  if (schema.type === 'object') {
    for (const name of schema.required) if (!Object.hasOwn(value, name)) throw new Error(`${location}: missing ${name}`);
    for (const name of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties, name)) throw new Error(`${location}: unexpected ${name}`);
      validate(value[name], schema.properties[name], `${location}.${name}`);
    }
  }
  return value;
}
