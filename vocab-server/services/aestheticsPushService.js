const crypto = require('crypto');

const RETENTION_DAYS = 7;
const DEFAULT_SCOPE = 'mixed';

const FALLBACK_SCENARIOS = [
  ['art-gallery', '艺术展闭幕式中的含蓄社交', '高端文化社交', '先谈观看感受，再谈判断；不以价格替代审美。'],
  ['tea-room', '茶席中的谈话节奏控制', '中式雅集', '七分茶三分情，续茶时用克制的回礼保持交流节奏。'],
  ['auction', '拍卖预展中的价值判断', '收藏品社交', '先询问来源与工艺，再表达偏好，不抢先判断价格。'],
  ['opera', '歌剧散场后的跨文化谈资', '古典艺术社交', '从具体乐章和现场感受切入，避免背诵式炫耀知识。'],
  ['golf', '高尔夫球场上的失误应对', '轻商务社交', '把失误处理为节奏管理，不抱怨、不急于证明实力。'],
  ['dinner', '私人家宴中的座次与敬酒', '政商务礼仪', '先观察主宾关系和主人节奏，再决定发言与敬酒顺序。'],
  ['cigar', '雪茄会所中的边界感', '高端休闲社交', '尊重对方品鉴节奏，不主动纠正他人选择，不把消费当身份证明。'],
  ['museum', '博物馆专场中的低声交流', '公共文化社交', '用具体细节表达兴趣，控制音量和停留时间，给他人留出观看空间。'],
  ['dress', '正式晚宴的着装色彩分寸', '场合审美', '优先服从场合等级和主宾信息，不让服装成为抢夺注意力的工具。'],
  ['flowers', '商务会面中的花艺话题', '日常审美社交', '以季节、空间和照料谈花，不用昂贵与否直接评价品位。'],
  ['wine', '红酒品鉴中的克制表达', '餐桌审美', '描述香气和口感即可，不把个人偏好包装成专业结论。'],
  ['calligraphy', '书法雅集中的作品交流', '传统文化社交', '先说气息、章法和观看感受，再提出问题，不贸然下定论。']
].map(([slug, title, type, principle], index) => ({
  scenario_id: `fallback-${slug}`,
  category: index % 3 === 0 ? 'social' : 'aesthetics',
  title,
  type,
  description: principle,
  background: `在${title}的真实交流中，参与者需要判断场合规则、关系距离和发言时机，并用克制而具体的表达建立信任。`,
  rules: ['先观察场合和关系结构', '先描述事实再表达判断', '给对方留下回应空间'],
  temper: '保持松弛、克制和开放。不要急于证明自己知道更多，也不要把个人偏好强行上升为统一标准。',
  dialogue_example: '我更关注现场呈现出的细节和交流节奏，也想听听您最在意的部分。',
  traps: ['不懂装懂并堆砌术语', '抢话或过早下结论', '把消费价格等同于审美价值'],
  practice_task: `今天围绕“${title}”写下三句观察：一个事实、一个感受、一个留给对方的问题。`,
  difficulty: 8,
  dedupe_key: `fallback-${slug}`
}));

function todayInShanghai() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function parseScenario(raw) {
  if (raw && typeof raw === 'object') return raw;
  const text = String(raw || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(text); } catch { return null; }
}

function isValidScenario(value) {
  return value && typeof value === 'object'
    && typeof value.title === 'string' && value.title.trim()
    && typeof value.description === 'string'
    && Array.isArray(value.rules) && value.rules.length >= 2
    && typeof value.temper === 'string'
    && typeof value.dialogue_example === 'string'
    && Array.isArray(value.traps) && value.traps.length >= 2
    && typeof value.practice_task === 'string';
}

