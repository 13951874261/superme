const assert = require('assert');
const fs = require('fs');
const path = require('path');

const taskContextPath = path.join(__dirname, '..', '..', 'src', 'components', 'TaskContext.tsx');
const content = fs.readFileSync(taskContextPath, 'utf8');

assert.match(content, /POLL_REQUEST_TIMEOUT_MS\s*=\s*10_000/);
assert.match(content, /POLL_MAX_TRANSIENT_FAILURES\s*=\s*6/);
assert.match(content, /setTimeout\(\(\) => pollController\.abort\(\), POLL_REQUEST_TIMEOUT_MS\)/);
assert.match(content, /transientFailuresRef/);
assert.match(content, /if \(transientFailures >= POLL_MAX_TRANSIENT_FAILURES\)/);
assert.match(content, /const API_BASE = import\.meta\.env\.DEV \? 'http:\/\/localhost:3001' : ''/);
assert.ok(!content.includes("error: '轮询任务状态失败，网络连接中断'"), '网络异常不得伪造后端失败状态');

console.log('taskPollingContract.test.js passed');
