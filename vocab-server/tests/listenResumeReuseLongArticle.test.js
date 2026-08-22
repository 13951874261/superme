const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dailyListen = require('../services/dailyListenPreGenerateService');
const dailyCronRunService = require('../services/dailyCronRunService');
const dailyPackService = require('../services/dailyPackService');
const listenPrefsService = require('../services/listenPrefsService');

function openDatabase(filePath) {
  try {
    const Database = require('better-sqlite3');
    return new Database(filePath);
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(filePath);
  }
}

function openDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'listen-resume-reuse-'));
  const db = openDatabase(path.join(dir, 't.db'));
  dailyPackService.initDailyPackTables(db);
  dailyCronRunService.initDailyCronRunTables(db);
  dailyListen.initDailyListenTables(db);
  listenPrefsService.initListenPrefsTable(db);
  return { db, dir };
}

function comboParts(overrides = {}) {
  return dailyListen.comboKeyParts({
    userId: 'lzhmy',
    packDate: dailyPackService.getPackDate(),
    theme: '商务谈判：让步与施压',
    genre: 'meeting',
    cefrLevel: 'B1',
    duration: 1,
    historyExclude: '',
    userFlaws: '',
    userCurrentProfile: '',
    ...overrides,
  });
}

function insertExtracted(db, parts, article, themeOverride) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO daily_extracted_articles (
      id, user_id, quota_date, theme, genre, cefr_level, article,
      words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '[]', '[]', ?, ?, ?, ?)
  `).run(
    `ex-${parts.userId}-${parts.genre}-${parts.cefrLevel}-${parts.duration}-${themeOverride || parts.theme}`,
    parts.userId,
    parts.packDate,
    themeOverride || parts.theme,
    parts.genre,
    parts.cefrLevel,
    article,
    String(parts.duration),
    parts.inputSignature || '',
    now,
    now,
  );
}

function cleanupUserFiles(userId) {
  for (const root of [dailyListen.ARTICLE_ROOT, dailyListen.AUDIO_ROOT]) {
    const dir = path.join(root, userId);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
}

function installFakeSynth() {
  let longScriptCalls = 0;
  let synthCalls = 0;
  dailyListen.setGenerators({
    generateLongScript: async () => {
      longScriptCalls += 1;
      return 'SHOULD_NOT_GENERATE_FROM_DIFY';
    },
    synthesizeAudioFile: async (text, audioPath) => {
      synthCalls += 1;
      fs.mkdirSync(path.dirname(audioPath), { recursive: true });
      fs.writeFileSync(audioPath, Buffer.from(`fake-mp3:${String(text).slice(0, 12)}`));
    },
  });
  return {
    counts: () => ({ longScriptCalls, synthCalls }),
  };
}

async function testExtractedRowIgnoresThemeMismatch() {
  const { db, dir } = openDb();
  try {
    const parts = comboParts();
    const body = Array.from({ length: 40 }, (_, i) => `hello${i}`).join(' ');
    insertExtracted(db, parts, body, '新人报到');
    const row = dailyListen.getExtractedArticleRow(db, parts);
    assert.ok(row, '主题不一致时仍应取到今日同组合长文');
    assert.ok(String(row.article).includes('hello0'));
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function testGenerateOneComboReusesLongArticleDespiteThemeMismatch() {
  const { db, dir } = openDb();
  const userId = 'lzhmy-theme-mismatch';
  cleanupUserFiles(userId);
  const body = Array.from({ length: 50 }, (_, i) => `reuse${i}`).join(' ');
  const fake = installFakeSynth();
  try {
    const parts = comboParts({ userId });
    insertExtracted(db, parts, body, '新人报到');
    await dailyListen.generateOneCombo(db, {
      userId,
      theme: parts.theme,
      genre: parts.genre,
      cefrLevel: parts.cefrLevel,
      duration: parts.duration,
      packDate: parts.packDate,
    }, { source: 'cron' });
    const { longScriptCalls, synthCalls } = fake.counts();
    assert.strictEqual(longScriptCalls, 0, '已有今日长文时不得再调 Dify 写课文');
    assert.strictEqual(synthCalls, 1, '应直接用长文配音一次');
    const combo = dailyListen.getPregeneratedCombo(db, {
      userId,
      theme: parts.theme,
      genre: parts.genre,
      cefrLevel: parts.cefrLevel,
      duration: parts.duration,
      date: parts.packDate,
    });
    assert.strictEqual(combo.status, 'ready');
    assert.ok(String(combo.article.body).includes('reuse0'));
  } finally {
    cleanupUserFiles(userId);
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function testStartSyncFromLongArticleMarksGeneratingThenReady() {
  const { db, dir } = openDb();
  const userId = 'lzhmy-autosync';
  cleanupUserFiles(userId);
  const body = Array.from({ length: 50 }, (_, i) => `sync${i}`).join(' ');
  const fake = installFakeSynth();
  try {
    const parts = comboParts({ userId });
    insertExtracted(db, parts, body, '新人报到');
    const kick = dailyListen.startListenSyncFromLongArticleIfNeeded(db, {
      userId,
      theme: parts.theme,
      genre: parts.genre,
      cefrLevel: parts.cefrLevel,
      duration: parts.duration,
      date: parts.packDate,
    });
    assert.strictEqual(kick.started, true);
    assert.strictEqual(kick.combo.status, 'generating', '打开页面时应立刻从 missing 变成 generating，避免红字');
    await kick.promise;
    const { longScriptCalls, synthCalls } = fake.counts();
    assert.strictEqual(longScriptCalls, 0);
    assert.strictEqual(synthCalls, 1);
    const combo = dailyListen.getPregeneratedCombo(db, {
      userId,
      theme: parts.theme,
      genre: parts.genre,
      cefrLevel: parts.cefrLevel,
      duration: parts.duration,
      date: parts.packDate,
    });
    assert.strictEqual(combo.status, 'ready');
  } finally {
    cleanupUserFiles(userId);
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function testResumeInterruptedListenJobsCallsCronWithSkipReadyAudio() {
  const { db, dir } = openDb();
  const original = dailyListen.runDailyListenCronJob;
  const calls = [];
  dailyListen.runDailyListenCronJob = async (_db, options) => {
    calls.push(options);
    return { summary: { resumed: true } };
  };
  try {
    const packDate = dailyPackService.getPackDate();
    const tickId = dailyCronRunService.createCronTickId();
    const run = dailyCronRunService.createPerUserRun(db, {
      cronTickId: tickId,
      userId: 'lzhmy',
      packDate,
      triggerSource: 'cron',
    });
    dailyCronRunService.upsertStep(db, {
      runId: run.id,
      userId: 'lzhmy',
      module: 'listen',
      status: 'failed',
      errorMessage: 'interrupted: server restart',
      finishedAt: Date.now(),
    });
    const result = await dailyListen.resumeInterruptedListenJobs(db);
    assert.strictEqual(result.resumed, 1);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].userId, 'lzhmy');
    assert.strictEqual(calls[0].cronTickId, tickId);
    assert.strictEqual(calls[0].skipReadyAudio, true, '续跑不得把已有音频再合成一遍');
  } finally {
    dailyListen.runDailyListenCronJob = original;
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testGetPregeneratedRouteKicksAutoSync() {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = server.indexOf("app.get('/api/listen/pregenerated'");
  assert.ok(start >= 0, '找不到 GET /api/listen/pregenerated');
  const next = server.indexOf("app.post('/api/listen/pregenerated/backfill'", start);
  const fn = server.slice(start, next > start ? next : start + 2500);
  assert.match(
    fn,
    /startListenSyncFromLongArticleIfNeeded/,
    '读精听货架时若有今日长文应自动配音，不能只返回 missing',
  );
}

function testListenTabPollsGenerating() {
  const tabPath = path.join(__dirname, '..', '..', 'src', 'components', 'modules', 'english', 'tabs', 'ListenTab.tsx');
  const tab = fs.readFileSync(tabPath, 'utf8');
  assert.match(tab, /pregenStatus === 'generating'/, 'generating 时前端必须轮询，否则配完音页面仍空白');
  assert.match(tab, /正在用今日长文配音/, 'generating 应提示正在配音，而不是红字尚未准备好');
}

async function main() {
  testGetPregeneratedRouteKicksAutoSync();
  console.log('PASS GET 读接口会触发长文配音');
  testListenTabPollsGenerating();
  console.log('PASS 前端 generating 轮询契约');
  await testExtractedRowIgnoresThemeMismatch();
  console.log('PASS 长文查找忽略主题不一致');
  await testGenerateOneComboReusesLongArticleDespiteThemeMismatch();
  console.log('PASS generateOneCombo 主题不一致仍复用长文配音');
  await testStartSyncFromLongArticleMarksGeneratingThenReady();
  console.log('PASS 打开页面自动配音：先 generating 再 ready');
  await testResumeInterruptedListenJobsCallsCronWithSkipReadyAudio();
  console.log('PASS 重启后续跑 interrupted 精听且跳过已有音频');
  console.log('\nlistenResumeReuseLongArticle.test.js 全部通过');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
