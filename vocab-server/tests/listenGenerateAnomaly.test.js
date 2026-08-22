const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const dailyListen = require('../services/dailyListenPreGenerateService');
const listenPrefsService = require('../services/listenPrefsService');

function openDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'listen-anomaly-'));
  const db = new Database(path.join(dir, 't.db'));
  dailyListen.initDailyListenTables(db);
  listenPrefsService.initListenPrefsTable(db);
  return { db, dir };
}

function comboParts(overrides = {}) {
  return dailyListen.comboKeyParts({
    userId: 'lzhmy-test',
    packDate: '2026-08-22',
    theme: '新人报到',
    genre: 'meeting',
    cefrLevel: 'B1',
    duration: 15,
    historyExclude: '',
    userFlaws: '',
    userCurrentProfile: '',
    ...overrides,
  });
}

function insertExtracted(db, parts, article) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO daily_extracted_articles (
      id, user_id, quota_date, theme, genre, cefr_level, article,
      words_json, phrases_json, sentences_json, duration, input_signature, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '[]', '[]', ?, ?, ?, ?)
  `).run(
    `ex-${parts.genre}-${parts.cefrLevel}-${parts.duration}`,
    parts.userId,
    parts.packDate,
    parts.theme,
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

async function testUpsertGeneratingThenReadyDoesNotUniqueFail() {
  const { db, dir } = openDb();
  try {
    const parts = comboParts();
    dailyListen.upsertArticle(db, parts, { status: 'generating', source: 'cron' });
    dailyListen.upsertArticle(db, parts, {
      status: 'ready',
      source: 'cron',
      body_text: 'ready body from second write',
    });
    dailyListen.upsertAudio(db, parts, { status: 'generating', source: 'cron' });
    dailyListen.upsertAudio(db, parts, {
      status: 'ready',
      source: 'cron',
      script_text: 'script',
      audio_url: '/api/daily_listen_audio/x.mp3',
    });

    const articles = db.prepare(
      'SELECT status, body_text FROM daily_listen_articles WHERE user_id=?',
    ).all(parts.userId);
    const audios = db.prepare(
      'SELECT status, audio_url FROM daily_listen_audios WHERE user_id=?',
    ).all(parts.userId);
    assert.strictEqual(articles.length, 1, '正文只能有一行');
    assert.strictEqual(articles[0].status, 'ready');
    assert.strictEqual(articles[0].body_text, 'ready body from second write');
    assert.strictEqual(audios.length, 1, '音频只能有一行');
    assert.strictEqual(audios[0].status, 'ready');

    const combo = dailyListen.getPregeneratedCombo(db, {
      userId: parts.userId,
      theme: parts.theme,
      genre: parts.genre,
      cefrLevel: parts.cefrLevel,
      duration: parts.duration,
      date: parts.packDate,
    });
    assert.strictEqual(combo.articleStatus, 'ready');
    assert.strictEqual(combo.audioStatus, 'ready');
    assert.strictEqual(combo.status, 'ready');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function testGetPregeneratedComboSeesGeneratingPlaceholder() {
  const { db, dir } = openDb();
  try {
    const parts = comboParts({ duration: 25 });
    dailyListen.upsertArticle(db, parts, { status: 'generating', source: 'cron' });
    const combo = dailyListen.getPregeneratedCombo(db, {
      userId: parts.userId,
      theme: parts.theme,
      genre: parts.genre,
      cefrLevel: parts.cefrLevel,
      duration: parts.duration,
      date: parts.packDate,
    });
    assert.strictEqual(combo.status, 'generating', '占位 generating 必须对前端可见，不能被当成 missing');
    assert.strictEqual(combo.canBackfill, false);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function testGenerateOneComboReusesExtractedArticle() {
  const { db, dir } = openDb();
  const userId = 'lzhmy-reuse';
  const body = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ');
  let longScriptCalls = 0;
  let synthCalls = 0;
  const prev = {
    generateLongScript: async () => {
      longScriptCalls += 1;
      return `${body} FROM_DIFY`;
    },
    synthesizeAudioFile: async (text, audioPath) => {
      synthCalls += 1;
      fs.mkdirSync(path.dirname(audioPath), { recursive: true });
      fs.writeFileSync(audioPath, Buffer.from('fake-mp3'));
    },
  };
  dailyListen.setGenerators(prev);
  try {
    const parts = comboParts({ userId, duration: 15 });
    insertExtracted(db, parts, body);
    await dailyListen.generateOneCombo(db, {
      userId,
      theme: parts.theme,
      genre: parts.genre,
      cefrLevel: parts.cefrLevel,
      duration: parts.duration,
      packDate: parts.packDate,
    }, { source: 'cron' });

    assert.strictEqual(longScriptCalls, 0, '已有长文时不得再调 Dify generateLongScript');
    assert.strictEqual(synthCalls, 1, '应只合成一次音频');
    const art = dailyListen.getArticleRow(db, parts);
    assert.strictEqual(art.status, 'ready');
    assert.ok(String(art.body_text).includes('word0'));
    assert.ok(!String(art.body_text).includes('FROM_DIFY'));
    const aud = dailyListen.getAudioRow(db, parts);
    assert.strictEqual(aud.status, 'ready');
    assert.ok(dailyListen.fileOk(aud.audio_path));
  } finally {
    cleanupUserFiles(userId);
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function testSyncAdoptsExistingMp3WithoutResynthesize() {
  const { db, dir } = openDb();
  const userId = 'lzhmy-adopt';
  const body = Array.from({ length: 50 }, (_, i) => `audio${i}`).join(' ');
  let synthCalls = 0;
  dailyListen.setGenerators({
    synthesizeAudioFile: async () => {
      synthCalls += 1;
      throw new Error('should not synthesize');
    },
  });
  try {
    const parts = comboParts({ userId, duration: 25, cefrLevel: 'B1' });
    insertExtracted(db, parts, body);
    const audioDir = path.join(dailyListen.AUDIO_ROOT, userId);
    fs.mkdirSync(audioDir, { recursive: true });
    const audioPath = path.join(audioDir, `${parts.packDate}_meeting_B1_25m.mp3`);
    fs.writeFileSync(audioPath, Buffer.from('already-there'));

    dailyListen.upsertAudio(db, parts, { status: 'generating', source: 'cron' });
    const res = await dailyListen.syncAudioFromLongArticleRow(db, {
      user_id: userId,
      quota_date: parts.packDate,
      theme: parts.theme,
      genre: parts.genre,
      cefr_level: parts.cefrLevel,
      duration: parts.duration,
      article: body,
    }, 'cron');

    assert.ok(res && res.success, '磁盘已有 mp3 时应直接 ready');
    assert.strictEqual(synthCalls, 0, '已有 mp3 不得重跑 TTS');
    const aud = dailyListen.getAudioRow(db, parts);
    assert.strictEqual(aud.status, 'ready');
    assert.ok(String(aud.audio_url).includes('2026-08-22_meeting_B1_25m.mp3'));
  } finally {
    cleanupUserFiles(userId);
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testApplyAudioEffectsDoesNotUseUndefinedPathMod() {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = server.indexOf('async function applyAudioEffects');
  assert.ok(start >= 0, '找不到 applyAudioEffects');
  const next = server.indexOf('\nasync function extractVocabFromListenArticle', start);
  const fn = server.slice(start, next > start ? next : start + 8000);
  assert.doesNotMatch(fn, /\bpathMod\b/, 'applyAudioEffects 不得使用未定义的 pathMod');
  assert.doesNotMatch(fn, /\bfsMod\b/, 'applyAudioEffects 不得使用未定义的 fsMod');
  const ensureStart = server.indexOf('function ensureSoundEffectsExist');
  const ensureEnd = server.indexOf('\nglobal.synthesizeAndSaveAudio', ensureStart);
  const ensureFn = server.slice(ensureStart, ensureEnd > ensureStart ? ensureEnd : ensureStart + 3000);
  assert.doesNotMatch(ensureFn, /\bpathMod\b/, 'ensureSoundEffectsExist 不得使用 pathMod');
  assert.doesNotMatch(ensureFn, /\bfsMod\b/, 'ensureSoundEffectsExist 不得使用 fsMod');
}

async function main() {
  testApplyAudioEffectsDoesNotUseUndefinedPathMod();
  console.log('PASS pathMod/fsMod 契约');
  await testUpsertGeneratingThenReadyDoesNotUniqueFail();
  console.log('PASS upsert generating → ready 不触发 UNIQUE');
  await testGetPregeneratedComboSeesGeneratingPlaceholder();
  console.log('PASS generating 占位对查询可见');
  await testGenerateOneComboReusesExtractedArticle();
  console.log('PASS generateOneCombo 复用已有长文');
  await testSyncAdoptsExistingMp3WithoutResynthesize();
  console.log('PASS 已有 mp3 直接回写 ready');
  console.log('\nlistenGenerateAnomaly.test.js 全部通过');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
