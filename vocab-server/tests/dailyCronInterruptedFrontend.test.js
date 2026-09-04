const assert = require('assert');
const fs = require('fs');
const path = require('path');

const taskCenter = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'GlobalTaskCenter.tsx'),
  'utf8'
);

assert.match(
  taskCenter,
  /run\.status === 'failed'\s*&&\s*run\.error === 'interrupted: server restart'/,
  '仅将服务器重启造成的失败识别为执行中断'
);
assert.match(taskCenter, /执行中断/, '中断任务应显示执行中断状态');
assert.match(
  taskCenter,
  /服务器重启导致任务未正常收尾，已生成内容仍可使用/,
  '中断任务应说明已有内容仍可使用'
);

console.log('dailyCronInterruptedFrontend.test.js passed');
