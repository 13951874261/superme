/**
 * 打开独立对话大屏：按登录账号找最近有效会话；找不到则新开；禁止走 LLM 创建。
 * 运行：node vocab-server/tests/difyEmbedSession.test.js
 */
const assert = require('assert');
const { resolveDifyEmbedSession, EMBED_SESSION_BUDGET_MS } = require('../services/difyEmbedSession');

assert.ok(EMBED_SESSION_BUDGET_MS <= 2500, '服务端查找预算必须 ≤2500ms，给 iframe 留下余量');

function mockFetch(handlers) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: (options.method || 'GET').toUpperCase() });
    for (const h of handlers) {
      if (h.match(String(url), options)) return h.respond(url, options);
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

async function resolve(overrides) {
  return resolveDifyEmbedSession({
    userId: 'lzhmy',
    apiKey: 'app-test',
    baseUrl: 'https://dify.example/v1',
    ...overrides,
  });
}

(async () => {
  // 找到该登录账号最近一条会话 → 返回该 ID，不创建
  {
    const fetchImpl = mockFetch([
      {
        match: (url) => url.includes('/conversations') && url.includes('user=lzhmy'),
        respond: async () => ({
          ok: true,
          json: async () => ({ data: [{ id: 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb' }] }),
        }),
      },
      {
        match: (url) => url.includes('/messages') && url.includes('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'),
        respond: async () => ({ ok: true, json: async () => ({ data: [] }) }),
      },
    ]);
    const result = await resolve({ fetchImpl });
    assert.equal(result.conversationId, 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb');
    assert.equal(result.forceNew, undefined);
    assert.ok(!fetchImpl.calls.some((c) => c.url.includes('/chat-messages') || c.method === 'POST'));
  }

  // 缓存 ID 失效 → 回落到该用户最近一条有效会话
  {
    const fetchImpl = mockFetch([
      {
        match: (url) => url.includes('/messages') && url.includes('a30302c9-e68f-41ea-9593-4322b056cda8'),
        respond: async () => ({ ok: false, status: 404 }),
      },
      {
        match: (url) => url.includes('/conversations'),
        respond: async () => ({
          ok: true,
          json: async () => ({ data: [{ id: 'cccccccc-2222-4222-8222-cccccccccccc' }] }),
        }),
      },
      {
        match: (url) => url.includes('/messages') && url.includes('cccccccc-2222-4222-8222-cccccccccccc'),
        respond: async () => ({ ok: true, json: async () => ({ data: [] }) }),
      },
    ]);
    const result = await resolve({
      fetchImpl,
      conversationId: 'a30302c9-e68f-41ea-9593-4322b056cda8',
    });
    assert.equal(result.conversationId, 'cccccccc-2222-4222-8222-cccccccccccc');
    assert.equal(result.recovered, true);
    assert.ok(!fetchImpl.calls.some((c) => c.method === 'POST'));
  }

  // 没有任何历史 → 新开，且不得 POST /chat-messages（LLM 会超 3s）
  {
    const fetchImpl = mockFetch([
      {
        match: (url) => url.includes('/conversations'),
        respond: async () => ({ ok: true, json: async () => ({ data: [] }) }),
      },
    ]);
    const result = await resolve({ fetchImpl });
    assert.equal(result.conversationId, null);
    assert.equal(result.forceNew, true);
    assert.equal(result.reason, 'no_conversation');
    assert.ok(!fetchImpl.calls.some((c) => c.url.includes('/chat-messages')));
  }

  // renew=1（点「新对话」）立刻新开，不访问 Dify
  {
    const fetchImpl = mockFetch([]);
    const result = await resolve({ fetchImpl, renew: true });
    assert.equal(result.conversationId, null);
    assert.equal(result.forceNew, true);
    assert.equal(result.reason, 'renew');
    assert.equal(fetchImpl.calls.length, 0);
  }

  // 预算耗尽 → 新开，不创建
  {
    let now = 0;
    const fetchImpl = mockFetch([
      {
        match: () => true,
        respond: async () => {
          now += 4000;
          return { ok: true, json: async () => ({ data: [] }) };
        },
      },
    ]);
    const result = await resolve({
      fetchImpl,
      now: () => now,
      budgetMs: 2500,
    });
    assert.equal(result.conversationId, null);
    assert.equal(result.forceNew, true);
    assert.ok(!fetchImpl.calls.some((c) => c.method === 'POST'));
  }

  console.log('difyEmbedSession.test.js passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
