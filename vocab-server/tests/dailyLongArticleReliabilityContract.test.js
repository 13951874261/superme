const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const extractStart = server.indexOf('async function runDailyExtractAsync');
const extractEnd = server.indexOf("app.post('/api/english/login'", extractStart);
const extract = server.slice(extractStart, extractEnd);

assert.ok(extractStart >= 0, '应存在后台长文生成函数');
assert.match(extract, /collectDifyStreamingAnswer\(/, '后台长文应复用统一 SSE 读取器');
assert.match(extract, /DIFY_LONG_ARTICLE_MAX_ATTEMPTS/, '后台长文应支持瞬时流错误重试');
assert.match(extract, /terminated|UND_ERR_BODY_TIMEOUT|stream idle timeout/i, '应仅识别可重试的流读取错误');

const cron = fs.readFileSync(path.join(__dirname, '..', 'services', 'dailyPackCron.js'), 'utf8');
assert.match(cron, /const DURATIONS = \[1\]/, '每日 Cron 只能自动生成 1 分钟长文');
assert.doesNotMatch(cron, /4体裁 x 4等级 x 4时长 = 64/, 'Cron 注释不得继续声明生成 64 组');

console.log('dailyLongArticleReliabilityContract.test.js passed');
