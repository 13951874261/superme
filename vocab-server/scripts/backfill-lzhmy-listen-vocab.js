#!/usr/bin/env node
/**
 * C3: 为 lzhmy 的 meeting/A2/1 与 meeting/B1/1 仅回填词表（不重跑 TTS）
 *
 * 用法（服务已在 3001）:
 *   cd /var/www/super-agent/vocab-server
 *   node scripts/backfill-lzhmy-listen-vocab.js
 */
const BASE = process.env.FORCE_GEN_BASE || 'http://127.0.0.1:3001';
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

async function main() {
  console.log(`BASE=${BASE}`);
  console.log(`Backfill vocab only for ${USER_ID}, combos=${COMBOS.length}`);

  for (const combo of COMBOS) {
    const label = `${combo.genre}/${combo.cefrLevel}/${combo.duration}m`;
    console.log(`\n -> ${label}`);
    const res = await postJson('/api/listen/pregenerated/backfill-vocab', {
      userId: USER_ID,
      theme: THEME,
      genre: combo.genre,
      cefrLevel: combo.cefrLevel,
      duration: combo.duration,
      force: true,
    });
    console.log(
      ` [ok] ${label} skipped=${!!res.skipped} words=${res.vocabCount || 0} `
      + `phrases=${res.phraseCount || 0} sentences=${res.sentenceCount || 0}`,
    );
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
