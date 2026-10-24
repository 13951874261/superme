// Run: node vocab-server/tests/englishWritingReviewKey.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../server.js'), 'utf8');
const start = source.indexOf("app.post('/api/dify/write-review'");
assert.ok(start >= 0);
const route = source.slice(start, source.indexOf('\n});', start) + 5);
const expected = { L1: 'Grammar', L2: 'Tone', L3: 'Strategy', optimized_version: 'Dear Board, Thank you.' };

async function invoke(env, body) {
  let handler, request;
  vm.runInNewContext(route, {
    app: { post: (_path, callback) => { handler = callback; } },
    process: { env }, db: {}, console: { log() {}, warn() {}, error() {} },
    require: () => ({
      loadInjectedKnowledgeSafe: () => ({ ids: [], context: '', reminder: '', syncedCount: 0, usedCount: 0 }),
      attachKnowledgeContext: inputs => inputs,
      appendKnowledgeTracesSafe() {},
    }),
    resolveProfileForDify: () => '',
    extractJsonFromString: value => value,
    fetch: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ data: { outputs: { result: JSON.stringify(expected) } } }) };
    },
  });
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = JSON.parse(JSON.stringify(value)); return this; } };
  await handler({ body }, response);
  return { response, request };
}

(async () => {
  const body = { user_text: ' Dear Board, Thank you. ', mail_intent: ' Align ', theme: ' Project ', userId: 'test' };
  const good = await invoke({ DIFY_ENGLISH_WRITING_REVIEW_API_KEY: 'english-test', DIFY_WRITE_GOVERNANCE_API_KEY: 'chinese-test' }, body);
  assert.equal(good.request.options.headers.Authorization, 'Bearer english-test');
  assert.deepEqual(good.response.body.data, expected);
  assert.equal(JSON.parse(good.request.options.body).inputs.user_text, 'Dear Board, Thank you.');
  const missing = await invoke({ DIFY_WRITE_GOVERNANCE_API_KEY: 'chinese-test' }, body);
  assert.equal(missing.response.statusCode, 503);
  assert.equal(missing.request, undefined);
  const invalid = await invoke({ DIFY_ENGLISH_WRITING_REVIEW_API_KEY: 'english-test' }, { ...body, user_text: '' });
  assert.equal(invalid.response.statusCode, 400);
  assert.equal(invalid.request, undefined);
  console.log('PASS: independent workflow key, missing configuration, missing input');
})().catch(error => { console.error(error); process.exitCode = 1; });