﻿function normalizeScenario(value) {
  const scenario = { ...value };
  scenario.scenario_id = String(scenario.scenario_id || 'generated-' + crypto.randomUUID());
  scenario.dedupe_key = String(scenario.dedupe_key || scenario.scenario_id);
  scenario.category = scenario.category === 'social' ? 'social' : 'aesthetics';
  scenario.difficulty = Math.max(1, Math.min(10, Number(scenario.difficulty) || 8));
  if (!scenario.background || scenario.background.length < 50) {
    scenario.background = '在社交场景的实践中，参与者需要判断场合规则、关系距离和发言时机。';
  }
  if (!scenario.temper || scenario.temper.length < 30) {
    scenario.temper = '保持松弛、克制和开放。不要急于证明自己知道更多，也不要把个人偏好强行上升为统一标准。';
  }
  if (!scenario.dialogue_example || scenario.dialogue_example.length < 20) {
    scenario.dialogue_example = '我更关注现场呈现出的细节和交流节奏，也想听听您最在意的部分。';
  }
  if (!Array.isArray(scenario.rules) || scenario.rules.length < 3) {
    scenario.rules = ['先观察场合和关系结构', '先描述事实再表达判断', '给对方留下回应空间'];
  }
  if (!Array.isArray(scenario.traps) || scenario.traps.length < 3) {
    scenario.traps = ['不懂装懂并堆砌术语', '抢话或过早下结论', '把消费价格等同于审美价值'];
  }
  if (!scenario.practice_task || scenario.practice_task.length < 10) {
    scenario.practice_task = '围绕今日场景写下一句观察：一个事实、一个感受、一个留给对方的问题。';
  }
  return scenario;
}

async function generateWithDify({ apiKey, baseUrl, recentKeys, scope, context, difficulty, userProfile }) {
  if (!apiKey) return null;
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/workflows/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: {
        scene_scope: scope || DEFAULT_SCOPE,
        preferred_context: context || '政商务与日常社交并行',
        difficulty: difficulty || 'advanced',
        avoid_topics: recentKeys.join(', '),
        user_profile: userProfile || '',
        generation_request: '生成一个新的高阶审美与社交博弈实操情境'
      },
      response_mode: 'blocking',
      user: 'aesthetic-generator'
    })
  });
  if (!response.ok) throw new Error(`Dify HTTP ${response.status}`);
  const payload = await response.json();
  const output = payload?.data?.outputs?.scenario_json
    ?? payload?.data?.outputs?.text
    ?? payload?.data?.outputs?.result;
  const scenario = parseScenario(output);
  return isValidScenario(scenario) ? normalizeScenario(scenario) : null;
}

function initAestheticsPushTables(db) {
  db.prepare(`CREATE TABLE IF NOT EXISTS daily_aesthetics_pushes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    push_date TEXT NOT NULL,
    scenario_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, push_date)
  )`).run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_aesthetics_push_user_date ON daily_aesthetics_pushes(user_id, push_date)').run();
}

function createService({ db, apiKey, baseUrl }) {
  const getToday = db.prepare('SELECT * FROM daily_aesthetics_pushes WHERE user_id = ? AND push_date = ?');
  const getRecent = db.prepare('SELECT scenario_json FROM daily_aesthetics_pushes WHERE user_id = ? AND push_date >= date(?, ?)');
  const save = db.prepare('INSERT OR REPLACE INTO daily_aesthetics_pushes (id, user_id, push_date, scenario_json, created_at) VALUES (?, ?, ?, ?, ?)');
  const removeToday = db.prepare('DELETE FROM daily_aesthetics_pushes WHERE user_id = ? AND push_date = ?');

  async function getDailyPush({ userId = 'default-user', force = false, scope, context, difficulty, userProfile } = {}) {
    const pushDate = todayInShanghai();
    if (!force) {
      const cached = getToday.get(userId, pushDate);
      if (cached) return { ...JSON.parse(cached.scenario_json), push_date: pushDate, source: 'cache' };
    }
    const recentRows = getRecent.all(userId, pushDate, `-${RETENTION_DAYS} days`);
    const recentKeys = recentRows.map(row => parseScenario(row.scenario_json)?.dedupe_key).filter(Boolean);
    if (force) removeToday.run(userId, pushDate);
    let scenario = null;
    let source = 'dify';
    try {
      scenario = await generateWithDify({ apiKey, baseUrl, recentKeys, scope, context, difficulty, userProfile });
    } catch (error) {
      console.warn('[Aesthetics Push] Dify generation failed:', error.message);
    }
    if (!scenario || recentKeys.includes(scenario.dedupe_key)) {
      source = 'fallback';
      const candidates = FALLBACK_SCENARIOS.filter(item => !recentKeys.includes(item.dedupe_key));
      scenario = candidates[0] || FALLBACK_SCENARIOS[0];
    }
    save.run(crypto.randomUUID(), userId, pushDate, JSON.stringify(scenario), Date.now());
    return { ...scenario, push_date: pushDate, source };
  }

  return { getDailyPush };
}

module.exports = { initAestheticsPushTables, createService };
