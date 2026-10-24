const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function requireSandboxDatabase(env = process.env) {
  const file = env.TEST_DB_PATH;
  if (!file || !fs.existsSync(file)) throw new Error('需提供临时目录内的测试数据库副本 TEST_DB_PATH，禁止使用业务数据库');
  const resolved = fs.realpathSync(file);
  const relative = path.relative(fs.realpathSync(os.tmpdir()), resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(resolved).isFile()) {
    throw new Error('TEST_DB_PATH 必须指向临时目录内的测试数据库副本');
  }
  env.NODE_ENV = 'test';
  env.SUPER_AGENT_DB_PATH = resolved;
  env.VOCAB_DB_PATH = resolved;
  return resolved;
}

module.exports = { requireSandboxDatabase };
