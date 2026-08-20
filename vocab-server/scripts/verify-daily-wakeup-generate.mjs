#!/usr/bin/env node
/**
 * Verify Daily Wakeup generation path (theme sync + regenerate type=wakeup + today read).
 *
 * Usage (PowerShell):
 *   $env:SMOKE_BASE_URL = 'https://ai.234124123.xyz'
 *   node vocab-server/scripts/verify-daily-wakeup-generate.mjs
 *
 * Optional:
 *   $env:SMOKE_USER_ID = 'verify-wakeup-user'
 *   $env:SMOKE_THEME = '银团贷款条款谈判'
 */

const BASE = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const USER = process.env.SMOKE_USER_ID || `verify-wakeup-${Date.now()}`;
const THEME = process.env.SMOKE_THEME || 'verify-wakeup-theme';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log('[verify-wakeup] BASE=', BASE);
  console.log('[verify-wakeup] USER=', USER);
  console.log('[verify-wakeup] THEME=', THEME);

  const put = await req('PUT', '/api/user/theme', { userId: USER, theme: THEME });
  assert(put.res.ok && put.json.success, `theme sync failed: ${JSON.stringify(put.json)}`);
  console.log('[1] theme sync OK');

  const before = await req('GET', `/api/daily-pack/today?userId=${encodeURIComponent(USER)}`);
  assert(before.res.ok, `GET today failed: ${before.res.status}`);
  const flawBefore = before.json.flawVocab ? JSON.stringify(before.json.flawVocab) : null;
  console.log('[2] today before:', before.json.status, 'wakeup=', Boolean(before.json.wakeup), 'flaw=', Boolean(before.json.flawVocab));

  const regen = await req('POST', '/api/daily-pack/regenerate', {
    userId: USER,
    type: 'wakeup',
    theme: THEME,
  });
  assert(regen.res.ok, `regenerate wakeup failed: ${regen.res.status} ${JSON.stringify(regen.json)}`);
  console.log('[3a] regenerate accepted:', regen.json.status);

  let pack = regen.json;
  if (pack.status === 'generating' || !pack.wakeup) {
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const poll = await req('GET', `/api/daily-pack/today?userId=${encodeURIComponent(USER)}`);
      assert(poll.res.ok, `poll today failed: ${poll.res.status}`);
      pack = poll.json;
      console.log('[3b] poll:', pack.status, 'wakeup=', Boolean(pack.wakeup));
      if (pack.status === 'ready' && pack.wakeup) break;
      if (pack.status === 'failed') throw new Error(pack.errorMessage || 'generate failed');
    }
  }

  assert(pack.status === 'ready', `expected ready, got ${pack.status}: ${pack.errorMessage || ''}`);
  assert(pack.wakeup && Array.isArray(pack.wakeup.vocab) && pack.wakeup.vocab.length > 0, 'wakeup.vocab empty');
  assert(pack.wakeup.grammar && pack.wakeup.grammar.point, 'wakeup.grammar missing');
  console.log('[3] regenerate type=wakeup OK; vocab=', pack.wakeup.vocab.length, 'grammar=', pack.wakeup.grammar.point);

  const after = await req('GET', `/api/daily-pack/today?userId=${encodeURIComponent(USER)}`);
  assert(after.res.ok && after.json.status === 'ready', `GET today after failed: ${JSON.stringify(after.json)}`);
  assert(after.json.wakeup && after.json.wakeup.vocab?.length > 0, 'today wakeup missing after regen');
  console.log('[4] GET today after OK; packDate=', after.json.packDate, 'source=', after.json.source);

  if (flawBefore) {
    const flawAfter = after.json.flawVocab ? JSON.stringify(after.json.flawVocab) : null;
    assert(flawAfter === flawBefore, 'type=wakeup must NOT overwrite existing flawVocab');
    console.log('[5] flawVocab preserved OK');
  } else {
    console.log('[5] skip flaw preserve check (no prior flawVocab)');
  }

  console.log('verify-daily-wakeup-generate: PASS');
}

main().catch((e) => {
  const cause = e.cause ? ` | cause=${e.cause.code || e.cause.message || e.cause}` : '';
  console.error('verify-daily-wakeup-generate: FAIL', e.message + cause);
  if (String(e.message).includes('fetch failed')) {
    console.error(
      'Hint: DNS/TLS/network to SMOKE_BASE_URL failed. Prefer https://app.liujingzhuwo.site (ai.234124123.xyz may have no DNS).',
    );
  }
  process.exit(1);
});
