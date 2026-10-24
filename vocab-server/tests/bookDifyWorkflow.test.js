const assert = require('node:assert/strict');
const test = require('node:test');
const { runBookWorkflow, assertProductionBookWorkflows } = require('../services/bookDifyWorkflow');

test('生产环境缺少任一书籍 workflow 配置时阻止启动', () => {
  assert.throws(() => assertProductionBookWorkflows({ NODE_ENV: 'production' }), (error) => error.errorCode === 'WORKFLOW_NOT_CONFIGURED');
  assert.doesNotThrow(() => assertProductionBookWorkflows({ NODE_ENV: 'development' }));
  const configured = { NODE_ENV: 'production', DIFY_BOOK_ALLOWED_HOSTS: 'dify.example', DIFY_BOOK_FRAMEWORK_API_KEY: 'x', DIFY_BOOK_FRAMEWORK_URL: 'https://dify.example/v1', DIFY_BOOK_LISTEN_API_KEY: 'x', DIFY_BOOK_LISTEN_URL: 'https://dify.example/v1', DIFY_BOOK_EXERCISE_API_KEY: 'x', DIFY_BOOK_EXERCISE_URL: 'https://dify.example/v1' };
  assert.doesNotThrow(() => assertProductionBookWorkflows(configured));
  assert.throws(() => assertProductionBookWorkflows({ ...configured, DIFY_BOOK_LISTEN_URL: 'http://attacker.example/v1' }), (error) => error.errorCode === 'WORKFLOW_NOT_CONFIGURED');
});

test('Dify workflow 使用 blocking 契约并要求 run id 与 outputs', async () => {
  let request;
  const result = await runBookWorkflow({ apiKey: 'secret', workflowUrl: 'https://dify.example/v1/', user: 'alice', inputs: { operation: 'evaluate' }, fetchImpl: async (url, init) => { request = { url, init }; return { ok: true, json: async () => ({ data: { id: 'run-1', outputs: { totalScore: 90, model: 'm', promptVersion: 'v1' } } }) }; } });
  assert.equal(request.url, 'https://dify.example/v1/workflows/run'); assert.equal(request.init.headers.Authorization, 'Bearer secret');
  assert.deepEqual(JSON.parse(request.init.body), { response_mode: 'blocking', user: 'alice', inputs: { operation: 'evaluate' } });
  assert.equal(result.runId, 'run-1'); assert.equal(result.outputs.totalScore, 90);
  await assert.rejects(runBookWorkflow({ apiKey: 'x', workflowUrl: 'https://x', user: 'u', inputs: {}, fetchImpl: async () => ({ ok: true, json: async () => ({ data: { outputs: {} } }) }) }), (error) => error.errorCode === 'WORKFLOW_SCHEMA_INVALID');
});
