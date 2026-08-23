const crypto = require('crypto');
const dailyPackService = require('./dailyPackService');
const { generateInsightScenario } = require('./insightScenarioGenerate');
const { flattenDraft } = require('./insightScenarioScript');

const CATEGORIES = ['体制内', '外企', '通用社交'];
const TARGET_PER_CATEGORY = 10;
const DEDUPE_DAYS = 30;

function normalizeUserId(raw) {
  if (!raw) return 'default-user';
  const base = String(raw).split('@')[0].trim();
  return base || 'default-user';
}

function normalizeCategory(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.includes('通用社交') || s === 'social') return '通用社交';
  if (s.includes('外企') || s === 'corp') return '外企';
  if (s.includes('体制') || s === 'gov') return '体制内';
  return s;
}

function addDays(packDate, delta) {
  const [y, m, d] = String(packDate).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(delta)));
  return dt.toISOString().slice(0, 10);
}

function fingerprint(draft) {
  const title = String((draft && draft.sceneTitle) || '').trim();
  const summary = String((draft && draft.sceneSummary) || '').trim().slice(0, 80);
  return crypto.createHash('sha256').update(`${title}\n${summary}`).digest('hex').slice(0, 16);
}

function ensureTable(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS insight_daily_cases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      pack_date TEXT NOT NULL,
      category TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ready',
      created_at INTEGER NOT NULL
    )
  `).run();
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_insight_daily_ready
    ON insight_daily_cases (user_id, pack_date, category, status)
  `).run();
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_insight_daily_fp
    ON insight_daily_cases (user_id, category, fingerprint, pack_date)
  `).run();
  db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_insight_daily_fp_day_unique
    ON insight_daily_cases (user_id, category, pack_date, fingerprint)
  `).run();
}

function listReady(db, userId, packDate, category) {
  ensureTable(db);
  const rows = db.prepare(`
    SELECT id, fingerprint, payload_json, created_at
    FROM insight_daily_cases
    WHERE user_id = ? AND pack_date = ? AND category = ? AND status = 'ready'
    ORDER BY created_at ASC
  `).all(normalizeUserId(userId), packDate, normalizeCategory(category)) || [];
  return rows.map((row) => {
    const payload = JSON.parse(row.payload_json);
    return {
      id: row.id,
      fingerprint: row.fingerprint,
      createdAt: row.created_at,
      ...payload,
    };
  });
}

function recentFingerprints(db, userId, category, packDate, days = DEDUPE_DAYS) {
  ensureTable(db);
  const since = addDays(packDate, -(days - 1));
  const rows = db.prepare(`
    SELECT fingerprint FROM insight_daily_cases
    WHERE user_id = ? AND category = ? AND pack_date >= ?
  `).all(normalizeUserId(userId), normalizeCategory(category), since) || [];
  return new Set(rows.map((r) => r.fingerprint).filter(Boolean));
}

function insertCase(db, { userId, packDate, category, payload, fp }) {
  const id = `ins_${crypto.randomBytes(8).toString('hex')}`;
  try {
    db.prepare(`
      INSERT INTO insight_daily_cases
        (id, user_id, pack_date, category, fingerprint, payload_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'ready', ?)
    `).run(
      id,
      normalizeUserId(userId),
      packDate,
      normalizeCategory(category),
      fp,
      JSON.stringify(payload),
      Date.now(),
    );
    return id;
  } catch (err) {
    if (String(err && err.message).includes('UNIQUE')) return null;
    throw err;
  }
}

function countReady(db, userId, packDate, category) {
  ensureTable(db);
  const row = db.prepare(`
    SELECT COUNT(*) AS cnt FROM insight_daily_cases
    WHERE user_id = ? AND pack_date = ? AND category = ? AND status = 'ready'
  `).get(normalizeUserId(userId), packDate, normalizeCategory(category));
  return Number(row?.cnt || 0);
}

async function storeGenerated(db, {
  userId,
  packDate,
  category,
  generateFn = generateInsightScenario,
} = {}) {
  const cat = normalizeCategory(category);
  const exclude = recentFingerprints(db, userId, cat, packDate);
  let payload = await generateFn({ category: cat, userId: normalizeUserId(userId) });
  if (payload && payload.source === 'fallback') {
    return null;
  }
  let fp = fingerprint(payload.draft);
  if (exclude.has(fp)) {
    payload = await generateFn({ category: cat, userId: normalizeUserId(userId) });
    if (payload && payload.source === 'fallback') return null;
    fp = fingerprint(payload.draft);
  }
  if (exclude.has(fp)) {
    // ponytail: title suffix if 30d collision survives one retry
    payload.draft = {
      ...payload.draft,
      sceneTitle: `${payload.draft.sceneTitle || cat} · ${packDate}-${Date.now().toString(36)}`,
    };
    payload.scenario = flattenDraft(payload.draft);
    fp = fingerprint(payload.draft);
  }
  const id = insertCase(db, { userId, packDate, category: cat, payload, fp });
  if (!id) return null;
  return { id, fingerprint: fp, ...payload };
}

async function fillCategory(db, {
  userId,
  packDate,
  category,
  target = TARGET_PER_CATEGORY,
  generateFn = generateInsightScenario,
} = {}) {
  const cat = normalizeCategory(category);
  const date = packDate || dailyPackService.getPackDate();
  const added = [];
  while (countReady(db, userId, date, cat) < target) {
    const row = await storeGenerated(db, { userId, packDate: date, category: cat, generateFn });
    if (!row) break;
    added.push(row);
  }
  return { added, ready: listReady(db, userId, date, cat) };
}

function pruneExpired(db, packDate, days = DEDUPE_DAYS) {
  ensureTable(db);
  const cutoff = addDays(packDate, -days);
  const info = db.prepare('DELETE FROM insight_daily_cases WHERE pack_date < ?').run(cutoff);
  return Number(info?.changes || 0);
}

function getPool(db, { userId, category, packDate } = {}) {
  const date = packDate || dailyPackService.getPackDate();
  const cat = normalizeCategory(category);
  if (!cat) {
    const err = new Error('category required');
    err.statusCode = 400;
    throw err;
  }
  const cases = listReady(db, userId, date, cat);
  return {
    success: true,
    packDate: date,
    category: cat,
    target: TARGET_PER_CATEGORY,
    readyCount: cases.length,
    cases,
  };
}

module.exports = {
  CATEGORIES,
  TARGET_PER_CATEGORY,
  DEDUPE_DAYS,
  normalizeUserId,
  normalizeCategory,
  addDays,
  fingerprint,
  ensureTable,
  listReady,
  recentFingerprints,
  countReady,
  storeGenerated,
  fillCategory,
  pruneExpired,
  getPool,
};
