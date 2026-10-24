const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('写库诊断脚本拒绝业务路径，只接受临时数据库副本', () => {
  const { requireSandboxDatabase } = require('./helpers/sandboxDatabase');
  assert.throws(() => requireSandboxDatabase({}), /TEST_DB_PATH/);
  assert.throws(() => requireSandboxDatabase({ TEST_DB_PATH: __filename }), /临时目录/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-db-test-'));
  try {
    const file = path.join(root, 'fixture.db');
    fs.writeFileSync(file, 'fixture');
    const env = { TEST_DB_PATH: file };
    assert.equal(requireSandboxDatabase(env), fs.realpathSync(file));
    assert.equal(env.NODE_ENV, 'test');
    assert.equal(env.SUPER_AGENT_DB_PATH, fs.realpathSync(file));
    assert.equal(env.VOCAB_DB_PATH, fs.realpathSync(file));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('写库诊断脚本默认拒绝启动，尚未加载服务或数据库', () => {
  for (const name of ['test-cron-pipeline.js', 'test-generate-flaw.js', 'test-single-1min.js']) {
    const env = { ...process.env };
    delete env.TEST_DB_PATH;
    const child = spawnSync(process.execPath, [path.join(__dirname, '../scripts', name)], { env, encoding: 'utf8' });
    assert.notEqual(child.status, 0);
    assert.match(child.stderr, /需提供临时目录内的测试数据库副本 TEST_DB_PATH/);
  }
});

test('精听测试素材存放临时目录，退出后清理', () => {
  const modulePath = require.resolve('../services/dailyListenPreGenerateService');
  const child = spawnSync(process.execPath, ['-e', `
    const service = require(${JSON.stringify(modulePath)});
    console.log(JSON.stringify([service.AUDIO_ROOT, service.ARTICLE_ROOT]));
  `], { env: { ...process.env, NODE_ENV: 'test' }, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  const roots = JSON.parse(child.stdout.trim().split('\n').at(-1));
  for (const root of roots) {
    const relative = path.relative(os.tmpdir(), root);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), root);
    assert.equal(fs.existsSync(root), false);
  }
});
