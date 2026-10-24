const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const sourcePath = path.join(__dirname, '../services/taskQueue.js');

test('测试队列独立存储，保留业务数据，进程退出清理临时文件', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task-queue-regression-'));
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(dataDir);
  const businessPath = path.join(dataDir, 'tasks.json');
  const original = JSON.stringify({ tasks: [{ id: 'business-task', status: 'completed' }] });
  fs.writeFileSync(businessPath, original);
  const script = `
    const fs = require('node:fs');
    const vm = require('node:vm');
    const moduleObject = { exports: {} };
    vm.runInNewContext(fs.readFileSync(process.argv[1], 'utf8'), {
      require, module: moduleObject, __dirname: process.argv[2], process, console,
      setInterval, clearInterval
    });
    const queue = moduleObject.exports;
    const loaded = queue.getAllTasks().length;
    const task = queue.createTask('url', '测试任务');
    queue.updateTask(task.id, { status: 'completed' });
    const persisted = JSON.parse(fs.readFileSync(queue.queuePath, 'utf8'));
    console.log(JSON.stringify({ queuePath: queue.queuePath, loaded, persisted: persisted.tasks.length }));
  `;
  try {
    const run = () => {
      const output = execFileSync(process.execPath, ['-e', script, sourcePath, path.join(root, 'services')], {
        env: { ...process.env, NODE_ENV: 'test' }, encoding: 'utf8',
      });
      return JSON.parse(output.trim().split('\n').at(-1));
    };
    const first = run();
    assert.equal(first.loaded, 0, '测试不得加载业务任务');
    assert.equal(first.persisted, 1, '测试仍需验证真实文件持久化');
    assert.equal(fs.readFileSync(businessPath, 'utf8'), original, '业务任务文件不得改变');
    assert.notEqual(first.queuePath, businessPath);
    assert.equal(fs.existsSync(first.queuePath), false, '退出应清理测试文件');
    const second = run();
    assert.notEqual(first.queuePath, second.queuePath, '不同进程不得共享测试文件');
    assert.equal(second.loaded, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
