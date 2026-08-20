import assert from 'node:assert/strict';
import test from 'node:test';
import { getReviewPage, getVocabPage, getAllWords, getVocabByWord, lookupVocabWords } from './vocabAPI';

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

test('getAllWords 强制带 limit 分页且禁止全量裸请求', async () => {
  const urls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ items: [{ id: '1', word: 'test' }], hasMore: false }), { status: 200 });
  };

  try {
    const res1 = await getAllWords();
    const res2 = await getAllWords({ limit: 20 });
    assert.equal(res1.length, 1);
    assert.equal(res2.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(urls[0], '/api/vocab/list?light=1&limit=50');
  assert.equal(urls[1], '/api/vocab/list?light=1&limit=20');
});

test('getVocabByWord 按词点查构造单条轻量请求', async () => {
  const urls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ items: [{ id: '99', word: 'strategy' }], hasMore: false }), { status: 200 });
  };

  try {
    const res = await getVocabByWord('strategy');
    assert.equal(res?.word, 'strategy');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(urls[0], '/api/vocab/list?light=1&limit=1&word=strategy');
});

test('lookupVocabWords 发起 POST /lookup 批量检索', async () => {
  const calls: { url: string; method?: string; body?: any }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify({ items: [{ id: '1', word: 'apple' }] }), { status: 200 });
  };

  try {
    const res = await lookupVocabWords(['apple', 'banana']);
    assert.equal(res.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls[0].url, '/api/vocab/lookup');
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(calls[0].body, { words: ['apple', 'banana'] });
});
