#!/usr/bin/env node
/**
 * 服务器完整后台模拟：lzhmy（P2 正式 / T1 测试）
 *
 * P2 正式：
 *   - 跳过已 ready 的 article/audio（不 force 重跑）
 *   - 文章并发 ARTICLE_CONCURRENCY（默认 2）
 *   - 音频并发 AUDIO_CONCURRENCY（默认 1）
 *   - 先跑完全部缺口文章，再跑缺口音频
 *
 * T1 测试：
 *   MODE=test → 默认 ONLY_COMBOS=meeting:B1；可 SKIP_AUDIO=1 只验文章链路
 *
 * 用法:
 *   cd /var/www/super-agent/vocab-server
 *   # 正式全量（续跑建议 SKIP_CLEAR=1 SKIP_PACK=1）
 *   SKIP_CLEAR=1 SKIP_PACK=1 node scripts/simulate-lzhmy-1m-frontend-full.js
 *
 *   # 测试快路径
 *   MODE=test SKIP_CLEAR=1 SKIP_PACK=1 node scripts/simulate-lzhmy-1m-frontend-full.js
 *   MODE=test SKIP_CLEAR=1 SKIP_PACK=1 SKIP_AUDIO=1 node scripts/simulate-lzhmy-1m-frontend-full.js
 *
 * 环境变量:
 *   FORCE_GEN_BASE / VOCAB_DB_PATH / FORCE_USER_ID / FORCE_THEME
 *   SKIP_CLEAR=1 | SKIP_PACK=1 | SKIP_AUDIO=1
 *   MODE=test|prod（默认 prod）
 *   ONLY_COMBOS=meeting:A2,meeting:B1
 *   ARTICLE_CONCURRENCY=2  AUDIO_CONCURRENCY=1
 *   ARTICLE_TIMEOUT_MS / AUDIO_TIMEOUT_MS（默认 12min / 15min）
 *   FORCE_REGEN=1  # 强制重跑（忽略 ready 跳过）
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const BASE = process.env.FORCE_GEN_BASE || 'http://127.0.0.1:3001';
const DB_PATH = process.env.VOCAB_DB_PATH || path.join(__dirname, '..', '..', 'vocab.db');
const USER_ID = process.env.FORCE_USER_ID || 'lzhmy';
const SKIP_CLEAR = process.env.SKIP_CLEAR === '1';
const SKIP_PACK = process.env.SKIP_PACK === '1';
const SKIP_AUDIO = process.env.SKIP_AUDIO === '1';
const FORCE_REGEN = process.env.FORCE_REGEN === '1';
const MODE = String(process.env.MODE || 'prod').trim().toLowerCase();
const ARTICLE_CONCURRENCY = Math.max(1, Number(process.env.ARTICLE_CONCURRENCY || 2));
const AUDIO_CONCURRENCY = Math.max(1, Number(process.env.AUDIO_CONCURRENCY || 1));
const ARTICLE_TIMEOUT_MS = Number(process.env.ARTICLE_TIMEOUT_MS || 12 * 60 * 1000);
const AUDIO_TIMEOUT_MS = Number(process.env.AUDIO_TIMEOUT_MS || 15 * 60 * 1000);

const API_ROOT = path.join(__dirname, '..');
const AUDIO_ROOT = path.join(API_ROOT, 'public', 'daily_listen_audio');
const ARTICLE_ROOT = path.join(API_ROOT, 'public', 'daily_long_articles');

const ALL_GENRES = ['meeting', 'news', 'podcast', 'reading'];
const ALL_CEFR = ['A2', 'B1', 'B2', 'C1'];
const DURATION = 1;

function resolveCombos() {
  let raw = String(process.env.ONLY_COMBOS || '').trim();
  if (!raw && MODE === 'test') {
    raw = 'meeting:B1';
    console.log('[mode] T1 test → ONLY_COMBOS=meeting:B1');
  }
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

function comboKey(c) {
  return `${c.genre}/${c.cefrLevel}/${c.duration}`;
}

async function mapPool(items, concurrency, worker) {
  const list = [...items];
  const results = [];
  let idx = 0;
  const runners = Array.from({ length: Math.min(concurrency, list.length || 1) }, async () => {
    while (idx < list.length) {
      const cur = idx;
      idx += 1;
      const item = list[cur];
      try {
        results[cur] = { ok: true, item, value: await worker(item, cur) };
      } catch (err) {
        results[cur] = { ok: false, item, error: err };
        console.error(`[fail] ${comboKey(item)}: ${err.message || err}`);
      }
    }
  });
  await Promise.all(runners);
  return results;
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

function shanghaiDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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
      const row = db.prepare(`
        SELECT content AS profile_content FROM profiles
        WHERE user_id=? LIMIT 1
      `).get(USER_ID);
      userCurrentProfile = String(row?.profile_content || '').trim().slice(0, 280);
    } catch (_) {}
  }

  return { theme, historyExclude, userCurrentProfile };
}

/** 读库判定 ready（不依赖 API 签名宽查） */
function readComboReadyFromDb(theme, combo) {
  const db = openDb();
  try {
    const packDate = shanghaiDate();
    const art = db.prepare(`
      SELECT status, length(COALESCE(body_text,'')) AS body_len
      FROM daily_listen_articles
      WHERE user_id=? AND pack_date=? AND theme=? AND genre=? AND cefr_level=? AND duration IN (?, ?)
      ORDER BY updated_at DESC LIMIT 1
    `).get(USER_ID, packDate, theme, combo.genre, combo.cefrLevel, combo.duration, String(combo.duration));
    const aud = db.prepare(`
      SELECT status, length(COALESCE(audio_path,'')) AS path_len, length(COALESCE(audio_url,'')) AS url_len
      FROM daily_listen_audios
      WHERE user_id=? AND pack_date=? AND theme=? AND genre=? AND cefr_level=? AND duration IN (?, ?)
      ORDER BY updated_at DESC LIMIT 1
    `).get(USER_ID, packDate, theme, combo.genre, combo.cefrLevel, combo.duration, String(combo.duration));
    const articleReady = art?.status === 'ready' && Number(art.body_len || 0) > 50;
    const audioReady = aud?.status === 'ready' && (Number(aud.path_len || 0) > 0 || Number(aud.url_len || 0) > 0);
    return { articleReady, audioReady, art, aud };
  } finally {
    db.close();
  }
}

