const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const start = server.indexOf("app.post('/api/listen/sync-long-article-to-listen'");
const end = server.indexOf("app.post('/api/listen/upload-audio'", start);
const route = server.slice(start, end);

assert.ok(start >= 0, '应提供长文盲听音频重生接口');
assert.match(route, /AND duration = \?/i, '必须精确匹配所选时长');
assert.ok(!route.includes('looseRow'), '不得静默跨主题回退');
assert.match(route, /force:\s*true/, '重新生成必须强制覆盖旧音频');
assert.match(route, /content:\s*scriptText/, '任务结果必须返回实际采用的长文正文');
assert.match(route, /articleId:\s*articleRow\.id/, '任务结果必须返回长文 ID');

console.log('listenLongArticleRegenerateContract.test.js passed');
