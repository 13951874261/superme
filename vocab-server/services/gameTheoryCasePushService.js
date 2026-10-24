const crypto = require('crypto');
const {
  GT_CASE_BG_MIN,
  countCompactChars,
  evaluateCasePushQuality,
} = require('./gtCaseQuality');
const { evaluateGameTheoryCaseHardness } = require('./moduleHardnessQuality');
const { loadInjectedKnowledgeSafe } = require('./gameTheoryKnowledge');

const FALLBACK_CASES = [
  {
    id: 'corp-openai-board-72h',
    env: 'corp_clash',
    title: '董事会72小时突袭免职',
    dedupe_key: 'corp-openai-board-72h',
    background:
      '你是亚太区运营中层经理，同时兼任本地员工沟通窗口。非营利董事会在周五午间突然免职创始CEO，对外只称“沟通不够坦诚”。总裁当场辞职抗议，最大商业绑定方是控股投资人，其云算力合同占收入近四成。CFO连夜冻结期权行权窗口，法务要求全员签署保密补充协议，秘书已发出要求董事会辞职的公开信联署表。产品线总监与多名VP在内部频道对线，下属团队人心浮动，同事开始打听编制与签证。你既不是董事会圈内人，也不是创始人铁杆，却被逼在信息不完整时决定是否署名。融资叙事、产品路线与当地监管问询同时压顶，任何站队都可能在周一被单独清算。公开信草稿把“治理失败”写得很满，却没有给你看证据附件；投资人公关口径与董事会口径互相打架，本地媒体已开始点名亚太管理层。你必须在今晚截止前完成站队，同时保住团队士气与自己的合规安全边界。此局中董事长、CEO、投资人、法务与多名VP的利益链彼此咬合，任何口头承诺都可能在董事会纪要里被改写，下属与同事的站队信号也在实时变化。',
    incomplete_info: '你不知道董事会是否握有不当行为实锤，也不确定大股东会保CEO还是保治理结构，更不清楚投资人是否已私下承诺续约。',
    decision_point: '公开信今晚截止署名。署名可能换来集体保护，也可能在人数不够时被单独清算。你签还是不签？'
  },
  {
    id: 'corp-apple-1985-sculley',
    env: 'corp_clash',
    title: '创始人被董事会站队架空',
    dedupe_key: 'corp-apple-1985-sculley',
    background:
      '你是产品线总监，直接向职业经理人CEO汇报，同时与创始人兼董事长保持历史信任。销售连续两季不及预期后，CEO收回运营权，把创始人“明升暗降”踢出业务线，却要求你在周五重组会前表态支持新编制。创始人仍是第一大股东，正私下接触骨干工程师另起炉灶；投资人观察团已到访，法务起草了竞业与设备归属备忘录，秘书把预读材料只发给了部分董事。下属担心被划入“旧部”，同事开始在午餐时试探你的站队。CFO暗示预算将按新CEO口径切分。你既怕失去编制，又怕被创始人视为背叛，还要在极度信息不对称下决定是否把产品路线备忘录直接抄送董事会。会前四十八小时内，VP层已有人改口支持CEO，也有人暗示可把你的邮件当作“证据”。任何过早站队都会被写成忠诚或野心，任何沉默也会被解读成观望投机。此局中董事长、CEO、投资人、法务与产品线经理的利益链彼此咬合，任何口头承诺都可能在董事会纪要里被改写，下属与同事的站队信号也在实时变化。',
    incomplete_info: '你不确定董事会是否已口头授权CEO重组，也不知道创始人是否已谈妥五名关键工程师，更不清楚投资人会不会在会前改口。',
    decision_point: '会前要把产品路线备忘录直接抄送董事，还是先向CEO表忠、保住编制？'
  },
  {
    id: 'gov-reform-audit-clash',
    env: 'gov_struggle',
    title: '综合执法改革前夜的审计伏击',
    dedupe_key: 'gov-reform-audit-clash',
    background:
      '你是规划发展科副科长，直接对分管副局长汇报，同时承接正局长交办的跨部门体制改革牵头任务。周五闭门办公会上，正局长突然抛出审计署移交的历年基建专项资金核查函，矛头直指分管副局长当年审批的重大示范项目，并要求你在周一党组会前交出完整资金台账与合规复核意见。分管副局长是系统内深耕二十年的实权元老，私下将你叫到办公室，暗示该项目当年经由老局长口头特批，且纪检组长与市委组织部考察组下周将进驻选拔正处级干部。科室下属人心浮动，同事开始私下打听站队风向，财务科长已借病请假规避签字。你既没有通览历史审批底稿的权限，又无法判断正局长是借合规整顿做人事布局，还是真握有违纪实锤。周一会前最后四十八小时内，若如实按正局长口径出具审计风险提示，将彻底得罪副局长并失去其背后的系统同盟；若替副局长做技术性合规背书，一旦纪检组核查坐实，你将作为主经办人承担直接签字背锅责任。各方权力线索与人事利益彼此咬合，任何沉默或拖延都会被视为观望投机。此局中董事长、总监、老板、下属与同事各怀心思，稍有不慎便将出局。',
    incomplete_info: '你不知道正局长是否已私下向市纪检组正式报备移交线索，也不确定老局长的口头特批是否留有会议纪要底单，更不清楚考察组对正副局长博弈的真实倾向。',
    decision_point: '周一党组会前必须提交签报。你选择出具揭露审批漏洞的严苛核查报告，还是做模糊化合规背书先保全当下同盟？'
  },
  {
    id: 'upward-restructure-vp-takeover',
    env: 'upward_takeover',
    title: '核心业务重组中的借势上位',
    dedupe_key: 'upward-restructure-vp-takeover',
    background:
      '你是创新业务线资深总监，向集团资深业务VP汇报，同时被董事会主席特聘为数字化战略顾问。集团第三季度营收大幅承压，董事会主席在周五例会上当众宣布启动业务重组，要求由你越级直报一份独立的新老业务权责与预算剥离方案，限期周日午夜前提交。你的直接上级VP是创业元老兼持股合伙人，在内部会议上多次贬低创新业务并克扣核心技术编制，此刻却要求你将全部核心研发数据交由其团队“统一把关”。CFO连夜冻结了下半年的创新预算池，法务总监提醒两份方案可能涉及竞业与保密协议漏洞，秘书私下透露周一早董事会将决定新设执行总裁职位的归属。下属团队通宵加班担心被解散裁员，同事纷纷在社交软件打探管理层重组名单。你手里握有旧业务线隐瞒重大亏损的真实分析，但一旦公开写入直报方案，将与直接上级彻底撕破脸并引来元老派系的疯狂反扑；若选择妥协上交数据，你的创新成果将被VP兼并架空，个人也将彻底失去借势晋升的核心筹码。此局中董事长、CEO、投资人、VP、总监、法务与下属同事利益紧密交织，站队稍有差池便遭反噬。',
    incomplete_info: '你不知道董事会主席是否已有意任命你接管重组后的独立事业部，也不确定CFO与投资人代表是否已与直接上级VP达成私下妥协，更不清楚法务总监在站队哪一方。',
    decision_point: '周日午夜截止提交。你选择将揭露亏损的真实方案越级直报董事会主席，还是先向直接上级VP妥协上交数据以求自保？'
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
    && typeof value.background === 'string' && countCompactChars(value.background) >= GT_CASE_BG_MIN
    && typeof value.incomplete_info === 'string' && countCompactChars(value.incomplete_info) >= 20
    && typeof value.decision_point === 'string' && countCompactChars(value.decision_point) >= 20;
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

function withQuality(caseItem) {
  const q = evaluateCasePushQuality(caseItem);
  return {
    ...caseItem,
    quality: q.quality,
    quality_note: q.quality_note,
    char_count: q.char_count,
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
        generation_request:
          '生成一个与数据库已存案例完全不重复的高管斗争深度案例。' +
          `【硬性要求】1. background 去空白必须≥${GT_CASE_BG_MIN}字，必须出现至少三方具名或具体职级角色（如董事长/CEO/投资人/VP/总监/法务等）；` +
          '2. 必须包含明确的会议场合或时限压力（如周五闭门会/今晚截止/会前对账等）；' +
          '3. 严禁出现“高度重视、统筹兼顾、战略定力、深刻理解”等假大空公文套话；' +
          '4. incomplete_info 必须≥20字，交代关键信息盲区；' +
          '5. decision_point 必须≥20字，设置选边即伤、进退两难的尖锐决策点，直接停在抉择时刻。'
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
  const upsert = db.prepare(`
    INSERT INTO game_theory_cases
      (id, env, title, dedupe_key, background, incomplete_info, decision_point)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      env=excluded.env,
      title=excluded.title,
      dedupe_key=excluded.dedupe_key,
      background=excluded.background,
      incomplete_info=excluded.incomplete_info,
      decision_point=excluded.decision_point
  `);
  for (const item of FALLBACK_CASES) {
    upsert.run(
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
    async getCasePush({ env, excludeIds, userProfile, gameModel, userId } = {}) {
      const catalog = listStoredCatalog(db);
      const injected = userId && db ? loadInjectedKnowledgeSafe(db, userId, 'game_theory') : null;
      let generated = null;
      let source = 'dify';
      try {
        generated = await generateWithDify({
          apiKey,
          baseUrl,
          env,
          avoidTopics: excludeIds,
          existingCases: formatExistingCases(catalog),
          userProfile: userProfile || (injected?.isDeepened ? `【加深博弈要求】案例必须体现以下深度博弈概念：\n${injected.context}` : undefined),
          gameModel,
          fetchImpl
        });
      } catch (error) {
        console.warn('[Game Theory Case Push] Dify generation failed:', error.message);
      }

      // 若处于加深状态 (difficulty >= 3)，必须过加深硬卡
      if (generated && injected && injected.isDeepened) {
        const hardness = evaluateGameTheoryCaseHardness(generated, { injectedKnowledge: injected.context });
        if (!hardness.ok) {
          console.warn('[Game Theory Case Push] generated case rejected by hardness gate:', hardness.reason);
          generated = null;
        }
      }

      if (!generated || isExcluded(generated, excludeIds) || conflictsWithCatalog(generated, catalog)) {
        source = 'fallback';
        generated = pickFromDb(db, env, excludeIds) || pickFallback(env, excludeIds);
      } else {
        saveGeneratedCase(db, generated);
      }
      return withQuality({ ...generated, source });
    }
  };
}

module.exports = { initGameTheoryCasePushTables, createService, FALLBACK_CASES };