function backupAndClear(db) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const bk = path.join('/var/www/super-agent', `backup_gen_cache_${ts}`);
  fs.mkdirSync(bk, { recursive: true });
  fs.copyFileSync(DB_PATH, path.join(bk, 'vocab.db'));
  for (const dir of [AUDIO_ROOT, ARTICLE_ROOT]) {
    if (!fs.existsSync(dir)) continue;
    fs.cpSync(dir, path.join(bk, path.basename(dir)), { recursive: true });
  }
  console.log(`[clear] backup => ${bk}`);

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
  console.log('[clear] tables+files wiped');
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
  const label = `${comboKey(combo)}:${need}`;
  const started = Date.now();
  let lastLog = 0;
  while (Date.now() - started < timeoutMs) {
    let taskStatus = 'unknown';
    try {
      const task = await getJson(`/api/tasks/${taskId}`);
      taskStatus = task.status || 'unknown';
      if (taskStatus === 'failed') {
        throw new Error(`${label} task failed: ${task.error || 'unknown'}`);
      }
      if (taskStatus === 'completed') {
        console.log(`[ok] ${label} (task completed)`);
        return task;
      }
    } catch (e) {
      if (String(e.message || e).includes('task failed')) throw e;
      // fetch failed：回落读库
      if (/fetch failed|ECONNRESET|ECONNREFUSED|aborted/i.test(String(e.message || e))) {
        const dbReady = readComboReadyFromDb(theme, combo);
        if (need === 'article' && dbReady.articleReady) {
          console.log(`[ok] ${label} (db ready after fetch hiccup)`);
          return dbReady;
        }
        if (need === 'audio' && dbReady.audioReady) {
          console.log(`[ok] ${label} (db ready after fetch hiccup)`);
          return dbReady;
        }
      }
    }

    const dbReady = readComboReadyFromDb(theme, combo);
    if (need === 'article' && dbReady.articleReady) {
      console.log(`[ok] ${label} (db ready)`);
      return dbReady;
    }
    if (need === 'audio' && dbReady.audioReady) {
      console.log(`[ok] ${label} (db ready)`);
      return dbReady;
    }

    if (Date.now() - lastLog > 15000) {
      lastLog = Date.now();
      const elapsed = Math.round((Date.now() - started) / 1000);
      let apiArt = '-';
      let apiAud = '-';
      try {
        const got = await getComboStatus(theme, combo);
        apiArt = got.articleStatus || got.status || '-';
        apiAud = got.audioStatus || '-';
      } catch (_) {}
      console.log(
        `  ... ${label} ${elapsed}s task=${taskStatus} apiArt=${apiArt} apiAud=${apiAud} dbArt=${dbReady.articleReady} dbAud=${dbReady.audioReady}`,
      );
    }
    await sleep(3000);
  }
  const last = readComboReadyFromDb(theme, combo);
  throw new Error(`${label} timeout; dbArt=${last.articleReady} dbAud=${last.audioReady}`);
}

