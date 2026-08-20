const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relPath) => fs.readFileSync(path.join(__dirname, '..', '..', relPath), 'utf8');

const vocabApi = read('src/services/vocabAPI.ts');
const hook = read('src/hooks/useVocabCollect.ts');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

// 1. 同步收录请求必须静默错误，避免迟到 Matrix LLM timeout Toast 盖掉「已转入任务中心」
assert.match(vocabApi, /export async function addWordEnriched/);
const enrichedFn = vocabApi.slice(vocabApi.indexOf('export async function addWordEnriched'));
const enrichedBody = enrichedFn.slice(0, enrichedFn.indexOf('export async function', 10) > 0
  ? enrichedFn.indexOf('\nexport async function', 10)
  : 800);
assert.match(enrichedBody, /silent:\s*true/, 'addWordEnriched 必须 silent:true，交互提示交给 useVocabCollect');

// 2. 超时转后台必须提示任务中心
assert.match(hook, /已转入后台处理，稍后可在【任务中心】查看/);
assert.match(hook, /startPolling/);

// 3. 后台批量必须 forceNew 独立重试
const asyncIdx = server.indexOf("app.post('/api/vocab/batch-add-async'");
assert.ok(asyncIdx > 0, '缺少 batch-add-async');
const asyncChunk = server.slice(asyncIdx, asyncIdx + 6000);
assert.match(asyncChunk, /forceNew:\s*true/, 'batch-add-async 调用 enrich 时必须 forceNew:true');

// 4. 软失败：矩阵失败保留词条
assert.match(server, /matrix_pending_retry:\s*true/, '矩阵失败须写入 matrix_pending_retry');

console.log('✅ vocabCollectBackgroundHandoffContract.test.js 通过');
