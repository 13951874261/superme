const { resolveTestApiBase } = require('./testTarget');
const { requireSandboxDatabase } = require('./sandboxDatabase');

function requireLegacyTestTarget(kind) {
  if (kind === 'database') {
    try { return requireSandboxDatabase(); }
    catch (error) { throw new Error(`测试隔离：${error.message}`); }
  }
  if (kind === 'model') {
    if (process.env.RUN_LIVE_LLM_TESTS !== 'true') throw new Error('测试隔离：真实模型测试需显式设置 RUN_LIVE_LLM_TESTS=true');
    return;
  }
  const base = resolveTestApiBase();
  if (!base) throw new Error('测试隔离：需显式提供独立本机测试服务 TEST_API_BASE_URL');
  return base;
}

module.exports = { requireLegacyTestTarget };