async function runBackfill(theme, combo, only, timeoutMs) {
  const label = `${comboKey(combo)}:${only}`;
  console.log(` -> ${label}`);
  const res = await postJson('/api/listen/pregenerated/backfill', {
    userId: USER_ID,
    theme,
    genre: combo.genre,
    cefrLevel: combo.cefrLevel,
    duration: combo.duration,
    only,
  });
  if (!res.taskId) {
    console.log(`[ok] ${label} (no taskId)`);
    return;
  }
  console.log(`    taskId=${res.taskId}`);
  await waitBackfill(res.taskId, theme, combo, only, timeoutMs);
}

function readPackRowFromDb() {
  const db = openDb();
  try {
    return db.prepare(`
      SELECT status, theme, input_signature,
             length(COALESCE(wakeup_json,'')) AS wakeup_len,
             length(COALESCE(flaw_vocab_json,'')) AS flaw_len,
             error_message
      FROM daily_packs
      WHERE user_id=? AND pack_date=?
      ORDER BY updated_at DESC LIMIT 1
    `).get(USER_ID, shanghaiDate()) || null;
  } finally {
    db.close();
  }
}

async function waitPackReady(theme, historyExclude, userCurrentProfile, timeoutMs = 10 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const row = readPackRowFromDb();
    if (row) {
      const wakeupOk = Number(row.wakeup_len || 0) > 8;
      const flawOk = Number(row.flaw_len || 0) > 8;
      if (row.status === 'ready' && wakeupOk && flawOk) {
        console.log(`[ok] daily pack ready wakeup_len=${row.wakeup_len} flaw_len=${row.flaw_len}`);
        return row;
      }
      if (row.status === 'failed') throw new Error(`daily pack failed: ${row.error_message || 'unknown'}`);
      const elapsed = Math.round((Date.now() - started) / 1000);
      if (elapsed % 15 < 3) {
        console.log(`  ... pack ${elapsed}s status=${row.status} wakeup_len=${row.wakeup_len} flaw_len=${row.flaw_len}`);
      }
      if (row.status === 'ready' && elapsed > 45) {
        if (wakeupOk && !flawOk) {
          await postJson('/api/daily-pack/regenerate', {
            userId: USER_ID, type: 'flaw', theme, historyExclude, userCurrentProfile,
          });
        } else if (!wakeupOk && flawOk) {
          await postJson('/api/daily-pack/regenerate', {
            userId: USER_ID, type: 'wakeup', theme, historyExclude, userCurrentProfile,
          });
        } else if (!wakeupOk && !flawOk) {
          await postJson('/api/daily-pack/regenerate', {
            userId: USER_ID, type: 'both', theme, historyExclude, userCurrentProfile,
          });
        }
      }
    }
    await sleep(2500);
  }
  throw new Error(`daily pack wait timeout; last=${JSON.stringify(readPackRowFromDb() || {})}`);
}

