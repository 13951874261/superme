const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
assert.match(src, /app\.delete\(\s*['"]\/api\/tasks\/:taskId['"]/);
assert.match(src, /app\.post\(\s*['"]\/api\/tasks\/clear-finished['"]/);
assert.match(src, /app\.delete\(\s*['"]\/api\/daily-cron\/runs\/:runId['"]/);
assert.match(src, /app\.post\(\s*['"]\/api\/daily-cron\/runs\/clear-finished['"]/);
console.log('✅ taskCenterDeleteRoutesContract.test.js 通过');
