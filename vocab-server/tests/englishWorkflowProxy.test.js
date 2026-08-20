const assert = require('assert');
const { createWorkflowRunner } = require('../services/englishWorkflowProxy');

(async () => {
  const requests = [];
  const run = createWorkflowRunner({
    apiKey: 'server-only-key',
    baseUrl: 'https://dify.example/v1/',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ data: { outputs: { result: '{"ok":true}' } } }) };
    },
  });

  await assert.rejects(() => createWorkflowRunner({ apiKey: '', baseUrl: 'x', fetchImpl: async () => ({}) })({ inputs: {} }), /服务端未配置/);
  const payload = await run({ inputs: { theme: '谈判', user_current_profile: '偏好' }, userId: 'u1' });
  assert.deepStrictEqual(payload, { data: { outputs: { result: '{"ok":true}' } } });
  assert.strictEqual(requests[0].url, 'https://dify.example/v1/workflows/run');
  assert.strictEqual(requests[0].options.headers.Authorization, 'Bearer server-only-key');
  const body = JSON.parse(requests[0].options.body);
  assert.strictEqual(body.user, 'u1');
  assert.strictEqual(body.inputs.theme, '谈判');
  assert.strictEqual(body.response_mode, 'blocking');
  assert.ok(body.inputs._system_time);
  assert.ok(body.inputs._system_timestamp_ms);
  assert.strictEqual(body.apiKey, undefined);
  console.log('englishWorkflowProxy tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
