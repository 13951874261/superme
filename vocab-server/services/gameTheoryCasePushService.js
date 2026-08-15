const crypto = require('crypto');

const FALLBACK_CASES = [
  {
    id: 'corp-openai-board-72h',
    env: 'corp_clash',
    title: '董事会72小时突袭免职',
    dedupe_key: 'corp-openai-board-72h',
    background: '你是亚太区运营中层。非营利董事会在周五午间突然免职创始CEO，对外只称“沟通不够坦诚”。总裁当场辞职，最大商业绑定方是控股投资人。员工期权、产品路线和融资叙事同时承压。你必须在信息不完整时决定是否加入要求董事会辞职的公开信。',
    incomplete_info: '你不知道董事会是否握有不当行为实锤，也不确定大股东会保CEO还是保治理结构。',
    decision_point: '公开信今晚截止署名。署名可能换来集体保护，也可能在人数不够时被单独清算。你签还是不签？'
  },
  {
    id: 'corp-apple-1985-sculley',
    env: 'corp_clash',
    title: '创始人被董事会站队架空',
    dedupe_key: 'corp-apple-1985-sculley',
    background: '你是产品线总监。创始人请来的职业经理人CEO，在销售不及预期后收回运营权，把创始人“明升暗降”踢出业务线。创始人仍是第一大股东兼董事长，正私下接触骨干另起炉灶。董事会要你周五重组会前表态。',
    incomplete_info: '你不确定董事会是否已口头授权CEO重组，也不知道创始人是否已谈妥五名关键工程师。',
    decision_point: '会前要把产品路线备忘录直接抄送董事，还是先向CEO表忠、保住编制？'
  }
];

function parseCase(raw) {
  if (raw && typeof raw === 'object') return raw;
  const text = String(raw || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(text); } catch { return null; }
}

function isValidCase(value) {
  return value && typeof value === 'object'
    && typeof value.title === 'string' && value.title.trim()
    && typeof value.background === 'string' && value.background.length >= 80
    && typeof value.incomplete_info === 'string' && value.incomplete_info.length >= 20
    && typeof value.decision_point === 'string' && value.decision_point.length >= 20;
}

function normalizeCase(value, env) {
  const id = String(value.id || value.dedupe_key || 'generated-' + crypto.randomUUID());
  return {
    id,
    env: value.env || env,
    title: String(value.title).trim(),
    dedupe_key: String(value.dedupe_key || id),
    background: value.background,
    incomplete_info: value.incomplete_info,
    decision_point: value.decision_point
  };
}

function listStoredCatalog(db) {
  const catalog = new Map();
  for (const item of FALLBACK_CASES) {
    catalog.set(item.id, {
      id: item.id,
      env: item.env,
      title: item.title,
      dedupe_key: item.dedupe_key
    });
  }
  if (db && typeof db.prepare === 'function') {
    try {
      const rows = db.prepare('SELECT id, env, title, dedupe_key FROM game_theory_cases').all() || [];
      for (const row of rows) {
        if (!row || !row.id) continue;
        catalog.set(String(row.id), {
          id: String(row.id),
          env: row.env,
          title: String(row.title || '').trim(),
          dedupe_key: String(row.dedupe_key || row.id)
        });
      }
    } catch (error) {
      console.warn('[Game Theory Case Push] catalog query failed:', error.message);
    }
  }
  return [...catalog.values()];
}

function formatExistingCases(catalog) {
  return catalog.map((item) => `${item.id} | ${item.title} | ${item.dedupe_key}`).join('\n');
}

function conflictsWithCatalog(caseItem, catalog) {
  const title = String(caseItem.title || '').trim();
  const id = String(caseItem.id || '');
  const key = String(caseItem.dedupe_key || '');
  return catalog.some((item) =>
    item.id === id
    || item.dedupe_key === key
    || item.dedupe_key === id
    || (title && item.title === title)
  );
}

