/**
 * 打开独立对话大屏：按登录账号查 Dify 网页侧仍有效会话；找不到则新开；禁止走 LLM 创建。
 * 运行：node vocab-server/tests/difyEmbedSession.test.js
 */
const assert = require('assert');
const { resolveDifyEmbedSession, EMBED_SESSION_BUDGET_MS } = require('../services/difyEmbedSession');

assert.ok(EMBED_SESSION_BUDGET_MS <= 2500, '服务端查找预算必须 ≤2500ms，给 iframe 留下余量');

function mockFetch(handlers) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const headers = options.headers || {};
    calls.push({
      url: String(url),
      method: (options.method || 'GET').toUpperCase(),
      headers,
    });
    for (const h of handlers) {
      if (h.match(String(url), options)) return h.respond(url, options);
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function jsonOk(payload) {
  return { ok: true, json: async () => payload };
}

async function resolve(overrides) {
  return resolveDifyEmbedSession({
    userId: 'lzhmy',
    webBaseUrl: 'https://dify.example',
    appCode: 'app-code-test',
    ...overrides,
  });
}

(async () => {
  // 网页侧找到该登录账号历史（@embed2 槽）→ 返回该 ID，不走 Service API
  {
    const fetchImpl = mockFetch([
      {
        match: (url) => url.includes('/api/passport') && url.includes('lzhmy%40embed2'),
        respond: async () => jsonOk({ access_token: 'tok-embed2' }),
      },
      {
        match: (url) => url.includes('/api/passport'),
        respond: async () => jsonOk({ access_token: 'tok-other' }),
      },
      {
        match: (url, options) => url.includes('/api/conversations')
          && (options.headers['X-App-Passport'] === 'tok-embed2' || options.headers['x-app-passport'] === 'tok-embed2'),
        respond: async () => jsonOk({
          data: [{ id: '0b4fc10d-96ff-47cc-a5e6-efe0bd962adb', updated_at: 1788002337, name: '如何不断提升自己' }],
        }),
      },
      {
        match: (url) => url.includes('/api/conversations'),
        respond: async () => jsonOk({ data: [] }),
      },
      {
        match: (url) => url.includes('/api/messages') && url.includes('0b4fc10d-96ff-47cc-a5e6-efe0bd962adb'),
        respond: async () => jsonOk({ data: [{ id: 'm1' }] }),
      },
    ]);
    const result = await resolve({ fetchImpl });
    assert.equal(result.conversationId, '0b4fc10d-96ff-47cc-a5e6-efe0bd962adb');
    assert.equal(result.sessionUserId, 'lzhmy@embed2');
    assert.ok(!fetchImpl.calls.some((c) => c.url.includes('/v1/')));
    assert.ok(!fetchImpl.calls.some((c) => c.method === 'POST'));
  }

  // 死会话 404 跳过，改用同账号下另一条仍有效的网页会话
  {
    const fetchImpl = mockFetch([
      {
        match: (url) => url.includes('/api/passport'),
        respond: async () => jsonOk({ access_token: 'tok' }),
      },
      {
        match: (url) => url.includes('/api/conversations'),
        respond: async () => jsonOk({
          data: [
            { id: 'a30302c9-e68f-41ea-9593-4322b056cda8', updated_at: 99 },
            { id: 'cccccccc-2222-4222-8222-cccccccccccc', updated_at: 50 },
          ],
        }),
      },
      {
        match: (url) => url.includes('/api/messages') && url.includes('a30302c9-e68f-41ea-9593-4322b056cda8'),
        respond: async () => ({ ok: false, status: 404, json: async () => ({}) }),
      },
      {
        match: (url) => url.includes('/api/messages') && url.includes('cccccccc-2222-4222-8222-cccccccccccc'),
        respond: async () => jsonOk({ data: [] }),
      },
    ]);
    const result = await resolve({ fetchImpl });
    assert.equal(result.conversationId, 'cccccccc-2222-4222-8222-cccccccccccc');
    assert.equal(result.sessionUserId, 'lzhmy');
  }

  // 没有任何网页历史 → 新开，且不得 POST
  {
    const fetchImpl = mockFetch([
      {
        match: (url) => url.includes('/api/passport'),
        respond: async () => jsonOk({ access_token: 'tok' }),
      },
      {
        match: (url) => url.includes('/api/conversations'),
        respond: async () => jsonOk({ data: [] }),
      },
    ]);
    const result = await resolve({ fetchImpl });
    assert.equal(result.conversationId, null);
    assert.equal(result.forceNew, true);
    assert.equal(result.sessionUserId, 'lzhmy');
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
          return jsonOk({ access_token: 'tok', data: [] });
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
