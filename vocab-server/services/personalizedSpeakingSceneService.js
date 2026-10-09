const crypto = require('node:crypto');
const { createWorkflowRunner } = require('./englishWorkflowProxy');
const { buildInjectedUserCurrentProfile } = require('./profileInject');

const TYPES = new Set(['multi_role', 'impromptu']);
const MAX_DAILY_SCENES = 10;
const TEXT_LIMITS = { title: 120, topic: 200, opening: 1000 };
const MAX_CONTENT_BYTES = 64 * 1024;
const HTML_TAG = /<\/?[A-Za-z][^>]*>/;
const DANGEROUS_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const SCHEMAS = {
  multi_role: {
    fields: ['title', 'background', 'roles', 'conflict', 'objective', 'tasks', 'opening'],
    arrays: { roles: [2, 6], tasks: [1, 8] },
  },
  impromptu: {
    fields: ['topic', 'background', 'identity', 'audience', 'objective', 'conflict', 'structure', 'points', 'keywords', 'opening'],
    arrays: { structure: [2, 8], points: [1, 10], keywords: [1, 15] },
  },
};

function requiredText(value, field, limit = TEXT_LIMITS[field] || 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) {
    throw new Error(`${field} 必须是 1..${limit} 字符的非空文本`);
  }
  if (HTML_TAG.test(value)) throw new Error(`${field} 不允许 HTML 标签`);
  if (DANGEROUS_CONTROL.test(value)) throw new Error(`${field} 不允许危险控制字符`);
  return value.trim();
}

function textArray(value, field, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new Error(`${field} 必须包含 ${min}..${max} 项`);
  }
  return value.map((item) => requiredText(item, field, 300));
}

function validateSpeakingScene(sceneType, content) {
  if (!TYPES.has(sceneType)) throw new Error('sceneType 必须是 multi_role 或 impromptu');
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error('content 必须是对象');
  if (Buffer.byteLength(JSON.stringify(content), 'utf8') > MAX_CONTENT_BYTES) {
    throw new Error('content UTF8 JSON 不能超过 64KiB');
  }
  const schema = SCHEMAS[sceneType];
  const extra = Object.keys(content).find((key) => !schema.fields.includes(key));
  if (extra) throw new Error(`不允许额外字段 ${extra}`);
  const missing = schema.fields.find((key) => !Object.hasOwn(content, key));
  if (missing) throw new Error(`缺少字段 ${missing}`);

  const normalized = {};
  for (const field of schema.fields) {
    if (field === 'roles') {
      const [min, max] = schema.arrays.roles;
      if (!Array.isArray(content.roles) || content.roles.length < min || content.roles.length > max) {
        throw new Error(`roles 必须包含 ${min}..${max} 项`);
      }
      normalized.roles = content.roles.map((role) => {
        if (!role || typeof role !== 'object' || Array.isArray(role)) throw new Error('roles 项必须是对象');
        const allowed = ['name', 'identity', 'stance', 'roleType'];
        const roleExtra = Object.keys(role).find((key) => !allowed.includes(key));
        if (roleExtra) throw new Error(`roles 不允许额外字段 ${roleExtra}`);
        const roleType = requiredText(role.roleType, 'roles.roleType', 20);
        if (!['ally', 'blocker', 'neutral'].includes(roleType)) throw new Error('roles.roleType 必须是 ally、blocker 或 neutral');
        return {
          name: requiredText(role.name, 'roles.name', 100),
          identity: requiredText(role.identity, 'roles.identity', 300),
          stance: requiredText(role.stance, 'roles.stance', 300),
          roleType,
        };
      });
      if (!normalized.roles.some((role) => role.roleType === 'blocker')) throw new Error('roles 至少需要一个 blocker');
    } else if (schema.arrays[field]) {
      normalized[field] = textArray(content[field], field, ...schema.arrays[field]);
    } else {
      normalized[field] = requiredText(content[field], field);
    }
  }
  return normalized;
}

function contentHash(sceneType, content) {
  return crypto.createHash('sha256').update(`${sceneType}\n${JSON.stringify(content)}`).digest('hex');
}

function initPersonalizedSpeakingSceneTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS personalized_speaking_scenes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      scene_date TEXT NOT NULL,
      scene_type TEXT NOT NULL CHECK (scene_type IN ('multi_role', 'impromptu')),
      content_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      profile_hash TEXT NOT NULL DEFAULT '',
      use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
      last_used_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (user_id, scene_date, content_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_personalized_speaking_scenes_lookup
      ON personalized_speaking_scenes(user_id, scene_date, scene_type, created_at, id);
    CREATE INDEX IF NOT EXISTS idx_personalized_speaking_scenes_recent_use
      ON personalized_speaking_scenes(user_id, last_used_at);
    CREATE TRIGGER IF NOT EXISTS trg_personalized_speaking_scenes_daily_limit
    BEFORE INSERT ON personalized_speaking_scenes
    WHEN (SELECT COUNT(*) FROM personalized_speaking_scenes
          WHERE user_id = NEW.user_id AND scene_date = NEW.scene_date) >= 10
    BEGIN
      SELECT RAISE(ABORT, '每用户每日场景不能超过 10 个');
    END;
  `);
}

function validateIdentity({ userId, sceneDate }) {
  const user = requiredText(userId, 'userId', 200);
  const value = String(sceneDate || '');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('sceneDate 必须是真实的 YYYY-MM-DD 日期');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('sceneDate 必须是真实的 YYYY-MM-DD 日期');
  }
  return { userId: user, sceneDate: value };
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    sceneDate: row.scene_date,
    sceneType: row.scene_type,
    content: JSON.parse(row.content_json),
    contentHash: row.content_hash,
    profileHash: row.profile_hash,
    useCount: Number(row.use_count),
    lastUsedAt: row.last_used_at == null ? null : Number(row.last_used_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function listSpeakingScenes(db, { userId, sceneDate, sceneType } = {}) {
  const identity = validateIdentity({ userId, sceneDate });
  if (sceneType !== undefined && !TYPES.has(sceneType)) throw new Error('sceneType 必须是 multi_role 或 impromptu');
  const rows = sceneType === undefined
    ? db.prepare(`SELECT * FROM personalized_speaking_scenes WHERE user_id = ? AND scene_date = ? ORDER BY created_at, id`).all(identity.userId, identity.sceneDate)
    : db.prepare(`SELECT * FROM personalized_speaking_scenes WHERE user_id = ? AND scene_date = ? AND scene_type = ? ORDER BY created_at, id`).all(identity.userId, identity.sceneDate, sceneType);
  return rows.map(mapRow);
}

function dateStartUtc(sceneDate, offsetDays = 0) {
  const [year, month, day] = sceneDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day + offsetDays);
}

function getDailyAllocation(db, { userId, sceneDate } = {}) {
  const identity = validateIdentity({ userId, sceneDate });
  const since = new Date(dateStartUtc(identity.sceneDate, -6)).toISOString().slice(0, 10);
  const rows = db.prepare(`SELECT scene_type, SUM(use_count) AS uses
    FROM personalized_speaking_scenes
    WHERE user_id = ? AND scene_date >= ? AND scene_date <= ?
    GROUP BY scene_type`).all(identity.userId, since, identity.sceneDate);
  const counts = Object.fromEntries(rows.map((row) => [row.scene_type, Number(row.uses)]));
  const total = (counts.multi_role || 0) + (counts.impromptu || 0);
  if (!total) return { multi_role: 5, impromptu: 5 };
  const multi = Math.max(2, Math.min(8, Math.round(MAX_DAILY_SCENES * (counts.multi_role || 0) / total)));
  return { multi_role: multi, impromptu: MAX_DAILY_SCENES - multi };
}

function saveSpeakingScene(db, {
  id, userId, sceneDate, sceneType, content, profileHash = '', currentSceneId, now = Date.now(),
} = {}) {
  const identity = validateIdentity({ userId, sceneDate });
  const sceneId = requiredText(id, 'id', 200);
  const normalized = validateSpeakingScene(sceneType, content);
  const profile = String(profileHash || '');
  if (profile.length > 128) throw new Error('profileHash 不能超过 128 字符');
  const json = JSON.stringify(normalized);
  const hash = contentHash(sceneType, normalized);

  return db.transaction(() => {
    const duplicate = db.prepare(`SELECT id FROM personalized_speaking_scenes
      WHERE user_id = ? AND scene_date = ? AND content_hash = ?`).get(identity.userId, identity.sceneDate, hash);
    if (duplicate && duplicate.id !== currentSceneId) throw new Error('当天场景内容重复');
    const count = Number(db.prepare(`SELECT COUNT(*) AS count FROM personalized_speaking_scenes
      WHERE user_id = ? AND scene_date = ?`).get(identity.userId, identity.sceneDate).count);
    if (count < MAX_DAILY_SCENES) {
      const allocation = getDailyAllocation(db, identity);
      const typeCount = Number(db.prepare(`SELECT COUNT(*) AS count FROM personalized_speaking_scenes
        WHERE user_id = ? AND scene_date = ? AND scene_type = ?`)
        .get(identity.userId, identity.sceneDate, sceneType).count);
      if (typeCount >= allocation[sceneType]) {
        throw new Error(`${sceneType} 已达到当日类型配额 ${allocation[sceneType]}`);
      }
      db.prepare(`INSERT INTO personalized_speaking_scenes
        (id, user_id, scene_date, scene_type, content_json, content_hash, profile_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(sceneId, identity.userId, identity.sceneDate, sceneType, json, hash, profile, now, now);
      return mapRow(db.prepare('SELECT * FROM personalized_speaking_scenes WHERE id = ? AND user_id = ?').get(sceneId, identity.userId));
    }
    if (!currentSceneId) throw new Error('每日场景已达到 10 个，必须指定 currentSceneId');
    const current = db.prepare(`SELECT * FROM personalized_speaking_scenes
      WHERE id = ? AND user_id = ? AND scene_date = ?`).get(currentSceneId, identity.userId, identity.sceneDate);
    if (!current) throw new Error('当前场景不存在或不属于该用户');
    if (current.scene_type !== sceneType) throw new Error('当前场景类型不匹配');
    db.prepare(`UPDATE personalized_speaking_scenes
      SET content_json = ?, content_hash = ?, profile_hash = ?, use_count = 0,
          last_used_at = NULL, updated_at = ?
      WHERE id = ? AND user_id = ? AND scene_date = ?`)
      .run(json, hash, profile, now, currentSceneId, identity.userId, identity.sceneDate);
    return mapRow(db.prepare('SELECT * FROM personalized_speaking_scenes WHERE id = ? AND user_id = ?').get(currentSceneId, identity.userId));
  })();
}

