#!/usr/bin/env node
const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001';
const USER = `smoke-${Date.now()}`;

async function main() {
  const put = await fetch(`${BASE}/api/user/theme`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: USER, theme: 'smoke-test-theme' }),
  });
  const putJson = await put.json();
  if (!put.ok || !putJson.success) throw new Error('theme sync failed');

  const get = await fetch(`${BASE}/api/daily-pack/today?userId=${encodeURIComponent(USER)}`);
  const getJson = await get.json();
  if (!get.ok || getJson.status !== 'missing') throw new Error(`expected missing, got ${getJson.status}`);

  console.log('smoke-daily-pack: PASS');
}

main().catch((e) => {
  console.error('smoke-daily-pack: FAIL', e.message);
  process.exit(1);
});