async function runListenPhase(theme, combos) {
  const articleNeed = [];
  const audioNeed = [];

  for (const combo of combos) {
    const ready = FORCE_REGEN
      ? { articleReady: false, audioReady: false }
      : readComboReadyFromDb(theme, combo);
    if (ready.articleReady) {
      console.log(`[skip] ${comboKey(combo)}:article already ready`);
    } else {
      articleNeed.push(combo);
    }
    if (SKIP_AUDIO) {
      console.log(`[skip] ${comboKey(combo)}:audio SKIP_AUDIO=1`);
    } else if (ready.audioReady) {
      console.log(`[skip] ${comboKey(combo)}:audio already ready`);
    } else {
      audioNeed.push(combo);
    }
  }

  console.log(
    `[plan] articles_to_run=${articleNeed.length} audios_to_run=${audioNeed.length} `
    + `articleConc=${ARTICLE_CONCURRENCY} audioConc=${AUDIO_CONCURRENCY} forceRegen=${FORCE_REGEN}`,
  );

  console.log('\n[2a/4] parallel articles...');
  const artResults = await mapPool(articleNeed, ARTICLE_CONCURRENCY, async (combo) => {
    await runBackfill(theme, combo, 'article', ARTICLE_TIMEOUT_MS);
    return true;
  });
  const artFail = artResults.filter((r) => r && !r.ok).length;
  console.log(`[2a] article done fail=${artFail}/${articleNeed.length}`);

  if (!SKIP_AUDIO) {
    // 音频只对「文章已 ready」的组合开跑
    const audioQueue = [];
    for (const combo of audioNeed) {
      const ready = readComboReadyFromDb(theme, combo);
      if (!ready.articleReady) {
        console.log(`[skip] ${comboKey(combo)}:audio (article not ready)`);
        continue;
      }
      if (ready.audioReady && !FORCE_REGEN) {
        console.log(`[skip] ${comboKey(combo)}:audio already ready`);
        continue;
      }
      audioQueue.push(combo);
    }
    console.log('\n[2b/4] parallel audios...');
    const audResults = await mapPool(audioQueue, AUDIO_CONCURRENCY, async (combo) => {
      await runBackfill(theme, combo, 'audio', AUDIO_TIMEOUT_MS);
      return true;
    });
    const audFail = audResults.filter((r) => r && !r.ok).length;
    console.log(`[2b] audio done fail=${audFail}/${audioQueue.length}`);
  }
}

async function main() {
  const combos = resolveCombos();
  console.log(`BASE=${BASE}`);
  console.log(`DB_PATH=${DB_PATH}`);
  console.log(`MODE=${MODE} USER=${USER_ID} duration=${DURATION} combos=${combos.length}`);
  console.log(`concurrency article=${ARTICLE_CONCURRENCY} audio=${AUDIO_CONCURRENCY}`);

  const db = openDb();
  let theme;
  let historyExclude;
  let userCurrentProfile;
  try {
    if (!SKIP_CLEAR) {
      console.log('\n[0/4] backup + clear...');
      backupAndClear(db);
    } else {
      console.log('\n[0/4] SKIP_CLEAR=1');
    }
    ({ theme, historyExclude, userCurrentProfile } = readThemeAndInputs(db));
  } finally {
    db.close();
  }

  console.log(`THEME=${theme}`);
  console.log(`historyExclude.len=${historyExclude.length} profile.len=${userCurrentProfile.length}`);

  await getJson('/api/vocab/stats');
  console.log('[health] ok');

  if (SKIP_PACK) {
    console.log('\n[1/4] SKIP_PACK=1');
  } else {
    console.log('\n[1/4] regenerate daily pack...');
    const packRes = await postJson('/api/daily-pack/regenerate', {
      userId: USER_ID,
      type: 'both',
      theme,
      historyExclude,
      userCurrentProfile,
    });
    console.log('pack status=', packRes.status);
    await waitPackReady(theme, historyExclude, userCurrentProfile);
  }

  console.log('\n[2/4] listen backfill (P2: skip-ready + pooled)...');
  await runListenPhase(theme, combos);

  console.log('\n[3/4] verify...');
  let readyBoth = 0;
  let readyArt = 0;
  for (const combo of combos) {
    const dbReady = readComboReadyFromDb(theme, combo);
    if (dbReady.articleReady) readyArt += 1;
    if (dbReady.articleReady && dbReady.audioReady) readyBoth += 1;
    let api = {};
    try {
      api = await getComboStatus(theme, combo);
    } catch (_) {}
    console.log(
      ` ${comboKey(combo)}m => dbArt=${dbReady.articleReady} dbAud=${dbReady.audioReady} `
      + `apiArt=${api.articleStatus || '-'} apiAud=${api.audioStatus || '-'}`,
    );
  }

  console.log(`\nDone. readyArt=${readyArt}/${combos.length} readyBoth=${readyBoth}/${combos.length}`);
  if (SKIP_AUDIO) {
    if (readyArt < combos.length) process.exitCode = 2;
  } else if (readyBoth < combos.length) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
