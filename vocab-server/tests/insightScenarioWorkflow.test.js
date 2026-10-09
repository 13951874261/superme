const assert = require('node:assert/strict');
const test = require('node:test');
const {
  parseInsightGenAnswer,
  runInsightScenarioWorkflow,
} = require('../services/insightSpeakProxy');
const { generateInsightScenario } = require('../services/insightScenarioGenerate');
const { getFallbackDraft } = require('../services/insightScenarioScript');

test('parseInsightGenAnswer 读取 workflow outputs.answer', () => {
  assert.equal(
    parseInsightGenAnswer({ data: { outputs: { answer: '  {"sceneTitle":"测试"}  ' } } }),
    '{"sceneTitle":"测试"}'
  );
});

test('runInsightScenarioWorkflow 调用 blocking workflows/run', async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ data: { outputs: { answer: '{}' } } }) };
  };

  try {
    const result = await runInsightScenarioWorkflow({
      apiKey: 'secret',
      baseUrl: 'https://dify.example/v1/',
      inputs: { category: '外企', retry_hint: '重试' },
      userId: 'u1',
    });
    assert.equal(request.url, 'https://dify.example/v1/workflows/run');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers.Authorization, 'Bearer secret');
    assert.deepEqual(JSON.parse(request.options.body), {
      inputs: { category: '外企', retry_hint: '重试' },
      response_mode: 'blocking',
      user: 'u1',
    });
    assert.equal(result.data.outputs.answer, '{}');
  } finally {
    global.fetch = originalFetch;
  }
});

test('runInsightScenarioWorkflow 摘要 HTML 错误，不泄露整页', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 524,
    headers: { get: () => 'text/html; charset=UTF-8' },
    text: async () => '<!doctype html><html><title>Cloudflare timeout</title><body>' + 'x'.repeat(5000) + '</body></html>',
  });

  try {
    await assert.rejects(
      runInsightScenarioWorkflow({ apiKey: 'secret', baseUrl: 'https://dify.example/v1', inputs: {}, userId: 'u1' }),
      err => err.statusCode === 524
        && /Dify 请求失败: 524/.test(err.message)
        && /Cloudflare timeout/.test(err.message)
        && err.message.length < 300
        && !err.message.includes('<!doctype html>')
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('generateInsightScenario 默认 workflow 响应可直接解析', async () => {
  const draft = getFallbackDraft('体制内');
  let captured;
  const result = await generateInsightScenario({
    category: '体制内',
    env: { DIFY_INSIGHT_GEN_KEY: 'secret', DIFY_API_BASE_URL: 'https://dify.example/v1' },
    runDify: async args => {
      captured = args;
      return { data: { outputs: { answer: JSON.stringify(draft) } } };
    },
  });

  assert.equal(captured.inputs.category, '体制内');
  assert.equal(result.source, 'dify');
  assert.equal(result.draft.phases.length, 4);
});
