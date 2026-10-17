const assert = require('node:assert/strict');
const { resolveDifyEmbedSession } = require('../services/difyEmbedSession');

(async () => {
  let release;
  let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const fetchImpl = async url => {
    calls++;
    await gate;
    return { ok: true, json: async () => url.includes('/passport')
      ? { access_token: 'fixture-token' }
      : { data: [] } };
  };
  const options = { userId: 'fixture-a', webBaseUrl: 'https://dify.example', appCode: 'fixture-code', fetchImpl };
  const first = resolveDifyEmbedSession(options);
  const second = resolveDifyEmbedSession(options);
  assert.equal(calls, 3, '同账号并发恢复仅查询一次三个历史范围');
  const other = resolveDifyEmbedSession({ ...options, userId: 'fixture-b' });
  assert.equal(calls, 6, '不同账号不得共享恢复查询');
  const config = resolveDifyEmbedSession({ ...options, appCode: 'other-code' });
  assert.equal(calls, 9, '不同应用配置不得共享恢复查询');
  const renewed = await resolveDifyEmbedSession({ ...options, renew: true });
  assert.equal(renewed.reason, 'renew');
  assert.equal(calls, 9, '新对话不等待历史恢复');
  release();
  const [a, b] = await Promise.all([first, second, other, config]);
  assert.deepEqual(a, b);
  assert.notEqual(a, b, '各请求结果独立，避免调用方互相修改');
  const before = calls;
  await resolveDifyEmbedSession(options);
  assert.equal(calls - before, 6, '完成后重新查询最新历史，不缓存成功结果');

  let attempts = 0;
  const broken = { ...options, fetchImpl: async () => {
    attempts++;
    return { ok: true, json: async () => { throw new Error('fixture failure'); } };
  } };
  // ponytail: 上游异常由现有恢复逻辑处理；这里验证共享状态释放，不改变错误语义。
  await resolveDifyEmbedSession(broken).catch(() => {});
  const failedCalls = attempts;
  await resolveDifyEmbedSession(broken).catch(() => {});
  assert(attempts > failedCalls, '失败后允许重新恢复');
  console.log('difyEmbedSessionInflight.test.cjs passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
