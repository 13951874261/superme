/**
 * 资料抽屉改删必须带 userId，且只能改自己的条目。
 * 运行：node vocab-server/tests/knowledgeVaultOwner.test.js
 */
const assert = require('assert');
const { assertKnowledgeVaultOwner, readKnowledgeVaultUserId } = require('../services/knowledgeVaultExtra');

assert.deepEqual(assertKnowledgeVaultOwner(null, 'u1'), { status: 404, error: 'Not found' });
assert.deepEqual(assertKnowledgeVaultOwner({ id: 'k1', user_id: 'u1' }, ''), { status: 400, error: 'userId required' });
assert.deepEqual(assertKnowledgeVaultOwner({ id: 'k1', user_id: 'u1' }, null), { status: 400, error: 'userId required' });
assert.deepEqual(assertKnowledgeVaultOwner({ id: 'k1', user_id: 'u1' }, 'u2'), { status: 403, error: 'Forbidden' });
assert.equal(assertKnowledgeVaultOwner({ id: 'k1', user_id: 'u1' }, 'u1'), null);

assert.equal(readKnowledgeVaultUserId({ body: { userId: 'u1' }, query: {} }), 'u1');
assert.equal(readKnowledgeVaultUserId({ body: {}, query: { userId: 'u2' } }), 'u2');
assert.equal(readKnowledgeVaultUserId({ body: { userId: 'u1' }, query: { userId: 'u2' } }), 'u1');
assert.equal(readKnowledgeVaultUserId({ body: {}, query: {} }), '');

console.log('knowledgeVaultOwner.test.js passed');
