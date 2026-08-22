'use strict';

const BASE = process.env.FORCE_GEN_BASE || 'http://127.0.0.1:3001';
const USER_ID = 'lzhmy';
const THEME = '新人报到';
const DATE = '2026-08-22';
const GENRES = ['meeting', 'news', 'podcast', 'reading'];
const CEFRS = ['A2', 'B1', 'B2', 'C1'];
const DURATIONS = [1, 15, 25, 35];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJson(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
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

function comboList() {
  const preferred = { genre: 'meeting', cefrLevel: 'B1', duration: 15 };
  const rest = [];
  for (const genre of GENRES) {
    for (const cefrLevel of CEFRS) {
      for (const duration of DURATIONS) {
        if (genre === preferred.genre && cefrLevel === preferred.cefrLevel && duration === preferred.duration) {
          continue;
        }
        rest.push({ genre, cefrLevel, duration });
      }
    }
  }
  return [preferred, ...rest];
}

async function comboStatus(combo) {
  const qs = new URLSearchParams({
    userId: USER_ID,
    theme: THEME,
    genre: combo.genre,
    cefrLevel: combo.cefrLevel,
    duration: String(combo.duration),
    date: DATE,
  });
  return getJson(`${BASE}/api/listen/pregenerated?${qs.toString()}`);
}

async function ensureCombo(combo) {
  const key = `${combo.genre}/${combo.cefrLevel}/${combo.duration}m`;
  const before = await comboStatus(combo);
  if (before.status === 'ready') {
    console.log(`[skip] ${key} already ready`);
    return { key, skipped: true };
  }
  console.log(`[backfill] ${key} current=${before.status}`);
  const created = await postJson('/api/listen/pregenerated/backfill', {
    userId: USER_ID,
    theme: THEME,
    genre: combo.genre,
    cefrLevel: combo.cefrLevel,
    duration: combo.duration,
  });
  const started = Date.now();
  const timeoutMs = combo.duration <= 1 ? 8 * 60 * 1000 : 20 * 60 * 1000;
  while (Date.now() - started < timeoutMs) {
    await sleep(5000);
    const cur = await comboStatus(combo);
    if (cur.status === 'ready') {
      console.log(`[ready] ${key} in ${Math.round((Date.now() - started) / 1000)}s task=${created.taskId || ''}`);
      return { key, ready: true };
    }
    if (cur.status === 'failed') {
      throw new Error(`${key} failed: ${cur.error || cur.audioStatus || cur.articleStatus}`);
    }
    console.log(`[wait] ${key} ${cur.status} article=${cur.articleStatus} audio=${cur.audioStatus}`);
  }
  throw new Error(`${key} timeout after ${timeoutMs}ms`);
}

async function main() {
  const list = comboList();
  console.log(`recover ${list.length} combos for ${USER_ID} ${DATE} theme=${THEME}`);
  let ok = 0;
  let fail = 0;
  for (const combo of list) {
    try {
      await ensureCombo(combo);
      ok += 1;
    } catch (err) {
      fail += 1;
      console.error(`[fail] ${combo.genre}/${combo.cefrLevel}/${combo.duration}m`, err.message);
    }
  }
  console.log(`[done] ok=${ok} fail=${fail}`);
  if (fail) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
