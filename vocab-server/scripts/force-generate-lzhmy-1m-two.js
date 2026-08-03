#!/usr/bin/env node
/**
 * 服务器侧：为 lzhmy 强制重生成
 * - 今日唤醒/破绽包
 * - 长文+mp3 仅两组：meeting/A2/1 、 meeting/B1/1
 *
 * 用法（服务已在 3001 运行时）:
 *   cd /var/www/super-agent/vocab-server
 *   node scripts/force-generate-lzhmy-1m-two.js
 */
const BASE = process.env.FORCE_GEN_BASE || 'http://127.0.0.1:3001';
const USER_ID = 'lzhmy';
const THEME = '商务谈判：让步与施压';
const COMBOS = [
  { genre: 'meeting', cefrLevel: 'A2', duration: 1 },
  { genre: 'meeting', cefrLevel: 'B1', duration: 1 },
];

async function postJson(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || data.message || `HTTP ${res.status} ${path}`);
  }
  return data;
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status} ${path}`);
  return data;
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitTask(taskId, label, timeoutMs = 20 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const task = await getJson(`/api/tasks/${taskId}`);
    const status = task?.status;
    if (status === 'completed') {
      console.log(`[ok] ${label}`);
      return task;
    }
    if (status === 'failed') {
      throw new Error(`${label} failed: ${task?.error || 'unknown'}`);
    }
    await sleep(3000);
  }
  throw new Error(`${label} timeout`);
}

async function waitPackReady(timeoutMs = 10 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const q = new URLSearchParams({ userId: USER_ID, theme: THEME });
    const pack = await getJson(`/api/daily-pack/today?${q}`);
    if (pack.status === 'ready' && pack.wakeup && Array.isArray(pack.flawVocab) && pack.flawVocab.length) {
      console.log('[ok] daily pack ready');
      return pack;
    }
    if (pack.status === 'failed') {
      throw new Error(`daily pack failed: ${pack.errorMessage || 'unknown'}`);
    }
    await sleep(2500);
  }
  throw new Error('daily pack wait timeout');
}

async function main() {
  console.log(`BASE=${BASE}`);
  console.log(`Force generate user=${USER_ID} combos=${COMBOS.length}`);

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

  console.log('\n[2/3] force backfill listen combos (article+audio)...');
  for (const combo of COMBOS) {
    const label = `${combo.genre}/${combo.cefrLevel}/${combo.duration}m`;
    console.log(` -> ${label}`);
    const res = await postJson('/api/listen/pregenerated/backfill', {
      userId: USER_ID,
      theme: THEME,
      genre: combo.genre,
      cefrLevel: combo.cefrLevel,
      duration: combo.duration,
      only: 'both',
    });
    if (res.taskId) {
      await waitTask(res.taskId, label);
    } else {
      console.log(`[ok] ${label} (no taskId)`);
    }
  }

  console.log('\n[3/3] verify pregenerated...');
  for (const combo of COMBOS) {
    const q = new URLSearchParams({
      userId: USER_ID,
      theme: THEME,
      genre: combo.genre,
      cefrLevel: combo.cefrLevel,
      duration: String(combo.duration),
    });
    const got = await getJson(`/api/listen/pregenerated?${q}`);
    console.log(
      ` ${combo.genre}/${combo.cefrLevel}/${combo.duration}m => status=${got.status} article=${got.articleStatus} audio=${got.audioStatus}`,
    );
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
