const assert = require('assert');
const { createWorkflowUploader } = require('../services/englishWorkflowProxy');

(async () => {
  const requests = [];
  const upload = createWorkflowUploader({
    apiKey: 'server-only-key',
    baseUrl: 'https://dify.example/v1/',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ data: { outputs: { result: '{"score":90}' } } }) };
    },
  });

  const fakeFile = { buffer: Buffer.from('audio-bytes'), originalname: 'speech.webm', mimetype: 'audio/webm' };
  await assert.rejects(() => upload({ userId: 'u1', inputs: {}, file: null }), /缺少音频文件/);

  const payload = await upload({ userId: 'u1', inputs: { theme: '谈判' }, file: fakeFile });
  assert.deepStrictEqual(payload, { data: { outputs: { result: '{"score":90}' } } });
  assert.strictEqual(requests[0].url, 'https://dify.example/v1/workflows/run');
  assert.strictEqual(requests[0].options.headers.Authorization, 'Bearer server-only-key');
  assert.strictEqual(requests[0].options.headers['Content-Type'], undefined);
  assert.strictEqual(requests[0].options.body.get('user'), 'u1');
  assert.strictEqual(requests[0].options.body.get('response_mode'), 'blocking');
  assert.strictEqual(JSON.parse(requests[0].options.body.get('inputs')).theme, '谈判');
  assert.strictEqual(requests[0].options.body.get('file').type, 'audio/webm');
  console.log('englishWorkflowUploader tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
