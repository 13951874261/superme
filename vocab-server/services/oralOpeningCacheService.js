const crypto = require('crypto');
const dailyPackService = require('./dailyPackService');

const DEFAULT_CRON_THEME = '商务谈判：让步与施压';
const ROLE_SWITCH_INSTRUCTION =
  '你必须同时跟踪多个角色立场：识别盟友与阻力；每轮明确 role_address（当前面向谁说话）；可表现联合施压(joint_pressure)或暗中协助；管理会议节奏（引导、打断、总结、推进）。返回 JSON 须含 role_address、branch_suggestions、difficulty_rating、cultural_signal 及四维 feedback_* 字段。';

const THEME_TO_SCENE_ID = {
  '商务谈判：让步与施压': 'scene-1',
  '危机公关：外媒答疑': 'scene-2',
  '项目汇报：跨国董事会': 'scene-5',
};

/** 与前端 scenes.ts 中主题映射场景对齐的最小元数据 */
const SCENE_CATALOG = {
  'scene-1': {
    id: 'scene-1',
    shortTitle: '国际银团贷款谈判',
    level: 4,
    roleList: '我(牵头行) + 参团行A + 参团行B + 借款企业CFO',
    blockers: [{ name: 'CFO' }],
    conflicts: ['利率上浮 0.5%', '抵押物权属'],
    culturalContext:
      '美系主导（Action-oriented, Direct）。切忌过分谦逊，直面利益冲突并明确亮出 Bottom Line。',
    openingLine:
      "Gentlemen, let's address the rate adjustment first. Our IRR model doesn't absorb another fifty basis points without collateral restructuring.",
  },
  'scene-2': {
    id: 'scene-2',
    shortTitle: '危机公关媒体会',
    level: 5,
    roleList: '我(发言人) + 记者A + 记者B + 在线观众',
    blockers: [{ name: '记者A' }],
    conflicts: ['数据造假责任', '披露边界'],
    culturalContext: '欧系合规文化（Regulation-first）。强调程序正义与透明度。',
    openingLine:
      'We have evidence your subsidiary manipulated environmental data. Did the board know before the IPO prospectus went out?',
  },
  'scene-5': {
    id: 'scene-5',
    shortTitle: '董事会战略否决',
    level: 5,
    roleList: '我(CEO团队) + 创始人CEO + 大股东 + 独立董事',
    blockers: [{ name: '大股东' }],
    conflicts: ['6亿预算', '管理权争夺'],
    culturalContext: '多边复合博弈（Consensus-building）。需识别中、美、欧不同利益方诉求。',
    openingLine:
      'Major shareholders reject the six-billion overseas plan unless ROE targets are guaranteed. Independent directors want a fiduciary memo first.',
  },
};

function normalizeUserId(raw) {
  if (!raw) return 'default-user';
  const base = String(raw).split('@')[0].trim();
  return base || 'default-user';
}

function getOralSystemFormattedTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const val = (type) => parts.find((p) => p.type === type)?.value || '';
  const weekdayMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${val('year')}-${val('month')}-${val('day')} ${val('hour')}:${val('minute')}:${val('second')} ${weekdayMap[now.getDay()]}`;
}

function injectOralSystemTime(inputs = {}) {
  const base = typeof inputs === 'object' && inputs !== null ? { ...inputs } : {};
  if (!base._system_time) base._system_time = getOralSystemFormattedTime();
  if (base._system_timestamp_ms == null || base._system_timestamp_ms === '') {
    base._system_timestamp_ms = Date.now();
  }
  if (!base.theme) base.theme = DEFAULT_CRON_THEME;
  if (!base.genre) base.genre = 'meeting';
  if (!base.cefr_level) base.cefr_level = 'B1';
  if (!base.duration) base.duration = '15';
  return base;
}

function resolveSceneId({ theme, sceneId }) {
  if (sceneId && SCENE_CATALOG[sceneId]) return sceneId;
  const mapped = THEME_TO_SCENE_ID[String(theme || '').trim()];
  return mapped && SCENE_CATALOG[mapped] ? mapped : 'scene-1';
}

function getScene(sceneId) {
  return SCENE_CATALOG[sceneId] || SCENE_CATALOG['scene-1'];
}

function buildOpeningQuery(scene) {
  const opener = scene.openingLine;
  return `[系统隐性指令：切换场景「${scene.shortTitle}」。角色：${scene.roleList}。请由非用户角色率先开口（对话启动句），参考风格："${opener}"。用户尚未发言。必须在 JSON 返回 dialogue、current_speaker、role_address、branch_suggestions、difficulty_rating(${scene.level})、cultural_signal 及四维 feedback 字段。${ROLE_SWITCH_INSTRUCTION}]`;
}

function buildOralInputs(scene, theme) {
  return {
    scene_title: scene.shortTitle,
    scene_type: scene.shortTitle,
    roles: scene.roleList,
    cultural_context: scene.culturalContext,
    conflicts: scene.conflicts.join(' / '),
    role_switch_instruction: ROLE_SWITCH_INSTRUCTION,
    scene_level: String(scene.level),
    role_judgement: '未指定',
    intent_judgement: 'negotiation',
    theme: theme || DEFAULT_CRON_THEME,
  };
}

function initOralOpeningTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS oral_opening_cache (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      pack_date TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      theme TEXT NOT NULL,
      answer_text TEXT NOT NULL,
      conversation_id TEXT,
      status TEXT NOT NULL DEFAULT 'ready',
      source TEXT NOT NULL DEFAULT 'cron',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_oral_opening_user_day_scene
    ON oral_opening_cache (user_id, pack_date, scene_id)
  `);
}

