const assert = require('assert');
const { isOralUpstreamFailure, mapOralUpstreamError } = require('../services/oralChatUpstreamError');

assert.equal(isOralUpstreamFailure(522, {}), true);
assert.equal(isOralUpstreamFailure(400, { message: 'PluginInvokeError status code 522: <!DOCTYPE html>' }), true);
assert.equal(isOralUpstreamFailure(400, { message: '缺少 query 参数。' }), false);

const gateway = mapOralUpstreamError(400, { code: 'invalid_param', message: 'API request failed with status code 522' });
assert.equal(gateway.status, 503);
assert.equal(gateway.body.fallback, true);
assert.equal(gateway.body.upstreamStatus, 400);

const local400 = mapOralUpstreamError(400, { message: '缺少 query 参数。' });
assert.equal(local400.status, 400);
assert.ok(!local400.body.fallback);

const five = mapOralUpstreamError(502, { error: 'bad gateway' });
assert.equal(five.status, 503);
assert.equal(five.body.fallback, true);

console.log('PASS oralChatUpstreamError');
