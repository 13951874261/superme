#!/usr/bin/env node
/**
 * 服务器侧：为 lzhmy 强制重生成
 * - 今日唤醒/破绽包
 * - 长文+mp3 仅两组：meeting/A2/1 、 meeting/B1/1
 *
 * 改进：
 * - 先清理卡住的 generating
 * - 每组先 only=article，再 only=audio
 * - 轮询 task + /api/listen/pregenerated 双通道
 * - 打印进度，避免“假死”
 *
 * 用法:
 *   cd /var/www/super-agent/vocab-server
 *   node scripts/force-generate-lzhmy-1m-two.js
 */
const path = require('path');
const Database = require('better-sqlite3');

const BASE = process.env.FORCE_GEN_BASE || 'http://127.0.0.1:3001';
const DB_PATH = process.env.VOCAB_DB_PATH || path.join(__dirname, '..', '..', 'vocab.db');
const USER_ID = 'lzhmy';
const THEME = '商务谈判：让步与施压';
const COMBOS = [
  { genre: 'meeting', cefrLevel: 'A2', duration: 1 },
  { genre: 'meeting', cefrLevel: 'B1', duration: 1 },
];

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

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

function clearStuckRows() {
  const db = new Database(DB_PATH);
  try {
    const packDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const now = Date.now();
    const art = db.prepare(`
      UPDATE daily_listen_articles
      SET status='failed', error_message='cleared before force-generate', updated_at=?
      WHERE user_id=? AND pack_date=? AND genre='meeting' AND duration IN (1,'1')
        AND cefr_level IN ('A2','B1') AND status IN ('generating','failed')
    `).run(now, USER_ID, packDate);
    const aud = db.prepare(`
      UPDATE daily_listen_audios
      SET status='failed', error_message='cleared before force-generate', updated_at=?
      WHERE user_id=? AND pack_date=? AND genre='meeting' AND duration IN (1,'1')
        AND cefr_level IN ('A2','B1') AND status IN ('generating','failed')
    `).run(now, USER_ID, packDate);
    console.log(`[prep] cleared stuck rows articles=${art.changes} audios=${aud.changes} date=${packDate} db=${DB_PATH}`);
  } finally {
    db.close();
  }
}

async function getComboStatus(combo) {
  const q = new URLSearchParams({
    userId: USER_ID,
    theme: THEME,
    genre: combo.genre,
    cefrLevel: combo.cefrLevel,
    duration: String(combo.duration),
  });
  return getJson(`/api/listen/pregenerated?${q}`);
}

async function waitBackfill(taskId, combo, need, timeoutMs) {
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
      // task 404 时继续看缓存
    }

    const got = await getComboStatus(combo);
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
    if (need === 'both' && articleOk && audioOk) {
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
  const got = await getComboStatus(combo).catch(() => ({}));
  throw new Error(
    `${label} timeout; last article=${got.articleStatus} audio=${got.audioStatus}`,
  );
}

async function runBackfill(combo, only, timeoutMs) {
  const label = `${combo.genre}/${combo.cefrLevel}/${combo.duration}m:${only}`;
  console.log(` -> ${label}`);
  const res = await postJson('/api/listen/pregenerated/backfill', {
    userId: USER_ID,
    theme: THEME,
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
  await waitBackfill(res.taskId, combo, only, timeoutMs);
}

async function waitPackReady(timeoutMs = 10 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const q = new URLSearchParams({ userId: USER_ID, theme: THEME });
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
  console.log(`BASE=${BASE}`);
  console.log(`DB_PATH=${DB_PATH}`);
  console.log(`Force generate user=${USER_ID} combos=${COMBOS.length}`);

  console.log('\n[0/3] clear stuck generating rows...');
  clearStuckRows();

  console.log('\n[1/3] regenerate daily pack (wakeup + flaw)...');
  const packRes = await postJson('/api/daily-pack/regenerate', {
    userId: USER_ID,
    type: 'both',
    theme: THEME,
  });
  console.log('pack status=', packRes.status);
  if (packRes.status === 'generating' || packRes.status === 'ready') {
    await waitPackReady();
  }

  console.log('\n[2/3] force backfill (article then audio)...');
  for (const combo of COMBOS) {
    await runBackfill(combo, 'article', 8 * 60 * 1000);
    await runBackfill(combo, 'audio', 12 * 60 * 1000);
  }

  console.log('\n[3/3] verify pregenerated...');
  for (const combo of COMBOS) {
    const got = await getComboStatus(combo);
    console.log(
      ` ${combo.genre}/${combo.cefrLevel}/${combo.duration}m => status=${got.status} article=${got.articleStatus} audio=${got.audioStatus} url=${got.audio?.audioUrl || got.audioUrl || '-'}`,
    );
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
