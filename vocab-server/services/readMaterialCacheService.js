const crypto = require('node:crypto');
const dailyPackService = require('./dailyPackService');
const { injectSystemDefaults } = require('./englishWorkflowProxy');

const SCENE_TYPES = ['policy', 'report', 'email', 'book'];
const SCENE_FRAMEWORKS = ['social', 'gov', 'corp'];

function ensureTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS read_material_cache (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, pack_date TEXT NOT NULL, theme TEXT NOT NULL,
    scene_type TEXT NOT NULL, scene_framework TEXT NOT NULL, body_text TEXT, status TEXT NOT NULL,
    quality_json TEXT, error_message TEXT, source TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    UNIQUE(user_id, pack_date, theme, scene_type, scene_framework)
  )`);
}

function normalize(input) {
  return {
    userId: dailyPackService.normalizeUserId(input.userId),
    packDate: input.packDate || dailyPackService.getPackDate(),
    theme: String(input.theme || '').trim(),
    sceneType: String(input.sceneType || '').trim(),
    sceneFramework: String(input.sceneFramework || '').trim(),
  };
}

function validate(parts) {
  if (!parts.theme || !SCENE_TYPES.includes(parts.sceneType) || !SCENE_FRAMEWORKS.includes(parts.sceneFramework)) {
    const error = new Error('invalid read material cache key');
    error.statusCode = 400;
    throw error;
  }
}

function row(db, parts) {
  ensureTable(db);
  return db.prepare(`SELECT * FROM read_material_cache
    WHERE user_id=? AND pack_date=? AND theme=? AND scene_type=? AND scene_framework=?`).get(
    parts.userId, parts.packDate, parts.theme, parts.sceneType, parts.sceneFramework,
  );
}

function get(db, input) {
  const parts = normalize(input); validate(parts);
  const found = row(db, parts);
  if (found?.status === 'ready') {
    try {
      const body = unpackMaterialText(found.body_text);
      if (body !== found.body_text) {
        const quality = defaultEvaluate(body);
        if (quality.quality !== 'ok') throw new Error('READ_MATERIAL_QUALITY_FAILED');
        found.body_text = body; found.quality_json = JSON.stringify(quality);
      }
    } catch (error) { found.status = 'failed'; found.error_message = error.message; }
  }
  return found ? {
    success: true, status: found.status, body: found.status === 'ready' ? found.body_text : null,
    quality: found.quality_json ? JSON.parse(found.quality_json) : null,
    error: found.error_message || null, packDate: parts.packDate,
  } : { success: true, status: 'missing', body: null, quality: null, error: null, packDate: parts.packDate };
}

function save(db, parts, patch) {
  ensureTable(db);
  const now = Date.now();
  db.prepare(`INSERT INTO read_material_cache
    (id,user_id,pack_date,theme,scene_type,scene_framework,body_text,status,quality_json,error_message,source,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id,pack_date,theme,scene_type,scene_framework) DO UPDATE SET
      body_text=excluded.body_text,status=excluded.status,quality_json=excluded.quality_json,
      error_message=excluded.error_message,source=excluded.source,updated_at=excluded.updated_at`).run(
    crypto.randomUUID(), parts.userId, parts.packDate, parts.theme, parts.sceneType, parts.sceneFramework,
    patch.body || null, patch.status, patch.quality ? JSON.stringify(patch.quality) : null,
    patch.error || null, patch.source || 'cron', now, now,
  );
}

function unpackMaterialText(text) {
  const raw = String(text || '').trim();
  const json = raw.replace(/^\x60\x60\x60(?:json)?\s*([\s\S]*?)\s*\x60\x60\x60$/i, '$1');
  if (!/^[{\[]/.test(json)) return raw;
  let payload;
  try { payload = JSON.parse(json); }
  catch { throw new Error('READ_MATERIAL_JSON_INVALID'); }
  let body = ['article', 'body', 'content', 'text', 'hidden_intent']
    .map((key) => payload?.[key]).find((value) => typeof value === 'string' && value.trim());
  const dialogue = payload?.dialogue;
  // ponytail: 仅接纳达到正文长度门槛的 dialogue；新结构出现时补契约。
  if (typeof dialogue === 'string' && dialogue.replace(/\s+/g, '').length >= 1500
    && (!body || (body === payload.hidden_intent && !body.includes('以下为虚构训练文件正文') && dialogue.length > body.length))) body = dialogue;
  if (!body) throw new Error('READ_MATERIAL_BODY_MISSING');
  // ponytail: 仅剥离已观察到的口语正文标记；新增上游格式时补契约。
  return body.replace(/^[\s\S]*?以下为虚构训练文件正文[。:：]?\s*/, '').trim();
}

function defaultEvaluate(text) {
  const raw = String(text || '');
  const charCount = raw.replace(/\s+/g, '').length;
  const clauses = raw.match(/(?:第[一二三四五六七八九十百\d]+条|[（(][一二三四五六七八九十\d]+[)）]|^\s*\d+[\.、])/gm) || [];
  const numbers = raw.match(/\d+(?:\.\d+)?/g) || [];
  const parties = ['甲方', '乙方', '监管', '某企业', '某省', '某市', '某局', '董事会', '法务', '合规', '投资者', '供应商'].filter((word) => raw.includes(word));
  const unsafeCitation = /(?:(?:国发|国办发|银保监|银发|证监|发改|财税)[〔[（(]\d{4}[〕\]）)]\s*(?:\d+号)?|《中华人民共和国[^\n《》]{2,20}法》\s*第[一二三四五六七八九十\d]+条)/.test(raw.replace(/〔训练〕/g, ''));
  const densityOk = (raw.split(/\n+/).filter((line) => line.trim()).length >= 4 || clauses.length >= 2)
    && (numbers.length >= 3 || clauses.length >= 2) && new Set(parties).size >= 2 && !unsafeCitation;
  return { quality: charCount >= 1500 && densityOk ? 'ok' : 'below_standard', charCount, densityOk, citationOk: !unsafeCitation };
}

async function generateOne(db, input) {
  const parts = normalize(input); validate(parts);
  save(db, parts, { status: 'generating', source: input.source });
  let text = ''; let quality = null;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        text = unpackMaterialText(await input.generateFn(parts));
      } catch (error) {
        const transient = ['AbortError', 'TimeoutError'].includes(error.name)
          || ['ECONNRESET', 'ETIMEDOUT', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT'].includes(error.cause?.code || error.code);
        if (attempt !== 0 || !transient) throw error;
        continue;
      }
      quality = (input.evaluateFn || defaultEvaluate)(text);
      if (quality.quality === 'ok') break;
    }
    if (quality?.quality !== 'ok') throw new Error('READ_MATERIAL_QUALITY_FAILED');
    save(db, parts, { status: 'ready', body: text, quality, source: input.source });
  } catch (error) {
    save(db, parts, { status: 'failed', quality, error: error.message || String(error), source: input.source });
  }
  return get(db, parts);
}

const inflight = new Map();

async function getOrGenerate(db, input) {
  const parts = normalize(input); validate(parts);
  const cached = get(db, parts);
  if (cached.status === 'ready') return cached;
  const key = [parts.userId, parts.packDate, parts.theme, parts.sceneType, parts.sceneFramework].join('\u001f');
  if (inflight.has(key)) return inflight.get(key);
  const job = generateOne(db, { ...input, ...parts, source: input.source || 'on_demand' })
    .finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

async function generateAllForUser(db, input) {
  const combos = SCENE_TYPES.flatMap((sceneType) => SCENE_FRAMEWORKS.map((sceneFramework) => ({ sceneType, sceneFramework })));
  const requested = Number(input.concurrency ?? process.env.DAILY_READ_MATERIAL_CONCURRENCY ?? 2);
  const concurrency = Number.isInteger(requested) ? Math.min(4, Math.max(1, requested)) : 2;
  let ready = 0; let failed = 0; let skipped = 0; let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < combos.length) {
      const combo = combos[next]; next += 1;
      const parts = { ...input, ...combo };
      if (get(db, parts).status === 'ready') { skipped += 1; continue; }
      const result = await generateOne(db, parts);
      if (result.status === 'ready') ready += 1; else failed += 1;
    }
  }));
  return { ready, failed, skipped, total: 12 };
}

function buildQuery({ sceneType, sceneFramework }) {
  const frameworkName = { social: '通用社交', gov: '体制内职场', corp: '跨国企业' }[sceneFramework];
  const typeName = { policy: '宏观政策精神/地方监管文件', report: '商业案例与出海财报原文/通报', email: '跨国邮件/西式职场函件与争议备忘录', book: '经典战略书籍精读或高阶认知随笔' }[sceneType];
  return `你是顶级商务与认知穿透教官。直接生成一篇【${typeName}】仿真原文，场景框架【${frameworkName}】。禁止摘要、导读、开场白。正文去空白不少于1500字；包含具体条款或数据、至少两个利益相关方及真实立场冲突；机关名、单位名、文号必须使用“某省”“某局”“某企业”“〔训练〕”等虚构占位符。`;
}

async function generateWithDify(parts) {
  const apiKey = process.env.DIFY_ORAL_API_KEY;
  if (!apiKey) throw new Error('DIFY_ORAL_API_KEY missing');
  const baseUrl = process.env.DIFY_API_BASE_URL || process.env.VITE_DIFY_API_BASE_URL || 'https://dify.234124123.xyz/v1';
  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Number(process.env.DIFY_READ_MATERIAL_TIMEOUT_MS) || 300000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: injectSystemDefaults({ theme: parts.theme, genre: 'reading', cefr_level: 'B2', duration: '15' }),
        query: buildQuery(parts), response_mode: 'blocking', user: parts.userId,
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || `Dify ${response.status}`);
    const text = unpackMaterialText(data.answer || data.message || '');
    if (!text) throw new Error('empty read material');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function runDailyCron(db, { users, generateFn = generateWithDify, cronTickId } = {}) {
  const list = users || require('./dailyListenPreGenerateService').listCronTargetUsers(db);
  const packDate = dailyPackService.getPackDate();
  const results = [];
  const cronRuns = cronTickId ? require('./dailyCronRunService') : null;
  for (const user of list) {
    const run = cronRuns?.getRunByTickUser(db, cronTickId, user.user_id);
    const unitTotal = run ? cronRuns.getRunUnitTotal(run) + 1 : null;
    if (run) {
      cronRuns.upsertStep(db, {
        runId: run.id, userId: user.user_id, module: 'read_material', status: 'running', progress: 0, startedAt: Date.now(),
        inputs: { theme: user.theme, packDate },
      });
      cronRuns.refreshRunAggregation(db, run.id, { unitTotal });
    }
    const result = await generateAllForUser(db, {
      userId: user.user_id, theme: user.theme, packDate, generateFn, source: 'cron',
    });
    results.push(result);
    if (run) {
      cronRuns.upsertStep(db, {
        runId: run.id, userId: user.user_id, module: 'read_material',
        status: result.failed ? 'failed' : 'completed', progress: 100,
        errorMessage: result.failed ? `failed=${result.failed}` : null,
        resultSummary: result, finishedAt: Date.now(),
      });
      cronRuns.refreshRunAggregation(db, run.id, { unitTotal });
    }
  }
  return { packDate, users: list.length, results };
}

module.exports = { SCENE_TYPES, SCENE_FRAMEWORKS, ensureTable, get, getOrGenerate, generateOne, generateAllForUser, generateWithDify, runDailyCron };
