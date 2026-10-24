/**
 * Server-side full user_current_profile assembly (aligns with frontend injectUserProfile).
 * career + shortboard + L3 + error ledger + graph (+ optional Recall)
 */

const INJECT_PROFILE_MAX_LEN = Number(process.env.INJECT_PROFILE_MAX_LEN || 4000);

function parseJsonObject(raw, fallback = {}) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw || ''));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    /* ignore */
  }
  return fallback;
}

function normalizeUserId(raw) {
  if (!raw) return 'default-user';
  const base = String(raw).split('@')[0].trim();
  return base || 'default-user';
}

function sanitizeProfileText(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/<think[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking[\s\S]*?<\/thinking>/gi, '')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatCareerProfileLine(career) {
  if (!career || typeof career !== 'object') return '';
  const history = String(career.history || '').trim();
  const current = String(career.current || '').trim();
  const target = String(career.target || '').trim();
  const progress = Math.min(100, Math.max(0, Math.round(Number(career.progress) || 0)));
  if (!history && !current && !target && !Object.prototype.hasOwnProperty.call(career, 'progress')) {
    return '';
  }
  if (!history && !current && !target) return '';
  return `职业路径: 起点=${history}; 当前=${current}; 目标=${target}; 能力匹配度=${progress}%`;
}

function buildCareerAwareProfileString(baseProfile, career) {
  const careerLine = formatCareerProfileLine(career);
  let rest = sanitizeProfileText(baseProfile);
  rest = rest.replace(/职业路径:\s*起点=[^;]*;\s*当前=[^;]*;\s*目标=[^;]*;\s*能力匹配度=\d+%/g, '').trim();
  rest = rest.replace(/^;\s*|;?\s*$/g, '').replace(/;\s*;/g, ';').trim();
  return [careerLine, rest].filter(Boolean).join('; ');
}

function formatL3VarsForProfile(vars) {
  if (!vars || typeof vars !== 'object' || Array.isArray(vars)) return '';
  const parts = [];
  if (vars.accent) parts.push(`Accent:${vars.accent}`);
  if (vars.training_goal) parts.push(`Goal:${vars.training_goal}`);
  if (vars.weakness_focus) parts.push(`Focus:${vars.weakness_focus}`);
  return parts.join('; ');
}

function formatErrorLedgerSummary(ledger) {
  const obj = parseJsonObject(ledger, {});
  const parts = [];
  for (const category of ['oral', 'listening', 'vocab']) {
    const items = obj[category];
    if (!Array.isArray(items) || !items.length) continue;
    const latest = items.slice(0, 3).map((item) => {
      if (!item || typeof item !== 'object') return '';
      if (category === 'oral') return String(item.flaw || item.pattern || '');
      if (category === 'listening') return String(item.pattern || item.reason || '');
      return String(item.word || item.error_type || '');
    }).filter(Boolean);
    if (latest.length) parts.push(`${category}:${latest.join('/')}`);
  }
  return parts.join('; ');
}

function formatGraphSummaryLine(memoryLayers) {
  const graph = memoryLayers?.l2_graph;
  if (!graph || typeof graph !== 'object') return '';
  const relations = Array.isArray(graph.relations) ? graph.relations.slice(0, 8) : [];
  if (!relations.length) return '';
  const body = relations.map((r, i) => {
    const ev = r.evidence ? ` (${String(r.evidence).slice(0, 60)})` : '';
    return `${i + 1}. ${r.from} —[${r.rel}]→ ${r.to}${ev}`;
  }).join('; ');
  return `Graph: ${body}`;
}

function scoreRecallText(query, tokens, text) {
  const t = String(text || '').toLowerCase();
  if (!t || !query) return 0;
  let score = 0;
  if (t.includes(query)) score += 10;
  for (const tok of tokens) {
    if (tok.length >= 2 && t.includes(tok)) score += 3;
  }
  return score;
}

function buildRecallLine(memoryLayers, profileText, recallQuery, topK = 5) {
  const q = String(recallQuery || '').trim().toLowerCase();
  if (!q) return '';
  const tokens = q.split(/[\s,，;；、。！？!?]+/).filter((t) => t.length >= 2);
  const toks = tokens.length ? tokens : [q];
  const hits = [];
  const seen = new Set();

  const push = (kind, score, text, key) => {
    const t = String(text || '').trim().slice(0, 180);
    if (!t || seen.has(key)) return;
    seen.add(key);
    hits.push({ kind, score, text: t });
  };

  const pScore = scoreRecallText(q, toks, profileText);
  if (pScore > 0) push('profile', pScore + 2, profileText.slice(0, 200), 'profile:main');

  for (const sem of memoryLayers.l2_semantics || []) {
    const blob = [sem.tag, sem.pattern, sem.evidence, sem.category].filter(Boolean).join(' ');
    const score = scoreRecallText(q, toks, String(blob));
    if (score > 0) push('semantic', score, String(sem.pattern || sem.tag || blob), `semantic:${sem.tag || sem.pattern}`);
  }
  for (const ep of memoryLayers.l2_episodes || []) {
    const text = String(ep.summary || ep.preview || ep.weaknessScan || ep.practicalTest || '').trim();
    const score = scoreRecallText(q, toks, text);
    if (score > 0) push('episode', score, text, `episode:${ep._id || text.slice(0, 40)}`);
  }
  for (const r of memoryLayers.l2_graph?.relations || []) {
    const line = `${r.from} ${r.rel} ${r.to} ${r.evidence || ''}`;
    const score = scoreRecallText(q, toks, line);
    if (score > 0) {
      push('graph', score, `${r.from} —[${r.rel}]→ ${r.to}`, `graph:${r.from}|${r.rel}|${r.to}`);
    }
  }

  hits.sort((a, b) => b.score - a.score);
  const items = hits.slice(0, Math.min(Math.max(topK, 1), 15));
  if (!items.length) return '';
  return `Recall: ${items.map((item, i) => `${i + 1}. [${item.kind}] ${item.text}`).join(' | ')}`;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} userId
 * @param {{ recallQuery?: string, maxLen?: number }} [opts]
 */
function buildInjectedUserCurrentProfile(db, userId, opts = {}) {
  const uid = normalizeUserId(userId);
  const maxLen = Number(opts.maxLen) > 0 ? Number(opts.maxLen) : INJECT_PROFILE_MAX_LEN;
  let row;
  try {
    row = db.prepare(
      'SELECT profile_content, memory_layers, error_ledger FROM user_memories WHERE user_id = ?',
    ).get(uid);
  } catch {
    return '';
  }
  if (!row) return '';

  const memoryLayers = parseJsonObject(row.memory_layers, {});
  const career = memoryLayers.career_path;
  const profile = buildCareerAwareProfileString(row.profile_content || '', career);
  const l3Line = formatL3VarsForProfile(memoryLayers.l3_vars);
  const errorSummary = formatErrorLedgerSummary(row.error_ledger);
  const graphLine = formatGraphSummaryLine(memoryLayers);
  const recallLine = buildRecallLine(memoryLayers, profile, opts.recallQuery);

  const merged = [profile, l3Line, errorSummary, graphLine, recallLine].filter(Boolean).join('; ');
  const cleaned = sanitizeProfileText(merged);
  if (!cleaned) return '';
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

/**
 * Prefer non-empty client inject; otherwise assemble from DB.
 */
function resolveUserCurrentProfileForDify(db, userId, incoming, opts = {}) {
  const fromClient = sanitizeProfileText(incoming);
  if (fromClient) {
    const maxLen = Number(opts.maxLen) > 0 ? Number(opts.maxLen) : INJECT_PROFILE_MAX_LEN;
    return fromClient.length > maxLen ? fromClient.slice(0, maxLen) : fromClient;
  }
  return buildInjectedUserCurrentProfile(db, userId, opts);
}

module.exports = {
  INJECT_PROFILE_MAX_LEN,
  buildInjectedUserCurrentProfile,
  resolveUserCurrentProfileForDify,
  formatCareerProfileLine,
  buildCareerAwareProfileString,
  formatL3VarsForProfile,
  formatErrorLedgerSummary,
  formatGraphSummaryLine,
};
