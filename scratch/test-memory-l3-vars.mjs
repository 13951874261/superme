const L3_VAR_KEYS = new Set(['accent', 'locale', 'timezone', 'training_goal', 'spelling_variant', 'weakness_focus']);

function normalizeL3VarKey(key) {
  return String(key || '').trim().replace(/[^a-z0-9_]/gi, '_').slice(0, 40);
}

function normalizeL3VarValue(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, 200);
}

function mergeL3Vars(existing, delta) {
  const base = existing && typeof existing === 'object' ? { ...existing } : {};
  const conflicts = [];
  for (const [rawKey, rawVal] of Object.entries(delta || {})) {
    const key = normalizeL3VarKey(rawKey);
    if (!key || !L3_VAR_KEYS.has(key)) continue;
    const next = normalizeL3VarValue(rawVal);
    if (!next) continue;
    const prev = base[key];
    if (prev !== undefined && String(prev) !== next) conflicts.push(`${key}=${prev}`);
    base[key] = next;
  }
  return { vars: base, conflicts };
}

function inferL3VarsDeltaFromText(text) {
  const delta = {};
  const raw = String(text || '');
  if (/英音|英国|\(UK\)/i.test(raw)) {
    delta.accent = 'UK';
    delta.spelling_variant = 'UK';
  }
  return delta;
}

let layers = { l3_vars: { accent: 'US', spelling_variant: 'US' } };
const dream = mergeL3Vars(layers.l3_vars, { accent: 'UK', spelling_variant: 'UK', training_goal: '即兴表达', foo: 'bar' });
layers.l3_vars = dream.vars;
const inferred = mergeL3Vars(layers.l3_vars, inferL3VarsDeltaFromText('用户偏好英音口语'));
layers.l3_vars = inferred.vars;

const ok =
  layers.l3_vars.accent === 'UK'
  && layers.l3_vars.spelling_variant === 'UK'
  && layers.l3_vars.training_goal === '即兴表达'
  && layers.l3_vars.foo === undefined
  && dream.conflicts.some((c) => c.startsWith('accent='));

console.log(JSON.stringify({ ok, l3_vars: layers.l3_vars, conflicts: dream.conflicts }));
process.exit(ok ? 0 : 1);
