/**
 * C1：已收录生词 → 词典首响可直接用生词本；后台仍拉 Cam/Dify 更新。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

assert.match(server, /function hasVocabBookDisplayPayload\s*\(/, '缺少生词本可展示判定');
assert.match(server, /fromVocabBook:\s*true/, '首响须标记 fromVocabBook');
assert.match(
  server,
  /inVocabulary[\s\S]{0,400}?vocabSeedPayload[\s\S]{0,800}?fromVocabBook:\s*true/,
  '已收录且有可展示种子时应走生词本秒开',
);
assert.match(
  server,
  /fromVocabBook[\s\S]{0,200}?backgroundEnriching:\s*true/,
  '生词本秒开须继续后台 Cam/Dify 增强',
);
// 生词本秒开须在 Cambridge settleWithin 长等待之前，避免阻塞首响
const vocabInstantIdx = server.indexOf('fromVocabBook: true');
const settleIdx = server.indexOf('settleWithin(cambridgePromise, 8000)');
assert.ok(vocabInstantIdx > 0, '找不到 fromVocabBook 秒开');
assert.ok(settleIdx > vocabInstantIdx, '生词本秒开必须出现在 Cambridge 8s 等待之前');

console.log('PASS vocabBookFirstDictQueryContract');
