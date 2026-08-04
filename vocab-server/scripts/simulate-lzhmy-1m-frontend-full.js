#!/usr/bin/env node
/**
 * 服务器完整后台模拟：lzhmy
 * 1) 备份并清空历史生成缓存（packs / listen / extracted + 预生成文件）
 * 2) 按前台可选条件重生成：
 *    - 今日唤醒 + 破绽包
 *    - duration=1 × genre(meeting/news/podcast/reading) × cefr(A2/B1/B2/C1) = 16 组文章+音频
 * 3) 读写签名与 D1/L1 一致（theme + history + profile / listen 七元组）
 *
 * 用法（服务器）:
 *   cd /var/www/super-agent/vocab-server
 *   node scripts/simulate-lzhmy-1m-frontend-full.js
 *
 * 环境变量（可选）:
 *   FORCE_GEN_BASE=http://127.0.0.1:3001
 *   VOCAB_DB_PATH=/var/www/super-agent/vocab.db
 *   FORCE_USER_ID=lzhmy
 *   FORCE_THEME=商务谈判：让步与施压   # 不设则读 user_theme_prefs
 *   SKIP_CLEAR=1                      # 跳过清空（仅重生成）
 *   ONLY_COMBOS=meeting:B1            # 逗号分隔 genre:cefr，例 meeting:A2,meeting:B1
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const BASE = process.env.FORCE_GEN_BASE || 'http://127.0.0.1:3001';
const DB_PATH = process.env.VOCAB_DB_PATH || path.join(__dirname, '..', '..', 'vocab.db');
const USER_ID = process.env.FORCE_USER_ID || 'lzhmy';
const SKIP_CLEAR = process.env.SKIP_CLEAR === '1';
const API_ROOT = path.join(__dirname, '..');
const AUDIO_ROOT = path.join(API_ROOT, 'public', 'daily_listen_audio');
const ARTICLE_ROOT = path.join(API_ROOT, 'public', 'daily_long_articles');

const ALL_GENRES = ['meeting', 'news', 'podcast', 'reading'];
const ALL_CEFR = ['A2', 'B1', 'B2', 'C1'];
const DURATION = 1;

function resolveCombos() {
  const raw = String(process.env.ONLY_COMBOS || '').trim();
  if (!raw) {
    return ALL_GENRES.flatMap((genre) => ALL_CEFR.map((cefrLevel) => ({ genre, cefrLevel, duration: DURATION })));
  }
  return raw.split(',').map((part) => {
    const [genre, cefrLevel] = part.trim().split(':');
    if (!genre || !cefrLevel) throw new Error(`bad ONLY_COMBOS item: ${part}`);
    return { genre, cefrLevel, duration: DURATION };
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postJson(apiPath, body) {
  const res = await fetch(`${BASE}${apiPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || data.message || `HTTP ${res.status} ${apiPath}`);
  }
  return data;
}

async function getJson(apiPath) {
  const res = await fetch(`${BASE}${apiPath}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status} ${apiPath}`);
  return data;
}

function openDb() {
  if (!fs.existsSync(DB_PATH)) throw new Error(`DB not found: ${DB_PATH}`);
  return new Database(DB_PATH);
}

function readThemeAndInputs(db) {
  const pref = db.prepare(`
    SELECT theme FROM user_theme_prefs
    WHERE user_id=? AND theme IS NOT NULL AND TRIM(theme)!=''
    LIMIT 1
  `).get(USER_ID);
  const theme = String(process.env.FORCE_THEME || pref?.theme || '商务谈判：让步与施压').trim();

  let historyExclude = '';
  try {
    const words = db.prepare('SELECT word FROM vocabulary ORDER BY added_at DESC LIMIT 50').all();
    historyExclude = words.map((r) => String(r.word || '').trim()).filter(Boolean).join(', ');
  } catch (_) {}

  let userCurrentProfile = '';
  try {
    const row = db.prepare(`
      SELECT profile_content FROM user_profiles
      WHERE user_id=? ORDER BY updated_at DESC LIMIT 1
    `).get(USER_ID);
    userCurrentProfile = String(row?.profile_content || '').trim().slice(0, 280);
  } catch (_) {
    try {
      // 兼容旧表名/字段
      const row = db.prepare(`
        SELECT content AS profile_content FROM profiles
        WHERE user_id=? LIMIT 1
      `).get(USER_ID);
      userCurrentProfile = String(row?.profile_content || '').trim().slice(0, 280);
    } catch (_) {}
  }

  return { theme, historyExclude, userCurrentProfile };
}

function backupAndClear(db) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const bk = path.join('/var/www/super-agent', `backup_gen_cache_${ts}`);
  fs.mkdirSync(bk, { recursive: true });
  fs.copyFileSync(DB_PATH, path.join(bk, 'vocab.db'));
  for (const dir of [AUDIO_ROOT, ARTICLE_ROOT]) {
    if (!fs.existsSync(dir)) continue;
    const name = path.basename(dir);
    const dest = path.join(bk, name);
    fs.cpSync(dir, dest, { recursive: true });
  }
  console.log(`[clear] backup => ${bk}`);

  const before = {
    packs: db.prepare('SELECT COUNT(*) AS c FROM daily_packs').get().c,
    articles: db.prepare('SELECT COUNT(*) AS c FROM daily_listen_articles').get().c,
    audios: db.prepare('SELECT COUNT(*) AS c FROM daily_listen_audios').get().c,
    extracted: db.prepare('SELECT COUNT(*) AS c FROM daily_extracted_articles').get().c,
  };
  console.log('[clear] before', before);

  db.exec(`
    BEGIN;
    DELETE FROM daily_packs;
    DELETE FROM daily_listen_articles;
    DELETE FROM daily_listen_audios;
    DELETE FROM daily_extracted_articles;
    COMMIT;
  `);

  for (const dir of [AUDIO_ROOT, ARTICLE_ROOT]) {
    fs.mkdirSync(dir, { recursive: true });
    for (const name of fs.readdirSync(dir)) {
      fs.rmSync(path.join(dir, name), { recursive: true, force: true });
    }
  }

  const after = {
    packs: db.prepare('SELECT COUNT(*) AS c FROM daily_packs').get().c,
    articles: db.prepare('SELECT COUNT(*) AS c FROM daily_listen_articles').get().c,
    audios: db.prepare('SELECT COUNT(*) AS c FROM daily_listen_audios').get().c,
    extracted: db.prepare('SELECT COUNT(*) AS c FROM daily_extracted_articles').get().c,
  };
  console.log('[clear] after', after);
  return bk;
}

async function getComboStatus(theme, combo) {
  const q = new URLSearchParams({
    userId: USER_ID,
    theme,
    genre: combo.genre,
    cefrLevel: combo.cefrLevel,
    duration: String(combo.duration),
  });
  return getJson(`/api/listen/pregenerated?${q}`);
}

async function waitBackfill(taskId, theme, combo, need, timeoutMs) {
  const label = `${combo.genre}/${combo.cefrLevel}/${combo.duration}m:${need}`;
  const started = Date.now();
  let lastLog = 0;
  while (Date.now() - started < timeoutMs) {
    let taskStatus = 'unknown';
    let taskError = '';
    try {
      const task = await getJson(`/api/tasks/${taskId}`);
      taskStatus = task.status || 'unknown';
      taskError = task.error || '';
      if (taskStatus === 'failed') {
        throw new Error(`${label} task failed: ${taskError || 'unknown'}`);
      }
      if (taskStatus === 'completed') {
        console.log(`[ok] ${label} (task completed)`);
        return task;
      }
    } catch (e) {
      if (String(e.message || e).includes('task failed')) throw e;
    }

    const got = await getComboStatus(theme, combo);
    const articleOk = got.articleStatus === 'ready' || got.status === 'ready';
    const audioOk = got.audioStatus === 'ready' || got.status === 'ready';
    if (need === 'article' && articleOk) {
      console.log(`[ok] ${label} (cache ready)`);
      return got;
    }
    if (need === 'audio' && audioOk) {
      console.log(`[ok] ${label} (cache ready)`);
      return got;
    }

    if (Date.now() - lastLog > 15000) {
      lastLog = Date.now();
      const elapsed = Math.round((Date.now() - started) / 1000);
      console.log(
        `  ... ${label} ${elapsed}s task=${taskStatus} article=${got.articleStatus || got.status} audio=${got.audioStatus || '-'}`,
      );
    }
    await sleep(3000);
  }
  const got = await getComboStatus(theme, combo).catch(() => ({}));
  throw new Error(`${label} timeout; last article=${got.articleStatus} audio=${got.audioStatus}`);
}

async function runBackfill(theme, combo, only, timeoutMs) {
  const label = `${combo.genre}/${combo.cefrLevel}/${combo.duration}m:${only}`;
  console.log(` -> ${label}`);
  const res = await postJson('/api/listen/pregenerated/backfill', {
    userId: USER_ID,
    theme,
    genre: combo.genre,
    cefrLevel: combo.cefrLevel,
    duration: combo.duration,
    only,
    force: true,
  });
  if (!res.taskId) {
    console.log(`[ok] ${label} (no taskId, maybe already ready)`);
    return;
  }
  console.log(`    taskId=${res.taskId}`);
  await waitBackfill(res.taskId, theme, combo, only, timeoutMs);
}

async function waitPackReady(theme, historyExclude, userCurrentProfile, timeoutMs = 10 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const q = new URLSearchParams({
      userId: USER_ID,
      theme,
      historyExclude,
      userCurrentProfile,
    });
    const pack = await getJson(`/api/daily-pack/today?${q}`);
    const hasWakeup = !!(pack.wakeup && (pack.wakeup.vocab?.length || pack.wakeup.theme));
    const hasFlaw = Array.isArray(pack.flawVocab) && pack.flawVocab.length > 0;
    if (pack.status === 'ready' && hasWakeup && hasFlaw) {
      console.log('[ok] daily pack ready');
      return pack;
    }
    if (pack.status === 'failed') {
      throw new Error(`daily pack failed: ${pack.errorMessage || 'unknown'}`);
    }
    const elapsed = Math.round((Date.now() - started) / 1000);
    if (elapsed % 15 < 3) {
      console.log(`  ... pack ${elapsed}s status=${pack.status}`);
    }
    await sleep(2500);
  }
  throw new Error('daily pack wait timeout');
}

async function main() {
  const combos = resolveCombos();
  console.log(`BASE=${BASE}`);
  console.log(`DB_PATH=${DB_PATH}`);
  console.log(`USER=${USER_ID} duration=${DURATION} combos=${combos.length}`);

  const db = openDb();
  let theme;
  let historyExclude;
  let userCurrentProfile;
  try {
    if (!SKIP_CLEAR) {
      console.log('\n[0/4] backup + clear historical generated data...');
      backupAndClear(db);
    } else {
      console.log('\n[0/4] SKIP_CLEAR=1, keep existing rows');
    }
    ({ theme, historyExclude, userCurrentProfile } = readThemeAndInputs(db));
  } finally {
    db.close();
  }

  console.log(`THEME=${theme}`);
  console.log(`historyExclude.len=${historyExclude.length} profile.len=${userCurrentProfile.length}`);

  // 健康检查
  await getJson('/api/vocab/stats');
  console.log('[health] vocab stats ok');

  console.log('\n[1/4] regenerate daily pack (wakeup + flaw)...');
  const packRes = await postJson('/api/daily-pack/regenerate', {
    userId: USER_ID,
    type: 'both',
    theme,
    historyExclude,
    userCurrentProfile,
  });
  console.log('pack status=', packRes.status);
  await waitPackReady(theme, historyExclude, userCurrentProfile);

  console.log('\n[2/4] backfill listen article then audio (frontend genre×cefr, duration=1)...');
  for (const combo of combos) {
    await runBackfill(theme, combo, 'article', 10 * 60 * 1000);
    await runBackfill(theme, combo, 'audio', 15 * 60 * 1000);
  }

  console.log('\n[3/4] verify...');
  let readyBoth = 0;
  for (const combo of combos) {
    const got = await getComboStatus(theme, combo);
    const ok = got.articleStatus === 'ready' && got.audioStatus === 'ready';
    if (ok) readyBoth += 1;
    console.log(
      ` ${combo.genre}/${combo.cefrLevel}/${combo.duration}m => status=${got.status} article=${got.articleStatus} audio=${got.audioStatus} url=${got.audio?.audioUrl || got.audioUrl || '-'}`,
    );
  }

  const db2 = openDb();
  try {
    const packDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const packs = db2.prepare(
      `SELECT status, theme, length(wakeup_json) AS w, length(flaw_vocab_json) AS f FROM daily_packs WHERE user_id=? AND pack_date=?`,
    ).all(USER_ID, packDate);
    const arts = db2.prepare(
      `SELECT genre, cefr_level, duration, status, length(COALESCE(body_text,'')) AS body_len,
              length(COALESCE(vocab_json,'')) AS vocab_len
       FROM daily_listen_articles
       WHERE user_id=? AND pack_date=? AND duration IN (1,'1')
       ORDER BY genre, cefr_level`,
    ).all(USER_ID, packDate);
    console.log('\n[4/4] db summary');
    console.log(' packs=', packs);
    console.log(` articles ready-ish rows=${arts.length}`);
    for (const a of arts) {
      console.log(`  ${a.genre}/${a.cefr_level}/${a.duration} status=${a.status} body=${a.body_len} vocab=${a.vocab_len}`);
    }
  } finally {
    db2.close();
  }

  console.log(`\nDone. readyBoth=${readyBoth}/${combos.length}`);
  if (readyBoth < combos.length) process.exitCode = 2;
}

main().catch((err) => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