function getCachedRow(db, { userId, packDate, sceneId }) {
  initOralOpeningTables(db);
  return db.prepare(`
    SELECT * FROM oral_opening_cache
    WHERE user_id = ? AND pack_date = ? AND scene_id = ? AND status = 'ready'
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(normalizeUserId(userId), packDate, sceneId);
}

function serializeOpening(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    packDate: row.pack_date,
    sceneId: row.scene_id,
    theme: row.theme,
    answer: row.answer_text,
    conversationId: row.conversation_id || null,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getOpening(db, { userId, packDate, theme, sceneId }) {
  const date = packDate || dailyPackService.getPackDate();
  const resolvedSceneId = resolveSceneId({ theme, sceneId });
  const row = getCachedRow(db, { userId, packDate: date, sceneId: resolvedSceneId });
  const opening = serializeOpening(row);
  return {
    success: true,
    ready: Boolean(opening),
    packDate: date,
    sceneId: resolvedSceneId,
    theme: theme || row?.theme || DEFAULT_CRON_THEME,
    opening,
  };
}

function upsertOpening(db, payload) {
  initOralOpeningTables(db);
  const now = Date.now();
  const uid = normalizeUserId(payload.userId);
  const existing = getCachedRow(db, {
    userId: uid,
    packDate: payload.packDate,
    sceneId: payload.sceneId,
  });
  const id = existing?.id || `oral_${crypto.randomBytes(8).toString('hex')}`;
  db.prepare(`
    INSERT INTO oral_opening_cache
      (id, user_id, pack_date, scene_id, theme, answer_text, conversation_id, status, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?)
    ON CONFLICT(user_id, pack_date, scene_id) DO UPDATE SET
      theme = excluded.theme,
      answer_text = excluded.answer_text,
      conversation_id = excluded.conversation_id,
      status = 'ready',
      source = excluded.source,
      updated_at = excluded.updated_at
  `).run(
    id,
    uid,
    payload.packDate,
    payload.sceneId,
    payload.theme,
    payload.answerText,
    payload.conversationId || null,
    payload.source || 'cron',
    existing?.created_at || now,
    now,
  );
  return getOpening(db, {
    userId: uid,
    packDate: payload.packDate,
    sceneId: payload.sceneId,
    theme: payload.theme,
  });
}

async function callDifyOpening({ userId, query, inputs, timeoutMs = 120000 }) {
  const apiKey = process.env.DIFY_ORAL_API_KEY;
  if (!apiKey) throw new Error('DIFY_ORAL_API_KEY missing');
  const baseUrl =
    process.env.DIFY_API_BASE_URL ||
    process.env.VITE_DIFY_API_BASE_URL ||
    'https://dify.234124123.xyz/v1';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: injectOralSystemTime(inputs),
        query,
        response_mode: 'blocking',
        user: normalizeUserId(userId),
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data.message || data.error || `Dify ${response.status}`;
      const err = new Error(msg);
      err.status = response.status;
      err.body = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function generateOpeningForUser(db, { userId, theme, packDate, sceneId, source = 'cron', force = false }) {
  const date = packDate || dailyPackService.getPackDate();
  const resolvedTheme = String(theme || DEFAULT_CRON_THEME).trim() || DEFAULT_CRON_THEME;
  const resolvedSceneId = resolveSceneId({ theme: resolvedTheme, sceneId });
  const scene = getScene(resolvedSceneId);

  if (!force) {
    const cached = getCachedRow(db, { userId, packDate: date, sceneId: resolvedSceneId });
    if (cached) {
      return { status: 'skipped', reason: 'already_cached', opening: serializeOpening(cached) };
    }
  }

  const query = buildOpeningQuery(scene);
  const inputs = buildOralInputs(scene, resolvedTheme);
  const data = await callDifyOpening({ userId, query, inputs });
  const answerText = String(data.answer || data.message || '').trim();
  if (!answerText) {
    throw new Error('empty opening answer');
  }

  const saved = upsertOpening(db, {
    userId,
    packDate: date,
    sceneId: resolvedSceneId,
    theme: resolvedTheme,
    answerText,
    conversationId: data.conversation_id || null,
    source,
  });
  return { status: 'ready', opening: saved.opening };
}

async function runDailyOralOpeningCronJob(db, options = {}) {
  const dailyListenPreGenerateService = require('./dailyListenPreGenerateService');
  const dailyCronRunService = require('./dailyCronRunService');
  const packDate = dailyPackService.getPackDate();
  const cronTickId = options.cronTickId || null;

  let users;
  if (cronTickId) {
    let ids = dailyCronRunService.listUserIdsForTick(db, cronTickId);
    if (options.userId) {
      const targetUid = dailyPackService.normalizeUserId(options.userId);
      ids = ids.filter((id) => dailyPackService.normalizeUserId(id) === targetUid);
    }
    users = ids.map((user_id) => {
      const pref = db.prepare(`
        SELECT theme FROM user_theme_prefs
        WHERE user_id = ? AND theme IS NOT NULL AND TRIM(theme) != ''
      `).get(user_id);
      return {
        user_id,
        theme: pref?.theme || DEFAULT_CRON_THEME,
        fallback: false,
      };
    });
  } else if (options.userId) {
    const targetUid = dailyPackService.normalizeUserId(options.userId);
    const pref = db.prepare(`
      SELECT theme FROM user_theme_prefs
      WHERE user_id = ? AND theme IS NOT NULL AND TRIM(theme) != ''
    `).get(targetUid);
    users = [{
      user_id: targetUid,
      theme: pref?.theme || DEFAULT_CRON_THEME,
      fallback: false,
    }];
  } else {
    users = dailyListenPreGenerateService.listCronTargetUsers(db);
  }

  const summary = {
    packDate,
    cronTickId,
    users: users.length,
    ok: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const row of users) {
    try {
      const result = await generateOpeningForUser(db, {
        userId: row.user_id,
        theme: row.theme,
        packDate,
        source: 'cron',
      });
      if (result.status === 'skipped') summary.skipped += 1;
      else summary.ok += 1;
    } catch (err) {
      summary.failed += 1;
      summary.errors.push({ userId: row.user_id, error: err.message || String(err) });
      console.warn('[OralOpening Cron] user=%s fail: %s', row.user_id, err.message);
    }
  }

  console.log('[OralOpening Cron] done', summary);
  return summary;
}

async function runBackfill(db, { userId, theme, sceneId, packDate, force = true }) {
  return generateOpeningForUser(db, {
    userId,
    theme,
    sceneId,
    packDate: packDate || dailyPackService.getPackDate(),
    source: 'backfill',
    force,
  });
}

module.exports = {
  DEFAULT_CRON_THEME,
  THEME_TO_SCENE_ID,
  SCENE_CATALOG,
  initOralOpeningTables,
  getOpening,
  generateOpeningForUser,
  runDailyOralOpeningCronJob,
  runBackfill,
  resolveSceneId,
};
