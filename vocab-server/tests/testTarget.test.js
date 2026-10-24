const test = require('node:test');
const assert = require('node:assert/strict');

test('远程测试默认关闭，只接受显式本机测试地址', () => {
  const { resolveTestApiBase } = require('./helpers/testTarget');
  assert.equal(resolveTestApiBase({}), null);
  assert.equal(resolveTestApiBase({ TEST_API_BASE_URL: 'http://127.0.0.1:45678' }), 'http://127.0.0.1:45678');
  assert.throws(() => resolveTestApiBase({ TEST_API_BASE_URL: 'https://app.liujingzhuwo.site' }), /本机/);
  assert.throws(() => resolveTestApiBase({ TEST_API_BASE_URL: 'file:///tmp/test' }), /本机/);
});