function recordSpeakingSceneUse(db, { userId, sceneId, now = Date.now() } = {}) {
  const user = requiredText(userId, 'userId', 200);
  const id = requiredText(sceneId, 'sceneId', 200);
  const result = db.prepare(`UPDATE personalized_speaking_scenes
    SET use_count = use_count + 1, last_used_at = ?, updated_at = ?
    WHERE id = ? AND user_id = ?`).run(now, now, id, user);
  if (!result.changes) throw new Error('场景不存在或不属于该用户');
  return mapRow(db.prepare('SELECT * FROM personalized_speaking_scenes WHERE id = ? AND user_id = ?').get(id, user));
}

function nextSpeakingScene(db, { userId, sceneDate, sceneType, currentSceneId } = {}) {
  const rows = listSpeakingScenes(db, { userId, sceneDate, sceneType });
  if (!rows.length) return null;
  if (!currentSceneId) return rows[0];
  const index = rows.findIndex((row) => row.id === currentSceneId);
  if (index < 0) return rows[0];
  return rows.length > 1 ? rows[(index + 1) % rows.length] : null;
}

function normalizeUserId(raw) {
  if (!raw) return 'default-user';
  const value = String(raw).trim();
  return value || 'default-user';
}

function createSceneId(userId, sceneDate, sceneType) {
  return `scene_${crypto.createHash('sha256').update(`${userId}\n${sceneDate}\n${sceneType}\n${crypto.randomUUID()}`).digest('hex').slice(0, 24)}`;
}

function historyForType(db, { userId, sceneDate, sceneType }) {
  return listSpeakingScenes(db, { userId, sceneDate, sceneType }).map((row) => (
    row.content.title || row.content.topic || row.contentHash
  ));
}

async function runSpeakingSceneGeneration({
  db, userId, sceneDate, sceneType, currentSceneId, generate,
}) {
  const existing = listSpeakingScenes(db, { userId, sceneDate });
  const generated = await generate({
    db, userId, sceneType, count: 1,
    historyExclude: historyForType(db, { userId, sceneDate, sceneType }),
  });
  if (!generated.length) throw new Error('场景生成结果为空');
  return saveSpeakingScene(db, {
    id: createSceneId(userId, sceneDate, sceneType),
    userId, sceneDate, sceneType, content: generated[0],
    profileHash: crypto.createHash('sha256').update(buildInjectedUserCurrentProfile(db, userId)).digest('hex'),
    currentSceneId: existing.length >= MAX_DAILY_SCENES ? currentSceneId : undefined,
  });
}

