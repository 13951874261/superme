const test = require('node:test');
const assert = require('node:assert/strict');
const { createFreeOralRateLimiter } = require('../services/freeOralRateLimit');

test('自由口语限流：无效配置回退安全默认值', () => {
  const invalidWindow = createFreeOralRateLimiter({ windowMs: Number.NaN, max: 1 });
  assert.equal(invalidWindow('u1').allowed, true);
  assert.equal(invalidWindow('u1').allowed, false);

  const invalidMax = createFreeOralRateLimiter({ windowMs: 1000, max: 0 });
  assert.equal(invalidMax('u1').allowed, true);
});

test('自由口语限流：按用户隔离并返回重试秒数', () => {
  let timestamp = 1000;
  const check = createFreeOralRateLimiter({ windowMs: 1000, max: 2, now: () => timestamp });
  assert.equal(check('u1').allowed, true);
  assert.equal(check('u1').allowed, true);
  assert.deepEqual(check('u1'), { allowed: false, retryAfterSeconds: 1 });
  assert.equal(check('u2').allowed, true);
  timestamp = 2001;
  assert.equal(check('u1').allowed, true);
});
