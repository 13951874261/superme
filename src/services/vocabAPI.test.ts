import assert from 'node:assert/strict';
import test from 'node:test';
import { getReviewPage, getVocabPage } from './vocabAPI';

const host = globalThis as typeof globalThis & { window: Window & typeof globalThis };
host.window = globalThis as unknown as Window & typeof globalThis;

test('分页请求携带分区与 offset，避免不同分区重复首批数据', async () => {
  const urls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ items: [], hasMore: false }), { status: 200 });
  };

  try {
    await (getVocabPage as any)('general', 50, 100);
    await (getReviewPage as any)('business', 50, 100);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(urls[0], '/api/vocab/list?light=1&category=general&limit=100&offset=50');
  assert.equal(urls[1], '/api/vocab/review?light=1&category=business&limit=50&offset=100');
});