function createSpeakingSceneTaskManager({ db, taskQueue, generate }) {
  const active = new Map();
  function enqueue({ userId, sceneDate, sceneType, currentSceneId }) {
    const key = `${userId}\n${sceneDate}\n${sceneType}\n${currentSceneId || ''}`;
    const priorId = active.get(key);
    const prior = priorId && taskQueue.getTask(priorId);
    if (prior && (prior.status === 'pending' || prior.status === 'running')) return prior;

    const task = taskQueue.createTask('speaking_scene', `生成口语场景 ${sceneType}`);
    taskQueue.updateTask(task.id, { userId });
    active.set(key, task.id);
    setImmediate(async () => {
      taskQueue.updateTask(task.id, { status: 'running', progress: 10 });
      try {
        const saved = await runSpeakingSceneGeneration({
          db, userId, sceneDate, sceneType, currentSceneId, generate,
        });
        taskQueue.updateTask(task.id, { status: 'completed', progress: 100, result: { scene: saved } });
      } catch (error) {
        taskQueue.updateTask(task.id, { status: 'failed', progress: 100, error: error.message || String(error) });
      } finally {
        if (active.get(key) === task.id) active.delete(key);
      }
    });
    return task;
  }
  return { enqueue };
}

function determineSpeakingSceneStepOutcome(result) {
  const failedTypes = Array.isArray(result?.failedTypes) ? result.failedTypes : [];
  if (failedTypes.length) return { status: 'failed', errorMessage: `failed types: ${failedTypes.join(',')}` };
  if (result?.generated === 0 && result?.total >= MAX_DAILY_SCENES) return { status: 'skipped', errorMessage: null };
  if (result?.generated === 0) return { status: 'failed', errorMessage: 'no scenes generated' };
  return { status: 'completed', errorMessage: null };
}

function writeSse(res, event, payload) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function createSpeakingSceneApiRouter({ db, taskQueue, generate, getSceneDate }) {
  const express = require('express');
  const router = express.Router();
  const tasks = createSpeakingSceneTaskManager({ db, taskQueue, generate });
  const identity = (req) => ({
    userId: normalizeUserId(req.body?.userId || req.query?.userId),
    sceneDate: String(req.body?.sceneDate || req.query?.sceneDate || getSceneDate()),
  });
  const enqueue = (req) => {
    const owner = identity(req);
    return tasks.enqueue({
      ...owner,
      sceneType: req.body?.sceneType,
      currentSceneId: req.body?.currentSceneId,
    });
  };

  router.get('/', (req, res) => {
    try { res.json({ scenes: listSpeakingScenes(db, { ...identity(req), sceneType: req.query.sceneType }) }); }
    catch (error) { res.status(400).json({ error: error.message }); }
  });
  router.post('/switch', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    });
    try {
      const owner = identity(req);
      const next = nextSpeakingScene(db, {
        ...owner,
        sceneType: req.body?.sceneType,
        currentSceneId: req.body?.currentSceneId,
      });
      if (next) writeSse(res, 'scene', { scene: next });
      else writeSse(res, 'task', { taskId: enqueue(req).id, currentSceneId: req.body?.currentSceneId || null });
      if (!res.destroyed) res.end();
    } catch (error) {
      if (!res.destroyed) {
        writeSse(res, 'error', { error: error.message });
        res.end();
      }
    }
  });
  router.post('/regenerate', (req, res) => {
    try {
      const task = enqueue(req);
      res.json({ taskId: task.id, status: task.status });
    } catch (error) { res.status(400).json({ error: error.message }); }
  });
  router.get('/tasks/:taskId', (req, res) => {
    const task = taskQueue.getTask(req.params.taskId);
    if (!task || task.type !== 'speaking_scene' || task.userId !== identity(req).userId) {
      return res.status(404).json({ error: '任务不存在或不属于该用户' });
    }
    return res.json({ task });
  });
  router.post('/:sceneId/use', (req, res) => {
    try { res.json({ scene: recordSpeakingSceneUse(db, { userId: identity(req).userId, sceneId: req.params.sceneId }) }); }
    catch (error) { res.status(404).json({ error: error.message }); }
  });
  return router;
}

