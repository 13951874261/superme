/**
 * dailyFeeder.js — 全自动投喂引擎
 * 每天凌晨由 node-cron 驱动，调用 Dify English_Vocab_Engine 工作流，
 * 将返回的复合 JSON 拆解后分别写入：
 *   - vocabulary 表（词汇 + 短语，携带艾宾浩斯初始参数）
 *   - listening_materials 表（听力语料）
 */

const { v4: uuidv4 } = require('uuid');

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ theme: string, difficulty: string, userId: string }} options
 */
async function runDailyFeeder(db, { theme = '商务谈判：让步与施压', difficulty = 'B2', userId = 'default-user' } = {}) {
  console.log(`[Auto-Feeder] 启动战术投喂任务，当前主题：${theme} / 难度：${difficulty}`);

  const apiKey = process.env.DIFY_AUTO_FEEDER_API_KEY || 'app-BvxaAkVfKNB19EfJ7qw1Zzsw';
  const baseUrl = process.env.DIFY_BASE_URL || 'https://dify.234124123.xyz';

  let fetch;
  try {
    // 兼容 node-fetch v3（ESM only）
    ({ default: fetch } = await import('node-fetch'));
  } catch (importErr) {
    // 如果 node-fetch 未安装，降级使用 Node.js 18+ 内置 fetch
    if (typeof globalThis.fetch === 'function') {
      fetch = globalThis.fetch.bind(globalThis);
    } else {
      throw new Error('[Auto-Feeder] 无可用 fetch 实现，请安装 node-fetch: npm install node-fetch');
    }
  }

  let data;
  try {
    const response = await fetch(`${baseUrl}/v1/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: { theme, difficulty },
        response_mode: 'blocking',
        user: 'system-cron-worker',
      }),
    });

    data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || `Dify Workflow 执行失败 (HTTP ${response.status})`);
    }
  } catch (fetchErr) {
    console.error('[Auto-Feeder] 网络请求失败:', fetchErr.message);
    throw fetchErr;
  }

  // 兼容 Dify blocking 与 streaming 两种响应结构
  const rawResult =
    data?.data?.outputs?.result_json ||
    data?.data?.outputs?.result ||
    data?.outputs?.result_json ||
    data?.outputs?.result ||
    '';

  if (!rawResult) {
    console.warn('[Auto-Feeder] Dify 返回体中未找到 result_json / result 字段，原始响应:', JSON.stringify(data).slice(0, 500));
    return;
  }

  let parsed;
  try {
    parsed = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
  } catch (parseErr) {
    console.error('[Auto-Feeder] JSON 解析失败:', parseErr.message, '\n原始内容:', String(rawResult).slice(0, 300));
    throw parseErr;
  }

  const now = Date.now();
  const nextReview = now + 5 * 60 * 1000; // 5 分钟后进入首次艾宾浩斯复习

  // ── 1. 拆解写入词汇与短语（艾宾浩斯生词本）──────────────────────
  const insertVocab = db.prepare(`
    INSERT OR IGNORE INTO vocabulary
      (id, word, user_id, dict_type, category, payload, added_at, repetitions, ease_factor, interval_days, next_review_date, review_history)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 2.5, 0, ?, '[]')
  `);

  let vocabCount = 0;
  let phraseCount = 0;

  db.transaction(() => {
    // 词汇条目
    if (Array.isArray(parsed.vocab)) {
      parsed.vocab.forEach((v) => {
        if (!v?.word) return;
        insertVocab.run(
          uuidv4(),
          String(v.word).trim(),
          userId,
          'auto_feeder',
          'business',
          JSON.stringify({
            meaning: v.meaning || '',
            phonetic: v.phonetic || '',
            partOfSpeech: v.pos || v.part_of_speech || '',
            definition_en: v.definition_en || '',
            business_note: v.business_note || '',
            examples: Array.isArray(v.examples) ? v.examples : (v.example ? [v.example] : []),
          }),
          now,
          nextReview
        );
        vocabCount++;
      });
    }

    // 短语与句式
    if (Array.isArray(parsed.phrases_and_sentences)) {
      parsed.phrases_and_sentences.forEach((p) => {
        if (!p?.phrase) return;
        insertVocab.run(
          uuidv4(),
          String(p.phrase).trim(),
          userId,
          'auto_feeder',
          'business',
          JSON.stringify({
            meaning: p.meaning || '',
            examples: p.example ? [p.example] : [],
            source: '每日弹药投喂',
          }),
          now,
          nextReview
        );
        phraseCount++;
      });
    }
  })();

  // ── 2. 拆解写入听力舱语料 ────────────────────────────────────────
  const lm = parsed.listening_material || parsed.listening;
  let listeningInserted = false;

  if (lm && lm.content_text && lm.title) {
    // difficulty CHECK 约束：只允许 A2/B1/B2/C1
    const safeLevel = ['A2', 'B1', 'B2', 'C1'].includes(String(difficulty).toUpperCase())
      ? String(difficulty).toUpperCase()
      : 'B2';

    const autoWordCount = String(lm.content_text).trim().split(/\s+/).filter(Boolean).length;
    const estimatedDuration = lm.duration || Math.max(30, Math.round(autoWordCount / 2.4));

    db.prepare(`
      INSERT INTO listening_materials
        (id, title, content_text, audio_url, difficulty, category, duration, has_subtext, subtext_analysis, source_type, source_topic, created_at, updated_at)
      VALUES (?, ?, ?, '', ?, ?, ?, 1, ?, 'tts', ?, ?, ?)
    `).run(
      uuidv4(),
      String(lm.title).trim(),
      String(lm.content_text).trim(),
      safeLevel,
      String(lm.category || '商务谈判').trim(),
      estimatedDuration,
      String(lm.subtext_analysis || lm.analysis || '').trim(),
      String(theme).trim(),
      now,
      now
    );
    listeningInserted = true;
    console.log(`[Auto-Feeder] 听力舱新增语料：《${lm.title}》`);
  } else {
    console.warn('[Auto-Feeder] 未解析到有效的 listening_material，跳过听力入库');
  }

  // ── 3. 日志摘要 ──────────────────────────────────────────────────
  if (parsed.daily_article) {
    console.log(`[Auto-Feeder] 今日长文已截获: ${parsed.daily_article.title || '(未命名)'}`);
  }


  // ── 4. 调用「破绽识别」Dify 工作流 ─────────────────────────
  try {
    const flawCount = await runFlawDetectionFeeder({ theme, difficulty, userId, fetch, baseUrl });
    console.log(
      `[Auto-Feeder] ✅ 投喂成功！` +
      `新增词汇 ${vocabCount} 发 / 短语 ${phraseCount} 发 / ` +
      `听力语料 ${listeningInserted ? 1 : 0} 篇 / ` +
      `🎯 破绽识别弹药 ${flawCount} 发`
    );
  } catch (flawErr) {
    console.warn('[Auto-Feeder] ⚠️ 破绽识别词汇投喂失败（不影响主流程）:', flawErr.message);
    console.log(
      `[Auto-Feeder] ✅ 主流程投喂成功！` +
      `新增词汇 ${vocabCount} 发 / 短语 ${phraseCount} 发 / ` +
      `听力语料 ${listeningInserted ? 1 : 0} 篇`
    );
  }
}

/**
 * 调用 Dify Flaw_Detection_Vocab_Engine 工作流，
 * 由 LLM 动态生成与当前主题强绑定的"破绽识别"词汇并写入生词本。
 *
 * @param {{ theme: string, difficulty: string, userId: string, fetch: Function, baseUrl: string }} opts
 * @returns {Promise<number>} 实际写入条数（由 Dify HTTP 节点直接入库，此处返回工作流报告数）
 */
async function runFlawDetectionFeeder({ theme, difficulty = 'B2', userId = 'default-user', fetch, baseUrl }) {
  const apiKey = process.env.DIFY_FLAW_DETECTION_API_KEY || 'app-FHP7HJ6L6ctMe1TKxz013jPz';

  console.log(`[Flaw-Feeder] 启动破绽识别词汇投喂，主题：${theme} / 难度：${difficulty}`);

  const response = await fetch(`${baseUrl}/v1/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: { theme, difficulty, userId },
      response_mode: 'blocking',
      user: 'system-cron-flaw-worker',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || `Dify Flaw Workflow 执行失败 (HTTP ${response.status})`);
  }

  // 取工作流输出的注入数量（由 Dify Code 节点返回 count 字段）
  const injectedCount =
    data?.data?.outputs?.injected_count ??
    data?.outputs?.injected_count ??
    data?.data?.outputs?.count ??
    data?.outputs?.count ??
    '?';

  console.log(`[Flaw-Feeder] ✅ 破绽识别词汇投喂完成，Dify 报告注入 ${injectedCount} 条`);
  return Number(injectedCount) || 0;
}

module.exports = { runDailyFeeder, runFlawDetectionFeeder };

