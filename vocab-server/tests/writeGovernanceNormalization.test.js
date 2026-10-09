const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { normalizeResult, isMeaningfulResult } = require('../services/writeGovernanceFallback');
const source = fs.readFileSync(process.argv[2] || path.join(__dirname, '../server.js'), 'utf8');
const start = source.indexOf('async function handleWriteGovernanceWorkflow(');
const end = source.indexOf("app.post('/api/vocab/purify'", start);
assert.ok(start >= 0 && end > start, '必须找到实际线上处理函数');

async function review(raw, originalText = '各部门要落实重点项目建设任务。') {
  let calls = 0;
  const handler = vm.runInNewContext(`(${source.slice(start, end).trim()})`, {
    normalizeWritingResult: normalizeResult, isMeaningfulWritingResult: isMeaningfulResult,
    englishWorkflowRunners: { writeGovernance: async () => {
      calls++;
      return { data: { outputs: { analysis_result: raw } } };
    } },
    db: {}, console: { log() {}, warn() {} },
    require: () => ({
      loadInjectedKnowledgeSafe: () => ({ context: '', ids: [], syncedCount: 0, usedCount: 0 }),
      attachKnowledgeContext: inputs => inputs, appendKnowledgeTracesSafe() {},
    }),
  });
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ body: { inputs: { task_type: 'document_correction', original_text: originalText }, userId: 'test-user' } }, res);
  return { ...res, calls };
}

(async () => {
  for (const raw of [
    JSON.stringify({ level_1: '字词审阅', level_2: '行文审阅', level_3: '战略审阅' }),
    { L1: '字词审阅', L2: '行文审阅', L3: '战略审阅' },
    '```json\n' + JSON.stringify({ level_1: { text: '字词审阅' }, level_2: ['行文审阅'], level_3: '战略审阅' }) + '\n```',
  ]) {
    const result = await review(raw);
    assert.equal(result.code, 200, '合法三级审阅结果不得返回 502');
    assert.equal(result.body.source, 'dify');
    assert.deepEqual(JSON.parse(result.body.data.outputs.analysis_result), { L1: '字词审阅', L2: '行文审阅', L3: '战略审阅', optimized_version: '', level_1: '字词审阅', level_2: '行文审阅', level_3: '战略审阅' });
  }
  for (const raw of ['', '{}', 'not JSON', '{broken', '{"unrelated":"内容"}']) {
    assert.equal((await review(raw)).code, 502, '空或非法输出不得伪装为成功');
  }
  const empty = await review('{}', '   ');
  assert.equal(empty.code, 400);
  assert.equal(empty.calls, 0, '空原文不得调用上游');
  console.log('PASS: 文治归一化回归，9 个用例。');
})().catch(error => { console.error(error); process.exitCode = 1; });