function saveGeneratedCase(db, item) {
  if (!db || typeof db.prepare !== 'function' || !item) return;
  db.prepare(`
    INSERT OR IGNORE INTO game_theory_cases
      (id, env, title, dedupe_key, background, incomplete_info, decision_point)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.id,
    item.env,
    item.title,
    item.dedupe_key,
    item.background,
    item.incomplete_info,
    item.decision_point
  );
}

async function generateWithDify({
  apiKey,
  baseUrl,
  env,
  avoidTopics,
  existingCases,
  userProfile,
  gameModel,
  fetchImpl
}) {
  if (!apiKey) return null;
  const doFetch = fetchImpl || fetch;
  const response = await doFetch(`${String(baseUrl || '').replace(/\/$/, '')}/workflows/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: {
        scene_type: env || 'corp_clash',
        game_model: gameModel || '',
        avoid_topics: (avoidTopics || []).join(', '),
        existing_cases: existingCases || '',
        user_profile: userProfile || '',
        generation_request: '生成一个与数据库已存案例完全不重复的高管斗争深案例'
      },
      response_mode: 'blocking',
      user: 'game-theory-case-generator'
    })
  });
  if (!response.ok) throw new Error(`Dify HTTP ${response.status}`);
  const payload = await response.json();
  const output = payload?.data?.outputs?.case_json
    ?? payload?.data?.outputs?.text
    ?? payload?.data?.outputs?.result;
  const parsed = parseCase(output);
  return isValidCase(parsed) ? normalizeCase(parsed, env) : null;
}

function initGameTheoryCasePushTables(db) {
  if (!db || typeof db.prepare !== 'function') return;
  db.prepare(`
    CREATE TABLE IF NOT EXISTS game_theory_cases (
      id TEXT PRIMARY KEY,
      env TEXT NOT NULL,
      title TEXT NOT NULL,
      dedupe_key TEXT NOT NULL,
      background TEXT NOT NULL,
      incomplete_info TEXT NOT NULL,
      decision_point TEXT NOT NULL
    )
  `).run();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO game_theory_cases
      (id, env, title, dedupe_key, background, incomplete_info, decision_point)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const item of FALLBACK_CASES) {
    insert.run(
      item.id,
      item.env,
      item.title,
      item.dedupe_key,
      item.background,
      item.incomplete_info,
      item.decision_point
    );
  }
}

function pickFallback(env, excludeIds = []) {
  const excluded = new Set(excludeIds);
  const pool = FALLBACK_CASES.filter((item) => item.env === env && !excluded.has(item.id));
  return pool[0] || FALLBACK_CASES.find((item) => item.env === env) || FALLBACK_CASES[0];
}

function pickFromDb(db, env, excludeIds = []) {
  if (!db || typeof db.prepare !== 'function') return null;
  const excluded = (excludeIds || []).filter(Boolean);
  let sql = 'SELECT * FROM game_theory_cases WHERE env = ?';
  const params = [env];
  if (excluded.length) {
    sql += ` AND id NOT IN (${excluded.map(() => '?').join(',')})`;
    params.push(...excluded);
  }
  sql += ' ORDER BY RANDOM() LIMIT 1';
  const row = db.prepare(sql).get(...params);
  return row || null;
}

function isExcluded(caseItem, excludeIds = []) {
  const excluded = new Set(excludeIds);
  return excluded.has(caseItem.id) || excluded.has(caseItem.dedupe_key);
}

function createService({ db, apiKey, baseUrl, fetchImpl } = {}) {
  return {
    async getCasePush({ env, excludeIds, userProfile, gameModel } = {}) {
      const catalog = listStoredCatalog(db);
      let generated = null;
      let source = 'dify';
      try {
        generated = await generateWithDify({
          apiKey,
          baseUrl,
          env,
          avoidTopics: excludeIds,
          existingCases: formatExistingCases(catalog),
          userProfile,
          gameModel,
          fetchImpl
        });
      } catch (error) {
        console.warn('[Game Theory Case Push] Dify generation failed:', error.message);
      }
      if (!generated || isExcluded(generated, excludeIds) || conflictsWithCatalog(generated, catalog)) {
        source = 'fallback';
        generated = pickFromDb(db, env, excludeIds) || pickFallback(env, excludeIds);
      } else {
        saveGeneratedCase(db, generated);
      }
      return { ...generated, source };
    }
  };
}

module.exports = { initGameTheoryCasePushTables, createService };
