import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTH_REQUIRED_EVENT, fetchDailyCronRunDetail } from './dailyCronAPI';

const host = globalThis as typeof globalThis & { window: Window & typeof globalThis };
host.window = new EventTarget() as Window & typeof globalThis;

test('详情接口返回 401 时通知应用重新登录', async () => {
  const originalFetch = globalThis.fetch;
  let notified = false;
  window.addEventListener(AUTH_REQUIRED_EVENT, () => { notified = true; }, { once: true });
  globalThis.fetch = async () => new Response(JSON.stringify({ authenticated: false }), { status: 401 });

  try {
    await assert.rejects(fetchDailyCronRunDetail('run-1', 'test-user'), /登录已失效，请重新登录/);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(notified, true);
});
