const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('历史联网与数据库测试默认拒绝启动，早于依赖加载', () => {
  const fs = require('node:fs');
  const root = path.resolve(__dirname, '../..');
  const names = ['.', 'scratch', 'artifacts/scratch', 'vocab-server', 'vocab-server/scripts']
    .flatMap((dir) => fs.readdirSync(path.join(root, dir))
      .filter((name) => /test/i.test(name) && /\.(js|cjs|mjs)$/.test(name))
      .map((name) => path.join(dir, name)))
    .filter((name) => fs.readFileSync(path.join(root, name), 'utf8').includes('requireLegacyTestTarget'));
  assert.ok(names.length >= 30);
  for (const name of names) {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../..', name)], {
      encoding: 'utf8', env: { ...process.env, TEST_API_BASE_URL: '', TEST_DB_PATH: '', RUN_LIVE_LLM_TESTS: '' }, timeout: 5000,
    });
    assert.notEqual(result.status, 0, name);
    assert.match(result.stderr, /测试隔离/, name);
  }
});
