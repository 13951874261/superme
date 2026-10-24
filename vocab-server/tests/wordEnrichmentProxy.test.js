const assert = require('assert');
const { createWorkflowRunner } = require('../services/englishWorkflowProxy');

(async () => {
  const requests = [];
  const run = createWorkflowRunner({
    apiKey: 'server-key',
    baseUrl: 'https://dify.example/v1',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ data: { outputs: { result: '{"word":"negotiate"}' } } }) };
    },
  });
  await run({ inputs: { target_word: 'negotiate' }, userId: 'u1' });
  assert.strictEqual(requests[0].url, 'https://dify.example/v1/workflows/run');
  assert.strictEqual(JSON.parse(requests[0].options.body).user, 'u1');
  console.log('word enrichment runner tests passed');
})().catch((error) => { console.error(error); process.exit(1); });