async function runSpeakingSceneCronForUser({ db, userId, sceneDate, generate }) {
  const uid = normalizeUserId(userId);
  const allocation = getDailyAllocation(db, { userId: uid, sceneDate });
  const existing = listSpeakingScenes(db, { userId: uid, sceneDate });
  let remaining = Math.max(0, MAX_DAILY_SCENES - existing.length);
  const jobs = [];
  for (const sceneType of TYPES) {
    const count = existing.filter((row) => row.sceneType === sceneType).length;
    const missing = Math.min(remaining, Math.max(0, allocation[sceneType] - count));
    remaining -= missing;
    if (missing) jobs.push({ sceneType, missing });
  }

  const settled = await Promise.allSettled(jobs.map(async ({ sceneType, missing }) => {
    const scenes = await generate({
      db, userId: uid, sceneType, count: missing,
      historyExclude: historyForType(db, { userId: uid, sceneDate, sceneType }),
    });
    let saved = 0;
    for (const content of scenes.slice(0, missing)) {
      saveSpeakingScene(db, {
        id: createSceneId(uid, sceneDate, sceneType), userId: uid, sceneDate, sceneType, content,
        profileHash: crypto.createHash('sha256').update(buildInjectedUserCurrentProfile(db, uid)).digest('hex'),
      });
      saved += 1;
    }
    return saved;
  }));
  const generated = settled.reduce((sum, item) => sum + (item.status === 'fulfilled' ? item.value : 0), 0);
  const failedTypes = settled.flatMap((item, index) => item.status === 'rejected' ? [jobs[index].sceneType] : []);
  return {
    generated,
    failedTypes,
    total: listSpeakingScenes(db, { userId: uid, sceneDate }).length,
    allocation,
  };
}

function createSpeakingSceneGenerator({
  runWorkflow = createWorkflowRunner({
    apiKey: process.env.DIFY_SPEAKING_SCENES_API_KEY,
    baseUrl: process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1',
  }),
  timeoutMs = 60000,
  logger = console,
} = {}) {
  return async function generate({
    db, userId, sceneType, count, currentTheme = '', cefrLevel = '', trainingGoal = '',
    recentWeaknesses = [], historyExclude = [],
  } = {}) {
    if (!TYPES.has(sceneType)) throw new Error('sceneType 必须是 multi_role 或 impromptu');
    if (!Number.isInteger(count) || count < 1 || count > MAX_DAILY_SCENES) throw new Error('count 必须是 1..10 的整数');
    if (count > 1) {
      return (await Promise.all(Array.from({ length: count }, () => generate({
        db, userId, sceneType, count: 1, currentTheme, cefrLevel, trainingGoal, recentWeaknesses, historyExclude,
      })))).flat();
    }
    const profile = buildInjectedUserCurrentProfile(db, userId);
    const profileHash = crypto.createHash('sha256').update(profile).digest('hex');
    logger.info('[speaking-scene-generator]', {
      profile_present: Boolean(profile), profile_length: profile.length, profile_hash: profileHash,
    });
    const controller = new AbortController();
    const request = runWorkflow({
      inputs: {
        scene_type: sceneType,
        count,
        current_theme: String(currentTheme),
        cefr_level: String(cefrLevel),
        training_goal: String(trainingGoal),
        recent_weaknesses: JSON.stringify(recentWeaknesses),
        user_current_profile: profile,
        history_exclude: JSON.stringify(historyExclude),
      },
      userId,
      responseMode: 'blocking',
      signal: controller.signal,
    });
    let payload;
    let timeout;
    let timedOut = false;
    try {
      payload = await Promise.race([
        request,
        new Promise((_, reject) => {
          timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
            reject(new Error('场景生成超时'));
          }, timeoutMs);
        }),
      ]);
    } catch (error) {
      logger.error('[speaking-scene-generator]', {
        category: timedOut ? 'timeout' : 'workflow_error',
        status: Number(error?.statusCode || error?.status || 0) || undefined,
      });
      if (timedOut) throw new Error('场景生成超时');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    const status = payload?.data?.status;
    if (status !== 'succeeded') throw new Error(`workflow 状态不可接受: ${status || 'missing'}`);
    const raw = payload?.data?.outputs?.result;
    if (raw == null || raw === '') throw new Error('场景生成结果为空');
    let scenes;
    try {
      scenes = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      throw new Error('场景生成结果不是有效 JSON');
    }
    if (!Array.isArray(scenes) || scenes.length !== count) throw new Error('场景生成数量不符');
    return scenes.map((scene) => validateSpeakingScene(sceneType, scene));
  };
}

module.exports = {
  MAX_DAILY_SCENES,
  contentHash,
  createSpeakingSceneApiRouter,
  createSpeakingSceneGenerator,
  determineSpeakingSceneStepOutcome,
  getDailyAllocation,
  initPersonalizedSpeakingSceneTable,
  listSpeakingScenes,
  nextSpeakingScene,
  normalizeUserId,
  recordSpeakingSceneUse,
  runSpeakingSceneCronForUser,
  saveSpeakingScene,
  validateSpeakingScene,
};
